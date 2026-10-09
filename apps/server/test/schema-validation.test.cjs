const assert = require('node:assert/strict');
const { test } = require('node:test');
require('reflect-metadata');

const { StandardSchemaValidationPipe } = require('@nestjs/common');
const { ROUTE_ARGS_METADATA } = require('@nestjs/common/constants');
const {
  RouteParamtypes,
} = require('@nestjs/common/enums/route-paramtypes.enum');
const { Reflector } = require('@nestjs/core');
const { Test } = require('@nestjs/testing');
const request = require('supertest');
const load = (path) => require(`../dist/${path}`);
const { listAssetsSchema, thumbnailQuerySchema } = load(
  'modules/assets/schemas/assets-query.schema',
);
const { assetIdsSchema } = load('modules/assets/schemas/asset-ids.schema');
const { searchQuerySchema } = load(
  'modules/search/schemas/search-query.schema',
);
const { createUploadSessionSchema } = load(
  'modules/uploads/schemas/upload.schema',
);
const { createShareSchema, shareAssetSchema, sharePageSchema } = load(
  'modules/shares/schemas/shares.schema',
);
const {
  createAlbumSchema,
  updateAlbumSchema,
  updateTagSchema,
  batchAssetTagsSchema,
} = load('modules/collections/schemas/collections.schema');
const { albumMemberPermissionsSchema, inviteAlbumMemberSchema } = load(
  'modules/collections/schemas/album-members.schema',
);
const { confirmAssetTagsSchema } = load(
  'modules/collections/schemas/confirm-asset-tags.schema',
);
const {
  createUserSchema,
  updateProfileSchema,
  updateUserSchema,
  listUsersSchema,
} = load('modules/iam/user/schemas/user.schema');
const { createPermissionSchema, updatePermissionSchema } = load(
  'modules/iam/permission/schemas/permission.schema',
);
const { createRoleSchema, updateRoleSchema } = load(
  'modules/iam/role/schemas/role.schema',
);
const { permissionCodesSchema } = load('modules/iam/schemas/iam.schema');
const {
  forgetSchema,
  sendResetPasswordMailSchema,
  registerSchema,
  loginSchema,
} = load('modules/iam/auth/schemas/auth.schema');
const { queueRecognitionSchema } = load(
  'modules/ai/schemas/queue-recognition.schema',
);

const pipe = new StandardSchemaValidationPipe();
const validate = (schema, value, type = 'body') =>
  pipe.transform(value, { type, schema, metatype: Object });
async function rejects(schema, value, field, type = 'body') {
  await assert.rejects(validate(schema, value, type), (error) => {
    assert.equal(error.getStatus(), 400);
    const messages = error.getResponse().message;
    assert.ok(Array.isArray(messages));
    if (field)
      assert.ok(
        messages.some((message) => message.includes(field)),
        messages.join(', '),
      );
    return true;
  });
}

test('query defaults and scalar conversions reach handlers as numbers and booleans', async () => {
  assert.deepEqual(await validate(listAssetsSchema, {}, 'query'), {
    limit: 24,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    timeField: 'createdAt',
  });
  const query = await validate(
    listAssetsSchema,
    {
      limit: '50',
      year: '2024',
      minSize: '0',
      favorite: 'false',
      uncategorized: 'true',
      type: ' DOCUMENT ',
      tag: ' invoices ',
    },
    'query',
  );
  assert.equal(query.limit, 50);
  assert.equal(query.year, 2024);
  assert.equal(query.minSize, 0);
  assert.equal(query.favorite, false);
  assert.equal(query.uncategorized, true);
  assert.equal(query.type, 'document');
  assert.equal(query.tag, 'invoices');
  assert.deepEqual(await validate(thumbnailQuerySchema, {}, 'query'), {
    size: 'sm',
  });
  assert.deepEqual(await validate(listUsersSchema, {}, 'query'), {
    page: 1,
    limit: 20,
  });
});

test('invalid numeric query values cannot silently become defaults or zero', async () => {
  for (const limit of [
    '',
    ' ',
    'abc',
    'NaN',
    'Infinity',
    '0',
    '101',
    '1.5',
    [],
    ['1'],
    true,
    null,
  ]) {
    await rejects(listAssetsSchema, { limit }, 'limit', 'query');
  }
  await rejects(listAssetsSchema, { minSize: '' }, 'minSize', 'query');
  await rejects(listAssetsSchema, { year: '10000' }, 'year', 'query');
  await rejects(listUsersSchema, { page: '1000001' }, 'page', 'query');
});

test('boolean query conversion is explicit and body permissions require real booleans', async () => {
  for (const favorite of ['False', '0', '', ['false'], 1]) {
    await rejects(listAssetsSchema, { favorite }, 'favorite', 'query');
  }
  assert.deepEqual(await validate(albumMemberPermissionsSchema, {}), {
    canAdd: false,
    canEdit: false,
    canRemove: false,
  });
  await rejects(albumMemberPermissionsSchema, { canEdit: 'false' }, 'canEdit');
  await rejects(createAlbumSchema, { name: 'Album', shared: 'true' }, 'shared');
});

test('strict objects reject unknown fields, including inherited update schemas', async () => {
  await rejects(listAssetsSchema, { unexpected: 'x' }, 'unexpected', 'query');
  await rejects(updateUserSchema, { administrator: true }, 'administrator');
  await rejects(updateAlbumSchema, { shared: true }, 'shared');
  await rejects(queueRecognitionSchema, { force: true }, 'force');
});

test('PATCH omission is distinct from clearing a nullable field', async () => {
  assert.deepEqual(await validate(updateUserSchema, {}), {});
  assert.deepEqual(await validate(updateAlbumSchema, {}), {});
  assert.deepEqual(
    await validate(updateAlbumSchema, {
      coverImage: null,
      coverAssetId: null,
      description: null,
    }),
    { coverImage: null, coverAssetId: null, description: null },
  );
  assert.deepEqual(
    await validate(updateProfileSchema, { username: ' User ', avatar: null }),
    {
      username: 'User',
      avatar: null,
    },
  );
  assert.deepEqual(await validate(updatePermissionSchema, { parentId: null }), {
    parentId: null,
  });
  for (const schema of [updateUserSchema, updateAlbumSchema, updateTagSchema]) {
    const field = schema === updateUserSchema ? 'username' : 'name';
    await rejects(schema, { [field]: null }, field);
  }
  await rejects(updateUserSchema, { permissionCodes: null }, 'permissionCodes');
  await rejects(updateRoleSchema, { status: null }, 'status');
  await rejects(updateTagSchema, { mergeIntoId: null }, 'mergeIntoId');
});

test('ID arrays trim before uniqueness checks and retain batch limits', async () => {
  assert.deepEqual(await validate(assetIdsSchema, { ids: [' a ', 'b'] }), {
    ids: ['a', 'b'],
  });
  for (const ids of [
    [],
    ['a', ' a '],
    [''],
    [123],
    ['a\u0000'],
    Array.from({ length: 101 }, (_, i) => String(i)),
  ]) {
    await rejects(assetIdsSchema, { ids }, 'ids');
  }
  assert.deepEqual(
    await validate(batchAssetTagsSchema, { ids: [' a '], names: [' tag '] }),
    {
      ids: ['a'],
      names: ['tag'],
    },
  );
  assert.deepEqual(
    await validate(confirmAssetTagsSchema, { mode: 'existing' }),
    {
      mode: 'existing',
      names: [],
      tagIds: [],
    },
  );
  await rejects(
    confirmAssetTagsSchema,
    { mode: 'existing', tagIds: ['a', ' a '] },
    'tagIds',
  );
  assert.deepEqual(await validate(queueRecognitionSchema, {}), {});
  await rejects(queueRecognitionSchema, { ids: null }, 'ids');
});

test('date filters validate calendar dates and require a timezone for timestamps', async () => {
  for (const from of [
    '2024-02-29',
    '2024-02-29T12:00:00Z',
    '2024-02-29T12:00:00.123+08:00',
  ]) {
    assert.equal(
      (await validate(listAssetsSchema, { from }, 'query')).from,
      from,
    );
  }
  for (const from of [
    '2023-02-29',
    '2024-02-30',
    '2024-13-01',
    '2024-02-29T12:00:00',
    '2024-02-29T12:00:00.1234Z',
  ]) {
    await rejects(listAssetsSchema, { from }, 'from', 'query');
  }
});

test('auth schemas keep reset token rules and the bcrypt UTF-8 byte limit', async () => {
  const reset = {
    email: ' user@example.com ',
    emailCode: 'A'.repeat(64),
    password: '密'.repeat(24),
  };
  assert.equal((await validate(forgetSchema, reset)).email, 'user@example.com');
  await rejects(
    forgetSchema,
    { ...reset, password: '密'.repeat(25) },
    'password',
  );
  await rejects(forgetSchema, { ...reset, password: 'short' }, 'password');
  await rejects(forgetSchema, { ...reset, emailCode: '123456' }, 'emailCode');
  const captcha = {
    email: 'user@example.com',
    captcha: ' abcd ',
    captchaId: 'a38b42bd-9dfb-4d11-b473-2af14c52491a',
  };
  assert.equal(
    (await validate(sendResetPasswordMailSchema, captcha)).captcha,
    'abcd',
  );
  await rejects(
    sendResetPasswordMailSchema,
    { ...captcha, captchaId: 'invalid' },
    'captchaId',
  );
  await rejects(
    sendResetPasswordMailSchema,
    { ...captcha, captcha: 'abc' },
    'captcha',
  );
  await rejects(
    registerSchema,
    {
      username: 'u',
      email: 'invalid',
      password: 'p',
      enterPassword: 'p',
      captcha: 'abcd',
      captchaId: 'id',
    },
    'email',
  );
  await rejects(
    loginSchema,
    {
      email: 'user@example.com',
      password: 12345678,
      captcha: 'abcd',
      captchaId: 'id',
    },
    'password',
  );
});

test('IAM create and update schemas share constraints and normalize human input', async () => {
  const user = await validate(createUserSchema, {
    username: ' User ',
    email: ' USER@example.com ',
    password: 'password123',
  });
  assert.equal(user.username, 'User');
  assert.equal(user.email, 'user@example.com');
  await rejects(
    createUserSchema,
    { username: 'User', password: 'password123' },
    'email',
  );
  const permission = await validate(createPermissionSchema, {
    permissionName: ' Read ',
    permissionCode: ' asset:read ',
    parentId: null,
  });
  assert.equal(permission.permissionCode, 'asset:read');
  await rejects(
    createPermissionSchema,
    { permissionName: 'Read' },
    'permissionCode',
  );
  await rejects(
    permissionCodesSchema,
    { permissionCodes: ['asset:read', 'asset:read'] },
    'permissionCodes',
  );
  await rejects(
    permissionCodesSchema,
    { permissionCodes: ['Asset:read'] },
    'permissionCodes',
  );
  await rejects(
    createRoleSchema,
    { roleName: 'Role', roleCode: 'role_user' },
    'roleCode',
  );
  await rejects(
    createRoleSchema,
    { roleName: 'Role', roleCode: 'ROLE_USER', status: '1' },
    'status',
  );
  const invite = await validate(inviteAlbumMemberSchema, {
    email: ' USER@example.com ',
  });
  assert.equal(invite.email, 'user@example.com');
  assert.equal(invite.canRemove, false);
});

test('uploads support ordinary files and reject unsafe names, sizes and hashes', async () => {
  const upload = { fileName: ' report.pdf ', size: 123, hash: 'a'.repeat(64) };
  assert.equal(
    (await validate(createUploadSessionSchema, upload)).fileName,
    'report.pdf',
  );
  for (const fileName of [
    '../secret',
    'a/b',
    'a\\b',
    '.',
    '..',
    'a\u0000b',
    '',
  ]) {
    await rejects(
      createUploadSessionSchema,
      { ...upload, fileName },
      'fileName',
    );
  }
  for (const size of [
    0,
    -1,
    1.5,
    '123',
    true,
    null,
    Number.MAX_SAFE_INTEGER + 1,
  ]) {
    await rejects(createUploadSessionSchema, { ...upload, size }, 'size');
  }
  await rejects(
    createUploadSessionSchema,
    { ...upload, hash: 'x'.repeat(64) },
    'hash',
  );
});

test('share parameter validation and expiration defaults use Standard Schema', async () => {
  const target = { kind: 'asset', targetId: 'a' };
  assert.equal((await validate(createShareSchema, target)).expiresInDays, 7);
  assert.equal(
    (await validate(createShareSchema, { ...target, expiresInDays: '30' }))
      .expiresInDays,
    30,
  );
  for (const expiresInDays of [null, '', true, 2, '365']) {
    await rejects(
      createShareSchema,
      { ...target, expiresInDays },
      'expiresInDays',
    );
  }
  const params = { token: 'a'.repeat(22), assetId: 'asset-1' };
  assert.deepEqual(await validate(shareAssetSchema, params, 'param'), params);
  await rejects(
    shareAssetSchema,
    { ...params, token: 'invalid' },
    'token',
    'param',
  );
  await rejects(shareAssetSchema, { token: params.token }, 'assetId', 'param');
  assert.equal((await validate(sharePageSchema, {}, 'query')).limit, 24);
  await rejects(sharePageSchema, { cursor: null }, 'cursor', 'query');
});

test('search extends asset filters while enforcing its keyword-only mode', async () => {
  const query = await validate(
    searchQuerySchema,
    { q: ' a b ', limit: '12', favorite: 'false' },
    'query',
  );
  assert.equal(query.q, 'a b');
  assert.equal(query.mode, 'keyword');
  assert.equal(query.limit, 12);
  assert.equal(query.favorite, false);
  await rejects(searchQuerySchema, { mode: 'semantic' }, 'mode', 'query');
  await rejects(searchQuerySchema, { q: 'a'.repeat(201) }, 'q', 'query');
});

test('album detail normalizes internal asset queries with the same pagination defaults', async () => {
  const { AlbumsService } = load('modules/collections/albums.service');
  const service = new AlbumsService(
    {},
    {
      list(userId, query) {
        assert.equal(userId, 'user-1');
        assert.deepEqual(query, {
          albumId: 'album-1',
          limit: 12,
          sortBy: 'createdAt',
          sortOrder: 'desc',
          timeField: 'createdAt',
        });
        return { items: [] };
      },
    },
  );
  service.getSummary = async () => ({ id: 'album-1' });
  assert.deepEqual(await service.detail('album-1', 'user-1', { limit: 12 }), {
    id: 'album-1',
    assets: { items: [] },
  });
});

const controllerModules = [
  ['modules/ai/ai.controller', 'AiController', 1],
  ['modules/assets/assets.controller', 'AssetsController', 9],
  ['modules/assets/media-stream.controller', 'MediaStreamController', 2],
  ['modules/collections/albums.controller', 'AlbumsController', 8],
  ['modules/collections/asset-tags.controller', 'AssetTagsController', 2],
  ['modules/collections/tags.controller', 'TagsController', 4],
  ['modules/search/search.controller', 'SearchController', 1],
  ['modules/shares/shares.controller', 'SharesController', 7],
  ['modules/uploads/uploads.controller', 'UploadsController', 1],
  ['modules/iam/auth/auth.controller', 'AuthController', 7],
  ['modules/iam/permission/permission.controller', 'PermissionController', 2],
  ['modules/iam/role/role.controller', 'RoleController', 3],
  ['modules/iam/user/user.controller', 'UserController', 6],
];

test('all 53 former DTO route parameters expose executable Standard Schema metadata', () => {
  const objectTypes = [
    RouteParamtypes.BODY,
    RouteParamtypes.QUERY,
    RouteParamtypes.PARAM,
  ];
  for (const [path, name, minimum] of controllerModules) {
    const controller = load(path)[name];
    assert.ok(controller, name);
    let count = 0;
    for (const method of Object.getOwnPropertyNames(controller.prototype)) {
      const metadata =
        Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, method) ?? {};
      for (const [key, value] of Object.entries(metadata)) {
        if (
          !objectTypes.includes(Number(key.split(':')[0])) ||
          value.data !== undefined
        )
          continue;
        assert.equal(
          typeof value.schema?.['~standard']?.validate,
          'function',
          `${name}.${method}`,
        );
        count++;
      }
    }
    assert.ok(
      count >= minimum,
      `${name}: ${count} parameters, expected at least ${minimum}`,
    );
  }
});

test('real HTTP routes validate before services and preserve response envelopes and binary input', async (t) => {
  const { AssetsController } = load('modules/assets/assets.controller');
  const { UploadsController } = load('modules/uploads/uploads.controller');
  const { SharesController } = load('modules/shares/shares.controller');
  const { AlbumsController } = load('modules/collections/albums.controller');
  const { AllExceptionsFilter } = load('common/filters/all-exceptions.filter');
  const { ResponseInterceptor } = load(
    'common/interceptors/response.interceptor',
  );
  const calls = [];
  const echo =
    (operation) =>
    (...args) => {
      calls.push(operation);
      return { operation, args };
    };
  // Instantiate the real controllers; replace infrastructure-facing services only.
  const cases = [
    [
      AssetsController,
      [{ list: echo('list'), rename: echo('rename') }, {}, {}],
    ],
    [
      UploadsController,
      [
        {
          createSession: echo('createSession'),
          async uploadPart(id, userId, index, stream) {
            const chunks = [];
            for await (const chunk of stream) chunks.push(Buffer.from(chunk));
            return {
              id,
              userId,
              index,
              content: Buffer.concat(chunks).toString('hex'),
            };
          },
        },
      ],
    ],
    [
      SharesController,
      [{ detail: echo('shareDetail'), create: echo('createShare') }, {}],
    ],
    [
      AlbumsController,
      [{ create: echo('createAlbum'), update: echo('updateAlbum') }],
    ],
  ];
  const providers = new Map();
  for (const [controller, mocks] of cases) {
    const tokens = Reflect.getMetadata('design:paramtypes', controller);
    assert.equal(tokens.length, mocks.length, controller.name);
    tokens.forEach((token, index) =>
      providers.set(token, {
        ...(providers.get(token) ?? {}),
        ...mocks[index],
      }),
    );
  }
  const module = await Test.createTestingModule({
    controllers: cases.map(([controller]) => controller),
    providers: [...providers].map(([provide, useValue]) => ({
      provide,
      useValue,
    })),
  }).compile();
  const app = module.createNestApplication({ logger: false });
  t.after(() => app.close());
  // Authentication is independent of this validation test; no real external services run.
  app.use((req, _res, next) => {
    req.user = { id: 'user-1' };
    next();
  });
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor(app.get(Reflector)));
  await app.init();
  const http = request(app.getHttpServer());

  const list = await http
    .get('/assets?limit=12&favorite=false&type=document')
    .expect(200);
  assert.equal(list.body.success, true);
  assert.equal(list.body.data.args[0], 'user-1');
  assert.equal(list.body.data.args[1].limit, 12);
  assert.equal(list.body.data.args[1].favorite, false);
  assert.equal(list.body.data.args[1].sortBy, 'createdAt');
  const callCount = calls.length;
  for (const url of [
    '/assets?limit=',
    '/assets?limit=1&limit=2',
    '/assets?unexpected=x',
  ]) {
    const invalid = await http.get(url).expect(400);
    assert.equal(invalid.body.success, false);
    assert.equal(invalid.body.code, 'HTTP_400');
    assert.ok(Array.isArray(invalid.body.details));
  }
  assert.equal(calls.length, callCount);

  const rename = await http
    .patch('/assets/asset-1')
    .send({ name: ' report.pdf ' })
    .expect(200);
  assert.equal(rename.body.data.args[2], 'report.pdf');
  await http.patch('/assets/asset-1').send({ name: '../secret' }).expect(400);
  const upload = await http
    .post('/uploads/sessions')
    .send({ fileName: 'report.pdf', size: 123 })
    .expect(201);
  assert.equal(upload.body.data.args[1].size, 123);
  await http
    .post('/uploads/sessions')
    .send({ fileName: 'report.pdf', size: '123' })
    .expect(400);

  const share = await http.get(`/shares/${'a'.repeat(22)}?limit=5`).expect(200);
  assert.equal(share.body.data.args[1].limit, 5);
  await http.get('/shares/invalid').expect(400);
  const album = await http
    .patch('/albums/album-1')
    .send({ coverImage: null })
    .expect(200);
  assert.deepEqual(album.body.data.args[2], { coverImage: null });
  await http.patch('/albums/album-1').send({ name: null }).expect(400);
  await http
    .post('/albums')
    .send({ name: 'Album', shared: 'false' })
    .expect(400);

  const bytes = Buffer.from([0, 1, 255, 10]);
  const part = await http
    .put('/uploads/sessions/session-1/parts/2')
    .set('Content-Type', 'application/octet-stream')
    .send(bytes)
    .expect(200);
  assert.equal(part.body.data.index, 2);
  assert.equal(part.body.data.content, bytes.toString('hex'));
});

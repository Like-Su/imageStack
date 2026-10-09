# 请求校验与 Schema

服务端使用 NestJS 12 的路由 schema 元数据、内置 `StandardSchemaValidationPipe` 和 Zod 4。Zod 实现了 [Standard Schema](https://standardschema.dev/) 的 `~standard.validate` 接口，因此不需要自定义 Zod Pipe 或适配库。

原有 18 个 DTO 文件中的 43 个请求类型已迁移到各模块的 `schemas/*.schema.ts`。公共字段和游标分页位于 `src/common/schemas`。类型由 schema 推导，服务层通过 `import type` 引用。

## 添加或修改请求

```ts
// schemas/create-item.schema.ts
import { z } from 'zod';

export const createItemSchema = z.strictObject({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullish(),
});
export type CreateItemInput = z.infer<typeof createItemSchema>;

// items.controller.ts
import {
  createItemSchema,
  type CreateItemInput,
} from './schemas/create-item.schema';

@Post()
create(@Body({ schema: createItemSchema }) body: CreateItemInput) {
  return this.itemsService.create(body);
}
```

查询和路径对象分别使用 `@Query({ schema })`、`@Param({ schema })`。只有类型声明不会触发校验，路由必须绑定 schema。`src/main.ts` 已全局注册 `new StandardSchemaValidationPipe()`；它默认把解析、转换后的结果传给控制器。内部服务调用如需补默认值，应先调用相应 schema 的 `.parse()`。

## 约定

- 使用 `z.strictObject()` 拒绝未知字段；通过 `.extend()`、`.omit()`、`.partial()` 复用规则。
- `z.infer` 表示校验后的输出类型。不要重复手写接口；原始字符串查询与输出类型不相同。
- 查询整数使用 `queryIntegerSchema`，拒绝空字符串、数组、布尔值、非整数及越界值。查询布尔值仅转换字符串 `"true"` / `"false"`，避免 `Boolean("false")` 得到 `true`。
- JSON 请求体默认要求真实类型，例如上传 `size` 必须是数字，相册成员权限必须是布尔值。分享有效期保留原有数字字符串兼容规则。
- `.optional()` 表示允许省略；`.nullish()` 表示允许省略或传 `null`。更新头像、相册描述/封面、权限父级等字段支持 `null` 清空；用户名、标签名、权限列表等字段拒绝 `null`。
- 分页、排序、权限默认值写在 schema 中。共用字段定义集中维护，批量 ID 在去除首尾空白后检查重复。
- 格式、长度、范围在 schema 校验；所有权、共享权限、数据库唯一性、注册密码确认等业务约束仍由服务负责。

项目目前保留 `strictNullChecks: false`。需要组合格式检查的必填字符串使用 `.check()` 或直接的字符串约束；复杂 `.pipe()` 在此配置下可能推导为可选属性。新 schema 应同时验证运行时行为与 TypeScript 调用类型。

## 错误与响应

校验失败由 Nest 内置 Pipe 返回 HTTP 400，现有 `AllExceptionsFilter` 继续输出 `success: false`、`code: "HTTP_400"`、`message`、`details`、`timestamp`、`path`。`details` 为错误字符串数组，其中字段错误带字段路径；Zod 的具体错误文案与 class-validator 不完全相同。

本次迁移的 DTO 均为请求 DTO。JSON 响应继续经过现有 `ResponseInterceptor`；文件、下载流和 SSE 保留原有响应处理方式。未来若新增响应 schema，可在对应路由评估 `StandardSchemaSerializerInterceptor` 与 `@SerializeOptions({ schema })`，并明确校验的是业务数据还是完整响应包装。

## 验证

在 `apps/server` 执行：

```sh
pnpm exec tsc --noEmit --incremental false
pnpm run test:schemas
```

`test:schemas` 先构建，再使用 Node 内置测试运行器检查字段边界、53 个原 DTO 参数的路由元数据，以及真实 HTTP 请求中的转换、错误格式、响应包装和二进制上传。HTTP 测试使用真实控制器、内置 Pipe、异常过滤器和响应拦截器，服务替换为测试对象，不连接数据库、Redis、消息队列或邮件服务。测试运行环境需要匹配已安装依赖的平台，尤其是 `sharp`。

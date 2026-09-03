-- imageStack IAM bootstrap data
--
-- This file is intended to be executed by scripts/init.sh.
-- The shell script supplies these psql variables:
--   admin_username
--   admin_email
--   admin_password_hash
--   force_admin (0 or 1)
--
-- The administrator password is never stored in this repository. The shell
-- script supplies a bcrypt hash at execution time.

\set ON_ERROR_STOP on

\if :{?admin_username}
\else
  \echo 'Missing psql variable: admin_username'
  \quit 2
\endif

\if :{?admin_email}
\else
  \echo 'Missing psql variable: admin_email'
  \quit 2
\endif

\if :{?admin_password_hash}
\else
  \echo 'Missing psql variable: admin_password_hash'
  \quit 2
\endif

\if :{?force_admin}
\else
  \set force_admin 0
\endif

BEGIN;

-- Prisma creates these tables in the public schema. Do not let a caller's
-- session search_path redirect the bootstrap to another schema.
SET search_path TO public;

-- This seed targets the current Prisma model. Fail early if the migration
-- which removed the legacy account column has not been applied yet.
DO $schema_check$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'User'
       AND column_name = 'account'
  ) THEN
    RAISE EXCEPTION
      'Legacy User.account column is still present; apply Prisma migrations before running this seed';
  END IF;
END
$schema_check$;

-- Keep seed data in temporary tables so the complete bootstrap is atomic.
-- Values mirror apps/server/src/common/constants/role-permission.ts.
CREATE TEMP TABLE _init_roles (
  role_code   TEXT PRIMARY KEY,
  role_name   TEXT NOT NULL,
  description TEXT,
  status      INTEGER NOT NULL
) ON COMMIT DROP;

INSERT INTO _init_roles (role_code, role_name, description, status)
VALUES
  ('ROLE_ADMIN', '管理员', '系统管理员', 1),
  ('ROLE_USER', '普通用户', '普通用户', 1);

-- Upsert roles by business key. Stable IDs make seed references deterministic.
DO $seed_roles$
DECLARE
  seed_role RECORD;
  role_id TEXT;
BEGIN
  FOR seed_role IN SELECT * FROM _init_roles ORDER BY role_code LOOP
    SELECT r."id"
      INTO role_id
      FROM "Role" AS r
     WHERE r."roleCode" = seed_role.role_code
     ORDER BY r."id"
     LIMIT 1;

    IF role_id IS NULL THEN
      role_id := md5('image-stack:role:' || seed_role.role_code);

      INSERT INTO "Role" (
        "id",
        "roleName",
        "roleCode",
        "description",
        "status",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        role_id,
        seed_role.role_name,
        seed_role.role_code,
        seed_role.description,
        seed_role.status,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    ELSE
      UPDATE "Role"
         SET "roleName" = seed_role.role_name,
             "description" = seed_role.description,
             "status" = seed_role.status,
             "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = role_id;
    END IF;
  END LOOP;
END
$seed_roles$;

CREATE TEMP TABLE _init_permissions (
  permission_code TEXT PRIMARY KEY,
  permission_name TEXT NOT NULL,
  parent_code    TEXT
) ON COMMIT DROP;

INSERT INTO _init_permissions (
  permission_code,
  permission_name,
  parent_code
)
VALUES
  -- Asset permissions
  ('asset:create',    '创建资源', NULL),
  ('asset:delete',    '删除资源', NULL),
  ('asset:edit',      '编辑资源', NULL),
  ('asset:list',      '查看资源列表', NULL),
  ('asset:tag',       '管理资源标签', NULL),
  ('asset:category',  '管理资源分类', NULL),
  ('asset:search',    '搜索资源', NULL),

  -- User permissions
  ('system:user',         '用户管理', NULL),
  ('system:user:create',  '创建用户', 'system:user'),
  ('system:user:delete',  '删除用户', 'system:user'),
  ('system:user:edit',    '编辑用户', 'system:user'),

  -- Role permissions
  ('system:role',         '角色管理', NULL),
  ('system:role:create',  '创建角色', 'system:role'),
  ('system:role:delete',  '删除角色', 'system:role'),
  ('system:role:edit',    '编辑角色', 'system:role'),

  -- Permission permissions
  ('system:permission',        '权限管理', NULL),
  ('system:permission:create', '创建权限', 'system:permission'),
  ('system:permission:delete', '删除权限', 'system:permission'),
  ('system:permission:edit',   '编辑权限', 'system:permission');

-- Insert or update permissions by permissionCode. Parent rows are processed
-- first so parentId can be resolved without inventing an extra "asset" node.
DO $seed_permissions$
DECLARE
  seed_permission RECORD;
  permission_id TEXT;
  parent_id TEXT;
  duplicate_count INTEGER;
BEGIN
  FOR seed_permission IN
    SELECT *
      FROM _init_permissions
     ORDER BY parent_code NULLS FIRST, permission_code
  LOOP
    SELECT COUNT(*)
      INTO duplicate_count
      FROM "Permission" AS p
     WHERE p."permissionCode" = seed_permission.permission_code;

    IF duplicate_count > 1 THEN
      RAISE EXCEPTION
        'Duplicate permissionCode already exists: %',
        seed_permission.permission_code;
    END IF;

    permission_id := NULL;
    parent_id := NULL;

    SELECT p."id"
      INTO permission_id
      FROM "Permission" AS p
     WHERE p."permissionCode" = seed_permission.permission_code
     ORDER BY p."id"
     LIMIT 1;

    IF seed_permission.parent_code IS NOT NULL THEN
      SELECT p."id"
        INTO parent_id
        FROM "Permission" AS p
       WHERE p."permissionCode" = seed_permission.parent_code
       ORDER BY p."id"
       LIMIT 1;

      IF parent_id IS NULL THEN
        RAISE EXCEPTION
          'Parent permission does not exist: %',
          seed_permission.parent_code;
      END IF;
    END IF;

    IF permission_id IS NULL THEN
      permission_id := md5(
        'image-stack:permission:' || seed_permission.permission_code
      );

      INSERT INTO "Permission" (
        "id",
        "parentId",
        "permissionName",
        "permissionCode",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        permission_id,
        parent_id,
        seed_permission.permission_name,
        seed_permission.permission_code,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      );
    ELSE
      UPDATE "Permission"
         SET "parentId" = parent_id,
             "permissionName" = seed_permission.permission_name,
             "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = permission_id;
    END IF;
  END LOOP;
END
$seed_permissions$;

CREATE TEMP TABLE _init_role_permissions (
  role_code       TEXT NOT NULL,
  permission_code TEXT NOT NULL,
  PRIMARY KEY (role_code, permission_code)
) ON COMMIT DROP;

-- The administrator receives every permission defined in role-permission.ts.
INSERT INTO _init_role_permissions (role_code, permission_code)
SELECT 'ROLE_ADMIN', permission_code
  FROM _init_permissions;

-- Ordinary users start with least-privilege list/search access.
INSERT INTO _init_role_permissions (role_code, permission_code)
VALUES
  ('ROLE_USER', 'asset:list'),
  ('ROLE_USER', 'asset:search');

-- Map roles to permissions. DISTINCT ON keeps this deterministic if a legacy
-- database contains duplicate business keys.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role_rows."id", permission_rows."id"
  FROM _init_role_permissions AS seed_link
  JOIN (
    SELECT DISTINCT ON (r."roleCode") r."roleCode", r."id"
      FROM "Role" AS r
     ORDER BY r."roleCode", r."id"
  ) AS role_rows
    ON role_rows."roleCode" = seed_link.role_code
  JOIN (
    SELECT DISTINCT ON (p."permissionCode") p."permissionCode", p."id"
      FROM "Permission" AS p
     ORDER BY p."permissionCode", p."id"
  ) AS permission_rows
    ON permission_rows."permissionCode" = seed_link.permission_code
ON CONFLICT ("roleId", "permissionId") DO NOTHING;

CREATE TEMP TABLE _init_config (
  admin_username      TEXT NOT NULL,
  admin_email         TEXT NOT NULL,
  admin_password_hash TEXT NOT NULL,
  force_admin         BOOLEAN NOT NULL
) ON COMMIT DROP;

INSERT INTO _init_config (
  admin_username,
  admin_email,
  admin_password_hash,
  force_admin
)
VALUES (
  :'admin_username',
  lower(:'admin_email'),
  :'admin_password_hash',
  :'force_admin' = '1'
);

-- Create the first administrator. An existing account is never silently
-- promoted or reset unless --force-admin is supplied to the shell script.
DO $seed_admin$
DECLARE
  config_row RECORD;
  admin_role_id TEXT;
  existing_user RECORD;
  target_user_id TEXT;
BEGIN
  SELECT *
    INTO config_row
    FROM _init_config
   LIMIT 1;

  SELECT r."id"
    INTO admin_role_id
    FROM "Role" AS r
   WHERE r."roleCode" = 'ROLE_ADMIN'
   ORDER BY r."id"
   LIMIT 1;

  IF admin_role_id IS NULL THEN
    RAISE EXCEPTION 'ROLE_ADMIN was not initialized';
  END IF;

  SELECT
    u."id",
    u."roleId",
    u."status",
    u."deleted",
    r."roleCode"
    INTO existing_user
    FROM "User" AS u
    LEFT JOIN "Role" AS r ON r."id" = u."roleId"
   WHERE lower(u."email") = config_row.admin_email
   ORDER BY u."id"
   LIMIT 1;

  IF existing_user."id" IS NULL THEN
    target_user_id := md5('image-stack:admin:' || config_row.admin_email);

    INSERT INTO "User" (
      "id",
      "username",
      "password",
      "email",
      "status",
      "createdAt",
      "updatedAt",
      "deleted",
      "roleId"
    )
    VALUES (
      target_user_id,
      config_row.admin_username,
      config_row.admin_password_hash,
      config_row.admin_email,
      'ACTIVE'::"UserStatus",
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP,
      FALSE,
      admin_role_id
    );
  ELSE
    target_user_id := existing_user."id";

    IF existing_user."roleCode" IS DISTINCT FROM 'ROLE_ADMIN'
       AND NOT config_row.force_admin THEN
      RAISE EXCEPTION
        'User % already exists without ROLE_ADMIN; rerun with --force-admin only if promotion is intentional',
        config_row.admin_email;
    END IF;

    IF config_row.force_admin THEN
      UPDATE "User"
         SET "username" = config_row.admin_username,
             "password" = config_row.admin_password_hash,
             "status" = 'ACTIVE'::"UserStatus",
             "deleted" = FALSE,
             "roleId" = admin_role_id,
             "updatedAt" = CURRENT_TIMESTAMP
       WHERE "id" = existing_user."id";
    ELSIF existing_user."status" IS DISTINCT FROM 'ACTIVE'::"UserStatus"
       OR existing_user."deleted" IS TRUE THEN
      RAISE EXCEPTION
        'Administrator % exists but is inactive/deleted; rerun with --force-admin only if reset is intentional',
        config_row.admin_email;
    END IF;
  END IF;

  -- Older migrations in this repository created emailVerified while the
  -- current Prisma model no longer exposes it. Mark the bootstrap account as
  -- verified when that legacy column is still present, without requiring the
  -- column in newer schemas.
  IF EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'User'
       AND column_name = 'emailVerified'
  )
  AND EXISTS (
    SELECT 1
      FROM pg_type
     WHERE typname = 'EmailVerified'
  ) THEN
    EXECUTE
      'UPDATE "User" '
      || 'SET "emailVerified" = ''SUC_VALIDATE''::"EmailVerified" '
      || 'WHERE "id" = $1'
      USING target_user_id;
  END IF;
END
$seed_admin$;

COMMIT;

\echo 'IAM seed completed: roles, permissions, mappings, and administrator account are ready.'

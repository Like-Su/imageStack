<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue";
import type { FormInstance, FormRules } from "element-plus";
import { iamApi } from "@/api/iam";
import { getErrorMessage } from "@/api/request";
import { i18n, translate } from "@/i18n";
import { useAuthStore } from "@/stores/auth";
import type {
  AdminSection,
  AdminRecord,
  AdminRole,
  AdminUser,
  AdminPermission,
  AccountStatus,
  CreateAdminUser,
  SaveRole,
  SavePermission,
} from "@/types/iam";
import AppModal from "@/components/workspace/AppModal.vue";
import PermissionSelect from "./PermissionSelect.vue";

const props = defineProps<{
  section: AdminSection;
  record?: AdminRecord;
  roles: AdminRole[];
  permissions: AdminPermission[];
}>();
const emit = defineEmits<{ close: []; saved: [relogin: boolean] }>();
const auth = useAuthStore();
const form = ref<FormInstance>();
const busy = ref(false);
const error = ref("");
const user =
  props.section === "users"
    ? (props.record as AdminUser | undefined)
    : undefined;
const role =
  props.section === "roles"
    ? (props.record as AdminRole | undefined)
    : undefined;
const permission =
  props.section === "permissions"
    ? (props.record as AdminPermission | undefined)
    : undefined;
const ownAccount = user?.id === auth.user?.id;
const model = reactive({
  username: user?.username ?? "",
  email: user?.email ?? "",
  password: "",
  roleId:
    user?.roleId ??
    props.roles.find(
      (entry) => entry.roleCode === "ROLE_USER" && entry.status === 1,
    )?.id ??
    "",
  status: user?.status ?? ("ACTIVE" as AccountStatus),
  roleName: role?.roleName ?? "",
  roleCode: role?.roleCode ?? "",
  description: role?.description ?? "",
  enabled: role?.status !== 0,
  permissionCodes: (user?.directPermissions ?? role?.permissions ?? []).map(
    (entry) => entry.permissionCode,
  ),
  permissionName: permission?.permissionName ?? "",
  permissionCode: permission?.permissionCode ?? "",
  parentId: permission?.parentId ?? "",
});
const title = computed(() =>
  translate(
    {
      users: user ? "编辑用户" : "创建用户",
      roles: role ? "编辑角色" : "创建角色",
      permissions: permission ? "编辑权限" : "创建权限",
    }[props.section],
  ),
);
const selectedRole = computed(() =>
  props.roles.find((entry) => entry.id === model.roleId),
);
const inherited = computed(
  () =>
    selectedRole.value?.permissions.map((entry) => entry.permissionCode) ?? [],
);
const accessEnabled = computed(
  () => model.status === "ACTIVE" && selectedRole.value?.status === 1,
);
const effectivePermissions = computed(() =>
  accessEnabled.value
    ? [...new Set([...inherited.value, ...model.permissionCodes])].sort()
    : [],
);
const parentOptions = computed(() => {
  const descendants = new Set(permission ? [permission.id] : []);
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of props.permissions) {
      if (
        entry.parentId &&
        descendants.has(entry.parentId) &&
        !descendants.has(entry.id)
      ) {
        descendants.add(entry.id);
        changed = true;
      }
    }
  }
  return props.permissions.filter((entry) => !descendants.has(entry.id));
});
const rules = computed<FormRules>(() => ({
  username: [
    {
      required: true,
      whitespace: true,
      message: translate("请输入用户名称"),
      trigger: "blur",
    },
  ],
  email: [
    {
      required: true,
      type: "email",
      message: translate("请输入有效的邮箱地址"),
      trigger: "blur",
    },
  ],
  password: [
    {
      validator: (_rule, value: string, callback) => {
        if (user && !value) return callback();
        if (value.length < 8 || new TextEncoder().encode(value).length > 72)
          return callback(
            new Error(translate("密码至少 8 位且不能超过 72 字节")),
          );
        callback();
      },
      trigger: "blur",
    },
  ],
  roleId: [
    { required: true, message: translate("请选择角色"), trigger: "change" },
  ],
  roleName: [
    {
      required: true,
      whitespace: true,
      message: translate("请输入角色名称"),
      trigger: "blur",
    },
  ],
  roleCode: [
    {
      required: true,
      pattern: /^ROLE_[A-Z][A-Z0-9_]*$/,
      message: translate("角色编码须以 ROLE_ 开头，仅含大写字母、数字和下划线"),
      trigger: "blur",
    },
  ],
  permissionName: [
    {
      required: true,
      whitespace: true,
      message: translate("请输入权限名称"),
      trigger: "blur",
    },
  ],
  permissionCode: [
    {
      required: true,
      pattern: /^[a-z][a-z0-9_-]*(?::[a-z][a-z0-9_-]*)+$/,
      message: translate("权限编码使用小写分段格式，例如 asset:list"),
      trigger: "blur",
    },
  ],
}));
watch(i18n.global.locale, () => form.value?.clearValidate());

async function submit() {
  if (busy.value) return;
  busy.value = true;
  error.value = "";
  const session = auth.getSessionVersion();
  let relogin = false;
  try {
    if (!(await form.value?.validate().catch(() => false))) return;
    if (
      session !== auth.getSessionVersion() ||
      auth.user?.roleCode !== "ROLE_ADMIN"
    )
      return;
    if (props.section === "users") {
      const body: CreateAdminUser = {
        username: model.username.trim(),
        email: model.email.trim().toLowerCase(),
        password: model.password,
        roleId: model.roleId,
        status: model.status,
        permissionCodes: model.permissionCodes,
      };
      if (user) {
        const { password, ...fields } = body;
        await iamApi.updateUser(user.id, {
          ...fields,
          ...(password ? { password } : {}),
        });
        relogin = ownAccount;
      } else await iamApi.createUser(body);
    } else if (props.section === "roles") {
      const body: SaveRole = {
        roleName: model.roleName.trim(),
        roleCode: model.roleCode.trim(),
        description: model.description.trim(),
        status: model.enabled ? 1 : 0,
        permissionCodes: model.permissionCodes,
      };
      if (role) {
        await iamApi.updateRole(role.id, body);
        relogin = role.roleCode === auth.user?.roleCode;
      } else await iamApi.createRole(body);
    } else {
      const body: SavePermission = {
        permissionName: model.permissionName.trim(),
        permissionCode: model.permissionCode.trim(),
        parentId: model.parentId || null,
      };
      if (permission) {
        await iamApi.updatePermission(permission.id, body);
        relogin =
          permission.permissionCode !== body.permissionCode &&
          Boolean(auth.user?.permissions.includes(permission.permissionCode));
      } else await iamApi.createPermission(body);
    }
    if (session === auth.getSessionVersion()) emit("saved", relogin);
  } catch (cause) {
    if (session === auth.getSessionVersion())
      error.value = translate(getErrorMessage(cause));
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AppModal open :title="title" :busy="busy" @update:open="emit('close')">
    <el-form
      ref="form"
      :model="model"
      :rules="rules"
      :disabled="busy"
      label-position="top"
      class="p-5"
      @submit.prevent="submit"
    >
      <el-alert
        v-if="record && section !== 'permissions'"
        :title="
          $t(
            '保存用户或角色更改后，相关账户需要重新登录；若修改当前账户，将退出本次登录。',
          )
        "
        type="warning"
        :closable="false"
        show-icon
        class="mb-4"
      />
      <template v-if="section === 'users'">
        <el-form-item :label="$t('用户名称')" prop="username"
          ><el-input
            id="admin-username"
            v-model="model.username"
            maxlength="80"
            autocomplete="off"
        /></el-form-item>
        <el-form-item :label="$t('邮箱')" prop="email"
          ><el-input
            id="admin-email"
            v-model="model.email"
            type="email"
            maxlength="254"
            autocomplete="off"
        /></el-form-item>
        <el-form-item
          :label="user ? $t('新密码（留空保持不变）') : $t('初始密码')"
          prop="password"
          ><el-input
            id="admin-password"
            v-model="model.password"
            type="password"
            show-password
            autocomplete="new-password"
        /></el-form-item>
        <el-form-item :label="$t('角色')" prop="roleId">
          <el-select
            id="admin-user-role"
            v-model="model.roleId"
            filterable
            :disabled="ownAccount"
          >
            <el-option
              v-for="entry in roles"
              :key="entry.id"
              :value="entry.id"
              :label="`${entry.roleName} · ${entry.roleCode}`"
              :disabled="entry.status !== 1 && entry.id !== user?.roleId"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('账户状态')"
          ><el-radio-group v-model="model.status" :disabled="ownAccount"
            ><el-radio-button value="ACTIVE">{{ $t("启用") }}</el-radio-button
            ><el-radio-button value="DEACTIVE">{{
              $t("停用")
            }}</el-radio-button></el-radio-group
          ></el-form-item
        >
        <el-form-item :label="$t('用户额外权限')"
          ><PermissionSelect
            id="admin-user-permissions"
            v-model="model.permissionCodes"
            :permissions="permissions"
            :inherited="inherited"
            :disabled="busy"
        /></el-form-item>
        <p class="mb-4 text-xs leading-5 text-soft">
          {{
            $t(
              "生效权限为角色权限与额外权限的并集；清空额外权限不会移除角色已有权限。",
            )
          }}
        </p>
        <el-collapse>
          <el-collapse-item
            v-if="inherited.length"
            :title="$t('查看角色继承权限')"
            name="inherited"
          >
            <div class="flex flex-wrap gap-1">
              <el-tag v-for="code in inherited" :key="code" size="small">{{
                code
              }}</el-tag>
            </div>
          </el-collapse-item>
          <el-collapse-item :title="$t('生效权限预览')" name="effective">
            <p v-if="!selectedRole" class="text-xs text-soft">
              {{ $t("请选择角色后查看生效权限。") }}
            </p>
            <p v-else-if="!accessEnabled" class="text-xs text-soft">
              {{ $t("账户或角色停用时，所有授权均不生效。") }}
            </p>
            <p
              v-else-if="selectedRole.roleCode === 'ROLE_ADMIN'"
              class="text-xs text-soft"
            >
              {{ $t("管理员角色始终拥有全部操作权限，不受勾选权限限制。") }}
            </p>
            <div
              v-else-if="effectivePermissions.length"
              class="flex flex-wrap gap-1"
            >
              <el-tag
                v-for="code in effectivePermissions"
                :key="code"
                size="small"
                type="success"
                >{{ code }}</el-tag
              >
            </div>
            <p v-else class="text-xs text-soft">{{ $t("未分配任何权限") }}</p>
          </el-collapse-item>
        </el-collapse>
      </template>
      <template v-else-if="section === 'roles'">
        <el-form-item :label="$t('角色名称')" prop="roleName"
          ><el-input
            id="admin-role-name"
            v-model="model.roleName"
            maxlength="80"
        /></el-form-item>
        <el-form-item :label="$t('角色编码')" prop="roleCode"
          ><el-input
            id="admin-role-code"
            v-model="model.roleCode"
            :disabled="role?.builtin"
            maxlength="100"
            placeholder="ROLE_EDITOR"
        /></el-form-item>
        <el-form-item :label="$t('角色说明')"
          ><el-input
            v-model="model.description"
            type="textarea"
            :rows="3"
            maxlength="500"
            show-word-limit
        /></el-form-item>
        <el-form-item :label="$t('启用角色')"
          ><el-switch
            v-model="model.enabled"
            :disabled="role?.roleCode === 'ROLE_ADMIN'"
            :aria-label="$t('启用角色')"
        /></el-form-item>
        <el-form-item :label="$t('角色权限')"
          ><PermissionSelect
            id="admin-role-permissions"
            v-model="model.permissionCodes"
            :permissions="permissions"
            :disabled="busy"
        /></el-form-item>
        <p
          v-if="role?.roleCode === 'ROLE_ADMIN'"
          class="mb-4 text-xs leading-5 text-soft"
        >
          {{ $t("管理员角色始终拥有全部操作权限，不受勾选权限限制。") }}
        </p>
      </template>
      <template v-else>
        <el-alert
          v-if="permission && !permission.builtin"
          :title="$t('修改权限编码后，关联账户需要重新登录。')"
          type="warning"
          :closable="false"
          show-icon
          class="mb-4"
        />
        <el-form-item :label="$t('权限名称')" prop="permissionName"
          ><el-input
            id="admin-permission-name"
            v-model="model.permissionName"
            maxlength="80"
        /></el-form-item>
        <el-form-item :label="$t('权限编码')" prop="permissionCode"
          ><el-input
            id="admin-permission-code"
            v-model="model.permissionCode"
            :disabled="permission?.builtin"
            maxlength="100"
            placeholder="asset:list"
        /></el-form-item>
        <el-form-item :label="$t('父级权限')">
          <el-select
            id="admin-parent-permission"
            v-model="model.parentId"
            filterable
            clearable
            :placeholder="$t('无父级权限')"
            ><el-option
              v-for="entry in parentOptions"
              :key="entry.id"
              :value="entry.id"
              :label="`${entry.permissionName} · ${entry.permissionCode}`"
          /></el-select>
        </el-form-item>
        <p class="mb-4 text-xs leading-5 text-soft">
          {{
            $t(
              "层级仅用于整理，不会自动授予子权限。新增编码需要业务接口接入后才能控制对应操作。",
            )
          }}
        </p>
      </template>
      <el-alert
        v-if="error"
        :title="error"
        type="error"
        :closable="false"
        show-icon
        class="my-4"
      />
      <div class="mt-5 flex justify-end gap-2">
        <el-button @click="emit('close')">{{ $t("取消") }}</el-button
        ><el-button type="primary" native-type="submit" :loading="busy">{{
          $t("保存")
        }}</el-button>
      </div>
    </el-form>
  </AppModal>
</template>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { Plus, RefreshCw, Search, ShieldCheck } from "lucide-vue-next";
import { iamApi } from "@/api/iam";
import { getErrorMessage } from "@/api/request";
import { translate } from "@/i18n";
import { useAuthStore } from "@/stores/auth";
import { useWorkspaceStore } from "@/stores/workspace";
import { useRemoteData } from "@/composables/useRemoteData";
import { formatDate } from "@/composables/mediaFormat";
import type {
  AccountStatus,
  AdminSection,
  AdminRecord,
  AdminUser,
  AdminRole,
  AdminPermission,
} from "@/types/iam";
import PageHeader from "@/components/workspace/PageHeader.vue";
import DataState from "@/components/workspace/DataState.vue";
import AdminEditor from "@/components/admin/AdminEditor.vue";

const props = defineProps<{ section: AdminSection }>();
const auth = useAuthStore();
const workspace = useWorkspaceStore();
const router = useRouter();
const route = useRoute();
const tabs = [
  { value: "users", label: "用户管理" },
  { value: "roles", label: "角色管理" },
  { value: "permissions", label: "权限管理" },
] as const;
const search = ref("");
const appliedSearch = ref("");
const status = ref<AccountStatus | "">("");
const roleId = ref("");
const page = ref(1);
const pageSize = 20;
const editor = ref<{ record?: AdminRecord } | null>(null);
const deleting = ref("");
const administrator = computed(() => auth.user?.roleCode === "ROLE_ADMIN");
const title = computed(() =>
  translate(tabs.find((tab) => tab.value === props.section)!.label),
);
const createLabel = computed(() =>
  translate(
    { users: "创建用户", roles: "创建角色", permissions: "创建权限" }[
      props.section
    ],
  ),
);
const { data, loading, error, refresh } = useRemoteData(
  async (signal) => {
    if (!administrator.value) return null;
    const [users, roles, permissions] = await Promise.all([
      props.section === "users"
        ? iamApi.users(
            {
              page: page.value,
              limit: pageSize,
              search: appliedSearch.value,
              status: status.value || undefined,
              roleId: roleId.value || undefined,
            },
            signal,
          )
        : Promise.resolve(null),
      iamApi.roles(signal),
      iamApi.permissions(signal),
    ]);
    return { users, roles, permissions };
  },
  [page, appliedSearch, status, roleId, administrator, () => props.section],
);
const records = computed<AdminRecord[]>(() => {
  if (props.section === "users") return data.value?.users?.items ?? [];
  const entries =
    props.section === "roles"
      ? (data.value?.roles ?? [])
      : (data.value?.permissions ?? []);
  const query = search.value.trim().toLocaleLowerCase();
  return entries.filter((entry) =>
    ("roleName" in entry
      ? `${entry.roleName} ${entry.roleCode} ${entry.description ?? ""}`
      : `${entry.permissionName} ${entry.permissionCode}`
    )
      .toLocaleLowerCase()
      .includes(query),
  );
});
const total = computed(() =>
  props.section === "users"
    ? (data.value?.users?.total ?? 0)
    : records.value.length,
);
const permissionNames = computed(
  () =>
    new Map(
      data.value?.permissions.map((permission) => [
        permission.id,
        permission.permissionName,
      ]),
    ),
);
watch([status, roleId], () => {
  page.value = 1;
});
let activated = false;
onActivated(() => {
  if (activated) void refresh();
  activated = true;
});
onDeactivated(() => {
  editor.value = null;
});

function applySearch() {
  page.value = 1;
  appliedSearch.value = search.value.trim();
}

function changeTab(value: string | number) {
  if (tabs.some((tab) => tab.value === value))
    void router.push({ name: `admin-${value}` });
}

async function saved(relogin: boolean) {
  editor.value = null;
  if (relogin) {
    auth.clearSession();
    await router.replace({ name: "login", query: { status: "expired" } });
    return;
  }
  workspace.notify(translate("管理更改已保存"));
  await refresh();
}

function cannotDelete(record: AdminRecord) {
  if ("username" in record) return record.id === auth.user?.id;
  if ("roleName" in record) return record.builtin || record.userCount > 0;
  return record.builtin || record.childCount > 0;
}

async function remove(record: AdminRecord) {
  if (deleting.value || cannotDelete(record)) return;
  const name =
    "username" in record
      ? record.username
      : "roleName" in record
        ? record.roleName
        : record.permissionName;
  const messages = {
    users:
      "删除用户「{name}」？账户会被停用并撤销登录，媒体文件不会删除，邮箱仍保留。",
    roles: "删除角色「{name}」？此操作不可撤销。",
    permissions:
      "删除权限「{name}」？对应用户和角色的授权会一并移除，相关账户需要重新登录。",
  };
  const path = route.fullPath;
  const session = auth.getSessionVersion();
  deleting.value = record.id;
  try {
    if (
      !(await workspace.confirm({
        title: translate("确认删除？"),
        message: translate(messages[props.section], { name }),
        confirmLabel: translate("删除"),
        danger: true,
      }))
    )
      return;
    if (
      path !== route.fullPath ||
      session !== auth.getSessionVersion() ||
      !administrator.value
    )
      return;
    let relogin = false;
    if (props.section === "users")
      await iamApi.deleteUser((record as AdminUser).id);
    else if (props.section === "roles")
      await iamApi.deleteRole((record as AdminRole).id);
    else {
      const permission = record as AdminPermission;
      await iamApi.deletePermission(permission.id);
      relogin = Boolean(
        auth.user?.permissions.includes(permission.permissionCode),
      );
    }
    if (session !== auth.getSessionVersion()) return;
    if (
      props.section === "users" &&
      records.value.length === 1 &&
      page.value > 1
    )
      page.value -= 1;
    await saved(relogin);
  } catch (cause) {
    if (session === auth.getSessionVersion())
      workspace.notify(translate(getErrorMessage(cause)), "error");
  } finally {
    deleting.value = "";
  }
}
</script>

<template>
  <section>
    <PageHeader :title="title" :description="$t('管理账户、角色与访问权限')">
      <el-button :disabled="loading || Boolean(deleting)" @click="refresh"
        ><RefreshCw />{{ $t("刷新") }}</el-button
      >
      <el-button
        type="primary"
        :disabled="
          !administrator ||
          loading ||
          Boolean(error) ||
          Boolean(deleting) ||
          !data
        "
        @click="editor = {}"
        ><Plus />{{ createLabel }}</el-button
      >
    </PageHeader>
    <div class="space-y-4 px-4 sm:px-6">
      <el-tabs :model-value="section" @update:model-value="changeTab"
        ><el-tab-pane
          v-for="tab in tabs"
          :key="tab.value"
          :name="tab.value"
          :label="$t(tab.label)"
      /></el-tabs>
      <el-alert
        :title="
          $t(
            '仅管理员可管理访问权限。内置角色和权限不能删除，内置编码不可修改。',
          )
        "
        type="info"
        :closable="false"
        show-icon
      />
      <form
        class="flex flex-wrap items-center gap-3"
        @submit.prevent="applySearch"
      >
        <el-input
          v-model="search"
          class="!w-full sm:!w-72"
          clearable
          :placeholder="
            section === 'users'
              ? $t('搜索用户名称或邮箱')
              : $t('搜索名称或编码')
          "
          :aria-label="$t('搜索管理记录')"
          maxlength="100"
          @clear="applySearch"
          ><template #prefix><Search class="size-4" /></template
        ></el-input>
        <template v-if="section === 'users'">
          <el-select
            v-model="status"
            class="!w-36"
            clearable
            :placeholder="$t('全部状态')"
            :aria-label="$t('按账户状态筛选')"
            ><el-option value="ACTIVE" :label="$t('启用')" /><el-option
              value="DEACTIVE"
              :label="$t('停用')"
          /></el-select>
          <el-select
            v-model="roleId"
            class="!w-48"
            clearable
            filterable
            :placeholder="$t('全部角色')"
            :aria-label="$t('按角色筛选')"
            ><el-option
              v-for="entry in data?.roles ?? []"
              :key="entry.id"
              :value="entry.id"
              :label="entry.roleName"
          /></el-select>
          <el-button native-type="submit">{{ $t("搜索") }}</el-button>
        </template>
        <span class="text-xs text-faint">{{
          $t("共 {count} 条记录", { count: total })
        }}</span>
      </form>
      <DataState
        v-if="!administrator || loading || error"
        :loading="loading"
        :error="error ? $t(error) : undefined"
        :icon="ShieldCheck"
        :title="$t('仅管理员可访问')"
        @retry="refresh"
      />
      <div v-else class="mh-card overflow-hidden p-3">
        <el-table
          :data="records"
          row-key="id"
          :empty-text="$t('暂无匹配记录')"
          stripe
          table-layout="auto"
        >
          <template v-if="section === 'users'">
            <el-table-column
              prop="username"
              :label="$t('用户名称')"
              min-width="140"
              show-overflow-tooltip
            />
            <el-table-column
              prop="email"
              :label="$t('邮箱')"
              min-width="210"
              show-overflow-tooltip
            />
            <el-table-column :label="$t('角色')" min-width="145"
              ><template #default="{ row }"
                ><span>{{ row.role.roleName }}</span
                ><el-tag
                  v-if="row.role.status !== 1"
                  type="warning"
                  size="small"
                  class="ml-2"
                  >{{ $t("角色已停用") }}</el-tag
                ></template
              ></el-table-column
            >
            <el-table-column :label="$t('账户状态')" min-width="100"
              ><template #default="{ row }"
                ><el-tag
                  :type="row.status === 'ACTIVE' ? 'success' : 'info'"
                  size="small"
                  >{{
                    row.status === "ACTIVE" ? $t("启用") : $t("停用")
                  }}</el-tag
                ></template
              ></el-table-column
            >
            <el-table-column :label="$t('额外权限')" min-width="100"
              ><template #default="{ row }">{{
                row.directPermissions.length
              }}</template></el-table-column
            >
            <el-table-column :label="$t('生效权限')" min-width="100">
              <template #default="{ row }">
                <el-tag
                  v-if="row.status !== 'ACTIVE' || row.role.status !== 1"
                  type="info"
                  size="small"
                  >{{ $t("未生效") }}</el-tag
                >
                <span v-else>{{
                  row.hasAllPermissions
                    ? $t("全部")
                    : row.effectivePermissionCodes.length
                }}</span>
              </template>
            </el-table-column>
            <el-table-column :label="$t('最后登录')" min-width="150"
              ><template #default="{ row }">{{
                formatDate(row.lastLoginAt, true)
              }}</template></el-table-column
            >
          </template>
          <template v-else-if="section === 'roles'">
            <el-table-column :label="$t('角色名称')" min-width="160"
              ><template #default="{ row }"
                >{{ row.roleName
                }}<el-tag v-if="row.builtin" size="small" class="ml-2">{{
                  $t("内置")
                }}</el-tag></template
              ></el-table-column
            >
            <el-table-column
              prop="roleCode"
              :label="$t('角色编码')"
              min-width="160"
              show-overflow-tooltip
            />
            <el-table-column
              prop="description"
              :label="$t('角色说明')"
              min-width="180"
              show-overflow-tooltip
            />
            <el-table-column :label="$t('状态')" min-width="85"
              ><template #default="{ row }"
                ><el-tag
                  :type="row.status === 1 ? 'success' : 'info'"
                  size="small"
                  >{{ row.status === 1 ? $t("启用") : $t("停用") }}</el-tag
                ></template
              ></el-table-column
            >
            <el-table-column
              prop="userCount"
              :label="$t('关联用户')"
              min-width="90"
            />
            <el-table-column :label="$t('权限数量')" min-width="90"
              ><template #default="{ row }">{{
                row.roleCode === "ROLE_ADMIN"
                  ? $t("全部")
                  : row.permissions.length
              }}</template></el-table-column
            >
          </template>
          <template v-else>
            <el-table-column :label="$t('权限名称')" min-width="160"
              ><template #default="{ row }"
                >{{ row.permissionName
                }}<el-tag v-if="row.builtin" size="small" class="ml-2">{{
                  $t("内置")
                }}</el-tag></template
              ></el-table-column
            >
            <el-table-column
              prop="permissionCode"
              :label="$t('权限编码')"
              min-width="200"
              show-overflow-tooltip
            />
            <el-table-column :label="$t('父级权限')" min-width="160"
              ><template #default="{ row }">{{
                permissionNames.get(row.parentId) ?? "—"
              }}</template></el-table-column
            >
            <el-table-column
              prop="roleCount"
              :label="$t('关联角色')"
              min-width="90"
            />
            <el-table-column
              prop="userCount"
              :label="$t('直接授权用户')"
              min-width="110"
            />
          </template>
          <el-table-column :label="$t('操作')" min-width="190" fixed="right"
            ><template #default="{ row }"
              ><div class="flex gap-1">
                <el-button
                  size="small"
                  :disabled="Boolean(deleting)"
                  @click="editor = { record: row as AdminRecord }"
                  >{{
                    section === "permissions" ? $t("编辑") : $t("编辑与授权")
                  }}</el-button
                ><el-button
                  size="small"
                  type="danger"
                  plain
                  :disabled="
                    cannotDelete(row as AdminRecord) || Boolean(deleting)
                  "
                  :loading="deleting === row.id"
                  @click="remove(row as AdminRecord)"
                  >{{ $t("删除") }}</el-button
                >
              </div></template
            ></el-table-column
          >
        </el-table>
        <div
          v-if="section === 'users'"
          class="mt-4 flex flex-wrap items-center justify-between gap-3"
        >
          <p class="text-xs text-soft">
            {{ $t("删除用户仅停用账户并保留媒体，不会释放已占用的邮箱。") }}
          </p>
          <el-pagination
            v-model:current-page="page"
            :total="total"
            :page-size="pageSize"
            layout="prev, pager, next"
            :pager-count="5"
            :disabled="loading || Boolean(deleting)"
          />
        </div>
        <p v-else-if="section === 'roles'" class="mt-4 text-xs text-soft">
          {{ $t("有关联用户的角色不能删除，请先为用户更换角色。") }}
        </p>
        <p v-else class="mt-4 text-xs text-soft">
          {{ $t("有子权限的记录不能删除，请先调整子权限的父级。") }}
        </p>
      </div>
    </div>
    <AdminEditor
      v-if="editor && data && administrator"
      :section="section"
      :record="editor.record"
      :roles="data.roles"
      :permissions="data.permissions"
      @close="editor = null"
      @saved="saved"
    />
  </section>
</template>

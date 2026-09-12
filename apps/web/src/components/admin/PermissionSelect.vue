<script setup lang="ts">
import type { AdminPermission } from "@/types/iam";

defineProps<{
  permissions: AdminPermission[];
  inherited?: string[];
  disabled?: boolean;
  id?: string;
}>();
const selected = defineModel<string[]>({ required: true });
</script>

<template>
  <el-select
    :id="id"
    v-model="selected"
    multiple
    :multiple-limit="500"
    filterable
    clearable
    collapse-tags
    collapse-tags-tooltip
    :max-collapse-tags="3"
    :disabled="disabled"
    :placeholder="$t('搜索并选择权限')"
    :aria-label="$t('选择权限')"
  >
    <el-option
      v-for="permission in permissions"
      :key="permission.id"
      :label="`${permission.permissionName} · ${permission.permissionCode}`"
      :value="permission.permissionCode"
    >
      <span>{{ permission.permissionName }}</span>
      <span class="ml-2 text-xs text-faint">{{
        permission.permissionCode
      }}</span>
      <span
        v-if="inherited?.includes(permission.permissionCode)"
        class="ml-2 text-xs text-accent"
        >{{ $t("角色已有") }}</span
      >
    </el-option>
  </el-select>
</template>

<script setup lang="ts">
import { onScopeDispose, ref } from "vue";
import { Pencil, Plus, RefreshCw, UserMinus } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage, requestScope } from "@/api/request";
import { useRemoteData } from "@/composables/useRemoteData";
import { translate } from "@/i18n";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Album, AlbumMember, AlbumMemberPermissions } from "@/types/media";
import AppModal from "@/components/workspace/AppModal.vue";
import DataState from "@/components/workspace/DataState.vue";

const props = defineProps<{ album: Album }>();
const emit = defineEmits<{ close: [] }>();
const workspace = useWorkspaceStore();
const {
  data: members,
  loading,
  error: loadError,
  refresh,
} = useRemoteData(
  (signal) => mediaApi.albumMembers(props.album.id, signal),
  [() => props.album.id],
);
const email = ref("");
const editingId = ref<string | null>(null);
const permissions = ref<AlbumMemberPermissions>({
  canAdd: false,
  canEdit: false,
  canRemove: false,
});
const permissionOptions: {
  key: keyof AlbumMemberPermissions;
  label: string;
}[] = [
  { key: "canAdd", label: "添加媒体" },
  { key: "canEdit", label: "编辑相册和文件名称" },
  { key: "canRemove", label: "移除相册媒体" },
];
const form = ref<HTMLFormElement | null>(null);
const busy = ref(false);
const error = ref("");
const controller = new AbortController();
const scope = requestScope();
onScopeDispose(() => controller.abort());

function isCurrent() {
  return !controller.signal.aborted && scope === requestScope();
}

function resetForm() {
  editingId.value = null;
  email.value = "";
  permissions.value = { canAdd: false, canEdit: false, canRemove: false };
  error.value = "";
}

function edit(member: AlbumMember) {
  if (busy.value) return;
  editingId.value = member.userId;
  email.value = member.email;
  permissions.value = {
    canAdd: member.canAdd,
    canEdit: member.canEdit,
    canRemove: member.canRemove,
  };
  error.value = "";
  form.value?.scrollIntoView({ block: "nearest" });
}

async function submit() {
  if (busy.value || loading.value || loadError.value || !isCurrent()) return;
  if (!email.value.trim()) {
    error.value = translate("请输入对方已注册的邮箱");
    return;
  }
  busy.value = true;
  error.value = "";
  const updating = editingId.value !== null;
  try {
    const result = editingId.value
      ? await mediaApi.updateAlbumMember(
          props.album.id,
          editingId.value,
          { ...permissions.value },
          controller.signal,
        )
      : await mediaApi.inviteAlbumMember(
          props.album.id,
          { email: email.value.trim(), ...permissions.value },
          controller.signal,
        );
    if (!isCurrent()) return;
    const existing = members.value ?? [];
    members.value = existing.some(
      (member) => member.userId === result.member.userId,
    )
      ? existing.map((member) =>
          member.userId === result.member.userId ? result.member : member,
        )
      : [...existing, result.member];
    workspace.updateAlbum(result.album);
    workspace.notify(
      translate(
        updating ? "成员权限已更新" : "邀请已生效，对方可在相册列表查看",
      ),
    );
    resetForm();
  } catch (cause) {
    if (isCurrent()) error.value = getErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}

async function remove(member: AlbumMember) {
  if (busy.value || !isCurrent()) return;
  busy.value = true;
  error.value = "";
  try {
    if (
      !(await workspace.confirm({
        title: translate("移除相册成员？"),
        message: translate(
          "移除「{value1}」的相册访问与协作权限，已添加的媒体仍保留。",
          { value1: member.username },
        ),
        confirmLabel: translate("移除成员"),
        danger: true,
      })) ||
      !isCurrent()
    )
      return;
    const result = await mediaApi.removeAlbumMember(
      props.album.id,
      member.userId,
      controller.signal,
    );
    if (!isCurrent()) return;
    members.value = (members.value ?? []).filter(
      (current) => current.userId !== result.userId,
    );
    workspace.updateAlbum(result.album);
    if (editingId.value === result.userId) resetForm();
    workspace.notify(translate("成员已移除"));
  } catch (cause) {
    if (isCurrent()) error.value = getErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AppModal
    open
    :title="$t('共享相册成员管理')"
    :description="
      $t(
        '按已注册邮箱邀请，默认仅查看。邀请后对方即可在相册列表中访问，无需公开分享链接。',
      )
    "
    :busy="busy"
    @update:open="emit('close')"
  >
    <div class="space-y-5 p-5">
      <p class="text-xs text-soft">
        {{ album.name }} ·
        {{ $t("创建者：{value1}", { value1: album.owner.username }) }}
      </p>
      <form
        ref="form"
        class="space-y-3 rounded-lg border border-line bg-panel2 p-3"
        @submit.prevent="submit"
      >
        <h4 class="text-xs font-semibold">
          {{ editingId ? $t("修改成员权限") : $t("邀请成员") }}
        </h4>
        <label class="mh-label">
          {{ $t("已注册邮箱") }}
          <el-input
            v-model="email"
            type="email"
            required
            maxlength="320"
            :disabled="busy || Boolean(editingId)"
            :placeholder="$t('请输入对方已注册的邮箱')"
          />
        </label>
        <div class="flex flex-wrap gap-x-4">
          <el-checkbox :model-value="true" disabled>{{
            $t("查看相册")
          }}</el-checkbox>
          <el-checkbox
            v-for="option in permissionOptions"
            :key="option.key"
            v-model="permissions[option.key]"
            :disabled="busy"
            >{{ $t(option.label) }}</el-checkbox
          >
        </div>
        <p class="text-xs leading-6 text-faint">
          {{
            $t(
              "编辑包含相册信息、封面和文件名称；移除仅解除相册关联，不删除原文件。成员不能邀请他人或删除整个相册。",
            )
          }}
        </p>
        <div class="flex justify-end gap-2">
          <el-button
            v-if="editingId"
            native-type="button"
            :disabled="busy"
            @click="resetForm"
            >{{ $t("取消修改") }}</el-button
          >
          <el-button
            type="primary"
            native-type="submit"
            :loading="busy"
            :disabled="
              busy ||
              loading ||
              Boolean(loadError) ||
              (!editingId && (members?.length ?? 0) >= 200)
            "
          >
            <Plus v-if="!editingId && !busy" />{{
              editingId ? $t("保存权限") : $t("邀请成员")
            }}
          </el-button>
        </div>
      </form>
      <p v-if="error" class="text-xs text-err" role="alert">{{ error }}</p>
      <div class="flex items-center justify-between gap-2">
        <h4 class="text-xs font-semibold">
          {{ $t("受邀成员") }} ({{ members?.length ?? 0 }} / 200)
        </h4>
        <el-button
          text
          circle
          native-type="button"
          :disabled="busy || loading"
          :aria-label="$t('刷新成员列表')"
          @click="refresh()"
          ><RefreshCw :class="{ 'animate-spin': loading }"
        /></el-button>
      </div>
      <DataState
        v-if="loading || loadError"
        :loading="loading"
        :error="loadError"
        @retry="refresh"
      />
      <p v-else-if="!members?.length" class="text-xs leading-6 text-faint">
        {{ $t("尚未邀请成员，只有创建者可以访问。") }}
      </p>
      <div v-else class="max-h-72 space-y-3 overflow-y-auto">
        <div
          v-for="member in members"
          :key="member.userId"
          class="rounded-lg border border-line p-3"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="break-all text-xs font-medium">{{ member.username }}</p>
              <p class="mt-1 break-all text-xs text-faint">
                {{ member.email }}
              </p>
            </div>
            <div class="flex shrink-0 gap-1">
              <el-button
                text
                circle
                native-type="button"
                :disabled="busy"
                :aria-label="$t('修改成员权限')"
                @click="edit(member)"
                ><Pencil
              /></el-button>
              <el-button
                text
                circle
                type="danger"
                native-type="button"
                :disabled="busy"
                :aria-label="$t('移除成员')"
                @click="remove(member)"
                ><UserMinus
              /></el-button>
            </div>
          </div>
          <div class="mt-2 flex flex-wrap gap-2 text-[10px] text-soft">
            <span class="mh-chip">{{ $t("查看相册") }}</span>
            <template v-for="option in permissionOptions" :key="option.key">
              <span v-if="member[option.key]" class="mh-chip">{{
                $t(option.label)
              }}</span>
            </template>
          </div>
        </div>
      </div>
      <div class="flex justify-end">
        <el-button
          native-type="button"
          :disabled="busy"
          @click="emit('close')"
          >{{ $t("关闭") }}</el-button
        >
      </div>
    </div>
  </AppModal>
</template>

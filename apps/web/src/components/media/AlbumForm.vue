<script setup lang="ts">
import { translate } from "@/i18n";
import { ref } from "vue";

import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { useWorkspaceStore } from "@/stores/workspace";
import { useAuthStore } from "@/stores/auth";
import type { Album } from "@/types/media";
import AppModal from "@/components/workspace/AppModal.vue";

const props = defineProps<{ album?: Album; shared?: boolean }>();
const emit = defineEmits<{ close: []; saved: [album: Album] }>();
const workspace = useWorkspaceStore();
const auth = useAuthStore();
const shared = ref(props.album?.shared ?? props.shared ?? false);
const name = ref(props.album?.name ?? "");
const description = ref(props.album?.description ?? "");
const busy = ref(false);
const error = ref("");

async function submit() {
  if (busy.value) return;
  if (!name.value.trim()) {
    error.value = translate("请输入相册名称");
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const body = {
      name: name.value.trim(),
      description: description.value.trim(),
    };
    const album = props.album
      ? await mediaApi.updateAlbum(props.album.id, body)
      : await mediaApi.createAlbum({ ...body, shared: shared.value });
    workspace.updateAlbum(album, !props.album);
    workspace.notify(
      props.album
        ? translate("相册已更新")
        : translate("相册已创建，可以添加照片了"),
    );
    emit("saved", album);
    emit("close");
  } catch (cause) {
    error.value = getErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AppModal
    open
    :title="
      album ? $t('编辑相册') : shared ? $t('新建共享相册') : $t('新建相册')
    "
    :description="
      shared
        ? $t('仅创建者和受邀成员可见，可分别授权添加、编辑和移除媒体。')
        : $t('给回忆一个名字，让每一张照片都有归属。')
    "
    :busy="busy"
    @update:open="emit('close')"
  >
    <form class="space-y-4 p-5" @submit.prevent="submit">
      <div
        v-if="!album && auth.user?.roleCode === 'ROLE_ADMIN'"
        class="space-y-2"
      >
        <el-checkbox v-model="shared" :disabled="busy">{{
          $t("共享相册")
        }}</el-checkbox>
        <p v-if="shared" class="text-xs leading-6 text-soft">
          {{ $t("创建后可在「成员管理」中按已注册邮箱邀请其他用户。") }}
        </p>
      </div>
      <label class="mh-label"
        >{{ $t("相册名称")
        }}<el-input
          v-model="name"
          maxlength="200"
          required
          autofocus
          :disabled="busy"
          :placeholder="$t('例如：夏日旅行')"
      /></label>
      <label class="mh-label"
        >{{ $t("描述（可选）")
        }}<el-input
          type="textarea"
          :rows="4"
          v-model="description"
          maxlength="2000"
          :disabled="busy"
          :placeholder="$t('记录一些与这段回忆有关的事…')"
        />
      </label>
      <p v-if="error" class="text-xs text-err" role="alert">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <el-button
          native-type="button"
          :disabled="busy"
          @click="emit('close')"
          >{{ $t("取消") }}</el-button
        ><el-button
          type="primary"
          :loading="busy"
          native-type="submit"
          :disabled="busy"
        >
          {{ album ? $t("保存更改") : $t("创建相册") }}
        </el-button>
      </div>
    </form>
  </AppModal>
</template>

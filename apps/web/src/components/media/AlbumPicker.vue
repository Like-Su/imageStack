<script setup lang="ts">
import { translate } from "@/i18n";
import { ref } from "vue";
import { FolderPlus } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { useRemoteData } from "@/composables/useRemoteData";
import { useWorkspaceStore } from "@/stores/workspace";
import AppModal from "@/components/workspace/AppModal.vue";
import DataState from "@/components/workspace/DataState.vue";

const props = defineProps<{ assetIds: string[] }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const workspace = useWorkspaceStore();
const {
  data: albums,
  loading,
  error,
  refresh,
} = useRemoteData(mediaApi.albums);
const selected = ref("");
const newName = ref("");
const creating = ref(false);
const busy = ref(false);
const formError = ref("");

async function submit() {
  if (busy.value) return;
  formError.value = "";
  if (creating.value ? !newName.value.trim() : !selected.value) {
    formError.value = translate("请先选择相册或输入新相册名称");
    return;
  }
  busy.value = true;
  try {
    if (creating.value) {
      const album = await mediaApi.createAlbum({ name: newName.value.trim() });
      selected.value = album.id;
      creating.value = false;
    }
    const result = await mediaApi.addToAlbum(selected.value, props.assetIds);
    workspace.invalidate();
    workspace.notify(
      result.count
        ? translate("已添加 {value1} 项媒体到相册", { value1: result.count })
        : translate("所选媒体已在此相册中"),
    );
    emit("saved");
    emit("close");
  } catch (cause) {
    formError.value = getErrorMessage(cause);
    void refresh();
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <AppModal
    open
    :title="$t('添加到相册')"
    :description="
      $t('已选择 {value1} 项媒体，不会移动或复制原文件。', {
        value1: assetIds.length,
      })
    "
    :busy="busy"
    @update:open="emit('close')"
  >
    <form class="space-y-4 p-5" @submit.prevent="submit">
      <DataState
        v-if="(loading && !albums) || error"
        :loading="loading"
        :error="error"
        @retry="refresh"
      />
      <template v-else>
        <label v-if="!creating" class="mh-label"
          >{{ $t("选择相册")
          }}<el-select v-model="selected" class="min-w-36" :disabled="busy">
            <el-option
              :label="
                albums?.length ? $t('请选择相册') : $t('还没有相册，请先新建')
              "
              value=""
            >
            </el-option>
            <el-option
              :label="album.name + '·' + album.count + $t('项')"
              v-for="album in albums"
              :key="album.id"
              :value="album.id"
            >
            </el-option> </el-select
        ></label>
        <label v-else class="mh-label"
          >{{ $t("新相册名称")
          }}<el-input
            v-model="newName"
            maxlength="200"
            required
            :disabled="busy"
            :placeholder="$t('例如：旅行的记忆')"
        /></label>
        <button
          type="button"
          class="flex items-center gap-1.5 text-xs text-accent"
          :disabled="busy"
          @click="creating = !creating"
        >
          <FolderPlus class="size-3.5" />{{
            creating ? $t("选择已有相册") : $t("新建相册")
          }}
        </button>
      </template>
      <p v-if="formError" class="text-xs text-err" role="alert">
        {{ formError }}
      </p>
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
          :disabled="busy || loading"
          >{{ $t("添加到相册") }}</el-button
        >
      </div>
    </form>
  </AppModal>
</template>

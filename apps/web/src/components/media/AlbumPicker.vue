<script setup lang="ts">
import { ref } from "vue";
import { FolderPlus, LoaderCircle } from "lucide-vue-next";
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
    formError.value = "请先选择相册或输入新相册名称";
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
        ? `已添加 ${result.count} 项媒体到相册`
        : "所选媒体已在此相册中",
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
    title="添加到相册"
    :description="`已选择 ${assetIds.length} 项媒体，不会移动或复制原文件。`"
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
          >选择相册<select v-model="selected" class="mh-input" :disabled="busy">
            <option value="">
              {{ albums?.length ? "请选择相册" : "还没有相册，请先新建" }}
            </option>
            <option v-for="album in albums" :key="album.id" :value="album.id">
              {{ album.name }} · {{ album.count }} 项
            </option>
          </select></label
        >
        <label v-else class="mh-label"
          >新相册名称<input
            v-model="newName"
            class="mh-input"
            maxlength="200"
            required
            :disabled="busy"
            placeholder="例如：旅行的记忆"
        /></label>
        <button
          type="button"
          class="flex items-center gap-1.5 text-xs text-accent"
          :disabled="busy"
          @click="creating = !creating"
        >
          <FolderPlus class="size-3.5" />{{
            creating ? "选择已有相册" : "新建相册"
          }}
        </button>
      </template>
      <p v-if="formError" class="text-xs text-err" role="alert">
        {{ formError }}
      </p>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          class="mh-button"
          :disabled="busy"
          @click="emit('close')"
        >
          取消</button
        ><button
          type="submit"
          class="mh-button mh-button-primary"
          :disabled="busy || loading"
        >
          <LoaderCircle v-if="busy" class="animate-spin" />添加到相册
        </button>
      </div>
    </form>
  </AppModal>
</template>

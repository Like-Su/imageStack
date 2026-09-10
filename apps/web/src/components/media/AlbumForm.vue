<script setup lang="ts">
import { ref } from "vue";
import { LoaderCircle } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Album } from "@/types/media";
import AppModal from "@/components/workspace/AppModal.vue";

const props = defineProps<{ album?: Album }>();
const emit = defineEmits<{ close: []; saved: [album: Album] }>();
const workspace = useWorkspaceStore();
const name = ref(props.album?.name ?? "");
const description = ref(props.album?.description ?? "");
const busy = ref(false);
const error = ref("");

async function submit() {
  if (busy.value) return;
  if (!name.value.trim()) {
    error.value = "请输入相册名称";
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
      : await mediaApi.createAlbum(body);
    workspace.invalidate();
    workspace.notify(props.album ? "相册已更新" : "相册已创建，可以添加照片了");
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
    :title="album ? '编辑相册' : '新建相册'"
    description="给回忆一个名字，让每一张照片都有归属。"
    :busy="busy"
    @update:open="emit('close')"
  >
    <form class="space-y-4 p-5" @submit.prevent="submit">
      <label class="mh-label"
        >相册名称<input
          v-model="name"
          class="mh-input"
          maxlength="200"
          required
          autofocus
          :disabled="busy"
          placeholder="例如：夏日旅行"
      /></label>
      <label class="mh-label"
        >描述（可选）<textarea
          v-model="description"
          class="mh-input min-h-28 resize-y"
          maxlength="2000"
          :disabled="busy"
          placeholder="记录一些与这段回忆有关的事…"
        />
      </label>
      <p v-if="error" class="text-xs text-err" role="alert">{{ error }}</p>
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
          :disabled="busy"
        >
          <LoaderCircle v-if="busy" class="animate-spin" />{{
            album ? "保存更改" : "创建相册"
          }}
        </button>
      </div>
    </form>
  </AppModal>
</template>

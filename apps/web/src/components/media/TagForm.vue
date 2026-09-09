<script setup lang="ts">
import { ref } from "vue";
import { LoaderCircle } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { PERSON_TAG_PREFIX } from "@/config/workspace";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Tag } from "@/types/media";
import AppModal from "@/components/workspace/AppModal.vue";

const props = defineProps<{ tag?: Tag; people?: boolean }>();
const emit = defineEmits<{ close: []; saved: [tag: Tag] }>();
const workspace = useWorkspaceStore();
const name = ref(
  props.tag
    ? props.people
      ? props.tag.name.slice(PERSON_TAG_PREFIX.length)
      : props.tag.name
    : "",
);
const busy = ref(false);
const error = ref("");
async function submit() {
  if (busy.value) return;
  if (!name.value.trim()) {
    error.value = "请输入名称";
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const nextName = `${props.people ? PERSON_TAG_PREFIX : ""}${name.value.trim()}`;
    const tag = props.tag
      ? await mediaApi.updateTag(props.tag.id, { name: nextName })
      : await mediaApi.createTag(nextName);
    workspace.invalidate();
    workspace.notify(
      `${props.people ? "人物" : "标签"}已${props.tag ? "更新" : "创建"}`,
    );
    emit("saved", tag);
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
    :title="`${tag ? '编辑' : '新建'}${people ? '人物' : '标签'}`"
    :busy="busy"
    @update:open="emit('close')"
    ><form class="space-y-4 p-5" @submit.prevent="submit">
      <label class="mh-label"
        >{{ people ? "人物姓名" : "标签名称"
        }}<input
          v-model="name"
          class="mh-input"
          :maxlength="people ? 100 - PERSON_TAG_PREFIX.length : 100"
          required
          autofocus
          :disabled="busy"
          :placeholder="people ? '为人物命名' : '例如：旅行、风景、灵感'"
      /></label>
      <p v-if="people" class="text-xs leading-6 text-soft">
        人物使用「{{
          PERSON_TAG_PREFIX
        }}姓名」标签持久化保存，你可以手动添加与合并照片分组。
      </p>
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
          <LoaderCircle v-if="busy" class="animate-spin" />保存
        </button>
      </div>
    </form></AppModal
  >
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { LoaderCircle } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { PERSON_TAG_PREFIX } from "@/config/workspace";
import { useRemoteData } from "@/composables/useRemoteData";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Tag } from "@/types/media";
import AppModal from "@/components/workspace/AppModal.vue";
import DataState from "@/components/workspace/DataState.vue";

const props = defineProps<{ tag: Tag }>();
const emit = defineEmits<{ close: []; merged: [tag: Tag] }>();
const workspace = useWorkspaceStore();
const {
  data: tags,
  loading,
  error: loadError,
  refresh,
} = useRemoteData(mediaApi.tags);
const targets = computed(() =>
  (tags.value ?? []).filter(
    (tag) =>
      tag.id !== props.tag.id &&
      tag.name.startsWith(PERSON_TAG_PREFIX) ===
        props.tag.name.startsWith(PERSON_TAG_PREFIX),
  ),
);
const targetId = ref("");
const busy = ref(false);
const error = ref("");
async function submit() {
  if (busy.value || !targetId.value) return;
  busy.value = true;
  error.value = "";
  try {
    const target = targets.value.find((tag) => tag.id === targetId.value);
    if (
      !target ||
      !(await workspace.confirm({
        title: "确认合并？",
        message: `「${props.tag.name}」的所有关联将转移到「${target.name}」，原分组会被删除，重复关联会自动去重。`,
        confirmLabel: "合并分组",
      }))
    )
      return;
    const result = await mediaApi.updateTag(props.tag.id, {
      mergeIntoId: target.id,
    });
    workspace.invalidate();
    workspace.notify("分组已合并，媒体文件保持不变");
    emit("merged", result);
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
    title="合并分组"
    :description="`将「${tag.name}」合并到其他同类分组。`"
    :busy="busy"
    @update:open="emit('close')"
    ><form class="space-y-4 p-5" @submit.prevent="submit">
      <DataState
        v-if="loading || loadError"
        :loading="loading"
        :error="loadError"
        @retry="refresh"
      /><label v-else class="mh-label"
        >合并到<select
          v-model="targetId"
          class="mh-input"
          required
          :disabled="busy"
        >
          <option value="">
            {{ targets.length ? "请选择目标分组" : "没有其他可合并的同类分组" }}
          </option>
          <option v-for="target in targets" :key="target.id" :value="target.id">
            {{ target.name }} · {{ target.count }} 项
          </option>
        </select></label
      >
      <p v-if="error" class="text-xs text-err" role="alert">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <button
          class="mh-button"
          type="button"
          :disabled="busy"
          @click="emit('close')"
        >
          取消</button
        ><button
          class="mh-button mh-button-primary"
          type="submit"
          :disabled="busy || !targetId"
        >
          <LoaderCircle v-if="busy" class="animate-spin" />合并
        </button>
      </div>
    </form></AppModal
  >
</template>

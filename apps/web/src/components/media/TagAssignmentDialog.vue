<script setup lang="ts">
import { ref } from "vue";
import { LoaderCircle } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { useWorkspaceStore } from "@/stores/workspace";
import { PERSON_TAG_PREFIX } from "@/config/workspace";
import AppModal from "@/components/workspace/AppModal.vue";

const props = defineProps<{ assetIds: string[] }>();
const assetIds = [...props.assetIds];
const emit = defineEmits<{ close: []; saved: [] }>();
const workspace = useWorkspaceStore();
const text = ref("");
const people = ref(false);
const busy = ref(false);
const error = ref("");
const completed = ref(0);

async function submit() {
  if (busy.value) return;
  const names = [
    ...new Set(
      text.value
        .split(/[,，\n]/)
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ].map((name) => (people.value ? `${PERSON_TAG_PREFIX}${name}` : name));
  if (
    !names.length ||
    names.length > 50 ||
    names.some((name) => name.length > 100 || name.includes("\0"))
  ) {
    error.value =
      "请填写 1～50 个标签，每个标签（含人物前缀）不超过 100 字符。";
    return;
  }
  busy.value = true;
  error.value = "";
  completed.value = 0;
  try {
    for (const id of assetIds) {
      await mediaApi.addTags(id, names);
      completed.value += 1;
    }
    workspace.notify(
      `已为 ${completed.value} 项媒体添加${people.value ? "人物" : "标签"}`,
    );
    emit("saved");
    emit("close");
  } catch (cause) {
    error.value = `已成功更新 ${completed.value} 项；${getErrorMessage(cause)}。可重试，已有标签不会重复添加。`;
  } finally {
    workspace.invalidate();
    busy.value = false;
  }
}
</script>

<template>
  <AppModal
    open
    title="添加标签 / 人物"
    :busy="busy"
    @update:open="emit('close')"
  >
    <form class="space-y-4 p-5" @submit.prevent="submit">
      <p class="text-xs text-soft">
        将标签保存到选中的
        {{ assetIds.length }} 项媒体。人物以专用标签手动归类，不进行人脸识别。
      </p>
      <label class="flex items-center gap-2 text-xs text-soft"
        ><input
          v-model="people"
          type="checkbox"
          class="mh-checkbox"
          :disabled="busy"
        />添加为人物姓名</label
      >
      <label class="mh-label"
        >{{ people ? "人物姓名" : "标签名称"
        }}<textarea
          v-model="text"
          class="mh-input min-h-24 resize-y"
          maxlength="5000"
          required
          :disabled="busy"
          placeholder="多个名称用逗号或换行分隔"
        />
      </label>
      <p v-if="error" class="text-xs leading-6 text-err" role="alert">
        {{ error }}
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
          :disabled="busy"
        >
          <LoaderCircle v-if="busy" class="animate-spin" />{{
            busy ? `${completed} / ${assetIds.length}` : "保存标签"
          }}
        </button>
      </div>
    </form>
  </AppModal>
</template>

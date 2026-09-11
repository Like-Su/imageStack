<script setup lang="ts">
import { translate } from "@/i18n";
import { computed, ref } from "vue";

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
        title: translate("确认合并？"),
        message: translate(
          "「{value1}」的所有关联将转移到「{value2}」，原分组会被删除，重复关联会自动去重。",
          { value1: props.tag.name, value2: target.name },
        ),
        confirmLabel: translate("合并分组"),
      }))
    )
      return;
    const result = await mediaApi.updateTag(props.tag.id, {
      mergeIntoId: target.id,
    });
    workspace.invalidate();
    workspace.notify(translate("分组已合并，媒体文件保持不变"));
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
    :title="$t('合并分组')"
    :description="
      $t('将「{value1}」合并到其他同类分组。', { value1: tag.name })
    "
    :busy="busy"
    @update:open="emit('close')"
    ><form class="space-y-4 p-5" @submit.prevent="submit">
      <DataState
        v-if="loading || loadError"
        :loading="loading"
        :error="loadError"
        @retry="refresh"
      /><label v-else class="mh-label"
        >{{ $t("合并到")
        }}<el-select
          v-model="targetId"
          class="min-w-36"
          required
          :disabled="busy"
        >
          <el-option
            :label="
              targets.length
                ? $t('请选择目标分组')
                : $t('没有其他可合并的同类分组')
            "
            value=""
          >
          </el-option>
          <el-option
            :label="target.name + '·' + target.count + $t('项')"
            v-for="target in targets"
            :key="target.id"
            :value="target.id"
          >
          </el-option> </el-select
      ></label>
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
          :disabled="busy || !targetId"
          >{{ $t("合并") }}</el-button
        >
      </div>
    </form></AppModal
  >
</template>

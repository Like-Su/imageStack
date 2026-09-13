<script setup lang="ts">
import { translate } from "@/i18n";
import { ref } from "vue";

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
    error.value = translate("请输入名称");
    return;
  }
  busy.value = true;
  error.value = "";
  try {
    const nextName = `${props.people ? PERSON_TAG_PREFIX : ""}${name.value.trim()}`;
    const tag = props.tag
      ? await mediaApi.updateTag(props.tag.id, { name: nextName })
      : await mediaApi.createTag(nextName);
    workspace.updateTag(tag, !props.tag);
    workspace.notify(
      translate("{value1}已{value2}", {
        value1: props.people ? translate("人物") : translate("标签"),
        value2: props.tag ? translate("更新") : translate("创建"),
      }),
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
    :title="
      tag
        ? people
          ? $t('编辑人物')
          : $t('编辑标签')
        : people
          ? $t('添加人物')
          : $t('新建标签')
    "
    :busy="busy"
    @update:open="emit('close')"
    ><form class="space-y-4 p-5" @submit.prevent="submit">
      <label class="mh-label"
        >{{ people ? $t("人物姓名") : $t("标签名称")
        }}<el-input
          v-model="name"
          :maxlength="people ? 100 - PERSON_TAG_PREFIX.length : 100"
          required
          autofocus
          :disabled="busy"
          :placeholder="
            people ? $t('为人物命名') : $t('例如：旅行、风景、灵感')
          "
      /></label>
      <p v-if="people" class="text-xs leading-6 text-soft">
        {{
          $t(
            "人物使用「{value1}姓名」标签持久化保存，你可以手动添加与合并照片分组。",
            { value1: PERSON_TAG_PREFIX },
          )
        }}
      </p>
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
          >{{ $t("保存") }}</el-button
        >
      </div>
    </form></AppModal
  >
</template>

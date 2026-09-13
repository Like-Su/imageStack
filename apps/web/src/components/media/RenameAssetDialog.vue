<script setup lang="ts">
import { onScopeDispose, ref } from "vue";
import { mediaApi } from "@/api/media";
import { getErrorMessage, requestScope } from "@/api/request";
import { translate } from "@/i18n";
import { useWorkspaceStore } from "@/stores/workspace";
import type { AssetSummary } from "@/types/media";
import AppModal from "@/components/workspace/AppModal.vue";

const props = defineProps<{ asset: AssetSummary }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const workspace = useWorkspaceStore();
const extension = props.asset.name.match(/\.[^.]+$/u)?.[0] ?? "";
const name = ref(
  extension ? props.asset.name.slice(0, -extension.length) : props.asset.name,
);
const busy = ref(false);
const error = ref("");
const controller = new AbortController();
const scope = requestScope();

onScopeDispose(() => controller.abort());

function isCurrent() {
  return !controller.signal.aborted && scope === requestScope();
}

async function submit() {
  if (
    busy.value ||
    !isCurrent() ||
    props.asset.deleted ||
    !workspace.can("asset:edit")
  )
    return;
  const baseName = name.value.trim();
  if (!baseName || baseName === "." || baseName === "..") {
    error.value = translate("请输入有效的文件名称");
    return;
  }
  if (/[/\\\u0000-\u001f\u007f]/u.test(baseName)) {
    error.value = translate("文件名称不能包含路径分隔符或控制字符");
    return;
  }
  const nextName = `${baseName}${extension}`;
  if (nextName.length > 255) {
    error.value = translate("文件名称（含扩展名）不能超过 255 个字符");
    return;
  }
  busy.value = true;
  error.value = "";
  workspace.rememberAssets([props.asset]);
  try {
    const result = await mediaApi.renameAsset(
      props.asset.id,
      nextName,
      controller.signal,
    );
    if (!isCurrent()) return;
    workspace.updateAssets([result.id], {
      name: result.name,
      updatedAt: result.updatedAt,
    });
    workspace.notify(translate("文件名称已更新"));
    emit("saved");
    emit("close");
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
    :title="$t('重命名文件')"
    :description="
      $t('仅修改名称，保留原扩展名，不影响原文件、相册和分享链接。')
    "
    :busy="busy"
    @update:open="emit('close')"
  >
    <form class="space-y-4 p-5" @submit.prevent="submit">
      <label class="mh-label">
        {{ $t("文件名称（不含扩展名）") }}
        <el-input
          v-model="name"
          :maxlength="255 - extension.length"
          required
          autofocus
          :disabled="busy"
          :placeholder="$t('请输入文件名称')"
        >
          <template v-if="extension" #append>{{ extension }}</template>
        </el-input>
      </label>
      <p v-if="error" class="text-xs text-err" role="alert">{{ error }}</p>
      <div class="flex justify-end gap-2">
        <el-button native-type="button" :disabled="busy" @click="emit('close')">
          {{ $t("取消") }}
        </el-button>
        <el-button
          type="primary"
          native-type="submit"
          :loading="busy"
          :disabled="busy"
        >
          {{ $t("保存更改") }}
        </el-button>
      </div>
    </form>
  </AppModal>
</template>

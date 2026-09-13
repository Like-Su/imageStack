<script setup lang="ts">
import { translate } from "@/i18n";
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ArrowLeft, Plus, Pencil, Merge, Trash2 } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { PERSON_TAG_PREFIX } from "@/config/workspace";
import { useRemoteData } from "@/composables/useRemoteData";
import { updateTags } from "@/composables/workspaceUpdates";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Tag } from "@/types/media";
import PageHeader from "@/components/workspace/PageHeader.vue";
import DataState from "@/components/workspace/DataState.vue";
import AssetBrowser from "@/components/media/AssetBrowser.vue";
import AssetPicker from "@/components/media/AssetPicker.vue";
import TagForm from "@/components/media/TagForm.vue";
import TagMergeDialog from "@/components/media/TagMergeDialog.vue";
import ViewToggle from "@/components/media/ViewToggle.vue";

const props = defineProps<{ people?: boolean }>();
const route = useRoute();
const router = useRouter();
const workspace = useWorkspaceStore();
const tagId = computed(() => String(route.params.id ?? ""));
const {
  data: tag,
  loading,
  error,
  refresh,
} = useRemoteData(
  async (signal) => {
    const found = await mediaApi.tag(tagId.value, signal);
    if (props.people && !found.name.startsWith(PERSON_TAG_PREFIX))
      throw new Error(translate("分组不存在或已被合并，请返回分组列表。"));
    return found;
  },
  [tagId],
  {
    resources: ["tags"],
    update: (current, change) =>
      updateTags([current], change).find((entry) => entry.id === current.id) ??
      current,
  },
);
const label = computed(() =>
  tag.value
    ? props.people
      ? tag.value.name.slice(PERSON_TAG_PREFIX.length)
      : tag.value.name
    : props.people
      ? translate("人物详情")
      : translate("标签详情"),
);
const editing = ref(false);
const merging = ref(false);
const picking = ref(false);
const busy = ref(false);
const pickerError = ref("");

async function addAssets(ids: string[]) {
  if (busy.value || !tag.value) return;
  busy.value = true;
  pickerError.value = "";
  const name = tag.value.name;
  let completed = 0;
  try {
    workspace.beginChanges();
    const result = await mediaApi.addTagsBatch(ids, [name]);
    workspace.applyTagBatch(result);
    completed = result.assets.length;
    workspace.notify(
      translate("已关联 {value1} 项媒体", { value1: completed }),
    );
    picking.value = false;
  } catch (cause) {
    pickerError.value = translate(
      "已成功关联 {value1} 项；{value2}。可重试，已有记录不会重复添加。",
      { value1: completed, value2: getErrorMessage(cause) },
    );
  } finally {
    workspace.endChanges();
    busy.value = false;
  }
}
async function remove() {
  if (!tag.value || busy.value) return;
  const current = tag.value;
  busy.value = true;
  try {
    if (
      !(await workspace.confirm({
        title: translate("删除分组？"),
        message: translate("删除「{value1}」及关联，媒体文件仍保留。", {
          value1: current.name,
        }),
        confirmLabel: translate("删除分组"),
        danger: true,
      }))
    )
      return;
    if (
      await workspace.perform(
        () => mediaApi.deleteTag(current.id),
        translate("分组已删除"),
        () => workspace.deleteTag(current.id),
      )
    )
      await router.replace({ name: props.people ? "people" : "tags" });
  } finally {
    busy.value = false;
  }
}
function merged(target: Tag) {
  void router.replace({
    name: props.people ? "person-detail" : "tag-detail",
    params: { id: target.id },
  });
}
</script>

<template>
  <section>
    <PageHeader
      :title="label"
      :description="
        tag
          ? $t('{value1} 项媒体 · {value2}', {
              value1: tag.count,
              value2: people ? $t('手动人物归类') : $t('手动标签'),
            })
          : ''
      "
      ><template #eyebrow
        ><RouterLink
          :to="{ name: people ? 'people' : 'tags' }"
          class="mb-3 flex items-center gap-1 text-xs text-soft hover:text-accent"
          ><ArrowLeft class="size-3.5" />{{
            people ? $t("全部人物") : $t("全部标签")
          }}</RouterLink
        ></template
      ><ViewToggle /><template v-if="tag && workspace.can('asset:tag')"
        ><el-button
          text
          circle
          native-type="button"
          :aria-label="$t('重命名分组')"
          :disabled="busy"
          @click="editing = true"
        >
          <Pencil /></el-button
        ><el-button
          text
          circle
          native-type="button"
          :aria-label="$t('合并分组')"
          :disabled="busy"
          @click="merging = true"
        >
          <Merge /></el-button
        ><el-button
          text
          circle
          native-type="button"
          class="!text-err"
          :aria-label="$t('删除分组')"
          :disabled="busy"
          @click="remove"
        >
          <Trash2 /></el-button
        ><el-button
          type="primary"
          native-type="button"
          :disabled="busy"
          @click="
            picking = true;
            pickerError = '';
          "
        >
          <Plus />{{ $t("关联媒体") }}</el-button
        ></template
      ></PageHeader
    >
    <DataState
      v-if="(loading && !tag) || error"
      :loading="loading"
      :error="error"
      @retry="refresh"
    />
    <AssetBrowser
      v-else-if="tag"
      :query="{ tagId }"
      :empty-title="
        people ? $t('为这个人物添加照片') : $t('这个标签下还没有媒体')
      "
      empty-description="点击「关联媒体」从图库选择，或在照片详情中添加对应标签。"
    />
    <TagForm
      v-if="editing && tag"
      :tag="tag"
      :people="people"
      @close="editing = false"
    />
    <TagMergeDialog
      v-if="merging && tag"
      :tag="tag"
      @close="merging = false"
      @merged="merged"
    />
    <AssetPicker
      v-if="picking"
      :title="$t('关联到 {value1}', { value1: label })"
      :busy="busy"
      :error="pickerError"
      @close="picking = false"
      @submit="addAssets"
    />
  </section>
</template>

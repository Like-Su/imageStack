<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ArrowLeft, Plus, Pencil, Merge, Trash2 } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { PERSON_TAG_PREFIX } from "@/config/workspace";
import { useRemoteData } from "@/composables/useRemoteData";
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
    const tags = await mediaApi.tags(signal);
    const found = tags.find(
      (item) =>
        item.id === tagId.value &&
        (!props.people || item.name.startsWith(PERSON_TAG_PREFIX)),
    );
    if (!found) throw new Error("分组不存在或已被合并，请返回分组列表。");
    return found;
  },
  [tagId],
);
const label = computed(() =>
  tag.value
    ? props.people
      ? tag.value.name.slice(PERSON_TAG_PREFIX.length)
      : tag.value.name
    : props.people
      ? "人物详情"
      : "标签详情",
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
    for (const id of ids) {
      await mediaApi.addTags(id, [name]);
      completed += 1;
    }
    workspace.notify(`已关联 ${completed} 项媒体`);
    picking.value = false;
  } catch (cause) {
    pickerError.value = `已成功关联 ${completed} 项；${getErrorMessage(cause)}。可重试，已有记录不会重复添加。`;
  } finally {
    workspace.invalidate();
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
        title: "删除分组？",
        message: `删除「${current.name}」及关联，媒体文件仍保留。`,
        confirmLabel: "删除分组",
        danger: true,
      }))
    )
      return;
    if (
      await workspace.perform(
        () => mediaApi.deleteTag(current.id),
        "分组已删除",
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
          ? `${tag.count} 项媒体 · ${people ? '手动人物归类' : '手动标签'}`
          : ''
      "
      ><template #eyebrow
        ><RouterLink
          :to="{ name: people ? 'people' : 'tags' }"
          class="mb-3 flex items-center gap-1 text-xs text-soft hover:text-accent"
          ><ArrowLeft class="size-3.5" />{{
            people ? "全部人物" : "全部标签"
          }}</RouterLink
        ></template
      ><ViewToggle /><template v-if="tag && workspace.can('asset:tag')"
        ><button
          type="button"
          class="mh-icon-button"
          aria-label="重命名分组"
          :disabled="busy"
          @click="editing = true"
        >
          <Pencil /></button
        ><button
          type="button"
          class="mh-icon-button"
          aria-label="合并分组"
          :disabled="busy"
          @click="merging = true"
        >
          <Merge /></button
        ><button
          type="button"
          class="mh-icon-button !text-err"
          aria-label="删除分组"
          :disabled="busy"
          @click="remove"
        >
          <Trash2 /></button
        ><button
          type="button"
          class="mh-button mh-button-primary"
          :disabled="busy"
          @click="
            picking = true;
            pickerError = '';
          "
        >
          <Plus />关联媒体
        </button></template
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
      :empty-title="people ? '为这个人物添加照片' : '这个标签下还没有媒体'"
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
      :title="`关联到 ${label}`"
      :busy="busy"
      :error="pickerError"
      @close="picking = false"
      @submit="addAssets"
    />
  </section>
</template>

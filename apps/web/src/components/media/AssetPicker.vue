<script setup lang="ts">
import { ref } from "vue";
import { Check, Search } from "lucide-vue-next";
import { useAssetFeed } from "@/composables/useAssetFeed";
import { useWorkspaceStore } from "@/stores/workspace";
import AppModal from "@/components/workspace/AppModal.vue";
import DataState from "@/components/workspace/DataState.vue";
import AssetImage from "./AssetImage.vue";
import AssetLoadMore from "./AssetLoadMore.vue";
import AssetSortControl from "./AssetSortControl.vue";

const props = withDefaults(
  defineProps<{
    title?: string;
    busy?: boolean;
    error?: string;
    albumId?: string;
    multiple?: boolean;
    initialSelection?: string[];
  }>(),
  {
    title: "选择图库媒体",
    multiple: true,
    initialSelection: () => [],
  },
);
const emit = defineEmits<{ close: []; submit: [ids: string[]] }>();
const workspace = useWorkspaceStore();
const searchText = ref("");
const submitted = ref("");
const selected = ref(
  new Set(props.initialSelection.slice(0, props.multiple ? 100 : 1)),
);
const feed = useAssetFeed(() => ({
  query: { albumId: props.albumId },
  search: submitted.value || undefined,
}));
const {
  items,
  loading,
  error: loadError,
  hasMore,
  loadingMore,
  refreshing,
  moreError,
} = feed;

function toggle(id: string) {
  if (props.busy) return;
  if (selected.value.has(id)) selected.value.delete(id);
  else if (!props.multiple) selected.value = new Set([id]);
  else if (selected.value.size < 100) selected.value.add(id);
}

function submit() {
  if (props.busy || !selected.value.size) return;
  workspace.rememberAssets(
    items.value.filter((asset) => selected.value.has(asset.id)),
  );
  emit("submit", [...selected.value]);
}
</script>

<template>
  <AppModal
    open
    :title="title"
    :description="
      multiple
        ? $t('一次最多选择 100 项；只添加关联，不复制原文件。')
        : $t('选择一项相册内的资源作为封面，视频将使用缩略图。')
    "
    :busy="busy"
    @update:open="emit('close')"
  >
    <div class="p-5">
      <form
        v-if="workspace.can('asset:search')"
        class="mb-4 flex gap-2"
        @submit.prevent="submitted = searchText.trim()"
      >
        <el-input
          v-model="searchText"
          type="search"
          maxlength="200"
          :placeholder="$t('搜索文件名或标签')"
          :aria-label="$t('筛选可选媒体')"
          :disabled="busy"
        /><el-button
          text
          circle
          native-type="submit"
          :aria-label="$t('搜索')"
          :disabled="busy"
        >
          <Search />
        </el-button>
      </form>
      <AssetSortControl class="mb-4" :disabled="busy" />
      <DataState
        v-if="loading || loadError || !items.length"
        :loading="loading"
        :error="loadError"
        :title="$t('没有找到媒体')"
        :description="
          albumId
            ? $t('请先向相册添加资源，或换一个关键词。')
            : $t('先在图库上传图片，或换一个关键词。')
        "
        @retry="feed.reload"
      />
      <div v-else class="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto p-1">
        <button
          v-for="asset in items"
          :key="asset.id"
          type="button"
          class="relative aspect-square overflow-hidden rounded-lg border"
          :class="
            selected.has(asset.id)
              ? 'border-accent ring-1 ring-accent'
              : 'border-line'
          "
          :disabled="
            busy ||
            (multiple && selected.size >= 100 && !selected.has(asset.id))
          "
          :aria-label="$t('选择 {value1}', { value1: asset.name })"
          :aria-pressed="selected.has(asset.id)"
          @click="toggle(asset.id)"
        >
          <AssetImage
            :asset-id="asset.id"
            :name="asset.name"
            :version="asset.status"
          /><span
            v-if="selected.has(asset.id)"
            class="absolute top-1 right-1 rounded-full bg-accent p-1 text-ink"
            ><Check class="size-3" /></span
          ><span
            class="absolute inset-x-0 bottom-0 truncate bg-black/60 px-2 py-1 text-left text-[10px] text-white"
            >{{ asset.name }}</span
          >
        </button>
        <AssetLoadMore
          class="col-span-3"
          :count="items.length"
          :has-more="hasMore"
          :loading="loadingMore || refreshing"
          :disabled="busy"
          :error="moreError"
          @load="feed.loadMore"
        />
      </div>
      <p v-if="error" class="mt-3 text-xs leading-6 text-err" role="alert">
        {{ error }}
      </p>
      <div class="mt-5 flex items-center justify-between gap-3">
        <span class="text-xs text-soft">{{
          $t("已选择 {value1} 项", { value1: selected.size })
        }}</span
        ><el-button
          type="primary"
          :loading="busy"
          native-type="button"
          :disabled="busy || !selected.size"
          @click="submit"
          >{{ multiple ? $t("添加所选媒体") : $t("设为封面") }}</el-button
        >
      </div>
    </div>
  </AppModal>
</template>

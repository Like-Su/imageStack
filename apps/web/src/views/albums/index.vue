<script setup lang="ts">
import { i18n, translate } from "@/i18n";
import { computed, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import {
  FolderOpen,
  Plus,
  Pencil,
  Trash2,
  Sparkles,
  RefreshCw,
  Search,
} from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { useRemoteData } from "@/composables/useRemoteData";
import { updateAlbums } from "@/composables/workspaceUpdates";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Album } from "@/types/media";
import PageHeader from "@/components/workspace/PageHeader.vue";
import DataState from "@/components/workspace/DataState.vue";
import AssetImage from "@/components/media/AssetImage.vue";
import AlbumForm from "@/components/media/AlbumForm.vue";

const workspace = useWorkspaceStore();
const router = useRouter();
const {
  data: albums,
  loading,
  error,
  refresh,
} = useRemoteData(mediaApi.albums, [], {
  resources: ["albums"],
  update: updateAlbums,
});
const text = ref("");
const order = ref("recent");
const formOpen = ref(false);
const editing = ref<Album>();
const deleting = ref(false);
const filtered = computed(() => {
  const result = (albums.value ?? []).filter((album) =>
    `${album.name} ${album.description ?? ""}`
      .toLocaleLowerCase()
      .includes(text.value.trim().toLocaleLowerCase()),
  );
  return order.value === "name"
    ? result.sort((left, right) =>
        left.name.localeCompare(right.name, i18n.global.locale.value),
      )
    : order.value === "count"
      ? result.sort((left, right) => right.count - left.count)
      : result;
});
function edit(album?: Album) {
  editing.value = album;
  formOpen.value = true;
}
function saved(album: Album) {
  if (!editing.value)
    void router.push({ name: "album-detail", params: { id: album.id } });
}
async function remove(album: Album) {
  if (deleting.value) return;
  deleting.value = true;
  try {
    if (
      !(await workspace.confirm({
        title: translate("删除相册？"),
        message: translate(
          "删除「{value1}」及相册关联，图库中的原文件不会被删除。",
          { value1: album.name },
        ),
        confirmLabel: translate("删除相册"),
        danger: true,
      }))
    )
      return;
    await workspace.perform(
      () => mediaApi.deleteAlbum(album.id),
      translate("相册已删除，原图仍保留在图库"),
      () => workspace.deleteAlbum(album.id),
    );
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <section>
    <PageHeader
      :title="$t('相册')"
      :description="
        $t('{value1}把零散的瞬间，整理成完整的故事', {
          value1: albums
            ? $t('{value1} 个相册 · ', { value1: albums.length })
            : '',
        })
      "
      ><el-button
        text
        circle
        native-type="button"
        :aria-label="$t('刷新相册')"
        :disabled="loading"
        @click="refresh"
      >
        <RefreshCw :class="{ 'animate-spin': loading }" /></el-button
      ><el-button
        type="primary"
        native-type="button"
        :disabled="!workspace.can('asset:category')"
        @click="edit()"
      >
        <Plus />{{ $t("新建相册") }}</el-button
      ></PageHeader
    >
    <div class="space-y-5 px-4 sm:px-6">
      <div
        class="mh-gradient flex flex-wrap items-center gap-3 rounded-xl border border-line p-4"
      >
        <Sparkles class="size-5 text-ai" />
        <div class="min-w-0 flex-1">
          <h2 class="text-sm font-medium">
            {{ $t("让每一段回忆，都有自己的相册") }}
          </h2>
          <p class="mt-1 text-xs leading-5 text-soft">
            {{ $t("支持手动归档与自定义封面，AI 智能相册推荐尚未接入。") }}
          </p>
        </div>
        <el-button
          native-type="button"
          :disabled="!workspace.can('asset:category')"
          @click="edit()"
          >{{ $t("创建一个相册") }}</el-button
        >
      </div>
      <div class="flex gap-3">
        <label
          class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-panel2 px-3"
          ><Search class="size-4 shrink-0 text-faint" /><input
            v-model="text"
            type="search"
            class="h-10 w-full min-w-0 bg-transparent text-xs outline-none"
            :aria-label="$t('查找相册')"
            :placeholder="$t('查找相册…')" /></label
        ><el-select
          v-model="order"
          class="!w-40 shrink-0"
          :aria-label="$t('相册排序')"
        >
          <el-option :label="$t('最近创建')" value="recent"></el-option>
          <el-option :label="$t('名称排序')" value="name"></el-option>
          <el-option :label="$t('媒体数量')" value="count"></el-option>
        </el-select>
      </div>
      <DataState
        v-if="loading || error || !filtered.length"
        :loading="loading"
        :error="error"
        :icon="FolderOpen"
        :title="text ? $t('没有找到相册') : $t('从一个新相册开始')"
        :description="$t('按旅行、家人或创作主题整理你的照片。')"
        @retry="refresh"
        ><el-button
          type="primary"
          v-if="!text && workspace.can('asset:category')"
          native-type="button"
          @click="edit()"
        >
          <Plus />{{ $t("新建相册") }}</el-button
        ></DataState
      >
      <div
        v-else
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
      >
        <article
          v-for="album in filtered"
          :key="album.id"
          class="group overflow-hidden rounded-xl border border-line bg-panel"
        >
          <div class="relative">
            <RouterLink
              :to="{ name: 'album-detail', params: { id: album.id } }"
              class="relative block aspect-[4/3] overflow-hidden bg-panel2"
              ><AssetImage
                v-if="album.coverAssetId"
                :asset-id="album.coverAssetId"
                :name="album.name"
              /><span
                v-else
                class="mh-gradient absolute inset-0 grid place-items-center"
                ><FolderOpen class="size-12 text-ai/40" /></span
              ><span
                class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-4 pt-12 pb-4 text-white"
                ><span class="block truncate text-sm font-semibold">{{
                  album.name
                }}</span
                ><span class="mt-1 block text-[11px] text-white/65">{{
                  $t("{value1} 项媒体", { value1: album.count })
                }}</span></span
              ></RouterLink
            >
            <div
              v-if="workspace.can('asset:category')"
              class="absolute top-2 right-2 flex gap-1 rounded-lg bg-black/50 p-1 text-white/80"
            >
              <button
                type="button"
                class="rounded p-1.5 hover:bg-white/10"
                :aria-label="$t('编辑相册 {value1}', { value1: album.name })"
                @click="edit(album)"
              >
                <Pencil class="size-3.5" /></button
              ><button
                type="button"
                class="rounded p-1.5 hover:bg-white/10 hover:text-err"
                :aria-label="$t('删除相册 {value1}', { value1: album.name })"
                :disabled="deleting"
                @click="remove(album)"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>
          </div>
          <p
            v-if="album.description"
            class="line-clamp-2 px-4 py-3 text-xs leading-6 text-soft"
          >
            {{ album.description }}
          </p>
        </article>
      </div>
    </div>
    <AlbumForm
      v-if="formOpen"
      :album="editing"
      @close="formOpen = false"
      @saved="saved"
    />
  </section>
</template>

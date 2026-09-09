<script setup lang="ts">
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
} = useRemoteData(mediaApi.albums);
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
    ? result.sort((left, right) => left.name.localeCompare(right.name, "zh-CN"))
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
        title: "删除相册？",
        message: `删除「${album.name}」及相册关联，图库中的原文件不会被删除。`,
        confirmLabel: "删除相册",
        danger: true,
      }))
    )
      return;
    await workspace.perform(
      () => mediaApi.deleteAlbum(album.id),
      "相册已删除，原图仍保留在图库",
    );
  } finally {
    deleting.value = false;
  }
}
</script>

<template>
  <section>
    <PageHeader
      title="相册"
      :description="`${albums ? `${albums.length} 个相册 · ` : ''}把零散的瞬间，整理成完整的故事`"
      ><button
        type="button"
        class="mh-icon-button"
        aria-label="刷新相册"
        :disabled="loading"
        @click="refresh"
      >
        <RefreshCw :class="{ 'animate-spin': loading }" /></button
      ><button
        type="button"
        class="mh-button mh-button-primary"
        :disabled="!workspace.can('asset:category')"
        @click="edit()"
      >
        <Plus />新建相册
      </button></PageHeader
    >
    <div class="space-y-5 px-4 sm:px-6">
      <div
        class="mh-gradient flex flex-wrap items-center gap-3 rounded-xl border border-line p-4"
      >
        <Sparkles class="size-5 text-ai" />
        <div class="min-w-0 flex-1">
          <h2 class="text-sm font-medium">让每一段回忆，都有自己的相册</h2>
          <p class="mt-1 text-xs leading-5 text-soft">
            支持手动归档与自定义封面，AI 智能相册推荐尚未接入。
          </p>
        </div>
        <button
          type="button"
          class="mh-button"
          :disabled="!workspace.can('asset:category')"
          @click="edit()"
        >
          创建一个相册
        </button>
      </div>
      <div class="flex gap-3">
        <label
          class="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-line bg-panel2 px-3"
          ><Search class="size-4 shrink-0 text-faint" /><input
            v-model="text"
            type="search"
            class="h-10 w-full min-w-0 bg-transparent text-xs outline-none"
            aria-label="查找相册"
            placeholder="查找相册…" /></label
        ><select v-model="order" class="mh-input !w-auto" aria-label="相册排序">
          <option value="recent">最近创建</option>
          <option value="name">名称排序</option>
          <option value="count">媒体数量</option>
        </select>
      </div>
      <DataState
        v-if="loading || error || !filtered.length"
        :loading="loading"
        :error="error"
        :icon="FolderOpen"
        :title="text ? '没有找到相册' : '从一个新相册开始'"
        description="按旅行、家人或创作主题整理你的照片。"
        @retry="refresh"
        ><button
          v-if="!text && workspace.can('asset:category')"
          type="button"
          class="mh-button mh-button-primary"
          @click="edit()"
        >
          <Plus />新建相册
        </button></DataState
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
                ><span class="mt-1 block text-[11px] text-white/65"
                  >{{ album.count }} 项媒体</span
                ></span
              ></RouterLink
            >
            <div
              v-if="workspace.can('asset:category')"
              class="absolute top-2 right-2 flex gap-1 rounded-lg bg-black/50 p-1 text-white/80"
            >
              <button
                type="button"
                class="rounded p-1.5 hover:bg-white/10"
                :aria-label="`编辑相册 ${album.name}`"
                @click="edit(album)"
              >
                <Pencil class="size-3.5" /></button
              ><button
                type="button"
                class="rounded p-1.5 hover:bg-white/10 hover:text-err"
                :aria-label="`删除相册 ${album.name}`"
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

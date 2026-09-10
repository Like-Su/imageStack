<script setup lang="ts">
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { useRemoteData } from "@/composables/useRemoteData";
import { useWorkspaceStore } from "@/stores/workspace";
import PageHeader from "@/components/workspace/PageHeader.vue";
import DataState from "@/components/workspace/DataState.vue";
import AssetBrowser from "@/components/media/AssetBrowser.vue";
import AssetPicker from "@/components/media/AssetPicker.vue";
import AlbumForm from "@/components/media/AlbumForm.vue";
import ViewToggle from "@/components/media/ViewToggle.vue";

const route = useRoute();
const router = useRouter();
const workspace = useWorkspaceStore();
const albumId = computed(() => String(route.params.id ?? ""));
const {
  data: album,
  loading,
  error,
  refresh,
} = useRemoteData((signal) => mediaApi.album(albumId.value, signal), [albumId]);
const editing = ref(false);
const picking = ref(false);
const busy = ref(false);
const pickerError = ref("");

async function addAssets(ids: string[]) {
  if (busy.value) return;
  busy.value = true;
  pickerError.value = "";
  try {
    const result = await mediaApi.addToAlbum(albumId.value, ids);
    workspace.invalidate();
    workspace.notify(
      result.count ? `已添加 ${result.count} 项媒体` : "所选媒体已在此相册中",
    );
    picking.value = false;
  } catch (cause) {
    pickerError.value = getErrorMessage(cause);
  } finally {
    busy.value = false;
  }
}
async function remove() {
  if (!album.value || busy.value) return;
  const current = album.value;
  busy.value = true;
  try {
    if (
      !(await workspace.confirm({
        title: "删除相册？",
        message: `删除「${current.name}」及其关联，图库原文件将保留。`,
        confirmLabel: "删除相册",
        danger: true,
      }))
    )
      return;
    if (
      await workspace.perform(
        () => mediaApi.deleteAlbum(current.id),
        "相册已删除",
      )
    )
      await router.replace({ name: "albums" });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section>
    <PageHeader
      :title="album?.name ?? '相册详情'"
      :description="
        album
          ? `${album.count} 项媒体${album.description ? ` · ${album.description}` : ''}`
          : ''
      "
      ><template #eyebrow
        ><RouterLink
          :to="{ name: 'albums' }"
          class="mb-3 flex items-center gap-1 text-xs text-soft hover:text-accent"
          ><ArrowLeft class="size-3.5" />全部相册</RouterLink
        ></template
      ><ViewToggle /><template v-if="album && workspace.can('asset:category')"
        ><button
          type="button"
          class="mh-icon-button"
          aria-label="编辑相册"
          :disabled="busy"
          @click="editing = true"
        >
          <Pencil /></button
        ><button
          type="button"
          class="mh-icon-button !text-err"
          aria-label="删除相册"
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
          <Plus />添加媒体
        </button></template
      ></PageHeader
    >
    <DataState
      v-if="(loading && !album) || error"
      :loading="loading"
      :error="error"
      @retry="refresh"
    />
    <AssetBrowser
      v-else-if="album"
      :query="{ albumId }"
      empty-title="这个相册还没有照片"
      empty-description="点击「添加媒体」从图库选择照片，也可在图库多选后添加到相册。"
    />
    <AlbumForm
      v-if="editing && album"
      :album="album"
      @close="editing = false"
    />
    <AssetPicker
      v-if="picking"
      :title="`添加到 ${album?.name ?? '相册'}`"
      :busy="busy"
      :error="pickerError"
      @close="picking = false"
      @submit="addAssets"
    />
  </section>
</template>

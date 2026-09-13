<script setup lang="ts">
import { translate } from "@/i18n";
import { computed, onDeactivated, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import {
  ArrowLeft,
  Plus,
  Pencil,
  Trash2,
  Share2,
  Upload,
  Users,
} from "lucide-vue-next";
import { mediaApi } from "@/api/media";
import { getErrorMessage } from "@/api/request";
import { useRemoteData } from "@/composables/useRemoteData";
import { updateAlbumDetail } from "@/composables/workspaceUpdates";
import { useWorkspaceStore } from "@/stores/workspace";
import { useUploadsStore } from "@/stores/uploads";
import PageHeader from "@/components/workspace/PageHeader.vue";
import DataState from "@/components/workspace/DataState.vue";
import AssetBrowser from "@/components/media/AssetBrowser.vue";
import AssetPicker from "@/components/media/AssetPicker.vue";
import AlbumForm from "@/components/media/AlbumForm.vue";
import ViewToggle from "@/components/media/ViewToggle.vue";
import ShareDialog from "@/components/media/ShareDialog.vue";
import AlbumMembersDialog from "@/components/media/AlbumMembersDialog.vue";
import SharedAlbumBrowser from "@/components/media/SharedAlbumBrowser.vue";

const route = useRoute();
const router = useRouter();
const workspace = useWorkspaceStore();
const uploads = useUploadsStore();
const albumId = computed(() => String(route.params.id ?? ""));
const {
  data: album,
  loading,
  error,
  refresh,
} = useRemoteData(
  (signal) => mediaApi.album(albumId.value, signal),
  [albumId],
  {
    resources: ["albums"],
    update: updateAlbumDetail,
  },
);
const editing = ref(false);
const sharing = ref(false);
const managingMembers = ref(false);
const picking = ref(false);
const busy = ref(false);
const pickerError = ref("");
watch(
  album,
  (value) => {
    if (value) uploads.setAlbumAccess(value);
  },
  { immediate: true },
);
watch(error, (value) => {
  if (value) uploads.forgetAlbum(albumId.value);
});
watch(albumId, () => {
  sharing.value = false;
  editing.value = false;
  picking.value = false;
  managingMembers.value = false;
});
onDeactivated(() => {
  sharing.value = false;
  editing.value = false;
  picking.value = false;
  managingMembers.value = false;
});

async function addAssets(ids: string[]) {
  if (busy.value) return;
  busy.value = true;
  pickerError.value = "";
  try {
    const result = await mediaApi.addToAlbum(albumId.value, ids);
    workspace.updateAlbumMembers(result.album, ids, true);
    workspace.notify(
      result.count
        ? translate("已添加 {value1} 项媒体", { value1: result.count })
        : translate("所选媒体已在此相册中"),
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
        title: translate("删除相册？"),
        message: translate("删除「{value1}」及其关联，图库原文件将保留。", {
          value1: current.name,
        }),
        confirmLabel: translate("删除相册"),
        danger: true,
      }))
    )
      return;
    if (
      await workspace.perform(
        () => mediaApi.deleteAlbum(current.id),
        translate("相册已删除"),
        () => workspace.deleteAlbum(current.id),
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
      :title="album?.name ?? $t('相册详情')"
      :description="
        album
          ? $t('{value1} 项媒体{value2}', {
              value1: album.count,
              value2: album.description ? ` · ${album.description}` : '',
            })
          : ''
      "
      ><template #eyebrow
        ><RouterLink
          :to="{ name: 'albums' }"
          class="mb-3 flex items-center gap-1 text-xs text-soft hover:text-accent"
          ><ArrowLeft class="size-3.5" />{{ $t("全部相册") }}</RouterLink
        >
        <p
          v-if="album?.shared"
          class="mb-3 flex items-center gap-2 text-xs text-ai"
        >
          <Users class="size-3.5" />{{ $t("共享相册") }} ·
          {{ $t("创建者：{value1}", { value1: album.owner.username }) }}
        </p></template
      ><ViewToggle /><el-button
        v-if="album?.permissions.addAssets && uploads.canUpload(album.id)"
        type="primary"
        native-type="button"
        :icon="Upload"
        :disabled="busy"
        @click="uploads.chooseFiles(album.id)"
        >{{ $t("上传到相册") }}</el-button
      ><el-button
        v-if="album && !album.shared"
        :icon="Share2"
        :disabled="busy || !workspace.can('asset:share')"
        @click="sharing = true"
        >{{ $t("分享相册") }}</el-button
      ><el-button
        v-if="
          album?.permissions.manageMembers && workspace.can('asset:category')
        "
        :icon="Users"
        :disabled="busy"
        native-type="button"
        @click="managingMembers = true"
        >{{ $t("成员管理") }} ({{ album.memberCount }})</el-button
      ><template
        v-if="album && (album.shared || workspace.can('asset:category'))"
        ><el-button
          v-if="album.permissions.edit"
          text
          circle
          native-type="button"
          :aria-label="$t('编辑相册')"
          :disabled="busy"
          @click="editing = true"
        >
          <Pencil /></el-button
        ><el-button
          v-if="album.permissions.deleteAlbum"
          text
          circle
          native-type="button"
          class="!text-err"
          :aria-label="$t('删除相册')"
          :disabled="busy"
          @click="remove"
        >
          <Trash2 /></el-button
        ><el-button
          v-if="album.permissions.addAssets"
          native-type="button"
          :disabled="busy"
          @click="
            picking = true;
            pickerError = '';
          "
        >
          <Plus />{{ $t("添加媒体") }}</el-button
        ></template
      ></PageHeader
    >
    <DataState
      v-if="(loading && !album) || error"
      :loading="loading"
      :error="error"
      @retry="refresh"
    />
    <SharedAlbumBrowser
      v-else-if="album && album.shared"
      :key="album.id"
      :album="album"
      @refresh="refresh"
    />
    <AssetBrowser
      v-else-if="album"
      :query="{ albumId }"
      empty-title="这个相册还没有照片"
      :empty-description="
        $t('可直接上传到此相册，或点击「添加媒体」从图库选择。')
      "
    />
    <AlbumForm
      v-if="editing && album?.permissions.edit"
      :album="album"
      @close="editing = false"
    />
    <AssetPicker
      v-if="picking && album?.permissions.addAssets"
      :title="$t('添加到 {value1}', { value1: album?.name ?? $t('相册') })"
      :busy="busy"
      :error="pickerError"
      @close="picking = false"
      @submit="addAssets"
    />
    <ShareDialog
      v-if="sharing && album && !album.shared"
      :key="album.id"
      :target="{ kind: 'album', targetId: album.id }"
      :name="album.name"
      @close="sharing = false"
    />
    <AlbumMembersDialog
      v-if="managingMembers && album?.permissions.manageMembers"
      :key="album.id"
      :album="album"
      @close="managingMembers = false"
    />
  </section>
</template>

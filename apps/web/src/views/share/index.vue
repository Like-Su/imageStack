<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { Aperture, FolderDown, Images } from "lucide-vue-next";
import "@/assets/workspace.css";
import { ApiError, getErrorMessage } from "@/api/request";
import { sharesApi } from "@/api/shares";
import { formatBytes, formatDate } from "@/composables/mediaFormat";
import { useAuthStore } from "@/stores/auth";
import { useWorkspaceStore } from "@/stores/workspace";
import type { SharedImage, SharePage, ShareSaveResult } from "@/types/shares";
import LocaleSwitcher from "@/components/LocaleSwitcher.vue";
import AssetImage from "@/components/media/AssetImage.vue";
import SharedImageViewer from "@/components/media/SharedImageViewer.vue";
import DataState from "@/components/workspace/DataState.vue";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const workspace = useWorkspaceStore();
const token = computed(() => String(route.params.token ?? ""));
const page = ref<SharePage | null>(null);
const loading = ref(false);
const error = ref("");
const saveError = ref("");
const saving = ref(false);
const saved = ref<ShareSaveResult | null>(null);
const viewing = ref<SharedImage | null>(null);
let controller: AbortController | null = null;
let saveController: AbortController | null = null;

async function load(more = false) {
  if (more && (loading.value || !page.value?.nextCursor)) return;
  controller?.abort();
  const current = new AbortController();
  controller = current;
  const cursor = more ? (page.value?.nextCursor ?? undefined) : undefined;
  if (!more) page.value = null;
  loading.value = true;
  error.value = "";
  try {
    const response = await sharesApi.detail(
      token.value,
      cursor,
      current.signal,
    );
    if (current.signal.aborted) return;
    page.value = {
      ...response,
      items: more
        ? [
            ...(page.value?.items ?? []),
            ...response.items.filter(
              (item) =>
                !page.value?.items.some((existing) => existing.id === item.id),
            ),
          ]
        : response.items,
    };
  } catch (cause) {
    if (current.signal.aborted) return;
    error.value = getErrorMessage(cause);
    if (cause instanceof ApiError && cause.status === 404) page.value = null;
  } finally {
    if (controller === current) loading.value = false;
  }
}

async function save() {
  if (saving.value || !page.value?.total) return;
  if (!auth.isAuthenticated) {
    await router.push({ name: "login", query: { redirect: route.fullPath } });
    return;
  }
  const current = new AbortController();
  saveController = current;
  saving.value = true;
  saveError.value = "";
  try {
    const result = await sharesApi.save(token.value, current.signal);
    if (current.signal.aborted) return;
    saved.value = result;
    if (!result.alreadySaved) {
      workspace.invalidate(["assets", "places", "ai", "overview"], true);
      if (result.albumId) workspace.invalidate(["albums"], true);
    }
  } catch (cause) {
    if (!current.signal.aborted) saveError.value = getErrorMessage(cause);
  } finally {
    if (saveController === current) saving.value = false;
  }
}

function resetSave() {
  saveController?.abort();
  saveController = null;
  saving.value = false;
  saved.value = null;
  saveError.value = "";
}

watch(
  token,
  () => {
    resetSave();
    viewing.value = null;
    void load();
  },
  { immediate: true },
);
watch(() => auth.user?.id, resetSave);
onMounted(() => {
  void auth.initialize();
});
onBeforeUnmount(() => {
  controller?.abort();
  saveController?.abort();
});
</script>

<template>
  <main class="min-h-dvh bg-ink text-ghost">
    <header class="border-b border-line bg-panel">
      <div
        class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6"
      >
        <RouterLink
          :to="{ name: 'home' }"
          class="flex items-center gap-2 font-display font-bold"
          ><Aperture class="size-7 text-accent" />Media Hub</RouterLink
        >
        <div class="flex items-center gap-2">
          <LocaleSwitcher /><RouterLink
            v-if="auth.isAuthenticated"
            :to="{ name: 'home' }"
            class="mh-button"
            >{{ $t("我的图库") }}</RouterLink
          >
        </div>
      </div>
    </header>
    <section class="mx-auto max-w-6xl px-4 py-7 sm:px-6">
      <DataState
        v-if="!page"
        :loading="loading"
        :error="error"
        @retry="load()"
      />
      <template v-else>
        <div class="mb-6 flex flex-wrap items-start justify-between gap-5">
          <div class="min-w-0 flex-1">
            <p class="mb-2 text-xs text-accent">{{ $t("图片分享") }}</p>
            <h1 class="break-words text-2xl font-semibold">{{ page.title }}</h1>
            <p
              v-if="page.description"
              class="mt-2 whitespace-pre-line break-words text-sm text-soft"
            >
              {{ page.description }}
            </p>
            <p class="mt-3 text-xs text-faint">
              {{ $t("{value1} 张图片", { value1: page.total }) }} ·
              {{
                page.expiresAt
                  ? $t("有效期至 {value1}", {
                      value1: formatDate(page.expiresAt),
                    })
                  : $t("永久有效")
              }}
            </p>
          </div>
          <el-button
            type="primary"
            :loading="saving"
            :disabled="!page.total || Boolean(saved) || !auth.initialized"
            @click="save"
            ><FolderDown />{{
              saved
                ? $t("已保存")
                : auth.isAuthenticated
                  ? $t("保存到我的图库")
                  : $t("登录后保存")
            }}</el-button
          >
        </div>
        <el-alert
          type="info"
          :closable="false"
          class="mb-5"
          :title="
            $t(
              '保存会建立属于你的独立副本，不修改原作者内容。同一链接只保存一次；相册后续新增的图片不会自动同步。',
            )
          "
        />
        <el-alert
          v-if="saveError"
          :title="saveError"
          type="error"
          :closable="false"
          class="mb-5"
        />
        <div
          v-if="saved"
          class="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-ok/30 bg-ok/5 p-4"
          role="status"
        >
          <span class="text-sm">{{
            saved.alreadySaved
              ? $t("此分享已保存过，可在图库或回收站查找。")
              : $t("已保存 {value1} 张图片", { value1: saved.count })
          }}</span>
          <RouterLink
            :to="
              saved.albumId
                ? { name: 'album-detail', params: { id: saved.albumId } }
                : { name: 'home' }
            "
            class="mh-button ml-auto"
            >{{
              saved.albumId ? $t("查看已保存的相册") : $t("查看我的图库")
            }}</RouterLink
          >
        </div>
        <DataState
          v-if="!page.items.length"
          :icon="Images"
          :title="$t('暂无可分享的图片')"
          :description="$t('图片可能已被分享者移除。')"
        />
        <div
          v-else
          class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4"
        >
          <button
            v-for="image in page.items"
            :key="image.id"
            type="button"
            class="overflow-hidden rounded-xl border border-line bg-panel text-left transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-accent"
            :aria-label="$t('查看原图：{value1}', { value1: image.name })"
            @click="viewing = image"
          >
            <div class="aspect-square">
              <AssetImage
                :asset-id="image.id"
                :name="image.name"
                :share-token="token"
              />
            </div>
            <div class="p-3">
              <p class="truncate text-xs">{{ image.name }}</p>
              <p class="mt-1 text-[11px] text-faint">
                {{ formatBytes(image.size)
                }}<span v-if="image.width && image.height">
                  · {{ image.width }} × {{ image.height }}</span
                >
              </p>
            </div>
          </button>
        </div>
        <el-alert
          v-if="error"
          :title="error"
          type="error"
          :closable="false"
          class="mt-5"
        />
        <div v-if="page.nextCursor" class="mt-6 text-center">
          <el-button :loading="loading" @click="load(true)">{{
            $t("加载更多")
          }}</el-button>
        </div>
      </template>
    </section>
    <SharedImageViewer
      v-if="viewing"
      :token="token"
      :image="viewing"
      @close="viewing = null"
    />
  </main>
</template>

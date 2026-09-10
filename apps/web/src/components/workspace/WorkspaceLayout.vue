<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  RouterLink,
  RouterView,
  onBeforeRouteLeave,
  useRoute,
  useRouter,
} from "vue-router";
import { Menu, Sparkles, ListTodo, Upload, Command } from "lucide-vue-next";
import "@/assets/workspace.css";
import {
  UPLOAD_ACCEPT,
  UPLOAD_IMAGE_LABEL,
  UPLOAD_VIDEO_LABEL,
  UPLOAD_LIMITS_LABEL,
} from "@/config/workspace";
import { useAuthStore } from "@/stores/auth";
import { usePreferencesStore } from "@/stores/preferences";
import { useUploadsStore } from "@/stores/uploads";
import { useWorkspaceStore } from "@/stores/workspace";
import WorkspaceSidebar from "./WorkspaceSidebar.vue";
import WorkspaceFeedback from "./WorkspaceFeedback.vue";
import UploadPanel from "./UploadPanel.vue";
import AssetDetailDrawer from "@/components/media/AssetDetailDrawer.vue";

const auth = useAuthStore();
const workspace = useWorkspaceStore();
const uploads = useUploadsStore();
const preferences = usePreferencesStore();
const route = useRoute();
const router = useRouter();
const searchInput = ref<HTMLInputElement | null>(null);
const mobileNavigation = ref<HTMLDialogElement | null>(null);
const viewport = ref<HTMLElement | null>(null);
const searchText = ref(typeof route.query.q === "string" ? route.query.q : "");
const dragging = ref(false);
let dragDepth = 0;
let polling: number | undefined;

function search() {
  if (!workspace.can("asset:search")) return;
  const query = searchText.value.trim();
  void router.push({ name: "search", query: query ? { q: query } : {} });
}

function pickFiles(event: Event) {
  const input = event.target as HTMLInputElement;
  if (input.files) uploads.add(Array.from(input.files));
  input.value = "";
}

function keyboard(event: KeyboardEvent) {
  if (
    (event.ctrlKey || event.metaKey) &&
    event.key.toLowerCase() === "k" &&
    !document.querySelector("dialog[open]")
  ) {
    event.preventDefault();
    searchInput.value?.focus();
  }
}

function beforeUnload(event: BeforeUnloadEvent) {
  if (uploads.active) {
    event.preventDefault();
    event.returnValue = "";
  }
}

function dragEnter(event: DragEvent) {
  if (
    !event.dataTransfer?.types.includes("Files") ||
    !workspace.can("upload:create")
  )
    return;
  event.preventDefault();
  dragDepth += 1;
  dragging.value = true;
}

function dragLeave() {
  dragDepth = Math.max(0, dragDepth - 1);
  if (!dragDepth) dragging.value = false;
}
function drop(event: DragEvent) {
  event.preventDefault();
  dragDepth = 0;
  dragging.value = false;
  if (event.dataTransfer?.files)
    uploads.add(Array.from(event.dataTransfer.files));
}

watch(
  () => route.fullPath,
  () => {
    mobileNavigation.value?.close();
    workspace.selectedAsset = null;
    workspace.answerConfirmation(false);
    viewport.value?.scrollTo({ top: 0 });
    searchText.value = typeof route.query.q === "string" ? route.query.q : "";
  },
);
watch(
  () => preferences.values.animations,
  (enabled) => {
    document.documentElement.dataset.mediaMotion = enabled ? "full" : "reduced";
  },
  { immediate: true },
);

onBeforeRouteLeave(async (to) => {
  if (!to.meta.requiresAuth && auth.isAuthenticated && uploads.active) {
    return workspace.confirm({
      title: "离开媒体库？",
      message:
        "仍有上传未完成。离开会停止本机上传请求，服务器可能已经接收部分文件；返回后请先查看图库。",
      confirmLabel: "离开",
    });
  }
  return true;
});

onMounted(() => {
  void workspace.loadOverview();
  polling = window.setInterval(() => {
    if (
      preferences.values.autoRefresh &&
      document.visibilityState === "visible"
    )
      void workspace.loadOverview();
  }, 30_000);
  window.addEventListener("keydown", keyboard);
  window.addEventListener("beforeunload", beforeUnload);
});
onBeforeUnmount(() => {
  window.clearInterval(polling);
  window.removeEventListener("keydown", keyboard);
  window.removeEventListener("beforeunload", beforeUnload);
  mobileNavigation.value?.close();
  uploads.reset();
  workspace.reset();
});
</script>

<template>
  <div
    class="workspace-root"
    @dragenter="dragEnter"
    @dragover.prevent
    @dragleave="dragLeave"
    @drop="drop"
  >
    <a
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-lg focus:bg-accent focus:p-3 focus:text-ink"
      href="#workspace-content"
      >跳到主内容</a
    >
    <aside class="hidden md:flex"><WorkspaceSidebar /></aside>
    <dialog
      ref="mobileNavigation"
      class="mh-sidebar-dialog"
      aria-label="媒体库导航"
      @click.self="mobileNavigation?.close()"
    >
      <WorkspaceSidebar mobile @navigate="mobileNavigation?.close()" />
    </dialog>
    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="flex h-16 shrink-0 items-center gap-3 border-b border-line bg-panel/70 px-4 sm:px-6"
      >
        <button
          type="button"
          class="text-soft md:hidden"
          aria-label="打开导航"
          @click="mobileNavigation?.showModal()"
        >
          <Menu class="size-5" />
        </button>
        <form
          class="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-line bg-panel2 px-3 focus-within:border-ai/50 lg:max-w-2xl"
          role="search"
          @submit.prevent="search"
        >
          <Sparkles class="size-4 shrink-0 text-ai" aria-hidden="true" />
          <input
            ref="searchInput"
            v-model="searchText"
            type="search"
            maxlength="200"
            class="h-full min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
            aria-label="搜索文件名或标签"
            placeholder="搜索你的媒体，用关键词找到灵感…"
            :disabled="!workspace.can('asset:search')"
          />
          <kbd
            class="hidden items-center gap-0.5 rounded border border-line px-1.5 py-0.5 text-[10px] text-faint sm:flex"
            ><Command class="size-2.5" /> K</kbd
          >
          <button type="submit" class="sr-only">搜索</button>
        </form>
        <div class="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <RouterLink
            :to="{ name: 'tasks' }"
            class="relative hidden text-soft hover:text-ghost sm:block"
            aria-label="查看后台任务"
            ><ListTodo class="size-5" /><span
              v-if="workspace.pendingTasks"
              class="absolute -top-2 -right-2 min-w-3.5 rounded-full bg-accent px-1 text-center text-[9px] text-ink"
              >{{
                workspace.pendingTasks > 99 ? "99+" : workspace.pendingTasks
              }}</span
            ></RouterLink
          >
          <button
            v-if="uploads.entries.length"
            type="button"
            class="mh-icon-button"
            aria-label="显示上传队列"
            @click="uploads.open = !uploads.open"
          >
            <Upload /><span v-if="uploads.active" class="text-[10px]">{{
              uploads.active
            }}</span>
          </button>
          <button
            class="mh-button mh-button-primary"
            type="button"
            :disabled="!workspace.can('upload:create')"
            @click="uploads.chooseFiles"
          >
            <Upload /><span class="hidden sm:inline">上传文件</span>
          </button>
          <RouterLink
            :to="{ name: 'settings', hash: '#account' }"
            class="grid size-8 shrink-0 place-items-center rounded-full border border-line bg-gradient-to-br from-accent/25 to-ai/20 text-xs font-semibold"
            :aria-label="`账户与设置：${auth.user?.username ?? ''}`"
            >{{
              auth.user?.username?.slice(0, 1).toUpperCase() || "我"
            }}</RouterLink
          >
        </div>
      </header>
      <main
        id="workspace-content"
        ref="viewport"
        class="min-h-0 flex-1 overflow-x-hidden overflow-y-auto pb-8"
        tabindex="-1"
      >
        <RouterView v-slot="{ Component }"
          ><component :is="Component" :key="String(route.name)"
        /></RouterView>
      </main>
    </div>
    <input
      id="media-upload-input"
      type="file"
      class="hidden"
      :accept="UPLOAD_ACCEPT"
      multiple
      aria-label="选择上传图片或视频"
      @change="pickFiles"
    />
    <div
      v-if="dragging"
      class="pointer-events-none fixed inset-3 z-[60] flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-accent bg-ink/95"
    >
      <Upload class="size-12 text-accent" />
      <p class="text-xl font-semibold">松开鼠标，上传到图库</p>
      <p class="max-w-xl px-6 text-center text-sm leading-7 text-soft">
        {{ UPLOAD_IMAGE_LABEL }}<br />{{ UPLOAD_VIDEO_LABEL }} ·
        {{ UPLOAD_LIMITS_LABEL }}
      </p>
    </div>
    <AssetDetailDrawer />
    <UploadPanel />
    <WorkspaceFeedback />
  </div>
</template>

<style scoped>
.mh-sidebar-dialog {
  width: 248px;
  max-width: 100vw;
  height: 100dvh;
  max-height: 100dvh;
  margin: 0 auto 0 0;
  padding: 0;
  border: 0;
  background: var(--app-panel);
  color: var(--app-ghost);
}
.mh-sidebar-dialog::backdrop {
  background: rgb(0 0 0 / 60%);
}
</style>

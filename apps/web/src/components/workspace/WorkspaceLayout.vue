<script setup lang="ts">
import { translate } from "@/i18n";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { InputInstance } from "element-plus";
import {
  RouterLink,
  RouterView,
  onBeforeRouteLeave,
  useRoute,
  useRouter,
} from "vue-router";
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  ListTodo,
  Upload,
  Command,
} from "lucide-vue-next";
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
const searchInput = ref<InputInstance>();
const mobileNavigation = ref(false);
const desktopQuery = window.matchMedia("(min-width: 48rem)");
const desktopNavigation = ref(desktopQuery.matches);
const navigationLabel = computed(() =>
  translate(
    desktopNavigation.value
      ? preferences.values.sidebarCollapsed
        ? "展开侧边栏"
        : "折叠侧边栏"
      : mobileNavigation.value
        ? "关闭导航"
        : "打开导航",
  ),
);
const searchText = ref(typeof route.query.q === "string" ? route.query.q : "");
const dragging = ref(false);
let dragDepth = 0;
let polling: number | undefined;

function syncNavigation() {
  desktopNavigation.value = desktopQuery.matches;
  if (desktopNavigation.value) mobileNavigation.value = false;
}

function toggleNavigation() {
  if (desktopNavigation.value)
    preferences.values.sidebarCollapsed = !preferences.values.sidebarCollapsed;
  else mobileNavigation.value = !mobileNavigation.value;
}

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
    !Array.from(
      document.querySelectorAll(
        "dialog[open], [role='dialog'][aria-modal='true']",
      ),
    ).some((dialog) => dialog.getClientRects().length)
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
  if (dragDepth === 0) dragging.value = false;
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
    mobileNavigation.value = false;
    workspace.selectedAsset = null;
    workspace.answerConfirmation(false);
    document.getElementById("workspace-content")?.scrollTo({ top: 0 });
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
      title: translate("离开媒体库？"),
      message: translate(
        "仍有上传未完成。离开会停止本机上传请求，服务器可能已经接收部分文件；返回后请先查看图库。",
      ),
      confirmLabel: translate("离开"),
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
  desktopQuery.addEventListener("change", syncNavigation);
});
onBeforeUnmount(() => {
  window.clearInterval(polling);
  window.removeEventListener("keydown", keyboard);
  window.removeEventListener("beforeunload", beforeUnload);
  desktopQuery.removeEventListener("change", syncNavigation);
  uploads.reset();
  workspace.reset();
});
</script>

<template>
  <el-container
    class="workspace-root"
    direction="horizontal"
    @dragenter="dragEnter"
    @dragover.prevent
    @dragleave="dragLeave"
    @drop="drop"
  >
    <a
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[70] focus:rounded-lg focus:bg-accent focus:p-3 focus:text-ink"
      href="#workspace-content"
      >{{ $t("跳到主内容") }}</a
    >
    <el-aside
      id="workspace-sidebar"
      class="hidden md:block"
      :width="preferences.values.sidebarCollapsed ? '64px' : '248px'"
    >
      <WorkspaceSidebar :collapsed="preferences.values.sidebarCollapsed" />
    </el-aside>
    <el-drawer
      id="workspace-mobile-navigation"
      v-model="mobileNavigation"
      :title="$t('媒体库导航')"
      direction="ltr"
      size="min(248px, 100vw)"
      :with-header="false"
      body-class="!p-0"
      append-to-body
      destroy-on-close
    >
      <WorkspaceSidebar mobile @navigate="mobileNavigation = false" />
    </el-drawer>
    <el-container direction="vertical" class="min-w-0">
      <el-header
        height="64px"
        class="flex items-center gap-3 border-b border-line bg-panel/70 !px-4 sm:!px-6"
      >
        <el-button
          text
          circle
          native-type="button"
          :title="navigationLabel"
          :aria-label="navigationLabel"
          :aria-expanded="
            desktopNavigation
              ? !preferences.values.sidebarCollapsed
              : mobileNavigation
          "
          :aria-controls="
            desktopNavigation
              ? 'workspace-sidebar'
              : 'workspace-mobile-navigation'
          "
          @click="toggleNavigation"
        >
          <component
            :is="
              desktopNavigation
                ? preferences.values.sidebarCollapsed
                  ? PanelLeftOpen
                  : PanelLeftClose
                : Menu
            "
          />
        </el-button>
        <form
          class="min-w-0 flex-1 lg:max-w-2xl"
          role="search"
          @submit.prevent="search"
        >
          <el-input
            ref="searchInput"
            v-model="searchText"
            type="search"
            :maxlength="200"
            class="workspace-search"
            :aria-label="$t('搜索文件名或标签')"
            :placeholder="$t('搜索你的媒体，用关键词找到灵感…')"
            :disabled="!workspace.can('asset:search')"
          >
            <template #prefix
              ><Sparkles class="size-4 text-ai" aria-hidden="true"
            /></template>
            <template #suffix>
              <kbd
                class="hidden items-center gap-0.5 text-[10px] text-faint sm:flex"
                ><Command class="size-2.5" /> K</kbd
              >
            </template>
          </el-input>
          <button type="submit" class="sr-only">{{ $t("搜索") }}</button>
        </form>
        <div class="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <RouterLink
            :to="{ name: 'tasks' }"
            class="relative hidden text-soft hover:text-ghost sm:block"
            :aria-label="$t('查看后台任务')"
            ><el-badge
              :value="workspace.pendingTasks"
              :hidden="!workspace.pendingTasks"
              :max="99"
              type="primary"
            >
              <ListTodo class="size-5" /> </el-badge
          ></RouterLink>
          <el-button
            text
            circle
            v-if="uploads.entries.length"
            native-type="button"
            :aria-label="$t('显示上传队列')"
            @click="uploads.open = !uploads.open"
          >
            <Upload /><span v-if="uploads.active" class="text-[10px]">{{
              uploads.active
            }}</span>
          </el-button>
          <el-button
            type="primary"
            native-type="button"
            :disabled="!workspace.can('upload:create')"
            @click="uploads.chooseFiles"
          >
            <Upload /><span class="hidden sm:inline">{{ $t("上传文件") }}</span>
          </el-button>
          <RouterLink
            :to="{ name: 'settings', hash: '#account' }"
            class="shrink-0"
            :aria-label="
              $t('账户与设置：{value1}', { value1: auth.user?.username ?? '' })
            "
            ><el-avatar
              :size="32"
              class="border border-line bg-linear-to-br from-accent/25 to-ai/20 !text-xs !text-ghost"
              >{{
                auth.user?.username?.slice(0, 1).toUpperCase() || $t("我")
              }}</el-avatar
            ></RouterLink
          >
        </div>
      </el-header>
      <el-main
        id="workspace-content"
        class="min-h-0 !overflow-x-hidden !p-0 !pb-8"
        tabindex="-1"
      >
        <RouterView v-slot="{ Component }">
          <keep-alive>
            <component :is="Component" :key="String(route.name)" />
          </keep-alive>
        </RouterView>
      </el-main>
    </el-container>
    <input
      id="media-upload-input"
      type="file"
      class="hidden"
      :accept="UPLOAD_ACCEPT"
      multiple
      :aria-label="$t('选择上传图片或视频')"
      @change="pickFiles"
    />
    <div
      v-if="dragging"
      class="pointer-events-none fixed inset-3 z-[60] flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-accent bg-ink/95"
    >
      <Upload class="size-12 text-accent" />
      <p class="text-xl font-semibold">{{ $t("松开鼠标，上传到图库") }}</p>
      <p class="max-w-xl px-6 text-center text-sm leading-7 text-soft">
        {{ $t(UPLOAD_IMAGE_LABEL) }}<br />{{ UPLOAD_VIDEO_LABEL }} ·
        {{ $t(UPLOAD_LIMITS_LABEL) }}
      </p>
    </div>
    <AssetDetailDrawer />
    <UploadPanel />
    <WorkspaceFeedback />
  </el-container>
</template>

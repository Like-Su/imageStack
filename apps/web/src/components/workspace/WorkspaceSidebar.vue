<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRoute } from "vue-router";
import { Aperture, HardDrive, X } from "lucide-vue-next";
import { navigation } from "@/config/workspace";
import { useWorkspaceStore } from "@/stores/workspace";
import { useAuthStore } from "@/stores/auth";
import { formatBytes } from "@/composables/mediaFormat";

defineProps<{ mobile?: boolean; collapsed?: boolean }>();
const emit = defineEmits<{ navigate: [] }>();
const route = useRoute();
const workspace = useWorkspaceStore();
const auth = useAuthStore();
const visibleNavigation = computed(() =>
  navigation.filter(
    (group) => !("adminOnly" in group) || auth.user?.roleCode === "ROLE_ADMIN",
  ),
);
const selected = computed(() =>
  String(route.meta.section ?? route.name ?? "home"),
);
const totalBytes = computed(
  () =>
    Number(workspace.overview?.bytes ?? 0) +
    Number(workspace.overview?.trashBytes ?? 0),
);
const activeRatio = computed(() =>
  totalBytes.value
    ? (Number(workspace.overview?.bytes ?? 0) / totalBytes.value) * 100
    : 0,
);

function activateMenuItem(event: KeyboardEvent) {
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.click();
}
</script>

<template>
  <div class="workspace-sidebar h-full">
    <div
      class="flex h-16 shrink-0 items-center gap-2.5 border-b border-line"
      :class="collapsed ? 'justify-center' : 'px-5'"
    >
      <RouterLink
        :to="{ name: 'home' }"
        class="flex items-center gap-2.5"
        :aria-label="$t('Media Hub 图库')"
        @click="emit('navigate')"
      >
        <span
          class="grid size-9 place-items-center rounded-xl bg-accent text-[#0d0f12] shadow-[0_6px_20px_-6px_rgba(255,106,69,.7)]"
          ><Aperture class="size-5"
        /></span>
        <span v-if="!collapsed" class="leading-tight"
          ><span class="block font-display text-[15px] font-bold tracking-tight"
            >Media Hub</span
          ><span class="block text-[10px] text-faint"
            >Local · AI · Private</span
          ></span
        >
      </RouterLink>
      <el-button
        v-if="mobile"
        text
        circle
        native-type="button"
        class="ml-auto"
        :aria-label="$t('关闭导航')"
        @click="emit('navigate')"
      >
        <X class="size-4" />
      </el-button>
    </div>
    <nav
      class="min-h-0 flex-1 overflow-y-auto py-3"
      :aria-label="$t('媒体库导航')"
    >
      <el-menu
        class="workspace-menu"
        router
        :default-active="selected"
        :collapse="collapsed"
        :collapse-transition="false"
        popper-effect="light"
        @select="emit('navigate')"
      >
        <el-menu-item-group
          v-for="group in visibleNavigation"
          :key="group.label"
          :title="$t(group.label)"
        >
          <el-menu-item
            v-for="item in group.items"
            :key="item.name"
            :index="item.name"
            :route="{ name: item.name }"
            :aria-label="$t(item.label)"
            :aria-current="selected === item.name ? 'page' : undefined"
            tabindex="0"
            @keydown.enter.prevent="activateMenuItem"
            @keydown.space.prevent="activateMenuItem"
          >
            <el-icon :class="{ 'text-ai': item.name === 'search' }">
              <component :is="item.icon" aria-hidden="true" />
            </el-icon>
            <template #title>
              <span class="flex flex-1 items-center justify-between gap-3">
                <span>{{ $t(item.label) }}</span>
                <span
                  v-if="'count' in item && workspace.overview"
                  class="text-[10px] tabular-nums text-faint"
                  >{{ workspace.overview[item.count].toLocaleString() }}</span
                >
                <el-badge
                  v-else-if="item.name === 'tasks' && workspace.pendingTasks"
                  :value="workspace.pendingTasks"
                  :max="99"
                  type="primary"
                />
              </span>
            </template>
          </el-menu-item>
        </el-menu-item-group>
      </el-menu>
    </nav>
    <div v-if="!collapsed" class="shrink-0 border-t border-line p-3">
      <div class="rounded-xl bg-panel2 p-3">
        <div class="flex items-center justify-between text-[11px] text-soft">
          <span class="flex items-center gap-1.5"
            ><HardDrive class="size-3.5" />{{ $t("原图存储") }}</span
          ><span class="text-ghost">{{
            workspace.overview ? formatBytes(totalBytes) : "—"
          }}</span>
        </div>
        <el-progress
          class="mt-2"
          :percentage="activeRatio"
          :stroke-width="6"
          :show-text="false"
          color="var(--app-accent)"
          aria-hidden="true"
        />
        <p class="mt-2 text-[10px] leading-5 text-faint">
          {{ $t("当前账户 · 图库与回收站") }}<br />{{
            $t("不含缩略图，不代表磁盘总容量")
          }}
        </p>
        <el-button
          v-if="workspace.overviewError"
          link
          type="danger"
          size="small"
          native-type="button"
          :title="workspace.overviewError"
          @click="workspace.loadOverview(true)"
        >
          {{ $t("统计获取失败，点击重试") }}
        </el-button>
      </div>
    </div>
  </div>
</template>

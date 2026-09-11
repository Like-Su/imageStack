<script setup lang="ts">
import { Puzzle, ShieldCheck, Sparkles } from "lucide-vue-next";
import { RouterView } from "vue-router";
import AuthBrand from "./AuthBrand.vue";
import LocaleSwitcher from "@/components/LocaleSwitcher.vue";

const columns = [
  {
    animation: "auth-drift 28s linear infinite",
    photos: [
      [21, 500],
      [33, 300],
      [45, 460],
    ],
  },
  {
    animation: "auth-drift-reverse 32s linear infinite",
    photos: [
      [57, 340],
      [69, 500],
      [81, 380],
    ],
  },
  {
    animation: "auth-drift 24s linear infinite",
    photos: [
      [93, 440],
      [105, 300],
      [117, 480],
    ],
  },
];
</script>

<template>
  <div
    class="grid min-h-svh bg-ink text-ghost lg:h-dvh lg:min-h-0 lg:grid-cols-[1.1fr_1fr]"
  >
    <aside
      class="relative hidden overflow-hidden lg:block"
      :aria-label="$t('Media Hub 产品介绍')"
    >
      <div
        class="absolute inset-0 grid grid-cols-3 gap-2 p-2 opacity-40"
        aria-hidden="true"
      >
        <div
          v-for="column in columns"
          :key="column.animation"
          class="auth-showcase-column space-y-2"
          :style="{ animation: column.animation }"
        >
          <img
            v-for="[seed, height] in column.photos"
            :key="seed"
            :src="`https://picsum.photos/seed/mh${seed}/400/${height}`"
            :height="height"
            width="400"
            alt=""
            loading="lazy"
            referrerpolicy="no-referrer"
            class="w-full rounded-xl bg-panel3 object-cover"
          />
        </div>
      </div>
      <div
        class="absolute inset-0 bg-linear-to-t from-ink via-ink/85 to-ink/55"
      ></div>
      <div
        class="absolute inset-0 bg-linear-to-r from-transparent to-ink"
      ></div>
      <div
        class="relative z-10 flex h-full flex-col justify-between gap-12 p-12"
      >
        <AuthBrand />
        <div>
          <h2
            class="text-balance font-display text-4xl font-bold leading-tight tracking-tight"
          >
            {{ $t("你的媒体，") }}<br />{{ $t("只属于你自己。") }}
          </h2>
          <p
            class="mt-4 max-w-md text-pretty text-[15px] leading-relaxed text-soft"
          >
            {{
              $t(
                "本地部署、AI 驱动、完全离线。用自然语言找到任何一张照片，所有推理都在你自己的设备上完成——数据永不出门。",
              )
            }}
          </p>
          <div class="mt-8 flex flex-wrap gap-2.5 text-[12.5px] text-soft">
            <span
              class="flex items-center gap-1.5 rounded-full border border-line bg-panel2/60 px-3 py-1.5 backdrop-blur"
            >
              <ShieldCheck class="size-3.5 text-ok" aria-hidden="true" />{{
                $t("100% 离线")
              }}</span
            >
            <span
              class="flex items-center gap-1.5 rounded-full border border-line bg-panel2/60 px-3 py-1.5 backdrop-blur"
            >
              <Sparkles class="size-3.5 text-ai" aria-hidden="true" />{{
                $t("本地 AI 推理")
              }}</span
            >
            <span
              class="flex items-center gap-1.5 rounded-full border border-line bg-panel2/60 px-3 py-1.5 backdrop-blur"
            >
              <Puzzle class="size-3.5 text-accent" aria-hidden="true" />{{
                $t("插件化扩展")
              }}</span
            >
          </div>
        </div>
        <p class="text-xs text-faint">
          © 2026 Local AI Media Hub · Self-hosted
        </p>
      </div>
    </aside>

    <main
      class="flex min-h-svh flex-col overflow-y-auto px-6 py-10 sm:px-10 lg:min-h-0"
    >
      <div class="mb-5 flex justify-end"><LocaleSwitcher /></div>
      <div class="mx-auto my-auto w-full max-w-[380px] shrink-0">
        <AuthBrand class="mb-8 lg:hidden" />
        <RouterView v-slot="{ Component, route }">
          <component :is="Component" :key="route.path" class="auth-in" />
        </RouterView>
      </div>
    </main>
  </div>
</template>

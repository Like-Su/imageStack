<script setup lang="ts">
import {
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  ref,
  watch,
} from "vue";
import { LoaderCircle } from "lucide-vue-next";

const props = withDefaults(
  defineProps<{
    count: number;
    hasMore: boolean;
    loading?: boolean;
    disabled?: boolean;
    error?: string;
  }>(),
  { loading: false, disabled: false, error: "" },
);
const emit = defineEmits<{ load: [] }>();
const sentinel = ref<HTMLElement | null>(null);
let active = true;
let mounted = false;
let observer: IntersectionObserver | null = null;
let scrollRoot: HTMLElement | null = null;
let fallbackTarget: HTMLElement | Window | null = null;
let frame: number | null = null;

function check() {
  frame = null;
  const element = sentinel.value;
  if (
    !active ||
    !element ||
    !props.hasMore ||
    props.loading ||
    props.disabled ||
    props.error
  )
    return;
  if (!element.getClientRects().length) return;
  const bounds = element.getBoundingClientRect();
  const rootBounds = scrollRoot?.getBoundingClientRect();
  const top = rootBounds?.top ?? 0;
  const bottom = rootBounds?.bottom ?? window.innerHeight;
  if (bottom > top && bounds.top <= bottom + 400 && bounds.bottom >= top)
    emit("load");
}

function schedule() {
  if (!active || !mounted || frame !== null) return;
  frame = window.requestAnimationFrame(check);
}

function disconnect() {
  observer?.disconnect();
  observer = null;
  fallbackTarget?.removeEventListener("scroll", schedule);
  fallbackTarget = null;
  window.removeEventListener("resize", schedule);
  if (frame !== null) window.cancelAnimationFrame(frame);
  frame = null;
}

function connect() {
  if (!mounted || !active || !sentinel.value) return;
  disconnect();
  scrollRoot = null;
  for (
    let parent = sentinel.value.parentElement;
    parent;
    parent = parent.parentElement
  ) {
    if (
      /(auto|scroll|overlay)/.test(window.getComputedStyle(parent).overflowY)
    ) {
      scrollRoot = parent;
      break;
    }
  }
  if ("IntersectionObserver" in window) {
    observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) schedule();
      },
      { root: scrollRoot, rootMargin: "0px 0px 400px 0px" },
    );
    observer.observe(sentinel.value);
  } else {
    fallbackTarget = scrollRoot ?? window;
    fallbackTarget.addEventListener("scroll", schedule, { passive: true });
  }
  window.addEventListener("resize", schedule, { passive: true });
  schedule();
}

watch(
  () => [
    props.count,
    props.hasMore,
    props.loading,
    props.disabled,
    props.error,
  ],
  schedule,
  { flush: "post" },
);
onMounted(() => {
  mounted = true;
  connect();
});
onActivated(() => {
  active = true;
  connect();
});
onDeactivated(() => {
  active = false;
  disconnect();
});
onScopeDispose(() => {
  active = false;
  disconnect();
});
</script>

<template>
  <div
    ref="sentinel"
    class="mt-5 flex flex-col items-center gap-3 py-2"
    :aria-busy="loading"
    data-asset-load-more
  >
    <p v-if="error" class="text-xs text-err" role="alert">{{ error }}</p>
    <el-button
      v-if="hasMore && error"
      native-type="button"
      :loading="loading"
      :disabled="loading || disabled"
      @click="emit('load')"
      >{{ $t("重试加载更多") }}</el-button
    >
    <p
      v-else-if="hasMore"
      class="flex items-center gap-2 text-xs text-soft"
      role="status"
      aria-live="polite"
    >
      <LoaderCircle v-if="loading" class="size-4 animate-spin" />
      {{ loading ? $t("正在加载更多资源…") : $t("继续向下滚动自动加载") }}
    </p>
    <span class="text-[11px] text-faint">{{
      $t("已显示 {value1} 项{value2}", {
        value1: count,
        value2: hasMore ? "" : $t(" · 已加载全部"),
      })
    }}</span>
  </div>
</template>

<script setup lang="ts">
import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
} from "vue";
import { RecycleScroller } from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
import type { AssetSummary } from "@/types/media";

const props = defineProps<{
  items: AssetSummary[];
  grid?: boolean;
  dense?: boolean;
}>();
defineSlots<{
  default(props: { asset: AssetSummary; active: boolean }): unknown;
}>();
const host = ref<HTMLElement | null>(null);
const scrollParent = shallowRef<HTMLElement>();
const width = ref(0);
const enabled = ref(true);
let observer: ResizeObserver | null = null;
let layoutWidth = -1;
let layoutGrid: boolean | undefined;
let layoutColumns = 0;
let layoutItems: Pick<AssetSummary, "id" | "width" | "height">[] = [];
const columnCount = computed(() =>
  props.grid
    ? Math.max(
        2,
        Math.min(
          props.dense ? 6 : 5,
          Math.floor((width.value + 12) / (props.dense ? 170 : 230)),
        ),
      )
    : 1,
);
const columns = computed<{ id: string; index: number; height: number }[][]>(
  (previous) => {
    const count = columnCount.value;
    if (
      previous &&
      layoutWidth === width.value &&
      layoutGrid === props.grid &&
      layoutColumns === count &&
      layoutItems.length === props.items.length &&
      props.items.every((asset, index) => {
        const before = layoutItems[index]!;
        return (
          asset.id === before.id &&
          asset.width === before.width &&
          asset.height === before.height
        );
      })
    )
      return previous;
    layoutWidth = width.value;
    layoutGrid = props.grid;
    layoutColumns = count;
    layoutItems = props.items.map(({ id, width, height }) => ({
      id,
      width,
      height,
    }));
    const columnWidth = Math.max(1, (width.value - (count - 1) * 12) / count);
    const heights = Array<number>(count).fill(0);
    const result = Array.from(
      { length: count },
      () => [] as { id: string; index: number; height: number }[],
    );
    for (let index = 0; index < props.items.length; index += 1) {
      const asset = props.items[index]!;
      const column = heights.indexOf(Math.min(...heights));
      const ratio =
        asset.width && asset.height
          ? Math.max(0.6, Math.min(1.85, asset.width / asset.height))
          : 1.2;
      const height = props.grid
        ? Math.ceil(Math.max(1, columnWidth - 2) / ratio) + 14
        : 73;
      result[column]!.push({ id: asset.id, index, height });
      heights[column]! += height;
    }
    return result;
  },
);

onMounted(() => {
  scrollParent.value =
    document.getElementById("workspace-content") ?? undefined;
  if (!host.value) return;
  width.value = host.value.getBoundingClientRect().width;
  observer = new ResizeObserver(([entry]) => {
    if (entry && entry.contentRect.width > 0)
      width.value = entry.contentRect.width;
  });
  observer.observe(host.value);
});
onActivated(() => {
  enabled.value = true;
});
onDeactivated(() => {
  enabled.value = false;
});
onScopeDispose(() => observer?.disconnect());
</script>

<template>
  <div
    ref="host"
    class="grid items-start gap-3"
    :style="{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }"
  >
    <RecycleScroller
      v-for="(column, columnIndex) in columns"
      :key="columnIndex"
      :items="column"
      :item-size="grid ? null : 73"
      :min-item-size="73"
      size-field="height"
      key-field="id"
      page-mode
      :scroll-parent="scrollParent"
      :buffer="400"
      :prerender="2"
      :enabled="enabled"
      v-slot="{ item, active }"
    >
      <div :style="{ height: `${item.height}px` }">
        <slot
          v-if="items[item.index]"
          :asset="items[item.index]!"
          :active="active"
        />
      </div>
    </RecycleScroller>
  </div>
</template>

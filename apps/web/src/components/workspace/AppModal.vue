<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from "vue";
import { X } from "lucide-vue-next";

const props = defineProps<{
  open: boolean;
  title: string;
  description?: string;
  busy?: boolean;
  drawer?: boolean;
}>();
const emit = defineEmits<{ "update:open": [open: boolean] }>();
const dialog = ref<HTMLDialogElement | null>(null);
const titleId = useId();
const descriptionId = useId();

watch(
  () => props.open,
  async (open) => {
    await nextTick();
    if (!dialog.value?.isConnected) return;
    if (open && !dialog.value.open) dialog.value.showModal();
    else if (!open && dialog.value.open) dialog.value.close();
  },
  { immediate: true, flush: "post" },
);

function close() {
  if (!props.busy) emit("update:open", false);
}
function backdrop(event: MouseEvent) {
  const element = dialog.value;
  if (!element || event.target !== element) return;
  const bounds = element.getBoundingClientRect();
  if (
    event.clientX < bounds.left ||
    event.clientX > bounds.right ||
    event.clientY < bounds.top ||
    event.clientY > bounds.bottom
  )
    close();
}
function closed() {
  if (props.open && !dialog.value?.open) emit("update:open", false);
}
onBeforeUnmount(() => dialog.value?.close());
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialog"
      class="mh-modal"
      :class="{ 'mh-drawer': drawer }"
      :aria-labelledby="titleId"
      :aria-describedby="description ? descriptionId : undefined"
      @cancel.prevent="close"
      @close="closed"
      @click="backdrop"
    >
      <header
        class="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-line bg-panel p-5"
      >
        <div>
          <h2 :id="titleId" class="text-base font-semibold">{{ title }}</h2>
          <p
            v-if="description"
            :id="descriptionId"
            class="mt-1 text-xs leading-5 text-soft"
          >
            {{ description }}
          </p>
        </div>
        <button
          class="mh-icon-button -mt-1 -mr-1"
          type="button"
          aria-label="关闭对话框"
          :disabled="busy"
          @click="close"
        >
          <X />
        </button>
      </header>
      <slot />
    </dialog>
  </Teleport>
</template>

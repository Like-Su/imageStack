<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { sharesApi } from "@/api/shares";
import { getErrorMessage } from "@/api/request";
import type { SharedImage } from "@/types/shares";
import DataState from "@/components/workspace/DataState.vue";
import LoadingImage from "./LoadingImage.vue";

const props = defineProps<{ token: string; image: SharedImage }>();
const emit = defineEmits<{ close: [] }>();
const source = ref("");
const loading = ref(false);
const error = ref("");
let controller: AbortController | null = null;

function clear() {
  controller?.abort();
  if (source.value) URL.revokeObjectURL(source.value);
  source.value = "";
}

async function load() {
  clear();
  const current = new AbortController();
  controller = current;
  loading.value = true;
  error.value = "";
  try {
    const blob = await sharesApi.original(
      props.token,
      props.image.id,
      current.signal,
    );
    if (!current.signal.aborted) source.value = URL.createObjectURL(blob);
  } catch (cause) {
    if (!current.signal.aborted) error.value = getErrorMessage(cause);
  } finally {
    if (controller === current) loading.value = false;
  }
}

watch([() => props.token, () => props.image.id], load, { immediate: true });
onBeforeUnmount(clear);
</script>

<template>
  <el-dialog
    :model-value="true"
    :title="image.name"
    width="min(1100px, calc(100vw - 32px))"
    append-to-body
    @update:model-value="!$event && emit('close')"
  >
    <DataState
      v-if="loading || error"
      :loading="loading"
      :error="error"
      @retry="load"
    />
    <div v-else-if="source" class="h-[75dvh]">
      <LoadingImage
        :src="source"
        :alt="image.name"
        contain
        @error="error = $t('浏览器无法显示此原图，仍可保存到你的图库。')"
      />
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { LoaderCircle, RefreshCw, ShieldCheck } from "lucide-vue-next";
import AuthField from "./AuthField.vue";

defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    id: string;
    image: string;
    loading: boolean;
    error?: string;
    loadError?: string;
    disabled?: boolean;
  }>(),
  { error: "", loadError: "", disabled: false },
);

const value = defineModel<string>({ required: true });
const emit = defineEmits<{ refresh: [] }>();
</script>

<template>
  <AuthField
    v-bind="$attrs"
    :id="id"
    v-model="value"
    label="图形验证码"
    :icon="ShieldCheck"
    :error="error || loadError"
    :disabled="disabled || loading || !image"
    placeholder="输入验证码"
    autocomplete="off"
    autocapitalize="off"
    :spellcheck="false"
    maxlength="4"
    required
  >
    <template #label-action>
      <button
        type="button"
        class="auth-link flex items-center gap-1 text-xs"
        :disabled="disabled || loading"
        @click="emit('refresh')"
      >
        <RefreshCw class="size-3" aria-hidden="true" />换一张
      </button>
    </template>
    <template #suffix>
      <button
        type="button"
        :disabled="disabled || loading"
        :aria-label="loading ? '正在加载验证码' : '刷新图形验证码'"
        class="-mr-2 flex h-9 w-[108px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white text-xs text-slate-600"
        @click="emit('refresh')"
      >
        <LoaderCircle
          v-if="loading"
          class="size-4 animate-spin"
          aria-hidden="true"
        />
        <img
          v-else-if="image"
          :src="image"
          alt="图形验证码，点击换一张"
          class="h-full w-full object-contain"
        />
        <span v-else>点击重试</span>
      </button>
    </template>
  </AuthField>
</template>

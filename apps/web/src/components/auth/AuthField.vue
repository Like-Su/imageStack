<script setup lang="ts">
import type { Component } from "vue";

defineOptions({ inheritAttrs: false });

withDefaults(
  defineProps<{
    id: string;
    label: string;
    icon: Component;
    type?: "text" | "email" | "password";
    error?: string;
    hint?: string;
    disabled?: boolean;
  }>(),
  { type: "text", error: "", hint: "", disabled: false },
);

const value = defineModel<string>({ required: true });
</script>

<template>
  <div class="auth-field" :class="{ 'is-invalid': error }">
    <div class="mb-1.5 flex items-center justify-between gap-3">
      <label :for="id" class="auth-label">{{ label }}</label>
      <slot name="label-action" />
    </div>
    <el-input
      v-bind="$attrs"
      :id="id"
      v-model="value"
      :name="id"
      :type="type"
      :show-password="type === 'password'"
      :disabled="disabled"
      :aria-invalid="Boolean(error)"
      :aria-describedby="
        error ? `${id}-error` : hint ? `${id}-hint` : undefined
      "
    >
      <template #prefix>
        <component :is="icon" class="size-4" aria-hidden="true" />
      </template>
      <template v-if="$slots.suffix" #suffix><slot name="suffix" /></template>
    </el-input>
    <p v-if="error" :id="`${id}-error`" class="auth-field-error">{{ error }}</p>
    <p
      v-else-if="hint"
      :id="`${id}-hint`"
      class="mt-1 text-[11px] leading-relaxed text-faint"
    >
      {{ hint }}
    </p>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { ref, type Component } from "vue";
import { Eye, EyeOff } from "lucide-vue-next";

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
const passwordVisible = ref(false);
</script>

<template>
  <div>
    <div class="mb-1.5 flex items-center justify-between gap-3">
      <label :for="id" class="auth-label">{{ label }}</label>
      <slot name="label-action" />
    </div>
    <div class="auth-input-wrapper" :class="{ 'is-invalid': error }">
      <component :is="icon" class="auth-field-icon" aria-hidden="true" />
      <input
        v-bind="$attrs"
        :id="id"
        v-model="value"
        :name="id"
        :type="type === 'password' && passwordVisible ? 'text' : type"
        :disabled="disabled"
        :aria-invalid="Boolean(error)"
        :aria-describedby="
          error ? `${id}-error` : hint ? `${id}-hint` : undefined
        "
        class="auth-input"
      />
      <button
        v-if="type === 'password'"
        type="button"
        :disabled="disabled"
        :aria-label="`${passwordVisible ? '隐藏' : '显示'}${label}`"
        :aria-pressed="passwordVisible"
        class="grid size-7 shrink-0 place-items-center rounded-md text-faint hover:text-ghost"
        @click="passwordVisible = !passwordVisible"
      >
        <EyeOff v-if="passwordVisible" class="size-4" aria-hidden="true" />
        <Eye v-else class="size-4" aria-hidden="true" />
      </button>
      <slot name="suffix" />
    </div>
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

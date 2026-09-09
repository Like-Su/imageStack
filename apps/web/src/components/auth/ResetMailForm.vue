<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { ArrowRight, LoaderCircle, Mail } from "lucide-vue-next";
import { authApi } from "@/api/auth";
import { ApiError } from "@/api/request";
import { useCaptcha } from "@/composables/useCaptcha";
import { resetMailSchema, type ResetMailForm } from "@/config/auth";
import { useAuthForm } from "@/hooks/useAuthForm";
import type { ResetMailResponse } from "@/types/auth";
import AuthField from "./AuthField.vue";
import AuthNotice from "./AuthNotice.vue";
import CaptchaField from "./CaptchaField.vue";

const props = defineProps<{ email: string; cooldownUntil: number }>();
const emit = defineEmits<{
  accepted: [email: string, response: ResetMailResponse];
  cooldown: [until: number];
  useCode: [email: string];
}>();
const remainingSeconds = ref(0);
let countdownTimer: number | undefined;
let controller: AbortController | null = null;

function updateCountdown() {
  window.clearTimeout(countdownTimer);
  remainingSeconds.value = Math.max(
    0,
    Math.ceil((props.cooldownUntil - Date.now()) / 1000),
  );
  if (remainingSeconds.value > 0)
    countdownTimer = window.setTimeout(updateCountdown, 1000);
}

watch(() => props.cooldownUntil, updateCountdown, { immediate: true });
onBeforeUnmount(() => {
  window.clearTimeout(countdownTimer);
  controller?.abort();
});

const {
  captchaId,
  image: captchaImage,
  loading: captchaLoading,
  error: captchaError,
  refresh: reloadCaptcha,
} = useCaptcha();
const {
  defineField,
  errors,
  isSubmitting,
  serverError,
  setFieldValue,
  setFieldError,
  submit,
} = useAuthForm<ResetMailForm>(resetMailSchema, {
  email: props.email,
  captcha: "",
});
const [email, emailAttrs] = defineField("email");
const [captcha, captchaAttrs] = defineField("captcha");

function refreshCaptcha() {
  setFieldValue("captcha", "", false);
  setFieldError("captcha", undefined);
  return reloadCaptcha();
}

const onSubmit = submit(async (values) => {
  if (remainingSeconds.value > 0)
    throw new Error(`请在 ${remainingSeconds.value} 秒后重新发送`);
  if (!captchaId.value || captchaLoading.value)
    throw new Error("请先加载图形验证码");

  controller?.abort();
  const currentController = new AbortController();
  controller = currentController;
  try {
    const response = await authApi.sendResetMail(
      {
        email: values.email,
        captcha: values.captcha,
        captchaId: captchaId.value,
      },
      currentController.signal,
    );
    if (currentController.signal.aborted) return;
    if (
      !response ||
      typeof response.message !== "string" ||
      !Number.isFinite(response.retryAfter) ||
      response.retryAfter < 0 ||
      !Number.isFinite(response.expiresIn) ||
      response.expiresIn <= 0
    )
      throw new ApiError(
        "邮件请求响应不完整，请稍后重试",
        0,
        "INVALID_RESPONSE",
      );

    emit("cooldown", Date.now() + response.retryAfter * 1000);
    emit("accepted", values.email, response);
  } catch (error) {
    if (currentController.signal.aborted) return;
    if (error instanceof ApiError && error.status === 429) {
      emit("cooldown", Date.now() + Math.max(1, error.retryAfter ?? 60) * 1000);
    }
    void refreshCaptcha();
    throw error;
  }
});
</script>

<template>
  <form
    class="auth-form"
    novalidate
    :aria-busy="isSubmitting"
    @submit="onSubmit"
  >
    <AuthField
      id="reset-mail-email"
      v-model="email"
      v-bind="emailAttrs"
      label="账户邮箱"
      :icon="Mail"
      type="email"
      placeholder="you@local.host"
      autocomplete="email"
      autocapitalize="off"
      :spellcheck="false"
      :error="errors.email"
      :disabled="isSubmitting"
      required
    />
    <CaptchaField
      id="reset-mail-captcha"
      v-model="captcha"
      v-bind="captchaAttrs"
      :image="captchaImage"
      :loading="captchaLoading"
      :error="errors.captcha"
      :load-error="captchaError"
      :disabled="isSubmitting"
      @refresh="refreshCaptcha"
    />
    <AuthNotice :message="serverError" />
    <button
      type="submit"
      class="auth-button"
      :disabled="
        isSubmitting || captchaLoading || !captchaId || remainingSeconds > 0
      "
    >
      <LoaderCircle
        v-if="isSubmitting"
        class="size-4 animate-spin"
        aria-hidden="true"
      />
      {{
        isSubmitting
          ? "正在提交邮件请求…"
          : remainingSeconds > 0
            ? `${remainingSeconds} 秒后可重新发送`
            : "发送重置邮件"
      }}
      <ArrowRight
        v-if="!isSubmitting && remainingSeconds === 0"
        class="size-4"
        aria-hidden="true"
      />
    </button>
    <p class="text-xs leading-6 text-faint">
      如果邮箱对应的账户可用，将收到一次性重置链接和验证码。未收到邮件时，请检查垃圾邮件或联系实例管理员。
    </p>
    <button
      type="button"
      class="auth-link mx-auto block text-[13px]"
      :disabled="isSubmitting"
      @click="emit('useCode', email.trim())"
    >
      我已有验证码，直接重置
    </button>
  </form>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import {
  ArrowLeft,
  ArrowRight,
  CircleCheck,
  KeyRound,
  LoaderCircle,
  Lock,
  LockKeyhole,
  Mail,
} from "lucide-vue-next";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { authApi } from "@/api/auth";
import AuthField from "@/components/auth/AuthField.vue";
import AuthNotice from "@/components/auth/AuthNotice.vue";
import PasswordStrength from "@/components/auth/PasswordStrength.vue";
import ResetMailForm from "@/components/auth/ResetMailForm.vue";
import { forgotPasswordSchema, type ForgotPasswordForm } from "@/config/auth";
import { useAuthForm } from "@/hooks/useAuthForm";
import { useAuthStore } from "@/stores/auth";
import type { ResetMailResponse } from "@/types/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const step = ref<"request" | "reset">("request");
const completedEmail = ref("");
const cooldownUntil = ref(0);
const acceptedMessage = ref("");
const validityMinutes = ref(30);
const {
  defineField,
  errors,
  isSubmitting,
  serverError,
  resetForm,
  setFieldValue,
  submit,
} = useAuthForm<ForgotPasswordForm>(forgotPasswordSchema, {
  email: typeof route.query.email === "string" ? route.query.email : "",
  emailCode: "",
  password: "",
  enterPassword: "",
});

const [email, emailAttrs] = defineField("email");
const [emailCode, emailCodeAttrs] = defineField("emailCode");
const [password, passwordAttrs] = defineField("password");
const [enterPassword, enterPasswordAttrs] = defineField("enterPassword");

watch(
  () => route.query.emailCode,
  (code) => {
    if (code === undefined) return;
    if (typeof code === "string") {
      if (typeof route.query.email === "string")
        setFieldValue("email", route.query.email, false);
      setFieldValue("emailCode", code.trim(), false);
      completedEmail.value = "";
      step.value = "reset";
    }
    const query = { ...route.query };
    delete query.emailCode;
    void router.replace({ path: route.path, query, hash: route.hash });
  },
  { immediate: true },
);

function showResetForm(requestedEmail: string, response?: ResetMailResponse) {
  resetForm({
    values: {
      email: requestedEmail,
      emailCode: "",
      password: "",
      enterPassword: "",
    },
  });
  acceptedMessage.value = response?.message ?? "";
  validityMinutes.value = Math.ceil((response?.expiresIn ?? 1800) / 60);
  step.value = "reset";
}

function requestAnotherMail() {
  showResetForm(email.value);
  step.value = "request";
}

const onSubmit = submit(async (values) => {
  const sessionVersion = auth.getSessionVersion();
  const payload = {
    email: values.email,
    emailCode: values.emailCode,
    password: values.password,
  };
  const result =
    route.path === "/auth/reset"
      ? await authApi.resetPassword(payload)
      : await authApi.forgetPassword(payload);
  if (result !== true) throw new Error("密码重置未完成，请稍后重试");
  if (sessionVersion === auth.getSessionVersion()) auth.clearSession();
  completedEmail.value = values.email;
  resetForm({
    values: { email: "", emailCode: "", password: "", enterPassword: "" },
  });
});
</script>

<template>
  <section aria-labelledby="forgot-password-title">
    <template v-if="completedEmail">
      <span
        class="mb-6 grid size-14 place-items-center rounded-2xl border border-ok/20 bg-ok/10 text-ok"
        ><CircleCheck class="size-7" aria-hidden="true"
      /></span>
      <h1 id="forgot-password-title" class="auth-heading">密码已重置</h1>
      <p class="auth-description">新的密码，新的开始。</p>
      <AuthNotice
        class="mt-6"
        variant="success"
        message="密码修改成功，请使用新密码重新登录。"
      />
      <RouterLink
        :to="{
          name: 'login',
          query: {
            email: completedEmail,
            status: 'password-reset',
            redirect: route.query.redirect,
          },
        }"
        class="auth-button mt-7"
      >
        返回登录<ArrowRight class="size-4" aria-hidden="true" />
      </RouterLink>
    </template>
    <template v-else>
      <RouterLink
        :to="{
          name: 'login',
          query: { email, redirect: route.query.redirect },
        }"
        class="auth-link mb-7 inline-flex items-center gap-1.5 text-[13px]"
      >
        <ArrowLeft class="size-4" aria-hidden="true" />返回登录
      </RouterLink>
      <h1 id="forgot-password-title" class="auth-heading">
        {{ step === "request" ? "忘记密码" : "设置新密码" }}
      </h1>
      <p class="auth-description">
        {{
          step === "request"
            ? "验证你的邮箱，找回属于你的媒体库"
            : "使用邮件中的验证码，为账户设置新密码"
        }}
      </p>
      <ol class="mt-6 grid grid-cols-2 gap-3 text-xs" aria-label="找回密码步骤">
        <li
          class="flex items-center gap-2"
          :class="step === 'request' ? 'text-accent' : 'text-soft'"
          :aria-current="step === 'request' ? 'step' : undefined"
        >
          <span
            class="grid size-6 place-items-center rounded-full border border-current"
            >1</span
          >
          验证邮箱
        </li>
        <li
          class="flex items-center gap-2"
          :class="step === 'reset' ? 'text-accent' : 'text-faint'"
          :aria-current="step === 'reset' ? 'step' : undefined"
        >
          <span
            class="grid size-6 place-items-center rounded-full border border-current"
            >2</span
          >
          设置密码
        </li>
      </ol>
      <ResetMailForm
        v-if="step === 'request'"
        :email="email"
        :cooldown-until="cooldownUntil"
        @cooldown="cooldownUntil = $event"
        @accepted="showResetForm"
        @use-code="showResetForm"
      />
      <AuthNotice
        v-if="step === 'reset' && acceptedMessage"
        class="mt-5"
        variant="info"
        :message="acceptedMessage"
      />
      <form
        v-if="step === 'reset'"
        class="auth-form"
        novalidate
        :aria-busy="isSubmitting"
        @submit="onSubmit"
      >
        <AuthField
          id="forgot-email"
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
        <AuthField
          id="forgot-email-code"
          v-model="emailCode"
          v-bind="emailCodeAttrs"
          label="邮件重置验证码"
          :icon="KeyRound"
          placeholder="粘贴邮件中的完整验证码"
          autocomplete="one-time-code"
          autocapitalize="off"
          :spellcheck="false"
          :hint="`粘贴邮件中的完整 64 位验证码，${validityMinutes} 分钟内有效，仅最新一份可用。`"
          :error="errors.emailCode"
          :disabled="isSubmitting"
          required
        >
          <template #label-action>
            <button
              type="button"
              class="auth-link text-xs"
              :disabled="isSubmitting"
              @click="requestAnotherMail"
            >
              重新获取邮件
            </button>
          </template>
        </AuthField>
        <AuthField
          id="forgot-password"
          v-model="password"
          v-bind="passwordAttrs"
          label="新密码"
          :icon="Lock"
          type="password"
          placeholder="至少 8 位"
          autocomplete="new-password"
          :error="errors.password"
          :disabled="isSubmitting"
          required
        >
          <PasswordStrength :password="password" />
        </AuthField>
        <AuthField
          id="forgot-confirm-password"
          v-model="enterPassword"
          v-bind="enterPasswordAttrs"
          label="确认新密码"
          :icon="LockKeyhole"
          type="password"
          placeholder="再次输入新密码"
          autocomplete="new-password"
          :error="errors.enterPassword"
          :disabled="isSubmitting"
          required
        />
        <AuthNotice :message="serverError" />
        <button type="submit" class="auth-button" :disabled="isSubmitting">
          <LoaderCircle
            v-if="isSubmitting"
            class="size-4 animate-spin"
            aria-hidden="true"
          />
          {{ isSubmitting ? "正在重置密码…" : "重置密码" }}
          <ArrowRight v-if="!isSubmitting" class="size-4" aria-hidden="true" />
        </button>
      </form>
      <p class="auth-footer">
        想起密码了？
        <RouterLink
          :to="{
            name: 'login',
            query: { email, redirect: route.query.redirect },
          }"
          class="auth-link font-semibold"
          >去登录</RouterLink
        >
      </p>
    </template>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";
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
import { RouterLink, useRoute } from "vue-router";
import { authApi } from "@/api/auth";
import AuthField from "@/components/auth/AuthField.vue";
import AuthNotice from "@/components/auth/AuthNotice.vue";
import PasswordStrength from "@/components/auth/PasswordStrength.vue";
import { forgotPasswordSchema, type ForgotPasswordForm } from "@/config/auth";
import { useAuthForm } from "@/hooks/useAuthForm";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const auth = useAuthStore();
const completedEmail = ref("");
const { defineField, errors, isSubmitting, serverError, resetForm, submit } =
  useAuthForm<ForgotPasswordForm>(forgotPasswordSchema, {
    email: typeof route.query.email === "string" ? route.query.email : "",
    emailCode:
      typeof route.query.emailCode === "string" ? route.query.emailCode : "",
    password: "",
    enterPassword: "",
  });

const [email, emailAttrs] = defineField("email");
const [emailCode, emailCodeAttrs] = defineField("emailCode");
const [password, passwordAttrs] = defineField("password");
const [enterPassword, enterPasswordAttrs] = defineField("enterPassword");

const onSubmit = submit(async (values) => {
  const payload = {
    email: values.email,
    emailCode: values.emailCode,
    password: values.password,
  };
  const result =
    route.path === "/auth/reset"
      ? await authApi.resetPassword(payload)
      : await authApi.forgetPassword(payload);
  if (!result) throw new Error("密码重置未完成，请稍后重试");
  auth.clearSession();
  completedEmail.value = values.email;
  resetForm();
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
      <h1 id="forgot-password-title" class="auth-heading">忘记密码</h1>
      <p class="auth-description">验证你的邮箱，为账户设置一个新密码</p>
      <AuthNotice class="mt-5" variant="info">
        当前服务器尚未开放重置邮件发送入口。已有验证码可在下方重置；未收到验证码请联系实例管理员。
      </AuthNotice>
      <form
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
          label="邮箱验证码"
          :icon="KeyRound"
          placeholder="粘贴邮件中的完整验证码"
          autocomplete="one-time-code"
          autocapitalize="off"
          :spellcheck="false"
          hint="请输入密码重置验证码，而非账户激活链接或图形验证码。"
          :error="errors.emailCode"
          :disabled="isSubmitting"
          required
        />
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

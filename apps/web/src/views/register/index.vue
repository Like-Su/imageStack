<script setup lang="ts">
import { ref } from "vue";
import {
  ArrowRight,
  LoaderCircle,
  Lock,
  LockKeyhole,
  Mail,
  MailCheck,
  UserRound,
} from "lucide-vue-next";
import { RouterLink, useRoute } from "vue-router";
import { authApi } from "@/api/auth";
import AuthField from "@/components/auth/AuthField.vue";
import AuthNotice from "@/components/auth/AuthNotice.vue";
import AuthPolicyDialog from "@/components/auth/AuthPolicyDialog.vue";
import AuthTabs from "@/components/auth/AuthTabs.vue";
import CaptchaField from "@/components/auth/CaptchaField.vue";
import PasswordStrength from "@/components/auth/PasswordStrength.vue";
import { useCaptcha } from "@/composables/useCaptcha";
import { registerSchema, type RegisterForm } from "@/config/auth";
import { useAuthForm } from "@/hooks/useAuthForm";

const route = useRoute();
const policyDialog = ref<InstanceType<typeof AuthPolicyDialog> | null>(null);
const registeredEmail = ref("");
const successMessage = ref("");
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
  resetForm,
  setFieldValue,
  setFieldError,
  submit,
} = useAuthForm<RegisterForm>(registerSchema, {
  username: "",
  email: typeof route.query.email === "string" ? route.query.email : "",
  password: "",
  enterPassword: "",
  captcha: "",
  agree: false,
});

const [username, usernameAttrs] = defineField("username");
const [email, emailAttrs] = defineField("email");
const [password, passwordAttrs] = defineField("password");
const [enterPassword, enterPasswordAttrs] = defineField("enterPassword");
const [captcha, captchaAttrs] = defineField("captcha");
const [agree, agreeAttrs] = defineField("agree");

function refreshCaptcha() {
  setFieldValue("captcha", "", false);
  setFieldError("captcha", undefined);
  return reloadCaptcha();
}

const onSubmit = submit(async (values) => {
  if (!captchaId.value || captchaLoading.value)
    throw new Error("请先加载图形验证码");
  try {
    const result = await authApi.register({
      username: values.username,
      email: values.email,
      password: values.password,
      enterPassword: values.enterPassword,
      captcha: values.captcha,
      captchaId: captchaId.value,
    });
    registeredEmail.value = values.email;
    successMessage.value =
      result.message || "账户创建成功，请前往邮箱激活账户。";
    resetForm();
  } catch (error) {
    void refreshCaptcha();
    throw error;
  }
});
</script>

<template>
  <section aria-labelledby="register-title">
    <template v-if="registeredEmail">
      <span
        class="mb-6 grid size-14 place-items-center rounded-2xl border border-ok/20 bg-ok/10 text-ok"
        ><MailCheck class="size-7" aria-hidden="true"
      /></span>
      <h1 id="register-title" class="auth-heading">查收激活邮件</h1>
      <p class="auth-description">离你的本地媒体库，只差最后一步。</p>
      <AuthNotice class="mt-6" variant="success" :message="successMessage" />
      <p class="mt-5 text-[13px] leading-7 text-soft">
        激活邮件已发送至
        <strong class="break-all font-medium text-ghost">{{
          registeredEmail
        }}</strong
        >。请在 30 分钟内打开邮件中的激活链接，激活后再登录。
      </p>
      <p class="mt-2 text-xs leading-6 text-faint">
        未收到邮件？请检查垃圾邮件，或联系实例管理员确认邮件服务配置。
      </p>
      <RouterLink
        :to="{
          name: 'login',
          query: {
            email: registeredEmail,
            status: 'registered',
            redirect: route.query.redirect,
          },
        }"
        class="auth-button mt-7"
      >
        返回登录<ArrowRight class="size-4" aria-hidden="true" />
      </RouterLink>
    </template>
    <template v-else>
      <AuthTabs />
      <h1 id="register-title" class="auth-heading">创建账户</h1>
      <p class="auth-description">在本地服务器上建立你的账户</p>
      <form
        class="auth-form"
        novalidate
        :aria-busy="isSubmitting"
        @submit="onSubmit"
      >
        <AuthField
          id="register-username"
          v-model="username"
          v-bind="usernameAttrs"
          label="昵称"
          :icon="UserRound"
          placeholder="你的名字"
          autocomplete="nickname"
          :error="errors.username"
          :disabled="isSubmitting"
          required
        />
        <AuthField
          id="register-email"
          v-model="email"
          v-bind="emailAttrs"
          label="邮箱"
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
          id="register-password"
          v-model="password"
          v-bind="passwordAttrs"
          label="密码"
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
          id="register-confirm-password"
          v-model="enterPassword"
          v-bind="enterPasswordAttrs"
          label="确认密码"
          :icon="LockKeyhole"
          type="password"
          placeholder="再次输入密码"
          autocomplete="new-password"
          :error="errors.enterPassword"
          :disabled="isSubmitting"
          required
        />
        <CaptchaField
          id="register-captcha"
          v-model="captcha"
          v-bind="captchaAttrs"
          :image="captchaImage"
          :loading="captchaLoading"
          :error="errors.captcha"
          :load-error="captchaError"
          :disabled="isSubmitting"
          @refresh="refreshCaptcha"
        />
        <div>
          <div class="flex items-start gap-2 text-[13px] leading-6 text-soft">
            <input
              id="register-agree"
              v-model="agree"
              v-bind="agreeAttrs"
              type="checkbox"
              class="auth-checkbox mt-1"
              :disabled="isSubmitting"
              :aria-invalid="Boolean(errors.agree)"
              :aria-describedby="
                errors.agree ? 'register-agree-error' : undefined
              "
              required
            />
            <span>
              <label for="register-agree" class="cursor-pointer"
                >我已阅读并同意
              </label>
              <button
                type="button"
                class="auth-link"
                @click="policyDialog?.open('terms')"
              >
                服务条款
              </button>
              与
              <button
                type="button"
                class="auth-link"
                @click="policyDialog?.open('privacy')"
              >
                隐私政策
              </button>
            </span>
          </div>
          <p
            v-if="errors.agree"
            id="register-agree-error"
            class="auth-field-error"
          >
            {{ errors.agree }}
          </p>
        </div>
        <AuthNotice :message="serverError" />
        <button
          type="submit"
          class="auth-button"
          :disabled="isSubmitting || captchaLoading || !captchaId"
        >
          <LoaderCircle
            v-if="isSubmitting"
            class="size-4 animate-spin"
            aria-hidden="true"
          />
          {{ isSubmitting ? "正在创建账户…" : "创建账户" }}
          <ArrowRight v-if="!isSubmitting" class="size-4" aria-hidden="true" />
        </button>
      </form>
      <p class="auth-footer">
        已经有账户？
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
    <AuthPolicyDialog ref="policyDialog" />
  </section>
</template>

<script setup lang="ts">
import { translate } from "@/i18n";
import { computed, ref } from "vue";
import {
  ArrowRight,
  KeyRound,
  LoaderCircle,
  Lock,
  Mail,
  Server,
} from "lucide-vue-next";
import { RouterLink, useRoute, useRouter } from "vue-router";
import AuthField from "@/components/auth/AuthField.vue";
import AuthNotice from "@/components/auth/AuthNotice.vue";
import AuthTabs from "@/components/auth/AuthTabs.vue";
import CaptchaField from "@/components/auth/CaptchaField.vue";
import { useCaptcha } from "@/composables/useCaptcha";
import { loginSchema, type LoginForm } from "@/config/auth";
import { useAuthForm } from "@/hooks/useAuthForm";
import { getSafeRedirect } from "@/router/redirect";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const restoring = ref(false);
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
} = useAuthForm<LoginForm>(loginSchema, {
  email: typeof route.query.email === "string" ? route.query.email : "",
  password: "",
  captcha: "",
  remember: true,
});

const [email, emailAttrs] = defineField("email");
const [password, passwordAttrs] = defineField("password");
const [captcha, captchaAttrs] = defineField("captcha");
const [remember, rememberAttrs] = defineField("remember");

const notice = computed(() => {
  switch (route.query.status) {
    case "registered":
      return translate("账户已创建，请先通过邮件激活账户，再登录。");
    case "activated":
      return translate("账户激活成功，现在可以登录了。");
    case "password-reset":
      return translate("密码重置成功，请使用新密码登录。");
    case "expired":
      return translate("登录状态已失效，请重新登录。");
    case "signed-out":
      return translate("你已退出登录。");
    case "signed-out-all":
      return translate("所有设备上的登录会话已退出，请重新登录。");
    case "local-sign-out":
      return translate(
        "已清除本机登录状态，但服务器注销未完成，请稍后确认会话状态。",
      );
    default:
      return "";
  }
});

function refreshCaptcha() {
  setFieldValue("captcha", "", false);
  setFieldError("captcha", undefined);
  return reloadCaptcha();
}

async function restoreSession() {
  if (restoring.value || isSubmitting.value) return;
  restoring.value = true;
  try {
    await auth.initialize(true);
    if (auth.isAuthenticated)
      await router.replace(getSafeRedirect(route.query.redirect));
  } finally {
    restoring.value = false;
  }
}

const onSubmit = submit(async (values) => {
  if (restoring.value) return;
  if (!captchaId.value || captchaLoading.value)
    throw new Error(translate("请先加载图形验证码"));
  try {
    await auth.login(
      {
        email: values.email,
        password: values.password,
        captcha: values.captcha,
        captchaId: captchaId.value,
      },
      values.remember,
    );
  } catch (error) {
    void refreshCaptcha();
    throw error;
  }
  await router.replace(getSafeRedirect(route.query.redirect));
});
</script>

<template>
  <section aria-labelledby="login-title">
    <AuthTabs />
    <h1 id="login-title" class="auth-heading">{{ $t("欢迎回来") }}</h1>
    <p class="auth-description">{{ $t("登录到你的本地媒体库") }}</p>
    <AuthNotice v-if="notice" class="mt-5" variant="info" :message="notice" />
    <AuthNotice
      v-if="auth.initializationError"
      class="mt-5"
      :message="auth.initializationError"
    />
    <button
      v-if="auth.initializationError && auth.accessToken"
      type="button"
      class="auth-link mt-3 inline-flex items-center gap-2 text-xs"
      :disabled="restoring || isSubmitting"
      @click="restoreSession"
    >
      <LoaderCircle
        v-if="restoring"
        class="size-3 animate-spin"
        aria-hidden="true"
      />
      {{ restoring ? $t("正在恢复登录…") : $t("重试恢复已有登录") }}
    </button>

    <form
      class="auth-form"
      novalidate
      :aria-busy="isSubmitting"
      @submit="onSubmit"
    >
      <AuthField
        id="login-email"
        v-model="email"
        v-bind="emailAttrs"
        :label="$t('邮箱')"
        :icon="Mail"
        type="email"
        placeholder="you@local.host"
        autocomplete="username"
        autocapitalize="off"
        :spellcheck="false"
        :error="errors.email"
        :disabled="isSubmitting"
        required
      />
      <AuthField
        id="login-password"
        v-model="password"
        v-bind="passwordAttrs"
        :label="$t('密码')"
        :icon="Lock"
        type="password"
        placeholder="••••••••"
        autocomplete="current-password"
        :error="errors.password"
        :disabled="isSubmitting"
        required
      >
        <template #label-action>
          <RouterLink
            :to="{
              name: 'forgot-password',
              query: { email, redirect: route.query.redirect },
            }"
            class="auth-link text-xs"
            >{{ $t("忘记密码？") }}</RouterLink
          >
        </template>
      </AuthField>
      <CaptchaField
        id="login-captcha"
        v-model="captcha"
        v-bind="captchaAttrs"
        :image="captchaImage"
        :loading="captchaLoading"
        :error="errors.captcha"
        :load-error="captchaError"
        :disabled="isSubmitting"
        @refresh="refreshCaptcha"
      />
      <label
        class="flex cursor-pointer items-center gap-2 text-[13px] text-soft"
      >
        <input
          v-model="remember"
          v-bind="rememberAttrs"
          type="checkbox"
          class="auth-checkbox"
          :disabled="isSubmitting"
        />{{ $t("保持登录状态") }}</label
      >
      <AuthNotice :message="serverError" />
      <el-button
        type="primary"
        :loading="isSubmitting"
        native-type="submit"
        class="w-full !h-11 !rounded-xl"
        :disabled="isSubmitting || restoring || captchaLoading || !captchaId"
      >
        {{ isSubmitting ? $t("正在登录…") : $t("进入媒体库") }}
        <ArrowRight v-if="!isSubmitting" class="size-4" aria-hidden="true" />
      </el-button>
    </form>

    <div class="my-5 flex items-center gap-3 text-[11.5px] text-faint">
      <span class="h-px flex-1 bg-line"></span>{{ $t("或使用")
      }}<span class="h-px flex-1 bg-line"></span>
    </div>
    <div class="grid grid-cols-2 gap-2.5">
      <el-button
        native-type="button"
        class="text-[13px] w-full !h-11 !rounded-xl"
        disabled
        :title="$t('当前服务器尚未启用 OIDC / SSO 登录')"
      >
        <KeyRound class="size-4 text-ai" aria-hidden="true" />OIDC / SSO
      </el-button>
      <el-button
        native-type="button"
        class="text-[13px] w-full !h-11 !rounded-xl"
        disabled
        :title="$t('当前服务器尚未启用 LDAP 登录')"
      >
        <Server class="size-4 text-ai" aria-hidden="true" />LDAP
      </el-button>
    </div>
    <p class="mt-2 text-center text-[11px] text-faint">
      {{ $t("第三方登录尚未启用") }}
    </p>
    <p class="auth-footer">
      {{ $t("还没有账户？")
      }}<RouterLink
        :to="{
          name: 'register',
          query: { email, redirect: route.query.redirect },
        }"
        class="auth-link font-semibold"
        >{{ $t("立即注册") }}</RouterLink
      >
    </p>
  </section>
</template>

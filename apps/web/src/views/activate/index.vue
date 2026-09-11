<script setup lang="ts">
import { translate } from "@/i18n";
import { onBeforeUnmount, ref, watch } from "vue";
import {
  ArrowRight,
  CircleAlert,
  CircleCheck,
  LoaderCircle,
} from "lucide-vue-next";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { authApi } from "@/api/auth";
import { getErrorMessage } from "@/api/request";
import AuthNotice from "@/components/auth/AuthNotice.vue";

const route = useRoute();
const router = useRouter();
const activationToken = ref("");
const status = ref<"loading" | "success" | "error">("loading");
const errorMessage = ref("");
let controller: AbortController | null = null;

async function activate() {
  const token = activationToken.value;
  if (!token) {
    status.value = "error";
    errorMessage.value = translate(
      "激活链接缺少 token，请打开邮件中的完整链接。",
    );
    return;
  }

  controller?.abort();
  const currentController = new AbortController();
  controller = currentController;
  status.value = "loading";
  errorMessage.value = "";
  try {
    const activated = await authApi.activate(token, currentController.signal);
    if (currentController.signal.aborted) return;
    if (!activated) throw new Error(translate("账户激活未完成，请稍后重试"));
    status.value = "success";
  } catch (error) {
    if (currentController.signal.aborted) return;
    status.value = "error";
    errorMessage.value = getErrorMessage(error);
  }
}

watch(
  () => route.query.token,
  (token) => {
    if (token === undefined) {
      if (!activationToken.value) void activate();
      return;
    }
    controller?.abort();
    activationToken.value = typeof token === "string" ? token.trim() : "";
    const query = { ...route.query };
    delete query.token;
    void router.replace({ path: route.path, query, hash: route.hash });
    void activate();
  },
  { immediate: true },
);
onBeforeUnmount(() => controller?.abort());
</script>

<template>
  <section aria-labelledby="activate-title" :aria-busy="status === 'loading'">
    <span
      class="mb-6 grid size-14 place-items-center rounded-2xl bg-panel2"
      :class="
        status === 'success'
          ? 'text-ok'
          : status === 'error'
            ? 'text-err'
            : 'text-accent'
      "
    >
      <LoaderCircle
        v-if="status === 'loading'"
        class="size-7 animate-spin"
        aria-hidden="true"
      />
      <CircleCheck
        v-else-if="status === 'success'"
        class="size-7"
        aria-hidden="true"
      />
      <CircleAlert v-else class="size-7" aria-hidden="true" />
    </span>
    <h1 id="activate-title" class="auth-heading">
      {{
        status === "loading"
          ? $t("正在激活账户")
          : status === "success"
            ? $t("账户已激活")
            : $t("暂时无法激活")
      }}
    </h1>
    <p class="auth-description" role="status">
      {{
        status === "loading"
          ? $t("正在核验邮件中的激活链接，请稍候…")
          : status === "success"
            ? $t("你的账户已准备就绪，现在可以登录了。")
            : $t("请确认链接完整且未过期，或联系实例管理员。")
      }}
    </p>
    <AuthNotice v-if="errorMessage" class="mt-6" :message="errorMessage" />
    <el-button
      v-if="status === 'error' && activationToken"
      native-type="button"
      class="mt-6 w-full !h-11 !rounded-xl"
      @click="activate"
      >{{ $t("重试激活") }}</el-button
    >
    <RouterLink
      v-if="status !== 'loading'"
      :to="{
        name: 'login',
        query: status === 'success' ? { status: 'activated' } : {},
      }"
      class="auth-button mt-6"
      >{{ $t("返回登录") }}<ArrowRight class="size-4" aria-hidden="true" />
    </RouterLink>
  </section>
</template>

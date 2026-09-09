<script setup lang="ts">
import { ref } from "vue";
import { CircleCheck, LoaderCircle, LogOut } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { useAuthStore } from "@/stores/auth";

const auth = useAuthStore();
const router = useRouter();
const signingOut = ref(false);

async function logout() {
  if (signingOut.value) return;
  signingOut.value = true;
  let status = "signed-out";
  try {
    await auth.logout();
  } catch {
    status = "local-sign-out";
  } finally {
    signingOut.value = false;
    await router.replace({ name: "login", query: { status } });
  }
}
</script>

<template>
  <section aria-labelledby="account-title">
    <span
      class="mb-6 grid size-14 place-items-center rounded-2xl border border-ok/20 bg-ok/10 text-ok"
      ><CircleCheck class="size-7" aria-hidden="true"
    /></span>
    <h1 id="account-title" class="auth-heading">登录成功</h1>
    <p class="auth-description">欢迎回来，{{ auth.user?.username }}。</p>
    <dl
      class="mt-7 space-y-4 rounded-xl border border-line bg-panel2 p-5 text-[13px]"
    >
      <div class="flex items-start justify-between gap-4">
        <dt class="shrink-0 text-soft">昵称</dt>
        <dd class="break-all text-right">{{ auth.user?.username }}</dd>
      </div>
      <div class="flex items-start justify-between gap-4">
        <dt class="shrink-0 text-soft">邮箱</dt>
        <dd class="break-all text-right">{{ auth.user?.email }}</dd>
      </div>
      <div class="flex items-start justify-between gap-4">
        <dt class="shrink-0 text-soft">角色</dt>
        <dd class="break-all text-right">{{ auth.user?.roles }}</dd>
      </div>
    </dl>
    <p class="mt-5 text-xs leading-6 text-faint">
      账户认证已完成。此处为已登录入口，媒体库工作区将在后续功能中接入。
    </p>
    <button
      type="button"
      class="auth-button auth-button-secondary mt-7"
      :disabled="signingOut"
      @click="logout"
    >
      <LoaderCircle
        v-if="signingOut"
        class="size-4 animate-spin"
        aria-hidden="true"
      />
      <LogOut v-else class="size-4" aria-hidden="true" />
      {{ signingOut ? "正在退出…" : "退出登录" }}
    </button>
  </section>
</template>

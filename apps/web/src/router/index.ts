import { createRouter, createWebHistory } from "vue-router";
import AuthLayout from "@/components/auth/AuthLayout.vue";
import { useAuthStore } from "@/stores/auth";
import { getSafeRedirect } from "./redirect";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/",
      component: AuthLayout,
      children: [
        {
          path: "",
          name: "home",
          component: () => import("@/views/home/index.vue"),
          meta: { title: "我的账户", requiresAuth: true },
        },
        {
          path: "login",
          alias: "/auth/login",
          name: "login",
          component: () => import("@/views/login/index.vue"),
          meta: { title: "登录", guestOnly: true },
        },
        {
          path: "register",
          alias: "/auth/register",
          name: "register",
          component: () => import("@/views/register/index.vue"),
          meta: { title: "注册", guestOnly: true },
        },
        {
          path: "forgot-password",
          alias: [
            "/forget",
            "/auth/forget",
            "/auth/reset",
            "/auth/forgot-password",
          ],
          name: "forgot-password",
          component: () => import("@/views/forgot-password/index.vue"),
          meta: { title: "忘记密码", guestOnly: true },
        },
        {
          path: "auth/verify-activate",
          name: "activate",
          component: () => import("@/views/activate/index.vue"),
          meta: { title: "激活账户" },
        },
      ],
    },
    { path: "/auth", redirect: { name: "login" } },
    { path: "/:pathMatch(.*)*", redirect: { name: "home" } },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  await auth.initialize();

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: "login", query: { redirect: to.fullPath } };
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return getSafeRedirect(to.query.redirect);
  }
  return true;
});

router.afterEach((to) => {
  document.title = `${to.meta.title ?? "本地媒体库"} · Media Hub`;
});

export default router;

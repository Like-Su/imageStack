import { createRouter, createWebHistory } from "vue-router";
import AuthLayout from "@/components/auth/AuthLayout.vue";
import { useAuthStore } from "@/stores/auth";
import { getSafeRedirect } from "./redirect";

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: "/auth",
      redirect: { name: "login" },
      component: AuthLayout,
      children: [
        {
          path: "/login",
          alias: "/auth/login",
          name: "login",
          component: () => import("@/views/login/index.vue"),
          meta: { title: "登录", guestOnly: true },
        },
        {
          path: "/register",
          alias: "/auth/register",
          name: "register",
          component: () => import("@/views/register/index.vue"),
          meta: { title: "注册", guestOnly: true },
        },
        {
          path: "/forgot-password",
          alias: [
            "/forget",
            "/auth/forget",
            "/auth/reset",
            "/auth/forgot-password",
          ],
          name: "forgot-password",
          component: () => import("@/views/forgot-password/index.vue"),
          meta: { title: "忘记密码" },
        },
        {
          path: "verify-activate",
          name: "activate",
          component: () => import("@/views/activate/index.vue"),
          meta: { title: "激活账户" },
        },
      ],
    },
    {
      path: "/",
      component: () => import("@/components/workspace/WorkspaceLayout.vue"),
      meta: { requiresAuth: true },
      children: [
        {
          path: "",
          alias: "/library",
          name: "home",
          component: () => import("@/views/home/index.vue"),
          meta: { title: "图库" },
        },
        {
          path: "albums",
          name: "albums",
          component: () => import("@/views/albums/index.vue"),
          meta: { title: "相册" },
        },
        {
          path: "albums/:id",
          name: "album-detail",
          component: () => import("@/views/albums/detail.vue"),
          meta: { title: "相册详情", section: "albums" },
        },
        {
          path: "favorites",
          name: "favorites",
          component: () => import("@/views/favorites/index.vue"),
          meta: { title: "收藏" },
        },
        {
          path: "tags",
          name: "tags",
          component: () => import("@/views/tags/index.vue"),
          meta: { title: "标签" },
        },
        {
          path: "tags/:id",
          name: "tag-detail",
          component: () => import("@/views/tags/detail.vue"),
          meta: { title: "标签详情", section: "tags" },
        },
        {
          path: "search",
          alias: "/aisearch",
          name: "search",
          component: () => import("@/views/search/index.vue"),
          meta: { title: "AI 智能搜索" },
        },
        {
          path: "people",
          name: "people",
          component: () => import("@/views/people/index.vue"),
          meta: { title: "人物" },
        },
        {
          path: "people/:id",
          name: "person-detail",
          component: () => import("@/views/tags/detail.vue"),
          props: { people: true },
          meta: { title: "人物详情", section: "people" },
        },
        {
          path: "places",
          name: "places",
          component: () => import("@/views/places/index.vue"),
          meta: { title: "地点" },
        },
        {
          path: "tasks",
          name: "tasks",
          component: () => import("@/views/tasks/index.vue"),
          meta: { title: "任务中心" },
        },
        {
          path: "plugins",
          name: "plugins",
          component: () => import("@/views/plugins/index.vue"),
          meta: { title: "插件与扩展" },
        },
        {
          path: "trash",
          name: "trash",
          component: () => import("@/views/trash/index.vue"),
          meta: { title: "回收站" },
        },
        {
          path: "settings",
          name: "settings",
          component: () => import("@/views/settings/index.vue"),
          meta: { title: "设置" },
        },
        { path: "account", redirect: { name: "settings", hash: "#account" } },
      ],
    },
    { path: "/:pathMatch(.*)*", redirect: { name: "home" } },
  ],
  scrollBehavior: () => ({ top: 0 }),
});

router.beforeEach(async (to) => {
  const auth = useAuthStore();
  if (to.meta.requiresAuth || to.meta.guestOnly) await auth.initialize();

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

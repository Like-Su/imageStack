import { createApp } from "vue";
import { createPinia } from "pinia";
// 保持 字体一致性
import "./assets/fonts.css";
import "./assets/style.css";
import "./assets/theme/theme.css";
import App from "./App.vue";
import router from "./router";
import { configureRequestAuth } from "./api/request";
import { useAuthStore } from "./stores/auth";

import { initTheme } from "./composables/useTheme.ts";

initTheme();

function bootstrap() {
  const app = createApp(App);

  // 全局异常捕获
  app.config.errorHandler = (err, instance, info) => {
    console.error(
      "[imageStack] Unhandled Vue error:",
      err,
      "\nComponent:",
      instance,
      "\nInfo:",
      info,
    );
  };

  // 使用 插件
  const pinia = createPinia();
  app.use(pinia);

  const auth = useAuthStore(pinia);
  configureRequestAuth({
    getAccessToken: () => auth.accessToken,
    getSessionVersion: () => auth.getSessionVersion(),
    refresh: () => auth.refreshSession(),
    onUnauthorized: () => {
      auth.clearSession();
      const currentRoute = router.currentRoute.value;
      if (currentRoute.meta.requiresAuth) {
        void router.replace({
          name: "login",
          query: { redirect: currentRoute.fullPath, status: "expired" },
        });
      }
    },
  });

  app.use(router);
  app.mount("#app");
}

bootstrap();

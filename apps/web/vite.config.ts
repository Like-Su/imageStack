import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import vue from "@vitejs/plugin-vue";
import { defineConfig, loadEnv } from "vite";

const require = createRequire(import.meta.url);

const pkg = require("./package.json") as { version?: string };
const FRONTEND_VERSION = pkg.version || "unknown";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), "");
  const backendUrl =
    process.env.FRONTEND_BACKEND_URL ||
    env.FRONTEND_BACKEND_URL ||
    "http://localhost:3000";

  return {
    define: {
      __FRONTEND_VERSION__: JSON.stringify(FRONTEND_VERSION),
    },
    plugins: [vue(), tailwindcss()],
    server: {
      port: 5173,
      host: true,
      proxy: {
        "/api": {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
  };
});

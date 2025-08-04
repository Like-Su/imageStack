import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import path from "path"
import AutoImport from "unplugin-auto-import/vite"
import tailwidcss from "@tailwindcss/vite"
import { AntDesignVueResolver } from "unplugin-vue-components/resolvers"
import Components from "unplugin-vue-components/vite"

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    tailwidcss(),
    AutoImport({
      imports: ["vue", "vue-router", "pinia"],
      eslintrc: { enabled: false },
      dts: "./auto-imports.d.ts",
    }),
    Components({
      resolvers: [
        AntDesignVueResolver({
          importStyle: false, // css in js
        }),
      ],
    }),
  ],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
    ],
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
})

import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import path from "path"
import AutoImport from 'unplugin-auto-import/vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      eslintrc: { enabled: false },
      dts: './auto-imports.d.ts'
    })
  ],
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(__dirname),
      },
    ],
  },
  server: {
    proxy: {
      '/development-api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/\^\/development-api/, '/api')
      }
    }
  }
})

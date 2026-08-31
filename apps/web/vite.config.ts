import { dirname } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const pkg = require("./package.json") as { version?: string };
const FRONTEND_VERSION = pkg.version || "unknown";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
});

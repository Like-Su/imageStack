import globals from "globals"
import pluginJs from "@eslint/js"
import tseslint from "typescript-eslint"
import pluginVue from "eslint-plugin-vue"
import prettierRecommended from "eslint-plugin-prettier/recommended"

/** @type {import('eslint').Linter.Config[]} */
export default [
  { files: ["**/*.{js,mjs,cjs,ts,vue}"] },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  ...pluginVue.configs["flat/essential"],
  {
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },
  {
    ignores: ["*.d.ts", ".css"],
    rules: {
      "vue/multi-word-component-names": "off",
      "vue/no-multiple-template-root": "off",
      "vue/block-lang": "off",
      "vue/script-setup-uses-vars": "off",
    },
  },
  prettierRecommended,
]

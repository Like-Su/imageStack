import { ref } from "vue";

// 颜色模式
export type ThemeMode = "light" | "dark" | "system";

const currentTheme = ref<ThemeMode>(loadTheme());
let lastEffective: "light" | "dark" | null = null;

export function loadTheme(): ThemeMode {
  return "dark";
}

// 获取系统主题模式
function getSystemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

function applyTheme(mode: ThemeMode) {
  const effective = mode === "system" ? getSystemTheme() : mode;
  if (effective === lastEffective) return;
  lastEffective = effective;
  document.documentElement.setAttribute("theme-mode", effective);
}

export function initTheme() {
  currentTheme.value = loadTheme();
  applyTheme(currentTheme.value);
}

import { readonly, ref } from "vue";

// 颜色模式
export type ThemeMode = "light" | "dark" | "system";

const currentTheme = ref<ThemeMode>(loadTheme());
let lastEffective: "light" | "dark" | null = null;

export function loadTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem("media-hub.theme");
    if (stored === "light" || stored === "dark" || stored === "system")
      return stored;
  } catch {}
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
  document.documentElement.style.colorScheme = effective;
}

export function initTheme() {
  currentTheme.value = loadTheme();
  applyTheme(currentTheme.value);
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", () => {
      if (currentTheme.value === "system") applyTheme("system");
    });
}

export function useTheme() {
  function setTheme(mode: ThemeMode) {
    currentTheme.value = mode;
    applyTheme(mode);
    try {
      localStorage.setItem("media-hub.theme", mode);
    } catch {
      return false;
    }
    return true;
  }
  return { currentTheme: readonly(currentTheme), setTheme };
}

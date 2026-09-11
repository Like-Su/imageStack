import { createI18n } from "vue-i18n";
import { english } from "./messages";

export type AppLocale = "zh-CN" | "en";
const storageKey = "media-hub.locale";

function loadLocale(): AppLocale {
  try {
    return localStorage.getItem(storageKey) === "en" ? "en" : "zh-CN";
  } catch {
    return "zh-CN";
  }
}

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: loadLocale(),
  fallbackLocale: "zh-CN",
  missingWarn: false,
  fallbackWarn: false,
  messageResolver: (messages, key) =>
    typeof messages === "object" &&
    messages !== null &&
    Object.hasOwn(messages, key)
      ? ((messages as Record<string, string>)[key] ?? null)
      : null,
  messages: {
    "zh-CN": Object.fromEntries(Object.keys(english).map((key) => [key, key])),
    en: english,
  },
});

export const translate = i18n.global.t;

export function initLocale() {
  document.documentElement.lang = i18n.global.locale.value;
}

export function setLocale(locale: AppLocale) {
  i18n.global.locale.value = locale;
  initLocale();
  try {
    localStorage.setItem(storageKey, locale);
    return true;
  } catch {
    return false;
  }
}

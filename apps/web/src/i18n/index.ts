import { createI18n } from "vue-i18n";
import elementZhCn from "element-plus/es/locale/lang/zh-cn";
import elementEn from "element-plus/es/locale/lang/en";
import zh from "./locales/zh";
import en from "./locales/en";
import type { MessageKey, Messages } from "./types";

export type { MessageKey, Messages } from "./types";

interface LocaleDefinition {
  /** 语言切换器中显示的名称，用该语言自身书写。 */
  label: string;
  messages: Messages;
  /** Element Plus 内置组件文案。 */
  elementPlus: typeof elementZhCn;
}

/**
 * 支持的语言。新增语言：在 locales/ 下新建文件（键必须与 zh.ts 一致），
 * 再在这里登记一项即可，语言切换器与组件库文案会自动跟随。
 */
export const locales = {
  "zh-CN": { label: "简体中文", messages: zh, elementPlus: elementZhCn },
  en: { label: "English", messages: en, elementPlus: elementEn },
} satisfies Record<string, LocaleDefinition>;

export type AppLocale = keyof typeof locales;

export const defaultLocale: AppLocale = "zh-CN";
export const localeOptions = (Object.keys(locales) as AppLocale[]).map(
  (value) => ({ value, label: locales[value].label }),
);

const storageKey = "media-hub.locale";

export function isAppLocale(value: unknown): value is AppLocale {
  return typeof value === "string" && Object.hasOwn(locales, value);
}

function loadLocale(): AppLocale {
  try {
    const stored = localStorage.getItem(storageKey);
    return isAppLocale(stored) ? stored : defaultLocale;
  } catch {
    return defaultLocale;
  }
}

/**
 * 服务端返回的中文文案（错误信息、扩展能力说明等）不带消息键，
 * 这里按 zh.ts 的原文反查到键，再按当前语言输出；未收录的文案原样返回。
 */
const keysBySourceText = new Map<string, MessageKey>(
  (Object.entries(zh) as [MessageKey, string][]).map(([key, text]) => [
    text,
    key,
  ]),
);

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: loadLocale(),
  fallbackLocale: defaultLocale,
  missingWarn: false,
  fallbackWarn: false,
  messageResolver: (messages, key) => {
    if (typeof messages !== "object" || messages === null) return null;
    const table = messages as Record<string, string>;
    const resolved = Object.hasOwn(table, key)
      ? key
      : keysBySourceText.get(key);
    return resolved !== undefined && Object.hasOwn(table, resolved)
      ? (table[resolved] ?? null)
      : null;
  },
  messages: Object.fromEntries(
    Object.entries(locales).map(([code, definition]) => [
      code,
      definition.messages,
    ]),
  ) as Record<AppLocale, Messages>,
});

export const translate = i18n.global.t;

export function currentLocale(): AppLocale {
  const value = i18n.global.locale.value;
  return isAppLocale(value) ? value : defaultLocale;
}

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

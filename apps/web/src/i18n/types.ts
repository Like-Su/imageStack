import type zh from "./locales/zh";

/**
 * 消息键以 locales/zh.ts 为准；其他语言文件通过 `satisfies Messages`
 * 保证键集合完全一致（缺少或多出任何键都会在类型检查时报错）。
 */
export type Messages = { [K in keyof typeof zh]: string };

export type MessageKey = keyof Messages;

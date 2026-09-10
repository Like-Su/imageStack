import { z as zod } from "zod";

const email = zod
  .string()
  .trim()
  .min(1, "请输入邮箱地址")
  .max(254, "邮箱地址不能超过 254 位")
  .email("请输入有效的邮箱地址");
const captcha = zod.string().trim().length(4, "请输入 4 位图形验证码");
const password = zod
  .string()
  .min(8, "密码至少需要 8 位")
  .refine(
    (value) => new TextEncoder().encode(value).length <= 72,
    "密码不能超过 72 字节，请缩短密码后重试",
  );

export const loginSchema = zod.object({
  email,
  password: zod.string().min(6, "请输入至少 6 位的密码"),
  captcha,
  remember: zod.boolean(),
});

export const registerSchema = zod
  .object({
    username: zod.string().trim().min(1, "请输入昵称"),
    email,
    password,
    enterPassword: zod.string().min(1, "请再次输入密码"),
    captcha,
    agree: zod.boolean().refine((value) => value, "请先同意服务条款与隐私政策"),
  })
  .refine((values) => values.password === values.enterPassword, {
    path: ["enterPassword"],
    message: "两次输入的密码不一致",
  });

export const forgotPasswordSchema = zod
  .object({
    email,
    emailCode: zod
      .string()
      .trim()
      .regex(/^[a-f0-9]{64}$/i, "请输入邮件中的完整 64 位重置验证码"),
    password,
    enterPassword: zod.string().min(1, "请再次输入新密码"),
  })
  .refine((values) => values.password === values.enterPassword, {
    path: ["enterPassword"],
    message: "两次输入的密码不一致",
  });

export const resetMailSchema = zod.object({ email, captcha });

export type LoginForm = zod.infer<typeof loginSchema>;
export type RegisterForm = zod.infer<typeof registerSchema>;
export type ForgotPasswordForm = zod.infer<typeof forgotPasswordSchema>;
export type ResetMailForm = zod.infer<typeof resetMailSchema>;

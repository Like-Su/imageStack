import { z } from 'zod';
import { passwordSchema } from '../../../../common/schemas/fields.schema';

export const loginSchema = z.strictObject({
  email: z.string(),
  password: z.string().min(6),
  captcha: z.string(),
  captchaId: z.string(),
});

export const registerSchema = z.strictObject({
  username: z.string(),
  email: z.email(),
  password: z.string(),
  enterPassword: z.string(),
  captcha: z.string(),
  captchaId: z.string(),
});

export const logoutSchema = z.strictObject({
  refreshToken: z.string().nullish(),
});
export const refreshTokenSchema = z.strictObject({ refreshToken: z.string() });

const resetEmailSchema = z
  .string()
  .trim()
  .max(254)
  .check(z.email({ error: '请输入有效的邮箱地址' }));

export const sendResetPasswordMailSchema = z.strictObject({
  email: resetEmailSchema,
  captcha: z.string().trim().length(4, { error: '请输入 4 位图形验证码' }),
  captchaId: z.uuidv4({ error: '图形验证码标识无效，请重新获取' }),
});

export const forgetSchema = z.strictObject({
  email: resetEmailSchema,
  emailCode: z
    .string()
    .trim()
    .regex(/^[a-f0-9]{64}$/i, {
      error: '请输入邮件中的完整重置验证码',
    }),
  password: passwordSchema,
});

export const resetSchema = forgetSchema;

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type SendResetPasswordMailInput = z.infer<
  typeof sendResetPasswordMailSchema
>;
export type ForgetInput = z.infer<typeof forgetSchema>;
export type ResetInput = z.infer<typeof resetSchema>;

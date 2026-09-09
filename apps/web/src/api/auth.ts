import { request } from "./request";
import type {
  AuthTokens,
  AuthUser,
  CaptchaResponse,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
} from "@/types/auth";

export const authApi = {
  captcha: (signal?: AbortSignal) =>
    request<CaptchaResponse>("/auth/captcha", { auth: false, signal }),
  login: (body: LoginPayload) =>
    request<AuthTokens>("/auth/login", { method: "POST", body, auth: false }),
  register: (body: RegisterPayload) =>
    request<RegisterResponse>("/auth/register", {
      method: "POST",
      body,
      auth: false,
    }),
  forgetPassword: (body: ForgotPasswordPayload) =>
    request<boolean>("/auth/forget", { method: "POST", body, auth: false }),
  resetPassword: (body: ForgotPasswordPayload) =>
    request<boolean>("/auth/reset", { method: "POST", body, auth: false }),
  activate: (token: string, signal?: AbortSignal) =>
    request<boolean>(
      `/auth/verify-activate?token=${encodeURIComponent(token)}`,
      { auth: false, signal },
    ),
  refresh: (refreshToken: string) =>
    request<AuthTokens>("/auth/refresh", {
      method: "POST",
      body: { refreshToken },
      auth: false,
    }),
  logout: (refreshToken: string) =>
    request<boolean>("/auth/logout", {
      method: "POST",
      body: { refreshToken },
    }),
  me: (accessToken?: string) =>
    request<AuthUser | null>("/user/me", {
      method: "POST",
      auth: !accessToken,
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    }),
};

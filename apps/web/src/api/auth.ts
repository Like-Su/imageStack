import { request } from "./request";
import type {
  AuthTokens,
  AuthUser,
  CaptchaResponse,
  ForgotPasswordPayload,
  LoginPayload,
  RegisterPayload,
  RegisterResponse,
  ResetMailPayload,
  ResetMailResponse,
  UpdateProfilePayload,
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
  sendResetMail: (body: ResetMailPayload, signal?: AbortSignal) =>
    request<ResetMailResponse>("/auth/forget/send-code", {
      method: "POST",
      body,
      auth: false,
      signal,
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
  logoutAll: () => request<boolean>("/auth/logout-all", { method: "POST" }),
  updateProfile: (body: UpdateProfilePayload) =>
    request<AuthUser>("/user/me", { method: "PATCH", body }),
  me: (accessToken?: string) =>
    request<AuthUser | null>("/user/me", {
      method: "POST",
      auth: !accessToken,
      headers: accessToken
        ? { Authorization: `Bearer ${accessToken}` }
        : undefined,
    }),
};

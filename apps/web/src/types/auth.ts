export interface AuthUser {
  id: string;
  username: string;
  email: string;
  avatar?: string | null;
  roles: string;
  roleCode: string;
  permissions: string[];
}

export interface UpdateProfilePayload {
  username: string;
  avatar?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface CaptchaResponse {
  captchaId: string;
  image: string;
}

export interface CsrfTokenResponse {
  csrfToken: string;
}

export interface LoginPayload {
  email: string;
  password: string;
  captcha: string;
  captchaId: string;
}

export interface RegisterPayload extends LoginPayload {
  username: string;
  enterPassword: string;
}

export interface RegisterResponse {
  user: Pick<AuthUser, "id" | "username" | "email">;
  message: string;
}

export interface ForgotPasswordPayload {
  email: string;
  emailCode: string;
  password: string;
}

export interface ResetMailPayload {
  email: string;
  captcha: string;
  captchaId: string;
}

export interface ResetMailResponse {
  message: string;
  expiresIn: number;
  retryAfter: number;
}

export interface StoredSession extends AuthTokens {
  expiresAt: number;
  remember: boolean;
}

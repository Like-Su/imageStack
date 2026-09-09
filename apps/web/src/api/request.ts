import { API_BASE_URL, API_TIMEOUT_MS } from "@/config/api";
import type { ApiSuccessResponse } from "@/types/api";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  auth?: boolean;
  retryAuth?: boolean;
}

interface RequestAuth {
  getAccessToken: () => string | null;
  refresh: () => Promise<boolean>;
  onUnauthorized: () => void;
}

let requestAuth: RequestAuth | null = null;

export function configureRequestAuth(auth: RequestAuth) {
  requestAuth = auth;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(
    message: string,
    status = 0,
    code = "REQUEST_FAILED",
    details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "操作失败，请稍后重试";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function responseError(status: number, payload: unknown): ApiError {
  const data = isRecord(payload) ? payload : {};
  const originalMessage = data.message;
  let message =
    typeof originalMessage === "string"
      ? originalMessage
      : Array.isArray(originalMessage)
        ? originalMessage.filter((item) => typeof item === "string").join("；")
        : "";

  if (/csrf/i.test(message)) {
    message = "服务器的 CSRF 校验未完成配置，请联系管理员";
  } else if (status === 429) {
    message = "操作过于频繁，请稍后再试";
  } else if (status >= 500) {
    message = "服务器暂时不可用，请稍后重试";
  } else if (!message) {
    message =
      status === 401 ? "登录状态已失效，请重新登录" : "请求失败，请稍后重试";
  }

  return new ApiError(
    message,
    status,
    typeof data.code === "string" ? data.code : `HTTP_${status}`,
    data.details,
  );
}

export async function request<Data>(
  path: string,
  options: RequestOptions = {},
): Promise<Data> {
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.body !== undefined)
    headers.set("Content-Type", "application/json");

  const authenticated = options.auth !== false;
  const accessToken = authenticated ? requestAuth?.getAccessToken() : null;
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = window.setTimeout(abort, API_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      credentials: "same-origin",
      cache: "no-store",
    });

    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : undefined;
    } catch {
      if (!response.ok) throw responseError(response.status, undefined);
      throw new ApiError(
        "服务器返回了非 JSON 响应，请检查 API 地址与代理配置",
        response.status,
        "INVALID_RESPONSE",
      );
    }

    if (response.status === 401 && authenticated && requestAuth) {
      if (options.retryAuth !== false && (await requestAuth.refresh())) {
        return request<Data>(path, { ...options, retryAuth: false });
      }
      const currentAccessToken = requestAuth.getAccessToken();
      if (!currentAccessToken || currentAccessToken === accessToken)
        requestAuth.onUnauthorized();
    }

    if (!response.ok || (isRecord(payload) && payload.success === false)) {
      throw responseError(response.status, payload);
    }

    if (isRecord(payload) && payload.success === true && "data" in payload) {
      return (payload as unknown as ApiSuccessResponse<Data>).data;
    }
    return payload as Data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted) throw new ApiError("请求已取消", 0, "ABORTED");
    if (controller.signal.aborted)
      throw new ApiError("请求超时，请稍后重试", 0, "TIMEOUT");
    throw new ApiError(
      "无法连接服务器，请检查网络及后端服务",
      0,
      "NETWORK_ERROR",
    );
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

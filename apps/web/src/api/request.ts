import { translate } from "@/i18n";
import { API_BASE_URL, API_TIMEOUT_MS } from "@/config/api";
import type { ApiSuccessResponse } from "@/types/api";
import type { CsrfTokenResponse } from "@/types/auth";

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  auth?: boolean;
  retryAuth?: boolean;
  retryCsrf?: boolean;
  responseType?: "json" | "blob";
  timeoutMs?: number;
  referrerPolicy?: ReferrerPolicy;
}

interface RequestAuth {
  getAccessToken: () => string | null;
  getSessionVersion: () => number;
  refresh: () => Promise<boolean>;
  onUnauthorized: () => void;
}

let requestAuth: RequestAuth | null = null;
let csrfToken: string | null = null;
let csrfPromise: Promise<string> | null = null;

export function configureRequestAuth(auth: RequestAuth) {
  requestAuth = auth;
}

export function requestScope() {
  return requestAuth?.getSessionVersion() ?? 0;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;
  readonly retryAfter: number | undefined;

  constructor(
    message: string,
    status = 0,
    code = "REQUEST_FAILED",
    details?: unknown,
    retryAfter?: number,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.retryAfter = retryAfter;
  }
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : translate("操作失败，请稍后重试");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function responseError(response: Response, payload: unknown): ApiError {
  const status = response.status;
  const data = isRecord(payload) ? payload : {};
  const code = typeof data.code === "string" ? data.code : `HTTP_${status}`;
  const originalMessage = data.message;
  let message =
    typeof originalMessage === "string"
      ? originalMessage
      : Array.isArray(originalMessage)
        ? originalMessage.filter((item) => typeof item === "string").join("；")
        : "";

  if (code === "CSRF_TOKEN_INVALID") {
    message = translate(
      "安全校验失败，请重新提交；若仍失败，请检查 Cookie 设置或联系管理员",
    );
  } else if (status === 429 && !message) {
    message = translate("操作过于频繁，请稍后再试");
  } else if (status >= 500 && code !== "VIDEO_PROCESSING_UNAVAILABLE") {
    message = translate("服务器暂时不可用，请稍后重试");
  } else if (!message) {
    message =
      status === 401
        ? translate("登录状态已失效，请重新登录")
        : translate("请求失败，请稍后重试");
  }

  const detailsRetryAfter = isRecord(data.details)
    ? data.details.retryAfter
    : undefined;
  const retryAfterHeader = response.headers.get("Retry-After");
  let retryAfter: number | undefined;
  if (
    typeof detailsRetryAfter === "number" &&
    Number.isFinite(detailsRetryAfter)
  ) {
    retryAfter = Math.max(0, Math.ceil(detailsRetryAfter));
  } else if (retryAfterHeader) {
    const seconds = Number(retryAfterHeader);
    const delay = Number.isFinite(seconds)
      ? seconds
      : (Date.parse(retryAfterHeader) - Date.now()) / 1000;
    if (Number.isFinite(delay)) retryAfter = Math.max(0, Math.ceil(delay));
  }

  return new ApiError(message, status, code, data.details, retryAfter);
}

function ensureCsrfToken(rejectedToken?: string): Promise<string> {
  if (rejectedToken === csrfToken) csrfToken = null;
  if (csrfToken) return Promise.resolve(csrfToken);
  if (csrfPromise) return csrfPromise;

  csrfPromise = request<CsrfTokenResponse>("/auth/csrf", { auth: false })
    .then((result) => {
      if (!result || typeof result.csrfToken !== "string" || !result.csrfToken)
        throw new ApiError(
          translate("服务器未返回安全令牌，请联系管理员"),
          0,
          "INVALID_RESPONSE",
        );
      csrfToken = result.csrfToken;
      return csrfToken;
    })
    .finally(() => {
      csrfPromise = null;
    });

  return csrfPromise;
}

export async function request<Data>(
  path: string,
  options: RequestOptions = {},
): Promise<Data> {
  if (options.signal?.aborted)
    throw new ApiError(translate("请求已取消"), 0, "ABORTED");
  const auth = options.auth !== false ? requestAuth : null;
  const sessionVersion = auth?.getSessionVersion();
  const method = options.method ?? "GET";
  const requestCsrfToken = method !== "GET" ? await ensureCsrfToken() : null;
  if (options.signal?.aborted)
    throw new ApiError(translate("请求已取消"), 0, "ABORTED");
  if (auth && sessionVersion !== auth.getSessionVersion())
    throw new ApiError(translate("登录状态已变化，请重试"), 0, "AUTH_CHANGED");

  const headers = new Headers(options.headers);
  headers.set(
    "Accept",
    options.responseType === "blob"
      ? "image/*, video/*, application/octet-stream"
      : "application/json",
  );
  const rawBody =
    options.body instanceof Blob || options.body instanceof FormData;
  if (options.body !== undefined && !rawBody)
    headers.set("Content-Type", "application/json");
  else if (options.body instanceof Blob && !headers.has("Content-Type"))
    headers.set(
      "Content-Type",
      options.body.type || "application/octet-stream",
    );
  if (requestCsrfToken) headers.set("x-csrf-token", requestCsrfToken);

  const accessToken = auth?.getAccessToken();
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  const timeout = window.setTimeout(abort, options.timeoutMs ?? API_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body:
        options.body === undefined
          ? undefined
          : rawBody
            ? (options.body as Blob | FormData)
            : JSON.stringify(options.body),
      signal: controller.signal,
      credentials: "include",
      cache: "no-store",
      referrerPolicy: options.referrerPolicy,
    });

    if (
      response.ok &&
      options.responseType === "blob" &&
      response.status !== 202
    ) {
      const contentType = response.headers.get("Content-Type") ?? "";
      if (
        /^(image\/|video\/|audio\/|application\/octet-stream)/i.test(
          contentType,
        )
      ) {
        const blob = await response.blob();
        if (auth && sessionVersion !== auth.getSessionVersion())
          throw new ApiError(
            translate("登录状态已变化，请重试"),
            0,
            "AUTH_CHANGED",
          );
        return blob as Data;
      }
    }

    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : undefined;
    } catch {
      if (!response.ok) throw responseError(response, undefined);
      throw new ApiError(
        translate("服务器返回了非 JSON 响应，请检查 API 地址与代理配置"),
        response.status,
        "INVALID_RESPONSE",
      );
    }

    if (!response.ok || (isRecord(payload) && payload.success === false)) {
      const error = responseError(response, payload);
      if (
        response.status === 403 &&
        error.code === "CSRF_TOKEN_INVALID" &&
        requestCsrfToken &&
        options.retryCsrf !== false
      ) {
        await ensureCsrfToken(requestCsrfToken);
        if (auth && sessionVersion !== auth.getSessionVersion())
          throw new ApiError(
            translate("登录状态已变化，请重试"),
            0,
            "AUTH_CHANGED",
          );
        return request<Data>(path, { ...options, retryCsrf: false });
      }

      if (
        response.status === 401 &&
        auth &&
        sessionVersion === auth.getSessionVersion()
      ) {
        if (options.retryAuth !== false) {
          const latestToken = auth.getAccessToken();
          if (latestToken && latestToken !== accessToken)
            return request<Data>(path, { ...options, retryAuth: false });
          if (
            (await auth.refresh()) &&
            sessionVersion === auth.getSessionVersion()
          )
            return request<Data>(path, { ...options, retryAuth: false });
        }
        const latestToken = auth.getAccessToken();
        if (
          !latestToken ||
          (latestToken === accessToken &&
            sessionVersion === auth.getSessionVersion())
        )
          auth.onUnauthorized();
      }

      throw error;
    }

    if (auth && sessionVersion !== auth.getSessionVersion())
      throw new ApiError(
        translate("登录状态已变化，请重试"),
        0,
        "AUTH_CHANGED",
      );
    if (options.responseType === "blob") {
      if (response.status === 202)
        throw new ApiError(
          translate("媒体预览正在生成"),
          202,
          "MEDIA_PENDING",
          payload,
          responseError(response, payload).retryAfter ?? 3,
        );
      throw new ApiError(
        translate("服务器未返回可用的媒体文件"),
        response.status,
        "INVALID_RESPONSE",
      );
    }
    if (isRecord(payload) && payload.success === true && "data" in payload) {
      return (payload as unknown as ApiSuccessResponse<Data>).data;
    }
    return payload as Data;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (options.signal?.aborted)
      throw new ApiError(translate("请求已取消"), 0, "ABORTED");
    if (controller.signal.aborted)
      throw new ApiError(translate("请求超时，请稍后重试"), 0, "TIMEOUT");
    throw new ApiError(
      translate("无法连接服务器，请检查网络及后端服务"),
      0,
      "NETWORK_ERROR",
    );
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", abort);
  }
}

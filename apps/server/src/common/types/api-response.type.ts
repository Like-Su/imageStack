// API 响应格式
export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

// API 错误响应格式
export interface ApiErrorResponse {
  success: false;
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
  path: string;
}

export interface ApiSuccessResponse<Data> {
  success: true;
  data: Data;
  timestamp: string;
}

export interface ApiErrorResponse {
  success: false;
  code: string;
  message: string;
  details?: unknown;
  timestamp: string;
  path: string;
}

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL?.trim() || "/api"
).replace(/\/+$/, "");
export const API_TIMEOUT_MS = 30_000;

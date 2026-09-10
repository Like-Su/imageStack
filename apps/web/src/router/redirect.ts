export function getSafeRedirect(value: unknown): string {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\s]/.test(value)
  )
    return "/";

  const path = value.split(/[?#]/)[0]?.replace(/\/+$/, "").toLowerCase() || "/";
  if (
    ["/login", "/register", "/forgot-password", "/forget"].includes(path) ||
    path === "/auth" ||
    path.startsWith("/auth/")
  )
    return "/";

  return value;
}

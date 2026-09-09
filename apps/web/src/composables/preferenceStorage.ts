export function getUserId(): string {
  try {
    const rawUser =
      sessionStorage.getItem("image_stack_user") ||
      localStorage.getItem("image_stack_user");
    if (!rawUser) return "noUser";
    const parsed = JSON.parse(rawUser);
    return parsed?.id ? String(parsed.id) : "noUser";
  } catch {
    return "noUser";
  }
}

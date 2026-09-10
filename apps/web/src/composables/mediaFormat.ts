export function formatBytes(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const unit = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** unit).toLocaleString("zh-CN", { maximumFractionDigits: unit === 0 ? 0 : 1 })} ${units[unit]}`;
}

export function formatDate(value: string | null | undefined, withTime = false) {
  if (!value) return "—";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "—";
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    ...(withTime ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  });
}

export function formatCoordinate(latitude: number, longitude: number) {
  return `${Math.abs(latitude).toFixed(2)}°${latitude >= 0 ? "N" : "S"} · ${Math.abs(longitude).toFixed(2)}°${longitude >= 0 ? "E" : "W"}`;
}

export function formatDuration(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "—";
  const duration = Number(value);
  if (!Number.isFinite(duration) || duration < 0) return "—";
  const seconds = Math.floor(duration / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = String(seconds % 60).padStart(2, "0");
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${remaining}`
    : `${minutes}:${remaining}`;
}

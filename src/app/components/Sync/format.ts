const UNITS = ["B", "KB", "MB", "GB", "TB"];

/**
 * Format a byte count, e.g. `0.6 GB`.
 */
export function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1024 && unit < UNITS.length - 1) {
    value /= 1024;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : (value >= 10 ? 1 : 2);
  return `${Number(value.toFixed(digits))} ${UNITS[unit]}`;
}

/**
 * Format a Unix ms timestamp in the user's locale.
 */
export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Format a duration in seconds as `m:ss` or `h:mm:ss`.
 */
export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/**
 * "just now", "5 minutes ago", "3 days ago".
 */
export function formatAgo(ms: number): string {
  const seconds = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (seconds < 45) return "just now";
  const units: [number, string][] = [[86400, "day"], [3600, "hour"], [60, "minute"]];
  for (const [size, name] of units) {
    if (seconds >= size) {
      const count = Math.round(seconds / size);
      return `${count} ${name}${count === 1 ? "" : "s"} ago`;
    }
  }
  return "just now";
}

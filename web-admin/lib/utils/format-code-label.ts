/**
 * Turn SCREAMING_SNAKE / snake_case codes into readable labels.
 * Leaves normal product names unchanged.
 */
export function formatCodeLabel(value: string | null | undefined, fallback = ''): string {
  const raw = value?.trim();
  if (!raw) return fallback;

  // Only rewrite values that look like machine codes (e.g. WASH_AND_IRON).
  if (!/^[A-Za-z0-9]+(_[A-Za-z0-9]+)+$/.test(raw) && !/^[A-Z][A-Z0-9_]+$/.test(raw)) {
    return raw;
  }

  return raw
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

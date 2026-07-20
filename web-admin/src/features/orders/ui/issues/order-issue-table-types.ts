/**
 * Shared issue row type + date formatting for issue tables.
 */

export interface OrderIssueTableRow {
  id: string;
  issue_code: string;
  issue_text: string;
  priority: string | null;
  scope_level: string;
  created_at: string | null;
  created_by: string | null;
  created_by_name?: string | null;
  solved_at: string | null;
  solved_by: string | null;
  solved_by_name?: string | null;
  solved_notes: string | null;
  order_id?: string;
  order_no?: string | null;
}

/**
 * Display name for an issue actor (prefer resolved name, else short id).
 */
export function formatIssueActorName(
  name: string | null | undefined,
  userId: string | null | undefined
): string {
  const trimmed = name?.trim();
  if (trimmed) return trimmed;
  if (userId && userId.length > 0) return userId.slice(0, 8);
  return '—';
}

/**
 * Compact datetime for issue tables (locale-aware) — weekday, day, month, time.
 */
export function formatIssueDateTime(
  value: string | null | undefined,
  locale: string
): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

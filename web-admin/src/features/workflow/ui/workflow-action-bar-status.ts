import type { StatusBadgeVariant } from '@ui/feedback';

/**
 * Normalize a live workflow status code for i18n lookup (lowercase, `_`).
 */
export function workflowStatusLookupKey(status: string | null | undefined): string {
  return (status ?? '').trim().toLowerCase().replace(/-/g, '_');
}

/**
 * Resolve a staff-facing status label. Unknown codes stay readable rather than
 * rendering as a raw engine token.
 */
export function formatWorkflowStatusLabel(
  status: string | null | undefined,
  hasKey: (key: string) => boolean,
  translate: (key: string) => string,
): string | null {
  const key = workflowStatusLookupKey(status);
  if (!key) return null;
  const messageKey = `statusNames.${key}`;
  if (hasKey(messageKey)) return translate(messageKey);
  return key.replace(/_/g, ' ');
}

/**
 * Map a status code to a badge tone. Color is paired with the visible label.
 */
export function workflowStatusBadgeVariant(status: string | null | undefined): StatusBadgeVariant {
  switch (workflowStatusLookupKey(status)) {
    case 'delivered':
    case 'closed':
    case 'ready':
    case 'ready_for_pickup':
      return 'success';
    case 'on_hold':
    case 'qa':
      return 'warning';
    case 'cancelled':
    case 'stopped':
    case 'returned':
      return 'error';
    case 'processing':
    case 'washing':
    case 'drying':
    case 'preparing':
    case 'preparation':
    case 'assembly':
    case 'packing':
      return 'processing';
    default:
      return 'info';
  }
}

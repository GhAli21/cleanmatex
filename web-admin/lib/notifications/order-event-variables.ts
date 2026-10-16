/**
 * Notification variables for order lifecycle events.
 * Keys align with sys_ntf_template_ver_dtl placeholders and Twilio Content templates.
 */

import { isValidTimeZone } from '@/lib/utils/business-date';

function formatReadyByLabel(
  readyByAt: string | Date | null | undefined,
  locale = 'en',
  timeZone?: string,
): string {
  if (readyByAt == null || readyByAt === '') return 'Pending';

  const date = readyByAt instanceof Date ? readyByAt : new Date(readyByAt);
  if (Number.isNaN(date.getTime())) return 'Pending';

  // A date-only value ("2026-10-15") means a calendar day, not an instant: JS parses it as UTC midnight,
  // so formatting it in the server's zone would show the previous day west of UTC. Format it in UTC.
  const isCalendarDay = typeof readyByAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(readyByAt.trim());

  return date.toLocaleDateString(locale === 'ar' ? 'ar' : 'en', {
    year:   'numeric',
    month:  'long',
    day:    'numeric',
    // A calendar day is formatted in UTC (see above); an instant in the organization's own timezone, so a
    // ready time late in the evening does not show the next or previous day. Without a valid timezone the
    // server's zone applies (never a guessed one).
    ...(isCalendarDay ? { timeZone: 'UTC' } : isValidTimeZone(timeZone) ? { timeZone } : {}),
  });
}

/**
 * Variables for `order.created` (IN_APP, EMAIL, WHATSAPP templates).
 * Includes `date` alias for Twilio Content templates using {{date}}.
 */
export function buildOrderCreatedNotificationVariables(params: {
  orderNo: string;
  readyByAt?: string | Date | null;
  locale?: string;
  /** The organization's IANA timezone (getTenantTimeZone) used to format the ready time. */
  timeZone?: string;
}): Record<string, string> {
  const estimatedReadyAt = formatReadyByLabel(params.readyByAt, params.locale ?? 'en', params.timeZone);

  return {
    order_number:         params.orderNo,
    estimated_ready_at:   estimatedReadyAt,
    date:                 estimatedReadyAt,
  };
}

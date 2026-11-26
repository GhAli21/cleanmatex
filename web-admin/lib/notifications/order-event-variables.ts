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

  // A date-only value ("2026-10-15") is a calendar day, not an instant. Format it in UTC so a
  // negative-offset process cannot show the previous day. An instant needs the operations zone.
  // A missing or invalid zone omits the day rather than printing the server's day.
  const isCalendarDay = typeof readyByAt === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(readyByAt.trim());
  if (!isCalendarDay && !isValidTimeZone(timeZone)) return '';

  return date.toLocaleDateString(locale === 'ar' ? 'ar' : 'en', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: isCalendarDay ? 'UTC' : timeZone,
  });
}

/**
 * Variables for `order.created` (IN_APP, EMAIL, WHATSAPP templates).
 * Includes `date` alias for Twilio Content templates using {{date}}. `customer_name`, `order_items`
 * and `track_code` (the tracking link token) are added when known (loadOrderCreatedFacts).
 */
export function buildOrderCreatedNotificationVariables(params: {
  orderNo: string;
  readyByAt?: string | Date | null;
  locale?: string;
  /** Ready-by operations zone. A missing zone leaves the ready-by label empty. */
  timeZone?: string;
  customerName?: string;
  orderItems?: string;
  trackCode?: string;
}): Record<string, string> {
  const estimatedReadyAt = formatReadyByLabel(params.readyByAt, params.locale ?? 'en', params.timeZone);

  return {
    order_number:         params.orderNo,
    estimated_ready_at:   estimatedReadyAt,
    date:                 estimatedReadyAt,
    ...(params.customerName ? { customer_name: params.customerName } : {}),
    ...(params.orderItems ? { order_items: params.orderItems } : {}),
    ...(params.trackCode ? { track_code: params.trackCode } : {}),
  };
}

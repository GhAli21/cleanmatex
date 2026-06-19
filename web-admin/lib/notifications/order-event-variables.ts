/**
 * Notification variables for order lifecycle events.
 * Keys align with sys_ntf_template_ver_dtl placeholders and Twilio Content templates.
 */

function formatReadyByLabel(readyByAt: string | Date | null | undefined, locale = 'en'): string {
  if (readyByAt == null || readyByAt === '') return 'Pending';

  const date = readyByAt instanceof Date ? readyByAt : new Date(readyByAt);
  if (Number.isNaN(date.getTime())) return 'Pending';

  return date.toLocaleDateString(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    year:   'numeric',
    month:  'long',
    day:    'numeric',
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
}): Record<string, string> {
  const estimatedReadyAt = formatReadyByLabel(params.readyByAt, params.locale ?? 'en');

  return {
    order_number:         params.orderNo,
    estimated_ready_at:   estimatedReadyAt,
    date:                 estimatedReadyAt,
  };
}

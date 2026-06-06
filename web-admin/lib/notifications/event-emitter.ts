/**
 * Notification Hub — public entry point.
 * Business modules call emitNotificationEvent() and nothing else.
 * Never import orchestrator, adapters, or template-renderer directly from feature code.
 */

import { logger } from '@lib/utils/logger';
import type { NotificationEvent } from '@lib/notifications/types';
import { orchestrateNotification } from '@lib/notifications/orchestrator';

/**
 * Emit a notification event.
 * Fire-and-forget safe: errors are logged but never thrown to the caller,
 * so a notification failure cannot break the business operation that triggered it.
 *
 * @example
 * await emitNotificationEvent({
 *   code: 'order.created',
 *   tenantOrgId: order.tenant_org_id,
 *   recipientUserIds: [order.created_by_user_id],
 *   sourceEntityType: 'order',
 *   sourceEntityId: order.id,
 *   variables: { order_number: order.order_number, estimated_ready_at: '...' },
 *   actionUrl: `/dashboard/orders/${order.id}`,
 *   actionLabel: 'View Order',
 *   actionLabel2: 'عرض الطلب',
 * });
 */
export async function emitNotificationEvent(event: NotificationEvent): Promise<void> {
  try {
    const result = await orchestrateNotification(event);
    logger.info('notification event emitted', {
      eventCode:       result.eventCode,
      inAppDelivered:  result.inAppDelivered,
      inAppSkipped:    result.inAppSkipped,
      channels:        result.channelsAttempted,
      errors:          result.errors.length > 0 ? result.errors : undefined,
      feature:         'notifications',
    });
  } catch (err) {
    // Never let a notification failure propagate to the caller
    logger.error(
      'emitNotificationEvent: unexpected error — notification dropped',
      err instanceof Error ? err : new Error(String(err)),
      { eventCode: event.code, tenantOrgId: event.tenantOrgId, feature: 'notifications' }
    );
  }
}

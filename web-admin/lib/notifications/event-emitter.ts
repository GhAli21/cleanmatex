/**
 * Notification Hub — public entry point.
 * Business modules call emitNotificationEvent() / emitNotificationEventTx() and nothing else.
 * Never import orchestrator, adapters, or template-renderer directly from feature code.
 *
 * Both record a notification request and queue its preparation (`ntf.orchestrate`, run by
 * cmx-workers); nothing is rendered or sent inside the business request
 * (docs/features/Background_Jobs/STEP5_PLAN.md).
 */

import type { Prisma } from '@prisma/client';
import { logger } from '@lib/utils/logger';
import type { NotificationEvent } from '@lib/notifications/types';
import { requestNotification, requestNotificationTx } from '@lib/notifications/request.service';

/**
 * Record a notification request inside the caller's transaction. Prefer this: the request
 * exists exactly when the business change commits. Throws like any other write in `tx`.
 * @param tx the business transaction
 * @param event what happened and who should hear about it
 * @returns the request id
 */
export async function emitNotificationEventTx(tx: Prisma.TransactionClient, event: NotificationEvent): Promise<string> {
  return requestNotificationTx(tx, event);
}

/**
 * Record a notification request in its own transaction, for a caller whose business change
 * has already committed. Never throws: a failure is logged as an error (and reported), so a
 * notification problem cannot fail the business operation that triggered it.
 * shortcut: a crash between the business commit and this write loses the notification; move the
 * caller to emitNotificationEventTx (or derive it from the domain event) when its transaction is reachable.
 *
 * @param event what happened and who should hear about it
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
    const requestId = await requestNotification(event);
    logger.info('notification requested', {
      eventCode: event.code,
      tenantOrgId: event.tenantOrgId,
      requestId,
      feature: 'notifications',
    });
  } catch (err) {
    logger.error(
      'emitNotificationEvent: could not record the notification request — notification dropped',
      err instanceof Error ? err : new Error(String(err)),
      { eventCode: event.code, tenantOrgId: event.tenantOrgId, feature: 'notifications' }
    );
  }
}

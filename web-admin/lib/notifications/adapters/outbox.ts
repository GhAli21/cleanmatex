/**
 * Notification Hub — outbox adapter stub (Phase 1).
 * Phase 2 will implement EMAIL; Phase 3 will add WHATSAPP, SMS, PUSH.
 * The stub exists so the orchestrator can route to it without conditional code.
 */

import { logger } from '@lib/utils/logger';
import type { NotificationEvent } from '@lib/notifications/types';

export async function enqueueOutbox(
  event: NotificationEvent,
  channel: string
): Promise<void> {
  // Phase 1: external channels are not wired — log and return.
  logger.info('outbox adapter: channel not yet implemented (Phase 1 stub)', {
    channel,
    eventCode: event.code,
    tenantOrgId: event.tenantOrgId,
    feature: 'notifications',
  });
}

import 'server-only';

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { jobs } from '@/lib/jobs/producer';
import { orchestrateNotification } from '@lib/notifications/orchestrator';
import type { NotificationEvent, NotificationPriority } from '@lib/notifications/types';
import { NOTIFICATION_PRIORITY } from '@lib/notifications/types';

/**
 * Notification requests on pg-boss (docs/features/Background_Jobs/STEP5_PLAN.md).
 *
 *   emitNotificationEvent → requestNotificationTx: one `org_ntf_requests_tr` row + one
 *   `ntf.orchestrate` job (job id = request id), in the caller's transaction.
 *   cmx-workers → runNotificationRequest: the existing orchestrator writes the in-app and outbox
 *   rows (both deduplicated by their idempotency keys), then one transaction enqueues an
 *   `ntf.deliver` job per sendable outbox row (job id = outbox id) and marks the request PROCESSED.
 *
 * A job carries ids only; recipients and template variables stay in the request row.
 */

type Tx = Prisma.TransactionClient;

export const NTF_REQUEST_STATUS = { PENDING: 'PENDING', PROCESSED: 'PROCESSED', FAILED: 'FAILED' } as const;

/** What a request row stores besides its columns. Mirrors NotificationEvent minus the columns. */
interface RequestData {
  recipientUserIds: string[];
  variables: Record<string, string>;
  priority?: NotificationPriority;
  actionUrl?: string;
  actionLabel?: string;
  actionLabel2?: string;
}

/** pg-boss priority of the first send: higher runs first. Campaigns use a negative priority. */
export function deliverPriority(priority: NotificationPriority | undefined): number {
  switch (priority) {
    case NOTIFICATION_PRIORITY.CRITICAL:
    case NOTIFICATION_PRIORITY.URGENT:
      return 10;
    case NOTIFICATION_PRIORITY.HIGH:
      return 5;
    case NOTIFICATION_PRIORITY.LOW:
      return -5;
    default:
      return 0;
  }
}

/**
 * Records a notification request and queues its preparation, inside the caller's transaction:
 * commit keeps both, rollback removes both.
 * @returns the request id
 */
export async function requestNotificationTx(tx: Tx, event: NotificationEvent): Promise<string> {
  const data: RequestData = {
    recipientUserIds: event.recipientUserIds,
    variables: event.variables,
    ...(event.priority ? { priority: event.priority } : {}),
    ...(event.actionUrl ? { actionUrl: event.actionUrl } : {}),
    ...(event.actionLabel ? { actionLabel: event.actionLabel } : {}),
    ...(event.actionLabel2 ? { actionLabel2: event.actionLabel2 } : {}),
  };
  const row = await tx.org_ntf_requests_tr.create({
    data: {
      tenant_org_id: event.tenantOrgId,
      event_code: event.code,
      source_entity_type: event.sourceEntityType ?? null,
      source_entity_id: event.sourceEntityId ?? null,
      request_data: data as unknown as Prisma.InputJsonValue,
      created_by: 'system',
      created_info: 'requestNotificationTx',
    },
    select: { id: true },
  });
  await jobs.enqueue(tx, 'ntf.orchestrate', { tenantOrgId: event.tenantOrgId, requestId: row.id }, { id: row.id });
  return row.id;
}

/** Same as requestNotificationTx, in its own transaction (callers that have already committed). */
export async function requestNotification(event: NotificationEvent): Promise<string> {
  return withTenantContext(event.tenantOrgId, () => prisma.$transaction((tx) => requestNotificationTx(tx, event)));
}

export interface NotificationRequestOutcome {
  outcome: 'PROCESSED' | 'ALREADY_PROCESSED' | 'SKIPPED_ORPHAN';
  deliverJobs: number;
}

/**
 * Runs one request (the `ntf.orchestrate` job). Safe to repeat: the orchestrator's rows are
 * deduplicated by their idempotency keys and the deliver jobs by their ids.
 */
export async function runNotificationRequest(tenantOrgId: string, requestId: string): Promise<NotificationRequestOutcome> {
  return withTenantContext(tenantOrgId, async () => {
    const request = await prisma.org_ntf_requests_tr.findFirst({
      where: { id: requestId, tenant_org_id: tenantOrgId, is_active: true },
      select: { event_code: true, source_entity_type: true, source_entity_id: true, request_data: true, status: true },
    });
    if (!request) return { outcome: 'SKIPPED_ORPHAN', deliverJobs: 0 }; // removed with its tenant's data
    if (request.status === NTF_REQUEST_STATUS.PROCESSED) return { outcome: 'ALREADY_PROCESSED', deliverJobs: 0 };

    const data = request.request_data as unknown as RequestData;
    const event: NotificationEvent = {
      code: request.event_code,
      tenantOrgId,
      recipientUserIds: data.recipientUserIds ?? [],
      sourceEntityType: request.source_entity_type ?? undefined,
      sourceEntityId: request.source_entity_id ?? undefined,
      variables: data.variables ?? {},
      priority: data.priority,
      actionUrl: data.actionUrl,
      actionLabel: data.actionLabel,
      actionLabel2: data.actionLabel2,
    };
    const result = await orchestrateNotification(event);
    if (result.errors.length > 0) {
      // In-app or outbox writes failed: retry the job (everything already written is deduplicated).
      throw new Error(`NTF_ORCHESTRATE_FAILED: ${result.errors.join('; ').slice(0, 1000)}`);
    }

    return prisma.$transaction(async (tx) => {
      // This request's sendable rows. Outbox idempotency keys are (tenant, event, channel, source,
      // recipient), so these columns identify exactly the rows the orchestrator wrote or found.
      const rows = event.recipientUserIds.length === 0 ? [] : await tx.$queryRaw<{ id: string; send_at: Date }[]>`
        SELECT o.id::text AS id,
               (CASE WHEN o.status = 'FAILED_TEMPORARY' THEN coalesce(o.next_retry_at, o.scheduled_at) ELSE o.scheduled_at END
                 AT TIME ZONE 'UTC') AS send_at
          FROM public.org_ntf_outbox_dtl o
         WHERE o.tenant_org_id = ${tenantOrgId}::uuid
           AND o.event_code = ${event.code}
           AND o.source_entity_id IS NOT DISTINCT FROM ${request.source_entity_id}
           AND o.recipient_user_id = ANY(${event.recipientUserIds}::uuid[])
           AND o.status IN ('QUEUED', 'FAILED_TEMPORARY')
           AND o.claim_token IS NULL
           AND o.rec_status = 1 AND o.is_active`;
      const priority = deliverPriority(event.priority);
      for (const row of rows) {
        await jobs.enqueue(tx, 'ntf.deliver', { tenantOrgId, outboxId: row.id }, {
          id: row.id,
          priority,
          ...(row.send_at.getTime() > Date.now() ? { startAfter: row.send_at } : {}),
        });
      }
      await tx.org_ntf_requests_tr.updateMany({
        where: { id: requestId, tenant_org_id: tenantOrgId, status: NTF_REQUEST_STATUS.PENDING },
        data: {
          status: NTF_REQUEST_STATUS.PROCESSED,
          processed_at: new Date(),
          error_message: null,
          result_summary: {
            channelsAttempted: result.channelsAttempted,
            inAppDelivered: result.inAppDelivered,
            inAppSkipped: result.inAppSkipped,
            deliverJobs: rows.length,
          },
          updated_info: 'runNotificationRequest',
        },
      });
      return { outcome: 'PROCESSED' as const, deliverJobs: rows.length };
    });
  });
}

/** Last failed attempt of an `ntf.orchestrate` job: the request shows FAILED with the reason. */
export async function markNotificationRequestFailed(tenantOrgId: string, requestId: string, error: string): Promise<void> {
  await prisma.org_ntf_requests_tr.updateMany({
    where: { id: requestId, tenant_org_id: tenantOrgId, status: NTF_REQUEST_STATUS.PENDING },
    data: { status: NTF_REQUEST_STATUS.FAILED, processed_at: new Date(), error_message: error.slice(0, 2000), updated_info: 'ntf.orchestrate dead letter' },
  });
}

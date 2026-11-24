import 'server-only';

import type { Prisma } from '@prisma/client';
import { jobs } from '@/lib/jobs/producer';

/**
 * Immediate sends (docs/features/Background_Jobs/STEP5_PLAN.md item 5): a message a person is
 * waiting for (verification code, receipt) skips the orchestrator. The caller's transaction writes
 * the outbox row and its `ntf.deliver` job (job id = outbox id), so both exist or neither does.
 * HQ API sends it; the screen follows it through GET /api/v1/notifications/outbox/[id]/status.
 */

type Tx = Prisma.TransactionClient;

/** pg-boss priority of the first send. Order messages use at most 10 and campaigns −10. */
export const IMMEDIATE_SEND_PRIORITY = { OTP: 20, RECEIPT: 15, CAMPAIGN_TEST: 15 } as const;

export interface ImmediateSend {
  tenantOrgId: string;
  channel: 'SMS' | 'WHATSAPP' | 'EMAIL' | 'PUSH';
  /** Null for PUSH: HQ API sends to the user's active devices. */
  recipientAddress: string | null;
  recipientUserId?: string | null;
  eventCode: string;
  sourceEntityType: string;
  sourceEntityId: string;
  /** Globally unique (outbox idempotency_key); a repeat returns the first row. */
  idempotencyKey: string;
  subject: string | null;
  /** Text in the recipient's language. */
  body: string;
  /**
   * `variables`: WhatsApp template values by key (HQ API fills the template slots from them);
   * `expires_at` (ISO, UTC): HQ API drops the message after it.
   */
  metadata: { variables?: Record<string, string>; expires_at?: string; [key: string]: unknown };
  maxRetries: number;
  createdBy: string;
}

/** Writes one outbox row and queues its delivery. Returns the outbox id. */
export async function queueImmediateSendTx(tx: Tx, send: ImmediateSend, priority: number): Promise<string> {
  await tx.org_ntf_outbox_dtl.createMany({
    data: [{
      tenant_org_id: send.tenantOrgId,
      channel_code: send.channel,
      recipient_address: send.recipientAddress,
      recipient_user_id: send.recipientUserId ?? null,
      rendered_subject: send.subject,
      rendered_body: send.body,
      metadata: send.metadata as Prisma.InputJsonValue,
      event_code: send.eventCode,
      source_entity_type: send.sourceEntityType,
      source_entity_id: send.sourceEntityId,
      idempotency_key: send.idempotencyKey,
      status: 'QUEUED',
      scheduled_at: new Date(),
      retry_count: 0,
      max_retries: send.maxRetries,
      created_by: send.createdBy,
      created_info: 'queueImmediateSendTx',
      rec_status: 1,
      is_active: true,
    }],
    skipDuplicates: true,
  });
  const outbox = await tx.org_ntf_outbox_dtl.findFirst({
    where: { tenant_org_id: send.tenantOrgId, idempotency_key: send.idempotencyKey },
    select: { id: true, status: true, claim_token: true },
  });
  if (!outbox) throw new Error(`immediate send: outbox row missing after insert (${send.idempotencyKey})`);
  if (outbox.status === 'QUEUED' && !outbox.claim_token) {
    await jobs.enqueue(tx, 'ntf.deliver', { tenantOrgId: send.tenantOrgId, outboxId: outbox.id }, { id: outbox.id, priority });
  }
  return outbox.id;
}

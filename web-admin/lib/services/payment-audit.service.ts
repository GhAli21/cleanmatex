/**
 * Payment Audit Service
 *
 * Append-only audit log for payment transactions.
 * Action types: CREATED, CANCELLED, REFUNDED, NOTES_UPDATED.
 */

import { prisma } from '@/lib/db/prisma';
import type { Prisma } from '@prisma/client';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';

export type PaymentAuditActionType =
  | 'CREATED'
  | 'CANCELLED'
  | 'REFUNDED'
  | 'NOTES_UPDATED';

export interface RecordPaymentAuditParams {
  tenantId: string;
  paymentId: string;
  actionType: PaymentAuditActionType;
  beforeValue?: Record<string, unknown> | null;
  afterValue?: Record<string, unknown> | null;
  changedBy: string;
  metadata?: Record<string, unknown> | null;
}

type PrismaDelegate = {
  org_payment_audit_log: {
    create: (args: {
      data: {
        tenant_org_id: string;
        payment_id: string;
        action_type: string;
        before_value?: Prisma.InputJsonValue;
        after_value?: Prisma.InputJsonValue;
        changed_by?: string;
        metadata?: Prisma.InputJsonValue;
      };
    }) => Promise<unknown>;
  };
};

/**
 * Insert one row into org_payment_audit_log.
 * When called from inside a Prisma $transaction, pass the tx client so the audit is part of the same transaction.
 */
export async function recordPaymentAudit(
  params: RecordPaymentAuditParams,
  client: PrismaDelegate = prisma
): Promise<void> {
  await client.org_payment_audit_log.create({
    data: {
      tenant_org_id: params.tenantId,
      payment_id: params.paymentId,
      action_type: params.actionType,
      before_value: params.beforeValue ?? undefined,
      after_value: params.afterValue ?? undefined,
      changed_by: params.changedBy,
      metadata: params.metadata ?? undefined,
    },
  });
}

/**
 * Build a compact snapshot of a payment row for audit before_value/after_value.
 */
export function paymentSnapshot(payment: {
  id: string;
  status: string | null;
  paid_amount: unknown;
  invoice_id: string | null;
  order_id: string | null;
  rec_notes: string | null;
  updated_at: Date | null;
}): Record<string, unknown> {
  return {
    id: payment.id,
    status: payment.status,
    paid_amount: payment.paid_amount != null ? Number(payment.paid_amount) : null,
    invoice_id: payment.invoice_id,
    order_id: payment.order_id,
    rec_notes: payment.rec_notes,
    updated_at: payment.updated_at?.toISOString() ?? null,
  };
}

export interface PaymentAuditEntry {
  id: string;
  action_type: string;
  before_value: Record<string, unknown> | null;
  after_value: Record<string, unknown> | null;
  changed_by: string | null;
  changed_at: string;
}

/**
 * Get audit log entries for a payment (tenant-scoped, ordered by changed_at DESC).
 */
export async function getPaymentAuditLog(
  paymentId: string
): Promise<PaymentAuditEntry[]> {
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) return [];

  const rows = await prisma.org_payment_audit_log.findMany({
    where: { payment_id: paymentId, tenant_org_id: tenantId },
    orderBy: { changed_at: 'desc' },
    select: {
      id: true,
      action_type: true,
      before_value: true,
      after_value: true,
      changed_by: true,
      changed_at: true,
    },
  });

  return rows.map((r) => ({
    id: r.id,
    action_type: r.action_type,
    before_value:
      r.before_value != null && typeof r.before_value === 'object'
        ? (r.before_value as Record<string, unknown>)
        : null,
    after_value:
      r.after_value != null && typeof r.after_value === 'object'
        ? (r.after_value as Record<string, unknown>)
        : null,
    changed_by: r.changed_by,
    changed_at: r.changed_at.toISOString(),
  }));
}

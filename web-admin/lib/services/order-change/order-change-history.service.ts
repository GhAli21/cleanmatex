/**
 * Read-only Change history. It returns labels and operation codes, not financial snapshots.
 */

import { prisma } from '@/lib/db/prisma';

export interface OrderChangeHistoryItem {
  changeNo: number;
  revision: number;
  sourceContext: string;
  legacy: boolean;
  reason: string | null;
  financialOutcome: string;
  appliedAt: string;
  operations: string[];
}

interface HistoryHeader {
  id: string;
  change_no: number;
  edit_state_version_after: number;
  source_context: string;
  change_reason: string | null;
  financial_outcome: string;
  applied_at: Date;
}

interface HistoryOperation {
  order_change_id: string;
  operation_seq: number;
  operation_code: string;
}

/** Current Edit commands use this origin. Any other origin is an earlier update. */
export const ORDER_EDIT_SOURCE_CONTEXT = 'order-edit';

export function mapOrderChangeHistory(headers: readonly HistoryHeader[], operations: readonly HistoryOperation[]): OrderChangeHistoryItem[] {
  return headers.map((header) => ({
    changeNo: header.change_no,
    revision: header.edit_state_version_after,
    sourceContext: header.source_context,
    legacy: header.source_context !== ORDER_EDIT_SOURCE_CONTEXT,
    reason: header.change_reason,
    financialOutcome: header.financial_outcome,
    appliedAt: header.applied_at.toISOString(),
    operations: operations
      .filter((operation) => operation.order_change_id === header.id)
      .sort((left, right) => left.operation_seq - right.operation_seq)
      .map((operation) => operation.operation_code),
  }));
}

/**
 * List one order's applied Changes for the authenticated organization.
 * The query names tenant_org_id on every table.
 */
export async function listOrderChangeHistory(input: {
  tenantId: string;
  orderId: string;
  limit: number;
  cursor?: number;
}): Promise<{ items: OrderChangeHistoryItem[]; nextCursor: number | null }> {
  const headers = await prisma.org_order_changes_mst.findMany({
    where: {
      tenant_org_id: input.tenantId,
      order_id: input.orderId,
      rec_status: 1,
      ...(input.cursor ? { change_no: { lt: input.cursor } } : {}),
    },
    orderBy: { change_no: 'desc' },
    take: input.limit,
    select: {
      id: true,
      change_no: true,
      edit_state_version_after: true,
      source_context: true,
      change_reason: true,
      financial_outcome: true,
      applied_at: true,
    },
  });
  const operations = headers.length === 0
    ? []
    : await prisma.org_order_change_ops_dtl.findMany({
      where: {
        tenant_org_id: input.tenantId,
        order_id: input.orderId,
        rec_status: 1,
        order_change_id: { in: headers.map((header) => header.id) },
      },
      select: { order_change_id: true, operation_seq: true, operation_code: true },
    });
  const items = mapOrderChangeHistory(headers, operations);
  const nextCursor = headers.length === input.limit ? headers[headers.length - 1].change_no : null;
  return { items, nextCursor };
}

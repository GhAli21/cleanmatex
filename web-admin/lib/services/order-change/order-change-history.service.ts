/**
 * Read-only Change history.
 * The slim list used by Edit review returns labels and operation codes.
 * The detail page returns the commercial header, every operation, and removal lineage.
 * Replay secrets stay in the database and are not selected.
 */

import { ORDER_CHANGE_LIMITS } from '@/lib/constants/order-change';
import { prisma } from '@/lib/db/prisma';
import {
  assembleOrderChangeHistoryDetail,
  type OrderChangeHistoryPage,
} from '@/lib/services/order-change/order-change-history-view';

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

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function decimalText(value: { toString(): string } | null | undefined): string | null {
  if (value == null) return null;
  const text = value.toString().trim();
  return text.length > 0 ? text : null;
}

/**
 * One page of applied Changes for an order, with operations and removal lineage.
 * Every org_* read names tenant_org_id and the order.
 */
export async function listOrderChangeHistoryDetail(input: {
  tenantId: string;
  orderId: string;
  cursor?: number;
}): Promise<OrderChangeHistoryPage> {
  const limit = ORDER_CHANGE_LIMITS.HISTORY_DEFAULT_PAGE_SIZE;
  const scope = { tenant_org_id: input.tenantId, order_id: input.orderId, rec_status: 1 };
  const [totalCount, headers] = await Promise.all([
    prisma.org_order_changes_mst.count({ where: scope }),
    prisma.org_order_changes_mst.findMany({
      where: {
        ...scope,
        ...(input.cursor ? { change_no: { lt: input.cursor } } : {}),
      },
      orderBy: { change_no: 'desc' },
      take: limit,
      select: {
        id: true,
        change_no: true,
        edit_state_version_before: true,
        edit_state_version_after: true,
        wf_state_version_expected: true,
        source_context: true,
        actor_name: true,
        change_reason: true,
        currency_code: true,
        financial_before: true,
        financial_after: true,
        commercial_delta: true,
        financial_outcome: true,
        applied_at: true,
        metadata: true,
      },
    }),
  ]);
  if (headers.length === 0) return { items: [], nextCursor: null, totalCount };

  const changeIds = headers.map((header) => header.id);
  const operations = await prisma.org_order_change_ops_dtl.findMany({
    where: { tenant_org_id: input.tenantId, order_id: input.orderId, rec_status: 1, order_change_id: { in: changeIds } },
    select: {
      order_change_id: true,
      operation_seq: true,
      operation_code: true,
      target_type: true,
      order_item_id: true,
      order_item_piece_id: true,
      order_preference_id: true,
      client_ref: true,
      audit_summary: true,
      before_values: true,
      after_values: true,
    },
  });
  const itemIds = [...new Set(operations.flatMap((row) => (row.order_item_id ? [row.order_item_id] : [])))];
  const pieceIds = [...new Set(operations.flatMap((row) => (row.order_item_piece_id ? [row.order_item_piece_id] : [])))];
  const preferenceIds = [...new Set(operations.flatMap((row) => (row.order_preference_id ? [row.order_preference_id] : [])))];

  const [items, pieces, preferences] = await Promise.all([
    prisma.org_order_items_dtl.findMany({
      where: {
        tenant_org_id: input.tenantId,
        order_id: input.orderId,
        OR: [
          ...(itemIds.length > 0 ? [{ id: { in: itemIds } }] : []),
          { deleted_order_change_id: { in: changeIds } },
        ],
      },
      select: {
        id: true,
        product_name: true,
        product_name2: true,
        quantity: true,
        barcode: true,
        order_item_srno: true,
        deleted_at: true,
        deleted_order_change_id: true,
      },
    }),
    prisma.org_order_item_pieces_dtl.findMany({
      where: {
        tenant_org_id: input.tenantId,
        order_id: input.orderId,
        OR: [
          ...(pieceIds.length > 0 ? [{ id: { in: pieceIds } }] : []),
          { deleted_order_change_id: { in: changeIds } },
        ],
      },
      select: {
        id: true,
        piece_seq: true,
        piece_code: true,
        barcode: true,
        brand: true,
        quantity: true,
        order_item_id: true,
        deleted_at: true,
        deleted_order_change_id: true,
      },
    }),
    prisma.org_order_preferences_dtl.findMany({
      where: {
        tenant_org_id: input.tenantId,
        order_id: input.orderId,
        OR: [
          ...(preferenceIds.length > 0 ? [{ id: { in: preferenceIds } }] : []),
          { deleted_order_change_id: { in: changeIds } },
        ],
      },
      select: {
        id: true,
        preference_code: true,
        preference_content: true,
        prefs_level: true,
        extra_price: true,
        deleted_at: true,
        deleted_order_change_id: true,
      },
    }),
  ]);

  return {
    items: assembleOrderChangeHistoryDetail({
      headers: headers.map((header) => ({
        id: header.id,
        changeNo: header.change_no,
        revisionBefore: header.edit_state_version_before,
        revisionAfter: header.edit_state_version_after,
        workflowVersionExpected: header.wf_state_version_expected,
        sourceContext: header.source_context,
        actorName: header.actor_name,
        reason: header.change_reason,
        currencyCode: header.currency_code,
        commercialDelta: header.commercial_delta.toString(),
        financialOutcome: header.financial_outcome,
        appliedAt: header.applied_at.toISOString(),
        financialBefore: header.financial_before,
        financialAfter: header.financial_after,
        metadata: header.metadata,
      })),
      operations: operations.map((operation) => ({
        orderChangeId: operation.order_change_id,
        seq: operation.operation_seq,
        code: operation.operation_code,
        targetType: operation.target_type,
        orderItemId: operation.order_item_id,
        orderItemPieceId: operation.order_item_piece_id,
        orderPreferenceId: operation.order_preference_id,
        clientRef: operation.client_ref,
        auditSummary: operation.audit_summary,
        beforeValues: operation.before_values,
        afterValues: operation.after_values,
      })),
      items: items.map((item) => ({
        id: item.id,
        deletedOrderChangeId: item.deleted_order_change_id,
        label: item.product_name,
        label2: item.product_name2,
        quantity: item.quantity == null ? null : String(item.quantity),
        code: item.barcode ?? item.order_item_srno,
        deletedAt: iso(item.deleted_at),
      })),
      pieces: pieces.map((piece) => ({
        id: piece.id,
        deletedOrderChangeId: piece.deleted_order_change_id,
        orderItemId: piece.order_item_id,
        label: piece.barcode ?? piece.piece_code ?? `#${piece.piece_seq}`,
        label2: piece.brand,
        quantity: piece.quantity == null ? null : String(piece.quantity),
        code: piece.piece_code,
        deletedAt: iso(piece.deleted_at),
      })),
      preferences: preferences.map((preference) => ({
        id: preference.id,
        deletedOrderChangeId: preference.deleted_order_change_id,
        label: preference.preference_code,
        label2: preference.preference_content,
        level: preference.prefs_level,
        extraPrice: decimalText(preference.extra_price),
        deletedAt: iso(preference.deleted_at),
      })),
    }),
    nextCursor: headers.length === limit ? headers[headers.length - 1].change_no : null,
    totalCount,
  };
}

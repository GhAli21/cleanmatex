/**
 * Pure read model for Order Change history.
 * Replay secrets (idempotency key, request hash, apply response, review proof)
 * stay out of this view. The query layer supplies already tenant-scoped rows.
 */

export interface OrderChangeHistoryValueField {
  key: string;
  value: string;
}

export interface OrderChangeHistoryOperationView {
  seq: number;
  code: string;
  targetType: string;
  targetLabel: string | null;
  targetLabel2: string | null;
  orderItemId: string | null;
  orderItemPieceId: string | null;
  orderPreferenceId: string | null;
  clientRef: string | null;
  auditSummary: string | null;
  before: OrderChangeHistoryValueField[];
  after: OrderChangeHistoryValueField[];
}

export type OrderChangeHistoryRemovalKind = 'ITEM' | 'PIECE' | 'PREFERENCE';

export interface OrderChangeHistoryRemovalView {
  kind: OrderChangeHistoryRemovalKind;
  id: string;
  label: string;
  label2: string | null;
  quantity: string | null;
  code: string | null;
  level: string | null;
  extraPrice: string | null;
  parentLabel: string | null;
  parentLabel2: string | null;
  deletedAt: string | null;
}

export interface OrderChangeHistoryDetailItem {
  id: string;
  changeNo: number;
  revisionBefore: number;
  revisionAfter: number;
  workflowVersionExpected: number;
  sourceContext: string;
  legacy: boolean;
  actorName: string | null;
  reason: string | null;
  currencyCode: string;
  commercialDelta: string;
  financialOutcome: string;
  appliedAt: string;
  financialBefore: OrderChangeHistoryValueField[];
  financialAfter: OrderChangeHistoryValueField[];
  context: OrderChangeHistoryValueField[];
  operations: OrderChangeHistoryOperationView[];
  removals: OrderChangeHistoryRemovalView[];
}

export interface OrderChangeHistoryPage {
  items: OrderChangeHistoryDetailItem[];
  nextCursor: number | null;
  totalCount: number;
}

export interface OrderChangeHistoryHeaderInput {
  id: string;
  changeNo: number;
  revisionBefore: number;
  revisionAfter: number;
  workflowVersionExpected: number;
  sourceContext: string;
  actorName: string | null;
  reason: string | null;
  currencyCode: string;
  commercialDelta: string;
  financialOutcome: string;
  appliedAt: string;
  financialBefore: unknown;
  financialAfter: unknown;
  metadata: unknown;
}

export interface OrderChangeHistoryOperationInput {
  orderChangeId: string;
  seq: number;
  code: string;
  targetType: string;
  orderItemId: string | null;
  orderItemPieceId: string | null;
  orderPreferenceId: string | null;
  clientRef: string | null;
  auditSummary: string | null;
  beforeValues: unknown;
  afterValues: unknown;
}

export interface OrderChangeHistoryItemInput {
  id: string;
  deletedOrderChangeId: string | null;
  label: string | null;
  label2: string | null;
  quantity: string | null;
  code: string | null;
  deletedAt: string | null;
}

export interface OrderChangeHistoryPieceInput {
  id: string;
  deletedOrderChangeId: string | null;
  orderItemId: string | null;
  label: string | null;
  label2: string | null;
  quantity: string | null;
  code: string | null;
  deletedAt: string | null;
}

export interface OrderChangeHistoryPreferenceInput {
  id: string;
  deletedOrderChangeId: string | null;
  label: string | null;
  label2: string | null;
  level: string | null;
  extraPrice: string | null;
  deletedAt: string | null;
}

/** Current Edit commands use this origin. Any other origin is an earlier update. */
export const ORDER_EDIT_SOURCE_CONTEXT = 'order-edit';

const SENSITIVE_KEY = /proof|secret|token|password|idempotenc|request_hash|authorization|cookie/i;

function textOrNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function formatScalar(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

/** One-level field list. Nested objects stay as JSON. Sensitive keys are dropped. */
export function flattenChangeValues(value: unknown): OrderChangeHistoryValueField[] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  const fields: OrderChangeHistoryValueField[] = [];
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(key)) continue;
    const formatted = formatScalar(raw);
    if (formatted == null) continue;
    fields.push({ key, value: formatted });
  }
  return fields;
}

function itemLabel(item: OrderChangeHistoryItemInput | undefined): { label: string | null; label2: string | null } {
  if (!item) return { label: null, label2: null };
  return { label: textOrNull(item.label) ?? textOrNull(item.code), label2: textOrNull(item.label2) };
}

/**
 * Join one page of Change headers with operations and removal lineage.
 * Headers must already be in display order.
 */
export function assembleOrderChangeHistoryDetail(input: {
  headers: readonly OrderChangeHistoryHeaderInput[];
  operations: readonly OrderChangeHistoryOperationInput[];
  items: readonly OrderChangeHistoryItemInput[];
  pieces: readonly OrderChangeHistoryPieceInput[];
  preferences: readonly OrderChangeHistoryPreferenceInput[];
}): OrderChangeHistoryDetailItem[] {
  const itemsById = new Map(input.items.map((row) => [row.id, row]));
  return input.headers.map((header) => {
    const operations = input.operations
      .filter((operation) => operation.orderChangeId === header.id)
      .sort((left, right) => left.seq - right.seq)
      .map((operation) => {
        const item = operation.orderItemId ? itemsById.get(operation.orderItemId) : undefined;
        const piece = operation.orderItemPieceId
          ? input.pieces.find((row) => row.id === operation.orderItemPieceId)
          : undefined;
        const preference = operation.orderPreferenceId
          ? input.preferences.find((row) => row.id === operation.orderPreferenceId)
          : undefined;
        const target = preference
          ? { label: textOrNull(preference.label), label2: textOrNull(preference.label2) }
          : piece
            ? { label: textOrNull(piece.label) ?? textOrNull(piece.code), label2: textOrNull(piece.label2) }
            : itemLabel(item);
        return {
          seq: operation.seq,
          code: operation.code,
          targetType: operation.targetType,
          targetLabel: target.label,
          targetLabel2: target.label2,
          orderItemId: operation.orderItemId,
          orderItemPieceId: operation.orderItemPieceId,
          orderPreferenceId: operation.orderPreferenceId,
          clientRef: operation.clientRef,
          auditSummary: textOrNull(operation.auditSummary),
          before: flattenChangeValues(operation.beforeValues),
          after: flattenChangeValues(operation.afterValues),
        };
      });

    const removals: OrderChangeHistoryRemovalView[] = [
      ...input.items
        .filter((row) => row.deletedOrderChangeId === header.id)
        .map((row) => ({
          kind: 'ITEM' as const,
          id: row.id,
          label: textOrNull(row.label) ?? textOrNull(row.code) ?? row.id,
          label2: textOrNull(row.label2),
          quantity: textOrNull(row.quantity),
          code: textOrNull(row.code),
          level: null,
          extraPrice: null,
          parentLabel: null,
          parentLabel2: null,
          deletedAt: row.deletedAt,
        })),
      ...input.pieces
        .filter((row) => row.deletedOrderChangeId === header.id)
        .map((row) => ({
          kind: 'PIECE' as const,
          id: row.id,
          label: textOrNull(row.label) ?? textOrNull(row.code) ?? row.id,
          label2: textOrNull(row.label2),
          quantity: textOrNull(row.quantity),
          code: textOrNull(row.code),
          level: null,
          extraPrice: null,
          parentLabel: row.orderItemId ? itemLabel(itemsById.get(row.orderItemId)).label : null,
          parentLabel2: row.orderItemId ? itemLabel(itemsById.get(row.orderItemId)).label2 : null,
          deletedAt: row.deletedAt,
        })),
      ...input.preferences
        .filter((row) => row.deletedOrderChangeId === header.id)
        .map((row) => ({
          kind: 'PREFERENCE' as const,
          id: row.id,
          label: textOrNull(row.label) ?? row.id,
          label2: textOrNull(row.label2),
          quantity: null,
          code: textOrNull(row.label),
          level: textOrNull(row.level),
          extraPrice: textOrNull(row.extraPrice),
          parentLabel: null,
          parentLabel2: null,
          deletedAt: row.deletedAt,
        })),
    ];

    return {
      id: header.id,
      changeNo: header.changeNo,
      revisionBefore: header.revisionBefore,
      revisionAfter: header.revisionAfter,
      workflowVersionExpected: header.workflowVersionExpected,
      sourceContext: header.sourceContext,
      legacy: header.sourceContext !== ORDER_EDIT_SOURCE_CONTEXT,
      actorName: textOrNull(header.actorName),
      reason: textOrNull(header.reason),
      currencyCode: header.currencyCode,
      commercialDelta: header.commercialDelta,
      financialOutcome: header.financialOutcome,
      appliedAt: header.appliedAt,
      financialBefore: flattenChangeValues(header.financialBefore),
      financialAfter: flattenChangeValues(header.financialAfter),
      context: flattenChangeValues(header.metadata),
      operations,
      removals,
    };
  });
}

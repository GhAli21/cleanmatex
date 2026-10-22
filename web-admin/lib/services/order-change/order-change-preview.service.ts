/**
 * Read-only Edit preview. It composes capability, structure, preference,
 * calculation, and financial classification. It does not open a database
 * transaction, write a Change, or redeem a promotion.
 */

import { createHash } from 'node:crypto';
import { ORDER_CHANGE_LIMITS, type OrderChangeOperationCode } from '@/lib/constants/order-change';
import type { OrderChangeContext } from '@/lib/types/order-change';
import type { z } from 'zod';
import type { orderChangeRequestSchema } from '@/lib/validations/order-change/order-change.schemas';
import {
  evaluateOrderChangeCapability,
  issueOrderChangeReviewProof,
  type OrderChangeCapabilityBinding,
  type OrderChangeCapabilityResult,
  type OrderChangeReviewProofBinding,
  type OrderChangeReviewProofKey,
} from '@/lib/services/order-change/order-change-capability.service';
import {
  projectOrderChangeStructure,
  type OrderChangeStructuralOperation,
} from '@/lib/services/order-change/order-change-projection';
import {
  projectOrderChangePreferences,
  type OrderChangePreferenceDefinition,
  type OrderChangePreferenceLevel,
  type OrderChangePreferenceOperation,
} from '@/lib/services/order-change/order-change-preference-projection';
import {
  calculateOrderChangeTotals,
  digestOrderChangeCalculationFingerprint,
  reviewedItemTotal,
  type OrderChangePriceQuote,
  type OrderChangeTaxMode,
} from '@/lib/services/order-change/order-change-calculation.service';
import {
  projectOrderChangeFinancialResult,
  type OrderChangeFinancialResult,
} from '@/lib/services/order-change/order-change-financial-result.service';
import { round4, type AggregationCreditRow, type AggregationPaymentRow } from '@/lib/services/order-financial-aggregation';
import { buildPreviewOperationAudits, type OrderChangeOperationAudit, type OrderChangePreviewAuditFacts } from '@/lib/services/order-change/order-change-review-audit';

type ChangeRequest = z.infer<typeof orderChangeRequestSchema>;
type ChangeOperation = ChangeRequest['operations'][number];

/** Payment rows are bound as a digest so a long settlement history cannot overflow the review proof. */
function digestSettlementSource(payments: readonly AggregationPaymentRow[]): string {
  const raw = payments.map((row) => `${row.payment_status ?? ''}:${String(row.amount)}`).join('|');
  return createHash('sha256').update(`cleanmatex.order-change.settlement-fingerprint.v1.${raw}`).digest('hex');
}

export interface OrderChangePreviewSuccess {
  ok: true;
  status: 'NO_CHANGE' | 'READY' | 'DENIED' | 'REASON_REQUIRED' | 'ACKNOWLEDGEMENT_REQUIRED' | 'SIGNER_UNAVAILABLE';
  createsChange: boolean;
  decisions: OrderChangeCapabilityResult[];
  calculationFingerprint: string | null;
  reviewProof: string | null;
  /** Server-only binding for the issued proof. The preview HTTP response omits it. */
  reviewBinding?: OrderChangeReviewProofBinding | null;
  financial: OrderChangeFinancialResult | null;
  originalTotal: string;
  projectedTotal: string | null;
  projectedTax: string | null;
  displayTotal: string | null;
  projectedItemIds: string[];
  /** Frozen facts for the one speed operation. Apply copies these onto that operation row. */
  speedAudit?: OrderChangeSpeedAudit;
  /** Reviewed line prices. Apply writes these amounts and does not price the line again. */
  lines?: readonly { id: string; active: boolean; unitPrice: string; merchandiseAmount: string }[];
  /** Before and after facts for each operation, in the same columns Apply stores. */
  operationAudits: OrderChangeOperationAudit[];
  followUp: string[];
}

/** One item's selling facts captured for the speed operation audit. */
export interface OrderChangeSpeedAuditItem {
  orderItemId: string;
  quantity: number;
  pricePerUnit: string;
  totalPrice: string;
}

/**
 * The speed decision's facts in one shape.
 * `before` is what was stored. `after` is what this review will store.
 */
export interface OrderChangeSpeedValueSnapshot {
  serviceSpeed: string | null;
  totalAmount: string;
  taxAmount: string;
  commercialDelta: string;
  items: OrderChangeSpeedAuditItem[];
}

/** Before and after snapshots for the single CHANGE_SERVICE_SPEED operation. */
export interface OrderChangeSpeedAudit {
  before: OrderChangeSpeedValueSnapshot;
  after: OrderChangeSpeedValueSnapshot;
}

export interface OrderChangePreviewFailure {
  ok: false;
  status: 409 | 422;
  code: string;
  conflicts?: Array<'EDIT_VERSION_CONFLICT' | 'WORKFLOW_VERSION_CONFLICT'>;
  seq?: number;
}

function preferenceLevel(level: string): OrderChangePreferenceLevel | null {
  if (level === 'ORDER' || level === 'ITEM' || level === 'PIECE') return level;
  return null;
}

function preferenceParent(operation: ChangeOperation): 'ORDER' | 'ITEM' | 'PIECE' | undefined {
  if (operation.code !== 'ADD_PREFERENCE') return undefined;
  if (operation.target.kind === 'ORDER') return 'ORDER';
  if (operation.target.kind === 'PERSISTED_ITEM' || operation.target.kind === 'LOCAL_ITEM') return 'ITEM';
  return 'PIECE';
}

function toStructural(operation: ChangeOperation): OrderChangeStructuralOperation | null {
  if (operation.code === 'ADD_ITEM') {
    return {
      seq: operation.seq,
      code: 'ADD_ITEM',
      target: operation.target,
      payload: { clientRef: operation.payload.clientRef, productId: operation.payload.productId, quantity: operation.payload.quantity },
    };
  }
  if (operation.code === 'REMOVE_ITEM') return { seq: operation.seq, code: 'REMOVE_ITEM', target: operation.target };
  if (operation.code === 'CHANGE_ITEM_QUANTITY') return { seq: operation.seq, code: 'CHANGE_ITEM_QUANTITY', target: operation.target, payload: operation.payload };
  if (operation.code === 'ADD_PIECE') return { seq: operation.seq, code: 'ADD_PIECE', target: operation.target, payload: { clientRef: operation.payload.clientRef } };
  if (operation.code === 'REMOVE_PIECE') return { seq: operation.seq, code: 'REMOVE_PIECE', target: operation.target };
  return null;
}

function toPreference(operation: ChangeOperation): OrderChangePreferenceOperation | null {
  if (operation.code === 'ADD_PREFERENCE') return { seq: operation.seq, code: 'ADD_PREFERENCE', target: operation.target, payload: operation.payload };
  if (operation.code === 'CHANGE_PREFERENCE') return { seq: operation.seq, code: 'CHANGE_PREFERENCE', target: operation.target, payload: operation.payload };
  if (operation.code === 'REMOVE_PREFERENCE') return { seq: operation.seq, code: 'REMOVE_PREFERENCE', target: operation.target };
  return null;
}

function headerChanged(context: OrderChangeContext, operations: readonly ChangeOperation[]): boolean {
  let priority = context.order.priority;
  let serviceSpeed = context.order.serviceSpeed;
  let readyBy = context.order.readyBy;
  let notes = context.order.notes;
  let customerNotes = context.order.customerNotes;
  let name = context.order.customerSnapshot.name;
  let mobile = context.order.customerSnapshot.mobile;
  let email = context.order.customerSnapshot.email;
  for (const operation of operations) {
    if (operation.code === 'CHANGE_PRIORITY') priority = operation.payload.priority;
    if (operation.code === 'CHANGE_SERVICE_SPEED') serviceSpeed = operation.payload.serviceSpeed;
    if (operation.code === 'CHANGE_READY_BY') readyBy = operation.payload.readyBy;
    if (operation.code === 'CHANGE_ORDER_NOTES') {
      if (operation.payload.notes !== undefined) notes = operation.payload.notes;
      if (operation.payload.customerNotes !== undefined) customerNotes = operation.payload.customerNotes;
    }
    if (operation.code === 'CHANGE_CUSTOMER_SNAPSHOT') {
      if (operation.payload.customerName !== undefined) name = operation.payload.customerName;
      if (operation.payload.customerMobile !== undefined) mobile = operation.payload.customerMobile;
      if (operation.payload.customerEmail !== undefined) email = operation.payload.customerEmail;
    }
  }
  return priority !== context.order.priority
    || serviceSpeed !== context.order.serviceSpeed
    || readyBy !== context.order.readyBy
    || notes !== context.order.notes
    || customerNotes !== context.order.customerNotes
    || name !== context.order.customerSnapshot.name
    || mobile !== context.order.customerSnapshot.mobile
    || email !== context.order.customerSnapshot.email;
}

function moneyText(value: string | number): string {
  return round4(Number(value)).toFixed(4);
}

/**
 * Freezes the stored speed facts and the reviewed result in the same shape.
 * Piece rows are omitted because the item quantity already carries their count.
 */
function buildSpeedAudit(input: {
  speedChanged: boolean;
  serviceSpeed: string | null;
  nextServiceSpeed: string | null;
  originalTotal: string;
  originalTax: string;
  projectedTotal: string;
  projectedTax: string;
  items: OrderChangeContext['items'];
  projected: readonly { id: string; quantity: number; active: boolean }[];
  lines: readonly { id: string; active: boolean; unitPrice: string; merchandiseAmount: string; embeddedExtra?: string }[];
}): OrderChangeSpeedAudit | undefined {
  if (!input.speedChanged) return undefined;
  const projectedById = new Map(input.projected.map((item) => [item.id, item]));
  const lineById = new Map(input.lines.map((line) => [line.id, line]));
  const beforeItems: OrderChangeSpeedAuditItem[] = [];
  const afterItems: OrderChangeSpeedAuditItem[] = [];
  for (const item of input.items) {
    const projected = projectedById.get(item.id);
    const line = lineById.get(item.id);
    if (!item.active || !projected?.active || !line?.active || item.quantity == null) continue;
    beforeItems.push({
      orderItemId: item.id,
      quantity: item.quantity,
      pricePerUnit: moneyText(item.pricePerUnit),
      totalPrice: moneyText(item.totalPrice),
    });
    afterItems.push({
      orderItemId: item.id,
      quantity: projected.quantity,
      pricePerUnit: line.unitPrice,
      totalPrice: reviewedItemTotal(line),
    });
  }
  const delta = moneyText(Number(input.projectedTotal) - Number(input.originalTotal));
  return {
    before: {
      serviceSpeed: input.serviceSpeed,
      totalAmount: moneyText(input.originalTotal),
      taxAmount: moneyText(input.originalTax),
      commercialDelta: '0.0000',
      items: beforeItems,
    },
    after: {
      serviceSpeed: input.nextServiceSpeed,
      totalAmount: moneyText(input.projectedTotal),
      taxAmount: moneyText(input.projectedTax),
      commercialDelta: delta,
      items: afterItems,
    },
  };
}

function parsedDate(value: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Builds one preview from already loaded facts.
 * The same facts and clock produce the same fingerprint and proof.
 */
export async function previewOrderChange(input: {
  now?: Date;
  tenantId: string;
  actorUserId: string;
  featureEnabled: boolean;
  canUsePermission: (permission: string) => Promise<boolean>;
  context: OrderChangeContext;
  request: ChangeRequest;
  bindings: readonly OrderChangeCapabilityBinding[];
  quotesByTargetId: Readonly<Record<string, OrderChangePriceQuote>>;
  catalog: readonly OrderChangePreferenceDefinition[];
  taxMode: OrderChangeTaxMode;
  taxRatePercent: string;
  currencyDecimalPlaces: number;
  payments: readonly AggregationPaymentRow[];
  credits: readonly AggregationCreditRow[];
  refunds: readonly Array<{ refund_status: string | null; refund_amount: string; reopens_due_amount: string }>;
  /** Kept in the total when Express is not part of this change. A speed change replaces it on the items. */
  persistedExpressAmount?: string;
  /** Stored order tax at preview time. The speed audit freezes this as the tax before the decision. */
  persistedTaxAmount?: string;
  /** Stored commercial rows for the review. Context is used when a row was not loaded. */
  auditFacts?: OrderChangePreviewAuditFacts;
  proofKey: OrderChangeReviewProofKey | null;
}): Promise<OrderChangePreviewSuccess | OrderChangePreviewFailure> {
  const conflicts: Array<'EDIT_VERSION_CONFLICT' | 'WORKFLOW_VERSION_CONFLICT'> = [];
  if (input.request.expectedEditStateVersion !== input.context.editStateVersion) conflicts.push('EDIT_VERSION_CONFLICT');
  if (input.request.expectedWfStateVersion !== input.context.wfStateVersion) conflicts.push('WORKFLOW_VERSION_CONFLICT');
  if (conflicts.length > 0) return { ok: false, status: 409, code: conflicts.length === 1 ? conflicts[0] : 'VERSION_CONFLICT', conflicts };
  const expectedPolicy = input.request.expectedPolicy;
  if (expectedPolicy) {
    const currentId = input.bindings[0]?.editPolicyId ?? null;
    const currentRevision = input.bindings[0]?.policyRevision ?? null;
    if (expectedPolicy.editPolicyId !== currentId || expectedPolicy.policyRevision !== currentRevision) {
      return { ok: false, status: 409, code: 'POLICY_CHANGED_REVIEW_REQUIRED' };
    }
  }

  const structural = input.request.operations.flatMap((operation) => {
    const mapped = toStructural(operation);
    return mapped ? [mapped] : [];
  });
  const preferences = input.request.operations.flatMap((operation) => {
    const mapped = toPreference(operation);
    return mapped ? [mapped] : [];
  });
  const preferenceRows = [];
  for (const row of input.context.preferences) {
    const level = preferenceLevel(row.level);
    if (!level) return { ok: false, status: 422, code: 'PREFERENCE_LEVEL_MISMATCH' };
    preferenceRows.push({
      id: row.id,
      level,
      orderItemId: row.orderItemId,
      orderItemPieceId: row.orderItemPieceId,
      preferenceId: row.preferenceId ?? '',
      preferenceCode: row.preferenceCode,
      preferenceKind: row.preferenceKind ?? '',
      preferenceCategory: row.preferenceCategory ?? '',
      preferenceContent: row.preferenceContent,
      extraPrice: row.extraPrice,
      processingConfirmed: row.processingConfirmed,
      active: true as const,
    });
  }
  const baseline = {
    items: input.context.items.map((item) => ({
      id: item.id,
      productId: item.productId ?? '',
      quantity: item.quantity ?? 1,
      pieceTracked: input.context.pieces.some((piece) => piece.orderItemId === item.id),
      active: true as const,
    })),
    pieces: input.context.pieces.map((piece) => ({ id: piece.id, itemId: piece.orderItemId, active: true as const, operationallyProtected: false })),
  };
  const projectedPreferences = projectOrderChangePreferences({
    baseline,
    preferences: preferenceRows,
    catalog: input.catalog,
    structuralOperations: structural,
    operations: preferences,
  });
  if (!projectedPreferences.ok) return { ok: false, status: 422, code: projectedPreferences.issue.code, seq: projectedPreferences.issue.seq };
  const structure = projectOrderChangeStructure(baseline, structural);
  if (!structure.ok) return { ok: false, status: 422, code: structure.issue.code, seq: structure.issue.seq };

  const decisions: OrderChangeCapabilityResult[] = [];
  for (const operation of input.request.operations) {
    decisions.push(await evaluateOrderChangeCapability({
      now: input.now,
      facts: {
        committedAt: parsedDate(input.context.committedAt),
        featureEnabled: input.featureEnabled,
        editAccessStatus: input.context.editAccess.status,
        editBlockedUntil: parsedDate(input.context.editAccess.blockedUntil),
        workflowStatus: input.context.workflow.currentStatus,
        editStateVersion: input.context.editStateVersion,
        wfStateVersion: input.context.wfStateVersion,
      },
      actor: { actorUserId: input.actorUserId, canUsePermission: input.canUsePermission },
      operation: {
        seq: operation.seq,
        code: operation.code as OrderChangeOperationCode,
        preferenceParentTargetType: preferenceParent(operation),
        hasReason: Boolean(input.request.changeReason?.trim()),
      },
      bindings: input.bindings,
    }));
  }

  const denied = decisions.some((decision) => decision.decision === 'DENY');
  const reasonMissing = !input.request.changeReason?.trim()
    && decisions.some((decision) => decision.requiresReason && decision.decision !== 'DENY');
  const acknowledgementMissing = decisions.some((decision) =>
    decision.requiresAcknowledgement
    && !input.request.gateDecisions?.some((gate) => gate.seq === decision.seq && gate.acknowledgementChallenge),
  );
  const header = headerChanged(input.context, input.request.operations);
  const speedChanged = input.request.operations.some((operation) => operation.code === 'CHANGE_SERVICE_SPEED' && operation.payload.serviceSpeed !== input.context.order.serviceSpeed);
  const unlisted = input.request.operations.some((operation) => operation.code === 'CHANGE_UNLISTED');
  const createsChange = structure.createsChange || projectedPreferences.createsChange || header || unlisted;
  const activeItemIds = structure.items.filter((item) => item.active).map((item) => item.id);
  if (!createsChange || denied) {
    return {
      ok: true,
      status: denied ? 'DENIED' : 'NO_CHANGE',
      createsChange: false,
      decisions,
      calculationFingerprint: null,
      reviewProof: null,
      financial: null,
      originalTotal: input.context.financial.totalAmount,
      projectedTotal: null,
      projectedTax: null,
      displayTotal: null,
      projectedItemIds: activeItemIds,
      lines: [],
      operationAudits: buildPreviewOperationAudits({
        context: input.context,
        operations: input.request.operations,
        lines: [],
        catalog: input.catalog,
        auditFacts: input.auditFacts,
      }),
      followUp: [],
    };
  }

  const speedAmount = speedChanged ? '0.0000' : round4(Number(input.persistedExpressAmount ?? '0')).toFixed(4);
  const calculated = calculateOrderChangeTotals({
    lines: structure.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      active: item.active,
      repriced: !input.context.items.some((current) => current.id === item.id) || (speedChanged && Boolean(input.quotesByTargetId[item.id])),
      persistedUnitPrice: input.context.items.find((current) => current.id === item.id)?.pricePerUnit ?? '0.0000',
      quote: input.quotesByTargetId[item.id],
      lineEmbeddedExtra: projectedPreferences.charges.lineEmbeddedByItemId[item.id] ?? '0.0000',
    })),
    taxMode: input.taxMode,
    taxRatePercent: input.taxRatePercent,
    currencyDecimalPlaces: input.currencyDecimalPlaces,
    overrideAllowed: await input.canUsePermission('orders:edit_override'),
    orderPreferenceAddend: projectedPreferences.charges.orderAddend,
    orderSpeedAddend: speedAmount,
  });
  if (!calculated.ok) return { ok: false, status: 422, code: calculated.issue.code };
  const calculationFingerprint = digestOrderChangeCalculationFingerprint(calculated.fingerprint);

  const financial = projectOrderChangeFinancialResult({
    projectedTotal: calculated.totalAmount,
    projectedTax: calculated.taxAmount,
    payments: input.payments,
    credits: input.credits,
    refunds: input.refunds,
  });
  const policy = decisions.find((decision) => decision.policyIdentity)?.policyIdentity ?? null;
  const financiallyBlocked = financial.outcome === 'DENIED';
  const reviewBinding: OrderChangeReviewProofBinding | null = policy
    ? {
      tenantId: input.tenantId,
      orderId: input.context.orderId,
      actorUserId: input.actorUserId,
      expectedEditStateVersion: input.request.expectedEditStateVersion,
      expectedWfStateVersion: input.request.expectedWfStateVersion,
      sourceContext: input.request.sourceContext,
      canonicalIntent: input.request.operations,
      changeReason: input.request.changeReason ?? null,
      gateDecisions: input.request.gateDecisions ?? [],
      policyIdentity: policy,
      policyFacts: decisions,
      calculationFingerprint,
      settlementSourceFingerprint: digestSettlementSource(input.payments),
    }
    : null;
  const issuedProof = !reasonMissing && !acknowledgementMissing && !financiallyBlocked && input.proofKey && reviewBinding
    ? issueOrderChangeReviewProof({ now: input.now, key: input.proofKey, binding: reviewBinding })
    : null;
  if (issuedProof && issuedProof.length > ORDER_CHANGE_LIMITS.MAX_REVIEW_PROOF_LENGTH) {
    return { ok: false, status: 422, code: 'REVIEW_PROOF_TOO_LARGE' };
  }
  const reviewProof = issuedProof;
  const speedAudit = buildSpeedAudit({
    speedChanged,
    serviceSpeed: input.context.order.serviceSpeed,
    nextServiceSpeed: input.request.operations.reduce<string | null>((speed, operation) => (
      operation.code === 'CHANGE_SERVICE_SPEED' ? operation.payload.serviceSpeed : speed
    ), null),
    originalTotal: input.context.financial.totalAmount,
    originalTax: input.persistedTaxAmount ?? '0.0000',
    projectedTotal: calculated.totalAmount,
    projectedTax: calculated.taxAmount,
    items: input.context.items,
    projected: structure.items,
    lines: calculated.lines,
  });

  return {
    ok: true,
    status: financiallyBlocked || denied
      ? 'DENIED'
      : reasonMissing
        ? 'REASON_REQUIRED'
        : acknowledgementMissing
          ? 'ACKNOWLEDGEMENT_REQUIRED'
          : reviewProof
            ? 'READY'
            : 'SIGNER_UNAVAILABLE',
    createsChange: true,
    decisions,
    calculationFingerprint,
    reviewProof,
    reviewBinding,
    financial,
    originalTotal: input.context.financial.totalAmount,
    projectedTotal: calculated.totalAmount,
    projectedTax: calculated.taxAmount,
    displayTotal: calculated.displayTotal,
    projectedItemIds: activeItemIds,
    speedAudit,
    lines: calculated.lines,
    operationAudits: buildPreviewOperationAudits({
      context: input.context,
      operations: input.request.operations,
      lines: calculated.lines,
      catalog: input.catalog,
      speedAudit,
      auditFacts: input.auditFacts,
    }),
    followUp: financial.warnings.map((warning) => warning.code),
  };
}

/**
 * Read-only Edit preview. It composes capability, structure, preference,
 * calculation, and financial classification. It does not open a database
 * transaction, write a Change, or redeem a promotion.
 */

import { createHash } from 'node:crypto';
import { subMoney, toMoneyString } from '@/lib/utils/money';
import { resolveOrderChangeKnownFieldOperation, ORDER_CHANGE_LIMITS, type OrderChangeOperationCode } from '@/lib/constants/order-change';
import type { OrderChangeEditPolicyResolution } from '@/lib/services/order-change/order-change-edit-policy-resolver.service';
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
  digestOrderChangeCalculationFingerprint,
  editCalculationFingerprint,
  editPricingErrorCode,
  editProjectionOf,
  lineMoneyChangesOf,
  lockedSpeedLineIds,
  orderChangeNeedsPricing,
  reviewedItemTotal,
  reviewedLinesOf,
  speedChangesOf,
  type OrderChangeEditPricer,
  type OrderChangeReviewedLine,
} from '@/lib/services/order-change/order-change-edit-pricing';
import type { EditQuote } from '@/lib/services/commercial/commercial-edit.loader';
import { findEditPriceChanges, type EditPriceChangedLine } from '@/lib/services/commercial/price-confirmation';
import { DISCOUNT_CHANGE_OUTCOMES, DISCOUNT_REMOVED_GATE, discountRemovedGateCode, type DiscountChange } from '@/lib/services/commercial/edit-discount-reevaluation';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { PRICE_OVERRIDE_ERRORS } from '@/lib/services/price-override-policy.service';
import { sameLineDiscount, sameOptionalMoney } from '@/lib/services/order-change/order-change-line-money-compare';
import {
  projectOrderChangeFinancialResult,
  type OrderChangeFinancialResult,
} from '@/lib/services/order-change/order-change-financial-result.service';
import type { AggregationCreditRow, AggregationPaymentRow } from '@/lib/services/order-financial-aggregation';
import { buildPreviewOperationAudits, digestOrderChangeOperationAudits, type OrderChangeOperationAudit, type OrderChangePreviewAuditFacts } from '@/lib/services/order-change/order-change-review-audit';

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
  lines?: readonly OrderChangeReviewedLine[];
  /**
   * Server-only: the calculated order behind the review (P6-01b). Apply stores
   * it; the preview HTTP response omits it. Absent for an edit that is not re-priced.
   */
  commercial?: EditQuote;
  /** Before and after facts for each operation, in the same columns Apply stores. */
  operationAudits: OrderChangeOperationAudit[];
  followUp: string[];
  /** Added lines whose calculated price is not the one the cart showed (P6-02e); Review lists them. */
  priceChanges?: EditPriceChangedLine[];
  /** Each recorded order discount after the edit (D21); a removal needs a `DISCOUNT_REMOVED:<key>` acknowledgement. */
  discountChanges?: DiscountChange[];
}

/** One item's selling facts captured for the speed operation audit. */
export interface OrderChangeSpeedAuditItem {
  orderItemId: string;
  /** The line's speed code (P6-02b): lines of one order can differ. */
  serviceSpeed: string | null;
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

/** Before and after snapshots of the whole order, shared by every CHANGE_SERVICE_SPEED operation of a review. */
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
      // A custom item (P6-02d) has no catalog product.
      payload: { clientRef: operation.payload.clientRef, productId: operation.payload.productId ?? '', quantity: operation.payload.quantity },
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
    if (operation.code === 'CHANGE_SERVICE_SPEED' && operation.target.kind === 'ORDER') serviceSpeed = operation.payload.serviceSpeed;
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
  return toMoneyString(value);
}

/**
 * Freezes the stored speed facts and the reviewed result in the same shape.
 * Piece rows are omitted because the item quantity already carries their count.
 */
function buildSpeedAudit(input: {
  speedChanged: boolean;
  serviceSpeed: string | null;
  nextServiceSpeed: string | null;
  /** The speed of each line after the edit, by lower-case item id. */
  nextLineSpeeds: ReadonlyMap<string, string | null>;
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
      serviceSpeed: item.serviceSpeed ?? input.serviceSpeed,
      quantity: item.quantity,
      pricePerUnit: moneyText(item.pricePerUnit),
      totalPrice: moneyText(item.totalPrice),
    });
    afterItems.push({
      orderItemId: item.id,
      serviceSpeed: input.nextLineSpeeds.get(item.id.toLowerCase()) ?? null,
      quantity: projected.quantity,
      pricePerUnit: line.unitPrice,
      totalPrice: reviewedItemTotal(line),
    });
  }
  const delta = toMoneyString(subMoney(input.projectedTotal, input.originalTotal));
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
  /** Keeps the winning identity visible even when the current status has no rules. */
  policyResolution?: OrderChangeEditPolicyResolution;
  /** Prices the projected order on the commercial calculator; called only for an edit that changes money. */
  priceEdit: OrderChangeEditPricer;
  catalog: readonly OrderChangePreferenceDefinition[];
  payments: readonly AggregationPaymentRow[];
  credits: readonly AggregationCreditRow[];
  refunds: ReadonlyArray<{ refund_status: string | null; refund_amount: string; reopens_due_amount: string }>;
  /** Stored order tax at preview time. The speed audit freezes this as the tax before the decision. */
  persistedTaxAmount?: string;
  /** Stored commercial rows for the review. Context is used when a row was not loaded. */
  auditFacts?: OrderChangePreviewAuditFacts;
  proofKey: OrderChangeReviewProofKey | null;
}): Promise<OrderChangePreviewSuccess | OrderChangePreviewFailure> {
  if (input.request.operations.some((operation) => operation.code === 'CHANGE_UNLISTED' && resolveOrderChangeKnownFieldOperation(operation.payload.field))) {
    return { ok: false, status: 422, code: 'OPERATION_NOT_AVAILABLE' };
  }
  const conflicts: Array<'EDIT_VERSION_CONFLICT' | 'WORKFLOW_VERSION_CONFLICT'> = [];
  if (input.request.expectedEditStateVersion !== input.context.editStateVersion) conflicts.push('EDIT_VERSION_CONFLICT');
  if (input.request.expectedWfStateVersion !== input.context.wfStateVersion) conflicts.push('WORKFLOW_VERSION_CONFLICT');
  if (conflicts.length > 0) return { ok: false, status: 409, code: conflicts.length === 1 ? conflicts[0] : 'VERSION_CONFLICT', conflicts };
  const expectedPolicy = input.request.expectedPolicy;
  if (expectedPolicy) {
    const currentId = input.policyResolution?.editPolicyId ?? input.bindings[0]?.editPolicyId ?? null;
    const currentRevision = input.policyResolution?.policyRevision ?? input.bindings[0]?.policyRevision ?? null;
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
  if (projectedPreferences.ok === false) return { ok: false, status: 422, code: projectedPreferences.issue.code, seq: projectedPreferences.issue.seq };
  const structure = projectOrderChangeStructure(baseline, structural);
  if (structure.ok === false) return { ok: false, status: 422, code: structure.issue.code, seq: structure.issue.seq };

  // A cashier price or discount (P6-02c) targets a stored line that stays on the order.
  const activeLineIds = new Set(structure.items.filter((item) => item.active).map((item) => item.id.toLowerCase()));
  const storedLineIds = new Set(input.context.items.map((item) => item.id.toLowerCase()));
  const strayLineMoney = input.request.operations.find((operation) => (operation.code === 'CHANGE_ITEM_PRICE' || operation.code === 'CHANGE_DISCOUNT')
    && !(operation.target.kind === 'PERSISTED_PIECE'
      ? input.context.pieces.some((piece) => piece.id.toLowerCase() === operation.target.id.toLowerCase())
      : storedLineIds.has(operation.target.id.toLowerCase()) && activeLineIds.has(operation.target.id.toLowerCase())));
  if (strayLineMoney) return { ok: false, status: 422, code: 'UPDATE_NOT_ACTIVE', seq: strayLineMoney.seq };

  // A ready line keeps its speed (P6-02b): refuse the operation that would move it.
  const lockedLines = lockedSpeedLineIds(
    input.context,
    input.request.operations,
    new Set(structure.items.filter((item) => item.active).map((item) => item.id.toLowerCase())),
  );
  const { orderSpeed, lineSpeeds } = speedChangesOf(input.request.operations);
  const speedLocked = (operation: ChangeOperation): boolean => {
    if (operation.code !== 'CHANGE_SERVICE_SPEED' || lockedLines.size === 0) return false;
    if (operation.target.kind !== 'ORDER') return lockedLines.has(operation.target.id.toLowerCase());
    return [...lockedLines].some((id) => !lineSpeeds.has(id));
  };

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
        targetType: operation.code === 'CHANGE_UNLISTED' || operation.code === 'CHANGE_SERVICE_SPEED' || operation.code === 'CHANGE_DISCOUNT'
          ? operation.target.kind === 'PERSISTED_ITEM' ? 'ITEM' : operation.target.kind === 'PERSISTED_PIECE' ? 'PIECE' : operation.target.kind === 'PERSISTED_PREFERENCE' ? 'PREFERENCE' : 'ORDER'
          : undefined,
        hasReason: Boolean(input.request.changeReason?.trim()),
        hardDenial: speedLocked(operation)
          ? { code: 'LINE_SPEED_LOCKED', messageKey: 'orderChange.capability.lineSpeedLocked' }
          : null,
      },
      bindings: input.bindings,
    }));
  }

  const denied = decisions.some((decision) => decision.decision === 'DENY');
  // Residual catalog permission is required but supplies no arbitrary-column
  // writer. Reject an allowed unknown field until its explicit handler ships.
  if (!denied && input.request.operations.some((operation) => operation.code === 'CHANGE_UNLISTED')) {
    return { ok: false, status: 422, code: 'OPERATION_NOT_AVAILABLE' };
  }
  const reasonMissing = !input.request.changeReason?.trim()
    && decisions.some((decision) => decision.requiresReason && decision.decision !== 'DENY');
  const acknowledgementMissing = decisions.some((decision) =>
    decision.requiresAcknowledgement
    && !input.request.gateDecisions?.some((gate) => gate.seq === decision.seq && gate.acknowledgementChallenge
      && !gate.gateCode.startsWith(DISCOUNT_REMOVED_GATE)),
  );
  const header = headerChanged(input.context, input.request.operations);
  // Each stored line's speed after the edit: its own, else the new order speed, else unchanged.
  const nextLineSpeeds = new Map(input.context.items.map((item) => {
    const id = item.id.toLowerCase();
    return [id, lineSpeeds.get(id) ?? orderSpeed ?? item.serviceSpeed ?? input.context.order.serviceSpeed] as const;
  }));
  const lineSpeedChanged = input.context.items.some((item) => (
    lineSpeeds.has(item.id.toLowerCase())
    && nextLineSpeeds.get(item.id.toLowerCase()) !== (item.serviceSpeed ?? input.context.order.serviceSpeed)
  ));
  // A piece's own speed (P9-01); the same speed as stored changes nothing.
  const { pieceSpeeds } = speedChangesOf(input.request.operations);
  const pieceSpeedChanged = input.context.pieces.some((piece) => {
    const next = pieceSpeeds.get(piece.id.toLowerCase());
    return next !== undefined && next !== piece.serviceSpeed;
  });
  const speedChanged = (orderSpeed !== null && orderSpeed !== input.context.order.serviceSpeed) || lineSpeedChanged || pieceSpeedChanged;
  // A cashier price or discount equal to the stored one changes nothing (P6-02c).
  const { prices, discounts, pieceDiscounts } = lineMoneyChangesOf(input.request.operations);
  const pieceMoneyChanged = pieceSpeedChanged || input.context.pieces.some((piece) => {
    const key = piece.id.toLowerCase();
    return pieceDiscounts.has(key) && !sameLineDiscount(pieceDiscounts.get(key) ?? null, piece.lineDiscount ?? null);
  });
  const lineMoneyChanged = input.context.items.some((item) => {
    const key = item.id.toLowerCase();
    const price = prices.get(key);
    const priceMoved = price !== undefined && (!sameOptionalMoney(price.priceOverride, item.priceOverride)
      || (price.priceOverride !== null && price.overrideReason !== (item.overrideReason ?? null)));
    return priceMoved || (discounts.has(key) && !sameLineDiscount(discounts.get(key) ?? null, item.lineDiscount ?? null));
  });
  const unlisted = input.request.operations.some((operation) => operation.code === 'CHANGE_UNLISTED');
  const createsChange = structure.createsChange || projectedPreferences.createsChange || header || lineSpeedChanged || lineMoneyChanged || pieceMoneyChanged || unlisted;
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

  // ─── Pricing (P6-01b): the calculator, or no re-pricing for a header-only edit (EC-08) ─
  const editedAt = input.now ?? new Date();
  let pricing: {
    totalAmount: string; taxAmount: string; displayTotal: string; fingerprint: string;
    lines: OrderChangeReviewedLine[]; commercial?: EditQuote;
  };
  if (orderChangeNeedsPricing(input.request.operations, input.context.order.serviceSpeed)) {
    // A new line's cashier price needs the Edit override permission, as before.
    const overridden = input.request.operations.some((operation) => operation.code === 'ADD_ITEM' && operation.payload.priceOverride !== undefined);
    if (overridden && !(await input.canUsePermission('orders:edit_override'))) {
      return { ok: false, status: 422, code: 'OVERRIDE_REQUIRED' };
    }
    // A stored line's cashier price or discount needs the permission Create asks for (P6-02c).
    // A custom item's entered price is a price decision too (P6-02d), as on Create.
    if (input.request.operations.some((operation) => operation.code === 'CHANGE_ITEM_PRICE' || (operation.code === 'ADD_ITEM' && operation.payload.customItem))
      && !(await input.canUsePermission(ORDERS_PERMISSIONS.PRICING_OVERRIDE))) {
      return { ok: false, status: 422, code: PRICE_OVERRIDE_ERRORS.PRICE_OVERRIDE_NOT_PERMITTED };
    }
    if (input.request.operations.some((operation) => operation.code === 'CHANGE_DISCOUNT' || (operation.code === 'ADD_ITEM' && operation.payload.lineDiscount))
      && !(await input.canUsePermission(ORDERS_PERMISSIONS.DISCOUNT))) {
      return { ok: false, status: 422, code: PRICE_OVERRIDE_ERRORS.LINE_DISCOUNT_NOT_PERMITTED };
    }
    let commercial: EditQuote;
    try {
      commercial = await input.priceEdit(editProjectionOf({
        context: input.context,
        items: structure.items,
        pieces: structure.pieces,
        preferences: projectedPreferences.preferences,
        operations: input.request.operations,
        editedAt,
      }));
    } catch (error) {
      const code = editPricingErrorCode(error);
      if (!code) throw error;
      return { ok: false, status: 422, code };
    }
    const { result } = commercial.quote;
    pricing = {
      totalAmount: result.totals.totalAmount.toFixed(4),
      taxAmount: result.totals.taxTotal.toFixed(4),
      displayTotal: result.totals.totalAmount.toFixed(result.decimalPlaces),
      fingerprint: editCalculationFingerprint(result),
      lines: reviewedLinesOf(result, structure.items),
      commercial,
    };
  } else {
    // Notes, ready-by or priority: the order keeps its figures.
    pricing = {
      totalAmount: moneyText(input.context.financial.totalAmount),
      taxAmount: moneyText(input.persistedTaxAmount ?? '0'),
      displayTotal: moneyText(input.context.financial.totalAmount),
      fingerprint: `UNPRICED|${moneyText(input.context.financial.totalAmount)}`,
      lines: [],
    };
  }
  const calculated = { ...pricing, ok: true as const };
  // D21: a recorded discount the edit removes is never dropped silently; the cashier acknowledges each one.
  const discountChanges = calculated.commercial?.discountChanges ?? [];
  const discountAckMissing = discountChanges.some((change) => change.outcome === DISCOUNT_CHANGE_OUTCOMES.REMOVED
    && !input.request.gateDecisions?.some((gate) => gate.gateCode === discountRemovedGateCode(change.key) && gate.acknowledgementChallenge));
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
  const speedAudit = buildSpeedAudit({
    speedChanged,
    serviceSpeed: input.context.order.serviceSpeed,
    nextServiceSpeed: orderSpeed ?? input.context.order.serviceSpeed,
    nextLineSpeeds,
    originalTotal: input.context.financial.totalAmount,
    originalTax: input.persistedTaxAmount ?? '0.0000',
    projectedTotal: calculated.totalAmount,
    projectedTax: calculated.taxAmount,
    items: input.context.items,
    projected: structure.items,
    lines: calculated.lines,
  });
  const operationAudits = buildPreviewOperationAudits({
    context: input.context,
    operations: input.request.operations,
    lines: calculated.lines,
    catalog: input.catalog,
    speedAudit,
    auditFacts: input.auditFacts,
    pieceTotals: new Map((calculated.commercial?.quote.result.lines ?? [])
      .flatMap((line) => line.pieces.map((piece) => [piece.rowId.toLowerCase(), piece.money.grossAmount.toFixed(4)] as const))),
    projectedTotal: calculated.totalAmount,
    projectedTax: calculated.taxAmount,
  });

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
      operationSnapshotDigest: digestOrderChangeOperationAudits(operationAudits),
    }
    : null;
  const issuedProof = !reasonMissing && !acknowledgementMissing && !discountAckMissing && !financiallyBlocked && input.proofKey && reviewBinding
    ? issueOrderChangeReviewProof({ now: input.now, key: input.proofKey, binding: reviewBinding })
    : null;
  if (issuedProof && issuedProof.length > ORDER_CHANGE_LIMITS.MAX_REVIEW_PROOF_LENGTH) {
    return { ok: false, status: 422, code: 'REVIEW_PROOF_TOO_LARGE' };
  }
  const reviewProof = issuedProof;


  return {
    ok: true,
    status: financiallyBlocked || denied
      ? 'DENIED'
      : reasonMissing
        ? 'REASON_REQUIRED'
        : acknowledgementMissing || discountAckMissing
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
    commercial: calculated.commercial,
    operationAudits,
    followUp: financial.warnings.map((warning) => warning.code),
    priceChanges: calculated.commercial
      ? findEditPriceChanges(input.request.operations.flatMap((operation) => (
        operation.code === 'ADD_ITEM' && operation.payload.confirmedUnitPrice !== undefined
          ? [{ seq: operation.seq, orderItemId: operation.payload.clientRef, confirmedUnitPrice: operation.payload.confirmedUnitPrice }]
          : []
      )), calculated.commercial.quote.result)
      : [],
    discountChanges,
  };
}

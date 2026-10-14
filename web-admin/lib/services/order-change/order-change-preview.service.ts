/**
 * Read-only Edit preview. It composes capability, structure, preference,
 * calculation, and financial classification. It does not open a database
 * transaction, write a Change, or redeem a promotion.
 */

import type { OrderChangeOperationCode } from '@/lib/constants/order-change';
import type { OrderChangeContext } from '@/lib/types/order-change';
import type { z } from 'zod';
import type { orderChangeRequestSchema } from '@/lib/validations/order-change/order-change.schemas';
import {
  evaluateOrderChangeCapability,
  issueOrderChangeReviewProof,
  type OrderChangeCapabilityBinding,
  type OrderChangeCapabilityResult,
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
  type OrderChangePriceQuote,
  type OrderChangeTaxMode,
} from '@/lib/services/order-change/order-change-calculation.service';
import {
  projectOrderChangeFinancialResult,
  type OrderChangeFinancialResult,
} from '@/lib/services/order-change/order-change-financial-result.service';
import type { AggregationCreditRow, AggregationPaymentRow } from '@/lib/services/order-financial-aggregation';

type ChangeRequest = z.infer<typeof orderChangeRequestSchema>;
type ChangeOperation = ChangeRequest['operations'][number];

export interface OrderChangePreviewSuccess {
  ok: true;
  status: 'NO_CHANGE' | 'READY' | 'DENIED' | 'ACKNOWLEDGEMENT_REQUIRED' | 'SIGNER_UNAVAILABLE';
  createsChange: boolean;
  decisions: OrderChangeCapabilityResult[];
  calculationFingerprint: string | null;
  reviewProof: string | null;
  financial: OrderChangeFinancialResult | null;
  originalTotal: string;
  projectedTotal: string | null;
  projectedTax: string | null;
  displayTotal: string | null;
  projectedItemIds: string[];
  followUp: string[];
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
  proofKey: OrderChangeReviewProofKey | null;
}): Promise<OrderChangePreviewSuccess | OrderChangePreviewFailure> {
  const conflicts: Array<'EDIT_VERSION_CONFLICT' | 'WORKFLOW_VERSION_CONFLICT'> = [];
  if (input.request.expectedEditStateVersion !== input.context.editStateVersion) conflicts.push('EDIT_VERSION_CONFLICT');
  if (input.request.expectedWfStateVersion !== input.context.wfStateVersion) conflicts.push('WORKFLOW_VERSION_CONFLICT');
  if (conflicts.length > 0) return { ok: false, status: 409, code: conflicts.length === 1 ? conflicts[0] : 'VERSION_CONFLICT', conflicts };

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
        hasReason: Boolean(input.request.changeReason),
      },
      bindings: input.bindings,
    }));
  }

  const denied = decisions.some((decision) => decision.decision === 'DENY');
  const acknowledgementMissing = decisions.some((decision) =>
    decision.requiresAcknowledgement
    && !input.request.gateDecisions?.some((gate) => gate.seq === decision.seq && gate.acknowledgementChallenge),
  );
  const header = headerChanged(input.context, input.request.operations);
  const speedChanged = input.request.operations.some((operation) => operation.code === 'CHANGE_SERVICE_SPEED' && operation.payload.serviceSpeed !== input.context.order.serviceSpeed);
  const createsChange = structure.createsChange || projectedPreferences.createsChange || header;
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
      followUp: [],
    };
  }

  const calculated = calculateOrderChangeTotals({
    lines: structure.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      active: item.active,
      repriced: speedChanged || !input.context.items.some((current) => current.id === item.id),
      persistedUnitPrice: input.context.items.find((current) => current.id === item.id)?.pricePerUnit ?? '0.0000',
      quote: input.quotesByTargetId[item.id],
      lineEmbeddedExtra: projectedPreferences.charges.lineEmbeddedByItemId[item.id] ?? '0.0000',
    })),
    taxMode: input.taxMode,
    taxRatePercent: input.taxRatePercent,
    currencyDecimalPlaces: input.currencyDecimalPlaces,
    overrideAllowed: await input.canUsePermission('orders:edit_override'),
    orderPreferenceAddend: projectedPreferences.charges.orderAddend,
  });
  if (!calculated.ok) return { ok: false, status: 422, code: calculated.issue.code };

  const financial = projectOrderChangeFinancialResult({
    projectedTotal: calculated.totalAmount,
    projectedTax: calculated.taxAmount,
    payments: input.payments,
    credits: input.credits,
    refunds: input.refunds,
  });
  const policy = decisions.find((decision) => decision.policyIdentity)?.policyIdentity ?? null;
  const financiallyBlocked = financial.outcome === 'DENIED';
  const reviewProof = !acknowledgementMissing && !financiallyBlocked && input.proofKey && policy
    ? issueOrderChangeReviewProof({
      now: input.now,
      key: input.proofKey,
      binding: {
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
        calculationFingerprint: calculated.fingerprint,
        settlementSourceFingerprint: input.payments.map((row) => `${row.payment_status}:${String(row.amount)}`).join('|'),
      },
    })
    : null;

  return {
    ok: true,
    status: financiallyBlocked || denied
      ? 'DENIED'
      : acknowledgementMissing
        ? 'ACKNOWLEDGEMENT_REQUIRED'
        : reviewProof
          ? 'READY'
          : 'SIGNER_UNAVAILABLE',
    createsChange: true,
    decisions,
    calculationFingerprint: calculated.fingerprint,
    reviewProof,
    financial,
    originalTotal: input.context.financial.totalAmount,
    projectedTotal: calculated.totalAmount,
    projectedTax: calculated.taxAmount,
    displayTotal: calculated.displayTotal,
    projectedItemIds: activeItemIds,
    followUp: financial.warnings.map((warning) => warning.code),
  };
}

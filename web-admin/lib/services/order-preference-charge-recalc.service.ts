/**
 * Slice 5 — opt-in historical ITEM/PIECE PREFERENCE charge cleanup.
 * Preview + confirm only. Flag default OFF. Never changes total_paid_amount.
 */
import 'server-only';

import { randomUUID } from 'node:crypto';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { CHARGE_TYPES, TAX_DOCUMENT_STATUSES, TAX_PRICING_MODES } from '@/lib/constants/order-financial';
import type { TaxPricingMode } from '@/lib/types/order-financial';
import { canAccess } from '@/lib/services/feature-flags.service';
import { resolveTaxPricingMode } from '@/lib/services/pricing-mode-resolver.service';
import {
  recalculateOrderFinancialSnapshotTx,
  resolveCanonicalTotalAmount,
} from '@/lib/services/order-financial-write.service';
import { voidContaminatingPreferenceChargesTx } from '@/lib/services/order-charge.service';
import {
  isContaminatingPreferenceCharge,
  mapPreferenceLevels,
  sumContaminatingPreferenceCharges,
  sumMoneyAddendCharges,
} from '@/lib/utils/order-charge-money';
import {
  claimIdempotencyKey,
  findIdempotencyHash,
  hashPayload,
  storeIdempotencyHash,
} from '@/lib/utils/idempotency';

export const PREF_CHARGE_RECALC_FLAG = 'order_fin_pref_charge_recalc' as const;
export const PREF_CHARGE_RECALC_REASON = 'preference double-count correction';
export const PREF_CHARGE_RECALC_IDEMPOTENCY_RESOURCE = 'pref_charge_recalc';
export const PREF_CHARGE_RECALC_DEFAULT_LIMIT = 25;
export const PREF_CHARGE_RECALC_MAX_LIMIT = 50;

export class PreferenceChargeRecalcError extends Error {
  code:
    | 'FLAG_DISABLED'
    | 'IDEMPOTENCY_KEY_REQUIRED'
    | 'IDEMPOTENCY_CONFLICT'
    | 'IDEMPOTENCY_IN_PROGRESS';

  constructor(code: PreferenceChargeRecalcError['code'], message: string) {
    super(message);
    this.name = 'PreferenceChargeRecalcError';
    this.code = code;
  }
}

export interface PreferenceChargeRecalcPreviewRow {
  orderId: string;
  orderNo: string;
  currentTotal: number;
  proposedTotal: number;
  contaminatingChargeAmount: number;
  contaminatingChargeCount: number;
  currentOutstanding: number;
  proposedOutstanding: number;
  totalPaidAmount: number;
  blocked: boolean;
  blockReason: 'ISSUED_TAX_DOCUMENT' | null;
}

export interface PreferenceChargeRecalcPreview {
  eligible: PreferenceChargeRecalcPreviewRow[];
  blocked: PreferenceChargeRecalcPreviewRow[];
  skippedClean: number;
}

export interface PreferenceChargeRecalcConfirmResult {
  batchId: string;
  applied: Array<{
    orderId: string;
    orderNo: string;
    previousTotal: number;
    newTotal: number;
    voidedChargeCount: number;
    editHistoryId: string;
  }>;
  blocked: PreferenceChargeRecalcPreviewRow[];
  skippedClean: number;
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function previewPreferenceChargeCorrection(input: {
  currentTotal: number;
  itemsBaseAmount: number;
  moneyAddendCharges: number;
  totalDiscountAmount: number;
  totalTaxAmount: number;
  roundingAdjustmentAmount: number;
  taxPricingMode: TaxPricingMode;
  totalPaidAmount: number;
  totalCreditAppliedAmount: number;
  contaminatingChargeAmount: number;
}): {
  proposedTotal: number;
  proposedOutstanding: number;
  currentOutstanding: number;
  delta: number;
  contaminatingChargeAmount: number;
} {
  const { totalAmount: proposedTotal } = resolveCanonicalTotalAmount({
    itemsBaseAmount: input.itemsBaseAmount,
    totalChargesAmount: input.moneyAddendCharges,
    totalDiscountAmount: input.totalDiscountAmount,
    totalTaxAmount: input.totalTaxAmount,
    roundingAdjustmentAmount: input.roundingAdjustmentAmount,
    headerTotalAmount: input.currentTotal,
    taxPricingMode: input.taxPricingMode,
  });
  const currentOutstanding = round4(
    Math.max(0, input.currentTotal - input.totalPaidAmount - input.totalCreditAppliedAmount),
  );
  const proposedOutstanding = round4(
    Math.max(0, proposedTotal - input.totalPaidAmount - input.totalCreditAppliedAmount),
  );
  return {
    proposedTotal,
    proposedOutstanding,
    currentOutstanding,
    delta: round4(proposedTotal - input.currentTotal),
    contaminatingChargeAmount: input.contaminatingChargeAmount,
  };
}

async function assertFlagEnabled(tenantId: string): Promise<void> {
  const enabled = await canAccess(tenantId, PREF_CHARGE_RECALC_FLAG);
  if (!enabled) {
    throw new PreferenceChargeRecalcError(
      'FLAG_DISABLED',
      'order_fin_pref_charge_recalc is off for this tenant.',
    );
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit == null) return PREF_CHARGE_RECALC_DEFAULT_LIMIT;
  return Math.min(PREF_CHARGE_RECALC_MAX_LIMIT, Math.max(1, Math.floor(limit)));
}

async function loadContaminatingByOrder(
  tenantId: string,
  orderIds?: string[],
): Promise<Map<string, Array<{ id: string; amount: number; charge_source_id: string | null }>>> {
  const charges = await prisma.org_order_charges_dtl.findMany({
    where: {
      tenant_org_id: tenantId,
      is_voided: false,
      charge_type: CHARGE_TYPES.PREFERENCE,
      ...(orderIds?.length ? { order_id: { in: orderIds } } : {}),
    },
    select: { id: true, order_id: true, amount: true, charge_source_id: true, charge_type: true },
  });
  const sourceIds = [
    ...new Set(charges.map((row) => row.charge_source_id).filter((id): id is string => Boolean(id))),
  ];
  const prefs = sourceIds.length
    ? await prisma.org_order_preferences_dtl.findMany({
        where: { tenant_org_id: tenantId, id: { in: sourceIds } },
        select: { id: true, prefs_level: true },
      })
    : [];
  const levels = mapPreferenceLevels(prefs);
  const byOrder = new Map<string, Array<{ id: string; amount: number; charge_source_id: string | null }>>();
  for (const row of charges) {
    if (!isContaminatingPreferenceCharge(row, levels)) continue;
    const list = byOrder.get(row.order_id) ?? [];
    list.push({
      id: row.id,
      amount: toNumber(row.amount),
      charge_source_id: row.charge_source_id,
    });
    byOrder.set(row.order_id, list);
  }
  return byOrder;
}

async function buildPreviewRows(
  tenantId: string,
  contaminatingByOrder: Map<string, Array<{ id: string; amount: number; charge_source_id: string | null }>>,
  limit: number,
): Promise<PreferenceChargeRecalcPreview> {
  const orderIds = [...contaminatingByOrder.keys()].slice(0, limit);
  if (orderIds.length === 0) {
    return { eligible: [], blocked: [], skippedClean: 0 };
  }

  const [orders, issuedDocs, prefs, charges] = await Promise.all([
    prisma.org_orders_mst.findMany({
      where: { tenant_org_id: tenantId, id: { in: orderIds } },
      select: {
        id: true,
        order_no: true,
        total_amount: true,
        items_base_amount: true,
        total_discount_amount: true,
        total_tax_amount: true,
        rounding_adjustment_amount: true,
        total_paid_amount: true,
        total_credit_applied_amount: true,
        branch_id: true,
      },
    }),
    prisma.org_tax_documents_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        order_id: { in: orderIds },
        status: TAX_DOCUMENT_STATUSES.ISSUED,
        is_active: true,
      },
      select: { order_id: true },
    }),
    prisma.org_order_preferences_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: { in: orderIds } },
      select: { id: true, prefs_level: true },
    }),
    prisma.org_order_charges_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: { in: orderIds }, is_voided: false },
      select: { order_id: true, amount: true, charge_type: true, charge_source_id: true },
    }),
  ]);

  const issuedOrderIds = new Set(issuedDocs.map((row) => row.order_id));
  const taxModeByBranch = new Map<string, TaxPricingMode>();
  for (const order of orders) {
    const branchKey = order.branch_id ?? '';
    if (!taxModeByBranch.has(branchKey)) {
      taxModeByBranch.set(
        branchKey,
        await resolveTaxPricingMode(prisma, tenantId, order.branch_id ?? null),
      );
    }
  }
  const levels = mapPreferenceLevels(prefs);
  const chargesByOrder = new Map<string, typeof charges>();
  for (const row of charges) {
    const list = chargesByOrder.get(row.order_id) ?? [];
    list.push(row);
    chargesByOrder.set(row.order_id, list);
  }

  const eligible: PreferenceChargeRecalcPreviewRow[] = [];
  const blocked: PreferenceChargeRecalcPreviewRow[] = [];

  for (const order of orders) {
    const contaminating = contaminatingByOrder.get(order.id) ?? [];
    const orderCharges = chargesByOrder.get(order.id) ?? [];
    const math = previewPreferenceChargeCorrection({
      currentTotal: toNumber(order.total_amount),
      itemsBaseAmount: toNumber(order.items_base_amount),
      moneyAddendCharges: sumMoneyAddendCharges(orderCharges, levels),
      totalDiscountAmount: toNumber(order.total_discount_amount),
      totalTaxAmount: toNumber(order.total_tax_amount),
      roundingAdjustmentAmount: toNumber(order.rounding_adjustment_amount),
      taxPricingMode: taxModeByBranch.get(order.branch_id ?? '') ?? TAX_PRICING_MODES.TAX_EXCLUSIVE,
      totalPaidAmount: toNumber(order.total_paid_amount),
      totalCreditAppliedAmount: toNumber(order.total_credit_applied_amount),
      contaminatingChargeAmount: sumContaminatingPreferenceCharges(orderCharges, levels),
    });
    const row: PreferenceChargeRecalcPreviewRow = {
      orderId: order.id,
      orderNo: order.order_no,
      currentTotal: toNumber(order.total_amount),
      proposedTotal: math.proposedTotal,
      contaminatingChargeAmount: math.contaminatingChargeAmount,
      contaminatingChargeCount: contaminating.length,
      currentOutstanding: math.currentOutstanding,
      proposedOutstanding: math.proposedOutstanding,
      totalPaidAmount: toNumber(order.total_paid_amount),
      blocked: issuedOrderIds.has(order.id),
      blockReason: issuedOrderIds.has(order.id) ? 'ISSUED_TAX_DOCUMENT' : null,
    };
    if (row.blocked) blocked.push(row);
    else eligible.push(row);
  }

  return { eligible, blocked, skippedClean: 0 };
}

export async function previewPreferenceChargeRecalc(params: {
  tenantId: string;
  orderIds?: string[];
  limit?: number;
}): Promise<PreferenceChargeRecalcPreview> {
  await assertFlagEnabled(params.tenantId);
  const contaminatingByOrder = await loadContaminatingByOrder(params.tenantId, params.orderIds);
  const preview = await buildPreviewRows(
    params.tenantId,
    contaminatingByOrder,
    clampLimit(params.limit),
  );
  const requested = params.orderIds?.length ?? 0;
  preview.skippedClean = requested > 0
    ? Math.max(0, requested - preview.eligible.length - preview.blocked.length)
    : 0;
  return preview;
}

export async function confirmPreferenceChargeRecalc(params: {
  tenantId: string;
  userId: string;
  userName?: string | null;
  orderIds?: string[];
  limit?: number;
  idempotencyKey?: string | null;
}): Promise<PreferenceChargeRecalcConfirmResult> {
  await assertFlagEnabled(params.tenantId);
  if (!params.idempotencyKey?.trim()) {
    throw new PreferenceChargeRecalcError(
      'IDEMPOTENCY_KEY_REQUIRED',
      'An idempotency key is required to confirm preference-charge recalc.',
    );
  }

  const payloadHash = hashPayload({
    orderIds: params.orderIds ?? [],
    limit: clampLimit(params.limit),
  });
  const claim = await claimIdempotencyKey(
    params.tenantId,
    params.idempotencyKey,
    PREF_CHARGE_RECALC_IDEMPOTENCY_RESOURCE,
    payloadHash,
  );

  if (claim.status === 'CONFLICT') {
    throw new PreferenceChargeRecalcError(
      'IDEMPOTENCY_CONFLICT',
      'This idempotency key was already used for a different recalc payload.',
    );
  }
  if (claim.status === 'IN_FLIGHT') {
    throw new PreferenceChargeRecalcError(
      'IDEMPOTENCY_IN_PROGRESS',
      'A recalc with this idempotency key is already running.',
    );
  }
  if (claim.status === 'COMPLETED') {
    const cached = await findIdempotencyHash(
      params.tenantId,
      params.idempotencyKey,
      PREF_CHARGE_RECALC_IDEMPOTENCY_RESOURCE,
    );
    const row = await prisma.org_idempotency_keys.findFirst({
      where: {
        tenant_org_id: params.tenantId,
        key: params.idempotencyKey,
        resource_type: PREF_CHARGE_RECALC_IDEMPOTENCY_RESOURCE,
      },
      select: { response_cache: true, resource_id: true },
    });
    const cache = row?.response_cache as { result?: PreferenceChargeRecalcConfirmResult } | null;
    if (cache?.result) return cache.result;
    return {
      batchId: cached?.resourceId ?? claim.resourceId,
      applied: [],
      blocked: [],
      skippedClean: 0,
    };
  }

  const preview = await previewPreferenceChargeRecalc({
    tenantId: params.tenantId,
    orderIds: params.orderIds,
    limit: params.limit,
  });
  const contaminatingByOrder = await loadContaminatingByOrder(params.tenantId, preview.eligible.map((row) => row.orderId));
  const batchId = randomUUID();
  const applied: PreferenceChargeRecalcConfirmResult['applied'] = [];

  for (const row of preview.eligible) {
    const chargeIds = (contaminatingByOrder.get(row.orderId) ?? []).map((charge) => charge.id);
    const result = await prisma.$transaction(async (tx) => {
      const orderBefore = await tx.org_orders_mst.findFirst({
        where: { tenant_org_id: params.tenantId, id: row.orderId },
        select: {
          id: true,
          order_no: true,
          total_amount: true,
          total_paid_amount: true,
          items_base_amount: true,
          total_discount_amount: true,
          total_tax_amount: true,
        },
      });
      if (!orderBefore) return null;

      const issued = await tx.org_tax_documents_mst.findFirst({
        where: {
          tenant_org_id: params.tenantId,
          order_id: row.orderId,
          status: TAX_DOCUMENT_STATUSES.ISSUED,
          is_active: true,
        },
        select: { id: true },
      });
      if (issued) return null;

      const previousTotal = toNumber(orderBefore.total_amount);
      const voidedChargeCount = await voidContaminatingPreferenceChargesTx(tx, {
        tenantId: params.tenantId,
        orderId: row.orderId,
        userId: params.userId,
        reason: PREF_CHARGE_RECALC_REASON,
        chargeIds,
      });

      await recalculateOrderFinancialSnapshotTx(tx, params.tenantId, row.orderId);

      const orderAfter = await tx.org_orders_mst.findFirstOrThrow({
        where: { tenant_org_id: params.tenantId, id: row.orderId },
        select: {
          total_amount: true,
          items_base_amount: true,
        },
      });

      const lastEdit = await tx.org_order_edit_history.findFirst({
        where: { tenant_org_id: params.tenantId, order_id: row.orderId },
        orderBy: { edit_number: 'desc' },
        select: { edit_number: true },
      });
      const newTotal = toNumber(orderAfter.total_amount);
      const snapshotBefore = {
        order: { total: previousTotal, subtotal: toNumber(orderBefore.items_base_amount) },
        items: [],
      };
      const snapshotAfter = {
        order: { total: newTotal, subtotal: toNumber(orderAfter.items_base_amount) },
        items: [],
      };
      const audit = await tx.org_order_edit_history.create({
        data: {
          tenant_org_id: params.tenantId,
          order_id: row.orderId,
          order_no: orderBefore.order_no,
          edit_number: (lastEdit?.edit_number || 0) + 1,
          edited_by: params.userId,
          edited_by_name: params.userName ?? null,
          edited_at: new Date(),
          snapshot_before: snapshotBefore,
          snapshot_after: snapshotAfter,
          changes: {
            fields: [],
            items: { added: [], removed: [], modified: [] },
            preferences: { added: [], removed: [], modified: [] },
            pieces: { added: [], removed: [], modified: [] },
            pricing: {
              oldSubtotal: toNumber(orderBefore.items_base_amount),
              newSubtotal: toNumber(orderAfter.items_base_amount),
              oldTotal: previousTotal,
              newTotal,
              difference: round4(newTotal - previousTotal),
              percentageChange: previousTotal === 0
                ? 0
                : round4(((newTotal - previousTotal) / previousTotal) * 100),
            },
          },
          change_summary: `${PREF_CHARGE_RECALC_REASON}: ${orderBefore.order_no} ${previousTotal.toFixed(3)} → ${newTotal.toFixed(3)}`,
          payment_adjusted: false,
          edit_reason: PREF_CHARGE_RECALC_REASON,
        },
      });

      return {
        orderId: row.orderId,
        orderNo: orderBefore.order_no,
        previousTotal,
        newTotal,
        voidedChargeCount,
        editHistoryId: audit.id,
      };
    });
    if (result) applied.push(result);
  }

  const confirmResult: PreferenceChargeRecalcConfirmResult = {
    batchId,
    applied,
    blocked: preview.blocked,
    skippedClean: preview.skippedClean,
  };

  await storeIdempotencyHash(
    params.tenantId,
    params.idempotencyKey,
    PREF_CHARGE_RECALC_IDEMPOTENCY_RESOURCE,
    payloadHash,
    batchId,
  );
  await prisma.org_idempotency_keys.updateMany({
    where: {
      tenant_org_id: params.tenantId,
      key: params.idempotencyKey,
      resource_type: PREF_CHARGE_RECALC_IDEMPOTENCY_RESOURCE,
    },
    data: {
      response_cache: {
        payload_hash: payloadHash,
        result: confirmResult,
      } as unknown as Prisma.InputJsonValue,
    },
  });

  return confirmResult;
}

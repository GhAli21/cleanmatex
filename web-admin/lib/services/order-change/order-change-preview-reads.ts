/**
 * Read-side facts for Edit preview. Queries filter tenant_org_id directly.
 * This module does not insert, update, or delete commercial rows.
 */

import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { createClient } from '@/lib/supabase/server';
import { getFeatureFlags } from '@/lib/services/feature-flags.service';
import { pricingService } from '@/lib/services/pricing.service';
import { resolveTaxPricingMode } from '@/lib/services/pricing-mode-resolver.service';
import { createTenantSettingsService } from '@/lib/services/tenant-settings.service';
import { TaxService } from '@/lib/services/tax.service';
import type { OrderChangeContext } from '@/lib/types/order-change';
import type { z } from 'zod';
import type { orderChangeRequestSchema } from '@/lib/validations/order-change/order-change.schemas';
import type { OrderChangeCapabilityBinding, OrderChangeReviewProofKey } from '@/lib/services/order-change/order-change-capability.service';
import type { OrderChangePriceQuote, OrderChangeTaxMode } from '@/lib/services/order-change/order-change-calculation.service';
import { resolveOrderChangePolicyBindings } from '@/lib/services/order-change/order-change-edit-policy-resolver.service';
import type { OrderChangePreferenceDefinition, OrderChangePreferenceLevel } from '@/lib/services/order-change/order-change-preference-projection';
import type { AggregationCreditRow, AggregationPaymentRow } from '@/lib/services/order-financial-aggregation';

type ChangeOperation = z.infer<typeof orderChangeRequestSchema>['operations'][number];

/** Typed read failure so the route can keep the V3 envelope. */
export class OrderChangePreviewReadError extends Error {
  constructor(
    readonly code: 'CURRENCY_UNRESOLVED' | 'PRICE_UNRESOLVED' | 'TAX_CONTEXT_UNAVAILABLE',
    readonly status: 422,
  ) {
    super(code);
    this.name = 'OrderChangePreviewReadError';
  }
}

export interface OrderChangePreviewFacts {
  featureEnabled: boolean;
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
}

function decimalText(value: { toString(): string } | number | string | null | undefined): string {
  return value == null ? '0.0000' : String(value);
}

function money4(value: number): string {
  return value.toFixed(4);
}

function parentLevel(operation: Extract<ChangeOperation, { code: 'ADD_PREFERENCE' }>): OrderChangePreferenceLevel {
  if (operation.target.kind === 'ORDER') return 'ORDER';
  if (operation.target.kind === 'PERSISTED_PIECE' || operation.target.kind === 'LOCAL_PIECE') return 'PIECE';
  return 'ITEM';
}

async function quoteFor(input: {
  tenantId: string;
  actorUserId: string;
  branchId: string | null;
  customerId: string | null;
  productId: string;
  quantity: number;
  isExpress: boolean;
}): Promise<OrderChangePriceQuote> {
  try {
    const price = await pricingService.getPriceForOrderItem({
      tenantId: input.tenantId,
      productId: input.productId,
      quantity: input.quantity,
      isExpress: input.isExpress,
      customerId: input.customerId ?? undefined,
      branchId: input.branchId,
      userId: input.actorUserId,
    });
    return {
      basePrice: money4(price.basePrice),
      finalPrice: money4(price.finalPrice),
      discountPercent: money4(price.discountPercent),
    };
  } catch {
    throw new OrderChangePreviewReadError('PRICE_UNRESOLVED', 422);
  }
}

/**
 * Loads the current flag, policy bindings, settlement rows, quotes, tax, and currency places.
 * Preference catalog rows are tenant-filtered. Their level follows the server-derived parent
 * because the organization preference table does not store a separate level.
 */
export async function loadOrderChangePreviewFacts(input: {
  tenantId: string;
  actorUserId: string;
  context: OrderChangeContext;
  operations: readonly ChangeOperation[];
}): Promise<OrderChangePreviewFacts> {
  return withTenantContext(input.tenantId, async (tenantId) => {
    const flags = await getFeatureFlags(tenantId);
    const preferenceIds = [...new Set(input.operations.flatMap((operation) => operation.code === 'ADD_PREFERENCE' ? [operation.payload.preferenceId] : []))];
    const settlement = await prisma.$transaction(async (tx) => {
      const bindings = await resolveOrderChangePolicyBindings(tx, {
        tenantId,
        profileVersionId: input.context.workflow.profileVersionId,
        workflowStatus: input.context.workflow.currentStatus,
      });
      const payments = await tx.org_order_payments_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: input.context.orderId, rec_status: 1 },
        select: { amount: true, payment_status: true, payment_nature_snapshot: true, payment_method_code: true },
      });
      const credits = await tx.org_order_credit_apps_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: input.context.orderId, rec_status: 1 },
        select: { applied_amount: true, application_status: true },
      });
      const refunds = await tx.org_order_refunds_dtl.findMany({
        where: { tenant_org_id: tenantId, order_id: input.context.orderId, rec_status: 1 },
        select: { refund_status: true, refund_amount: true, reopens_due_amount: true },
      });
      const preferences = preferenceIds.length === 0
        ? []
        : await tx.org_service_preference_cf.findMany({
          where: { tenant_org_id: tenantId, id: { in: preferenceIds }, is_active: true, rec_status: 1 },
          select: { id: true, preference_code: true, extra_price: true, preference_category: true, preference_sys_kind: true },
        });
      return { bindings, payments, credits, refunds, preferences };
    });

    const catalog: OrderChangePreferenceDefinition[] = [];
    for (const preferenceId of preferenceIds) {
      const operation = input.operations.find((candidate) => candidate.code === 'ADD_PREFERENCE' && candidate.payload.preferenceId === preferenceId);
      const row = settlement.preferences.find((candidate) => candidate.id === preferenceId);
      if (!operation || operation.code !== 'ADD_PREFERENCE' || !row || row.preference_code !== operation.payload.preferenceCode) continue;
      catalog.push({
        id: row.id,
        code: row.preference_code,
        kind: row.preference_sys_kind,
        category: row.preference_category ?? '',
        level: parentLevel(operation),
        extraPrice: decimalText(row.extra_price),
      });
    }

    const supabase = await createClient();
    const settings = createTenantSettingsService(supabase);
    let currencyDecimalPlaces: number;
    try {
      currencyDecimalPlaces = (await settings.getCurrencyConfig(tenantId, input.context.order.branchId, input.actorUserId)).decimalPlaces;
    } catch {
      throw new OrderChangePreviewReadError('CURRENCY_UNRESOLVED', 422);
    }
    let taxMode: OrderChangeTaxMode;
    try {
      taxMode = await resolveTaxPricingMode(prisma, tenantId, input.context.order.branchId);
    } catch {
      throw new OrderChangePreviewReadError('TAX_CONTEXT_UNAVAILABLE', 422);
    }
    const taxFraction = await new TaxService({ tenantSettings: settings }).getTaxRate(tenantId, input.context.order.branchId, input.actorUserId);
    const expressOperation = input.operations.find((operation) => operation.code === 'CHANGE_SERVICE_SPEED');
    const isExpress = expressOperation
      ? expressOperation.payload.serviceSpeed === 'EXPRESS'
      : input.context.order.serviceSpeed === 'EXPRESS';
    const quotesByTargetId: Record<string, OrderChangePriceQuote> = {};
    if (expressOperation && expressOperation.payload.serviceSpeed !== input.context.order.serviceSpeed) {
      for (const item of input.context.items) {
        if (!item.productId) continue;
        quotesByTargetId[item.id] = await quoteFor({
          tenantId,
          actorUserId: input.actorUserId,
          branchId: input.context.order.branchId,
          customerId: input.context.order.customer.id,
          productId: item.productId,
          quantity: item.quantity ?? 1,
          isExpress,
        });
      }
    }
    for (const operation of input.operations) {
      if (operation.code !== 'ADD_ITEM') continue;
      quotesByTargetId[operation.payload.clientRef] = await quoteFor({
        tenantId,
        actorUserId: input.actorUserId,
        branchId: input.context.order.branchId,
        customerId: input.context.order.customer.id,
        productId: operation.payload.productId,
        quantity: operation.payload.quantity,
        isExpress,
      });
    }

    const secret = process.env.ORDER_CHANGE_REVIEW_PROOF_SECRET;
    const keyId = process.env.ORDER_CHANGE_REVIEW_PROOF_KEY_ID;
    return {
      featureEnabled: flags.order_edit_v2 === true,
      bindings: settlement.bindings,
      quotesByTargetId,
      catalog,
      taxMode,
      taxRatePercent: money4(taxFraction * 100),
      currencyDecimalPlaces,
      payments: settlement.payments.map((row) => ({
        amount: decimalText(row.amount),
        payment_status: row.payment_status,
        payment_nature_snapshot: row.payment_nature_snapshot,
        payment_method_code: row.payment_method_code,
      })),
      credits: settlement.credits.map((row) => ({
        applied_amount: decimalText(row.applied_amount),
        application_status: row.application_status,
      })),
      refunds: settlement.refunds.map((row) => ({
        refund_status: row.refund_status,
        refund_amount: decimalText(row.refund_amount),
        reopens_due_amount: decimalText(row.reopens_due_amount),
      })),
      proofKey: secret && keyId ? { keyId, secret } : null,
    };
  });
}

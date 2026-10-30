/**
 * Create an order from a checkout quote (ADR-060): the one way a calculated
 * order is written. The staff submit (with payment) and the customer booking
 * (without payment) both use these steps, so every channel stores the same
 * figures for the same cart.
 *
 * Steps, in the caller's transaction:
 *   1. `OrderService.createOrderInTransaction` — header, lines, pieces,
 *      preferences, discounts, charges and tax lines from the quote.
 *   2. `settleOrderTx` — payment facts (none for an unpaid order) and the
 *      header rollup.
 *   3. Tax-document issuance when the tenant enabled it (non-blocking).
 *   4. The initial commitment (`committed_at`, `edit_state_version = 1`), so
 *      the order is edited only through Order Edit.
 */

import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { TAX_TYPES, TAX_DOCUMENT_TRIGGER_EVENTS } from '@/lib/constants/order-financial';
import { OrderService, type CreateOrderParams, type CreateOrderResult } from '@/lib/services/order-service';
import type { CheckoutQuote } from '@/lib/services/commercial/commercial-checkout.service';
import { settleOrderTx } from '@/lib/services/order-settlement.service';
import { maybeIssueTaxDocumentTx } from '@/lib/services/tax-document-issuance.service';
import type { FinancialBreakdownSnapshot, TaxLineItem } from '@/lib/types/order-financial';
import { logger } from '@/lib/utils/logger';

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/** The header totals Create stores for a quoted order (its money columns come from the quote). */
export type CheckoutCreateTotals = NonNullable<CreateOrderParams['totals']>;

/**
 * The header totals for `createOrderInTransaction`, from the quote.
 * The header tax is not passed: Create stores the quote's whole tax itself.
 * @param checkout the checkout quote the order is created from
 * @returns the totals object of `CreateOrderParams`
 * @example
 * const totals = checkoutCreateTotals(await quoteCheckout(params));
 */
export function checkoutCreateTotals(checkout: CheckoutQuote): CheckoutCreateTotals {
  const t = checkout.totals;
  const customLines = t.taxBreakdown.filter((line) => line.taxType === TAX_TYPES.CUSTOM);
  return {
    subtotal: t.subtotal,
    discount: t.manualDiscount + t.autoRuleDiscount + t.promoDiscount,
    total: t.saleTotal,
    vatRate: t.vatTaxPercent,
    // Only a single CUSTOM profile line maps to one unambiguous rate; with
    // none (or several stacked) there is no single rate to report.
    taxRate: customLines.length === 1 ? customLines[0].rate : undefined,
    roundingAdjustment: t.roundingAdjustmentAmount,
    chargesTotal: t.chargesTotal,
  };
}

/**
 * The settlement breakdown of a quoted order.
 * @param checkout the checkout quote
 * @param settlement what the submit settles now: credits applied, payment legs and what stays owed
 * @returns the breakdown `settleOrderTx` records
 * @example
 * const breakdown = checkoutBreakdown(checkout, { creditsTotal: 0, paymentLegsTotal: 0, outstanding: checkout.totals.saleTotal });
 */
export function checkoutBreakdown(
  checkout: CheckoutQuote,
  settlement: { creditsTotal: number; paymentLegsTotal: number; outstanding: number },
): FinancialBreakdownSnapshot {
  const t = checkout.totals;
  // No tax profile configured: the TENANT_VAT_RATE fallback is the only tax
  // line possible here; CUSTOM lines come from profiles, so there are none.
  const taxLines: TaxLineItem[] = t.taxBreakdown.length > 0
    ? t.taxBreakdown
    : t.vatValue > 0
      ? [{
        taxType: TAX_TYPES.VAT,
        label: 'VAT',
        label2: 'ضريبة القيمة المضافة',
        rate: t.vatTaxPercent,
        isCompound: false,
        baseAmount: t.afterDiscounts,
        taxAmount: t.vatValue,
      }]
      : [];
  return {
    subtotal: t.subtotal,
    chargesTotal: 0,
    grossTotal: t.subtotal,
    discountTotal: t.manualDiscount + t.autoRuleDiscount + t.promoDiscount,
    netBeforeTax: t.afterDiscounts,
    taxBreakdown: taxLines,
    taxTotal: taxLines.reduce((sum, line) => sum + line.taxAmount, 0),
    grandTotal: t.saleTotal,
    // Informational: the balance debited through voucher CREDIT_APPLICATION lines.
    creditsTotal: settlement.creditsTotal,
    netReceivable: Math.max(0, t.saleTotal - settlement.creditsTotal),
    paymentLegsTotal: settlement.paymentLegsTotal,
    changeReturned: 0,
    outstanding: settlement.outstanding,
    currencyCode: t.currencyCode,
    decimalPlaces: t.decimalPlaces,
  };
}

/**
 * Issues the order's tax document when the tenant enabled it on submit.
 * A savepoint keeps a failure from aborting the caller's transaction, so a
 * fiscal side effect can never take down order creation (D007).
 * @param tx the caller's transaction
 * @param params the order, its branch and status, and who issued it
 */
export async function issueSubmitTaxDocumentTx(
  tx: PrismaTx,
  params: { tenantId: string; orderId: string; branchId: string | null; orderStatus: string; issuedBy: string },
): Promise<void> {
  await tx.$executeRaw`SAVEPOINT submit_tax_document`;
  try {
    await maybeIssueTaxDocumentTx(tx, {
      tenantId: params.tenantId,
      orderId: params.orderId,
      branchId: params.branchId,
      triggerEvent: TAX_DOCUMENT_TRIGGER_EVENTS.ON_ORDER_SUBMIT,
      orderStatus: params.orderStatus,
      issuedBy: params.issuedBy,
    });
    await tx.$executeRaw`RELEASE SAVEPOINT submit_tax_document`;
  } catch (error) {
    await tx.$executeRaw`ROLLBACK TO SAVEPOINT submit_tax_document`;
    await tx.$executeRaw`RELEASE SAVEPOINT submit_tax_document`;
    logger.error('[order-create] Tax-document issuance failed (non-blocking)', error as Error, {
      feature: 'orders', action: 'submit_order_tax_document', orderId: params.orderId, tenantId: params.tenantId,
    });
  }
}

/**
 * Records the order's initial commitment. The update is conditional, so a
 * replay or an unexpected state never replaces the first commitment.
 * @param tx the caller's transaction
 * @param params the order and the staff user who committed it; null for a
 *   customer channel (`committed_by` references `auth.users`)
 * @throws Error('ORDER_INITIAL_COMMIT_CONFLICT') when the order was already committed
 */
export async function commitInitialOrderTx(
  tx: PrismaTx,
  params: { tenantId: string; orderId: string; committedBy: string | null },
): Promise<void> {
  const count = await tx.$executeRaw`
    UPDATE public.org_orders_mst
    SET
      committed_at = clock_timestamp(),
      committed_by = ${params.committedBy}::uuid,
      edit_state_version = 1
    WHERE id = ${params.orderId}::uuid
      AND tenant_org_id = ${params.tenantId}::uuid
      AND committed_at IS NULL
      AND edit_state_version = 0
  `;
  if (Number(count) !== 1) throw new Error('ORDER_INITIAL_COMMIT_CONFLICT');
}

/** Create rejected the order before writing it (source, workflow, retail rule); the transaction is rolled back. */
class CreateOrderRejected extends Error {
  constructor(readonly result: CreateOrderResult) {
    super(result.error ?? 'Order creation failed');
    this.name = 'CreateOrderRejected';
  }
}

/** The order fields of an unpaid create; the money comes from the quote. */
export type UnpaidOrderInput = Omit<CreateOrderParams, 'tenantId' | 'commercial' | 'totals' | 'currencyCode' | 'paymentMethod'>;

/**
 * Creates, settles and commits an unpaid order from a checkout quote, in the caller's transaction.
 * @param tx the caller's transaction
 * @param input `tenantId` (resolved server-side by the caller), the quote, the order fields,
 *   who commits it (a staff user id, or null for a customer channel) and who issues documents
 * @returns the Create result; a rejected Create throws so the caller's transaction rolls back
 * @throws CreateOrderRejected (internal) — use `createUnpaidOrderFromCheckout` for the result form
 */
export async function createUnpaidOrderFromCheckoutTx(
  tx: PrismaTx,
  input: { tenantId: string; checkout: CheckoutQuote; order: UnpaidOrderInput; committedBy: string | null; issuedBy: string },
): Promise<CreateOrderResult & { order: NonNullable<CreateOrderResult['order']> }> {
  const { tenantId, checkout } = input;
  const created = await OrderService.createOrderInTransaction(tx, {
    ...input.order,
    tenantId,
    commercial: checkout,
    totals: checkoutCreateTotals(checkout),
    currencyCode: checkout.totals.currencyCode,
  });
  if (!created.success || !created.order) throw new CreateOrderRejected(created);
  const orderId = created.order.id;

  await settleOrderTx(tx, {
    orderId,
    tenantId,
    breakdown: checkoutBreakdown(checkout, { creditsTotal: 0, paymentLegsTotal: 0, outstanding: checkout.totals.saleTotal }),
    // Create already wrote the charge, tax and discount rows from the quote.
    chargeLines: [],
    taxLines: [],
    discountLines: [],
    settlementLegs: [],
  });
  await issueSubmitTaxDocumentTx(tx, {
    tenantId, orderId, branchId: input.order.branchId ?? null, orderStatus: created.order.currentStatus, issuedBy: input.issuedBy,
  });
  await commitInitialOrderTx(tx, { tenantId, orderId, committedBy: input.committedBy });
  return { ...created, order: created.order };
}

/**
 * Creates, settles and commits an unpaid order from a checkout quote in its own transaction.
 * All Prisma queries are scoped to the tenant (explicit `tenant_org_id` plus the tenant context).
 * @param input see `createUnpaidOrderFromCheckoutTx`
 * @returns the Create result; `success: false` with Create's error when it rejected the order
 * @example
 * const result = await createUnpaidOrderFromCheckout({
 *   tenantId, checkout, committedBy: null, issuedBy: customerId,
 *   order: { customerId, branchId, orderTypeId: 'PICKUP', items, paymentTypeCode: 'PAY_ON_COLLECTION', userId: customerId, orderSourceCode: 'customer_mobile_app' },
 * });
 */
export async function createUnpaidOrderFromCheckout(
  input: { tenantId: string; checkout: CheckoutQuote; order: UnpaidOrderInput; committedBy: string | null; issuedBy: string },
): Promise<CreateOrderResult> {
  try {
    return await withTenantContext(input.tenantId, () =>
      prisma.$transaction((tx) => createUnpaidOrderFromCheckoutTx(tx, input), { maxWait: 10000, timeout: 30000 }));
  } catch (error) {
    if (error instanceof CreateOrderRejected) return error.result;
    throw error;
  }
}

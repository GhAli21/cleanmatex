import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import type { PaymentQuoteData, PaymentQuoteRequest } from '@/lib/types/payment-quote';
import { quoteCheckout } from './commercial/commercial-checkout.service';
import { listEffectivePaymentMethodConfigs } from './payment-config.service';
import { getAvailableStoredValueSummary } from './order-credit-application.service';
import { composeCheckoutOptions } from './checkout-options.service';
import { checkCreditLimit } from './credit-limit.service';
import { createClient } from '@/lib/supabase/server';
import { createTenantSettingsService, SETTING_CODES } from './tenant-settings.service';
import { PaymentQuoteTiming } from './payment-quote-timing';

/** Authenticated scope is injected by the route and is never accepted from quote JSON. */
export interface PaymentQuoteContext {
  /** Server-authenticated Organization scope for every request-local lookup. */
  tenantId: string;
  userId: string;
  canViewStoredValueBalances: boolean;
}

/** Safe failures expose stable codes instead of raw database/provider messages. */
export class PaymentQuoteError extends Error {
  /**
   * Keeps expected failures machine-readable without exposing financial infrastructure details.
   * @param code Stable code resolved to localized feedback by the caller.
   * @param status HTTP classification; defaults to temporary dependency unavailability.
   */
  constructor(readonly code: string, readonly status: 400 | 503 | 504 = 503) {
    super(code);
    this.name = 'PaymentQuoteError';
  }
}

/**
 * Rejects foreign or removed context before calculating a quote for submitted identifiers.
 * @param input Validated request containing optional branch/customer references.
 * @param tenantId Authenticated Organization scope, never a posted tenant identifier.
 * @returns Resolves only when every supplied context reference belongs to the Organization.
 * @throws PaymentQuoteError when a supplied reference cannot be verified in this tenant.
 */
async function assertQuoteContext(input: PaymentQuoteRequest, tenantId: string): Promise<void> {
  // Explicit predicates remain required even inside the tenant guard's async context.
  await withTenantContext(tenantId, async () => {
    const [branch, customer] = await Promise.all([
      input.branchId ? prisma.org_branches_mst.findFirst({
        where: { tenant_org_id: tenantId, id: input.branchId },
        select: { id: true },
      }) : null,
      input.customerId ? prisma.org_customers_mst.findFirst({
        where: { tenant_org_id: tenantId, id: input.customerId },
        select: { id: true },
      }) : null,
    ]);
    if ((input.branchId && !branch) || (input.customerId && !customer)) {
      throw new PaymentQuoteError('PAYMENT_CONTEXT_NOT_FOUND', 400);
    }
  });
}

/**
 * Coordinates one consistent quote without serial browser currency/tax/options requests.
 * @param input Validated commercial inputs; requestId is correlation only, never authorization.
 * @param context Tenant/user resolved server-side from the authenticated session.
 * @param timing Request-local performance collector.
 * @returns Authoritative totals and eligibility for the same amount, plus permitted customer balances.
 * @throws PaymentQuoteError when required financial facts cannot be verified.
 * @example
 * const quote = await quotePayment(
 *   { requestId: 'payment-quote-1', items: [{ productId: '00000000-0000-4000-8000-000000000001', quantity: 1 }] },
 *   {
 *     tenantId: '00000000-0000-4000-8000-000000000002',
 *     userId: '00000000-0000-4000-8000-000000000003',
 *     canViewStoredValueBalances: false,
 *   },
 * );
 */
export async function quotePayment(
  input: PaymentQuoteRequest,
  context: PaymentQuoteContext,
  timing = new PaymentQuoteTiming(),
): Promise<PaymentQuoteData> {
  const { tenantId, userId } = context;
  await timing.measure('context', () => assertQuoteContext(input, tenantId));

  const financialsPromise = timing.measure('financials', async () => {
    // P5-02: priced by the commercial calculator, the same call submit makes. The tax
    // panel's profiles come from the same read the tax used (one request-local snapshot).
    const { totals, taxProfileEntries, promoNotice } = await quoteCheckout({
      ...input,
      tenantId,
      userId,
      strictFinancialReads: true,
      measure: (stage, operation) => timing.measure(stage, operation),
      // Only an explicit cashier selection replaces the defaults (the loader validates it).
      taxProfileIds: input.taxProfileIds,
    });
    let creditLimit: PaymentQuoteData['creditLimit'];
    if (input.customerId && totals.saleTotal > 0) {
      const credit = await timing.measure('credit', () => checkCreditLimit(input.customerId!, totals.saleTotal, {
        tenantId,
        strictReads: true,
      }));
      if (credit.creditLimit > 0) {
        const settings = createTenantSettingsService(await createClient());
        const mode = await settings.getSettingValue(tenantId, SETTING_CODES.B2B_CREDIT_LIMIT_MODE, input.branchId, userId);
        creditLimit = {
          currentBalance: credit.currentBalance,
          creditLimit: credit.creditLimit,
          available: credit.available,
          wouldExceed: credit.wouldExceed,
          mode: mode === 'warn' ? 'warn' : 'block',
        };
      }
    }
    return { totals, taxProfileEntries, creditLimit, promoNotice };
  });

  const [financials, effectiveMethods, storedValueSummary] = await Promise.all([
    financialsPromise,
    timing.measure('methods', () => listEffectivePaymentMethodConfigs({ tenantId, branchId: input.branchId })),
    timing.measure('balances', async () => input.customerId
      ? await getAvailableStoredValueSummary(tenantId, input.customerId)
      : null),
  ]);
  const options = await composeCheckoutOptions({
    tenantId,
    branchId: input.branchId,
    customerId: input.customerId,
    amount: financials.totals.saleTotal,
    effectiveMethods,
    storedValueSummary,
    canViewStoredValueBalances: context.canViewStoredValueBalances,
  });
  return {
    ...financials.totals,
    ...(financials.creditLimit ? { creditLimit: financials.creditLimit } : {}),
    requestId: input.requestId,
    // This quote uses the Organization's base currency; its functional exchange rate is exactly one.
    currencyExRate: 1,
    taxProfileEntries: financials.taxProfileEntries,
    promoNotice: financials.promoNotice,
    checkoutOptions: { paymentMethods: options.paymentMethods, customerCredits: options.customerCredits },
    storedValueSummary: options.storedValueSummary,
  };
}

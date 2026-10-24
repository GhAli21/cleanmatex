import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import type { PaymentQuoteData, PaymentQuoteRequest, TaxProfileEntry } from '@/lib/types/payment-quote';
import { calculateOrderTotals } from './order-calculation.service';
import { listEffectivePaymentMethodConfigs } from './payment-config.service';
import { getAvailableStoredValueSummary } from './order-credit-application.service';
import { composeCheckoutOptions } from './checkout-options.service';
import { checkCreditLimit } from './credit-limit.service';
import { createClient } from '@/lib/supabase/server';
import { createTenantSettingsService, SETTING_CODES } from './tenant-settings.service';
import { PaymentQuoteTiming } from './payment-quote-timing';
import type { ResolvedTaxProfileSnapshot } from './tax-engine.service';

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
 * Resolves effective taxes inside the quote so defaults and compound ordering match its totals.
 * @param input Validated explicit tax selection, or no selection to use active defaults.
 * @param tenantId Authenticated Organization scope for every tax-profile read.
 * @returns Effective display entries plus the identical scoped facts for the tax calculation.
 * @throws PaymentQuoteError when any explicitly selected profile is unavailable.
 */
async function loadQuoteTaxProfiles(input: PaymentQuoteRequest, tenantId: string): Promise<{
  entries: TaxProfileEntry[];
  snapshot: ResolvedTaxProfileSnapshot;
}> {
  const selectedIds = [...new Set(input.taxProfileIds ?? [])];
  const effectiveAt = new Date();
  const profiles = await withTenantContext(tenantId, async () => await prisma.org_tax_profiles_cf.findMany({
    where: {
      tenant_org_id: tenantId,
      ...(selectedIds.length ? { id: { in: selectedIds } } : { is_default: true }),
      is_active: true,
      rec_status: 1,
      effective_from: { lte: effectiveAt },
      OR: [{ effective_to: null }, { effective_to: { gte: effectiveAt } }],
    },
    select: { id: true, tenant_org_id: true, name: true, name2: true, tax_type: true, rate: true, is_compound: true },
    orderBy: { created_at: 'asc' },
  }));
  if (selectedIds.length && profiles.length !== selectedIds.length) {
    throw new PaymentQuoteError('INVALID_TAX_PROFILE_SELECTION', 400);
  }
  // Preserve the cashier default ordering and explicit selected ordering, including compound-tax precedence.
  const ordered = selectedIds.length
    ? selectedIds.map((id) => profiles.find((profile) => profile.id === id)!)
    : [...profiles].sort((a, b) => a.tax_type.localeCompare(b.tax_type));
  const entries = ordered.map((profile) => ({
    id: profile.id,
    name: profile.name,
    name2: profile.name2,
    tax_type: profile.tax_type,
    rate: Number(profile.rate),
    is_compound: profile.is_compound ?? false,
    enabled: true,
  }));
  return { entries, snapshot: { tenantId, effectiveAt: effectiveAt.toISOString(), profiles: ordered } };
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
    const { entries: taxProfileEntries, snapshot: resolvedTaxProfiles } =
      await timing.measure('tax_profiles', () => loadQuoteTaxProfiles(input, tenantId));
    const totals = await calculateOrderTotals({
      ...input,
      tenantId,
      userId,
      strictFinancialReads: true,
      resolvedTaxProfiles,
      measure: (stage, operation) => timing.measure(stage, operation),
      taxProfileIds: taxProfileEntries.map((profile) => profile.id),
      orderCharges: (input.orderServicePrefs ?? []).map((preference) => ({
        label: preference.preference_code,
        amount: preference.extra_price,
      })),
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
    return { totals, taxProfileEntries, creditLimit };
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
    checkoutOptions: { paymentMethods: options.paymentMethods, customerCredits: options.customerCredits },
    storedValueSummary: options.storedValueSummary,
  };
}

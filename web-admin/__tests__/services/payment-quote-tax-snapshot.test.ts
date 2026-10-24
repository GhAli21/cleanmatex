/** @jest-environment node */
/** Real quote/calculation/tax integration with controlled I/O verifies one request-local tax snapshot. */

const mockProfiles = jest.fn();
const mockExemption = jest.fn();
const mockContextRow = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/prisma', () => ({ prisma: {
  org_branches_mst: { findFirst: (...args: unknown[]) => mockContextRow(...args) },
  org_customers_mst: { findFirst: (...args: unknown[]) => mockContextRow(...args) },
  org_tax_profiles_cf: { findMany: (...args: unknown[]) => mockProfiles(...args) },
  org_tax_exemptions_cf: { findFirst: (...args: unknown[]) => mockExemption(...args) },
} }));
jest.mock('@/lib/db/tenant-context', () => ({ withTenantContext: async (_tenant: string, operation: () => Promise<unknown>) => operation() }));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/services/tenant-settings.service', () => ({
  createTenantSettingsService: () => ({ getCurrencyConfig: async () => ({ currencyCode: 'SAR', decimalPlaces: 2 }) }),
  SETTING_CODES: { B2B_CREDIT_LIMIT_MODE: 'B2B_CREDIT_LIMIT_MODE' },
}));
jest.mock('@/lib/services/pricing-mode-resolver.service', () => ({ resolveTaxPricingMode: async () => 'TAX_EXCLUSIVE' }));
jest.mock('@/lib/services/pricing.service', () => ({ pricingService: { getBasePricesForOrder: async () => [100] } }));
jest.mock('@/lib/services/tax.service', () => ({ TaxService: jest.fn().mockImplementation(() => ({ getTaxRate: async () => 0 })) }));
jest.mock('@/lib/services/discount-service', () => ({ getBestDiscount: async () => null, evaluateBestAutoApplyPromo: async () => null }));
jest.mock('@/lib/money/currency-rounding', () => ({ resolveCurrencyRoundingRule: async () => null }));
jest.mock('@/lib/services/payment-config.service', () => ({ listEffectivePaymentMethodConfigs: async () => [] }));
jest.mock('@/lib/services/order-credit-application.service', () => ({ getAvailableStoredValueSummary: async () => null }));
jest.mock('@/lib/services/checkout-options.service', () => ({ composeCheckoutOptions: async () => ({ paymentMethods: [], customerCredits: [], storedValueSummary: null }) }));
jest.mock('@/lib/services/credit-limit.service', () => ({ checkCreditLimit: async () => ({ creditLimit: 0 }) }));
jest.mock('@/lib/services/gift-card-service', () => ({}));

import { Decimal } from '@prisma/client/runtime/library';
import { quotePayment } from '@/lib/services/payment-quote.service';
import { calculateTaxDetailed, type ResolvedTaxProfileSnapshot } from '@/lib/services/tax-engine.service';

const profile = {
  id: 'vat', tenant_org_id: 'tenant-A', name: 'VAT', name2: null,
  tax_type: 'VAT', rate: new Decimal(15), is_compound: false,
};
const context = { tenantId: 'tenant-A', userId: 'user-A', canViewStoredValueBalances: false };
const input = {
  requestId: 'quote-A', customerId: 'customer-A', taxProfileIds: ['vat'],
  items: [{ productId: 'product-A', quantity: 1 }],
};

describe('payment quote tax snapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockContextRow.mockResolvedValue({ id: 'customer-A' });
    mockExemption.mockResolvedValue(null);
    mockProfiles.mockResolvedValue([profile]);
  });

  it('uses one profile read for display and actual tax even if the next database read would change', async () => {
    mockProfiles.mockResolvedValueOnce([profile]).mockResolvedValue([{ ...profile, rate: new Decimal(99) }]);
    const quote = await quotePayment(input, context);
    expect(mockProfiles).toHaveBeenCalledTimes(1);
    expect(quote.taxProfileEntries).toEqual([expect.objectContaining({ id: 'vat', rate: 15 })]);
    expect(quote.taxBreakdown).toEqual([expect.objectContaining({ profileId: 'vat', rate: 15, taxAmount: 15 })]);
    expect(quote.saleTotal).toBe(115);
    const profileInstant = mockProfiles.mock.calls[0][0].where.effective_from.lte;
    expect(mockExemption.mock.calls[0][0].where.valid_from.lte).toEqual(profileInstant);
    expect(mockExemption.mock.calls[0][0].where.AND[0].OR[1].valid_to.gte).toEqual(profileInstant);
  });

  it('keeps an empty profile snapshot empty rather than rereading newly created defaults', async () => {
    mockProfiles.mockResolvedValueOnce([]).mockResolvedValue([profile]);
    const quote = await quotePayment({ ...input, taxProfileIds: undefined }, context);
    expect(mockProfiles).toHaveBeenCalledTimes(1);
    expect(quote.taxProfileEntries).toEqual([]);
    expect(quote.taxBreakdown).toEqual([]);
    expect(quote.saleTotal).toBe(100);
  });

  it.each(['snapshot', 'row'])('rejects foreign tenant %s facts before exemption handling or database reads', async (foreignPart) => {
    const snapshot: ResolvedTaxProfileSnapshot = {
      tenantId: foreignPart === 'snapshot' ? 'tenant-B' : 'tenant-A',
      effectiveAt: new Date().toISOString(),
      profiles: [{ ...profile, tenant_org_id: foreignPart === 'row' ? 'tenant-B' : 'tenant-A' }],
    };
    mockExemption.mockResolvedValue({ id: 'exemption-A' });
    await expect(calculateTaxDetailed({
      tenantId: 'tenant-A', customerId: 'customer-A', baseAmount: 100,
      selectedProfileIds: ['vat'], resolvedTaxProfiles: snapshot,
    })).rejects.toThrow('INVALID_TAX_PROFILE_SNAPSHOT');
    expect(mockProfiles).not.toHaveBeenCalled();
    expect(mockExemption).not.toHaveBeenCalled();
  });

  it('rejects a snapshot that disagrees with explicitly selected profile identifiers', async () => {
    await expect(calculateTaxDetailed({
      tenantId: 'tenant-A', baseAmount: 100, selectedProfileIds: ['different-profile'],
      resolvedTaxProfiles: { tenantId: 'tenant-A', effectiveAt: new Date().toISOString(), profiles: [profile] },
    })).rejects.toThrow('INVALID_TAX_PROFILE_SNAPSHOT');
    expect(mockProfiles).not.toHaveBeenCalled();
  });
});

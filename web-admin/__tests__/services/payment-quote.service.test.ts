/** @jest-environment node */
/** Verifies orchestration/tenant/amount contracts; database timing is measured separately. */
import { quotePayment } from '@/lib/services/payment-quote.service';
import type { PaymentQuoteRequest } from '@/lib/types/payment-quote';

const mockBranch = jest.fn();
const mockCustomer = jest.fn();
const mockProfiles = jest.fn();
const mockTotals = jest.fn();
const mockMethods = jest.fn();
const mockBalances = jest.fn();
const mockCompose = jest.fn();
const mockCredit = jest.fn();
const mockSetting = jest.fn();

jest.mock('server-only', () => ({}));
jest.mock('@/lib/db/prisma', () => ({ prisma: {
  org_branches_mst: { findFirst: (...args: unknown[]) => mockBranch(...args) },
  org_customers_mst: { findFirst: (...args: unknown[]) => mockCustomer(...args) },
  org_tax_profiles_cf: { findMany: (...args: unknown[]) => mockProfiles(...args) },
} }));
jest.mock('@/lib/services/order-calculation.service', () => ({ calculateOrderTotals: (...args: unknown[]) => mockTotals(...args) }));
jest.mock('@/lib/services/payment-config.service', () => ({ listEffectivePaymentMethodConfigs: (...args: unknown[]) => mockMethods(...args) }));
jest.mock('@/lib/services/order-credit-application.service', () => ({ getAvailableStoredValueSummary: (...args: unknown[]) => mockBalances(...args) }));
jest.mock('@/lib/services/checkout-options.service', () => ({ composeCheckoutOptions: (...args: unknown[]) => mockCompose(...args) }));
jest.mock('@/lib/services/credit-limit.service', () => ({ checkCreditLimit: (...args: unknown[]) => mockCredit(...args) }));
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn().mockResolvedValue({}) }));
jest.mock('@/lib/services/tenant-settings.service', () => ({
  SETTING_CODES: { B2B_CREDIT_LIMIT_MODE: 'B2B_CREDIT_LIMIT_MODE' },
  createTenantSettingsService: () => ({ getSettingValue: (...args: unknown[]) => mockSetting(...args) }),
}));

const context = { tenantId: 'tenant-A', userId: 'staff-A', canViewStoredValueBalances: false };
const input: PaymentQuoteRequest = {
  requestId: 'quote-1', branchId: 'branch-A', customerId: 'customer-A',
  items: [{ productId: 'product-A', quantity: 2 }],
  orderServicePrefs: [{ preference_code: 'HANG', source: 'MANUAL', extra_price: 3 }],
};
const totals = {
  subtotal: 100, saleTotal: 115, currencyCode: 'SAR', decimalPlaces: 2,
  manualDiscount: 0, autoRuleDiscount: 0, promoDiscount: 0, afterDiscounts: 100,
  additionalTaxAmount: 0, vatValue: 15, giftCardApplied: 0, vatTaxPercent: 15,
  taxBreakdown: [],
};

describe('coordinated payment quote', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBranch.mockResolvedValue({ id: 'branch-A' });
    mockCustomer.mockResolvedValue({ id: 'customer-A' });
    mockProfiles.mockResolvedValue([]);
    mockTotals.mockResolvedValue(totals);
    mockMethods.mockResolvedValue([{ id: 'cash' }]);
    mockBalances.mockResolvedValue({ wallet: { balance: 5 } });
    mockCompose.mockResolvedValue({ paymentMethods: [{ id: 'cash' }], customerCredits: [], storedValueSummary: null });
    mockCredit.mockResolvedValue({ creditLimit: 0 });
    mockSetting.mockResolvedValue('block');
  });

  it('returns currency, totals, eligibility and correlation as one snapshot', async () => {
    const quote = await quotePayment(input, context);
    expect(quote).toMatchObject({ ...totals, requestId: 'quote-1', currencyExRate: 1, storedValueSummary: null });
    expect(mockCompose).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-A', branchId: 'branch-A', customerId: 'customer-A', amount: 115,
      effectiveMethods: [{ id: 'cash' }], storedValueSummary: { wallet: { balance: 5 } },
      canViewStoredValueBalances: false,
    }));
    expect(mockTotals).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-A', userId: 'staff-A',
      orderCharges: [{ label: 'HANG', amount: 3 }] }));
    expect(mockBalances).toHaveBeenCalledTimes(1);
  });

  it('requires the supplied customer and branch to belong to the authenticated tenant', async () => {
    mockCustomer.mockResolvedValue(null);
    await expect(quotePayment(input, context)).rejects.toMatchObject({ code: 'PAYMENT_CONTEXT_NOT_FOUND', status: 400 });
    expect(mockCustomer).toHaveBeenCalledWith({ where: { tenant_org_id: 'tenant-A', id: 'customer-A' }, select: { id: true } });
    expect(mockBranch).toHaveBeenCalledWith({ where: { tenant_org_id: 'tenant-A', id: 'branch-A' }, select: { id: true } });
    expect(mockTotals).not.toHaveBeenCalled();
    expect(mockBalances).not.toHaveBeenCalled();
  });

  it('starts methods and balances before slow financial calculation resolves', async () => {
    let release!: (value: typeof totals) => void;
    const financialResult = new Promise<typeof totals>((resolve) => { release = resolve; });
    mockTotals.mockReturnValue(financialResult);
    const pending = quotePayment(input, context);
    for (let step = 0; step < 12; step += 1) await Promise.resolve();
    expect(mockMethods).toHaveBeenCalledTimes(1);
    expect(mockBalances).toHaveBeenCalledTimes(1);
    expect(mockCompose).not.toHaveBeenCalled();
    release(totals);
    await pending;
  });

  it('returns selected profile IDs in the same order used to calculate and submit', async () => {
    mockProfiles.mockResolvedValue([
      { id: 'vat', name: 'VAT', name2: null, tax_type: 'VAT', rate: 15, is_compound: false },
      { id: 'custom', name: 'Levy', name2: null, tax_type: 'CUSTOM', rate: 2, is_compound: true },
    ]);
    const quote = await quotePayment({ ...input, taxProfileIds: ['custom', 'vat'] }, context);
    expect(quote.taxProfileEntries.map((profile) => profile.id)).toEqual(['custom', 'vat']);
    expect(mockTotals).toHaveBeenCalledWith(expect.objectContaining({ taxProfileIds: ['custom', 'vat'] }));
    expect(mockProfiles).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ tenant_org_id: 'tenant-A', is_active: true, rec_status: 1 }) }));
  });

  it('rejects missing or no-longer-effective selected taxes before calculation', async () => {
    await expect(quotePayment({ ...input, taxProfileIds: ['expired'] }, context)).rejects.toMatchObject({ code: 'INVALID_TAX_PROFILE_SELECTION' });
    expect(mockTotals).not.toHaveBeenCalled();
  });

  it('preserves strict credit information and policy mode in the quote', async () => {
    mockCredit.mockResolvedValue({ creditLimit: 200, currentBalance: 150, available: 50, wouldExceed: true });
    mockSetting.mockResolvedValue('warn');
    const quote = await quotePayment(input, context);
    expect(mockCredit).toHaveBeenCalledWith('customer-A', 115, { tenantId: 'tenant-A', strictReads: true });
    expect(quote.creditLimit).toEqual({ creditLimit: 200, currentBalance: 150, available: 50, wouldExceed: true, mode: 'warn' });
  });

  it.each(['balances', 'methods', 'credit'])('fails closed instead of fabricating zero on %s failure', async (stage) => {
    ({ balances: mockBalances, methods: mockMethods, credit: mockCredit }[stage]!).mockRejectedValueOnce(new Error('unavailable'));
    await expect(quotePayment(input, context)).rejects.toThrow('unavailable');
  });

  it('does not read customer balances or credit for a quote without a customer', async () => {
    await quotePayment({ ...input, customerId: undefined }, context);
    expect(mockBalances).not.toHaveBeenCalled();
    expect(mockCredit).not.toHaveBeenCalled();
  });
});

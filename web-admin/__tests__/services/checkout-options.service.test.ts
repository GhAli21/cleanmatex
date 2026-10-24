/** @jest-environment node */
/** Exercises request-local composition, authorization boundaries and independent read overlap. */
jest.mock('server-only', () => ({}));
jest.mock('@/lib/services/payment-config.service', () => ({
  ...jest.requireActual('@/lib/services/payment-config.service'),
  listEffectivePaymentMethodConfigs: jest.fn(),
}));
jest.mock('@/lib/services/order-credit-application.service', () => ({
  ...jest.requireActual('@/lib/services/order-credit-application.service'),
  getAvailableStoredValueSummary: jest.fn(),
}));

import { composeCheckoutOptions } from '@/lib/services/checkout-options.service';
import { getAvailableStoredValueSummary, type AvailableStoredValueSummary } from '@/lib/services/order-credit-application.service';
import { listEffectivePaymentMethodConfigs, type EffectivePaymentMethodConfig } from '@/lib/services/payment-config.service';

const tenantId = 'tenant-1';
const customerId = 'customer-1';
const method = (overrides: Partial<EffectivePaymentMethodConfig> = {}) => ({
  id: 'cash', payment_method_code: 'CASH', payment_nature: 'REAL_PAYMENT',
  display_name: 'Cash', display_name2: null, gateway_code: null,
  is_enabled: true, is_active: true, rec_status: 1, allowed_in_pos: true,
  is_platform_disabled: false, is_globally_disabled: false, gateway_globally_disabled: false,
  min_order_amount: null, max_order_amount: null,
  ...overrides,
} as EffectivePaymentMethodConfig);
const balances: AvailableStoredValueSummary = {
  wallet: { walletId: 'wallet-1', balance: 12, currencyCode: 'SAR' },
  advance: { advanceId: null, balance: 0, currencyCode: null },
  creditNotes: [], creditNoteTotal: 0, loyaltyRedeemRatePerPoint: 0.01,
  loyaltyPointsBalance: 0, loyaltyExpiredUnappliedPoints: 0,
  loyaltyAvailableValue: 0, loyaltyMinRedeemPoints: 100,
};

describe('checkout options composition', () => {
  beforeEach(() => jest.clearAllMocks());

  it('reuses loaded facts and protects the richer customer DTO independently', async () => {
    const result = await composeCheckoutOptions({ tenantId, customerId, amount: 20,
      effectiveMethods: [method(), method({ id: 'wallet', payment_method_code: 'WALLET',
        payment_nature: 'CREDIT_APPLICATION', credit_application_type: 'WALLET' })],
      storedValueSummary: balances,
    });
    expect(result.paymentMethods.map((option) => option.id)).toEqual(['cash']);
    expect(result.customerCredits[0].available_balance).toBe(12);
    expect(result.storedValueSummary).toBeNull();
    expect(listEffectivePaymentMethodConfigs).not.toHaveBeenCalled();
    expect(getAvailableStoredValueSummary).not.toHaveBeenCalled();
  });

  it('returns the existing balance-view shape only when separately authorized', async () => {
    const result = await composeCheckoutOptions({ tenantId, customerId, amount: 20,
      effectiveMethods: [method()], storedValueSummary: balances, canViewStoredValueBalances: true,
    });
    expect(result.storedValueSummary).toEqual({ wallet: balances.wallet, advance: balances.advance,
      creditNotes: [], creditNoteTotal: 0, loyalty: { pointsBalance: 0, availableValue: 0,
        expiredUnappliedPoints: 0, redeemRatePerPoint: 0.01 } });
  });

  it('starts config and balance reads together rather than waiting for configuration', async () => {
    let resolveMethods!: (rows: EffectivePaymentMethodConfig[]) => void;
    jest.mocked(listEffectivePaymentMethodConfigs).mockReturnValue(new Promise((resolve) => { resolveMethods = resolve; }));
    jest.mocked(getAvailableStoredValueSummary).mockResolvedValue(balances);
    const pending = composeCheckoutOptions({ tenantId, customerId, amount: 20 });
    expect(getAvailableStoredValueSummary).toHaveBeenCalledWith(tenantId, customerId);
    resolveMethods([method()]);
    await expect(pending).resolves.toHaveProperty('paymentMethods');
  });

  it('propagates unavailable balances rather than advertising zero', async () => {
    jest.mocked(listEffectivePaymentMethodConfigs).mockResolvedValue([method()]);
    jest.mocked(getAvailableStoredValueSummary).mockRejectedValue(new Error('Balance service unavailable'));
    await expect(composeCheckoutOptions({ tenantId, customerId, amount: 20 }))
      .rejects.toThrow('Balance service unavailable');
  });

  it('can intentionally omit customer reads for a quote with no balance requirement', async () => {
    const result = await composeCheckoutOptions({ tenantId, customerId, amount: 20,
      effectiveMethods: [method()], includeStoredValue: false,
    });
    expect(result.storedValueSummary).toBeNull();
    expect(getAvailableStoredValueSummary).not.toHaveBeenCalled();
  });
});

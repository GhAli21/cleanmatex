/**
 * Tests: currency-policy.service (§4.3 resolver, C10). Covers every reason
 * code, the C10 fail-fast-before-any-DB-read guarantee, the non-blocking
 * staleRateWarning split from blocking reasonCodes, and the base-currency
 * (no-FX-required) short-circuit.
 */

const mockSysCurrencyFindUnique = jest.fn();
const mockOrgCurrencyFindFirst = jest.fn();
const mockDrawerFindFirst = jest.fn();
const mockResolveRate = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    sys_currency_cd: { findUnique: (...a: unknown[]) => mockSysCurrencyFindUnique(...a) },
    org_currency_cf: { findFirst: (...a: unknown[]) => mockOrgCurrencyFindFirst(...a) },
    org_cash_drawers_mst: { findFirst: (...a: unknown[]) => mockDrawerFindFirst(...a) },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (id: string, fn: (tenantId: string) => Promise<unknown>) => fn(id)),
}));

jest.mock('@/lib/services/fx/fx-rate-resolver.service', () => ({
  resolveRate: (...a: unknown[]) => mockResolveRate(...a),
}));

import { checkCurrencyPolicy } from '@/lib/services/fx/currency-policy.service';
import { FX_ERROR, FxError } from '@/lib/services/fx/fx-errors';
import { CURRENCY_CONTEXT, CURRENCY_POLICY_REASON } from '@/lib/constants/currency-fx';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const DRAWER_ID = '33333333-3333-3333-3333-333333333333';

function currencyRow(overrides: Record<string, unknown> = {}) {
  return {
    currency_code: 'USD',
    is_active: true,
    allow_sales: true,
    allow_payments: true,
    allow_cash: true,
    allow_ar: true,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSysCurrencyFindUnique.mockResolvedValue({ is_active: true });
});

describe('currency-policy.service — C10 fail-fast', () => {
  it('rejects a not-ready context before any DB read', async () => {
    const result = await checkCurrencyPolicy({
      tenantId: TENANT_ID,
      context: CURRENCY_CONTEXT.WALLET,
      currencyCode: 'USD',
    });

    expect(result).toEqual({ allowed: false, reasonCode: CURRENCY_POLICY_REASON.CONTEXT_NOT_READY, requiresFx: false });
    expect(mockSysCurrencyFindUnique).not.toHaveBeenCalled();
    expect(mockOrgCurrencyFindFirst).not.toHaveBeenCalled();
  });
});

describe('currency-policy.service — global + tenant layers', () => {
  it('CURRENCY_NOT_ENABLED when the global catalog has it inactive', async () => {
    mockSysCurrencyFindUnique.mockResolvedValue({ is_active: false });
    mockOrgCurrencyFindFirst.mockResolvedValue(currencyRow());

    const result = await checkCurrencyPolicy({ tenantId: TENANT_ID, context: CURRENCY_CONTEXT.SALES, currencyCode: 'USD' });

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe(CURRENCY_POLICY_REASON.CURRENCY_NOT_ENABLED);
  });

  it('CURRENCY_NOT_ENABLED when the tenant has no portfolio row for it', async () => {
    mockOrgCurrencyFindFirst.mockResolvedValue(null);

    const result = await checkCurrencyPolicy({ tenantId: TENANT_ID, context: CURRENCY_CONTEXT.SALES, currencyCode: 'USD' });

    expect(result.reasonCode).toBe(CURRENCY_POLICY_REASON.CURRENCY_NOT_ENABLED);
  });

  it('CURRENCY_NOT_ENABLED when the tenant row is deactivated', async () => {
    mockOrgCurrencyFindFirst.mockResolvedValue(currencyRow({ is_active: false }));

    const result = await checkCurrencyPolicy({ tenantId: TENANT_ID, context: CURRENCY_CONTEXT.SALES, currencyCode: 'USD' });

    expect(result.reasonCode).toBe(CURRENCY_POLICY_REASON.CURRENCY_NOT_ENABLED);
  });

  it('CONTEXT_NOT_ALLOWED when the specific context flag is off', async () => {
    mockOrgCurrencyFindFirst.mockResolvedValue(currencyRow({ allow_cash: false }));

    const result = await checkCurrencyPolicy({ tenantId: TENANT_ID, context: CURRENCY_CONTEXT.CASH, currencyCode: 'USD' });

    expect(result.reasonCode).toBe(CURRENCY_POLICY_REASON.CONTEXT_NOT_ALLOWED);
  });
});

describe('currency-policy.service — drawer layer (CASH)', () => {
  it('NO_DRAWER_IN_CURRENCY when the named drawer is a different currency', async () => {
    mockOrgCurrencyFindFirst
      .mockResolvedValueOnce(currencyRow()) // currency lookup
      .mockResolvedValueOnce({ currency_code: 'OMR' }); // base lookup — irrelevant here, drawer check short-circuits first
    mockDrawerFindFirst.mockResolvedValue({ currency_code: 'OMR' });

    const result = await checkCurrencyPolicy({
      tenantId: TENANT_ID,
      context: CURRENCY_CONTEXT.CASH,
      currencyCode: 'USD',
      drawerId: DRAWER_ID,
    });

    expect(result.reasonCode).toBe(CURRENCY_POLICY_REASON.NO_DRAWER_IN_CURRENCY);
  });

  it('NO_DRAWER_IN_CURRENCY when the drawer does not exist for this tenant', async () => {
    mockOrgCurrencyFindFirst.mockResolvedValueOnce(currencyRow());
    mockDrawerFindFirst.mockResolvedValue(null);

    const result = await checkCurrencyPolicy({
      tenantId: TENANT_ID,
      context: CURRENCY_CONTEXT.CASH,
      currencyCode: 'USD',
      drawerId: DRAWER_ID,
    });

    expect(result.reasonCode).toBe(CURRENCY_POLICY_REASON.NO_DRAWER_IN_CURRENCY);
  });

  it('skips the drawer check entirely when no drawerId is given', async () => {
    mockOrgCurrencyFindFirst
      .mockResolvedValueOnce(currencyRow({ currency_code: 'OMR' }))
      .mockResolvedValueOnce({ currency_code: 'OMR' });

    const result = await checkCurrencyPolicy({ tenantId: TENANT_ID, context: CURRENCY_CONTEXT.CASH, currencyCode: 'OMR' });

    expect(mockDrawerFindFirst).not.toHaveBeenCalled();
    expect(result.allowed).toBe(true);
  });
});

describe('currency-policy.service — base currency short-circuit (no FX required)', () => {
  it('allows and sets requiresFx=false when the checked currency is the base currency', async () => {
    mockOrgCurrencyFindFirst
      .mockResolvedValueOnce(currencyRow({ currency_code: 'OMR' }))
      .mockResolvedValueOnce({ currency_code: 'OMR' });

    const result = await checkCurrencyPolicy({ tenantId: TENANT_ID, context: CURRENCY_CONTEXT.SALES, currencyCode: 'OMR' });

    expect(result).toEqual({ allowed: true, reasonCode: null, requiresFx: false });
    expect(mockResolveRate).not.toHaveBeenCalled();
  });
});

describe('currency-policy.service — FX resolution layer', () => {
  it('allows with requiresFx=true and no staleRateWarning when a fresh rate resolves', async () => {
    mockOrgCurrencyFindFirst
      .mockResolvedValueOnce(currencyRow({ currency_code: 'USD' }))
      .mockResolvedValueOnce({ currency_code: 'OMR' });
    mockResolveRate.mockResolvedValue({ stale: false });

    const result = await checkCurrencyPolicy({ tenantId: TENANT_ID, context: CURRENCY_CONTEXT.SALES, currencyCode: 'USD' });

    expect(result).toEqual({ allowed: true, reasonCode: null, requiresFx: true, staleRateWarning: false });
  });

  it('allows but sets staleRateWarning=true (non-blocking) when the resolved rate is stale', async () => {
    mockOrgCurrencyFindFirst
      .mockResolvedValueOnce(currencyRow({ currency_code: 'USD' }))
      .mockResolvedValueOnce({ currency_code: 'OMR' });
    mockResolveRate.mockResolvedValue({ stale: true });

    const result = await checkCurrencyPolicy({ tenantId: TENANT_ID, context: CURRENCY_CONTEXT.SALES, currencyCode: 'USD' });

    expect(result.allowed).toBe(true);
    expect(result.reasonCode).toBeNull();
    expect(result.staleRateWarning).toBe(true);
  });

  it('FX_RATE_MISSING (blocking) when no rate resolves at all', async () => {
    mockOrgCurrencyFindFirst
      .mockResolvedValueOnce(currencyRow({ currency_code: 'USD' }))
      .mockResolvedValueOnce({ currency_code: 'OMR' });
    mockResolveRate.mockRejectedValue(new FxError(FX_ERROR.RATE_NOT_FOUND, 'no rate'));

    const result = await checkCurrencyPolicy({ tenantId: TENANT_ID, context: CURRENCY_CONTEXT.SALES, currencyCode: 'USD' });

    expect(result).toEqual({ allowed: false, reasonCode: CURRENCY_POLICY_REASON.FX_RATE_MISSING, requiresFx: true });
  });

  it('rethrows an unrelated FxError rather than swallowing it as FX_RATE_MISSING', async () => {
    mockOrgCurrencyFindFirst
      .mockResolvedValueOnce(currencyRow({ currency_code: 'USD' }))
      .mockResolvedValueOnce({ currency_code: 'OMR' });
    mockResolveRate.mockRejectedValue(new FxError(FX_ERROR.LOOKUP_INVALID, 'bad rate type'));

    await expect(
      checkCurrencyPolicy({ tenantId: TENANT_ID, context: CURRENCY_CONTEXT.SALES, currencyCode: 'USD' })
    ).rejects.toMatchObject({ code: FX_ERROR.LOOKUP_INVALID });
  });
});

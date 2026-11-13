/** Document FX: same currency stores 1, a foreign currency stores the book rate, a missing rate is refused. */
import { COMMERCIAL_ERROR_CODES, CommercialRuleError } from '@/lib/commercial/errors';
import { prisma } from '@/lib/db/prisma';
import { FX_ERROR, FxError } from '@/lib/services/fx/fx-errors';
import { resolveRate } from '@/lib/services/fx/fx-rate-resolver.service';
import { assertOrgBaseCurrency, resolveDocFxRate } from '@/lib/services/fx/doc-fx-rate';
import { FX_RATE_SOURCE_BOOK, FX_RESOLUTION } from '@/lib/constants/currency-fx';

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_tenantId: string, fn: (tenantId: string) => Promise<unknown>) => fn('tenant-1')),
}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_tenants_mst: { findFirst: jest.fn() },
    sys_currency_cd: { findUnique: jest.fn() },
  },
}));

jest.mock('@/lib/services/fx/fx-rate-resolver.service', () => ({
  resolveRate: jest.fn(),
}));

const tenantFind = prisma.org_tenants_mst.findFirst as jest.Mock;
const currencyFind = prisma.sys_currency_cd.findUnique as jest.Mock;
const mockResolveRate = resolveRate as jest.Mock;

describe('resolveDocFxRate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tenantFind.mockResolvedValue({ currency: 'OMR' });
    currencyFind.mockResolvedValue({ minor_unit: 3 });
  });

  it('stores 1 and no book row when the document currency is the organization currency', async () => {
    const rate = await resolveDocFxRate('tenant-1', 'omr', '2026-11-13');
    expect(rate).toEqual({
      baseCurrencyCode: 'OMR',
      exchangeRate: '1',
      fxRateDate: null,
      fxRateSource: null,
      fxRateId: null,
      baseMinorUnit: 3,
    });
    expect(mockResolveRate).not.toHaveBeenCalled();
    expect(tenantFind).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'tenant-1' } }));
  });

  it('uses the approved rate for the document date', async () => {
    mockResolveRate.mockResolvedValue({
      resolution: FX_RESOLUTION.DIRECT,
      book: FX_RATE_SOURCE_BOOK.HQ,
      rate: '0.3846153846',
      rateId: 'rate-1',
      rateDate: '2026-11-01',
      sourceCode: 'CBO',
    });

    const rate = await resolveDocFxRate('tenant-1', 'USD', '2026-11-13');
    expect(mockResolveRate).toHaveBeenCalledWith('tenant-1', { from: 'USD', to: 'OMR', date: '2026-11-13' });
    expect(rate.exchangeRate).toBe('0.3846153846');
    expect(rate.fxRateDate).toBe('2026-11-01');
    expect(rate.fxRateSource).toBe('HQ:CBO');
    expect(rate.fxRateId).toBe('rate-1');
    expect(rate.baseCurrencyCode).toBe('OMR');
  });

  it('refuses a foreign document when no rate exists on or before the document date', async () => {
    mockResolveRate.mockRejectedValue(new FxError(FX_ERROR.RATE_NOT_FOUND, 'no rate'));
    await expect(resolveDocFxRate('tenant-1', 'USD', '2026-11-13')).rejects.toMatchObject({
      code: COMMERCIAL_ERROR_CODES.FX_RATE_NOT_FOUND,
      details: { currency: 'USD', baseCurrency: 'OMR', date: '2026-11-13' },
    });
  });
});

describe('assertOrgBaseCurrency', () => {
  beforeEach(() => {
    tenantFind.mockResolvedValue({ currency: 'OMR' });
    currencyFind.mockResolvedValue({ minor_unit: 3 });
  });

  it('allows petty cash in the organization currency', async () => {
    await expect(assertOrgBaseCurrency('tenant-1', 'OMR')).resolves.toBeUndefined();
  });

  it('refuses petty cash in a foreign currency because the cash transaction stores no rate', async () => {
    await expect(assertOrgBaseCurrency('tenant-1', 'USD')).rejects.toBeInstanceOf(CommercialRuleError);
    await expect(assertOrgBaseCurrency('tenant-1', 'USD')).rejects.toMatchObject({
      code: COMMERCIAL_ERROR_CODES.PETTY_CASH_FX_UNSUPPORTED,
      details: { currency: 'USD', baseCurrency: 'OMR' },
    });
  });
});

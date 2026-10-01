/**
 * Tests: fx-rate-resolver.service (resolveRate, plan 01 §7.1).
 * Covers: own→HQ fallback per all 3 resolution policies, direct vs inverse,
 * publisher-precedence tie-break, staleness reporting (never enforced), and
 * SAME_CURRENCY short-circuit.
 */

const mockTenantRateFindMany = jest.fn();
const mockHqRateFindMany = jest.fn();
const mockFxSettingsFindFirst = jest.fn();
const mockSourceFindMany = jest.fn();
const mockRateTypeFindUnique = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_fx_rate_mst: { findMany: (...a: unknown[]) => mockTenantRateFindMany(...a) },
    sys_currency_exchange_rate_mst: { findMany: (...a: unknown[]) => mockHqRateFindMany(...a) },
    org_fin_fx_stng_cf: { findFirst: (...a: unknown[]) => mockFxSettingsFindFirst(...a) },
    sys_exchange_rate_source_cd: { findMany: (...a: unknown[]) => mockSourceFindMany(...a) },
    sys_fx_rate_type_cd: { findUnique: (...a: unknown[]) => mockRateTypeFindUnique(...a) },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (id: string, fn: (tenantId: string) => Promise<unknown>) => fn(id)),
}));

import { resolveRate } from '@/lib/services/fx/fx-rate-resolver.service';
import { FX_ERROR } from '@/lib/services/fx/fx-errors';
import { FX_RATE_STATUS, FX_RESOLUTION, FX_RESOLUTION_POLICY, FX_RATE_SOURCE_BOOK } from '@/lib/constants/currency-fx';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';

function hqRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'hq-rate-id',
    rate_date: new Date('2026-09-30'),
    rate_value: { toString: () => '0.3850000000' },
    source_code: 'ecb',
    created_at: new Date('2026-09-30T10:00:00Z'),
    ...overrides,
  };
}

function tenantRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tenant-rate-id',
    rate_date: new Date('2026-09-30'),
    rate_value: { toString: () => '0.3900000000' },
    source_code: 'bank',
    created_at: new Date('2026-09-30T09:00:00Z'),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockRateTypeFindUnique.mockResolvedValue({ code: 'SPOT', max_age_days: 5 });
  mockSourceFindMany.mockResolvedValue([
    { code: 'bank', display_order: 1 },
    { code: 'ecb', display_order: 2 },
  ]);
  mockFxSettingsFindFirst.mockResolvedValue(null);
  mockTenantRateFindMany.mockResolvedValue([]);
  mockHqRateFindMany.mockResolvedValue([]);
});

describe('fx-rate-resolver.service — resolveRate', () => {
  it('short-circuits SAME_CURRENCY without consulting either book', async () => {
    const result = await resolveRate(TENANT_ID, { from: 'OMR', to: 'OMR' });

    expect(result.resolution).toBe(FX_RESOLUTION.SAME_CURRENCY);
    expect(result.book).toBeNull();
    expect(result.rate).toBe('1');
    expect(mockTenantRateFindMany).not.toHaveBeenCalled();
    expect(mockHqRateFindMany).not.toHaveBeenCalled();
  });

  it('TENANT_THEN_HQ (default): prefers the tenant book when it has a direct rate', async () => {
    mockTenantRateFindMany.mockResolvedValue([tenantRow()]);
    mockHqRateFindMany.mockResolvedValue([hqRow()]);

    const result = await resolveRate(TENANT_ID, { from: 'USD', to: 'OMR' });

    expect(result.book).toBe(FX_RATE_SOURCE_BOOK.TENANT);
    expect(result.resolution).toBe(FX_RESOLUTION.DIRECT);
    expect(result.rate).toBe('0.39');
  });

  it('TENANT_THEN_HQ: falls back to the HQ book when the tenant book has nothing', async () => {
    mockTenantRateFindMany.mockResolvedValue([]);
    mockHqRateFindMany.mockResolvedValue([hqRow()]);

    const result = await resolveRate(TENANT_ID, { from: 'USD', to: 'OMR' });

    expect(result.book).toBe(FX_RATE_SOURCE_BOOK.HQ);
    expect(result.rate).toBe('0.385');
  });

  it('TENANT_ONLY policy never consults the HQ book', async () => {
    mockFxSettingsFindFirst.mockResolvedValue({ resolution_policy: FX_RESOLUTION_POLICY.TENANT_ONLY, default_rate_type_code: null });
    mockTenantRateFindMany.mockResolvedValue([]);

    await expect(resolveRate(TENANT_ID, { from: 'USD', to: 'OMR' })).rejects.toMatchObject({
      code: FX_ERROR.RATE_NOT_FOUND,
    });
    expect(mockHqRateFindMany).not.toHaveBeenCalled();
  });

  it('HQ_ONLY policy never consults the tenant book', async () => {
    mockFxSettingsFindFirst.mockResolvedValue({ resolution_policy: FX_RESOLUTION_POLICY.HQ_ONLY, default_rate_type_code: null });
    mockHqRateFindMany.mockResolvedValue([hqRow()]);

    const result = await resolveRate(TENANT_ID, { from: 'USD', to: 'OMR' });

    expect(result.book).toBe(FX_RATE_SOURCE_BOOK.HQ);
    expect(mockTenantRateFindMany).not.toHaveBeenCalled();
  });

  it('falls back to the INVERSE pair when no direct rate exists in the winning book', async () => {
    // Direct USD->OMR empty, but OMR->USD exists.
    mockTenantRateFindMany.mockImplementation(({ where }: { where: { from_currency_code: string } }) =>
      Promise.resolve(where.from_currency_code === 'OMR' ? [tenantRow({ rate_value: { toString: () => '2.6000000000' } })] : [])
    );

    const result = await resolveRate(TENANT_ID, { from: 'USD', to: 'OMR' });

    expect(result.resolution).toBe(FX_RESOLUTION.INVERSE);
    // 1 / 2.6 rounded HALF_UP to 10dp
    expect(result.rate).toBe('0.3846153846');
  });

  it('throws RATE_NOT_FOUND when neither book has the pair in either direction', async () => {
    await expect(resolveRate(TENANT_ID, { from: 'USD', to: 'OMR' })).rejects.toMatchObject({
      code: FX_ERROR.RATE_NOT_FOUND,
    });
  });

  it('breaks a same-date tie by source display_order, lower order wins', async () => {
    mockHqRateFindMany.mockResolvedValue([
      hqRow({ id: 'ecb-row', source_code: 'ecb', created_at: new Date('2026-09-30T12:00:00Z') }),
      hqRow({ id: 'bank-row', source_code: 'bank', rate_value: { toString: () => '0.3700000000' }, created_at: new Date('2026-09-30T08:00:00Z') }),
    ]);
    mockFxSettingsFindFirst.mockResolvedValue({ resolution_policy: FX_RESOLUTION_POLICY.HQ_ONLY, default_rate_type_code: null });

    const result = await resolveRate(TENANT_ID, { from: 'USD', to: 'OMR' });

    // 'bank' has display_order 1 < 'ecb' order 2, so bank wins despite being created earlier.
    expect(result.rateId).toBe('bank-row');
    expect(result.rate).toBe('0.37');
  });

  it('reports staleness without blocking when the resolved rate is older than max_age_days', async () => {
    mockRateTypeFindUnique.mockResolvedValue({ code: 'SPOT', max_age_days: 1 });
    mockTenantRateFindMany.mockResolvedValue([tenantRow({ rate_date: new Date('2026-09-01') })]);

    const result = await resolveRate(TENANT_ID, { from: 'USD', to: 'OMR', date: '2026-09-30' });

    expect(result.stale).toBe(true);
    expect(result.ageDays).toBeGreaterThan(1);
  });

  it('reports not stale when within max_age_days, and null staleness when max_age_days is unset', async () => {
    mockRateTypeFindUnique.mockResolvedValue({ code: 'SPOT', max_age_days: null });
    mockTenantRateFindMany.mockResolvedValue([tenantRow({ rate_date: new Date('2020-01-01') })]);

    const result = await resolveRate(TENANT_ID, { from: 'USD', to: 'OMR', date: '2026-09-30' });

    expect(result.stale).toBe(false);
    expect(result.maxAgeDays).toBeNull();
  });

  it('throws LOOKUP_INVALID for an unknown rate type', async () => {
    mockRateTypeFindUnique.mockResolvedValue(null);
    await expect(resolveRate(TENANT_ID, { from: 'USD', to: 'OMR', rateType: 'BOGUS' })).rejects.toMatchObject({
      code: FX_ERROR.LOOKUP_INVALID,
    });
  });
});

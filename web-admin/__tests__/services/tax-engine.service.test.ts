/**
 * Tests: tax-engine.service
 *
 * Covers:
 * - calculateTax — returns [] when no profile found
 * - calculateTax — customer exemption returns []
 * - calculateTax — PERCENTAGE rate computes correctly
 * - calculateTax — rounding to 3 decimal places (service default)
 * - calculateTax — skips exemption check when no customerId
 * - calculateTaxInTx — delegates to calculateTax
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockTaxProfileFindMany = jest.fn();
const mockTaxExemptionFindFirst = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_tax_profiles_cf:   { findMany: (...a: unknown[]) => mockTaxProfileFindMany(...a) },
    org_tax_exemptions_cf: { findFirst: (...a: unknown[]) => mockTaxExemptionFindFirst(...a) },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_id: string, fn: () => Promise<unknown>) => fn()),
}));

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({}),
}));

// ---------------------------------------------------------------------------
// Import under test (after mocks)
// ---------------------------------------------------------------------------

import { calculateTax, calculateTaxInTx } from '@/lib/services/tax-engine.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TENANT = 'tenant-tax-001';

const makeProfile = (rate = 5, overrides: Record<string, unknown> = {}) => ({
  id: 'profile-1',
  tenant_org_id: TENANT,
  name: 'VAT 5%',
  name2: null,
  tax_type: 'VAT',
  rate,
  is_compound: false,
  is_default: true,
  is_active: true,
  rec_status: 1,
  applies_to: [],
  ...overrides,
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('tax-engine.service — calculateTax', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns [] when no active profile found', async () => {
    mockTaxProfileFindMany.mockResolvedValue([]);

    const result = await calculateTax({ tenantId: TENANT, baseAmount: 100 });
    expect(result).toEqual([]);
    expect(mockTaxExemptionFindFirst).not.toHaveBeenCalled();
  });

  it('returns [] when customer is tax-exempt', async () => {
    mockTaxExemptionFindFirst.mockResolvedValue({ id: 'ex-1' });

    const result = await calculateTax({ tenantId: TENANT, baseAmount: 100, customerId: 'cust-1' });
    expect(result).toEqual([]);
  });

  it('computes correct tax amount for 5% rate on 200', async () => {
    mockTaxExemptionFindFirst.mockResolvedValue(null);
    mockTaxProfileFindMany.mockResolvedValue([makeProfile(5)]);

    const result = await calculateTax({ tenantId: TENANT, baseAmount: 200, customerId: 'cust-1' });
    expect(result).toHaveLength(1);
    expect(result[0].taxAmount).toBeCloseTo(10);
    expect(result[0].taxType).toBe('VAT');
    expect(result[0].rate).toBe(5);
  });

  it('rounds taxAmount to 3 decimal places (service default)', async () => {
    mockTaxProfileFindMany.mockResolvedValue([makeProfile(7)]);

    const result = await calculateTax({ tenantId: TENANT, baseAmount: 33.33 });
    const raw = 33.33 * 0.07;
    expect(result[0].taxAmount).toBe(Number(raw.toFixed(3)));
  });

  it('skips exemption check when no customerId', async () => {
    mockTaxProfileFindMany.mockResolvedValue([makeProfile(5)]);

    await calculateTax({ tenantId: TENANT, baseAmount: 100 });
    expect(mockTaxExemptionFindFirst).not.toHaveBeenCalled();
  });

  it('returns non-exempt result when customer has no exemption record', async () => {
    mockTaxExemptionFindFirst.mockResolvedValue(null);
    mockTaxProfileFindMany.mockResolvedValue([makeProfile(10)]);

    const result = await calculateTax({ tenantId: TENANT, baseAmount: 100, customerId: 'cust-2' });
    expect(result).toHaveLength(1);
    expect(result[0].taxAmount).toBeCloseTo(10);
  });
});

describe('tax-engine.service — calculateTaxInTx', () => {
  beforeEach(() => jest.clearAllMocks());

  it('delegates to calculateTax and returns same result', async () => {
    mockTaxProfileFindMany.mockResolvedValue([makeProfile(5)]);

    const txMock = {} as Parameters<typeof calculateTaxInTx>[0];
    const result = await calculateTaxInTx(txMock, { tenantId: TENANT, baseAmount: 100 });
    expect(result).toHaveLength(1);
    expect(result[0].taxAmount).toBeCloseTo(5);
  });
});

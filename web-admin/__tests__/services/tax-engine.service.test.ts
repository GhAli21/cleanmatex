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

describe('tax-engine.service — calculateTax TAX_INCLUSIVE (B11)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('is byte-identical to today when pricingMode is omitted (defaults to TAX_EXCLUSIVE)', async () => {
    mockTaxProfileFindMany.mockResolvedValue([makeProfile(5)]);

    const result = await calculateTax({ tenantId: TENANT, baseAmount: 200 });
    expect(result[0].baseAmount).toBe(200);
    expect(result[0].taxAmount).toBeCloseTo(10);
  });

  it('extracts embedded tax from a single non-compound 5% profile', async () => {
    mockTaxProfileFindMany.mockResolvedValue([makeProfile(5)]);

    const result = await calculateTax({
      tenantId: TENANT,
      baseAmount: 105, // inclusive gross
      decimalPlaces: 2,
      pricingMode: 'TAX_INCLUSIVE',
    });
    expect(result).toHaveLength(1);
    expect(result[0].baseAmount).toBeCloseTo(100, 2);
    expect(result[0].taxAmount).toBeCloseTo(5, 2);
    expect(result[0].baseAmount + result[0].taxAmount).toBeCloseTo(105, 2);
  });

  it('extracts embedded tax at 15% (Saudi VAT)', async () => {
    mockTaxProfileFindMany.mockResolvedValue([makeProfile(15)]);

    const result = await calculateTax({
      tenantId: TENANT,
      baseAmount: 115,
      decimalPlaces: 2,
      pricingMode: 'TAX_INCLUSIVE',
    });
    expect(result[0].baseAmount).toBeCloseTo(100, 2);
    expect(result[0].taxAmount).toBeCloseTo(15, 2);
  });

  it('splits two non-compound profiles proportionally from the same inclusive gross', async () => {
    mockTaxProfileFindMany.mockResolvedValue([
      makeProfile(5, { id: 'vat', tax_type: 'VAT' }),
      makeProfile(3, { id: 'gst', tax_type: 'GST' }),
    ]);

    // net=100 => gross = 100 + 5 + 3 = 108 (both profiles tax the same net base, parallel not stacked)
    const result = await calculateTax({
      tenantId: TENANT,
      baseAmount: 108,
      decimalPlaces: 2,
      pricingMode: 'TAX_INCLUSIVE',
    });
    expect(result).toHaveLength(2);
    const vatLine = result.find((l) => l.taxType === 'VAT')!;
    const gstLine = result.find((l) => l.taxType === 'GST')!;
    expect(vatLine.baseAmount).toBeCloseTo(100, 2);
    expect(vatLine.taxAmount).toBeCloseTo(5, 2);
    expect(gstLine.baseAmount).toBeCloseTo(100, 2);
    expect(gstLine.taxAmount).toBeCloseTo(3, 2);
    expect(vatLine.baseAmount + vatLine.taxAmount + gstLine.taxAmount).toBeCloseTo(108, 2);
  });

  it('extracts correctly through a compound profile stacked on a non-compound one', async () => {
    // profile1 non-compound 5%, profile2 compound 3% (taxes on net + prior tax).
    // Forward check: net=100 => tax1=5, compound base=105 => tax2=3.15 => gross=108.15
    mockTaxProfileFindMany.mockResolvedValue([
      makeProfile(5, { id: 'p1', is_compound: false }),
      makeProfile(3, { id: 'p2', is_compound: true }),
    ]);

    const result = await calculateTax({
      tenantId: TENANT,
      baseAmount: 108.15,
      decimalPlaces: 2,
      pricingMode: 'TAX_INCLUSIVE',
    });
    expect(result).toHaveLength(2);
    const [line1, line2] = result;
    expect(line1.isCompound).toBe(false);
    expect(line1.baseAmount).toBeCloseTo(100, 1);
    expect(line1.taxAmount).toBeCloseTo(5, 1);
    expect(line2.isCompound).toBe(true);
    expect(line2.baseAmount).toBeCloseTo(105, 1);
    expect(line2.taxAmount).toBeCloseTo(3.15, 1);
    const reconstructedGross = line1.baseAmount + line1.taxAmount + line2.taxAmount;
    expect(reconstructedGross).toBeCloseTo(108.15, 1);
  });

  it('returns [] under TAX_INCLUSIVE when no profile is configured (fallback handled by the caller)', async () => {
    mockTaxProfileFindMany.mockResolvedValue([]);

    const result = await calculateTax({
      tenantId: TENANT,
      baseAmount: 105,
      pricingMode: 'TAX_INCLUSIVE',
    });
    expect(result).toEqual([]);
  });

  it('treats a zero rate as a no-op extraction (net === gross)', async () => {
    mockTaxProfileFindMany.mockResolvedValue([makeProfile(0)]);

    const result = await calculateTax({
      tenantId: TENANT,
      baseAmount: 100,
      decimalPlaces: 2,
      pricingMode: 'TAX_INCLUSIVE',
    });
    expect(result[0].baseAmount).toBeCloseTo(100, 2);
    expect(result[0].taxAmount).toBeCloseTo(0, 2);
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

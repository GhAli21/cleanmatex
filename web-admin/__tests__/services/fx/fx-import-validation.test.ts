/**
 * Tests: fx-import-validation (shared row validator for file-based FX
 * imports, plan 01 §7.1). Covers C3 pairing, format checks, and both
 * duplicate classes (existing live rate vs. duplicate within the file).
 */

const mockCurrencyFindMany = jest.fn();
const mockRateTypeFindMany = jest.fn();
const mockRateFindMany = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_currency_cf: { findMany: (...a: unknown[]) => mockCurrencyFindMany(...a) },
    sys_fx_rate_type_cd: { findMany: (...a: unknown[]) => mockRateTypeFindMany(...a) },
    org_fx_rate_mst: { findMany: (...a: unknown[]) => mockRateFindMany(...a) },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (id: string, fn: (tenantId: string) => Promise<unknown>) => fn(id)),
}));

import { validateImportRows, type RawImportRow } from '@/lib/services/fx/fx-import-validation';
import { FX_IMPORT_ROW_ERROR } from '@/lib/constants/currency-fx';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const SOURCE_CODE = 'bank';

function row(overrides: Partial<RawImportRow> = {}): RawImportRow {
  return {
    rowNumber: 1,
    fromCurrencyCode: 'OMR',
    toCurrencyCode: 'USD',
    rateTypeCode: 'SPOT',
    rateDate: '2026-09-30',
    rate: '2.6',
    sourceReference: null,
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrencyFindMany.mockResolvedValue([
    { currency_code: 'OMR', is_base_currency: true, is_reporting_currency: false },
    { currency_code: 'USD', is_base_currency: false, is_reporting_currency: false },
    { currency_code: 'SAR', is_base_currency: false, is_reporting_currency: false },
  ]);
  mockRateTypeFindMany.mockResolvedValue([{ code: 'SPOT' }, { code: 'CLOSING' }]);
  mockRateFindMany.mockResolvedValue([]);
});

describe('fx-import-validation — validateImportRows', () => {
  it('accepts a well-formed row for a C3-valid base/foreign pair', async () => {
    const [result] = await validateImportRows(TENANT_ID, SOURCE_CODE, [row()]);
    expect(result.errorCodes).toEqual([]);
    expect(result.isDuplicate).toBe(false);
    expect(result.rate).toBe('2.6');
  });

  it('flags MISSING_FIELD when a required cell is blank', async () => {
    const [result] = await validateImportRows(TENANT_ID, SOURCE_CODE, [row({ rate: '' })]);
    expect(result.errorCodes).toContain(FX_IMPORT_ROW_ERROR.MISSING_FIELD);
  });

  it('flags SAME_CURRENCY when from and to match', async () => {
    const [result] = await validateImportRows(TENANT_ID, SOURCE_CODE, [row({ toCurrencyCode: 'OMR' })]);
    expect(result.errorCodes).toContain(FX_IMPORT_ROW_ERROR.SAME_CURRENCY);
  });

  it('flags UNKNOWN_CURRENCY when a currency is not in the active portfolio', async () => {
    const [result] = await validateImportRows(TENANT_ID, SOURCE_CODE, [row({ toCurrencyCode: 'GBP' })]);
    expect(result.errorCodes).toContain(FX_IMPORT_ROW_ERROR.UNKNOWN_CURRENCY);
  });

  it('flags INVALID_PAIR (C3) when neither side is base/reporting', async () => {
    const [result] = await validateImportRows(TENANT_ID, SOURCE_CODE, [row({ fromCurrencyCode: 'USD', toCurrencyCode: 'SAR' })]);
    expect(result.errorCodes).toContain(FX_IMPORT_ROW_ERROR.INVALID_PAIR);
  });

  it('accepts a pair where the reporting currency (not base) is the anchor', async () => {
    mockCurrencyFindMany.mockResolvedValue([
      { currency_code: 'OMR', is_base_currency: true, is_reporting_currency: false },
      { currency_code: 'SAR', is_base_currency: false, is_reporting_currency: true },
      { currency_code: 'USD', is_base_currency: false, is_reporting_currency: false },
    ]);
    const [result] = await validateImportRows(TENANT_ID, SOURCE_CODE, [row({ fromCurrencyCode: 'SAR', toCurrencyCode: 'USD' })]);
    expect(result.errorCodes).not.toContain(FX_IMPORT_ROW_ERROR.INVALID_PAIR);
  });

  it('flags UNKNOWN_RATE_TYPE for a rate type outside the active catalog', async () => {
    const [result] = await validateImportRows(TENANT_ID, SOURCE_CODE, [row({ rateTypeCode: 'BOGUS' })]);
    expect(result.errorCodes).toContain(FX_IMPORT_ROW_ERROR.UNKNOWN_RATE_TYPE);
  });

  it('flags INVALID_DATE for a malformed or impossible calendar date', async () => {
    const [badFormat] = await validateImportRows(TENANT_ID, SOURCE_CODE, [row({ rateDate: '30-09-2026' })]);
    expect(badFormat.errorCodes).toContain(FX_IMPORT_ROW_ERROR.INVALID_DATE);

    const [impossible] = await validateImportRows(TENANT_ID, SOURCE_CODE, [row({ rateDate: '2026-02-30' })]);
    expect(impossible.errorCodes).toContain(FX_IMPORT_ROW_ERROR.INVALID_DATE);
  });

  it('flags INVALID_RATE for a non-numeric or malformed rate and normalizes a valid one', async () => {
    const [bad] = await validateImportRows(TENANT_ID, SOURCE_CODE, [row({ rate: 'abc' })]);
    expect(bad.errorCodes).toContain(FX_IMPORT_ROW_ERROR.INVALID_RATE);

    const [trimmed] = await validateImportRows(TENANT_ID, SOURCE_CODE, [row({ rate: '2.600000' })]);
    expect(trimmed.errorCodes).toEqual([]);
    expect(trimmed.rate).toBe('2.6');
  });

  it('flags DUPLICATE_EXISTING against a live tenant rate with the same pair/date/type/source', async () => {
    mockRateFindMany.mockResolvedValue([
      { from_currency_code: 'OMR', to_currency_code: 'USD', rate_date: new Date('2026-09-30'), rate_type_code: 'SPOT', source_code: SOURCE_CODE },
    ]);
    const [result] = await validateImportRows(TENANT_ID, SOURCE_CODE, [row()]);
    expect(result.errorCodes).toEqual([FX_IMPORT_ROW_ERROR.DUPLICATE_EXISTING]);
    expect(result.isDuplicate).toBe(true);
  });

  it('flags the second occurrence as DUPLICATE_IN_FILE when the same key repeats within one upload', async () => {
    const [first, second] = await validateImportRows(TENANT_ID, SOURCE_CODE, [row({ rowNumber: 1 }), row({ rowNumber: 2 })]);
    expect(first.errorCodes).toEqual([]);
    expect(second.errorCodes).toEqual([FX_IMPORT_ROW_ERROR.DUPLICATE_IN_FILE]);
    expect(second.isDuplicate).toBe(true);
  });

  it('does not run duplicate detection on a row that already has a format error', async () => {
    const [result] = await validateImportRows(TENANT_ID, SOURCE_CODE, [row({ rate: 'abc' })]);
    expect(result.errorCodes).toEqual([FX_IMPORT_ROW_ERROR.INVALID_RATE]);
    expect(result.isDuplicate).toBe(false);
  });

  it('uppercases and trims currency/rate-type codes for consistent matching', async () => {
    const [result] = await validateImportRows(TENANT_ID, SOURCE_CODE, [
      row({ fromCurrencyCode: ' omr ', toCurrencyCode: 'usd', rateTypeCode: 'spot' }),
    ]);
    expect(result.errorCodes).toEqual([]);
    expect(result.fromCurrencyCode).toBe('OMR');
    expect(result.toCurrencyCode).toBe('USD');
    expect(result.rateTypeCode).toBe('SPOT');
  });
});

/**
 * Tests: fx-import.service (HQ-copy adapter only, plan 01 §7.1).
 * Covers: C3 pairing-rule pair construction, duplicate detection against the
 * live tenant book, batch persistence, and commit (reuse of createRate,
 * auto-approve gating, duplicate-skip resilience).
 */

const mockOrgCurrencyFindMany = jest.fn();
const mockFxSettingsFindFirst = jest.fn();
const mockHqRateFindMany = jest.fn();
const mockTenantRateFindMany = jest.fn();
const mockBatchCreate = jest.fn();
const mockBatchFindFirst = jest.fn();
const mockBatchUpdate = jest.fn();
const mockCreateRate = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_currency_cf: { findMany: (...a: unknown[]) => mockOrgCurrencyFindMany(...a) },
    org_fin_fx_stng_cf: { findFirst: (...a: unknown[]) => mockFxSettingsFindFirst(...a) },
    sys_currency_exchange_rate_mst: { findMany: (...a: unknown[]) => mockHqRateFindMany(...a) },
    org_fx_rate_mst: { findMany: (...a: unknown[]) => mockTenantRateFindMany(...a) },
    org_fx_import_batch_mst: {
      create: (...a: unknown[]) => mockBatchCreate(...a),
      findFirst: (...a: unknown[]) => mockBatchFindFirst(...a),
      update: (...a: unknown[]) => mockBatchUpdate(...a),
    },
  },
}));

jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (id: string, fn: (tenantId: string) => Promise<unknown>) => fn(id)),
}));

jest.mock('@/lib/services/fx/fx-rate.service', () => ({
  createRate: (...a: unknown[]) => mockCreateRate(...a),
}));

import { commitHqCopyImport, previewHqCopyImport } from '@/lib/services/fx/fx-import.service';
import { FX_ERROR, FxError } from '@/lib/services/fx/fx-errors';
import { FX_IMPORT_BATCH_STATUS, FX_RATE_ORIGIN } from '@/lib/constants/currency-fx';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';

function portfolioRow(overrides: Record<string, unknown> = {}) {
  return { currency_code: 'OMR', is_base_currency: true, is_reporting_currency: false, ...overrides };
}

function hqRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'hq-rate-1',
    from_currency_code: 'OMR',
    to_currency_code: 'USD',
    rate_type_code: 'SPOT',
    source_code: 'ecb',
    rate_date: new Date('2026-09-30'),
    rate_value: { toString: () => '2.6000000000' },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  mockFxSettingsFindFirst.mockResolvedValue(null);
  mockTenantRateFindMany.mockResolvedValue([]);
  mockHqRateFindMany.mockResolvedValue([]);
  mockBatchCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ id: 'batch-1', ...data })
  );
});

describe('fx-import.service — previewHqCopyImport (pairing rule, C3)', () => {
  it('persists an empty PREVIEWED batch for a single-currency tenant (no pairs to offer)', async () => {
    mockOrgCurrencyFindMany.mockResolvedValue([portfolioRow()]);

    const result = await previewHqCopyImport({ tenantId: TENANT_ID, actorId: USER_ID });

    expect(result.rows).toEqual([]);
    expect(result.totalRows).toBe(0);
    expect(mockHqRateFindMany).not.toHaveBeenCalled();
    expect(mockBatchCreate).toHaveBeenCalledTimes(1);
    expect(mockBatchCreate.mock.calls[0][0].data.status).toBe(FX_IMPORT_BATCH_STATUS.PREVIEWED);
  });

  it('queries HQ only for base/reporting × other-active-currency pairs (C3)', async () => {
    mockOrgCurrencyFindMany.mockResolvedValue([
      portfolioRow({ currency_code: 'OMR', is_base_currency: true }),
      portfolioRow({ currency_code: 'SAR', is_reporting_currency: true, is_base_currency: false }),
      portfolioRow({ currency_code: 'USD', is_base_currency: false }),
    ]);

    await previewHqCopyImport({ tenantId: TENANT_ID, actorId: USER_ID });

    const where = mockHqRateFindMany.mock.calls[0][0].where as { OR: Array<{ from_currency_code: string; to_currency_code: string }> };
    const pairs = where.OR.map((p) => `${p.from_currency_code}>${p.to_currency_code}`);
    // base(OMR)->USD, reporting(SAR)->USD, and base<->reporting (OMR->SAR) — never USD->* (not an anchor).
    expect(pairs).toEqual(expect.arrayContaining(['OMR>USD', 'SAR>USD', 'OMR>SAR']));
    expect(pairs).not.toEqual(expect.arrayContaining(['USD>OMR']));
  });

  it('returns candidate rows mapped from the HQ book with the exact decimal rate string', async () => {
    mockOrgCurrencyFindMany.mockResolvedValue([portfolioRow(), portfolioRow({ currency_code: 'USD', is_base_currency: false })]);
    mockHqRateFindMany.mockResolvedValue([hqRow()]);

    const result = await previewHqCopyImport({ tenantId: TENANT_ID, actorId: USER_ID });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      hqRateId: 'hq-rate-1',
      fromCurrencyCode: 'OMR',
      toCurrencyCode: 'USD',
      rate: '2.6',
      isDuplicate: false,
    });
    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(0);
  });

  it('flags a row as a duplicate when a live tenant rate already exists for that exact pair/date/type/source', async () => {
    mockOrgCurrencyFindMany.mockResolvedValue([portfolioRow(), portfolioRow({ currency_code: 'USD', is_base_currency: false })]);
    mockHqRateFindMany.mockResolvedValue([hqRow()]);
    mockTenantRateFindMany.mockResolvedValue([
      { from_currency_code: 'OMR', to_currency_code: 'USD', rate_date: new Date('2026-09-30'), source_code: 'ecb' },
    ]);

    const result = await previewHqCopyImport({ tenantId: TENANT_ID, actorId: USER_ID });

    expect(result.rows[0].isDuplicate).toBe(true);
    expect(result.validRows).toBe(0);
    expect(result.invalidRows).toBe(1);
  });

  it('keeps only the latest HQ row per pair+source when multiple dates exist', async () => {
    mockOrgCurrencyFindMany.mockResolvedValue([portfolioRow(), portfolioRow({ currency_code: 'USD', is_base_currency: false })]);
    mockHqRateFindMany.mockResolvedValue([
      hqRow({ id: 'older', rate_date: new Date('2026-09-20'), rate_value: { toString: () => '2.5000000000' } }),
      hqRow({ id: 'newer', rate_date: new Date('2026-09-30'), rate_value: { toString: () => '2.6000000000' } }),
    ]);

    const result = await previewHqCopyImport({ tenantId: TENANT_ID, actorId: USER_ID });

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].hqRateId).toBe('newer');
  });
});

describe('fx-import.service — commitHqCopyImport', () => {
  it('throws IMPORT_BATCH_NOT_FOUND for a missing/other-tenant batch', async () => {
    mockBatchFindFirst.mockResolvedValue(null);
    await expect(
      commitHqCopyImport({ tenantId: TENANT_ID, batchId: 'batch-1', actorId: USER_ID, actorCanApprove: false })
    ).rejects.toMatchObject({ code: FX_ERROR.IMPORT_BATCH_NOT_FOUND });
  });

  it('throws IMPORT_BATCH_NOT_PREVIEWED when the batch was already committed', async () => {
    mockBatchFindFirst.mockResolvedValue({ id: 'batch-1', status: FX_IMPORT_BATCH_STATUS.COMMITTED, preview_rows: [] });
    await expect(
      commitHqCopyImport({ tenantId: TENANT_ID, batchId: 'batch-1', actorId: USER_ID, actorCanApprove: false })
    ).rejects.toMatchObject({ code: FX_ERROR.IMPORT_BATCH_NOT_PREVIEWED });
  });

  it('writes one org_fx_rate_mst row per non-duplicate preview row via createRate, origin HQ_COPY', async () => {
    const previewRows = [
      { hqRateId: 'hq-1', fromCurrencyCode: 'OMR', toCurrencyCode: 'USD', rateTypeCode: 'SPOT', sourceCode: 'ecb', rateDate: '2026-09-30', rate: '2.6', isDuplicate: false },
      { hqRateId: 'hq-2', fromCurrencyCode: 'OMR', toCurrencyCode: 'SAR', rateTypeCode: 'SPOT', sourceCode: 'ecb', rateDate: '2026-09-30', rate: '10.2', isDuplicate: true },
    ];
    mockBatchFindFirst.mockResolvedValue({ id: 'batch-1', status: FX_IMPORT_BATCH_STATUS.PREVIEWED, preview_rows: previewRows });
    mockCreateRate.mockResolvedValue({ id: 'new-rate-id' });

    const result = await commitHqCopyImport({ tenantId: TENANT_ID, batchId: 'batch-1', actorId: USER_ID, actorCanApprove: false });

    expect(mockCreateRate).toHaveBeenCalledTimes(1); // the duplicate row is skipped, never committed
    const [, input] = mockCreateRate.mock.calls[0];
    expect(input).toMatchObject({ originCode: FX_RATE_ORIGIN.HQ_COPY, hqRateId: 'hq-1', importBatchId: 'batch-1', approveNow: false });
    expect(result.committedCount).toBe(1);
    expect(mockBatchUpdate.mock.calls[0][0].data.status).toBe(FX_IMPORT_BATCH_STATUS.COMMITTED);
  });

  it('auto-approves only when auto_approve_imports is on AND the caller says the actor can approve', async () => {
    const previewRows = [
      { hqRateId: 'hq-1', fromCurrencyCode: 'OMR', toCurrencyCode: 'USD', rateTypeCode: 'SPOT', sourceCode: 'ecb', rateDate: '2026-09-30', rate: '2.6', isDuplicate: false },
    ];
    mockBatchFindFirst.mockResolvedValue({ id: 'batch-1', status: FX_IMPORT_BATCH_STATUS.PREVIEWED, preview_rows: previewRows });
    mockFxSettingsFindFirst.mockResolvedValue({ auto_approve_imports: true });
    mockCreateRate.mockResolvedValue({ id: 'new-rate-id' });

    await commitHqCopyImport({ tenantId: TENANT_ID, batchId: 'batch-1', actorId: USER_ID, actorCanApprove: true });

    expect(mockCreateRate.mock.calls[0][1].approveNow).toBe(true);
  });

  it('does not auto-approve when auto_approve_imports is on but the caller says the actor cannot approve', async () => {
    const previewRows = [
      { hqRateId: 'hq-1', fromCurrencyCode: 'OMR', toCurrencyCode: 'USD', rateTypeCode: 'SPOT', sourceCode: 'ecb', rateDate: '2026-09-30', rate: '2.6', isDuplicate: false },
    ];
    mockBatchFindFirst.mockResolvedValue({ id: 'batch-1', status: FX_IMPORT_BATCH_STATUS.PREVIEWED, preview_rows: previewRows });
    mockFxSettingsFindFirst.mockResolvedValue({ auto_approve_imports: true });
    mockCreateRate.mockResolvedValue({ id: 'new-rate-id' });

    await commitHqCopyImport({ tenantId: TENANT_ID, batchId: 'batch-1', actorId: USER_ID, actorCanApprove: false });

    expect(mockCreateRate.mock.calls[0][1].approveNow).toBe(false);
  });

  it('restricts the commit to the given hqRateIds when provided', async () => {
    const previewRows = [
      { hqRateId: 'hq-1', fromCurrencyCode: 'OMR', toCurrencyCode: 'USD', rateTypeCode: 'SPOT', sourceCode: 'ecb', rateDate: '2026-09-30', rate: '2.6', isDuplicate: false },
      { hqRateId: 'hq-2', fromCurrencyCode: 'OMR', toCurrencyCode: 'SAR', rateTypeCode: 'SPOT', sourceCode: 'ecb', rateDate: '2026-09-30', rate: '10.2', isDuplicate: false },
    ];
    mockBatchFindFirst.mockResolvedValue({ id: 'batch-1', status: FX_IMPORT_BATCH_STATUS.PREVIEWED, preview_rows: previewRows });
    mockCreateRate.mockResolvedValue({ id: 'new-rate-id' });

    const result = await commitHqCopyImport({
      tenantId: TENANT_ID,
      batchId: 'batch-1',
      actorId: USER_ID,
      actorCanApprove: false,
      hqRateIds: ['hq-2'],
    });

    expect(mockCreateRate).toHaveBeenCalledTimes(1);
    expect(mockCreateRate.mock.calls[0][1].hqRateId).toBe('hq-2');
    expect(result.committedCount).toBe(1);
  });

  it('skips a row that became a duplicate between preview and commit instead of failing the whole batch', async () => {
    const previewRows = [
      { hqRateId: 'hq-1', fromCurrencyCode: 'OMR', toCurrencyCode: 'USD', rateTypeCode: 'SPOT', sourceCode: 'ecb', rateDate: '2026-09-30', rate: '2.6', isDuplicate: false },
      { hqRateId: 'hq-2', fromCurrencyCode: 'OMR', toCurrencyCode: 'SAR', rateTypeCode: 'SPOT', sourceCode: 'ecb', rateDate: '2026-09-30', rate: '10.2', isDuplicate: false },
    ];
    mockBatchFindFirst.mockResolvedValue({ id: 'batch-1', status: FX_IMPORT_BATCH_STATUS.PREVIEWED, preview_rows: previewRows });
    mockCreateRate
      .mockResolvedValueOnce({ id: 'new-rate-1' })
      .mockRejectedValueOnce(new FxError(FX_ERROR.RATE_DUPLICATE, 'race'));

    const result = await commitHqCopyImport({ tenantId: TENANT_ID, batchId: 'batch-1', actorId: USER_ID, actorCanApprove: false });

    expect(result.committedCount).toBe(1);
    expect(result.skippedDuplicates).toBe(1);
    expect(result.rateIds).toEqual(['new-rate-1']);
  });

  it('propagates a non-duplicate error from createRate instead of swallowing it', async () => {
    const previewRows = [
      { hqRateId: 'hq-1', fromCurrencyCode: 'OMR', toCurrencyCode: 'USD', rateTypeCode: 'SPOT', sourceCode: 'ecb', rateDate: '2026-09-30', rate: '2.6', isDuplicate: false },
    ];
    mockBatchFindFirst.mockResolvedValue({ id: 'batch-1', status: FX_IMPORT_BATCH_STATUS.PREVIEWED, preview_rows: previewRows });
    mockCreateRate.mockRejectedValue(new FxError(FX_ERROR.RATE_PAIR_INVALID, 'pair'));

    await expect(
      commitHqCopyImport({ tenantId: TENANT_ID, batchId: 'batch-1', actorId: USER_ID, actorCanApprove: false })
    ).rejects.toMatchObject({ code: FX_ERROR.RATE_PAIR_INVALID });
  });
});

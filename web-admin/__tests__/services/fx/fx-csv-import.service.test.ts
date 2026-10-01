/**
 * Tests: fx-csv-import.service (plan 01 §7.1, 5D). Covers header validation,
 * size/row caps, batch persistence, and commit (reuse of createRate,
 * auto-approve gating, duplicate-skip resilience) — mirrors
 * fx-import.service.test.ts's HQ-copy coverage for the CSV adapter.
 */

const mockCurrencyFindMany = jest.fn();
const mockRateTypeFindMany = jest.fn();
const mockRateFindMany = jest.fn();
const mockFxSettingsFindFirst = jest.fn();
const mockBatchCreate = jest.fn();
const mockBatchFindFirst = jest.fn();
const mockBatchUpdate = jest.fn();
const mockCreateRate = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    org_currency_cf: { findMany: (...a: unknown[]) => mockCurrencyFindMany(...a) },
    sys_fx_rate_type_cd: { findMany: (...a: unknown[]) => mockRateTypeFindMany(...a) },
    org_fx_rate_mst: { findMany: (...a: unknown[]) => mockRateFindMany(...a) },
    org_fin_fx_stng_cf: { findFirst: (...a: unknown[]) => mockFxSettingsFindFirst(...a) },
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

import { commitCsvImport, previewCsvImport, CSV_MAX_FILE_BYTES, CSV_MAX_ROWS } from '@/lib/services/fx/fx-csv-import.service';
import { FX_ERROR, FxError } from '@/lib/services/fx/fx-errors';
import { FX_IMPORT_BATCH_STATUS, FX_RATE_ORIGIN } from '@/lib/constants/currency-fx';

const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const SOURCE_CODE = 'bank';
const HEADER = 'from_currency,to_currency,rate_date,rate_type,rate,source_reference';

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrencyFindMany.mockResolvedValue([
    { currency_code: 'OMR', is_base_currency: true, is_reporting_currency: false },
    { currency_code: 'USD', is_base_currency: false, is_reporting_currency: false },
  ]);
  mockRateTypeFindMany.mockResolvedValue([{ code: 'SPOT' }]);
  mockRateFindMany.mockResolvedValue([]);
  mockFxSettingsFindFirst.mockResolvedValue(null);
  mockBatchCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: 'batch-1', ...data }));
});

describe('fx-csv-import.service — previewCsvImport (header + size guards)', () => {
  it('rejects a file over the byte-size cap before parsing', async () => {
    const huge = 'x'.repeat(CSV_MAX_FILE_BYTES + 1);
    await expect(
      previewCsvImport({ tenantId: TENANT_ID, actorId: USER_ID, sourceCode: SOURCE_CODE, fileName: 'r.csv', fileContent: huge })
    ).rejects.toMatchObject({ code: FX_ERROR.LOOKUP_INVALID });
    expect(mockBatchCreate).not.toHaveBeenCalled();
  });

  it('rejects a file whose header does not exactly match the template', async () => {
    await expect(
      previewCsvImport({
        tenantId: TENANT_ID,
        actorId: USER_ID,
        sourceCode: SOURCE_CODE,
        fileName: 'r.csv',
        fileContent: 'from,to,date,type,rate,ref\nOMR,USD,2026-09-30,SPOT,2.6,\n',
      })
    ).rejects.toMatchObject({ code: FX_ERROR.LOOKUP_INVALID });
  });

  it('accepts the header case-insensitively and in any column order', async () => {
    const shuffled = 'RATE,FROM_CURRENCY,TO_CURRENCY,RATE_DATE,RATE_TYPE,SOURCE_REFERENCE\n2.6,OMR,USD,2026-09-30,SPOT,inv-1\n';
    const result = await previewCsvImport({ tenantId: TENANT_ID, actorId: USER_ID, sourceCode: SOURCE_CODE, fileName: 'r.csv', fileContent: shuffled });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ fromCurrencyCode: 'OMR', toCurrencyCode: 'USD', rate: '2.6', sourceReference: 'inv-1' });
  });

  it('rejects a file with more data rows than the row cap', async () => {
    const dataRows = Array.from({ length: CSV_MAX_ROWS + 1 }, () => 'OMR,USD,2026-09-30,SPOT,2.6,').join('\n');
    await expect(
      previewCsvImport({ tenantId: TENANT_ID, actorId: USER_ID, sourceCode: SOURCE_CODE, fileName: 'r.csv', fileContent: `${HEADER}\n${dataRows}\n` })
    ).rejects.toMatchObject({ code: FX_ERROR.LOOKUP_INVALID });
  });
});

describe('fx-csv-import.service — previewCsvImport (persistence)', () => {
  it('persists a PREVIEWED batch with origin CSV_IMPORT and the sourceCode in metadata', async () => {
    const content = `${HEADER}\nOMR,USD,2026-09-30,SPOT,2.6,inv-1\n`;
    const result = await previewCsvImport({ tenantId: TENANT_ID, actorId: USER_ID, sourceCode: SOURCE_CODE, fileName: 'rates.csv', fileContent: content });

    expect(result.status).toBe(FX_IMPORT_BATCH_STATUS.PREVIEWED);
    expect(result.validRows).toBe(1);
    const data = mockBatchCreate.mock.calls[0][0].data;
    expect(data.origin_code).toBe(FX_RATE_ORIGIN.CSV_IMPORT);
    expect(data.file_name).toBe('rates.csv');
    expect(data.metadata).toEqual({ sourceCode: SOURCE_CODE });
    expect(typeof data.file_hash).toBe('string');
    expect(data.file_hash.length).toBe(64); // sha256 hex
  });

  it('counts invalid rows (e.g. an unknown currency) separately from valid ones', async () => {
    const content = `${HEADER}\nOMR,GBP,2026-09-30,SPOT,2.6,\nOMR,USD,2026-09-30,SPOT,2.6,\n`;
    const result = await previewCsvImport({ tenantId: TENANT_ID, actorId: USER_ID, sourceCode: SOURCE_CODE, fileName: 'r.csv', fileContent: content });

    expect(result.totalRows).toBe(2);
    expect(result.validRows).toBe(1);
    expect(result.invalidRows).toBe(1);
  });
});

describe('fx-csv-import.service — commitCsvImport', () => {
  it('throws IMPORT_BATCH_NOT_FOUND for a missing/other-tenant batch', async () => {
    mockBatchFindFirst.mockResolvedValue(null);
    await expect(
      commitCsvImport({ tenantId: TENANT_ID, batchId: 'batch-1', actorId: USER_ID, actorCanApprove: false })
    ).rejects.toMatchObject({ code: FX_ERROR.IMPORT_BATCH_NOT_FOUND });
  });

  it('throws IMPORT_BATCH_NOT_PREVIEWED when the batch was already committed', async () => {
    mockBatchFindFirst.mockResolvedValue({ id: 'batch-1', status: FX_IMPORT_BATCH_STATUS.COMMITTED, preview_rows: [], metadata: { sourceCode: SOURCE_CODE } });
    await expect(
      commitCsvImport({ tenantId: TENANT_ID, batchId: 'batch-1', actorId: USER_ID, actorCanApprove: false })
    ).rejects.toMatchObject({ code: FX_ERROR.IMPORT_BATCH_NOT_PREVIEWED });
  });

  it('commits only error-free rows, skipping any row that still has errorCodes', async () => {
    const previewRows = [
      { rowNumber: 1, fromCurrencyCode: 'OMR', toCurrencyCode: 'USD', rateTypeCode: 'SPOT', rateDate: '2026-09-30', rate: '2.6', sourceReference: null, isDuplicate: false, errorCodes: [] },
      { rowNumber: 2, fromCurrencyCode: 'OMR', toCurrencyCode: 'GBP', rateTypeCode: 'SPOT', rateDate: '2026-09-30', rate: '0.5', sourceReference: null, isDuplicate: false, errorCodes: ['UNKNOWN_CURRENCY'] },
    ];
    mockBatchFindFirst.mockResolvedValue({ id: 'batch-1', status: FX_IMPORT_BATCH_STATUS.PREVIEWED, preview_rows: previewRows, metadata: { sourceCode: SOURCE_CODE } });
    mockCreateRate.mockResolvedValue({ id: 'new-rate-1' });

    const result = await commitCsvImport({ tenantId: TENANT_ID, batchId: 'batch-1', actorId: USER_ID, actorCanApprove: false });

    expect(mockCreateRate).toHaveBeenCalledTimes(1);
    const [, createInput] = mockCreateRate.mock.calls[0];
    expect(createInput).toMatchObject({ originCode: FX_RATE_ORIGIN.CSV_IMPORT, sourceCode: SOURCE_CODE, importBatchId: 'batch-1', approveNow: false });
    expect(result.committedCount).toBe(1);
    expect(mockBatchUpdate.mock.calls[0][0].data.status).toBe(FX_IMPORT_BATCH_STATUS.COMMITTED);
  });

  it('auto-approves only when auto_approve_imports is on AND the caller says the actor can approve', async () => {
    const previewRows = [
      { rowNumber: 1, fromCurrencyCode: 'OMR', toCurrencyCode: 'USD', rateTypeCode: 'SPOT', rateDate: '2026-09-30', rate: '2.6', sourceReference: null, isDuplicate: false, errorCodes: [] },
    ];
    mockBatchFindFirst.mockResolvedValue({ id: 'batch-1', status: FX_IMPORT_BATCH_STATUS.PREVIEWED, preview_rows: previewRows, metadata: { sourceCode: SOURCE_CODE } });
    mockFxSettingsFindFirst.mockResolvedValue({ auto_approve_imports: true });
    mockCreateRate.mockResolvedValue({ id: 'new-rate-1' });

    await commitCsvImport({ tenantId: TENANT_ID, batchId: 'batch-1', actorId: USER_ID, actorCanApprove: true });

    expect(mockCreateRate.mock.calls[0][1].approveNow).toBe(true);
  });

  it('skips a row that became a duplicate between preview and commit instead of failing the whole batch', async () => {
    const previewRows = [
      { rowNumber: 1, fromCurrencyCode: 'OMR', toCurrencyCode: 'USD', rateTypeCode: 'SPOT', rateDate: '2026-09-30', rate: '2.6', sourceReference: null, isDuplicate: false, errorCodes: [] },
      { rowNumber: 2, fromCurrencyCode: 'OMR', toCurrencyCode: 'SAR', rateTypeCode: 'SPOT', rateDate: '2026-09-30', rate: '10.2', sourceReference: null, isDuplicate: false, errorCodes: [] },
    ];
    mockBatchFindFirst.mockResolvedValue({ id: 'batch-1', status: FX_IMPORT_BATCH_STATUS.PREVIEWED, preview_rows: previewRows, metadata: { sourceCode: SOURCE_CODE } });
    mockCreateRate.mockResolvedValueOnce({ id: 'new-rate-1' }).mockRejectedValueOnce(new FxError(FX_ERROR.RATE_DUPLICATE, 'race'));

    const result = await commitCsvImport({ tenantId: TENANT_ID, batchId: 'batch-1', actorId: USER_ID, actorCanApprove: false });

    expect(result.committedCount).toBe(1);
    expect(result.skippedCount).toBe(1);
  });

  it('throws LOOKUP_INVALID when the batch is missing its sourceCode metadata', async () => {
    mockBatchFindFirst.mockResolvedValue({ id: 'batch-1', status: FX_IMPORT_BATCH_STATUS.PREVIEWED, preview_rows: [], metadata: {} });
    await expect(
      commitCsvImport({ tenantId: TENANT_ID, batchId: 'batch-1', actorId: USER_ID, actorCanApprove: false })
    ).rejects.toMatchObject({ code: FX_ERROR.LOOKUP_INVALID });
  });

  it('restricts the commit to the given rowNumbers when provided', async () => {
    const previewRows = [
      { rowNumber: 1, fromCurrencyCode: 'OMR', toCurrencyCode: 'USD', rateTypeCode: 'SPOT', rateDate: '2026-09-30', rate: '2.6', sourceReference: null, isDuplicate: false, errorCodes: [] },
      { rowNumber: 2, fromCurrencyCode: 'OMR', toCurrencyCode: 'SAR', rateTypeCode: 'SPOT', rateDate: '2026-09-30', rate: '10.2', sourceReference: null, isDuplicate: false, errorCodes: [] },
    ];
    mockBatchFindFirst.mockResolvedValue({ id: 'batch-1', status: FX_IMPORT_BATCH_STATUS.PREVIEWED, preview_rows: previewRows, metadata: { sourceCode: SOURCE_CODE } });
    mockCreateRate.mockResolvedValue({ id: 'new-rate-1' });

    const result = await commitCsvImport({ tenantId: TENANT_ID, batchId: 'batch-1', actorId: USER_ID, actorCanApprove: false, rowNumbers: [2] });

    expect(mockCreateRate).toHaveBeenCalledTimes(1);
    expect(mockCreateRate.mock.calls[0][1].toCurrencyCode).toBe('SAR');
    expect(result.committedCount).toBe(1);
  });
});

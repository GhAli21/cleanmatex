/**
 * CSV FX rate import adapter (plan 01 §7.1, 5D). Template header whitelist:
 * `from_currency,to_currency,rate_date,rate_type,rate,source_reference`.
 * Server-side parse only (`fx-csv-parser.ts`, no third-party CSV library —
 * see its own header note on why), rate kept as an exact decimal string.
 *
 * Same preview → commit shape as the HQ-copy adapter
 * (`fx-import.service.ts`): preview validates every row
 * (`fx-import-validation.ts`) and snapshots the batch to
 * `org_fx_import_batch_mst.preview_rows`; commit reuses `fx-rate.service.ts`'s
 * `createRate` per valid, non-duplicate row (`origin_code = CSV_IMPORT`).
 * `sourceCode` is supplied once for the whole file (the template has no
 * per-row publisher column — only `source_reference`, a free-text note) and
 * is persisted on the batch's `metadata` so commit can read it back.
 */

import 'server-only';

import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { FX_CSV_TEMPLATE_HEADERS, normalizeHeaderCell, parseCsvText } from './fx-csv-parser';
import { validateImportRows, type RawImportRow, type ValidatedImportRow } from './fx-import-validation';
import { createRate } from './fx-rate.service';
import { FX_ERROR, FxError } from './fx-errors';
import { FX_IMPORT_BATCH_STATUS, FX_RATE_ORIGIN, type FxImportBatchStatus } from '@/lib/constants/currency-fx';

/** R3/F7: same file-size budget the plan assigns the Excel adapter, applied here too. */
export const CSV_MAX_FILE_BYTES = 2 * 1024 * 1024;
export const CSV_MAX_ROWS = 5000;

export interface CsvPreviewInput {
  tenantId: string;
  actorId?: string;
  sourceCode: string;
  fileName: string;
  /** Decoded UTF-8 text. The caller (server action) is responsible for reading the upload as text. */
  fileContent: string;
}

export type CsvPreviewRow = ValidatedImportRow;

export interface CsvPreviewResult {
  batchId: string;
  status: FxImportBatchStatus;
  rows: CsvPreviewRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export interface CsvCommitInput {
  tenantId: string;
  batchId: string;
  actorId?: string;
  /** Caller already checked `fx_rates:approve` — this only decides whether auto-approve is allowed to apply. */
  actorCanApprove: boolean;
  /** Commit only these row numbers from the batch's preview; omit to commit every valid, non-duplicate row. */
  rowNumbers?: number[];
}

export interface CsvCommitResult {
  batchId: string;
  committedCount: number;
  skippedCount: number;
  rateIds: string[];
}

function hashFileContent(content: string): string {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export async function previewCsvImport(input: CsvPreviewInput): Promise<CsvPreviewResult> {
  if (Buffer.byteLength(input.fileContent, 'utf8') > CSV_MAX_FILE_BYTES) {
    throw new FxError(FX_ERROR.LOOKUP_INVALID, `CSV file exceeds the ${CSV_MAX_FILE_BYTES}-byte limit`);
  }

  const { header, rows: rawCells } = parseCsvText(input.fileContent);
  const normalizedHeader = header.map(normalizeHeaderCell);
  const expectedHeader = [...FX_CSV_TEMPLATE_HEADERS];
  const headerMatches =
    normalizedHeader.length === expectedHeader.length && expectedHeader.every((col) => normalizedHeader.includes(col));
  if (!headerMatches) {
    throw new FxError(FX_ERROR.LOOKUP_INVALID, `CSV header must be exactly: ${expectedHeader.join(',')}`);
  }
  if (rawCells.length > CSV_MAX_ROWS) {
    throw new FxError(FX_ERROR.LOOKUP_INVALID, `CSV file has more than ${CSV_MAX_ROWS} data rows`);
  }

  const colIndex = {
    from: normalizedHeader.indexOf('from_currency'),
    to: normalizedHeader.indexOf('to_currency'),
    date: normalizedHeader.indexOf('rate_date'),
    type: normalizedHeader.indexOf('rate_type'),
    rate: normalizedHeader.indexOf('rate'),
    ref: normalizedHeader.indexOf('source_reference'),
  };

  const rawRows: RawImportRow[] = rawCells.map((cells, i) => ({
    rowNumber: i + 1,
    fromCurrencyCode: cells[colIndex.from] ?? '',
    toCurrencyCode: cells[colIndex.to] ?? '',
    rateTypeCode: cells[colIndex.type] ?? '',
    rateDate: cells[colIndex.date] ?? '',
    rate: cells[colIndex.rate] ?? '',
    sourceReference: cells[colIndex.ref]?.trim() || null,
  }));

  return withTenantContext(input.tenantId, async (tenant) => {
    const validated = await validateImportRows(tenant, input.sourceCode, rawRows);
    const validRows = validated.filter((r) => r.errorCodes.length === 0).length;
    const invalidRows = validated.length - validRows;

    const batch = await prisma.org_fx_import_batch_mst.create({
      data: {
        tenant_org_id: tenant,
        origin_code: FX_RATE_ORIGIN.CSV_IMPORT,
        file_name: input.fileName,
        file_hash: hashFileContent(input.fileContent),
        status: FX_IMPORT_BATCH_STATUS.PREVIEWED,
        total_rows: validated.length,
        valid_rows: validRows,
        invalid_rows: invalidRows,
        preview_rows: validated as unknown as Prisma.InputJsonValue,
        metadata: { sourceCode: input.sourceCode } as Prisma.InputJsonValue,
        created_by: input.actorId ?? null,
      } as Prisma.org_fx_import_batch_mstUncheckedCreateInput,
    });

    return {
      batchId: batch.id,
      status: FX_IMPORT_BATCH_STATUS.PREVIEWED,
      rows: validated,
      totalRows: validated.length,
      validRows,
      invalidRows,
    };
  });
}

export async function commitCsvImport(input: CsvCommitInput): Promise<CsvCommitResult> {
  return withTenantContext(input.tenantId, async (tenant) => {
    const batch = await prisma.org_fx_import_batch_mst.findFirst({
      where: { id: input.batchId, tenant_org_id: tenant, rec_status: 1 },
    });
    if (!batch) {
      throw new FxError(FX_ERROR.IMPORT_BATCH_NOT_FOUND, `tenant ${tenant} batch ${input.batchId}`);
    }
    if (batch.status !== FX_IMPORT_BATCH_STATUS.PREVIEWED) {
      throw new FxError(FX_ERROR.IMPORT_BATCH_NOT_PREVIEWED, `batch ${input.batchId} is ${batch.status}`);
    }

    const sourceCode = (batch.metadata as { sourceCode?: string } | null)?.sourceCode;
    if (!sourceCode) {
      throw new FxError(FX_ERROR.LOOKUP_INVALID, `batch ${input.batchId} is missing its source code`);
    }

    const previewRows = ((batch.preview_rows as unknown as CsvPreviewRow[]) ?? []).filter(
      (row) => row.errorCodes.length === 0 && (!input.rowNumbers || input.rowNumbers.includes(row.rowNumber))
    );

    const fxSettings = await prisma.org_fin_fx_stng_cf.findFirst({ where: { tenant_org_id: tenant } });
    const approveNow = (fxSettings?.auto_approve_imports ?? false) && input.actorCanApprove;

    const rateIds: string[] = [];
    let skippedCount = 0;

    for (const row of previewRows) {
      try {
        const created = await createRate(
          tenant,
          {
            fromCurrencyCode: row.fromCurrencyCode,
            toCurrencyCode: row.toCurrencyCode,
            rateTypeCode: row.rateTypeCode,
            sourceCode,
            originCode: FX_RATE_ORIGIN.CSV_IMPORT,
            rateDate: row.rateDate,
            rate: row.rate,
            sourceReference: row.sourceReference,
            importBatchId: batch.id,
            approveNow,
          },
          input.actorId
        );
        rateIds.push(created.id);
      } catch (error) {
        if (error instanceof FxError && error.code === FX_ERROR.RATE_DUPLICATE) {
          // A live row for this key appeared after preview — skip, don't fail the batch.
          skippedCount += 1;
          continue;
        }
        throw error;
      }
    }

    await prisma.org_fx_import_batch_mst.update({
      where: { id: batch.id, tenant_org_id: tenant },
      data: {
        status: FX_IMPORT_BATCH_STATUS.COMMITTED,
        valid_rows: rateIds.length,
        updated_at: new Date(),
        updated_by: input.actorId ?? null,
      },
    });

    return { batchId: batch.id, committedCount: rateIds.length, skippedCount, rateIds };
  });
}

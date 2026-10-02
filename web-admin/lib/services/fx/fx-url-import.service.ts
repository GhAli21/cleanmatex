/**
 * Provider URL fetch FX rate import adapter (plan 01 §7.1, 5E). Same
 * preview → commit shape as the CSV/HQ-copy adapters: `previewUrlImport`
 * fetches one curated `sys_fx_provider_cd` row's feed (`fx-provider-fetch.ts`
 * — HTTPS-only, host-allowlisted, no redirects, size/time capped), maps its
 * rates into the same row shape the CSV adapter validates with
 * (`fx-import-validation.ts`), and snapshots the batch to
 * `org_fx_import_batch_mst.preview_rows`. `commitUrlImport` reuses
 * `fx-rate.service.ts`'s `createRate` per valid, non-duplicate row
 * (`origin_code = URL_FETCH`, `provider_code` set).
 *
 * `sourceCode` for every row is always the provider's own `source_code`
 * (e.g. `ecb`) — never user-selected, same principle as the HQ-copy adapter.
 *
 * `rateType` is fixed to `SPOT` for every row from this adapter: the ECB feed
 * (and the shape of `FetchedProviderRates` generally) has no rate-type
 * concept of its own.
 *
 * Known, expected, correct behavior, not a bug: ECB's daily feed does not
 * publish GCC currencies (OMR/SAR/AED/QAR/KWD/BHD) at all, so for a typical
 * GCC tenant whose base currency isn't EUR, a live preview legitimately
 * returns zero valid candidate rows (every pair fails C3 in
 * `validateImportRows`, since the provider's base currency isn't in the
 * tenant's portfolio at all).
 */

import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { fetchProviderRates, FxProviderFetchError, type FetchedProviderRates, type ProviderRow } from './fx-provider-fetch';
import { validateImportRows, type RawImportRow, type ValidatedImportRow } from './fx-import-validation';
import { createRate } from './fx-rate.service';
import { FX_ERROR, FxError } from './fx-errors';
import { FX_IMPORT_BATCH_STATUS, FX_RATE_ORIGIN, FX_RATE_TYPE, type FxImportBatchStatus } from '@/lib/constants/currency-fx';

export interface UrlImportPreviewInput {
  tenantId: string;
  actorId?: string;
  providerCode: string;
}

export type UrlImportPreviewRow = ValidatedImportRow;

export interface UrlImportPreviewResult {
  batchId: string;
  status: FxImportBatchStatus;
  providerCode: string;
  /** The date the provider published these rates for (YYYY-MM-DD), as reported by the feed. */
  feedRateDate: string;
  rows: UrlImportPreviewRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export interface UrlImportCommitInput {
  tenantId: string;
  batchId: string;
  actorId?: string;
  /** Caller already checked `fx_rates:approve` — this only decides whether auto-approve is allowed to apply. */
  actorCanApprove: boolean;
  /** Commit only these row numbers from the batch's preview; omit to commit every valid, non-duplicate row. */
  rowNumbers?: number[];
}

export interface UrlImportCommitResult {
  batchId: string;
  committedCount: number;
  skippedCount: number;
  rateIds: string[];
}

interface UrlImportBatchMetadata {
  providerCode: string;
  sourceCode: string;
}

/** Translates the fetch layer's own error class into the service layer's single error type. */
function wrapFetchError(error: unknown): never {
  if (error instanceof FxProviderFetchError) {
    throw new FxError(FX_ERROR.PROVIDER_FETCH_FAILED, `${error.code}: ${error.message}`);
  }
  throw error;
}

export async function previewUrlImport(input: UrlImportPreviewInput): Promise<UrlImportPreviewResult> {
  return withTenantContext(input.tenantId, async (tenant) => {
    const providerCfg = await prisma.sys_fx_provider_cd.findFirst({
      where: { code: input.providerCode, is_active: true, rec_status: 1 },
    });
    if (!providerCfg) {
      throw new FxError(FX_ERROR.PROVIDER_NOT_FOUND, `provider ${input.providerCode}`);
    }

    const provider: ProviderRow = {
      code: providerCfg.code,
      baseUrl: providerCfg.base_url,
      allowedHosts: providerCfg.allowed_hosts,
      authMode: providerCfg.auth_mode,
      parserCode: providerCfg.parser_code,
    };

    let feed: FetchedProviderRates;
    try {
      feed = await fetchProviderRates(provider);
    } catch (error) {
      wrapFetchError(error);
    }

    const sourceCode = providerCfg.source_code;
    const rawRows: RawImportRow[] = Object.entries(feed.rates).map(([toCode, rate], i) => ({
      rowNumber: i + 1,
      fromCurrencyCode: feed.baseCurrencyCode,
      toCurrencyCode: toCode,
      rateTypeCode: FX_RATE_TYPE.SPOT,
      rateDate: feed.rateDate,
      rate,
      sourceReference: null,
    }));

    const validated = await validateImportRows(tenant, sourceCode, rawRows);
    const validRows = validated.filter((r) => r.errorCodes.length === 0).length;
    const invalidRows = validated.length - validRows;

    const metadata: UrlImportBatchMetadata = { providerCode: provider.code, sourceCode };
    const batch = await prisma.org_fx_import_batch_mst.create({
      data: {
        tenant_org_id: tenant,
        origin_code: FX_RATE_ORIGIN.URL_FETCH,
        provider_code: provider.code,
        status: FX_IMPORT_BATCH_STATUS.PREVIEWED,
        total_rows: validated.length,
        valid_rows: validRows,
        invalid_rows: invalidRows,
        preview_rows: validated as unknown as Prisma.InputJsonValue,
        metadata: metadata as unknown as Prisma.InputJsonValue,
        created_by: input.actorId ?? null,
      } as Prisma.org_fx_import_batch_mstUncheckedCreateInput,
    });

    return {
      batchId: batch.id,
      status: FX_IMPORT_BATCH_STATUS.PREVIEWED,
      providerCode: provider.code,
      feedRateDate: feed.rateDate,
      rows: validated,
      totalRows: validated.length,
      validRows,
      invalidRows,
    };
  });
}

export async function commitUrlImport(input: UrlImportCommitInput): Promise<UrlImportCommitResult> {
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

    const metadata = batch.metadata as unknown as UrlImportBatchMetadata | null;
    if (!metadata?.providerCode || !metadata?.sourceCode) {
      throw new FxError(FX_ERROR.LOOKUP_INVALID, `batch ${input.batchId} is missing its provider/source code`);
    }

    const previewRows = ((batch.preview_rows as unknown as UrlImportPreviewRow[]) ?? []).filter(
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
            sourceCode: metadata.sourceCode,
            originCode: FX_RATE_ORIGIN.URL_FETCH,
            providerCode: metadata.providerCode,
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

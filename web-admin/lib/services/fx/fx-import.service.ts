/**
 * Tenant FX rate import pipeline (plan 01 §7.1) — HQ-copy adapter only.
 * CSV / Excel / URL adapters are stages 5D/5E and are out of scope here.
 *
 * Preview → commit, same two-step shape as the plan describes for every
 * adapter: `previewHqCopyImport` reads `sys_currency_exchange_rate_mst`
 * (HQ's approved book) for every C3-valid pair (one side the tenant's
 * base/reporting currency, the other an active portfolio currency), snapshots
 * the candidate rows on `org_fx_import_batch_mst.preview_rows`, and flags
 * rows that already have a live (DRAFT/APPROVED) tenant row for the same
 * pair/date/type/source (`uq_ofrm_live`) as duplicates. `commitHqCopyImport`
 * writes the non-duplicate, selected rows into `org_fx_rate_mst` via
 * `createRate` (reusing its C3-trigger/unique-violation translation), with
 * `origin_code = HQ_COPY`, `hq_rate_id` = the HQ row's id (a snapshot, not a
 * live link — a later HQ void never silently changes tenant history), and
 * `source_code` copied from the HQ row's own publisher (never a literal
 * 'cleanmatex_hq'). Rows land APPROVED only when the tenant's
 * `auto_approve_imports` is on AND the caller says the actor holds
 * `fx_rates:approve` — permission checking itself stays out of this service.
 */

import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { formatRate, parseRate } from './fx-decimal';
import { FX_ERROR, FxError } from './fx-errors';
import { createRate } from './fx-rate.service';
import {
  FX_IMPORT_BATCH_STATUS,
  FX_RATE_ORIGIN,
  FX_RATE_STATUS,
  FX_RATE_TYPE,
  type FxImportBatchStatus,
} from '@/lib/constants/currency-fx';

export interface HqCopyPreviewInput {
  tenantId: string;
  actorId?: string;
  /** Defaults to the tenant's org_fin_fx_stng_cf.default_rate_type_code, else SPOT. */
  rateTypeCode?: string;
  /** YYYY-MM-DD; defaults to today (UTC). Only HQ rates on or before this date are considered. */
  asOfDate?: string;
  /** Restrict to one HQ publisher; otherwise every matching source is offered. */
  sourceCode?: string;
}

export interface HqCopyPreviewRow {
  hqRateId: string;
  fromCurrencyCode: string;
  toCurrencyCode: string;
  rateTypeCode: string;
  sourceCode: string;
  /** YYYY-MM-DD. */
  rateDate: string;
  /** Exact decimal string. */
  rate: string;
  /** A DRAFT/APPROVED tenant row already exists for this pair/date/type/source — commit skips it. */
  isDuplicate: boolean;
}

export interface HqCopyPreviewResult {
  batchId: string;
  status: FxImportBatchStatus;
  rows: HqCopyPreviewRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
}

export interface HqCopyCommitInput {
  tenantId: string;
  batchId: string;
  actorId?: string;
  /** Caller already checked `fx_rates:approve` — this only decides whether auto-approve is allowed to apply. */
  actorCanApprove: boolean;
  /** Commit only these hqRateIds from the batch's preview; omit to commit every non-duplicate row. */
  hqRateIds?: string[];
}

export interface HqCopyCommitResult {
  batchId: string;
  committedCount: number;
  skippedDuplicates: number;
  rateIds: string[];
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** C3-valid pairs: every active anchor (base, reporting) paired with every other active portfolio currency. */
function buildC3Pairs(
  portfolio: Array<{ currency_code: string; is_base_currency: boolean; is_reporting_currency: boolean }>
): Array<{ from: string; to: string }> {
  const base = portfolio.find((c) => c.is_base_currency);
  if (!base) return [];
  const reporting = portfolio.find((c) => c.is_reporting_currency);
  const anchors = [base.currency_code, ...(reporting ? [reporting.currency_code] : [])];
  const anchorSet = new Set(anchors);
  const others = portfolio.map((c) => c.currency_code).filter((code) => !anchorSet.has(code));

  const pairs: Array<{ from: string; to: string }> = [];
  for (const anchor of anchors) {
    for (const code of others) {
      pairs.push({ from: anchor, to: code });
    }
  }
  if (anchors.length === 2) {
    pairs.push({ from: anchors[0], to: anchors[1] });
  }
  return pairs;
}

function liveKey(fromCode: string, toCode: string, rateDate: string, sourceCode: string): string {
  return `${fromCode}:${toCode}:${rateDate}:${sourceCode}`;
}

/**
 * Preview an HQ-copy import: the candidate rows the tenant could bring into
 * its own book, with duplicates flagged. Always persists a PREVIEWED batch
 * row (even when `rows` is empty) so `commitHqCopyImport` has a stable id to
 * target.
 */
export async function previewHqCopyImport(input: HqCopyPreviewInput): Promise<HqCopyPreviewResult> {
  return withTenantContext(input.tenantId, async (tenant) => {
    const [portfolio, fxSettings] = await Promise.all([
      prisma.org_currency_cf.findMany({ where: { tenant_org_id: tenant, rec_status: 1, is_active: true } }),
      prisma.org_fin_fx_stng_cf.findFirst({ where: { tenant_org_id: tenant } }),
    ]);

    const pairs = buildC3Pairs(portfolio);
    const rateTypeCode = (input.rateTypeCode ?? fxSettings?.default_rate_type_code ?? FX_RATE_TYPE.SPOT).toUpperCase();
    const asOfDate = input.asOfDate ?? todayUtc();

    let rows: HqCopyPreviewRow[] = [];

    if (pairs.length > 0) {
      const hqRows = await prisma.sys_currency_exchange_rate_mst.findMany({
        where: {
          status: FX_RATE_STATUS.APPROVED,
          rec_status: 1,
          rate_type_code: rateTypeCode,
          rate_date: { lte: new Date(asOfDate) },
          ...(input.sourceCode && { source_code: input.sourceCode }),
          OR: pairs.map((p) => ({ from_currency_code: p.from, to_currency_code: p.to })),
        },
        orderBy: [{ rate_date: 'desc' }],
      });

      // Latest HQ row per (pair, source) — a tenant may want more than one publisher's quote.
      const latestByKey = new Map<string, (typeof hqRows)[number]>();
      for (const row of hqRows) {
        const key = `${row.from_currency_code}:${row.to_currency_code}:${row.source_code}`;
        const existing = latestByKey.get(key);
        if (!existing || row.rate_date > existing.rate_date) latestByKey.set(key, row);
      }

      const existingLive = await prisma.org_fx_rate_mst.findMany({
        where: {
          tenant_org_id: tenant,
          rec_status: 1,
          status: { in: [FX_RATE_STATUS.DRAFT, FX_RATE_STATUS.APPROVED] },
          rate_type_code: rateTypeCode,
        },
        select: { from_currency_code: true, to_currency_code: true, rate_date: true, source_code: true },
      });
      const liveKeys = new Set(
        existingLive.map((r) => liveKey(r.from_currency_code, r.to_currency_code, r.rate_date.toISOString().slice(0, 10), r.source_code))
      );

      rows = [...latestByKey.values()].map((row) => {
        const rateDate = row.rate_date.toISOString().slice(0, 10);
        return {
          hqRateId: row.id,
          fromCurrencyCode: row.from_currency_code,
          toCurrencyCode: row.to_currency_code,
          rateTypeCode: row.rate_type_code,
          sourceCode: row.source_code,
          rateDate,
          rate: formatRate(parseRate(row.rate_value.toString())),
          isDuplicate: liveKeys.has(liveKey(row.from_currency_code, row.to_currency_code, rateDate, row.source_code)),
        };
      });
    }

    const validRows = rows.filter((r) => !r.isDuplicate).length;
    const invalidRows = rows.length - validRows;

    const batch = await prisma.org_fx_import_batch_mst.create({
      data: {
        tenant_org_id: tenant,
        origin_code: FX_RATE_ORIGIN.HQ_COPY,
        status: FX_IMPORT_BATCH_STATUS.PREVIEWED,
        total_rows: rows.length,
        valid_rows: validRows,
        invalid_rows: invalidRows,
        preview_rows: rows as unknown as Prisma.InputJsonValue,
        created_by: input.actorId ?? null,
      } as Prisma.org_fx_import_batch_mstUncheckedCreateInput,
    });

    return {
      batchId: batch.id,
      status: FX_IMPORT_BATCH_STATUS.PREVIEWED,
      rows,
      totalRows: rows.length,
      validRows,
      invalidRows,
    };
  });
}

/**
 * Commit a previously previewed HQ-copy batch: writes the selected,
 * non-duplicate rows into `org_fx_rate_mst` and marks the batch COMMITTED.
 * A row that became a duplicate between preview and commit (another actor
 * imported it meanwhile) is skipped, not fatal to the rest of the batch.
 */
export async function commitHqCopyImport(input: HqCopyCommitInput): Promise<HqCopyCommitResult> {
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

    const previewRows = ((batch.preview_rows as unknown as HqCopyPreviewRow[]) ?? []).filter(
      (row) => !row.isDuplicate && (!input.hqRateIds || input.hqRateIds.includes(row.hqRateId))
    );

    const fxSettings = await prisma.org_fin_fx_stng_cf.findFirst({ where: { tenant_org_id: tenant } });
    const approveNow = (fxSettings?.auto_approve_imports ?? false) && input.actorCanApprove;

    const rateIds: string[] = [];
    let skippedDuplicates = 0;

    for (const row of previewRows) {
      try {
        const created = await createRate(
          tenant,
          {
            fromCurrencyCode: row.fromCurrencyCode,
            toCurrencyCode: row.toCurrencyCode,
            rateTypeCode: row.rateTypeCode,
            sourceCode: row.sourceCode,
            originCode: FX_RATE_ORIGIN.HQ_COPY,
            rateDate: row.rateDate,
            rate: row.rate,
            hqRateId: row.hqRateId,
            importBatchId: batch.id,
            approveNow,
          },
          input.actorId
        );
        rateIds.push(created.id);
      } catch (error) {
        if (error instanceof FxError && error.code === FX_ERROR.RATE_DUPLICATE) {
          // A live row for this pair/date/type/source appeared after preview — skip, don't fail the batch.
          skippedDuplicates += 1;
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

    return { batchId: batch.id, committedCount: rateIds.length, skippedDuplicates, rateIds };
  });
}

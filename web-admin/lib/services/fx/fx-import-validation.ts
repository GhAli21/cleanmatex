/**
 * Shared per-row validation for file-based FX rate imports (plan 01 §7.1,
 * CSV now / Excel later). Enforces the same C3 pairing rule the DB trigger
 * (`fn_ofrm_pair_check`) and `fx-import.service.ts`'s HQ-copy adapter already
 * apply, plus format checks and duplicate detection (both against the live
 * tenant book and within the uploaded file itself).
 *
 * Read-only; never writes. Adapters call this, then persist the result to
 * `org_fx_import_batch_mst.preview_rows` themselves.
 */

import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { parseRate, formatRate } from './fx-decimal';
import { FX_IMPORT_ROW_ERROR, FX_RATE_STATUS, type FxImportRowError } from '@/lib/constants/currency-fx';

export interface RawImportRow {
  rowNumber: number;
  fromCurrencyCode: string;
  toCurrencyCode: string;
  rateTypeCode: string;
  /** Raw text as read from the file; normalized to YYYY-MM-DD once validated. */
  rateDate: string;
  /** Raw text as read from the file; normalized to its canonical decimal string once validated. */
  rate: string;
  sourceReference: string | null;
}

export interface ValidatedImportRow extends RawImportRow {
  isDuplicate: boolean;
  errorCodes: FxImportRowError[];
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isValidCalendarDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function liveKey(fromCode: string, toCode: string, rateDate: string, sourceCode: string, rateType: string): string {
  return `${fromCode}:${toCode}:${rateDate}:${rateType}:${sourceCode}`;
}

/**
 * Validates every row against the tenant's current portfolio (C3), known
 * rate types, and the live tenant rate book (+ in-file duplicates). Every
 * row gets a result — valid rows have an empty `errorCodes` array and
 * `isDuplicate: false`.
 */
export async function validateImportRows(
  tenantId: string,
  sourceCode: string,
  rawRows: RawImportRow[]
): Promise<ValidatedImportRow[]> {
  return withTenantContext(tenantId, async (tenant) => {
    const [portfolio, rateTypes, existingLive] = await Promise.all([
      prisma.org_currency_cf.findMany({
        where: { tenant_org_id: tenant, rec_status: 1, is_active: true },
        select: { currency_code: true, is_base_currency: true, is_reporting_currency: true },
      }),
      prisma.sys_fx_rate_type_cd.findMany({ where: { is_active: true }, select: { code: true } }),
      prisma.org_fx_rate_mst.findMany({
        where: { tenant_org_id: tenant, rec_status: 1, status: { in: [FX_RATE_STATUS.DRAFT, FX_RATE_STATUS.APPROVED] } },
        select: { from_currency_code: true, to_currency_code: true, rate_date: true, rate_type_code: true, source_code: true },
      }),
    ]);

    const portfolioCodes = new Set(portfolio.map((c) => c.currency_code));
    const anchorCodes = new Set(portfolio.filter((c) => c.is_base_currency || c.is_reporting_currency).map((c) => c.currency_code));
    const rateTypeCodes = new Set(rateTypes.map((rt) => rt.code));
    const liveKeys = new Set(
      existingLive.map((r) =>
        liveKey(r.from_currency_code, r.to_currency_code, r.rate_date.toISOString().slice(0, 10), r.rate_type_code, r.source_code)
      )
    );

    const seenInFile = new Set<string>();

    return rawRows.map((row): ValidatedImportRow => {
      const errorCodes: FxImportRowError[] = [];
      const fromCode = row.fromCurrencyCode.trim().toUpperCase();
      const toCode = row.toCurrencyCode.trim().toUpperCase();
      const rateTypeCode = row.rateTypeCode.trim().toUpperCase();
      const rateDate = row.rateDate.trim();
      const sourceReference = row.sourceReference?.trim() || null;

      if (!fromCode || !toCode || !rateTypeCode || !rateDate || !row.rate.trim()) {
        errorCodes.push(FX_IMPORT_ROW_ERROR.MISSING_FIELD);
      }

      if (fromCode && toCode && fromCode === toCode) {
        errorCodes.push(FX_IMPORT_ROW_ERROR.SAME_CURRENCY);
      }

      if (fromCode && toCode && fromCode !== toCode) {
        if (!portfolioCodes.has(fromCode) || !portfolioCodes.has(toCode)) {
          errorCodes.push(FX_IMPORT_ROW_ERROR.UNKNOWN_CURRENCY);
        } else if (!anchorCodes.has(fromCode) && !anchorCodes.has(toCode)) {
          // C3: one side must be the tenant's base/reporting currency.
          errorCodes.push(FX_IMPORT_ROW_ERROR.INVALID_PAIR);
        }
      }

      if (rateTypeCode && !rateTypeCodes.has(rateTypeCode)) {
        errorCodes.push(FX_IMPORT_ROW_ERROR.UNKNOWN_RATE_TYPE);
      }

      if (rateDate && !isValidCalendarDate(rateDate)) {
        errorCodes.push(FX_IMPORT_ROW_ERROR.INVALID_DATE);
      }

      let normalizedRate = row.rate.trim();
      if (normalizedRate) {
        try {
          normalizedRate = formatRate(parseRate(normalizedRate));
        } catch {
          errorCodes.push(FX_IMPORT_ROW_ERROR.INVALID_RATE);
        }
      }

      let isDuplicate = false;
      if (errorCodes.length === 0) {
        const key = liveKey(fromCode, toCode, rateDate, rateTypeCode, sourceCode);
        if (liveKeys.has(key)) {
          errorCodes.push(FX_IMPORT_ROW_ERROR.DUPLICATE_EXISTING);
          isDuplicate = true;
        } else if (seenInFile.has(key)) {
          errorCodes.push(FX_IMPORT_ROW_ERROR.DUPLICATE_IN_FILE);
          isDuplicate = true;
        } else {
          seenInFile.add(key);
        }
      }

      return {
        rowNumber: row.rowNumber,
        fromCurrencyCode: fromCode,
        toCurrencyCode: toCode,
        rateTypeCode,
        rateDate,
        rate: normalizedRate,
        sourceReference,
        isDuplicate,
        errorCodes,
      };
    });
  });
}

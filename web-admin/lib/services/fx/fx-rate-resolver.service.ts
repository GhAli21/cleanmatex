/**
 * Tenant FX rate resolver (plan 01 §7.1). Resolves a rate for a currency
 * pair: own approved rate → HQ approved rate, per the tenant's
 * `org_fin_fx_stng_cf.resolution_policy` (TENANT_THEN_HQ default /
 * TENANT_ONLY / HQ_ONLY). Same direct → inverse logic as the HQ resolver —
 * no triangulation. Read-only; never writes to either book.
 */

import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { invertRate, parseRate, formatRate } from './fx-decimal';
import { FX_ERROR, FxError } from './fx-errors';
import {
  FX_RATE_STATUS,
  FX_RATE_TYPE,
  FX_RESOLUTION,
  FX_RESOLUTION_POLICY,
  FX_RATE_SOURCE_BOOK,
  type FxResolution,
  type FxRateSourceBook,
} from '@/lib/constants/currency-fx';

export interface ResolveRateInput {
  from: string;
  to: string;
  rateType?: string;
  /** YYYY-MM-DD; defaults to today (UTC). */
  date?: string;
  /** Restrict to one publisher; otherwise publishers are ranked by display_order. */
  source?: string;
}

export interface ResolvedRate {
  resolution: FxResolution;
  /** Which book answered. `null` only for SAME_CURRENCY (no book consulted). */
  book: FxRateSourceBook | null;
  /** Exact decimal string, to = from × rate. */
  rate: string;
  rateScaled: bigint;
  /** Row id in the book that answered (for SAME_CURRENCY: null). */
  rateId: string | null;
  rateDate: string | null;
  rateTypeCode: string;
  sourceCode: string | null;
  requestedDate: string;
  ageDays: number | null;
  maxAgeDays: number | null;
  stale: boolean;
}

const CANDIDATE_LIMIT = 50;
const MS_PER_DAY = 86_400_000;

interface Candidate {
  id: string;
  rate_date: Date;
  rate_value: { toString(): string };
  source_code: string;
  created_at: Date;
}

/** Latest date first; within that date, publisher precedence by display_order, then newest row. */
function pickBest<T extends Candidate>(rows: T[], sourceOrder: Map<string, number>): T | null {
  if (rows.length === 0) return null;
  const latestDate = rows.reduce((max, r) => (r.rate_date > max ? r.rate_date : max), rows[0].rate_date);
  return (
    rows
      .filter((r) => r.rate_date.getTime() === latestDate.getTime())
      .sort((a, b) => {
        const byOrder = (sourceOrder.get(a.source_code) ?? Number.MAX_SAFE_INTEGER) - (sourceOrder.get(b.source_code) ?? Number.MAX_SAFE_INTEGER);
        return byOrder !== 0 ? byOrder : b.created_at.getTime() - a.created_at.getTime();
      })[0] ?? null
  );
}

function daysBetween(fromDate: Date, toDate: string): number {
  return Math.round((Date.parse(`${toDate}T00:00:00Z`) - fromDate.getTime()) / MS_PER_DAY);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function resolveRate(tenantId: string, input: ResolveRateInput): Promise<ResolvedRate> {
  const from = input.from.toUpperCase();
  const to = input.to.toUpperCase();
  const requestedDate = input.date ?? todayUtc();

  if (from === to) {
    return {
      resolution: FX_RESOLUTION.SAME_CURRENCY,
      book: null,
      rate: '1',
      rateScaled: parseRate('1'),
      rateId: null,
      rateDate: null,
      rateTypeCode: input.rateType ?? FX_RATE_TYPE.SPOT,
      sourceCode: null,
      requestedDate,
      ageDays: null,
      maxAgeDays: null,
      stale: false,
    };
  }

  return withTenantContext(tenantId, async (tenant) => {
    const [fxSettings, sources] = await Promise.all([
      prisma.org_fin_fx_stng_cf.findFirst({ where: { tenant_org_id: tenant } }),
      prisma.sys_exchange_rate_source_cd.findMany({ where: { is_active: true }, select: { code: true, display_order: true } }),
    ]);
    const policy = fxSettings?.resolution_policy ?? FX_RESOLUTION_POLICY.TENANT_THEN_HQ;
    const rateTypeCode = (input.rateType ?? fxSettings?.default_rate_type_code ?? FX_RATE_TYPE.SPOT).toUpperCase();
    const sourceOrder = new Map(sources.map((s) => [s.code, s.display_order]));

    const rateType = await prisma.sys_fx_rate_type_cd.findUnique({ where: { code: rateTypeCode } });
    if (!rateType) {
      throw new FxError(FX_ERROR.LOOKUP_INVALID, `unknown rate type ${rateTypeCode}`);
    }

    async function searchTenantBook(pairFrom: string, pairTo: string) {
      const rows = await prisma.org_fx_rate_mst.findMany({
        where: {
          tenant_org_id: tenant,
          status: FX_RATE_STATUS.APPROVED,
          rec_status: 1,
          from_currency_code: pairFrom,
          to_currency_code: pairTo,
          rate_type_code: rateTypeCode,
          rate_date: { lte: new Date(requestedDate) },
          ...(input.source && { source_code: input.source }),
        },
        orderBy: { rate_date: 'desc' },
        take: CANDIDATE_LIMIT,
      });
      return pickBest(rows, sourceOrder);
    }

    async function searchHqBook(pairFrom: string, pairTo: string) {
      const rows = await prisma.sys_currency_exchange_rate_mst.findMany({
        where: {
          status: FX_RATE_STATUS.APPROVED,
          rec_status: 1,
          from_currency_code: pairFrom,
          to_currency_code: pairTo,
          rate_type_code: rateTypeCode,
          rate_date: { lte: new Date(requestedDate) },
          ...(input.source && { source_code: input.source }),
        },
        orderBy: { rate_date: 'desc' },
        take: CANDIDATE_LIMIT,
      });
      return pickBest(rows, sourceOrder);
    }

    const tryBook = async (book: FxRateSourceBook) => {
      const search = book === FX_RATE_SOURCE_BOOK.TENANT ? searchTenantBook : searchHqBook;
      const direct = await search(from, to);
      if (direct) return { book, row: direct, resolution: FX_RESOLUTION.DIRECT as FxResolution };
      const inverse = await search(to, from);
      if (inverse) return { book, row: inverse, resolution: FX_RESOLUTION.INVERSE as FxResolution };
      return null;
    };

    const booksToTry: FxRateSourceBook[] =
      policy === FX_RESOLUTION_POLICY.TENANT_ONLY
        ? [FX_RATE_SOURCE_BOOK.TENANT]
        : policy === FX_RESOLUTION_POLICY.HQ_ONLY
          ? [FX_RATE_SOURCE_BOOK.HQ]
          : [FX_RATE_SOURCE_BOOK.TENANT, FX_RATE_SOURCE_BOOK.HQ];

    let found: { book: FxRateSourceBook; row: Candidate; resolution: FxResolution } | null = null;
    for (const book of booksToTry) {
      found = await tryBook(book);
      if (found) break;
    }

    if (!found) {
      throw new FxError(
        FX_ERROR.RATE_NOT_FOUND,
        `no approved ${rateTypeCode} rate for ${from}→${to} on or before ${requestedDate} (policy ${policy})`
      );
    }

    const { book, row, resolution } = found;
    const directScaled = parseRate(row.rate_value.toString());
    const rateScaled = resolution === FX_RESOLUTION.INVERSE ? invertRate(directScaled) : directScaled;
    const ageDays = daysBetween(row.rate_date, requestedDate);
    const maxAgeDays = rateType.max_age_days;

    return {
      resolution,
      book,
      rate: formatRate(rateScaled),
      rateScaled,
      rateId: row.id,
      rateDate: row.rate_date.toISOString().slice(0, 10),
      rateTypeCode,
      sourceCode: row.source_code,
      requestedDate,
      ageDays,
      maxAgeDays,
      stale: maxAgeDays !== null && ageDays > maxAgeDays,
    };
  });
}

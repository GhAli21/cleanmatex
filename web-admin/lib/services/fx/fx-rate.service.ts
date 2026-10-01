/**
 * Tenant exchange-rate book CRUD + lifecycle (`org_fx_rate_mst`, plan 01 §5).
 * Same lifecycle as the HQ book: DRAFT → APPROVED | REJECTED, APPROVED →
 * VOIDED. Approved rows are immutable — corrected by void + new draft.
 * Self-approval is allowed and audited (the actor/timestamp columns ARE the
 * audit trail; no "maker ≠ checker" rule in this codebase).
 *
 * Permission gating (`fx_rates:manage`, `fx_rates:approve`, …) is the
 * caller's responsibility, same convention as every other service here.
 *
 * C3 (rate-pair validity) is enforced by the DB trigger `fn_ofrm_pair_check`
 * (migration 0537) — this service does not duplicate that check; it only
 * translates the trigger's exception into a clean FxError.
 */

import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { formatRate, parseRate } from './fx-decimal';
import { FX_ERROR, FxError } from './fx-errors';
import { FX_RATE_ORIGIN, FX_RATE_STATUS, type FxRateStatus } from '@/lib/constants/currency-fx';

export interface FxRateRow {
  id: string;
  fromCurrencyCode: string;
  toCurrencyCode: string;
  rateTypeCode: string;
  sourceCode: string;
  originCode: string;
  providerCode: string | null;
  /** YYYY-MM-DD. */
  rateDate: string;
  /** Exact decimal string — never a JS float. */
  rate: string;
  status: FxRateStatus;
  sourceReference: string | null;
  importBatchId: string | null;
  hqRateId: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  selfApproved: boolean;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectionReason: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  createdAt: string;
  createdBy: string | null;
}

export interface CreateRateInput {
  fromCurrencyCode: string;
  toCurrencyCode: string;
  rateTypeCode: string;
  sourceCode: string;
  originCode?: string;
  providerCode?: string | null;
  /** YYYY-MM-DD. */
  rateDate: string;
  /** Exact decimal string — never a JS float. */
  rate: string;
  sourceReference?: string | null;
  notes?: string | null;
  importBatchId?: string | null;
  hqRateId?: string | null;
  /** DRAFT by default; true self-approves in the same call (P5). */
  approveNow?: boolean;
}

export interface UpdateRateInput {
  rateTypeCode?: string;
  sourceCode?: string;
  rateDate?: string;
  rate?: string;
  sourceReference?: string | null;
  notes?: string | null;
}

export interface RateListFilters {
  fromCurrency?: string;
  toCurrency?: string;
  rateType?: string;
  source?: string;
  status?: FxRateStatus;
  page?: number;
  pageSize?: number;
}

type RateRowDb = Prisma.org_fx_rate_mstGetPayload<Record<string, never>>;

function toRateRow(row: RateRowDb): FxRateRow {
  return {
    id: row.id,
    fromCurrencyCode: row.from_currency_code,
    toCurrencyCode: row.to_currency_code,
    rateTypeCode: row.rate_type_code,
    sourceCode: row.source_code,
    originCode: row.origin_code,
    providerCode: row.provider_code,
    rateDate: row.rate_date.toISOString().slice(0, 10),
    rate: formatRate(parseRate(row.rate_value.toString())),
    status: row.status as FxRateStatus,
    sourceReference: row.source_reference,
    importBatchId: row.import_batch_id,
    hqRateId: row.hq_rate_id,
    approvedAt: row.approved_at ? row.approved_at.toISOString() : null,
    approvedBy: row.approved_by,
    selfApproved: !!row.approved_by && row.approved_by === row.created_by,
    rejectedAt: row.rejected_at ? row.rejected_at.toISOString() : null,
    rejectedBy: row.rejected_by,
    rejectionReason: row.rejection_reason,
    voidedAt: row.voided_at ? row.voided_at.toISOString() : null,
    voidedBy: row.voided_by,
    voidReason: row.void_reason,
    createdAt: row.created_at.toISOString(),
    createdBy: row.created_by,
  };
}

/**
 * Translate a known Postgres failure (unique violation, the C3 trigger, a
 * bad FK) into a clean FxError; rethrow anything else unchanged.
 */
function rewrapDbError(error: unknown, context: string): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new FxError(FX_ERROR.RATE_DUPLICATE, `${context}: a draft or approved rate already exists for this pair/date/type/source`);
    }
    if (error.code === 'P2003') {
      throw new FxError(FX_ERROR.LOOKUP_INVALID, `${context}: ${error.message}`);
    }
  }
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes('FX_RATE_PAIR_INVALID')) {
    throw new FxError(FX_ERROR.RATE_PAIR_INVALID, `${context}: ${message}`);
  }
  throw error;
}

function requireReason(reason: string | undefined): string {
  const trimmed = reason?.trim();
  if (!trimmed) {
    throw new FxError(FX_ERROR.REASON_REQUIRED, 'a reason is required');
  }
  return trimmed;
}

/** Normalize a user-typed rate to its exact canonical decimal string; throws RATE_NON_POSITIVE on bad input. */
function normalizeRate(rate: string): string {
  try {
    return formatRate(parseRate(rate));
  } catch (e) {
    throw new FxError(FX_ERROR.RATE_NON_POSITIVE, e instanceof Error ? e.message : String(e));
  }
}

export async function listRates(
  tenantId: string,
  filters: RateListFilters = {}
): Promise<{ rows: FxRateRow[]; total: number }> {
  const page = filters.page ?? 0;
  const pageSize = filters.pageSize ?? 50;

  return withTenantContext(tenantId, async (tenant) => {
    const where: Prisma.org_fx_rate_mstWhereInput = {
      tenant_org_id: tenant,
      rec_status: 1,
      ...(filters.fromCurrency && { from_currency_code: filters.fromCurrency }),
      ...(filters.toCurrency && { to_currency_code: filters.toCurrency }),
      ...(filters.rateType && { rate_type_code: filters.rateType }),
      ...(filters.source && { source_code: filters.source }),
      ...(filters.status && { status: filters.status }),
    };
    const [rows, total] = await Promise.all([
      prisma.org_fx_rate_mst.findMany({
        where,
        orderBy: [{ rate_date: 'desc' }, { created_at: 'desc' }],
        skip: page * pageSize,
        take: pageSize,
      }),
      prisma.org_fx_rate_mst.count({ where }),
    ]);
    return { rows: rows.map(toRateRow), total };
  });
}

export async function findRate(tenantId: string, id: string): Promise<FxRateRow> {
  return withTenantContext(tenantId, async (tenant) => {
    const row = await prisma.org_fx_rate_mst.findFirst({ where: { id, tenant_org_id: tenant, rec_status: 1 } });
    if (!row) throw new FxError(FX_ERROR.RATE_NOT_FOUND, `tenant ${tenant} rate ${id}`);
    return toRateRow(row);
  });
}

export async function createRate(tenantId: string, input: CreateRateInput, actorId: string | undefined): Promise<FxRateRow> {
  if (input.fromCurrencyCode === input.toCurrencyCode) {
    throw new FxError(FX_ERROR.SAME_CURRENCY_PAIR, 'from and to currency must differ');
  }
  const rate = normalizeRate(input.rate);
  const now = new Date();

  return withTenantContext(tenantId, async (tenant) => {
    try {
      const row = await prisma.org_fx_rate_mst.create({
        data: {
          tenant_org_id: tenant,
          from_currency_code: input.fromCurrencyCode,
          to_currency_code: input.toCurrencyCode,
          rate_type_code: input.rateTypeCode,
          source_code: input.sourceCode,
          origin_code: input.originCode ?? FX_RATE_ORIGIN.MANUAL,
          provider_code: input.providerCode ?? null,
          rate_date: new Date(input.rateDate),
          rate_value: new Prisma.Decimal(rate),
          source_reference: input.sourceReference ?? null,
          import_batch_id: input.importBatchId ?? null,
          hq_rate_id: input.hqRateId ?? null,
          rec_notes: input.notes ?? null,
          status: input.approveNow ? FX_RATE_STATUS.APPROVED : FX_RATE_STATUS.DRAFT,
          approved_at: input.approveNow ? now : null,
          approved_by: input.approveNow ? (actorId ?? null) : null,
          created_by: actorId ?? null,
        } as Prisma.org_fx_rate_mstUncheckedCreateInput,
      });
      return toRateRow(row);
    } catch (error) {
      rewrapDbError(error, `create rate tenant ${tenant}`);
    }
  });
}

export async function updateRate(tenantId: string, id: string, input: UpdateRateInput, actorId: string | undefined): Promise<FxRateRow> {
  return withTenantContext(tenantId, async (tenant) => {
    const existing = await prisma.org_fx_rate_mst.findFirst({ where: { id, tenant_org_id: tenant, rec_status: 1 } });
    if (!existing) throw new FxError(FX_ERROR.RATE_NOT_FOUND, `tenant ${tenant} rate ${id}`);
    if (existing.status !== FX_RATE_STATUS.DRAFT) {
      throw new FxError(FX_ERROR.RATE_NOT_EDITABLE, `rate ${id} is ${existing.status}; void it and enter a new one`);
    }

    const data: Prisma.org_fx_rate_mstUncheckedUpdateInput = {
      updated_at: new Date(),
      updated_by: actorId ?? null,
    };
    if (input.rateTypeCode !== undefined) data.rate_type_code = input.rateTypeCode;
    if (input.sourceCode !== undefined) data.source_code = input.sourceCode;
    if (input.rateDate !== undefined) data.rate_date = new Date(input.rateDate);
    if (input.rate !== undefined) data.rate_value = new Prisma.Decimal(normalizeRate(input.rate));
    if (input.sourceReference !== undefined) data.source_reference = input.sourceReference;
    if (input.notes !== undefined) data.rec_notes = input.notes;

    try {
      const row = await prisma.org_fx_rate_mst.update({ where: { id, tenant_org_id: tenant }, data });
      return toRateRow(row);
    } catch (error) {
      rewrapDbError(error, `update rate ${id}`);
    }
  });
}

async function transition(
  tenantId: string,
  id: string,
  expected: FxRateStatus,
  patch: Prisma.org_fx_rate_mstUncheckedUpdateInput,
  verb: string
): Promise<RateRowDb> {
  return withTenantContext(tenantId, async (tenant) => {
    const existing = await prisma.org_fx_rate_mst.findFirst({ where: { id, tenant_org_id: tenant, rec_status: 1 } });
    if (!existing) throw new FxError(FX_ERROR.RATE_NOT_FOUND, `tenant ${tenant} rate ${id}`);
    if (existing.status !== expected) {
      throw new FxError(FX_ERROR.RATE_INVALID_TRANSITION, `cannot ${verb} rate ${id} while it is ${existing.status}`);
    }
    const updated = await prisma.org_fx_rate_mst.updateMany({
      where: { id, tenant_org_id: tenant, status: expected },
      data: { ...patch, updated_at: new Date() },
    });
    if (updated.count === 0) {
      // Another actor changed the status between the read and the write.
      throw new FxError(FX_ERROR.RATE_INVALID_TRANSITION, `rate ${id} changed status concurrently; reload and try again`);
    }
    const row = await prisma.org_fx_rate_mst.findFirstOrThrow({ where: { id, tenant_org_id: tenant } });
    return row;
  });
}

/** P5: self-approval allowed (approvedBy may equal createdBy); audited via the actor/timestamp columns. */
export async function approveRate(tenantId: string, id: string, actorId: string | undefined): Promise<FxRateRow> {
  const row = await transition(tenantId, id, FX_RATE_STATUS.DRAFT, {
    status: FX_RATE_STATUS.APPROVED,
    approved_at: new Date(),
    approved_by: actorId ?? null,
  }, 'approve');
  return toRateRow(row);
}

export async function rejectRate(tenantId: string, id: string, reason: string, actorId: string | undefined): Promise<FxRateRow> {
  const trimmed = requireReason(reason);
  const row = await transition(tenantId, id, FX_RATE_STATUS.DRAFT, {
    status: FX_RATE_STATUS.REJECTED,
    rejected_at: new Date(),
    rejected_by: actorId ?? null,
    rejection_reason: trimmed,
  }, 'reject');
  return toRateRow(row);
}

/** Correct an approved rate by voiding it; the caller then enters a new draft (P6). */
export async function voidRate(tenantId: string, id: string, reason: string, actorId: string | undefined): Promise<FxRateRow> {
  const trimmed = requireReason(reason);
  const row = await transition(tenantId, id, FX_RATE_STATUS.APPROVED, {
    status: FX_RATE_STATUS.VOIDED,
    voided_at: new Date(),
    voided_by: actorId ?? null,
    void_reason: trimmed,
  }, 'void');
  return toRateRow(row);
}

/** Soft-delete a draft (rec_status = 0). Approved rates are voided, never deleted. */
export async function deleteRate(tenantId: string, id: string, actorId: string | undefined): Promise<void> {
  await withTenantContext(tenantId, async (tenant) => {
    const existing = await prisma.org_fx_rate_mst.findFirst({ where: { id, tenant_org_id: tenant, rec_status: 1 } });
    if (!existing) throw new FxError(FX_ERROR.RATE_NOT_FOUND, `tenant ${tenant} rate ${id}`);
    if (existing.status !== FX_RATE_STATUS.DRAFT) {
      throw new FxError(FX_ERROR.RATE_NOT_EDITABLE, `only draft rates can be deleted (this rate is ${existing.status}); void it instead`);
    }
    await prisma.org_fx_rate_mst.update({
      where: { id, tenant_org_id: tenant },
      data: { rec_status: 0, updated_at: new Date(), updated_by: actorId ?? null },
    });
  });
}

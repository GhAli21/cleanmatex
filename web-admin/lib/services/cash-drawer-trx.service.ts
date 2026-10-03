import 'server-only';

import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { lockDrawersTx, allocateLedgerSeqTx } from '@/lib/services/cash-drawer-ledger/cash-drawer-lock';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';
import { emitEventTx } from '@/lib/services/outbox.service';
import { OUTBOX_EVENT_TYPES } from '@/lib/constants/order-financial';
import {
  CASH_DRAWER_TRX_TYPES,
  CASH_LEDGER_ERRORS,
  CASH_TRANSIT_TRX_TYPES,
  type CashDrawerTrxType,
} from '@/lib/constants/cash-drawer';

/**
 * Custody (operational) drawer transactions — CLF, ADR-057, plan §4B.4
 * CLF-4-2. A custody transaction moves cash the business already owns
 * between drawers; it never creates or destroys cash (only finance vouchers
 * do, via the ledger gate), so every posting here nets to zero per currency
 * — enforced both here (clean error codes before the write) and by the DB's
 * own deferred balance trigger (`trg_ocdt_balanced`, defense in depth).
 */

export interface DrawerTrxLineInput {
  drawerId: string;
  direction: 'IN' | 'OUT';
  amount: number | string | Decimal;
  currencyCode: string;
  /** Session open on that drawer at posting time, if any — informational only. */
  cashDrawerSessionId?: string | null;
}

export interface PostDrawerTrxInput {
  trxTypeCode: CashDrawerTrxType;
  branchId: string;
  lines: DrawerTrxLineInput[];
  reasonCode?: string;
  notes?: string;
  /** The session whose close produced this transaction (CLOSE_DISPOSITION only). */
  sourceSessionId?: string;
  approvedBy?: string;
  idempotencyKey?: string;
}

export interface PostDrawerTrxResult {
  trxId: string;
  trxNo: string;
}

interface DrawerForValidation {
  id: string;
  branch_id: string;
  drawer_type: string;
  currency_code: string;
  is_active: boolean;
}

/**
 * Validates and posts one custody transaction with its lines, inside an
 * already-open transaction. Locks every distinct drawer referenced (sorted —
 * deadlock-free, the same order the ledger gate and session service use).
 * @param tx open Prisma transaction
 * @param ctx tenant and acting user
 * @param input the transaction and its ≥2 lines on ≥2 distinct drawers
 * @throws CashDrawerLedgerError on any structural refusal (unbalanced, same
 *         drawer both sides, cross-branch, currency mismatch, type not
 *         allowed for the drawer's side, inactive drawer)
 */
export async function postDrawerTrxTx(
  tx: Prisma.TransactionClient,
  ctx: { tenantOrgId: string; userId: string },
  input: PostDrawerTrxInput,
): Promise<PostDrawerTrxResult> {
  if (input.idempotencyKey) {
    const existing = await tx.org_cash_drawer_trx_mst.findFirst({
      where: { tenant_org_id: ctx.tenantOrgId, idempotency_key: input.idempotencyKey },
      select: { id: true, trx_no: true },
    });
    if (existing) {
      return { trxId: existing.id, trxNo: existing.trx_no };
    }
  }

  if (input.lines.length < 2) {
    throw new CashDrawerLedgerError(
      CASH_LEDGER_ERRORS.CASH_TRX_UNBALANCED,
      'postDrawerTrxTx: a transaction needs at least 2 lines',
    );
  }
  const distinctDrawerIds = [...new Set(input.lines.map((l) => l.drawerId))];
  if (distinctDrawerIds.length < 2) {
    throw new CashDrawerLedgerError(
      CASH_LEDGER_ERRORS.CASH_TRX_SAME_DRAWER,
      'postDrawerTrxTx: a transaction needs at least 2 distinct drawers',
    );
  }

  const type = await tx.sys_cash_drawer_trx_type_cd.findUnique({
    where: { code: input.trxTypeCode },
    select: { allowed_src_types: true, allowed_dest_types: true, requires_notes: true },
  });
  if (!type) {
    throw new Error(`postDrawerTrxTx: unknown trx type ${input.trxTypeCode}`);
  }
  if (type.requires_notes && !input.notes?.trim()) {
    throw new CashDrawerLedgerError(
      CASH_LEDGER_ERRORS.CASH_DISPOSITION_NOTES_REQUIRED,
      `postDrawerTrxTx: trx type ${input.trxTypeCode} requires notes`,
    );
  }

  const locked = await lockDrawersTx(tx, ctx.tenantOrgId, distinctDrawerIds);
  const byId = new Map<string, DrawerForValidation>(locked.map((d) => [d.id, d]));
  if (byId.size !== distinctDrawerIds.length) {
    throw new CashDrawerLedgerError(
      CASH_LEDGER_ERRORS.CASH_DRAWER_INACTIVE,
      'postDrawerTrxTx: one or more drawers not found for this tenant',
    );
  }

  const branchIds = new Set([...byId.values()].map((d) => d.branch_id));
  if (branchIds.size > 1 || !branchIds.has(input.branchId)) {
    throw new CashDrawerLedgerError(
      CASH_LEDGER_ERRORS.CASH_TRX_CROSS_BRANCH,
      'postDrawerTrxTx: all drawers must be in the transaction\'s branch',
    );
  }

  const netByCurrency = new Map<string, Decimal>();
  for (const line of input.lines) {
    const drawer = byId.get(line.drawerId);
    if (!drawer) {
      throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DRAWER_INACTIVE, `postDrawerTrxTx: drawer ${line.drawerId} not locked`);
    }
    if (!drawer.is_active) {
      throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DRAWER_INACTIVE, `postDrawerTrxTx: drawer ${line.drawerId} is inactive`);
    }
    if (line.currencyCode !== drawer.currency_code) {
      throw new CashDrawerLedgerError(
        CASH_LEDGER_ERRORS.CASH_CURRENCY_MISMATCH,
        `postDrawerTrxTx: line currency ${line.currencyCode} does not match drawer ${line.drawerId}'s ${drawer.currency_code}`,
      );
    }
    const allowedTypes = line.direction === 'OUT' ? type.allowed_src_types : type.allowed_dest_types;
    if (allowedTypes.length > 0 && !allowedTypes.includes(drawer.drawer_type)) {
      throw new CashDrawerLedgerError(
        CASH_LEDGER_ERRORS.CASH_DRAWER_TYPE_NOT_ALLOWED,
        `postDrawerTrxTx: drawer type ${drawer.drawer_type} cannot be the ${line.direction === 'OUT' ? 'source' : 'destination'} of ${input.trxTypeCode}`,
      );
    }
    const amount = new Decimal(line.amount.toString());
    if (!amount.greaterThan(0)) {
      throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DISPOSITION_AMOUNT_INVALID, 'postDrawerTrxTx: line amount must be > 0');
    }
    const signed = line.direction === 'IN' ? amount : amount.negated();
    netByCurrency.set(line.currencyCode, (netByCurrency.get(line.currencyCode) ?? new Decimal(0)).plus(signed));
  }
  for (const [currencyCode, net] of netByCurrency) {
    if (!net.equals(0)) {
      throw new CashDrawerLedgerError(
        CASH_LEDGER_ERRORS.CASH_TRX_UNBALANCED,
        `postDrawerTrxTx: ${currencyCode} does not net to zero (${net.toString()})`,
      );
    }
  }

  const [{ trx_no: trxNo }] = await tx.$queryRaw<{ trx_no: string }[]>(
    Prisma.sql`SELECT generate_cash_drawer_trx_no(${ctx.tenantOrgId}::uuid) AS trx_no`,
  );

  const header = await tx.org_cash_drawer_trx_mst.create({
    data: {
      tenant_org_id: ctx.tenantOrgId,
      branch_id: input.branchId,
      trx_no: trxNo,
      trx_type_code: input.trxTypeCode,
      source_session_id: input.sourceSessionId ?? null,
      reason_code: input.reasonCode ?? null,
      notes: input.notes ?? null,
      performed_by: ctx.userId,
      approved_by: input.approvedBy ?? null,
      idempotency_key: input.idempotencyKey ?? null,
      created_by: ctx.userId,
    },
    select: { id: true },
  });

  // Allocate each drawer's sequence once per line it appears on, in line order.
  const linesByDrawer = new Map<string, DrawerTrxLineInput[]>();
  for (const line of input.lines) {
    linesByDrawer.set(line.drawerId, [...(linesByDrawer.get(line.drawerId) ?? []), line]);
  }
  const seqByLineIndex = new Map<number, bigint>();
  for (const drawerId of [...linesByDrawer.keys()].sort()) {
    const group = linesByDrawer.get(drawerId) as DrawerTrxLineInput[];
    const first = await allocateLedgerSeqTx(tx, ctx.tenantOrgId, drawerId, group.length);
    group.forEach((line, i) => {
      const idx = input.lines.indexOf(line);
      seqByLineIndex.set(idx, first + BigInt(i));
    });
  }

  await tx.org_cash_drawer_trx_dtl.createMany({
    data: input.lines.map((line, i) => ({
      tenant_org_id: ctx.tenantOrgId,
      trx_id: header.id,
      line_no: i + 1,
      cash_drawer_id: line.drawerId,
      cash_drawer_session_id: line.cashDrawerSessionId ?? null,
      ledger_seq: seqByLineIndex.get(i) as bigint,
      direction: line.direction,
      amount: new Decimal(line.amount.toString()),
      currency_code: line.currencyCode,
      created_by: ctx.userId,
    })),
  });

  await emitEventTx(tx, ctx.tenantOrgId, OUTBOX_EVENT_TYPES.CASH_DRAWER_TRX_POSTED, 'cash_drawer_trx', header.id, {
    trx_id: header.id,
    trx_no: trxNo,
    trx_type_code: input.trxTypeCode,
    drawer_ids: distinctDrawerIds,
  });

  return { trxId: header.id, trxNo };
}

/**
 * Reverses a custody transaction — a new REVERSAL header whose lines mirror
 * the original with direction swapped, stamped at new ledger sequences taken
 * NOW (P3: a reversal lands in the window current at reversal time, never
 * retroactively). The DB's `uq_ocdt_reversed_once` index backstops the
 * single-reversal rule this function also checks up front.
 * @param tx open Prisma transaction
 * @param ctx tenant and acting user
 * @param trxId the transaction to reverse
 * @param reasonCode mandatory reason
 */
export async function reverseDrawerTrxTx(
  tx: Prisma.TransactionClient,
  ctx: { tenantOrgId: string; userId: string },
  trxId: string,
  reasonCode: string,
): Promise<PostDrawerTrxResult> {
  if (!reasonCode?.trim()) {
    throw new Error('reverseDrawerTrxTx: reason is required');
  }

  const original = await tx.org_cash_drawer_trx_mst.findFirst({
    where: { id: trxId, tenant_org_id: ctx.tenantOrgId },
    select: { id: true, branch_id: true, trx_type_code: true, reverses_trx_id: true },
  });
  if (!original) {
    throw new Error(`reverseDrawerTrxTx: transaction ${trxId} not found`);
  }
  if (original.trx_type_code === CASH_DRAWER_TRX_TYPES.REVERSAL) {
    throw new Error('reverseDrawerTrxTx: cannot reverse a reversal');
  }
  if ((CASH_TRANSIT_TRX_TYPES as readonly string[]).includes(original.trx_type_code)) {
    // An in-transit leg is undone by cancelling the transfer; a reversal would leave the transfer record contradicting the ledger.
    throw new CashDrawerLedgerError(
      CASH_LEDGER_ERRORS.CASH_TRANSIT_USE_CANCEL,
      'reverseDrawerTrxTx: an in-transit leg cannot be reversed — cancel the transfer instead',
    );
  }
  const alreadyReversed = await tx.org_cash_drawer_trx_mst.findFirst({
    where: { tenant_org_id: ctx.tenantOrgId, reverses_trx_id: trxId },
    select: { id: true },
  });
  if (alreadyReversed) {
    throw new Error(`reverseDrawerTrxTx: transaction ${trxId} was already reversed`);
  }

  const originalLines = await tx.org_cash_drawer_trx_dtl.findMany({
    where: { trx_id: trxId, tenant_org_id: ctx.tenantOrgId },
    orderBy: { line_no: 'asc' },
    select: { cash_drawer_id: true, cash_drawer_session_id: true, direction: true, amount: true, currency_code: true },
  });

  const distinctDrawerIds = [...new Set(originalLines.map((l) => l.cash_drawer_id))];
  const locked = await lockDrawersTx(tx, ctx.tenantOrgId, distinctDrawerIds);
  const activeById = new Map(locked.map((d) => [d.id, d]));

  const [{ trx_no: trxNo }] = await tx.$queryRaw<{ trx_no: string }[]>(
    Prisma.sql`SELECT generate_cash_drawer_trx_no(${ctx.tenantOrgId}::uuid) AS trx_no`,
  );

  const header = await tx.org_cash_drawer_trx_mst.create({
    data: {
      tenant_org_id: ctx.tenantOrgId,
      branch_id: original.branch_id,
      trx_no: trxNo,
      trx_type_code: CASH_DRAWER_TRX_TYPES.REVERSAL,
      reverses_trx_id: original.id,
      reason_code: reasonCode,
      performed_by: ctx.userId,
      created_by: ctx.userId,
    },
    select: { id: true },
  });

  const linesByDrawer = new Map<string, typeof originalLines>();
  for (const line of originalLines) {
    linesByDrawer.set(line.cash_drawer_id, [...(linesByDrawer.get(line.cash_drawer_id) ?? []), line]);
  }
  const seqByIndex = new Map<number, bigint>();
  for (const drawerId of [...linesByDrawer.keys()].sort()) {
    if (!activeById.has(drawerId)) {
      throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DRAWER_INACTIVE, `reverseDrawerTrxTx: drawer ${drawerId} not found`);
    }
    const group = linesByDrawer.get(drawerId) as typeof originalLines;
    const first = await allocateLedgerSeqTx(tx, ctx.tenantOrgId, drawerId, group.length);
    group.forEach((line, i) => {
      const idx = originalLines.indexOf(line);
      seqByIndex.set(idx, first + BigInt(i));
    });
  }

  await tx.org_cash_drawer_trx_dtl.createMany({
    data: originalLines.map((line, i) => ({
      tenant_org_id: ctx.tenantOrgId,
      trx_id: header.id,
      line_no: i + 1,
      cash_drawer_id: line.cash_drawer_id,
      cash_drawer_session_id: line.cash_drawer_session_id,
      ledger_seq: seqByIndex.get(i) as bigint,
      direction: line.direction === 'IN' ? 'OUT' : 'IN',
      amount: line.amount,
      currency_code: line.currency_code,
      created_by: ctx.userId,
    })),
  });

  await emitEventTx(tx, ctx.tenantOrgId, OUTBOX_EVENT_TYPES.CASH_DRAWER_TRX_POSTED, 'cash_drawer_trx', header.id, {
    trx_id: header.id,
    trx_no: trxNo,
    trx_type_code: CASH_DRAWER_TRX_TYPES.REVERSAL,
    reverses_trx_id: original.id,
  });

  return { trxId: header.id, trxNo };
}

// -----------------------------------------------------------------------------
// Public (non-Tx) entry points
// -----------------------------------------------------------------------------

export async function postDrawerTrx(
  tenantOrgId: string,
  userId: string,
  input: PostDrawerTrxInput,
): Promise<PostDrawerTrxResult> {
  return withTenantContext(tenantOrgId, () => prisma.$transaction((tx) => postDrawerTrxTx(tx, { tenantOrgId, userId }, input)));
}

export async function reverseDrawerTrx(
  tenantOrgId: string,
  userId: string,
  trxId: string,
  reasonCode: string,
): Promise<PostDrawerTrxResult> {
  return withTenantContext(tenantOrgId, () => prisma.$transaction((tx) => reverseDrawerTrxTx(tx, { tenantOrgId, userId }, trxId, reasonCode)));
}

// -----------------------------------------------------------------------------
// Reads
// -----------------------------------------------------------------------------

export interface DrawerTrxListFilter {
  drawerId?: string;
  trxTypeCode?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  pageSize: number;
}

export interface DrawerTrxRow {
  trxId: string;
  trxNo: string;
  trxTypeCode: string;
  branchId: string;
  reasonCode: string | null;
  notes: string | null;
  performedBy: string;
  approvedBy: string | null;
  reversesTrxId: string | null;
  occurredAt: Date;
  lines: Array<{ drawerId: string; direction: string; amount: string; currencyCode: string }>;
}

export interface DrawerTrxPage {
  rows: DrawerTrxRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * Paginated, filterable custody-transaction history (CLF-8-7 Transactions
 * tab). Filters by a single drawer (either side of the transaction), type,
 * and an occurred-date range. The header/line tables carry no Prisma
 * `@relation` (M3's minimal-footprint convention), so a drawer filter and the
 * line fan-out are each a separate query joined in application code.
 * @param tenantOrgId tenant scope
 * @param filter see {@link DrawerTrxListFilter}
 */
export async function listDrawerTrx(
  tenantOrgId: string,
  filter: DrawerTrxListFilter,
  /** B3: the actor's permitted branches; undefined = all branches, empty = nothing. */
  branchIds?: readonly string[],
): Promise<DrawerTrxPage> {
  return withTenantContext(tenantOrgId, async () => {
    let trxIdsForDrawer: string[] | undefined;
    if (filter.drawerId) {
      const dtlRows = await prisma.org_cash_drawer_trx_dtl.findMany({
        where: { tenant_org_id: tenantOrgId, cash_drawer_id: filter.drawerId },
        select: { trx_id: true },
        distinct: ['trx_id'],
      });
      trxIdsForDrawer = dtlRows.map((r) => r.trx_id);
      if (trxIdsForDrawer.length === 0) {
        return { rows: [], totalCount: 0, page: filter.page, pageSize: filter.pageSize };
      }
    }

    const where: Prisma.org_cash_drawer_trx_mstWhereInput = {
      tenant_org_id: tenantOrgId,
      ...(branchIds ? { branch_id: { in: [...branchIds] } } : {}),
      ...(filter.trxTypeCode ? { trx_type_code: filter.trxTypeCode } : {}),
      ...(filter.dateFrom || filter.dateTo
        ? { occurred_at: { ...(filter.dateFrom ? { gte: filter.dateFrom } : {}), ...(filter.dateTo ? { lte: filter.dateTo } : {}) } }
        : {}),
      ...(trxIdsForDrawer ? { id: { in: trxIdsForDrawer } } : {}),
    };

    const [headers, totalCount] = await Promise.all([
      prisma.org_cash_drawer_trx_mst.findMany({
        where,
        orderBy: { occurred_at: 'desc' },
        skip: Math.max(0, (filter.page - 1) * filter.pageSize),
        take: filter.pageSize,
        select: {
          id: true,
          trx_no: true,
          trx_type_code: true,
          branch_id: true,
          reason_code: true,
          notes: true,
          performed_by: true,
          approved_by: true,
          reverses_trx_id: true,
          occurred_at: true,
        },
      }),
      prisma.org_cash_drawer_trx_mst.count({ where }),
    ]);

    const headerIds = headers.map((h) => h.id);
    const lineRows = headerIds.length
      ? await prisma.org_cash_drawer_trx_dtl.findMany({
          where: { tenant_org_id: tenantOrgId, trx_id: { in: headerIds } },
          orderBy: { line_no: 'asc' },
          select: { trx_id: true, cash_drawer_id: true, direction: true, amount: true, currency_code: true },
        })
      : [];
    const linesByTrx = new Map<string, typeof lineRows>();
    for (const l of lineRows) {
      linesByTrx.set(l.trx_id, [...(linesByTrx.get(l.trx_id) ?? []), l]);
    }

    return {
      rows: headers.map((r) => ({
        trxId: r.id,
        trxNo: r.trx_no,
        trxTypeCode: r.trx_type_code,
        branchId: r.branch_id,
        reasonCode: r.reason_code,
        notes: r.notes,
        performedBy: r.performed_by,
        approvedBy: r.approved_by,
        reversesTrxId: r.reverses_trx_id,
        occurredAt: r.occurred_at,
        lines: (linesByTrx.get(r.id) ?? []).map((l) => ({
          drawerId: l.cash_drawer_id,
          direction: l.direction,
          amount: new Decimal(l.amount.toString()).toFixed(4),
          currencyCode: l.currency_code,
        })),
      })),
      totalCount,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  });
}

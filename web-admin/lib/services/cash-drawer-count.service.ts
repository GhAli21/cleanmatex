import 'server-only';

import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { lockDrawersTx } from '@/lib/services/cash-drawer-ledger/cash-drawer-lock';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';
import {
  computeOpeningExpectedTx,
  computeClosingExpectedTx,
  type OpeningBalanceForClosing,
} from '@/lib/services/cash-drawer-ledger/cash-drawer-balance.service';
import {
  CASH_DRAWER_COUNT_TYPES,
  CASH_DRAWER_SESSION_STATUSES,
  CASH_LEDGER_ERRORS,
  type CashDrawerCountType,
} from '@/lib/constants/cash-drawer';
import { CASH_CONTROL_COUNT_MODE, type CashControlCountMode } from '@/lib/constants/cash-control';

/**
 * Cash count recording (CLF, ADR-057, plan §4B.4 CLF-4-1).
 *
 * `recordCountTx` is the single writer of `org_cash_drawer_cnt_mst` /
 * `_denom_dtl`. It does not decide WHAT "expected" means for a given count
 * (that is the caller's job — `cash-drawer-session.service.ts` for
 * OPENING/CLOSING/RECOUNT via the balance service, or a standalone SPOT
 * entry point for a count-only drawer); it only records the physical count
 * against an expected figure the caller already resolved, snapshots the
 * drawer's current ledger sequence as the cut, and computes the counted
 * total server-side from denomination lines when the method requires them
 * — never trusting a client-supplied total that bypasses the per-coin math.
 */

export interface DenominationCountLine {
  denominationId: string;
  quantity: number;
}

export interface RecordCountInput {
  drawerId: string;
  branchId: string;
  /** Null for a count-only drawer (SAFE/PENDING_DEPOSIT/DRIVER_BAG) with no open session. */
  cashDrawerSessionId: string | null;
  countType: CashDrawerCountType;
  currencyCode: string;
  /** System-computed expected cash at this cut — resolved by the caller via the balance service. */
  expectedAmount: Decimal;
  /** TOTAL_ONLY: use `totalAmount`. OPTIONAL_DENOMINATION/DENOMINATION with denominations given: use the per-coin breakdown. */
  countMode: CashControlCountMode;
  totalAmount?: number | string | Decimal;
  denominations?: DenominationCountLine[];
  /** RECOUNT only: the CLOSING (or prior RECOUNT) count this one supersedes. */
  supersedesCountId?: string;
  notes?: string;
}

export interface RecordCountResult {
  countId: string;
  countMethod: 'TOTAL_ONLY' | 'DENOMINATION';
  countedAmount: Decimal;
  varianceAmount: Decimal;
  ledgerSeq: bigint;
}

function resolveCountMethod(input: RecordCountInput): 'TOTAL_ONLY' | 'DENOMINATION' {
  if (input.countMode === CASH_CONTROL_COUNT_MODE.DENOMINATION) return 'DENOMINATION';
  if (input.countMode === CASH_CONTROL_COUNT_MODE.TOTAL_ONLY) return 'TOTAL_ONLY';
  // OPTIONAL_DENOMINATION: the UI offers a breakdown but doesn't force it —
  // the actual method taken is whichever the caller actually supplied.
  return input.denominations && input.denominations.length > 0 ? 'DENOMINATION' : 'TOTAL_ONLY';
}

/**
 * Records one physical cash count. Locks the drawer (reentrant-safe if the
 * caller already holds the lock in the same transaction) to snapshot the
 * exact ledger sequence this count was taken against.
 * @param tx open Prisma transaction
 * @param ctx tenant and acting user
 * @param input count payload — see {@link RecordCountInput}
 * @throws CashDrawerLedgerError (`CASH_COUNT_TOTAL_MISMATCH`) when a client-supplied `totalAmount` disagrees with the computed denomination sum
 * @throws Error on malformed input (empty denomination list for a DENOMINATION count, unknown denomination id, mixed currency)
 */
export async function recordCountTx(
  tx: Prisma.TransactionClient,
  ctx: { tenantOrgId: string; userId: string },
  input: RecordCountInput,
): Promise<RecordCountResult> {
  const [locked] = await lockDrawersTx(tx, ctx.tenantOrgId, [input.drawerId]);
  if (!locked) {
    throw new CashDrawerLedgerError(
      CASH_LEDGER_ERRORS.CASH_DRAWER_INACTIVE,
      `recordCountTx: drawer ${input.drawerId} not found for tenant ${ctx.tenantOrgId}`,
    );
  }
  const ledgerSeq = locked.ledger_seq;

  const method = resolveCountMethod(input);
  let countedAmount: Decimal;

  if (method === 'DENOMINATION') {
    if (!input.denominations || input.denominations.length === 0) {
      throw new Error('recordCountTx: DENOMINATION count requires at least one denomination line');
    }
    const denomIds = [...new Set(input.denominations.map((d) => d.denominationId))];
    const denomRows = await tx.sys_currency_denominations_cd.findMany({
      where: { id: { in: denomIds } },
      select: { id: true, currency_code: true, denomination_minor: true },
    });
    const byId = new Map(denomRows.map((d) => [d.id, d]));

    const currency = await tx.sys_currency_cd.findUnique({
      where: { code: input.currencyCode },
      select: { minor_unit: true },
    });
    const minorUnit = currency?.minor_unit ?? 2;
    const scale = new Decimal(10).pow(minorUnit);

    const lines: Array<{ denominationId: string; denomValueMinorSnap: number; quantity: number; lineAmount: Decimal }> = [];
    countedAmount = new Decimal(0);
    for (const d of input.denominations) {
      if (!Number.isInteger(d.quantity) || d.quantity < 0) {
        throw new Error(`recordCountTx: invalid quantity for denomination ${d.denominationId}`);
      }
      const denom = byId.get(d.denominationId);
      if (!denom) {
        throw new Error(`recordCountTx: denomination ${d.denominationId} not found`);
      }
      if (denom.currency_code !== input.currencyCode) {
        throw new Error(
          `recordCountTx: denomination ${d.denominationId} belongs to ${denom.currency_code}, not ${input.currencyCode}`,
        );
      }
      const lineAmount = new Decimal(denom.denomination_minor).times(d.quantity).dividedBy(scale);
      lines.push({ denominationId: d.denominationId, denomValueMinorSnap: denom.denomination_minor, quantity: d.quantity, lineAmount });
      countedAmount = countedAmount.plus(lineAmount);
    }

    // Defense in depth: if the caller also passed a client totalAmount, it
    // must agree with the server-computed sum — never silently prefer one.
    if (input.totalAmount != null) {
      const clientTotal = new Decimal(input.totalAmount.toString());
      if (!clientTotal.equals(countedAmount)) {
        throw new CashDrawerLedgerError(
          CASH_LEDGER_ERRORS.CASH_COUNT_TOTAL_MISMATCH,
          `recordCountTx: client total ${clientTotal.toString()} disagrees with the denomination sum ${countedAmount.toString()}`,
        );
      }
    }

    const count = await tx.org_cash_drawer_cnt_mst.create({
      data: {
        tenant_org_id: ctx.tenantOrgId,
        branch_id: input.branchId,
        cash_drawer_id: input.drawerId,
        cash_drawer_session_id: input.cashDrawerSessionId,
        count_type: input.countType,
        count_method: 'DENOMINATION',
        currency_code: input.currencyCode,
        ledger_seq: ledgerSeq,
        expected_amount: input.expectedAmount,
        counted_amount: countedAmount,
        variance_amount: countedAmount.minus(input.expectedAmount),
        supersedes_count_id: input.supersedesCountId ?? null,
        counted_by: ctx.userId,
        notes: input.notes ?? null,
        created_by: ctx.userId,
      },
      select: { id: true },
    });

    await tx.org_cash_drawer_cnt_denom_dtl.createMany({
      data: lines.map((l) => ({
        tenant_org_id: ctx.tenantOrgId,
        count_id: count.id,
        denomination_id: l.denominationId,
        denom_value_minor_snap: l.denomValueMinorSnap,
        quantity: l.quantity,
        line_amount: l.lineAmount,
        created_by: ctx.userId,
      })),
    });

    return {
      countId: count.id,
      countMethod: 'DENOMINATION',
      countedAmount,
      varianceAmount: countedAmount.minus(input.expectedAmount),
      ledgerSeq,
    };
  }

  // TOTAL_ONLY
  if (input.totalAmount == null) {
    throw new Error('recordCountTx: TOTAL_ONLY count requires totalAmount');
  }
  countedAmount = new Decimal(input.totalAmount.toString());
  if (countedAmount.isNegative()) {
    throw new Error('recordCountTx: counted amount must be >= 0');
  }

  const count = await tx.org_cash_drawer_cnt_mst.create({
    data: {
      tenant_org_id: ctx.tenantOrgId,
      branch_id: input.branchId,
      cash_drawer_id: input.drawerId,
      cash_drawer_session_id: input.cashDrawerSessionId,
      count_type: input.countType,
      count_method: 'TOTAL_ONLY',
      currency_code: input.currencyCode,
      ledger_seq: ledgerSeq,
      expected_amount: input.expectedAmount,
      counted_amount: countedAmount,
      variance_amount: countedAmount.minus(input.expectedAmount),
      supersedes_count_id: input.supersedesCountId ?? null,
      counted_by: ctx.userId,
      notes: input.notes ?? null,
      created_by: ctx.userId,
    },
    select: { id: true },
  });

  return {
    countId: count.id,
    countMethod: 'TOTAL_ONLY',
    countedAmount,
    varianceAmount: countedAmount.minus(input.expectedAmount),
    ledgerSeq,
  };
}

// -----------------------------------------------------------------------------
// Standalone entry point (SPOT / RECOUNT via the drawer's own counts endpoint)
// -----------------------------------------------------------------------------

export interface RecordSpotCountInput {
  drawerId: string;
  /** Present for a mid-shift SPOT check on an OPEN session; null for a count-only drawer (SAFE/PENDING_DEPOSIT/DRIVER_BAG). */
  cashDrawerSessionId?: string | null;
  countType: Extract<CashDrawerCountType, 'SPOT' | 'RECOUNT'>;
  currencyCode: string;
  countMode: CashControlCountMode;
  totalAmount?: number | string | Decimal;
  denominations?: DenominationCountLine[];
  /** RECOUNT only. */
  supersedesCountId?: string;
  notes?: string;
}

/**
 * Standalone count entry point (plan §4B.7 `POST /api/v1/cash-drawers/[drawerId]/counts`).
 * Unlike the session lifecycle (which already knows its cut and its opening
 * baseline), a standalone SPOT/RECOUNT has to resolve "what's expected right
 * now" itself before it can call {@link recordCountTx}:
 * - a session is open: the same window math the close count-step uses
 *   (`computeClosingExpectedTx`), cut at the drawer's *current* ledger
 *   sequence (not the session's close cut — the session hasn't started
 *   closing).
 * - no session (count-only drawer): the chain math `computeOpeningExpectedTx`
 *   already implements generalises cleanly to "what's expected as of now" by
 *   passing the drawer's current ledger sequence as the cut.
 * @param tenantOrgId tenant of the drawer
 * @param userId acting user
 * @param input count payload — see {@link RecordSpotCountInput}
 */
export async function recordSpotCount(
  tenantOrgId: string,
  userId: string,
  input: RecordSpotCountInput,
): Promise<RecordCountResult> {
  return withTenantContext(tenantOrgId, () =>
    prisma.$transaction(async (tx) => {
      const ctx = { tenantOrgId, userId };
      const [drawer] = await lockDrawersTx(tx, tenantOrgId, [input.drawerId]);
      if (!drawer) {
        throw new CashDrawerLedgerError(
          CASH_LEDGER_ERRORS.CASH_DRAWER_INACTIVE,
          `recordSpotCount: drawer ${input.drawerId} not found for tenant ${tenantOrgId}`,
        );
      }

      let expectedAmount: Decimal;

      if (input.cashDrawerSessionId) {
        const session = await tx.org_cash_drawer_sessions_mst.findFirst({
          where: { id: input.cashDrawerSessionId, tenant_org_id: tenantOrgId },
          select: { id: true, cash_drawer_id: true, open_ledger_seq: true, status: true },
        });
        if (!session || session.cash_drawer_id !== input.drawerId) {
          throw new CashDrawerLedgerError(
            CASH_LEDGER_ERRORS.DRAWER_SESSION_WRONG_DRAWER,
            `recordSpotCount: session ${input.cashDrawerSessionId} does not belong to drawer ${input.drawerId}`,
          );
        }
        if (session.status !== CASH_DRAWER_SESSION_STATUSES.OPEN) {
          throw new CashDrawerLedgerError(
            CASH_LEDGER_ERRORS.CASH_DRAWER_SESSION_NOT_OPEN,
            `recordSpotCount: session ${input.cashDrawerSessionId} is ${session.status}, not OPEN`,
          );
        }

        const openingRowsDb = await tx.org_cash_drawer_ses_bal_dtl.findMany({
          where: { tenant_org_id: tenantOrgId, cash_drawer_session_id: session.id },
          select: { currency_code: true, opening_expected: true, opening_counted: true },
        });
        const openingForClosing: OpeningBalanceForClosing[] = openingRowsDb.map((r) => ({
          currencyCode: r.currency_code,
          openingExpected: new Decimal(r.opening_expected.toString()),
          openingCounted: r.opening_counted ? new Decimal(r.opening_counted.toString()) : null,
        }));

        const rows = await computeClosingExpectedTx(
          tx,
          tenantOrgId,
          input.drawerId,
          openingForClosing,
          session.open_ledger_seq ?? BigInt(0),
          drawer.ledger_seq,
        );
        const row = rows.find((r) => r.currencyCode === input.currencyCode);
        if (!row) {
          throw new Error(`recordSpotCount: currency ${input.currencyCode} is not part of session ${session.id}`);
        }
        expectedAmount = row.closingExpected;
      } else {
        const rows = await computeOpeningExpectedTx(tx, tenantOrgId, input.drawerId, drawer.currency_code, drawer.ledger_seq);
        const row = rows.find((r) => r.currencyCode === input.currencyCode);
        if (!row) {
          throw new Error(`recordSpotCount: currency ${input.currencyCode} has no history on drawer ${input.drawerId}`);
        }
        expectedAmount = row.openingExpected;
      }

      return recordCountTx(tx, ctx, {
        drawerId: input.drawerId,
        branchId: drawer.branch_id,
        cashDrawerSessionId: input.cashDrawerSessionId ?? null,
        countType: input.countType,
        currencyCode: input.currencyCode,
        expectedAmount,
        countMode: input.countMode,
        totalAmount: input.totalAmount,
        denominations: input.denominations,
        supersedesCountId: input.supersedesCountId,
        notes: input.notes,
      });
    }),
  );
}

// -----------------------------------------------------------------------------
// Reads
// -----------------------------------------------------------------------------

export interface DrawerCountRow {
  countId: string;
  countType: string;
  countMethod: string;
  currencyCode: string;
  cashDrawerSessionId: string | null;
  expectedAmount: string;
  countedAmount: string;
  varianceAmount: string;
  supersedesCountId: string | null;
  countedBy: string;
  notes: string | null;
  createdAt: Date;
}

export interface DrawerCountPage {
  rows: DrawerCountRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * Paginated count history for one drawer, newest first (CLF-8-7 Counts tab).
 * @param tenantOrgId tenant of the drawer
 * @param drawerId drawer whose counts are read
 * @param page 1-based page number
 * @param pageSize rows per page
 */
export async function listDrawerCounts(
  tenantOrgId: string,
  drawerId: string,
  page: number,
  pageSize: number,
): Promise<DrawerCountPage> {
  return withTenantContext(tenantOrgId, async () => {
    const where = { tenant_org_id: tenantOrgId, cash_drawer_id: drawerId };
    const [rows, totalCount] = await Promise.all([
      prisma.org_cash_drawer_cnt_mst.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: Math.max(0, (page - 1) * pageSize),
        take: pageSize,
        select: {
          id: true,
          count_type: true,
          count_method: true,
          currency_code: true,
          cash_drawer_session_id: true,
          expected_amount: true,
          counted_amount: true,
          variance_amount: true,
          supersedes_count_id: true,
          counted_by: true,
          notes: true,
          created_at: true,
        },
      }),
      prisma.org_cash_drawer_cnt_mst.count({ where }),
    ]);

    return {
      rows: rows.map((r) => ({
        countId: r.id,
        countType: r.count_type,
        countMethod: r.count_method,
        currencyCode: r.currency_code,
        cashDrawerSessionId: r.cash_drawer_session_id,
        expectedAmount: new Decimal(r.expected_amount.toString()).toFixed(4),
        countedAmount: new Decimal(r.counted_amount.toString()).toFixed(4),
        varianceAmount: new Decimal(r.variance_amount.toString()).toFixed(4),
        supersedesCountId: r.supersedes_count_id,
        countedBy: r.counted_by,
        notes: r.notes,
        createdAt: r.created_at,
      })),
      totalCount,
      page,
      pageSize,
    };
  });
}

/** Re-exported for callers that only need the type, not the recording logic. */
export { CASH_DRAWER_COUNT_TYPES };

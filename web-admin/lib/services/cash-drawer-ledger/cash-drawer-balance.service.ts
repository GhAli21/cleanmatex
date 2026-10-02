import 'server-only';

import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { sumLedgerWindow, netOfWindow, type LedgerWindowTotals } from './cash-drawer-ledger.repository';
import { CASH_DRAWER_SESSION_STATUSES, CASH_DISPOSITION_MOVE_MODES } from '@/lib/constants/cash-drawer';

/**
 * Public balance computations over the drawer ledger (CLF, ADR-057, §4B.4).
 * Every "what's the money" question in the app goes through here — it is the
 * only place that knows how to chain a new session's opening off the
 * previous one's disposition, and how to turn a window of ledger entries
 * into a closing-expected figure. Internally built on
 * `cash-drawer-ledger.repository.ts` (the one SQL definition of a ledger).
 */

export interface OpeningExpectedRow {
  currencyCode: string;
  /** Carried forward from the previous session's disposition (0 for a first session or nothing kept). */
  carriedForward: Decimal;
  /** Net ledger activity between the previous close and this open (float issued, between-session drops, etc). */
  betweenSessionNet: Decimal;
  /** carriedForward + betweenSessionNet. */
  openingExpected: Decimal;
}

/**
 * Chains a new session's opening-expected balance off the drawer's history
 * (P4/P5, plan §4B.10 CLF-4-3 "open"): what the previous session's
 * disposition left behind, plus any ledger activity that landed on this
 * drawer with no session open in between (a DEFERRED cash recognition, or a
 * manual custody transaction like FLOAT_ISSUE before the day's first open).
 *
 * Always returns at least one row, for `drawerCurrencyCode` — a drawer with
 * no history and no between-session activity still needs an opening-expected
 * of exactly 0 in its own currency.
 * @param tx open Prisma transaction — call while the drawer row is locked
 * @param tenantOrgId tenant of the drawer
 * @param drawerId drawer being opened
 * @param drawerCurrencyCode the drawer's own currency (always included)
 * @param openLedgerSeq the drawer's `ledger_seq` at the moment of this open (the new session's `open_ledger_seq`)
 */
export async function computeOpeningExpectedTx(
  tx: Prisma.TransactionClient,
  tenantOrgId: string,
  drawerId: string,
  drawerCurrencyCode: string,
  openLedgerSeq: bigint,
): Promise<OpeningExpectedRow[]> {
  const prevSession = await tx.org_cash_drawer_sessions_mst.findFirst({
    where: {
      tenant_org_id: tenantOrgId,
      cash_drawer_id: drawerId,
      status: { in: [CASH_DRAWER_SESSION_STATUSES.CLOSED, CASH_DRAWER_SESSION_STATUSES.FORCE_CLOSED] },
      is_active: true,
    },
    orderBy: [{ close_ledger_seq: 'desc' }],
    select: { id: true, close_ledger_seq: true },
  });

  const fromSeq = prevSession?.close_ledger_seq ?? BigInt(0);
  const carried = new Map<string, Decimal>();

  if (prevSession) {
    const balRows = await tx.org_cash_drawer_ses_bal_dtl.findMany({
      where: { tenant_org_id: tenantOrgId, cash_drawer_session_id: prevSession.id },
      select: {
        currency_code: true,
        closing_basis: true,
        disposition_code: true,
        disposition_kept_amount: true,
      },
    });
    const dispCodes = [...new Set(balRows.map((r) => r.disposition_code).filter((v): v is string => !!v))];
    const dispRows = dispCodes.length
      ? await tx.sys_cash_drawer_ses_disp_cd.findMany({
          where: { code: { in: dispCodes } },
          select: { code: true, cash_move_mode: true },
        })
      : [];
    const moveModeByCode = new Map(dispRows.map((r) => [r.code, r.cash_move_mode]));

    for (const row of balRows) {
      const basis = row.closing_basis ? new Decimal(row.closing_basis.toString()) : new Decimal(0);
      const moveMode = row.disposition_code ? moveModeByCode.get(row.disposition_code) : CASH_DISPOSITION_MOVE_MODES.NONE;
      let keptAmount: Decimal;
      if (moveMode === CASH_DISPOSITION_MOVE_MODES.ALL) {
        keptAmount = new Decimal(0);
      } else if (moveMode === CASH_DISPOSITION_MOVE_MODES.PART) {
        keptAmount = row.disposition_kept_amount ? new Decimal(row.disposition_kept_amount.toString()) : new Decimal(0);
      } else {
        // NONE, or a disposition that was never recorded (defensive default — nothing known to have moved).
        keptAmount = basis;
      }
      carried.set(row.currency_code, keptAmount);
    }
  }

  const windowTotals = await sumLedgerWindow(tx, tenantOrgId, drawerId, fromSeq, openLedgerSeq);
  const net = netOfWindow(windowTotals);

  const currencies = new Set<string>([drawerCurrencyCode, ...carried.keys(), ...net.keys()]);
  return [...currencies].sort().map((currencyCode) => {
    const carriedForward = carried.get(currencyCode) ?? new Decimal(0);
    const betweenSessionNet = net.get(currencyCode) ?? new Decimal(0);
    return {
      currencyCode,
      carriedForward,
      betweenSessionNet,
      openingExpected: carriedForward.plus(betweenSessionNet),
    };
  });
}

export interface ClosingExpectedRow {
  currencyCode: string;
  finIn: Decimal;
  finOut: Decimal;
  trxIn: Decimal;
  trxOut: Decimal;
  closingExpected: Decimal;
}

/** The subset of a session's opening balance row the closing computation needs. */
export interface OpeningBalanceForClosing {
  currencyCode: string;
  openingExpected: Decimal;
  /** P4: once an opening was physically counted, accountability starts there, not at the system figure. */
  openingCounted: Decimal | null;
}

/**
 * Computes the closing-expected figure for every currency a session touched
 * (plan §4B.10 CLF-4-3 "count step"): the opening baseline (P4 — counted, if
 * counted) plus the session's own window of ledger activity, cut at `cutSeq`
 * (the drawer's `ledger_seq` at the moment the count step starts).
 * @param tx open Prisma transaction — call while the drawer row is locked
 * @param tenantOrgId tenant of the drawer
 * @param drawerId drawer being counted
 * @param openingRows the session's opening balance rows (one per currency)
 * @param openLedgerSeq the session's own `open_ledger_seq`
 * @param cutSeq the drawer's `ledger_seq` at the count step (the new `close_ledger_seq`)
 */
export async function computeClosingExpectedTx(
  tx: Prisma.TransactionClient,
  tenantOrgId: string,
  drawerId: string,
  openingRows: readonly OpeningBalanceForClosing[],
  openLedgerSeq: bigint,
  cutSeq: bigint,
): Promise<ClosingExpectedRow[]> {
  const windowTotals = await sumLedgerWindow(tx, tenantOrgId, drawerId, openLedgerSeq, cutSeq);
  const byCurrency = new Map<string, LedgerWindowTotals>(windowTotals.map((w) => [w.currencyCode, w]));
  const currencies = new Set<string>([...openingRows.map((r) => r.currencyCode), ...windowTotals.map((w) => w.currencyCode)]);

  return [...currencies].sort().map((currencyCode) => {
    const w = byCurrency.get(currencyCode);
    const finIn = w?.finIn ?? new Decimal(0);
    const finOut = w?.finOut ?? new Decimal(0);
    const trxIn = w?.trxIn ?? new Decimal(0);
    const trxOut = w?.trxOut ?? new Decimal(0);
    const opening = openingRows.find((r) => r.currencyCode === currencyCode);
    const baseline = opening ? opening.openingCounted ?? opening.openingExpected : new Decimal(0);
    return {
      currencyCode,
      finIn,
      finOut,
      trxIn,
      trxOut,
      closingExpected: baseline.plus(finIn).minus(finOut).plus(trxIn).minus(trxOut),
    };
  });
}

/**
 * Public window query — every ad-hoc "what moved in this range" question
 * (a SPOT count, a report) goes through this rather than the internal
 * repository directly.
 * @param tx open Prisma transaction or client (read-only; no lock required for a read)
 * @param tenantOrgId tenant of the drawer
 * @param drawerId drawer whose ledger is read
 * @param fromSeqExclusive lower bound (exclusive); 0n = from the beginning
 * @param toSeqInclusive upper bound (inclusive); null = up to the latest entry
 */
export async function computeWindowTx(
  tx: Prisma.TransactionClient,
  tenantOrgId: string,
  drawerId: string,
  fromSeqExclusive: bigint,
  toSeqInclusive: bigint | null,
): Promise<LedgerWindowTotals[]> {
  return sumLedgerWindow(tx, tenantOrgId, drawerId, fromSeqExclusive, toSeqInclusive);
}

export interface DrawerLedgerEntryRow {
  ledgerSeq: bigint;
  domain: 'FIN' | 'TRX';
  entryId: string;
  direction: string;
  amount: Decimal;
  currencyCode: string;
  occurredAt: Date;
  sessionId: string | null;
  description: string | null;
}

export interface DrawerLedgerPage {
  rows: DrawerLedgerEntryRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface LedgerEntryQueryRow {
  ledger_seq: string;
  domain: 'FIN' | 'TRX';
  entry_id: string;
  direction: string;
  amount: Prisma.Decimal;
  currency_code: string;
  occurred_at: Date;
  session_id: string | null;
  description: string | null;
}

/**
 * Paginated unified ledger (finance + custody) for one drawer, newest first
 * (CLF-8-7 Ledger tab).
 * @param tenantOrgId tenant of the drawer
 * @param drawerId drawer whose ledger is read
 * @param page 1-based page number
 * @param pageSize rows per page
 */
export async function getDrawerLedgerPage(
  tenantOrgId: string,
  drawerId: string,
  page: number,
  pageSize: number,
): Promise<DrawerLedgerPage> {
  const offset = Math.max(0, (page - 1) * pageSize);

  const [rows, countRows] = await withTenantContext(tenantOrgId, () =>
    Promise.all([
    prisma.$queryRaw<LedgerEntryQueryRow[]>(Prisma.sql`
      WITH entries AS (
        SELECT l.cash_ledger_seq AS ledger_seq,
               'FIN'::text AS domain,
               l.id AS entry_id,
               l.direction,
               l.amount,
               l.currency_code,
               l.cash_recognized_at AS occurred_at,
               l.cash_drawer_session_id AS session_id,
               l.description
          FROM org_fin_voucher_trx_lines_dtl l
         WHERE l.tenant_org_id = ${tenantOrgId}::uuid
           AND l.cash_drawer_id = ${drawerId}::uuid
           AND l.cash_effect_code = 'DRAWER'
        UNION ALL
        SELECT d.ledger_seq,
               'TRX'::text AS domain,
               d.id AS entry_id,
               d.direction,
               d.amount,
               d.currency_code,
               h.occurred_at,
               d.cash_drawer_session_id AS session_id,
               h.notes AS description
          FROM org_cash_drawer_trx_dtl d
          JOIN org_cash_drawer_trx_mst h ON h.id = d.trx_id
         WHERE d.tenant_org_id = ${tenantOrgId}::uuid
           AND d.cash_drawer_id = ${drawerId}::uuid
      )
      SELECT * FROM entries
       ORDER BY ledger_seq DESC
       LIMIT ${pageSize} OFFSET ${offset}
    `),
    prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
      SELECT (
        (SELECT COUNT(*) FROM org_fin_voucher_trx_lines_dtl
          WHERE tenant_org_id = ${tenantOrgId}::uuid AND cash_drawer_id = ${drawerId}::uuid AND cash_effect_code = 'DRAWER')
        +
        (SELECT COUNT(*) FROM org_cash_drawer_trx_dtl
          WHERE tenant_org_id = ${tenantOrgId}::uuid AND cash_drawer_id = ${drawerId}::uuid)
      ) AS total
    `),
    ]),
  );

  return {
    rows: rows.map((r) => ({
      ledgerSeq: BigInt(r.ledger_seq),
      domain: r.domain,
      entryId: r.entry_id,
      direction: r.direction,
      amount: new Decimal(r.amount.toString()),
      currencyCode: r.currency_code,
      occurredAt: r.occurred_at,
      sessionId: r.session_id,
      description: r.description,
    })),
    totalCount: Number(countRows[0]?.total ?? BigInt(0)),
    page,
    pageSize,
  };
}

/**
 * One ledger entry enriched with the reference fields the legacy
 * `CashDrawerMovementRow` screen contract exposes (CLF-6-1). Kept distinct
 * from {@link DrawerLedgerEntryRow} (CLF-8-7's own unified Ledger tab, which
 * does not need these joins) so this query only pays for the extra columns
 * where a caller actually needs the old movement-row shape.
 */
export interface DrawerLedgerMovementRow {
  id: string;
  domain: 'FIN' | 'TRX';
  /** FIN: the voucher line's `line_role` (e.g. `ORDER_PAYMENT`, `CASH_PAY_IN`). TRX: the transaction's `trx_type_code`. */
  movementType: string;
  direction: string;
  amount: Decimal;
  currencyCode: string;
  orderId: string | null;
  orderPaymentId: string | null;
  /** Human-readable reference: FIN has none readily joinable here; TRX carries its own `trx_no`. */
  referenceNo: string | null;
  reason: string | null;
  occurredAt: Date;
  performedBy: string | null;
}

interface LedgerMovementQueryRow {
  id: string;
  domain: 'FIN' | 'TRX';
  movement_type: string;
  direction: string;
  amount: Prisma.Decimal;
  currency_code: string;
  order_id: string | null;
  order_payment_id: string | null;
  reference_no: string | null;
  reason: string | null;
  occurred_at: Date;
  performed_by: string | null;
}

export interface DrawerLedgerMovementsPage {
  rows: DrawerLedgerMovementRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * Paginated unified ledger (finance + custody), scoped to one session or one
 * drawer, shaped for the pre-CLF `CashDrawerMovementRow` screen contract
 * (CLF-6-1 — keeps the existing session-detail / overview-recent-activity
 * screens working unchanged until CLF-8-7/8-8 give them a native ledger view).
 * @param tenantOrgId tenant of the drawer
 * @param drawerId drawer whose ledger is read
 * @param scope exactly one of `sessionId` (session-scoped) or no session (drawer-wide recent activity)
 * @param page 1-based page number
 * @param pageSize rows per page
 */
export async function getDrawerLedgerMovementsPage(
  tenantOrgId: string,
  drawerId: string,
  scope: { sessionId?: string },
  page: number,
  pageSize: number,
): Promise<DrawerLedgerMovementsPage> {
  const offset = Math.max(0, (page - 1) * pageSize);
  const sessionFilter = scope.sessionId ?? null;

  const [rows, countRows] = await withTenantContext(tenantOrgId, () =>
    Promise.all([
      prisma.$queryRaw<LedgerMovementQueryRow[]>(Prisma.sql`
        WITH entries AS (
          SELECT l.id,
                 'FIN'::text AS domain,
                 l.line_role AS movement_type,
                 l.direction,
                 l.amount,
                 l.currency_code,
                 l.order_id,
                 l.order_payment_id,
                 NULL::text AS reference_no,
                 COALESCE(l.description, l.notes, l.party_name) AS reason,
                 l.cash_recognized_at AS occurred_at,
                 l.cash_recognized_by AS performed_by,
                 l.cash_drawer_session_id AS session_id
            FROM org_fin_voucher_trx_lines_dtl l
           WHERE l.tenant_org_id = ${tenantOrgId}::uuid
             AND l.cash_drawer_id = ${drawerId}::uuid
             AND l.cash_effect_code = 'DRAWER'
          UNION ALL
          SELECT d.id,
                 'TRX'::text AS domain,
                 h.trx_type_code AS movement_type,
                 d.direction,
                 d.amount,
                 d.currency_code,
                 NULL::uuid AS order_id,
                 NULL::uuid AS order_payment_id,
                 h.trx_no AS reference_no,
                 COALESCE(h.reason_code, h.notes) AS reason,
                 h.occurred_at,
                 h.performed_by,
                 d.cash_drawer_session_id AS session_id
            FROM org_cash_drawer_trx_dtl d
            JOIN org_cash_drawer_trx_mst h ON h.id = d.trx_id
           WHERE d.tenant_org_id = ${tenantOrgId}::uuid
             AND d.cash_drawer_id = ${drawerId}::uuid
        )
        SELECT id, domain, movement_type, direction, amount, currency_code,
               order_id, order_payment_id, reference_no, reason, occurred_at, performed_by
          FROM entries
         WHERE ${sessionFilter === null ? Prisma.sql`TRUE` : Prisma.sql`session_id = ${sessionFilter}::uuid`}
         ORDER BY occurred_at DESC
         LIMIT ${pageSize} OFFSET ${offset}
      `),
      prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
        SELECT (
          (SELECT COUNT(*) FROM org_fin_voucher_trx_lines_dtl
            WHERE tenant_org_id = ${tenantOrgId}::uuid AND cash_drawer_id = ${drawerId}::uuid AND cash_effect_code = 'DRAWER'
              AND ${sessionFilter === null ? Prisma.sql`TRUE` : Prisma.sql`cash_drawer_session_id = ${sessionFilter}::uuid`})
          +
          (SELECT COUNT(*) FROM org_cash_drawer_trx_dtl
            WHERE tenant_org_id = ${tenantOrgId}::uuid AND cash_drawer_id = ${drawerId}::uuid
              AND ${sessionFilter === null ? Prisma.sql`TRUE` : Prisma.sql`cash_drawer_session_id = ${sessionFilter}::uuid`})
        ) AS total
      `),
    ]),
  );

  return {
    rows: rows.map((r) => ({
      id: r.id,
      domain: r.domain,
      movementType: r.movement_type,
      direction: r.direction,
      amount: new Decimal(r.amount.toString()),
      currencyCode: r.currency_code,
      orderId: r.order_id,
      orderPaymentId: r.order_payment_id,
      referenceNo: r.reference_no,
      reason: r.reason,
      occurredAt: r.occurred_at,
      performedBy: r.performed_by,
    })),
    totalCount: Number(countRows[0]?.total ?? BigInt(0)),
    page,
    pageSize,
  };
}

interface SessionLedgerTotalsRow {
  domain: 'FIN' | 'TRX';
  direction: string;
  total: Prisma.Decimal;
}

/** Per-session, per-domain IN/OUT ledger totals. Decimal, zero-filled when a session has no entries yet. */
export interface SessionLedgerTotals {
  finIn: Decimal;
  finOut: Decimal;
  trxIn: Decimal;
  trxOut: Decimal;
  finCount: number;
  trxCount: number;
}

/**
 * Sums a batch of sessions' own ledger activity (CLF-6-1), keyed by
 * `cash_drawer_session_id` directly — no `open_ledger_seq`/chain math needed,
 * since the gate stamps every posting's `cash_drawer_session_id` at write
 * time regardless of how the session itself was opened (works identically
 * for a session opened through the still-live legacy `openSession` route and
 * one opened through the CLF lifecycle). This is the session-summary
 * equivalent of {@link sumLedgerWindow}'s drawer-wide window sum.
 * @param tenantOrgId tenant of the sessions
 * @param sessionIds sessions to sum; returns an empty map for an empty input
 */
export async function sumLedgerTotalsBySession(
  tenantOrgId: string,
  sessionIds: string[],
): Promise<Map<string, SessionLedgerTotals>> {
  const empty = () => ({ finIn: new Decimal(0), finOut: new Decimal(0), trxIn: new Decimal(0), trxOut: new Decimal(0), finCount: 0, trxCount: 0 });
  const result = new Map<string, SessionLedgerTotals>();
  if (sessionIds.length === 0) return result;

  const rows = await withTenantContext(tenantOrgId, () =>
    prisma.$queryRaw<Array<SessionLedgerTotalsRow & { session_id: string }>>(Prisma.sql`
      SELECT session_id, domain, direction, SUM(amount)::numeric(19,4) AS total
        FROM (
          SELECT l.cash_drawer_session_id AS session_id, 'FIN'::text AS domain, l.direction, l.amount
            FROM org_fin_voucher_trx_lines_dtl l
           WHERE l.tenant_org_id = ${tenantOrgId}::uuid
             AND l.cash_drawer_session_id = ANY(${sessionIds}::uuid[])
             AND l.cash_effect_code = 'DRAWER'
          UNION ALL
          SELECT d.cash_drawer_session_id AS session_id, 'TRX'::text AS domain, d.direction, d.amount
            FROM org_cash_drawer_trx_dtl d
           WHERE d.tenant_org_id = ${tenantOrgId}::uuid
             AND d.cash_drawer_session_id = ANY(${sessionIds}::uuid[])
             AND d.is_active = TRUE
        ) entries
       GROUP BY session_id, domain, direction
    `),
  );

  for (const sessionId of sessionIds) result.set(sessionId, empty());

  for (const row of rows) {
    const bucket = result.get(row.session_id) ?? empty();
    const amount = new Decimal(row.total.toString());
    if (row.domain === 'FIN' && row.direction === 'IN') bucket.finIn = amount;
    else if (row.domain === 'FIN' && row.direction === 'OUT') bucket.finOut = amount;
    else if (row.domain === 'TRX' && row.direction === 'IN') bucket.trxIn = amount;
    else if (row.domain === 'TRX' && row.direction === 'OUT') bucket.trxOut = amount;
    result.set(row.session_id, bucket);
  }

  // Entry counts separately (COUNT alongside the UNION above would double-count
  // across the direction GROUP BY), one lightweight pass per domain.
  const [finCounts, trxCounts] = await withTenantContext(tenantOrgId, () =>
    Promise.all([
      prisma.org_fin_voucher_trx_lines_dtl.groupBy({
        by: ['cash_drawer_session_id'],
        where: { tenant_org_id: tenantOrgId, cash_drawer_session_id: { in: sessionIds }, cash_effect_code: 'DRAWER' },
        _count: { _all: true },
      }),
      prisma.org_cash_drawer_trx_dtl.groupBy({
        by: ['cash_drawer_session_id'],
        where: { tenant_org_id: tenantOrgId, cash_drawer_session_id: { in: sessionIds }, is_active: true },
        _count: { _all: true },
      }),
    ]),
  );
  for (const row of finCounts) {
    if (!row.cash_drawer_session_id) continue;
    const bucket = result.get(row.cash_drawer_session_id) ?? empty();
    bucket.finCount = row._count._all;
    result.set(row.cash_drawer_session_id, bucket);
  }
  for (const row of trxCounts) {
    if (!row.cash_drawer_session_id) continue;
    const bucket = result.get(row.cash_drawer_session_id) ?? empty();
    bucket.trxCount = row._count._all;
    result.set(row.cash_drawer_session_id, bucket);
  }

  return result;
}

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
import { recordCountTx, type DenominationCountLine } from '@/lib/services/cash-drawer-count.service';
import { postDrawerTrxTx } from '@/lib/services/cash-drawer-trx.service';
import { getCashControlSettings } from '@/lib/services/cash-control-settings.service';
import { emitEventTx } from '@/lib/services/outbox.service';
import {
  CashDrawerSessionError,
  CASH_DRAWER_SESSION_ERRORS,
  VarianceApprovalError,
  VARIANCE_APPROVAL_ERRORS,
} from '@/lib/services/cash-drawer.service';
import { OUTBOX_EVENT_TYPES } from '@/lib/constants/order-financial';
import {
  CASH_DRAWER_SESSION_STATUSES,
  CASH_DRAWER_COUNT_TYPES,
  CASH_DRAWER_TRX_TYPES,
  CASH_DISPOSITION_MOVE_MODES,
  CASH_LEDGER_ERRORS,
  type CashDrawerDisposition,
} from '@/lib/constants/cash-drawer';
import { varianceToleranceFor } from '@/lib/constants/financial-tolerances';
import { CASH_CONTROL_COUNT_MODE } from '@/lib/constants/cash-control';

/**
 * Two-step drawer session lifecycle (CLF, ADR-057, plan §4B.4/§4B.10 CLF-4-3).
 *
 * open → (OPEN) → startCloseTx "count step" → (CLOSING, cut frozen) →
 * finalizeCloseTx "disposition" → (CLOSED). forceCloseTx skips straight to a
 * disposition from either OPEN or CLOSING. approveVarianceTx and
 * updatePostCloseTx operate on an already-closed session.
 *
 * Every mutation here locks the drawer row first (`lockDrawersTx`, the same
 * lock the cash-drawer ledger gate and custody transactions take), so a cash
 * posting and a session transition on the same drawer are always strictly
 * ordered — no event can straddle a cut.
 */

type Tx = Prisma.TransactionClient;
type Ctx = { tenantOrgId: string; userId: string };

interface SessionBalanceRowDb {
  currency_code: string;
  opening_expected: Prisma.Decimal;
  opening_counted: Prisma.Decimal | null;
  closing_expected: Prisma.Decimal | null;
  closing_counted: Prisma.Decimal | null;
  closing_basis: Prisma.Decimal | null;
  disposition_code: string | null;
}

// -----------------------------------------------------------------------------
// Open
// -----------------------------------------------------------------------------

export interface OpeningCountInput {
  countMode: 'TOTAL_ONLY' | 'DENOMINATION';
  totalAmount?: number | string;
  denominations?: DenominationCountLine[];
}

export interface OpenSessionInput {
  drawerId: string;
  openingCount?: OpeningCountInput;
  notes?: string;
}

export interface OpenSessionResult {
  sessionId: string;
  sessionNo: string;
  currencyBalances: Array<{
    currencyCode: string;
    openingExpected: string;
    openingCounted: string | null;
    openingVariance: string | null;
  }>;
}

/**
 * Opens a new session on a drawer. Refuses when one is already OPEN/CLOSING
 * (`CashDrawerSessionError` ALREADY_OPEN). Chains the opening-expected
 * figure off the drawer's history (previous session's disposition plus any
 * between-session ledger activity — `computeOpeningExpectedTx`), enforces
 * the resolved `opening_count_required` policy, and posts an opening
 * over/short event immediately when a count was taken and the variance is
 * outside tolerance (P7 — opening variance always posts at open, no
 * approval deferral).
 */
export async function openSessionTx(tx: Tx, ctx: Ctx, input: OpenSessionInput): Promise<OpenSessionResult> {
  const [drawer] = await lockDrawersTx(tx, ctx.tenantOrgId, [input.drawerId]);
  if (!drawer) {
    throw new Error(`openSessionTx: drawer ${input.drawerId} not found for tenant ${ctx.tenantOrgId}`);
  }

  const existing = await tx.org_cash_drawer_sessions_mst.findFirst({
    where: {
      tenant_org_id: ctx.tenantOrgId,
      cash_drawer_id: input.drawerId,
      status: { in: [CASH_DRAWER_SESSION_STATUSES.OPEN, CASH_DRAWER_SESSION_STATUSES.CLOSING] },
      is_active: true,
    },
    select: { id: true },
  });
  if (existing) {
    throw new CashDrawerSessionError(CASH_DRAWER_SESSION_ERRORS.ALREADY_OPEN, 'A session is already open for this drawer');
  }

  const settings = await getCashControlSettings({
    tenantId: ctx.tenantOrgId,
    branchId: drawer.branch_id,
    userId: ctx.userId,
    drawerId: input.drawerId,
  });
  if (settings.openingCountRequired && !input.openingCount) {
    throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_COUNT_REQUIRED, 'openSessionTx: an opening count is required for this drawer');
  }

  const [{ session_no: sessionNo }] = await tx.$queryRaw<{ session_no: string }[]>(
    Prisma.sql`SELECT generate_cash_drawer_sess_no(${ctx.tenantOrgId}::uuid) AS session_no`,
  );

  const openLedgerSeq = drawer.ledger_seq;
  const openingRows = await computeOpeningExpectedTx(tx, ctx.tenantOrgId, input.drawerId, drawer.currency_code, openLedgerSeq);
  const primaryRow = openingRows.find((r) => r.currencyCode === drawer.currency_code) ?? openingRows[0];

  const session = await tx.org_cash_drawer_sessions_mst.create({
    data: {
      tenant_org_id: ctx.tenantOrgId,
      branch_id: drawer.branch_id,
      cash_drawer_id: input.drawerId,
      session_no: sessionNo,
      status: CASH_DRAWER_SESSION_STATUSES.OPEN,
      currency_code: drawer.currency_code,
      opening_float_amount: primaryRow.openingExpected,
      opened_by: ctx.userId,
      opened_at: new Date(),
      open_ledger_seq: openLedgerSeq,
      is_active: true,
      rec_status: 1,
      created_by: ctx.userId,
    },
  });

  const overShortVariances: Array<{ currencyCode: string; varianceAmount: Decimal }> = [];
  const currencyBalances: OpenSessionResult['currencyBalances'] = [];

  for (const row of openingRows) {
    let openingCountId: string | null = null;
    let openingCounted: Decimal | null = null;

    if (input.openingCount) {
      const countResult = await recordCountTx(tx, ctx, {
        drawerId: input.drawerId,
        branchId: drawer.branch_id,
        cashDrawerSessionId: session.id,
        countType: CASH_DRAWER_COUNT_TYPES.OPENING,
        currencyCode: row.currencyCode,
        expectedAmount: row.openingExpected,
        countMode: input.openingCount.countMode === 'DENOMINATION' ? CASH_CONTROL_COUNT_MODE.DENOMINATION : CASH_CONTROL_COUNT_MODE.TOTAL_ONLY,
        totalAmount: input.openingCount.totalAmount,
        denominations: input.openingCount.denominations,
        notes: input.notes,
      });
      openingCountId = countResult.countId;
      openingCounted = countResult.countedAmount;

      const minorUnit = (await tx.sys_currency_cd.findUnique({ where: { code: row.currencyCode }, select: { minor_unit: true } }))?.minor_unit ?? 2;
      const tolerance = settings.varianceToleranceAmount != null ? new Decimal(settings.varianceToleranceAmount) : new Decimal(varianceToleranceFor(minorUnit));
      if (countResult.varianceAmount.abs().greaterThan(tolerance)) {
        overShortVariances.push({ currencyCode: row.currencyCode, varianceAmount: countResult.varianceAmount });
      }
    }

    await tx.org_cash_drawer_ses_bal_dtl.create({
      data: {
        tenant_org_id: ctx.tenantOrgId,
        cash_drawer_session_id: session.id,
        currency_code: row.currencyCode,
        opening_expected: row.openingExpected,
        opening_counted: openingCounted,
        opening_variance: openingCounted != null ? openingCounted.minus(row.openingExpected) : null,
        opening_count_id: openingCountId,
        created_by: ctx.userId,
      },
    });

    currencyBalances.push({
      currencyCode: row.currencyCode,
      openingExpected: row.openingExpected.toFixed(4),
      openingCounted: openingCounted != null ? openingCounted.toFixed(4) : null,
      openingVariance: openingCounted != null ? openingCounted.minus(row.openingExpected).toFixed(4) : null,
    });
  }

  if (overShortVariances.length > 0) {
    await emitEventTx(tx, ctx.tenantOrgId, OUTBOX_EVENT_TYPES.CASH_DRAWER_OVER_SHORT, 'cash_drawer_session', session.id, {
      session_id: session.id,
      drawer_id: input.drawerId,
      branch_id: drawer.branch_id,
      phase: 'OPENING',
      variances: overShortVariances.map((v) => ({ currencyCode: v.currencyCode, varianceAmount: v.varianceAmount.toFixed(4) })),
    });
  }

  await emitEventTx(tx, ctx.tenantOrgId, OUTBOX_EVENT_TYPES.CASH_DRAWER_SESSION_OPENED, 'cash_drawer_session', session.id, {
    session_id: session.id,
    drawer_id: input.drawerId,
    session_no: sessionNo,
  });

  return { sessionId: session.id, sessionNo, currencyBalances };
}

// -----------------------------------------------------------------------------
// Close preview (read-only; OPEN only — before the count step freezes anything)
// -----------------------------------------------------------------------------

export interface ClosePreviewInput {
  sessionId: string;
  drawerId: string;
}

export interface ClosePreviewResult {
  sessionId: string;
  /** False when `blind_close_enabled` — the operator counts without seeing the system figure first. */
  revealed: boolean;
  currencyBalances: Array<{ currencyCode: string; expected?: string }>;
}

/**
 * Read-only preview of what a close would currently show (§4B.7
 * `GET .../close-preview`, C2-1 absorbed) — computed against the drawer's
 * *current* ledger sequence, not a frozen cut (the count step is what
 * actually freezes `close_ledger_seq`). Never writes anything.
 */
export async function getClosePreview(tenantOrgId: string, userId: string, input: ClosePreviewInput): Promise<ClosePreviewResult> {
  return withTenantContext(tenantOrgId, () =>
    prisma.$transaction(async (tx) => {
      const session = await tx.org_cash_drawer_sessions_mst.findFirst({
        where: { id: input.sessionId, tenant_org_id: tenantOrgId },
        select: { id: true, cash_drawer_id: true, branch_id: true, status: true, open_ledger_seq: true },
      });
      if (!session) {
        throw new Error(`getClosePreview: session ${input.sessionId} not found`);
      }
      if (session.cash_drawer_id !== input.drawerId) {
        throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.DRAWER_SESSION_WRONG_DRAWER, 'getClosePreview: session does not belong to this drawer');
      }
      if (session.status !== CASH_DRAWER_SESSION_STATUSES.OPEN) {
        throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DRAWER_SESSION_NOT_OPEN, `getClosePreview: session is ${session.status}, not OPEN`);
      }

      const drawer = await tx.org_cash_drawers_mst.findFirst({
        where: { id: input.drawerId, tenant_org_id: tenantOrgId },
        select: { ledger_seq: true },
      });
      if (!drawer) {
        throw new Error(`getClosePreview: drawer ${input.drawerId} not found`);
      }

      const settings = await getCashControlSettings({
        tenantId: tenantOrgId,
        branchId: session.branch_id,
        userId,
        drawerId: input.drawerId,
      });

      const openingRowsDb = await tx.org_cash_drawer_ses_bal_dtl.findMany({
        where: { tenant_org_id: tenantOrgId, cash_drawer_session_id: session.id },
        select: { currency_code: true, opening_expected: true, opening_counted: true },
      });
      const openingForClosing: OpeningBalanceForClosing[] = openingRowsDb.map((r) => ({
        currencyCode: r.currency_code,
        openingExpected: new Decimal(r.opening_expected.toString()),
        openingCounted: r.opening_counted ? new Decimal(r.opening_counted.toString()) : null,
      }));

      const rows = await computeClosingExpectedTx(tx, tenantOrgId, input.drawerId, openingForClosing, session.open_ledger_seq ?? BigInt(0), drawer.ledger_seq);

      return {
        sessionId: session.id,
        revealed: !settings.blindCloseEnabled,
        currencyBalances: rows.map((r) => ({
          currencyCode: r.currencyCode,
          expected: settings.blindCloseEnabled ? undefined : r.closingExpected.toFixed(4),
        })),
      };
    }),
  );
}

// -----------------------------------------------------------------------------
// Count step (OPEN -> CLOSING)
// -----------------------------------------------------------------------------

export interface StartCloseInput {
  sessionId: string;
  drawerId: string;
  closingCount?: OpeningCountInput;
  notes?: string;
}

export interface StartCloseResult {
  sessionId: string;
  currencyBalances: Array<{
    currencyCode: string;
    closingExpected: string;
    closingCounted: string | null;
    closingVariance: string | null;
    varianceReasonRequired: boolean;
  }>;
}

/**
 * The count step: freezes the cut (`close_ledger_seq`), takes the optional
 * closing count, computes and reveals the result, and moves the session to
 * `CLOSING`. From this moment, the ledger gate refuses interactive cash on
 * this drawer (`DRAWER_SESSION_CLOSING`) — nothing can land inside a window
 * that's being counted.
 */
export async function startCloseTx(tx: Tx, ctx: Ctx, input: StartCloseInput): Promise<StartCloseResult> {
  const session = await tx.org_cash_drawer_sessions_mst.findFirst({
    where: { id: input.sessionId, tenant_org_id: ctx.tenantOrgId },
    select: { id: true, cash_drawer_id: true, branch_id: true, status: true, open_ledger_seq: true },
  });
  if (!session) {
    throw new Error(`startCloseTx: session ${input.sessionId} not found`);
  }
  if (session.cash_drawer_id !== input.drawerId) {
    throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.DRAWER_SESSION_WRONG_DRAWER, 'startCloseTx: session does not belong to this drawer');
  }
  if (session.status !== CASH_DRAWER_SESSION_STATUSES.OPEN) {
    throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DRAWER_SESSION_NOT_OPEN, `startCloseTx: session is ${session.status}, not OPEN`);
  }

  const [drawer] = await lockDrawersTx(tx, ctx.tenantOrgId, [input.drawerId]);
  if (!drawer) {
    throw new Error(`startCloseTx: drawer ${input.drawerId} not found`);
  }
  const cutSeq = drawer.ledger_seq;

  const settings = await getCashControlSettings({
    tenantId: ctx.tenantOrgId,
    branchId: session.branch_id,
    userId: ctx.userId,
    drawerId: input.drawerId,
  });
  if (settings.closingCountRequired && !input.closingCount) {
    throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_COUNT_REQUIRED, 'startCloseTx: a closing count is required for this drawer');
  }

  const openingRowsDb = (await tx.org_cash_drawer_ses_bal_dtl.findMany({
    where: { tenant_org_id: ctx.tenantOrgId, cash_drawer_session_id: session.id },
    select: { currency_code: true, opening_expected: true, opening_counted: true },
  })) as unknown as SessionBalanceRowDb[];
  const openingForClosing: OpeningBalanceForClosing[] = openingRowsDb.map((r) => ({
    currencyCode: r.currency_code,
    openingExpected: new Decimal(r.opening_expected.toString()),
    openingCounted: r.opening_counted ? new Decimal(r.opening_counted.toString()) : null,
  }));

  const closingRows = await computeClosingExpectedTx(tx, ctx.tenantOrgId, input.drawerId, openingForClosing, session.open_ledger_seq ?? BigInt(0), cutSeq);

  const currencyBalances: StartCloseResult['currencyBalances'] = [];

  for (const row of closingRows) {
    let closingCountId: string | null = null;
    let closingCounted: Decimal | null = null;

    if (input.closingCount) {
      const countResult = await recordCountTx(tx, ctx, {
        drawerId: input.drawerId,
        branchId: session.branch_id,
        cashDrawerSessionId: session.id,
        countType: CASH_DRAWER_COUNT_TYPES.CLOSING,
        currencyCode: row.currencyCode,
        expectedAmount: row.closingExpected,
        countMode: input.closingCount.countMode === 'DENOMINATION' ? CASH_CONTROL_COUNT_MODE.DENOMINATION : CASH_CONTROL_COUNT_MODE.TOTAL_ONLY,
        totalAmount: input.closingCount.totalAmount,
        denominations: input.closingCount.denominations,
        notes: input.notes,
      });
      closingCountId = countResult.countId;
      closingCounted = countResult.countedAmount;
    }

    const closingBasis = closingCounted ?? row.closingExpected;
    const closingVariance = closingCounted != null ? closingCounted.minus(row.closingExpected) : null;

    const minorUnit = (await tx.sys_currency_cd.findUnique({ where: { code: row.currencyCode }, select: { minor_unit: true } }))?.minor_unit ?? 2;
    const tolerance = settings.varianceToleranceAmount != null ? new Decimal(settings.varianceToleranceAmount) : new Decimal(varianceToleranceFor(minorUnit));
    const reasonBand = settings.varianceReasonAmount != null ? new Decimal(settings.varianceReasonAmount) : null;
    const varianceReasonRequired =
      closingVariance != null && closingVariance.abs().greaterThan(tolerance) && (reasonBand == null || closingVariance.abs().greaterThan(reasonBand));

    await tx.org_cash_drawer_ses_bal_dtl.updateMany({
      where: { tenant_org_id: ctx.tenantOrgId, cash_drawer_session_id: session.id, currency_code: row.currencyCode },
      data: {
        fin_in: row.finIn,
        fin_out: row.finOut,
        trx_in: row.trxIn,
        trx_out: row.trxOut,
        closing_expected: row.closingExpected,
        closing_counted: closingCounted,
        closing_variance: closingVariance,
        closing_basis: closingBasis,
        closing_count_id: closingCountId,
        variance_threshold_snap: settings.varianceThresholdAmount,
        variance_tolerance_snap: tolerance,
        updated_at: new Date(),
        updated_by: ctx.userId,
      },
    });

    currencyBalances.push({
      currencyCode: row.currencyCode,
      closingExpected: row.closingExpected.toFixed(4),
      closingCounted: closingCounted != null ? closingCounted.toFixed(4) : null,
      closingVariance: closingVariance != null ? closingVariance.toFixed(4) : null,
      varianceReasonRequired,
    });
  }

  await tx.org_cash_drawer_sessions_mst.update({
    where: { tenant_org_id: ctx.tenantOrgId, id: session.id },
    data: {
      status: CASH_DRAWER_SESSION_STATUSES.CLOSING,
      close_ledger_seq: cutSeq,
      closing_started_at: new Date(),
      closing_started_by: ctx.userId,
      updated_at: new Date(),
      updated_by: ctx.userId,
    },
  });

  await emitEventTx(tx, ctx.tenantOrgId, OUTBOX_EVENT_TYPES.CASH_DRAWER_SESSION_CLOSING, 'cash_drawer_session', session.id, {
    session_id: session.id,
    drawer_id: input.drawerId,
  });

  return { sessionId: session.id, currencyBalances };
}

// -----------------------------------------------------------------------------
// Recount (supervisor correction while CLOSING, before finalize)
// -----------------------------------------------------------------------------

export interface RecountCloseInput {
  sessionId: string;
  drawerId: string;
  currencyCode: string;
  count: OpeningCountInput;
  /** The CLOSING (or prior RECOUNT) count this one supersedes. */
  supersedesCountId: string;
  notes?: string;
}

export interface RecountCloseResult {
  sessionId: string;
  currencyCode: string;
  closingExpected: string;
  closingCounted: string;
  closingVariance: string;
  varianceReasonRequired: boolean;
}

/**
 * Supervisor recount during the `CLOSING` window (§4B.7
 * `.../close/recount`): supersedes the prior closing (or recount) count for
 * one currency against the *same* cut the count step already froze
 * (`close_ledger_seq` does not move) — only the physical count changes, never
 * the window being counted.
 */
export async function recountCloseTx(tx: Tx, ctx: Ctx, input: RecountCloseInput): Promise<RecountCloseResult> {
  const session = await tx.org_cash_drawer_sessions_mst.findFirst({
    where: { id: input.sessionId, tenant_org_id: ctx.tenantOrgId },
    select: { id: true, cash_drawer_id: true, branch_id: true, status: true },
  });
  if (!session) {
    throw new Error(`recountCloseTx: session ${input.sessionId} not found`);
  }
  if (session.cash_drawer_id !== input.drawerId) {
    throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.DRAWER_SESSION_WRONG_DRAWER, 'recountCloseTx: session does not belong to this drawer');
  }
  if (session.status !== CASH_DRAWER_SESSION_STATUSES.CLOSING) {
    throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.DRAWER_SESSION_NOT_CLOSING, `recountCloseTx: session is ${session.status}, not CLOSING`);
  }

  await lockDrawersTx(tx, ctx.tenantOrgId, [input.drawerId]);

  const row = (await tx.org_cash_drawer_ses_bal_dtl.findFirst({
    where: { tenant_org_id: ctx.tenantOrgId, cash_drawer_session_id: session.id, currency_code: input.currencyCode },
    select: { currency_code: true, closing_expected: true },
  })) as unknown as { currency_code: string; closing_expected: Prisma.Decimal | null } | null;
  if (!row || row.closing_expected == null) {
    throw new Error(`recountCloseTx: currency ${input.currencyCode} has no closing-expected figure yet — run the count step first`);
  }
  const closingExpected = new Decimal(row.closing_expected.toString());

  const countResult = await recordCountTx(tx, ctx, {
    drawerId: input.drawerId,
    branchId: session.branch_id,
    cashDrawerSessionId: session.id,
    countType: CASH_DRAWER_COUNT_TYPES.RECOUNT,
    currencyCode: input.currencyCode,
    expectedAmount: closingExpected,
    countMode: input.count.countMode === 'DENOMINATION' ? CASH_CONTROL_COUNT_MODE.DENOMINATION : CASH_CONTROL_COUNT_MODE.TOTAL_ONLY,
    totalAmount: input.count.totalAmount,
    denominations: input.count.denominations,
    supersedesCountId: input.supersedesCountId,
    notes: input.notes,
  });

  const closingCounted = countResult.countedAmount;
  const closingVariance = closingCounted.minus(closingExpected);

  const settings = await getCashControlSettings({
    tenantId: ctx.tenantOrgId,
    branchId: session.branch_id,
    userId: ctx.userId,
    drawerId: input.drawerId,
  });
  const minorUnit = (await tx.sys_currency_cd.findUnique({ where: { code: input.currencyCode }, select: { minor_unit: true } }))?.minor_unit ?? 2;
  const tolerance = settings.varianceToleranceAmount != null ? new Decimal(settings.varianceToleranceAmount) : new Decimal(varianceToleranceFor(minorUnit));
  const reasonBand = settings.varianceReasonAmount != null ? new Decimal(settings.varianceReasonAmount) : null;
  const varianceReasonRequired = closingVariance.abs().greaterThan(tolerance) && (reasonBand == null || closingVariance.abs().greaterThan(reasonBand));

  await tx.org_cash_drawer_ses_bal_dtl.updateMany({
    where: { tenant_org_id: ctx.tenantOrgId, cash_drawer_session_id: session.id, currency_code: input.currencyCode },
    data: {
      closing_counted: closingCounted,
      closing_variance: closingVariance,
      closing_basis: closingCounted,
      closing_count_id: countResult.countId,
      variance_threshold_snap: settings.varianceThresholdAmount,
      variance_tolerance_snap: tolerance,
      updated_at: new Date(),
      updated_by: ctx.userId,
    },
  });

  return {
    sessionId: session.id,
    currencyCode: input.currencyCode,
    closingExpected: closingExpected.toFixed(4),
    closingCounted: closingCounted.toFixed(4),
    closingVariance: closingVariance.toFixed(4),
    varianceReasonRequired,
  };
}

// -----------------------------------------------------------------------------
// Finalize (CLOSING -> CLOSED) and force-close (OPEN|CLOSING -> FORCE_CLOSED)
// -----------------------------------------------------------------------------

export interface DispositionDecisionInput {
  currencyCode: string;
  dispositionCode: CashDrawerDisposition;
  dispositionNotes?: string;
  destDrawerId?: string;
  /** PARTIAL_REMOVED only — amount left behind; never defaulted/prefilled by the service. */
  keptAmount?: number | string;
}

export interface FinalizeCloseInput {
  sessionId: string;
  drawerId: string;
  dispositions: DispositionDecisionInput[];
  varianceReason?: string;
}

export interface FinalizeCloseResult {
  sessionId: string;
  status: 'CLOSED' | 'FORCE_CLOSED';
  varianceApprovalPending: boolean;
  dispositionTrxId: string | null;
}

interface ResolvedDisposition extends DispositionDecisionInput {
  moveMode: string;
  removedAmount: Decimal;
  keptAmountDecimal: Decimal;
  closingBasis: Decimal;
}

/**
 * Validates every currency's disposition decision against §4B.3.1's rules
 * (destination required unless NONE, kept amount bounds for PART, notes when
 * the code requires them, destination type/branch/currency/active), without
 * writing anything. Used by both finalize and force-close.
 */
async function resolveDispositionsTx(
  tx: Tx,
  ctx: Ctx,
  branchId: string,
  balanceRows: SessionBalanceRowDb[],
  dispositions: readonly DispositionDecisionInput[],
): Promise<ResolvedDisposition[]> {
  const byCurrency = new Map(dispositions.map((d) => [d.currencyCode, d]));
  const missing = balanceRows.filter((r) => !byCurrency.has(r.currency_code));
  if (missing.length > 0) {
    throw new CashDrawerLedgerError(
      CASH_LEDGER_ERRORS.CASH_DISPOSITION_DEST_REQUIRED,
      `resolveDispositionsTx: missing a disposition decision for ${missing.map((m) => m.currency_code).join(', ')}`,
    );
  }

  const dispCodes = [...new Set(dispositions.map((d) => d.dispositionCode))];
  const dispRows = await tx.sys_cash_drawer_ses_disp_cd.findMany({
    where: { code: { in: dispCodes } },
    select: { code: true, cash_move_mode: true, dest_drawer_type_code: true, requires_notes: true, requires_kept_amount: true, is_selectable: true },
  });
  const dispByCode = new Map(dispRows.map((d) => [d.code, d]));

  const destDrawerIds = [...new Set(dispositions.map((d) => d.destDrawerId).filter((v): v is string => !!v))];
  const destDrawers = destDrawerIds.length
    ? await tx.org_cash_drawers_mst.findMany({
        where: { id: { in: destDrawerIds }, tenant_org_id: ctx.tenantOrgId },
        select: { id: true, branch_id: true, drawer_type: true, currency_code: true, is_active: true },
      })
    : [];
  const destById = new Map(destDrawers.map((d) => [d.id, d]));
  const destTypeCodes = [...new Set(destDrawers.map((d) => d.drawer_type))];
  const destTypes = destTypeCodes.length
    ? await tx.sys_cash_drawer_type_cd.findMany({ where: { code: { in: destTypeCodes } }, select: { code: true, can_receive_disposition: true } })
    : [];
  const destTypeByCode = new Map(destTypes.map((t) => [t.code, t.can_receive_disposition]));

  const resolved: ResolvedDisposition[] = [];
  for (const row of balanceRows) {
    const d = byCurrency.get(row.currency_code) as DispositionDecisionInput;
    const disp = dispByCode.get(d.dispositionCode);
    if (!disp) {
      throw new Error(`resolveDispositionsTx: unknown disposition code ${d.dispositionCode}`);
    }
    if (!disp.is_selectable) {
      throw new Error(`resolveDispositionsTx: disposition ${d.dispositionCode} is not user-selectable`);
    }
    if (disp.requires_notes && !d.dispositionNotes?.trim()) {
      throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DISPOSITION_NOTES_REQUIRED, `resolveDispositionsTx: ${d.dispositionCode} requires notes`);
    }

    const closingBasis = row.closing_basis ? new Decimal(row.closing_basis.toString()) : new Decimal(0);
    let removedAmount: Decimal;
    let keptAmountDecimal: Decimal;

    if (disp.cash_move_mode === CASH_DISPOSITION_MOVE_MODES.NONE) {
      removedAmount = new Decimal(0);
      keptAmountDecimal = closingBasis;
    } else {
      if (!d.destDrawerId) {
        throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DISPOSITION_DEST_REQUIRED, `resolveDispositionsTx: ${d.dispositionCode} needs a destination drawer`);
      }
      const dest = destById.get(d.destDrawerId);
      if (!dest || !dest.is_active) {
        throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DRAWER_INACTIVE, `resolveDispositionsTx: destination drawer ${d.destDrawerId} not found or inactive`);
      }
      if (dest.branch_id !== branchId) {
        throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_TRX_CROSS_BRANCH, 'resolveDispositionsTx: destination drawer must be in the same branch');
      }
      if (dest.currency_code !== d.currencyCode) {
        throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_CURRENCY_MISMATCH, 'resolveDispositionsTx: destination drawer currency mismatch');
      }
      if (!destTypeByCode.get(dest.drawer_type)) {
        throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DRAWER_TYPE_NOT_ALLOWED, 'resolveDispositionsTx: destination drawer type cannot receive a disposition');
      }
      if (disp.dest_drawer_type_code && dest.drawer_type !== disp.dest_drawer_type_code) {
        throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DRAWER_TYPE_NOT_ALLOWED, `resolveDispositionsTx: ${d.dispositionCode} requires a ${disp.dest_drawer_type_code} destination`);
      }

      if (disp.cash_move_mode === CASH_DISPOSITION_MOVE_MODES.ALL) {
        removedAmount = closingBasis;
        keptAmountDecimal = new Decimal(0);
      } else {
        // PART
        if (d.keptAmount == null) {
          throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DISPOSITION_AMOUNT_INVALID, `resolveDispositionsTx: ${d.dispositionCode} needs a kept amount`);
        }
        keptAmountDecimal = new Decimal(d.keptAmount.toString());
        if (keptAmountDecimal.isNegative() || keptAmountDecimal.greaterThan(closingBasis)) {
          throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DISPOSITION_AMOUNT_INVALID, `resolveDispositionsTx: kept amount must be between 0 and ${closingBasis.toString()}`);
        }
        removedAmount = closingBasis.minus(keptAmountDecimal);
      }
    }

    resolved.push({ ...d, moveMode: disp.cash_move_mode, removedAmount, keptAmountDecimal, closingBasis });
  }

  return resolved;
}

/**
 * Shared finalize core — writes every currency's disposition onto
 * `ses_bal_dtl`, posts one CLOSE_DISPOSITION custody transaction covering
 * every currency that actually moves cash, flips the session to its target
 * terminal status, and emits the closing over/short event (unless the
 * session is flagged for B16 variance approval, in which case the event is
 * deferred to `approveVarianceTx`).
 */
async function finalizeSessionCoreTx(
  tx: Tx,
  ctx: Ctx,
  session: { id: string; cash_drawer_id: string; branch_id: string },
  dispositions: readonly DispositionDecisionInput[],
  options: { targetStatus: 'CLOSED' | 'FORCE_CLOSED'; forceCloseReason?: string; closeNotes?: string; varianceReason?: string },
): Promise<FinalizeCloseResult> {
  const balanceRows = (await tx.org_cash_drawer_ses_bal_dtl.findMany({
    where: { tenant_org_id: ctx.tenantOrgId, cash_drawer_session_id: session.id },
    select: { currency_code: true, closing_expected: true, closing_counted: true, closing_basis: true, closing_variance: true, variance_threshold_snap: true, variance_tolerance_snap: true, disposition_code: true },
  })) as unknown as Array<SessionBalanceRowDb & { closing_variance: Prisma.Decimal | null; variance_threshold_snap: Prisma.Decimal | null; variance_tolerance_snap: Prisma.Decimal | null }>;

  const resolved = await resolveDispositionsTx(tx, ctx, session.branch_id, balanceRows, dispositions);

  const trxLines: Array<{ drawerId: string; direction: 'IN' | 'OUT'; amount: Decimal; currencyCode: string; cashDrawerSessionId: string }> = [];
  for (const d of resolved) {
    if (d.removedAmount.greaterThan(0) && d.destDrawerId) {
      trxLines.push({ drawerId: session.cash_drawer_id, direction: 'OUT', amount: d.removedAmount, currencyCode: d.currencyCode, cashDrawerSessionId: session.id });
      trxLines.push({ drawerId: d.destDrawerId, direction: 'IN', amount: d.removedAmount, currencyCode: d.currencyCode, cashDrawerSessionId: session.id });
    }
  }

  let dispositionTrxId: string | null = null;
  if (trxLines.length > 0) {
    const trx = await postDrawerTrxTx(tx, ctx, {
      trxTypeCode: CASH_DRAWER_TRX_TYPES.CLOSE_DISPOSITION,
      branchId: session.branch_id,
      lines: trxLines,
      sourceSessionId: session.id,
      notes: resolved.find((r) => r.dispositionNotes)?.dispositionNotes,
    });
    dispositionTrxId = trx.trxId;
  }

  let varianceApprovalPending = false;
  const overShortVariances: Array<{ currencyCode: string; varianceAmount: Decimal }> = [];

  for (const d of resolved) {
    const row = balanceRows.find((r) => r.currency_code === d.currencyCode) as (typeof balanceRows)[number];
    const variance = row.closing_variance ? new Decimal(row.closing_variance.toString()) : null;
    const threshold = row.variance_threshold_snap ? new Decimal(row.variance_threshold_snap.toString()) : null;
    const tolerance = row.variance_tolerance_snap ? new Decimal(row.variance_tolerance_snap.toString()) : new Decimal(0);

    const pendingThisCurrency = variance != null && threshold != null && variance.abs().greaterThan(threshold);
    if (pendingThisCurrency) varianceApprovalPending = true;
    if (variance != null && variance.abs().greaterThan(tolerance) && !pendingThisCurrency) {
      overShortVariances.push({ currencyCode: d.currencyCode, varianceAmount: variance });
    }

    await tx.org_cash_drawer_ses_bal_dtl.updateMany({
      where: { tenant_org_id: ctx.tenantOrgId, cash_drawer_session_id: session.id, currency_code: d.currencyCode },
      data: {
        disposition_code: d.dispositionCode,
        disposition_notes: d.dispositionNotes ?? null,
        disposition_dest_drawer_id: d.destDrawerId ?? null,
        disposition_kept_amount: d.moveMode === CASH_DISPOSITION_MOVE_MODES.PART ? d.keptAmountDecimal : null,
        disposition_trx_id: d.removedAmount.greaterThan(0) ? dispositionTrxId : null,
        updated_at: new Date(),
        updated_by: ctx.userId,
      },
    });
  }

  await tx.org_cash_drawer_sessions_mst.update({
    where: { tenant_org_id: ctx.tenantOrgId, id: session.id },
    data: {
      status: options.targetStatus,
      closed_by: ctx.userId,
      closed_at: new Date(),
      close_notes: options.closeNotes ?? null,
      force_close_reason: options.targetStatus === 'FORCE_CLOSED' ? options.forceCloseReason ?? null : null,
      variance_approval_reason: options.varianceReason ?? null,
      // The threshold is resolved once per drawer (not per currency), so any
      // row that has it snapshotted carries the same value — take the first.
      variance_threshold_snapshot: varianceApprovalPending
        ? (balanceRows.find((r) => r.variance_threshold_snap != null)?.variance_threshold_snap ?? null)
        : null,
      updated_at: new Date(),
      updated_by: ctx.userId,
    },
  });

  if (overShortVariances.length > 0) {
    await emitEventTx(tx, ctx.tenantOrgId, OUTBOX_EVENT_TYPES.CASH_DRAWER_OVER_SHORT, 'cash_drawer_session', session.id, {
      session_id: session.id,
      drawer_id: session.cash_drawer_id,
      branch_id: session.branch_id,
      phase: 'CLOSING',
      variances: overShortVariances.map((v) => ({ currencyCode: v.currencyCode, varianceAmount: v.varianceAmount.toFixed(4) })),
    });
  }

  await emitEventTx(tx, ctx.tenantOrgId, OUTBOX_EVENT_TYPES.CASH_DRAWER_SESSION_CLOSED, 'cash_drawer_session', session.id, {
    session_id: session.id,
    drawer_id: session.cash_drawer_id,
    status: options.targetStatus,
    variance_approval_pending: varianceApprovalPending,
  });

  return { sessionId: session.id, status: options.targetStatus, varianceApprovalPending, dispositionTrxId };
}

/** Finalizes a session that already went through the count step (`CLOSING`). */
export async function finalizeCloseTx(tx: Tx, ctx: Ctx, input: FinalizeCloseInput): Promise<FinalizeCloseResult> {
  const session = await tx.org_cash_drawer_sessions_mst.findFirst({
    where: { id: input.sessionId, tenant_org_id: ctx.tenantOrgId },
    select: { id: true, cash_drawer_id: true, branch_id: true, status: true },
  });
  if (!session) {
    throw new Error(`finalizeCloseTx: session ${input.sessionId} not found`);
  }
  if (session.cash_drawer_id !== input.drawerId) {
    throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.DRAWER_SESSION_WRONG_DRAWER, 'finalizeCloseTx: session does not belong to this drawer');
  }
  if (session.status !== CASH_DRAWER_SESSION_STATUSES.CLOSING) {
    throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.DRAWER_SESSION_NOT_CLOSING, `finalizeCloseTx: session is ${session.status}, not CLOSING — run the count step first`);
  }

  await lockDrawersTx(tx, ctx.tenantOrgId, [input.drawerId]);

  return finalizeSessionCoreTx(tx, ctx, session, input.dispositions, { targetStatus: 'CLOSED', varianceReason: input.varianceReason });
}

export interface ForceCloseInput {
  sessionId: string;
  drawerId: string;
  reason: string;
  dispositions: DispositionDecisionInput[];
}

/**
 * Supervisor force-close — mandatory reason; works from either `OPEN` (the
 * count step never ran) or `CLOSING` (it did). From `OPEN` this synthesizes
 * the cut and the closing-expected figures with no physical count
 * (`closing_counted` stays NULL, `closing_basis` falls back to expected),
 * then applies the same disposition rules as a normal finalize.
 */
export async function forceCloseTx(tx: Tx, ctx: Ctx, input: ForceCloseInput): Promise<FinalizeCloseResult> {
  if (!input.reason?.trim()) {
    throw new Error('forceCloseTx: reason is required');
  }

  const session = await tx.org_cash_drawer_sessions_mst.findFirst({
    where: { id: input.sessionId, tenant_org_id: ctx.tenantOrgId },
    select: { id: true, cash_drawer_id: true, branch_id: true, status: true, open_ledger_seq: true },
  });
  if (!session) {
    throw new Error(`forceCloseTx: session ${input.sessionId} not found`);
  }
  if (session.cash_drawer_id !== input.drawerId) {
    throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.DRAWER_SESSION_WRONG_DRAWER, 'forceCloseTx: session does not belong to this drawer');
  }
  if (session.status !== CASH_DRAWER_SESSION_STATUSES.OPEN && session.status !== CASH_DRAWER_SESSION_STATUSES.CLOSING) {
    throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.CASH_DRAWER_SESSION_NOT_OPEN, `forceCloseTx: session is ${session.status}`);
  }

  const [drawer] = await lockDrawersTx(tx, ctx.tenantOrgId, [input.drawerId]);
  if (!drawer) {
    throw new Error(`forceCloseTx: drawer ${input.drawerId} not found`);
  }

  if (session.status === CASH_DRAWER_SESSION_STATUSES.OPEN) {
    // Synthesize the count step: cut now, no physical count possible.
    const cutSeq = drawer.ledger_seq;
    const openingRowsDb = (await tx.org_cash_drawer_ses_bal_dtl.findMany({
      where: { tenant_org_id: ctx.tenantOrgId, cash_drawer_session_id: session.id },
      select: { currency_code: true, opening_expected: true, opening_counted: true },
    })) as unknown as SessionBalanceRowDb[];
    const openingForClosing: OpeningBalanceForClosing[] = openingRowsDb.map((r) => ({
      currencyCode: r.currency_code,
      openingExpected: new Decimal(r.opening_expected.toString()),
      openingCounted: r.opening_counted ? new Decimal(r.opening_counted.toString()) : null,
    }));
    const closingRows = await computeClosingExpectedTx(tx, ctx.tenantOrgId, input.drawerId, openingForClosing, session.open_ledger_seq ?? BigInt(0), cutSeq);

    for (const row of closingRows) {
      await tx.org_cash_drawer_ses_bal_dtl.updateMany({
        where: { tenant_org_id: ctx.tenantOrgId, cash_drawer_session_id: session.id, currency_code: row.currencyCode },
        data: {
          fin_in: row.finIn,
          fin_out: row.finOut,
          trx_in: row.trxIn,
          trx_out: row.trxOut,
          closing_expected: row.closingExpected,
          closing_counted: null,
          closing_variance: null,
          closing_basis: row.closingExpected,
          updated_at: new Date(),
          updated_by: ctx.userId,
        },
      });
    }

    await tx.org_cash_drawer_sessions_mst.update({
      where: { tenant_org_id: ctx.tenantOrgId, id: session.id },
      data: { close_ledger_seq: cutSeq, closing_started_at: new Date(), closing_started_by: ctx.userId },
    });
  }

  return finalizeSessionCoreTx(tx, ctx, session, input.dispositions, { targetStatus: 'FORCE_CLOSED', forceCloseReason: input.reason });
}

// -----------------------------------------------------------------------------
// Variance approval (moved from cash-drawer.service.ts, CLF-aware)
// -----------------------------------------------------------------------------

/**
 * B16 approval, CLF-aware: once a pending variance is approved, the closing
 * over/short event (withheld at finalize while pending — P7) is emitted now,
 * for every currency whose variance is outside tolerance.
 */
export async function approveVarianceTx(
  tx: Tx,
  ctx: Ctx,
  sessionId: string,
  params: { reason: string },
): Promise<void> {
  const reason = params.reason?.trim();
  if (!reason) {
    throw new VarianceApprovalError(VARIANCE_APPROVAL_ERRORS.REASON_REQUIRED);
  }

  const session = await tx.org_cash_drawer_sessions_mst.findFirst({
    where: { id: sessionId, tenant_org_id: ctx.tenantOrgId },
    select: { id: true, cash_drawer_id: true, branch_id: true, variance_threshold_snapshot: true, variance_approved_by: true },
  });
  if (!session) {
    throw new Error(`approveVarianceTx: session ${sessionId} not found`);
  }
  if (session.variance_threshold_snapshot == null) {
    throw new VarianceApprovalError(VARIANCE_APPROVAL_ERRORS.NOT_PENDING_APPROVAL);
  }
  if (session.variance_approved_by != null) {
    throw new VarianceApprovalError(VARIANCE_APPROVAL_ERRORS.ALREADY_APPROVED);
  }

  await tx.org_cash_drawer_sessions_mst.update({
    where: { tenant_org_id: ctx.tenantOrgId, id: sessionId },
    data: {
      variance_approved_by: ctx.userId,
      variance_approved_at: new Date(),
      variance_approval_reason: reason,
      updated_at: new Date(),
    },
  });

  const balanceRows = (await tx.org_cash_drawer_ses_bal_dtl.findMany({
    where: { tenant_org_id: ctx.tenantOrgId, cash_drawer_session_id: sessionId },
    select: { currency_code: true, closing_variance: true, variance_tolerance_snap: true },
  })) as unknown as Array<{ currency_code: string; closing_variance: Prisma.Decimal | null; variance_tolerance_snap: Prisma.Decimal | null }>;

  const variances = balanceRows
    .filter((r) => r.closing_variance != null)
    .map((r) => ({ currencyCode: r.currency_code, varianceAmount: new Decimal((r.closing_variance as Prisma.Decimal).toString()) }))
    .filter((v, i) => {
      const tol = balanceRows[i]?.variance_tolerance_snap ? new Decimal((balanceRows[i].variance_tolerance_snap as Prisma.Decimal).toString()) : new Decimal(0);
      return v.varianceAmount.abs().greaterThan(tol);
    });

  if (variances.length > 0) {
    await emitEventTx(tx, ctx.tenantOrgId, OUTBOX_EVENT_TYPES.CASH_DRAWER_OVER_SHORT, 'cash_drawer_session', sessionId, {
      session_id: sessionId,
      drawer_id: session.cash_drawer_id,
      branch_id: session.branch_id,
      phase: 'CLOSING',
      variances: variances.map((v) => ({ currencyCode: v.currencyCode, varianceAmount: v.varianceAmount.toFixed(4) })),
    });
  }
}

// -----------------------------------------------------------------------------
// Post-close follow-up
// -----------------------------------------------------------------------------

export interface UpdatePostCloseInput {
  sessionId: string;
  postCloseStatusCode: string;
  notes?: string;
}

/** Appends to the post-close change log and updates the session's current post-close status. Only valid once CLOSED/FORCE_CLOSED. */
export async function updatePostCloseTx(tx: Tx, ctx: Ctx, input: UpdatePostCloseInput): Promise<void> {
  const session = await tx.org_cash_drawer_sessions_mst.findFirst({
    where: { id: input.sessionId, tenant_org_id: ctx.tenantOrgId },
    select: { id: true, status: true },
  });
  if (!session) {
    throw new Error(`updatePostCloseTx: session ${input.sessionId} not found`);
  }
  if (session.status !== CASH_DRAWER_SESSION_STATUSES.CLOSED && session.status !== CASH_DRAWER_SESSION_STATUSES.FORCE_CLOSED) {
    throw new CashDrawerLedgerError(CASH_LEDGER_ERRORS.POST_CLOSE_SESSION_NOT_CLOSED, `updatePostCloseTx: session is ${session.status}`);
  }

  const now = new Date();
  await tx.org_cash_drawer_ses_post_tr.create({
    data: {
      tenant_org_id: ctx.tenantOrgId,
      cash_drawer_session_id: session.id,
      post_close_status_code: input.postCloseStatusCode,
      post_close_notes: input.notes ?? null,
      changed_by: ctx.userId,
      changed_at: now,
      created_by: ctx.userId,
    },
  });

  await tx.org_cash_drawer_sessions_mst.update({
    where: { tenant_org_id: ctx.tenantOrgId, id: session.id },
    data: {
      post_close_status_code: input.postCloseStatusCode,
      post_close_notes: input.notes ?? null,
      post_close_by: ctx.userId,
      post_close_at: now,
      updated_at: now,
      updated_by: ctx.userId,
    },
  });
}

export interface PostCloseHistoryRow {
  postCloseStatusCode: string;
  notes: string | null;
  changedBy: string;
  changedAt: Date;
}

/** Full post-close change log for a session, newest first (§4B.7 `.../post-close/history`). */
export async function listPostCloseHistory(tenantOrgId: string, sessionId: string): Promise<PostCloseHistoryRow[]> {
  return withTenantContext(tenantOrgId, async () => {
    const session = await prisma.org_cash_drawer_sessions_mst.findFirst({
      where: { id: sessionId, tenant_org_id: tenantOrgId },
      select: { id: true },
    });
    if (!session) {
      throw new Error(`listPostCloseHistory: session ${sessionId} not found`);
    }
    const rows = await prisma.org_cash_drawer_ses_post_tr.findMany({
      where: { tenant_org_id: tenantOrgId, cash_drawer_session_id: sessionId },
      orderBy: { changed_at: 'desc' },
      select: { post_close_status_code: true, post_close_notes: true, changed_by: true, changed_at: true },
    });
    return rows.map((r) => ({
      postCloseStatusCode: r.post_close_status_code,
      notes: r.post_close_notes,
      changedBy: r.changed_by,
      changedAt: r.changed_at,
    }));
  });
}

// -----------------------------------------------------------------------------
// Public (non-Tx) entry points
// -----------------------------------------------------------------------------

export async function openSession(tenantOrgId: string, userId: string, input: OpenSessionInput): Promise<OpenSessionResult> {
  return withTenantContext(tenantOrgId, () => prisma.$transaction((tx) => openSessionTx(tx, { tenantOrgId, userId }, input)));
}

export async function startClose(tenantOrgId: string, userId: string, input: StartCloseInput): Promise<StartCloseResult> {
  return withTenantContext(tenantOrgId, () => prisma.$transaction((tx) => startCloseTx(tx, { tenantOrgId, userId }, input)));
}

export async function recountClose(tenantOrgId: string, userId: string, input: RecountCloseInput): Promise<RecountCloseResult> {
  return withTenantContext(tenantOrgId, () => prisma.$transaction((tx) => recountCloseTx(tx, { tenantOrgId, userId }, input)));
}

export async function finalizeClose(tenantOrgId: string, userId: string, input: FinalizeCloseInput): Promise<FinalizeCloseResult> {
  return withTenantContext(tenantOrgId, () => prisma.$transaction((tx) => finalizeCloseTx(tx, { tenantOrgId, userId }, input)));
}

export async function forceClose(tenantOrgId: string, userId: string, input: ForceCloseInput): Promise<FinalizeCloseResult> {
  return withTenantContext(tenantOrgId, () => prisma.$transaction((tx) => forceCloseTx(tx, { tenantOrgId, userId }, input)));
}

export async function approveVariance(tenantOrgId: string, userId: string, sessionId: string, params: { reason: string }): Promise<void> {
  return withTenantContext(tenantOrgId, () => prisma.$transaction((tx) => approveVarianceTx(tx, { tenantOrgId, userId }, sessionId, params)));
}

export async function updatePostClose(tenantOrgId: string, userId: string, input: UpdatePostCloseInput): Promise<void> {
  return withTenantContext(tenantOrgId, () => prisma.$transaction((tx) => updatePostCloseTx(tx, { tenantOrgId, userId }, input)));
}

import 'server-only';

import { Prisma } from '@prisma/client';

import {
  CASH_DRAWER_SESSION_STATUSES,
  CASH_EFFECTS,
  CASH_LEDGER_ERRORS,
  type CashGateMode,
} from '@/lib/constants/cash-drawer';
import { OUTBOX_EVENT_TYPES } from '@/lib/constants/order-financial';
import { getCashControlSettings } from '@/lib/services/cash-control-settings.service';
import { isCompletedPaymentStatus } from '@/lib/services/order-financial-aggregation';
import { emitEventTx } from '@/lib/services/outbox.service';
import { resolvePaymentStatus } from '@/lib/services/wiring/order-payment-wiring.handler';
import { isCashFamilyMethod } from '@/lib/utils/cash-method';
import type {
  CashLineDecision,
  DrawerLiveSession,
  DrawerProfile,
} from '@/lib/types/cash-drawer-ledger';
import type { VoucherLineForWiring } from '@/lib/types/voucher-wiring';

import { allocateLedgerSeqTx, lockDrawersTx, type LockedDrawerRow } from './cash-drawer-lock';
import { CashDrawerLedgerError } from './cash-drawer-errors';
import { decideCashLine } from './cash-drawer-ledger-policy';

/**
 * Cash-drawer ledger gate (CLF, ADR-057, plan §4B.4).
 *
 * The ONLY writer of the drawer stamp on finance voucher lines
 * (`cash_effect_code`, `cash_drawer_id`, `cash_ledger_seq`,
 * `cash_recognized_at/_by`, `cash_drawer_session_id`). Domain code never sets
 * these columns; it hands lines to the gate, which:
 *   1. resolves each cash line's drawer (explicit id, else the session hint's drawer),
 *   2. locks those drawers (sorted row locks — shared with session open/close),
 *   3. loads type capabilities, the live session and the requires_session policy,
 *   4. asks the pure policy for a decision and refuses the whole posting on error,
 *   5. allocates ledger sequence values and writes the stamp.
 * Because close/open take the same drawer row lock, a cash line and a session
 * close on the same drawer are strictly ordered — the D22 race is closed here.
 */

/** Who is posting, and whether a person is handling the cash right now. */
export interface CashGateContext {
  tenantOrgId: string;
  userId: string;
  mode: CashGateMode;
}

/** Voucher header facts used as fallbacks for the lines. */
export interface CashGateVoucher {
  id: string;
  branchId: string | null;
  currencyCode: string | null;
}

/** A voucher line as the gate receives it; `cash_drawer_id` is an optional explicit drawer. */
export type CashGateLine = VoucherLineForWiring & { cash_drawer_id?: string | null };

const LIVE_SESSION_STATUSES = [CASH_DRAWER_SESSION_STATUSES.OPEN, CASH_DRAWER_SESSION_STATUSES.CLOSING];

function isCashLine(line: Pick<CashGateLine, 'payment_method_code' | 'direction'>): boolean {
  return isCashFamilyMethod(line.payment_method_code) && (line.direction === 'IN' || line.direction === 'OUT');
}

/**
 * Effective `requires_cash_drawer` per line: tenant method row (by id, else by
 * code), falling back to the system method, falling back to TRUE — cash is
 * drawer cash unless the tenant explicitly says otherwise.
 */
async function resolveRequiresCashDrawer(
  tx: Prisma.TransactionClient,
  tenantOrgId: string,
  lines: readonly CashGateLine[],
): Promise<Map<string, boolean>> {
  const orgIds = [...new Set(lines.map((l) => l.org_payment_method_id).filter((v): v is string => !!v))];
  const codes = [...new Set(lines.map((l) => l.payment_method_code).filter((v): v is string => !!v))];

  const [orgRows, sysRows] = await Promise.all([
    tx.org_payment_methods_cf.findMany({
      where: {
        tenant_org_id: tenantOrgId,
        OR: [{ id: { in: orgIds } }, { payment_method_code: { in: codes } }],
      },
      select: { id: true, payment_method_code: true, requires_cash_drawer: true },
    }),
    tx.sys_payment_method_cd.findMany({
      where: { payment_method_code: { in: codes } },
      select: { payment_method_code: true, requires_cash_drawer: true },
    }),
  ]);

  const orgById = new Map(orgRows.map((r) => [r.id, r]));
  const orgByCode = new Map<string, (typeof orgRows)[number]>();
  for (const r of orgRows) {
    if (!orgByCode.has(r.payment_method_code)) orgByCode.set(r.payment_method_code, r);
  }
  const sysByCode = new Map(sysRows.map((r) => [r.payment_method_code, r.requires_cash_drawer]));

  const result = new Map<string, boolean>();
  for (const line of lines) {
    const code = line.payment_method_code ?? '';
    const org = (line.org_payment_method_id && orgById.get(line.org_payment_method_id)) || orgByCode.get(code);
    result.set(line.id, org?.requires_cash_drawer ?? sysByCode.get(code) ?? true);
  }
  return result;
}

/** Drawer id per line: explicit drawer, else the drawer of the hinted session. */
async function resolveDrawerIds(
  tx: Prisma.TransactionClient,
  tenantOrgId: string,
  lines: readonly CashGateLine[],
): Promise<Map<string, string | null>> {
  const hintSessionIds = [
    ...new Set(
      lines
        .filter((l) => !l.cash_drawer_id && l.cash_drawer_session_id)
        .map((l) => l.cash_drawer_session_id as string),
    ),
  ];
  const hinted = hintSessionIds.length
    ? await tx.org_cash_drawer_sessions_mst.findMany({
        where: { tenant_org_id: tenantOrgId, id: { in: hintSessionIds } },
        select: { id: true, cash_drawer_id: true },
      })
    : [];
  const drawerBySession = new Map(hinted.map((s) => [s.id, s.cash_drawer_id]));

  const result = new Map<string, string | null>();
  for (const line of lines) {
    result.set(
      line.id,
      line.cash_drawer_id ?? (line.cash_drawer_session_id ? drawerBySession.get(line.cash_drawer_session_id) ?? null : null),
    );
  }
  return result;
}

/** Locks the drawers and loads everything the policy needs, per drawer id. */
async function loadDrawerFacts(
  tx: Prisma.TransactionClient,
  ctx: CashGateContext,
  drawerIds: readonly string[],
): Promise<{
  profiles: Map<string, DrawerProfile>;
  liveSessions: Map<string, DrawerLiveSession>;
  requiresSession: Map<string, boolean>;
}> {
  const locked: LockedDrawerRow[] = await lockDrawersTx(tx, ctx.tenantOrgId, drawerIds);
  const typeCodes = [...new Set(locked.map((d) => d.drawer_type))];

  const [types, sessions] = await Promise.all([
    tx.sys_cash_drawer_type_cd.findMany({
      where: { code: { in: typeCodes } },
      select: { code: true, accepts_customer_cash: true, allows_customer_cash_out: true },
    }),
    tx.org_cash_drawer_sessions_mst.findMany({
      where: {
        tenant_org_id: ctx.tenantOrgId,
        cash_drawer_id: { in: locked.map((d) => d.id) },
        status: { in: [...LIVE_SESSION_STATUSES] },
        is_active: true,
      },
      select: { id: true, cash_drawer_id: true, status: true },
    }),
  ]);
  const typeByCode = new Map(types.map((t) => [t.code, t]));

  const profiles = new Map<string, DrawerProfile>();
  for (const d of locked) {
    const type = typeByCode.get(d.drawer_type);
    profiles.set(d.id, {
      id: d.id,
      tenantOrgId: d.tenant_org_id,
      branchId: d.branch_id,
      drawerType: d.drawer_type as DrawerProfile['drawerType'],
      currencyCode: d.currency_code,
      isActive: d.is_active,
      // Unknown type (should not happen — FK) fails closed.
      acceptsCustomerCash: type?.accepts_customer_cash ?? false,
      allowsCustomerCashOut: type?.allows_customer_cash_out ?? false,
    });
  }

  const liveSessions = new Map<string, DrawerLiveSession>();
  for (const s of sessions) {
    liveSessions.set(s.cash_drawer_id, { id: s.id, status: s.status as DrawerLiveSession['status'] });
  }

  const requiresSession = new Map<string, boolean>();
  await Promise.all(
    locked.map(async (d) => {
      const settings = await getCashControlSettings({
        tenantId: ctx.tenantOrgId,
        branchId: d.branch_id,
        userId: ctx.userId,
        drawerId: d.id,
      });
      requiresSession.set(d.id, settings.requiresSession);
    }),
  );

  return { profiles, liveSessions, requiresSession };
}

/** Writes the drawer stamp on one line; `requireDraft` guards the posting path. */
async function writeStampTx(
  tx: Prisma.TransactionClient,
  ctx: CashGateContext,
  lineId: string,
  stamp: {
    effect: string;
    drawerId: string | null;
    seq: bigint | null;
    sessionId: string | null;
    recognized: boolean;
  },
  requireDraft: boolean,
): Promise<void> {
  const updated = await tx.$executeRaw(Prisma.sql`
    UPDATE org_fin_voucher_trx_lines_dtl
       SET cash_effect_code       = ${stamp.effect},
           cash_drawer_id         = ${stamp.drawerId}::uuid,
           cash_ledger_seq        = ${stamp.seq},
           cash_recognized_at     = CASE WHEN ${stamp.recognized} THEN clock_timestamp() ELSE NULL END,
           cash_recognized_by     = CASE WHEN ${stamp.recognized} THEN ${ctx.userId} ELSE NULL END,
           cash_drawer_session_id = ${stamp.sessionId}::uuid,
           updated_at             = CURRENT_TIMESTAMP,
           updated_by             = ${ctx.userId}
     WHERE id = ${lineId}::uuid
       AND tenant_org_id = ${ctx.tenantOrgId}::uuid
       AND (${!requireDraft} OR line_status = 'DRAFT')
  `);
  if (updated !== 1) {
    throw new Error(`cash-drawer gate: voucher line ${lineId} not found or not in the expected state`);
  }
}

/**
 * Stamps every cash line of a voucher that is about to be posted. Must run in
 * the posting transaction, while the lines are still DRAFT (the posted-line
 * immutability trigger forbids stamping later). Non-cash lines are untouched.
 * Mutates the in-memory lines (`cash_drawer_session_id`, `cash_drawer_id`) so
 * wiring handlers that run afterwards see the decided session.
 * @param tx open Prisma transaction (the voucher posting transaction)
 * @param ctx tenant, acting user and gate mode
 * @param voucher header fallbacks for branch and currency
 * @param lines the voucher's lines (any roles; non-cash lines are ignored)
 * @returns the decision per stamped line id
 * @throws CashDrawerLedgerError when any cash line is refused — the caller's
 *         transaction must roll back
 * @example
 *   await stampCashLinesTx(tx, { tenantOrgId, userId, mode: 'INTERACTIVE' },
 *     { id: voucherId, branchId, currencyCode: 'OMR' }, lines);
 */
export async function stampCashLinesTx(
  tx: Prisma.TransactionClient,
  ctx: CashGateContext,
  voucher: CashGateVoucher,
  lines: CashGateLine[],
): Promise<Map<string, CashLineDecision>> {
  const decisions = new Map<string, CashLineDecision>();
  const cashLines = lines.filter(isCashLine).sort((a, b) => a.line_no - b.line_no);
  if (cashLines.length === 0) return decisions;

  const [requiresCashDrawer, drawerIdByLine] = await Promise.all([
    resolveRequiresCashDrawer(tx, ctx.tenantOrgId, cashLines),
    resolveDrawerIds(tx, ctx.tenantOrgId, cashLines),
  ]);

  const isCompleted = (line: CashGateLine) => isCompletedPaymentStatus(resolvePaymentStatus(line));

  // Only completed, drawer-tracked cash needs the drawer facts (and its lock).
  const drawerIdsToLock = cashLines
    .filter((l) => requiresCashDrawer.get(l.id) && isCompleted(l))
    .map((l) => drawerIdByLine.get(l.id))
    .filter((v): v is string => !!v);
  const facts = await loadDrawerFacts(tx, ctx, drawerIdsToLock);

  for (const line of cashLines) {
    const drawerId = drawerIdByLine.get(line.id) ?? null;
    const drawer = drawerId ? facts.profiles.get(drawerId) ?? null : null;
    const decision = decideCashLine({
      line: {
        direction: line.direction,
        paymentMethodCode: line.payment_method_code,
        requiresCashDrawer: requiresCashDrawer.get(line.id) ?? true,
        isCompleted: isCompleted(line),
        currencyCode: line.currency_code ?? voucher.currencyCode,
        branchId: line.branch_id ?? voucher.branchId,
      },
      drawer,
      liveSession: drawerId ? facts.liveSessions.get(drawerId) ?? null : null,
      requiresSession: drawerId ? facts.requiresSession.get(drawerId) ?? true : true,
      mode: ctx.mode,
    });
    if (decision.error) {
      throw new CashDrawerLedgerError(decision.error, `Cash line ${line.id} refused: ${decision.error}`, {
        voucherId: voucher.id,
        lineId: line.id,
        drawerId,
      });
    }
    decisions.set(line.id, decision);
  }

  // Allocate sequences per drawer in line order, then write every stamp.
  const drawerLines = new Map<string, CashGateLine[]>();
  for (const line of cashLines) {
    if (decisions.get(line.id)?.effect !== CASH_EFFECTS.DRAWER) continue;
    const drawerId = drawerIdByLine.get(line.id) as string;
    drawerLines.set(drawerId, [...(drawerLines.get(drawerId) ?? []), line]);
  }
  const seqByLine = new Map<string, bigint>();
  for (const [drawerId, group] of [...drawerLines.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const first = await allocateLedgerSeqTx(tx, ctx.tenantOrgId, drawerId, group.length);
    group.forEach((line, i) => seqByLine.set(line.id, first + BigInt(i)));
  }

  for (const line of cashLines) {
    const decision = decisions.get(line.id) as CashLineDecision;
    const hintSessionId = line.cash_drawer_session_id;
    const isDrawer = decision.effect === CASH_EFFECTS.DRAWER;
    const drawerId = decision.effect === CASH_EFFECTS.UNTRACKED ? null : drawerIdByLine.get(line.id) ?? null;

    await writeStampTx(
      tx,
      ctx,
      line.id,
      {
        effect: decision.effect as string,
        drawerId,
        seq: isDrawer ? seqByLine.get(line.id) ?? null : null,
        sessionId: isDrawer ? decision.sessionId : null,
        recognized: isDrawer,
      },
      true,
    );

    line.cash_drawer_id = drawerId;
    line.cash_drawer_session_id = isDrawer ? decision.sessionId : null;

    if (isDrawer && hintSessionId && hintSessionId !== decision.sessionId) {
      await emitEventTx(tx, ctx.tenantOrgId, OUTBOX_EVENT_TYPES.CASH_FACT_REDIRECTED, 'fin_voucher_line', line.id, {
        voucher_id: voucher.id,
        line_id: line.id,
        drawer_id: drawerId,
        requested_session_id: hintSessionId,
        applied_session_id: decision.sessionId,
        mode: ctx.mode,
      });
    }
  }

  return decisions;
}

/**
 * Recognises a PENDING cash line in the drawer ledger — the moment the money is
 * actually received (B30 VERIFY). Runs on a POSTED line; the immutability
 * trigger allows exactly this one-time PENDING → DRAWER transition.
 * @param tx open Prisma transaction
 * @param ctx tenant, acting user and mode (DEFERRED for back-office verification)
 * @param lineId the voucher line to recognise
 * @param drawerIdOverride another active drawer in the same branch, when the
 *        intended drawer can no longer take the cash (e.g. deactivated)
 * @returns the decision applied
 * @throws CashDrawerLedgerError when the line cannot be recognised
 * @example await recognizeCashLineTx(tx, { tenantOrgId, userId, mode: 'DEFERRED' }, lineId);
 */
export async function recognizeCashLineTx(
  tx: Prisma.TransactionClient,
  ctx: CashGateContext,
  lineId: string,
  drawerIdOverride?: string | null,
): Promise<CashLineDecision> {
  const line = await tx.org_fin_voucher_trx_lines_dtl.findFirst({
    where: { id: lineId, tenant_org_id: ctx.tenantOrgId },
    select: {
      id: true,
      voucher_id: true,
      line_status: true,
      direction: true,
      payment_method_code: true,
      currency_code: true,
      branch_id: true,
      cash_effect_code: true,
      cash_drawer_id: true,
      org_payment_method_id: true,
    },
  });
  if (!line) {
    throw new Error(`cash-drawer gate: voucher line ${lineId} not found`);
  }
  if (line.cash_effect_code !== CASH_EFFECTS.PENDING) {
    // Already recognised (idempotent replay) or not a pending cash leg — nothing to do.
    return { effect: (line.cash_effect_code as CashLineDecision['effect']) ?? null, sessionId: null, error: null };
  }

  const header = await tx.org_fin_vouchers_mst.findFirst({
    where: { id: line.voucher_id, tenant_org_id: ctx.tenantOrgId },
    select: { branch_id: true, currency_code: true },
  });

  const drawerId = drawerIdOverride ?? line.cash_drawer_id;
  const facts = await loadDrawerFacts(tx, ctx, drawerId ? [drawerId] : []);
  const decision = decideCashLine({
    line: {
      direction: line.direction,
      paymentMethodCode: line.payment_method_code,
      requiresCashDrawer: true,
      isCompleted: true,
      currencyCode: line.currency_code ?? header?.currency_code ?? null,
      branchId: line.branch_id ?? header?.branch_id ?? null,
    },
    drawer: drawerId ? facts.profiles.get(drawerId) ?? null : null,
    liveSession: drawerId ? facts.liveSessions.get(drawerId) ?? null : null,
    requiresSession: drawerId ? facts.requiresSession.get(drawerId) ?? true : true,
    mode: ctx.mode,
  });
  if (decision.error) {
    throw new CashDrawerLedgerError(decision.error, `Cash line ${lineId} cannot be recognised: ${decision.error}`, {
      lineId,
      drawerId,
    });
  }

  const seq = await allocateLedgerSeqTx(tx, ctx.tenantOrgId, drawerId as string);
  await writeStampTx(
    tx,
    ctx,
    lineId,
    { effect: CASH_EFFECTS.DRAWER, drawerId, seq, sessionId: decision.sessionId, recognized: true },
    false,
  );
  return decision;
}

/**
 * Marks a PENDING cash line as never completed (CANCEL / FAIL of a pending leg).
 * @param tx open Prisma transaction
 * @param ctx tenant and acting user
 * @param lineId the voucher line
 */
export async function abandonPendingCashLineTx(
  tx: Prisma.TransactionClient,
  ctx: CashGateContext,
  lineId: string,
): Promise<void> {
  await tx.$executeRaw(Prisma.sql`
    UPDATE org_fin_voucher_trx_lines_dtl
       SET cash_effect_code = ${CASH_EFFECTS.NONE},
           updated_at = CURRENT_TIMESTAMP,
           updated_by = ${ctx.userId}
     WHERE id = ${lineId}::uuid
       AND tenant_org_id = ${ctx.tenantOrgId}::uuid
       AND cash_effect_code = ${CASH_EFFECTS.PENDING}
  `);
}

export { CASH_LEDGER_ERRORS };

/**
 * Shared fixtures for the cash-drawer DB-integration suites (CLF R3).
 *
 * The retired single-step `openSession`/`closeSession` (cash-drawer.service) is gone;
 * every suite now drives the real two-step lifecycle in `cash-drawer-session.service`
 * (open -> count step -> finalize), so what these tests prove is the production path.
 *
 * Local DB only — never remote (standing constraint for this program).
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import {
  openSession,
  startClose,
  finalizeClose,
  type OpenSessionResult,
} from '@/lib/services/cash-drawer-session.service';
import { CASH_DRAWER_DISPOSITIONS } from '@/lib/constants/cash-drawer';
import { stampCashLinesTx } from '@/lib/services/cash-drawer-ledger/cash-drawer-ledger-gate';
import type { VoucherLineForWiring } from '@/lib/types/voucher-wiring';

export interface DbTestScope {
  tenantId: string;
  branchId: string;
}

/** First tenant + an active branch of it, or null when no DB is reachable / seeded. */
export async function resolveTestScope(): Promise<DbTestScope | null> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const tenants = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst ORDER BY created_at LIMIT 1`;
    const tenantId = tenants[0]?.id ?? '';
    if (!tenantId) return null;
    const branches = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_branches_mst WHERE tenant_org_id = ${tenantId}::uuid AND is_active LIMIT 1`;
    const branchId = branches[0]?.id ?? '';
    return branchId ? { tenantId, branchId } : null;
  } catch {
    return null;
  }
}

export async function createTestDrawer(
  scope: DbTestScope,
  opts: { codePrefix: string; name: string; type?: 'TEMPORARY' | 'SAFE'; currency?: string },
): Promise<string> {
  const drawer = await prisma.org_cash_drawers_mst.create({
    data: {
      tenant_org_id: scope.tenantId,
      branch_id: scope.branchId,
      drawer_code: `${opts.codePrefix}-${randomUUID().slice(0, 8)}`,
      drawer_name: opts.name,
      drawer_type: opts.type ?? 'TEMPORARY',
      currency_code: opts.currency ?? 'OMR',
      is_active: true,
      rec_status: 1,
    },
  });
  return drawer.id;
}

export function openTestSession(scope: DbTestScope, actor: string, drawerId: string): Promise<OpenSessionResult> {
  return openSession(scope.tenantId, actor, { drawerId });
}

/**
 * Closes a session through the real two-step flow: count step with `countedAmount`
 * (TOTAL_ONLY), then finalize leaving the cash in the drawer. Returns the finalize result.
 */
export async function closeTestSession(
  scope: DbTestScope,
  actor: string,
  drawerId: string,
  sessionId: string,
  opts: { countedAmount: number | string; currencyCode?: string },
) {
  await startClose(scope.tenantId, actor, {
    sessionId,
    drawerId,
    closingCount: { countMode: 'TOTAL_ONLY', totalAmount: opts.countedAmount },
  });
  return finalizeClose(scope.tenantId, actor, {
    sessionId,
    drawerId,
    dispositions: [
      { currencyCode: opts.currencyCode ?? 'OMR', dispositionCode: CASH_DRAWER_DISPOSITIONS.LEFT_IN_DRAWER },
    ],
  });
}

export interface StampedTestLine {
  voucherId: string;
  lineId: string;
}

/**
 * Creates one voucher with one completed CASH line and runs it through the production ledger
 * gate (`stampCashLinesTx`) — so the stamp (drawer, session, sequence) is exactly what a real
 * posting would get. The voucher is tied to the drawer (`source_ref_id`) so
 * {@link cleanupTestDrawers} removes it. Rejects with the gate's `CashDrawerLedgerError`
 * when the gate refuses.
 */
export async function stampTestCashLine(
  scope: DbTestScope,
  opts: {
    drawerId: string;
    amount: number | string;
    mode: 'INTERACTIVE' | 'DEFERRED';
    direction?: 'IN' | 'OUT';
    currency?: string;
    sessionHint?: string | null;
  },
): Promise<StampedTestLine> {
  const direction = opts.direction ?? 'IN';
  const currency = opts.currency ?? 'OMR';
  const voucher = await prisma.org_fin_vouchers_mst.create({
    data: {
      tenant_org_id: scope.tenantId,
      voucher_no: `CLF-TEST-${randomUUID().slice(0, 12)}`,
      voucher_category: direction === 'OUT' ? 'CASH_OUT' : 'CASH_IN',
      total_amount: opts.amount,
      branch_id: scope.branchId,
      currency_code: currency,
      source_ref_id: opts.drawerId,
    },
  });
  const line = await prisma.org_fin_voucher_trx_lines_dtl.create({
    data: {
      tenant_org_id: scope.tenantId,
      voucher_id: voucher.id,
      line_no: 1,
      line_type: 'RECEIPT',
      line_role: 'ORDER_PAYMENT',
      direction,
      amount: opts.amount,
      payment_method_code: 'CASH',
      payment_status: 'COMPLETED',
      currency_code: currency,
      branch_id: scope.branchId,
      cash_drawer_session_id: opts.sessionHint ?? null,
    },
  });
  await prisma.$transaction((tx) =>
    stampCashLinesTx(
      tx,
      { tenantOrgId: scope.tenantId, userId: 'clf-matrix-test', mode: opts.mode },
      { id: voucher.id, branchId: scope.branchId, currencyCode: currency },
      [{ ...(line as unknown as VoucherLineForWiring), cash_drawer_id: opts.drawerId }],
    ),
  );
  return { voucherId: voucher.id, lineId: line.id };
}

/** The ledger stamp of a line written by {@link stampTestCashLine}. */
export async function readLineStamp(scope: DbTestScope, lineId: string) {
  const row = await prisma.org_fin_voucher_trx_lines_dtl.findFirstOrThrow({
    where: { id: lineId, tenant_org_id: scope.tenantId },
    select: { cash_effect_code: true, cash_drawer_id: true, cash_ledger_seq: true, cash_drawer_session_id: true },
  });
  return { ...row, seq: row.cash_ledger_seq == null ? null : Number(row.cash_ledger_seq) };
}

/**
 * Test cleanup, not a migration — but the same documented maintenance bypass applies
 * (`SET LOCAL cmx.allow_ledger_edit = 'on'`): counts, closed balance rows, post
 * transactions and custody lines are immutable by design, and `SET LOCAL` only lasts for
 * the current transaction, so every delete runs inside one `$transaction`.
 */
export async function cleanupTestDrawers(scope: DbTestScope, drawerIds: string[]): Promise<void> {
  if (drawerIds.length === 0) return;
  const { tenantId } = scope;

  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL cmx.allow_ledger_edit = 'on'`);
    await tx.$executeRawUnsafe(`SET LOCAL cmx.allow_posted_line_edit = 'on'`);

    const vouchers = await tx.org_fin_vouchers_mst.findMany({
      where: { source_ref_id: { in: drawerIds }, tenant_org_id: tenantId },
      select: { id: true },
    });
    const voucherIds = vouchers.map((v) => v.id);
    if (voucherIds.length > 0) {
      await tx.org_fin_voucher_trx_lines_dtl.deleteMany({ where: { voucher_id: { in: voucherIds }, tenant_org_id: tenantId } });
      await tx.org_fin_vouchers_mst.deleteMany({ where: { id: { in: voucherIds }, tenant_org_id: tenantId } });
    }

    const sessions = await tx.org_cash_drawer_sessions_mst.findMany({
      where: { cash_drawer_id: { in: drawerIds }, tenant_org_id: tenantId },
      select: { id: true },
    });
    const sessionIds = sessions.map((s) => s.id);
    if (sessionIds.length > 0) {
      await tx.org_cash_drawer_ses_post_tr.deleteMany({ where: { cash_drawer_session_id: { in: sessionIds }, tenant_org_id: tenantId } });
      await tx.org_cash_drawer_ses_bal_dtl.deleteMany({ where: { cash_drawer_session_id: { in: sessionIds }, tenant_org_id: tenantId } });
    }

    const counts = await tx.org_cash_drawer_cnt_mst.findMany({
      where: { cash_drawer_id: { in: drawerIds }, tenant_org_id: tenantId },
      select: { id: true },
    });
    const countIds = counts.map((c) => c.id);
    if (countIds.length > 0) {
      await tx.org_cash_drawer_cnt_denom_dtl.deleteMany({ where: { count_id: { in: countIds }, tenant_org_id: tenantId } });
      await tx.org_cash_drawer_cnt_mst.deleteMany({ where: { id: { in: countIds }, tenant_org_id: tenantId } });
    }

    const trxLines = await tx.org_cash_drawer_trx_dtl.findMany({
      where: { cash_drawer_id: { in: drawerIds }, tenant_org_id: tenantId },
      select: { trx_id: true },
    });
    const trxIds = [...new Set(trxLines.map((l) => l.trx_id))];
    if (trxIds.length > 0) {
      await tx.org_cash_drawer_trx_dtl.deleteMany({ where: { trx_id: { in: trxIds }, tenant_org_id: tenantId } });
      await tx.org_cash_drawer_trx_mst.deleteMany({ where: { id: { in: trxIds }, tenant_org_id: tenantId } });
    }
    await tx.org_cash_drawer_sessions_mst.deleteMany({ where: { cash_drawer_id: { in: drawerIds }, tenant_org_id: tenantId } });
    await tx.org_cash_drawers_mst.deleteMany({ where: { id: { in: drawerIds }, tenant_org_id: tenantId } });
  });
}

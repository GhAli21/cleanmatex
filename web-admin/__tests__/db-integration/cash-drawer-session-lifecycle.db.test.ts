/**
 * CLF-R2 (POS Session & Cash Drawer Hardening) — real-DB proof of the
 * two-step session lifecycle (CLF-4-3): open -> count step -> finalize,
 * exercising `cash-drawer-session.service.ts` together with the real
 * cash-drawer ledger gate (via `postDrawerCashMovement`, CLF W11's own
 * production write path) so this test proves the whole chain, not just the
 * new code in isolation.
 *
 * Local DB only — never remote (standing constraint for this program).
 * Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { openSession, startClose, finalizeClose } from '@/lib/services/cash-drawer-session.service';
import { postDrawerCashMovement } from '@/lib/services/cash-drawer-movement-posting.service';
import { LINE_ROLE } from '@/lib/constants/voucher';
import { CASH_DRAWER_DISPOSITIONS } from '@/lib/constants/cash-drawer';
import { cleanupTestDrawers } from './helpers/cash-drawer-fixtures';

const DRAWER_CODE_PREFIX = 'CLF-R2-LIFECYCLE';

let dbUp = false;
let tenantId = '';
let branchId = '';

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const tenants = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst ORDER BY created_at LIMIT 1`;
    tenantId = tenants[0]?.id ?? '';

    if (tenantId) {
      const branches = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public.org_branches_mst WHERE tenant_org_id = ${tenantId}::uuid LIMIT 1`;
      branchId = branches[0]?.id ?? '';
    }

    dbUp = tenantId.length > 0 && branchId.length > 0;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

async function makeDrawer(): Promise<string> {
  const drawer = await prisma.org_cash_drawers_mst.create({
    data: {
      tenant_org_id: tenantId,
      branch_id: branchId,
      drawer_code: `${DRAWER_CODE_PREFIX}-${randomUUID().slice(0, 8)}`,
      drawer_name: 'CLF-R2 lifecycle test drawer',
      drawer_type: 'TEMPORARY',
      currency_code: 'OMR',
      is_active: true,
      rec_status: 1,
    },
  });
  // This suite closes with a bare total; the default closing policy requires denominations (C1-1c).
  await prisma.org_fin_cash_ctrl_stng_cf.create({
    data: { tenant_org_id: tenantId, scope_level: 'DRAWER', scope_id: drawer.id, closing_count_mode: 'OPTIONAL_DENOMINATION' },
  });
  return drawer.id;
}

const cleanupDrawer = (drawerId: string, extraDrawerIds: string[] = []) =>
  cleanupTestDrawers({ tenantId, branchId }, [drawerId, ...extraDrawerIds]);

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[cash-drawer-session-lifecycle] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

describe('cash-drawer-session.service — two-step close lifecycle (CLF-4-3)', () => {
  dbit('open (brand-new drawer, no history) -> real cash-in through the gate -> count step -> finalize LEFT_IN_DRAWER', async () => {
    const actor = randomUUID();
    const drawerId = await makeDrawer();
    try {
      // 1. Open — a brand-new drawer has no prior session and no between-
      // session activity, so opening_expected must be exactly 0.
      const opened = await openSession(tenantId, actor, { drawerId });
      expect(opened.currencyBalances).toHaveLength(1);
      expect(opened.currencyBalances[0].currencyCode).toBe('OMR');
      expect(opened.currencyBalances[0].openingExpected).toBe('0.0000');

      const openedSession = await prisma.org_cash_drawer_sessions_mst.findFirstOrThrow({ where: { id: opened.sessionId, tenant_org_id: tenantId } });
      expect(openedSession.status).toBe('OPEN');
      expect(openedSession.open_ledger_seq).toBe(BigInt(0));

      // 2. A real cash-in through the production W11 write path (voucher +
      // ledger gate) — not a synthetic DB row — so this proves the gate and
      // the session's own ledger-window math agree on the same drawer.
      const movement = await postDrawerCashMovement(tenantId, actor, {
        drawerId,
        cashDrawerSessionId: opened.sessionId,
        lineRole: LINE_ROLE.CASH_PAY_IN,
        amount: 25.5,
        reason: 'CLF-R2 lifecycle test cash-in',
        idempotencyKey: `clf-r2-lifecycle-${randomUUID()}`,
      });
      expect(movement.voucherId).toBeTruthy();

      const drawerAfterCashIn = await prisma.org_cash_drawers_mst.findFirstOrThrow({ where: { id: drawerId, tenant_org_id: tenantId } });
      expect(drawerAfterCashIn.ledger_seq).toBe(BigInt(1));

      // 3. Count step — closing expected must equal opening (0) + the 25.5 cash-in.
      const started = await startClose(tenantId, actor, {
        sessionId: opened.sessionId,
        drawerId,
        closingCount: { countMode: 'TOTAL_ONLY', totalAmount: 25.5 },
      });
      expect(started.currencyBalances).toHaveLength(1);
      const closingRow = started.currencyBalances[0];
      expect(closingRow.closingExpected).toBe('25.5000');
      expect(closingRow.closingCounted).toBe('25.5000');
      expect(closingRow.closingVariance).toBe('0.0000');

      const closingSession = await prisma.org_cash_drawer_sessions_mst.findFirstOrThrow({ where: { id: opened.sessionId, tenant_org_id: tenantId } });
      expect(closingSession.status).toBe('CLOSING');
      expect(closingSession.close_ledger_seq).toBe(BigInt(1));

      // 4. Finalize — LEFT_IN_DRAWER (cash_move_mode NONE): no custody
      // transaction should be posted, and the balance row's disposition
      // carries the full closing basis as "kept".
      const finalized = await finalizeClose(tenantId, actor, {
        sessionId: opened.sessionId,
        drawerId,
        dispositions: [{ currencyCode: 'OMR', dispositionCode: CASH_DRAWER_DISPOSITIONS.LEFT_IN_DRAWER }],
      });
      expect(finalized.status).toBe('CLOSED');
      expect(finalized.varianceApprovalPending).toBe(false);
      expect(finalized.dispositionTrxId).toBeNull();

      const closedSession = await prisma.org_cash_drawer_sessions_mst.findFirstOrThrow({ where: { id: opened.sessionId, tenant_org_id: tenantId } });
      expect(closedSession.status).toBe('CLOSED');
      expect(closedSession.closed_by).toBe(actor);

      const balRow = await prisma.org_cash_drawer_ses_bal_dtl.findFirstOrThrow({
        where: { cash_drawer_session_id: opened.sessionId, currency_code: 'OMR', tenant_org_id: tenantId },
      });
      expect(balRow.disposition_code).toBe('LEFT_IN_DRAWER');
      // disposition_kept_amount is PARTIAL_REMOVED-only by design (migration
      // comment) — NONE-mode dispositions carry the kept amount implicitly
      // via closing_basis instead, which the chain assertion below proves.
      expect(balRow.disposition_kept_amount).toBeNull();
      expect(balRow.disposition_trx_id).toBeNull();

      // 5. A second session on the same drawer must chain its opening off
      // what this one left behind (P5/the "chain") — proves closing_basis,
      // not disposition_kept_amount, is what the chain actually reads.
      const reopened = await openSession(tenantId, actor, { drawerId });
      expect(reopened.currencyBalances[0].openingExpected).toBe('25.5000');
    } finally {
      await cleanupDrawer(drawerId);
    }
  });

  dbit('finalize MOVED_TO_SAFE posts a balanced CLOSE_DISPOSITION custody transaction', async () => {
    const actor = randomUUID();
    const drawerId = await makeDrawer();
    let safeDrawerId: string | undefined;
    try {
      const safe = await prisma.org_cash_drawers_mst.create({
        data: {
          tenant_org_id: tenantId,
          branch_id: branchId,
          drawer_code: `${DRAWER_CODE_PREFIX}-SAFE-${randomUUID().slice(0, 8)}`,
          drawer_name: 'CLF-R2 lifecycle test safe',
          drawer_type: 'SAFE',
          currency_code: 'OMR',
          is_active: true,
          rec_status: 1,
        },
      });
      safeDrawerId = safe.id;

      const opened = await openSession(tenantId, actor, { drawerId });
      await postDrawerCashMovement(tenantId, actor, {
        drawerId,
        cashDrawerSessionId: opened.sessionId,
        lineRole: LINE_ROLE.CASH_PAY_IN,
        amount: 40,
        reason: 'CLF-R2 lifecycle test cash-in (safe disposition)',
        idempotencyKey: `clf-r2-lifecycle-safe-${randomUUID()}`,
      });
      await startClose(tenantId, actor, { sessionId: opened.sessionId, drawerId, closingCount: { countMode: 'TOTAL_ONLY', totalAmount: 40 } });

      const finalized = await finalizeClose(tenantId, actor, {
        sessionId: opened.sessionId,
        drawerId,
        dispositions: [{ currencyCode: 'OMR', dispositionCode: CASH_DRAWER_DISPOSITIONS.MOVED_TO_SAFE, destDrawerId: safeDrawerId }],
      });
      expect(finalized.status).toBe('CLOSED');
      expect(finalized.dispositionTrxId).toBeTruthy();

      const trxLines = await prisma.org_cash_drawer_trx_dtl.findMany({
        where: { trx_id: finalized.dispositionTrxId as string, tenant_org_id: tenantId },
      });
      expect(trxLines).toHaveLength(2);
      const outLine = trxLines.find((l) => l.cash_drawer_id === drawerId);
      const inLine = trxLines.find((l) => l.cash_drawer_id === safeDrawerId);
      expect(outLine?.direction).toBe('OUT');
      expect(inLine?.direction).toBe('IN');
      expect(Number(outLine?.amount)).toBeCloseTo(40, 4);
      expect(Number(inLine?.amount)).toBeCloseTo(40, 4);

      const balRow = await prisma.org_cash_drawer_ses_bal_dtl.findFirstOrThrow({
        where: { cash_drawer_session_id: opened.sessionId, currency_code: 'OMR', tenant_org_id: tenantId },
      });
      expect(balRow.disposition_code).toBe('MOVED_TO_SAFE');
      expect(balRow.disposition_dest_drawer_id).toBe(safeDrawerId);
      expect(balRow.disposition_kept_amount).toBeNull();

      // The safe's own ledger_seq must have advanced too — the disposition
      // moved real custody cash into it.
      const safeAfter = await prisma.org_cash_drawers_mst.findFirstOrThrow({ where: { id: safeDrawerId, tenant_org_id: tenantId } });
      expect(safeAfter.ledger_seq).toBe(BigInt(1));
    } finally {
      await cleanupDrawer(drawerId, safeDrawerId ? [safeDrawerId] : []);
    }
  });
});

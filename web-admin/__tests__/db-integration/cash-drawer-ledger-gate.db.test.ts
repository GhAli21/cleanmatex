/**
 * CLF (ADR-057) — real-database proof of the cash-drawer ledger gate.
 *
 *  - concurrent postings on one drawer get unique, consecutive ledger sequences
 *  - interactive cash is refused when the drawer requires a session and none is open
 *  - deferred cash after a close lands in the next window (no session)
 *  - a stale session hint is redirected to the drawer's open session and audited
 *  - a posted line's drawer stamp cannot be changed (DB immutability trigger)
 *
 * The full D22 proof (a payment racing a close, checked against the close's
 * exact sequence cut) lands with the two-step close in CLF-R2.
 *
 * Local DB only — never remote. Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { openSession, closeSession } from '@/lib/services/cash-drawer.service';
import { stampCashLinesTx } from '@/lib/services/cash-drawer-ledger/cash-drawer-ledger-gate';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';
import type { VoucherLineForWiring } from '@/lib/types/voucher-wiring';

const CODE_PREFIX = 'CLF-GATE-TEST';

let dbUp = false;
let cashTracked = false;
const createdVoucherIds: string[] = [];
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
        SELECT id FROM public.org_branches_mst WHERE tenant_org_id = ${tenantId}::uuid AND is_active LIMIT 1`;
      branchId = branches[0]?.id ?? '';
      // The gate treats CASH as drawer-tracked unless the tenant disabled it.
      const eff = await prisma.$queryRaw<Array<{ v: boolean | null }>>`
        SELECT COALESCE(
          (SELECT requires_cash_drawer FROM public.org_payment_methods_cf
            WHERE tenant_org_id = ${tenantId}::uuid AND payment_method_code = 'CASH' LIMIT 1),
          (SELECT requires_cash_drawer FROM public.sys_payment_method_cd WHERE payment_method_code = 'CASH'),
          TRUE) AS v`;
      cashTracked = eff[0]?.v === true;
    }
    dbUp = tenantId.length > 0 && branchId.length > 0 && cashTracked;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[cash-drawer-ledger-gate] DB unavailable or CASH not drawer-tracked — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

async function makeDrawer(): Promise<string> {
  const drawer = await prisma.org_cash_drawers_mst.create({
    data: {
      tenant_org_id: tenantId,
      branch_id: branchId,
      drawer_code: `${CODE_PREFIX}-${randomUUID().slice(0, 8)}`,
      drawer_name: 'CLF gate test drawer',
      drawer_type: 'TEMPORARY',
      currency_code: 'OMR',
      is_active: true,
      rec_status: 1,
    },
  });
  return drawer.id;
}

/** One DRAFT voucher with one completed CASH line; returns the line as the gate receives it. */
async function makeCashLine(opts: { direction?: 'IN' | 'OUT'; sessionHint?: string | null }): Promise<VoucherLineForWiring> {
  const voucher = await prisma.org_fin_vouchers_mst.create({
    data: {
      tenant_org_id: tenantId,
      voucher_no: `${CODE_PREFIX}-${randomUUID().slice(0, 12)}`,
      voucher_category: opts.direction === 'OUT' ? 'CASH_OUT' : 'CASH_IN',
      total_amount: 1.5,
      branch_id: branchId,
      currency_code: 'OMR',
    },
  });
  createdVoucherIds.push(voucher.id);
  const line = await prisma.org_fin_voucher_trx_lines_dtl.create({
    data: {
      tenant_org_id: tenantId,
      voucher_id: voucher.id,
      line_no: 1,
      line_type: 'RECEIPT',
      line_role: 'ORDER_PAYMENT',
      direction: opts.direction ?? 'IN',
      amount: 1.5,
      payment_method_code: 'CASH',
      payment_status: 'COMPLETED',
      currency_code: 'OMR',
      branch_id: branchId,
      cash_drawer_session_id: opts.sessionHint ?? null,
    },
  });
  return line as unknown as VoucherLineForWiring;
}

async function stamp(
  line: VoucherLineForWiring & { cash_drawer_id?: string | null },
  mode: 'INTERACTIVE' | 'DEFERRED',
): Promise<void> {
  await prisma.$transaction((tx) =>
    stampCashLinesTx(
      tx,
      { tenantOrgId: tenantId, userId: 'clf-gate-test', mode },
      { id: line.voucher_id, branchId, currencyCode: 'OMR' },
      [line],
    ),
  );
}

async function readLine(id: string) {
  return prisma.org_fin_voucher_trx_lines_dtl.findFirstOrThrow({
    where: { id, tenant_org_id: tenantId },
    select: {
      cash_effect_code: true,
      cash_drawer_id: true,
      cash_ledger_seq: true,
      cash_drawer_session_id: true,
      cash_recognized_at: true,
    },
  });
}

async function cleanup(drawerId: string): Promise<void> {
  const voucherIds = createdVoucherIds.splice(0);
  const lines = await prisma.org_fin_voucher_trx_lines_dtl.findMany({
    where: { tenant_org_id: tenantId, voucher_id: { in: voucherIds } },
    select: { id: true },
  });
  await prisma.org_domain_events_outbox
    .deleteMany({ where: { tenant_org_id: tenantId, aggregate_id: { in: lines.map((l) => l.id) } } })
    .catch(() => {});
  await prisma.org_fin_voucher_trx_lines_dtl
    .deleteMany({ where: { tenant_org_id: tenantId, voucher_id: { in: voucherIds } } })
    .catch(() => {});
  await prisma.org_fin_vouchers_mst.deleteMany({ where: { tenant_org_id: tenantId, id: { in: voucherIds } } }).catch(() => {});
  await prisma.org_cash_drawer_sessions_mst.deleteMany({ where: { tenant_org_id: tenantId, cash_drawer_id: drawerId } }).catch(() => {});
  await prisma.org_cash_drawers_mst.deleteMany({ where: { tenant_org_id: tenantId, id: drawerId } }).catch(() => {});
}

describe('cash-drawer ledger gate — real database (CLF R1)', () => {
  dbit('concurrent postings on one drawer get unique, consecutive ledger sequences in the open session', async () => {
    const drawerId = await makeDrawer();
    try {
      const session = await openSession(tenantId, drawerId, { openingBalance: 0, openedBy: randomUUID() });
      const lines = await Promise.all(Array.from({ length: 8 }, () => makeCashLine({})));
      await Promise.all(lines.map((l) => stamp({ ...l, cash_drawer_id: drawerId }, 'INTERACTIVE')));

      const stamped = await Promise.all(lines.map((l) => readLine(l.id)));
      const seqs = stamped.map((s) => Number(s.cash_ledger_seq)).sort((a, b) => a - b);
      expect(new Set(seqs).size).toBe(8);
      expect(seqs[7] - seqs[0]).toBe(7);
      for (const s of stamped) {
        expect(s.cash_effect_code).toBe('DRAWER');
        expect(s.cash_drawer_session_id).toBe(session.id);
        expect(s.cash_recognized_at).not.toBeNull();
      }
      const drawer = await prisma.org_cash_drawers_mst.findFirstOrThrow({
        where: { id: drawerId, tenant_org_id: tenantId },
        select: { ledger_seq: true },
      });
      expect(Number(drawer.ledger_seq)).toBe(seqs[7]);
    } finally {
      await cleanup(drawerId);
    }
  });

  dbit('refuses interactive cash when the drawer requires a session and none is open', async () => {
    const drawerId = await makeDrawer();
    try {
      const line = await makeCashLine({});
      await expect(stamp({ ...line, cash_drawer_id: drawerId }, 'INTERACTIVE')).rejects.toMatchObject({
        code: 'CASH_DRAWER_SESSION_NOT_OPEN',
      });
      await expect(stamp({ ...line, cash_drawer_id: drawerId }, 'INTERACTIVE')).rejects.toBeInstanceOf(
        CashDrawerLedgerError,
      );
      const after = await readLine(line.id);
      expect(after.cash_effect_code).toBeNull();
    } finally {
      await cleanup(drawerId);
    }
  });

  dbit('deferred cash after the session closed lands in the next window (no session)', async () => {
    const drawerId = await makeDrawer();
    try {
      const actor = randomUUID();
      const session = await openSession(tenantId, drawerId, { openingBalance: 0, openedBy: actor });
      await closeSession(tenantId, session.id, { physicalCount: 0, closedBy: actor });

      const line = await makeCashLine({ sessionHint: session.id });
      await stamp(line, 'DEFERRED');

      const after = await readLine(line.id);
      expect(after.cash_effect_code).toBe('DRAWER');
      expect(after.cash_drawer_id).toBe(drawerId);
      expect(after.cash_drawer_session_id).toBeNull();
    } finally {
      await cleanup(drawerId);
    }
  });

  dbit('redirects a stale session hint to the drawer\'s open session and records the redirect', async () => {
    const drawerId = await makeDrawer();
    try {
      const actor = randomUUID();
      const old = await openSession(tenantId, drawerId, { openingBalance: 0, openedBy: actor });
      await closeSession(tenantId, old.id, { physicalCount: 0, closedBy: actor });
      const current = await openSession(tenantId, drawerId, { openingBalance: 0, openedBy: actor });

      const line = await makeCashLine({ sessionHint: old.id });
      await stamp(line, 'INTERACTIVE');

      const after = await readLine(line.id);
      expect(after.cash_drawer_session_id).toBe(current.id);
      const events = await prisma.org_domain_events_outbox.findMany({
        where: { tenant_org_id: tenantId, event_type: 'CASH_FACT_REDIRECTED', aggregate_id: line.id },
      });
      expect(events).toHaveLength(1);
    } finally {
      await cleanup(drawerId);
    }
  });

  dbit('a posted line\'s drawer stamp cannot be changed (CASH_LINE_IMMUTABLE)', async () => {
    const drawerId = await makeDrawer();
    try {
      await openSession(tenantId, drawerId, { openingBalance: 0, openedBy: randomUUID() });
      const line = await makeCashLine({});
      await stamp({ ...line, cash_drawer_id: drawerId }, 'INTERACTIVE');
      await prisma.org_fin_voucher_trx_lines_dtl.updateMany({
        where: { id: line.id, tenant_org_id: tenantId },
        data: { line_status: 'POSTED' },
      });

      await expect(
        prisma.org_fin_voucher_trx_lines_dtl.updateMany({
          where: { id: line.id, tenant_org_id: tenantId },
          data: { cash_drawer_session_id: null },
        }),
      ).rejects.toThrow(/CASH_LINE_IMMUTABLE/);
      await expect(
        prisma.org_fin_voucher_trx_lines_dtl.updateMany({
          where: { id: line.id, tenant_org_id: tenantId },
          data: { amount: 99 },
        }),
      ).rejects.toThrow(/CASH_LINE_IMMUTABLE/);
    } finally {
      await cleanup(drawerId);
    }
  });
});

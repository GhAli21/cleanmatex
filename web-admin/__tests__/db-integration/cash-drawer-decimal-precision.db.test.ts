/**
 * A3-5 (POS Session & Cash Drawer Hardening, Wave A) — real-DB proof that
 * `closeSession`'s Decimal-space expected-cash computation (A3-1) does not
 * drift under a long sequence of 3-decimal-currency amounts, the exact class
 * of bug the old `toNumber()` + JS `+`/`-` write path had (drift the same
 * way `0.1 + 0.2 !== 0.3` does in binary floating point).
 *
 * 500 sequential 0.0050 OMR cash payments must sum to EXACTLY 2.5000 and
 * close with zero variance — not "close enough" under the tolerance, but bit
 * -for-bit exact, proving the arithmetic itself doesn't drift.
 *
 * Local DB only — never remote (standing constraint for this program).
 * Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { openSession, closeSession } from '@/lib/services/cash-drawer.service';

const DRAWER_CODE_PREFIX = 'A3-5-TEST';
const PAYMENT_COUNT = 500;
const PAYMENT_AMOUNT = '0.005'; // OMR minor unit is 0.001 — this is 5 baisa
const EXPECTED_TOTAL = PAYMENT_COUNT * 0.005; // 2.5, exactly representable, used only for the assertion

let dbUp = false;
let tenantId = '';
let branchId = '';
let orderId = '';
let createdOrder = false;

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

      // Reuse an existing order as the FK target for the synthetic payment
      // rows below — this test exercises the drawer-close aggregation, not
      // order creation, so a real pre-existing order (any status) is enough
      // and avoids re-deriving every NOT NULL/trigger-driven order field.
      const orders = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM public.org_orders_mst WHERE tenant_org_id = ${tenantId}::uuid LIMIT 1`;
      orderId = orders[0]?.id ?? '';

      // No existing order in this tenant (fresh/empty dev DB) — create the
      // minimal row ourselves. `org_orders_mst` has exactly three required
      // columns with no default (tenant_org_id, customer_id, order_no);
      // everything else is nullable or defaulted, so this is safe to create
      // directly rather than pulling in the full order-creation pipeline.
      if (!orderId) {
        const customers = await prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM public.org_customers_mst WHERE tenant_org_id = ${tenantId}::uuid LIMIT 1`;
        const customerId = customers[0]?.id ?? '';
        if (customerId) {
          const order = await prisma.org_orders_mst.create({
            data: {
              tenant_org_id: tenantId,
              branch_id: branchId || null,
              customer_id: customerId,
              order_no: `A3-5-TEST-${randomUUID().slice(0, 8)}`,
            },
          });
          orderId = order.id;
          createdOrder = true;
        }
      }
    }

    dbUp = tenantId.length > 0 && branchId.length > 0 && orderId.length > 0;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  if (dbUp && createdOrder && orderId) {
    await prisma.org_orders_mst.deleteMany({ where: { id: orderId } }).catch(() => {});
  }
  await prisma.$disconnect();
});

async function makeDrawer(): Promise<string> {
  const drawer = await prisma.org_cash_drawers_mst.create({
    data: {
      tenant_org_id: tenantId,
      branch_id: branchId,
      drawer_code: `${DRAWER_CODE_PREFIX}-${randomUUID().slice(0, 8)}`,
      drawer_name: 'A3-5 Decimal precision test drawer',
      drawer_type: 'TEMPORARY',
      currency_code: 'OMR',
      requires_session: true,
      opening_float_required: false,
      is_active: true,
      rec_status: 1,
    },
  });
  return drawer.id;
}

async function cleanupDrawer(drawerId: string, sessionId?: string): Promise<void> {
  if (sessionId) {
    await prisma.org_order_payments_dtl
      .deleteMany({ where: { cash_drawer_session_id: sessionId } })
      .catch(() => {});
  }
  await prisma.org_cash_drawer_movements_dtl.deleteMany({ where: { cash_drawer_id: drawerId } }).catch(() => {});
  await prisma.org_cash_drawer_sessions_mst.deleteMany({ where: { cash_drawer_id: drawerId } }).catch(() => {});
  await prisma.org_cash_drawers_mst.deleteMany({ where: { id: drawerId } }).catch(() => {});
}

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[cash-drawer-decimal-precision] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

describe('closeSession Decimal-space precision under a long payment sequence (A3-5)', () => {
  dbit(
    `${PAYMENT_COUNT} sequential ${PAYMENT_AMOUNT} OMR cash payments close with EXACT zero variance`,
    async () => {
      const actor = randomUUID();
      const drawerId = await makeDrawer();
      let sessionId: string | undefined;
      try {
        const session = await openSession(tenantId, drawerId, { openingBalance: 0, openedBy: actor });
        sessionId = session.id;

        // Sequential, not batched: mirrors 500 real cash sales landing one
        // at a time over a shift, and keeps each row's own paid_at ordered.
        for (let i = 0; i < PAYMENT_COUNT; i += 1) {
          await prisma.org_order_payments_dtl.create({
            data: {
              tenant_org_id: tenantId,
              branch_id: branchId,
              order_id: orderId,
              cash_drawer_id: drawerId,
              cash_drawer_session_id: session.id,
              payment_method_code: 'CASH',
              payment_status: 'COMPLETED',
              amount: PAYMENT_AMOUNT,
              currency_code: 'OMR',
              paid_at: new Date(),
              is_active: true,
              rec_status: 1,
            },
          });
        }

        const result = await closeSession(tenantId, session.id, {
          physicalCount: EXPECTED_TOTAL,
          closedBy: actor,
        });

        expect(result.isBalanced).toBe(true);
        // A3-4 — money crosses the API as an exact fixed-point string.
        expect(result.variance).toBe('0.0000');
        expect(Number(result.session.expected_cash_amount)).toBe(EXPECTED_TOTAL);
        expect(Number(result.session.difference_amount)).toBe(0);

        // Re-read from the DB (not the in-memory result) — the persisted
        // value is what every downstream reader (reports, session detail,
        // reconciliation) sees.
        const persisted = await prisma.org_cash_drawer_sessions_mst.findFirstOrThrow({
          where: { id: session.id },
        });
        expect(Number(persisted.expected_cash_amount)).toBe(EXPECTED_TOTAL);
        expect(Number(persisted.difference_amount)).toBe(0);
      } finally {
        await cleanupDrawer(drawerId, sessionId);
      }
    },
  );
});

/**
 * D1-4 — real-DB proof of in-transit cash transfers (migration 0562): send takes cash out of the
 * source into the branch's IN_TRANSIT holder, receive credits the destination, cancel returns it to
 * the source; each leg is a balanced custody transaction, a transfer settles exactly once, the sent
 * facts are immutable, and structural mistakes are refused before any cash moves.
 *
 * Local DB only — never remote. Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db/prisma';
import { cancelTransit, listTransits, receiveTransit, sendTransit } from '@/lib/services/cash-transit.service';
import { reverseDrawerTrx } from '@/lib/services/cash-drawer-trx.service';
import { CASH_LEDGER_ERRORS } from '@/lib/constants/cash-drawer';
import {
  cleanupTestDrawers,
  createTestDrawer,
  resolveTestScope,
  type DbTestScope,
} from './helpers/cash-drawer-fixtures';

let scope: DbTestScope | null = null;
const actor = randomUUID();

beforeAll(async () => {
  scope = await resolveTestScope();
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(
    name,
    async () => {
      if (!scope) {
        console.warn(`[cash-transit] DB unavailable — skipping: ${name}`);
        return;
      }
      await fn();
    },
    120_000,
  );
}

async function withDrawers(run: (d: { source: string; dest: string; bag: string }) => Promise<void>) {
  const source = await createTestDrawer(scope!, { codePrefix: 'D14-SRC', name: 'D1-4 source' });
  const dest = await createTestDrawer(scope!, { codePrefix: 'D14-DST', name: 'D1-4 safe', type: 'SAFE' });
  const bag = await prisma.org_cash_drawers_mst
    .create({
      data: {
        tenant_org_id: scope!.tenantId,
        branch_id: scope!.branchId,
        drawer_code: `D14-BAG-${randomUUID().slice(0, 8)}`,
        drawer_name: 'D1-4 driver bag',
        drawer_type: 'DRIVER_BAG',
        currency_code: 'OMR',
        is_active: true,
        rec_status: 1,
      },
    })
    .then((d) => d.id);
  const holders: string[] = [];
  try {
    await run({ source, dest, bag });
  } finally {
    const created = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_cash_drawers_mst
      WHERE tenant_org_id = ${scope!.tenantId}::uuid AND branch_id = ${scope!.branchId}::uuid
        AND drawer_type = 'IN_TRANSIT' AND created_info = 'ensure_branch_transit_drawer'`;
    holders.push(...created.map((r) => r.id));
    // Keep the shared holder drawer (it is reused across runs); remove only the test drawers.
    await cleanupTestDrawers(scope!, [source, dest, bag]);
  }
}

const legLines = (trxNo: string) =>
  prisma.$queryRaw<Array<{ drawer_id: string; direction: string; amount: string }>>`
    SELECT l.cash_drawer_id AS drawer_id, l.direction, l.amount::text AS amount
    FROM public.org_cash_drawer_trx_dtl l
    JOIN public.org_cash_drawer_trx_mst m ON m.id = l.trx_id AND m.tenant_org_id = l.tenant_org_id
    WHERE m.tenant_org_id = ${scope!.tenantId}::uuid AND m.trx_no = ${trxNo}
    ORDER BY l.line_no`;

const readTransit = async (id: string) =>
  (
    await prisma.$queryRaw<
      Array<{ status: string; transit_drawer_id: string; received_by: string | null; cancelled_by: string | null; cancel_reason: string | null }>
    >`SELECT status, transit_drawer_id, received_by, cancelled_by, cancel_reason
      FROM public.org_cash_drawer_transit_tr WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id = ${id}::uuid`
  )[0];

describe('in-transit cash transfers (D1-4)', () => {
  dbit('send then receive: two balanced legs through the holder, settled exactly once', async () => {
    await withDrawers(async ({ source, dest }) => {
      const key = randomUUID();
      const sent = await sendTransit(scope!.tenantId, actor, {
        sourceDrawerId: source,
        destDrawerId: dest,
        amount: '4.250',
        notes: 'runner to the safe',
        idempotencyKey: key,
      });
      const open = await readTransit(sent.transitId);
      expect(open.status).toBe('IN_TRANSIT');

      const send = await legLines(sent.transitNo);
      expect(send).toEqual([
        { drawer_id: source, direction: 'OUT', amount: '4.2500' },
        { drawer_id: open.transit_drawer_id, direction: 'IN', amount: '4.2500' },
      ]);

      // A repeated send with the same key returns the same transfer, not a second one.
      const again = await sendTransit(scope!.tenantId, actor, {
        sourceDrawerId: source,
        destDrawerId: dest,
        amount: '4.250',
        idempotencyKey: key,
      });
      expect(again).toEqual(sent);

      const listed = await listTransits(scope!.tenantId, { status: 'IN_TRANSIT', page: 1, pageSize: 100 }, [scope!.branchId]);
      expect(listed.rows.find((r) => r.id === sent.transitId)).toMatchObject({ amount: '4.2500', currencyCode: 'OMR', status: 'IN_TRANSIT' });
      expect((await listTransits(scope!.tenantId, { status: 'IN_TRANSIT', page: 1, pageSize: 100 }, [randomUUID()])).rows).toHaveLength(0);

      const received = await receiveTransit(scope!.tenantId, actor, sent.transitId); // the sender may receive: permission is the only gate
      const settled = await readTransit(sent.transitId);
      expect(settled).toMatchObject({ status: 'RECEIVED', received_by: actor, cancelled_by: null });
      expect(await legLines(received.trxNo)).toEqual([
        { drawer_id: open.transit_drawer_id, direction: 'OUT', amount: '4.2500' },
        { drawer_id: dest, direction: 'IN', amount: '4.2500' },
      ]);

      // Exactly once: neither a second receive nor a cancel can follow.
      await expect(receiveTransit(scope!.tenantId, actor, sent.transitId)).rejects.toMatchObject({
        code: CASH_LEDGER_ERRORS.CASH_TRANSIT_NOT_OPEN,
      });
      await expect(cancelTransit(scope!.tenantId, actor, sent.transitId, 'too late')).rejects.toMatchObject({
        code: CASH_LEDGER_ERRORS.CASH_TRANSIT_NOT_OPEN,
      });

      // The holder drawer nets to zero once the cash has arrived.
      const [net] = await prisma.$queryRaw<Array<{ net: string }>>`
        SELECT COALESCE(SUM(CASE direction WHEN 'IN' THEN amount ELSE -amount END), 0)::text AS net
        FROM public.org_cash_drawer_trx_dtl
        WHERE tenant_org_id = ${scope!.tenantId}::uuid AND cash_drawer_id = ${open.transit_drawer_id}::uuid`;
      expect(Number(net.net)).toBe(0);
    });
  });

  dbit('cancel returns the cash to the source with a mandatory reason and blocks a later receive', async () => {
    await withDrawers(async ({ source, dest }) => {
      const sent = await sendTransit(scope!.tenantId, actor, { sourceDrawerId: source, destDrawerId: dest, amount: '1.500' });

      await expect(cancelTransit(scope!.tenantId, actor, sent.transitId, '   ')).rejects.toMatchObject({
        code: CASH_LEDGER_ERRORS.CASH_TRANSIT_REASON_REQUIRED,
      });
      expect((await readTransit(sent.transitId)).status).toBe('IN_TRANSIT');

      const cancelled = await cancelTransit(scope!.tenantId, actor, sent.transitId, 'Runner never left');
      const row = await readTransit(sent.transitId);
      expect(row).toMatchObject({ status: 'CANCELLED', cancelled_by: actor, cancel_reason: 'Runner never left' });
      expect(await legLines(cancelled.trxNo)).toEqual([
        { drawer_id: row.transit_drawer_id, direction: 'OUT', amount: '1.5000' },
        { drawer_id: source, direction: 'IN', amount: '1.5000' },
      ]);
      await expect(receiveTransit(scope!.tenantId, actor, sent.transitId)).rejects.toMatchObject({
        code: CASH_LEDGER_ERRORS.CASH_TRANSIT_NOT_OPEN,
      });
    });
  });

  dbit('refuses structural mistakes before any cash moves, and protects the record', async () => {
    await withDrawers(async ({ source, dest, bag }) => {
      const base = { sourceDrawerId: source, destDrawerId: dest, amount: '1.000' };
      await expect(sendTransit(scope!.tenantId, actor, { ...base, destDrawerId: source })).rejects.toMatchObject({
        code: CASH_LEDGER_ERRORS.CASH_TRX_SAME_DRAWER,
      });
      // A driver bag cannot receive a transfer, so cash is never sent to where it could not arrive.
      await expect(sendTransit(scope!.tenantId, actor, { ...base, destDrawerId: bag })).rejects.toMatchObject({
        code: CASH_LEDGER_ERRORS.CASH_DRAWER_TYPE_NOT_ALLOWED,
      });
      await expect(receiveTransit(scope!.tenantId, actor, randomUUID())).rejects.toMatchObject({
        code: CASH_LEDGER_ERRORS.CASH_TRANSIT_NOT_FOUND,
      });

      const sent = await sendTransit(scope!.tenantId, actor, base);
      const row = await readTransit(sent.transitId);

      // A transit leg is undone by cancel, never by a reversal.
      const [sendTrx] = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT send_trx_id AS id FROM public.org_cash_drawer_transit_tr
        WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id = ${sent.transitId}::uuid`;
      await expect(reverseDrawerTrx(scope!.tenantId, actor, sendTrx.id, 'oops')).rejects.toMatchObject({
        code: CASH_LEDGER_ERRORS.CASH_TRANSIT_USE_CANCEL,
      });

      // What was sent can never be edited, even by raw SQL.
      await expect(
        prisma.$executeRaw`UPDATE public.org_cash_drawer_transit_tr SET amount = 99 WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id = ${sent.transitId}::uuid`,
      ).rejects.toThrow(/TRANSIT_IMMUTABLE/);

      await cancelTransit(scope!.tenantId, actor, sent.transitId, 'cleanup');
      // A settled row is history: no further update, no delete.
      await expect(
        prisma.$executeRaw`UPDATE public.org_cash_drawer_transit_tr SET notes = 'x' WHERE tenant_org_id = ${scope!.tenantId}::uuid AND id = ${sent.transitId}::uuid`,
      ).rejects.toThrow(/TRANSIT_IMMUTABLE/);
      expect(row.status).toBe('IN_TRANSIT');
    });
  });
});

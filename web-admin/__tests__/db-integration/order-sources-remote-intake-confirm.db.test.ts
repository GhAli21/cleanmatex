/**
 * T02 — Remote -> confirm intake, source-scoped.
 *
 * `CONFIRM_PHYSICAL_INTAKE`'s gate in
 * `app/api/v1/orders/[id]/confirm-physical-intake/route.ts` is driven entirely
 * by `sys_order_sources_cd.requires_remote_intake_confirm`, not by a literal
 * "remote" source code. This proves the real seeded catalog: exactly
 * `customer_mobile_app` carries that flag among active sources, so the route
 * unit tests using `requires_remote_intake_confirm: true`/`false` mocks are
 * actually standing in for `customer_mobile_app` vs every other real source
 * — not an arbitrary boolean. A silent catalog change (e.g. someone flipping
 * the flag on `pos` or `web_admin`, or turning it off for
 * `customer_mobile_app`) would break this test, not just the route mock.
 *
 * Local DB only. Skips when the seed catalog is not present locally.
 *
 * @jest-environment node
 */

import { prisma } from '@/lib/db/prisma';

let dbReady = false;

beforeAll(async () => {
  try {
    const readiness = await prisma.$queryRaw<Array<{ ready: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM public.sys_order_sources_cd WHERE order_source_code = 'customer_mobile_app'
      ) AS ready
    `;
    dbReady = readiness[0]?.ready === true;
  } catch {
    dbReady = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbReady) {
      console.warn(`[order-sources-remote-intake-confirm] sys_order_sources_cd seed not present locally - skipping: ${name}`);
      return;
    }
    await fn();
  });
}

describe('sys_order_sources_cd — requires_remote_intake_confirm (T02)', () => {
  dbit('flags exactly customer_mobile_app among active order sources', async () => {
    const rows = await prisma.sys_order_sources_cd.findMany({
      where: { is_active: true, requires_remote_intake_confirm: true },
      select: { order_source_code: true },
    });

    expect(rows.map((row) => row.order_source_code)).toEqual(['customer_mobile_app']);
  });

  dbit('does not flag staff-present sources (pos, web_admin, kiosk, staff_mobile_app)', async () => {
    const rows = await prisma.sys_order_sources_cd.findMany({
      where: {
        order_source_code: { in: ['pos', 'web_admin', 'kiosk', 'staff_mobile_app'] },
      },
      select: { order_source_code: true, requires_remote_intake_confirm: true },
    });

    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row.requires_remote_intake_confirm).toBe(false);
    }
  });
});

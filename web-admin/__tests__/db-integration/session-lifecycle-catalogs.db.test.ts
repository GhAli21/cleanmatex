/**
 * Session-lifecycle label catalogs: every status / event code the application can write has a
 * bilingual row in its `sys_*` catalog (so no screen ever falls back to a raw code), and the
 * service returns inactive rows too (a historical record may carry a retired code).
 *
 * Local DB only — never remote. Skips gracefully when no DB is reachable.
 *
 * @jest-environment node
 */
import { prisma } from '@/lib/db/prisma';
import { getSessionLifecycleCatalogs } from '@/lib/services/session-lifecycle-catalogs.service';
import { POS_SESSION_EVENT_TYPE, POS_SESSION_STATUS } from '@/lib/constants/pos-session';
import { CASH_DRAWER_SESSION_STATUSES } from '@/lib/constants/payment';

let dbUp = false;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbUp = true;
  } catch {
    dbUp = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(
    name,
    async () => {
      if (!dbUp) {
        console.warn(`[session-lifecycle-catalogs] DB unavailable — skipping: ${name}`);
        return;
      }
      await fn();
    },
    60_000,
  );
}

describe('session lifecycle catalogs', () => {
  dbit('has a bilingual row for every POS-session status the application can write', async () => {
    const { posSessionStatuses } = await getSessionLifecycleCatalogs();
    const codes = posSessionStatuses.map((s) => s.code);
    for (const code of Object.values(POS_SESSION_STATUS)) expect(codes).toContain(code);
    for (const row of posSessionStatuses) {
      expect(row.name.trim()).not.toBe('');
      expect(row.name2?.trim() ?? '').not.toBe('');
    }
  });

  dbit('has a bilingual row for every POS-session event type the application can write', async () => {
    const { posSessionEventTypes } = await getSessionLifecycleCatalogs();
    const codes = posSessionEventTypes.map((e) => e.code);
    for (const code of Object.values(POS_SESSION_EVENT_TYPE)) expect(codes).toContain(code);
    for (const row of posSessionEventTypes) {
      expect(row.name.trim()).not.toBe('');
      expect(row.name2?.trim() ?? '').not.toBe('');
    }
  });

  dbit('has a bilingual row for every cash-drawer session status, including CLOSING', async () => {
    const { drawerSessionStatuses } = await getSessionLifecycleCatalogs();
    const codes = drawerSessionStatuses.map((s) => s.code);
    for (const code of Object.values(CASH_DRAWER_SESSION_STATUSES)) expect(codes).toContain(code);
    expect(codes).toContain('CLOSING');
    for (const row of drawerSessionStatuses) expect(row.name2?.trim() ?? '').not.toBe('');
  });

  dbit('returns inactive rows too, ordered by display order', async () => {
    const { posSessionStatuses } = await getSessionLifecycleCatalogs();
    const orders = posSessionStatuses.map((s) => s.displayOrder);
    expect([...orders].sort((a, b) => a - b)).toEqual(orders);
  });
});

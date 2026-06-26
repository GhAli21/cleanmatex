/**
 * D-12 §5 — settlement catalog ↔ live-DB EXACT parity (anti-pattern remediation).
 *
 * The F-T1 anti-pattern class was "constants/catalog tests that assert only shape
 * (length / Set-uniqueness)" — exactly the no-op assertion that let the
 * SAVE_TO_CUSTOMER_WALLET blocker (F-00) ship. `settlement-catalog.test.ts` already
 * upgraded the overpayment catalog to migration-DDL parity, and `finance-smoke`
 * asserts the live `sys_fin_overpay_res_cd` rows are a SUPERSET of the required codes.
 *
 * This suite closes the last gap: BIDIRECTIONAL exact parity between the TypeScript
 * `as const` catalogs and their live `sys_*_cd` lookup tables — catching drift in
 * EITHER direction (a DB code with no TS member, or a TS member with no DB row). That
 * is the canonical "shape → real DB parity" conversion.
 *
 * Read-only (no writes). Skips when no DB is reachable.
 *
 * @jest-environment node
 */
import { prisma } from '@/lib/db/prisma';
import {
  OVERPAYMENT_RESOLUTIONS,
  CUSTOMER_RECEIPT_ALLOCATION_MODES,
} from '@/lib/constants/settlement-catalog';

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
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[settlement-catalog.parity] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

describe('settlement catalog ↔ live sys_*_cd exact parity', () => {
  dbit('OVERPAYMENT_RESOLUTIONS exactly matches sys_fin_overpay_res_cd (both directions)', async () => {
    const rows = await prisma.$queryRaw<Array<{ resolution_code: string }>>`
      SELECT resolution_code FROM public.sys_fin_overpay_res_cd`;
    const db = new Set(rows.map((r) => r.resolution_code));
    const ts = new Set<string>(Object.values(OVERPAYMENT_RESOLUTIONS));

    const missingInDb = [...ts].filter((c) => !db.has(c)); // TS member with no catalog row
    const extraInDb = [...db].filter((c) => !ts.has(c));   // catalog row with no TS member
    expect({ missingInDb, extraInDb }).toEqual({ missingInDb: [], extraInDb: [] });
  });

  dbit('CUSTOMER_RECEIPT_ALLOCATION_MODES exactly matches sys_fin_rcpt_alloc_mode_cd (both directions)', async () => {
    const rows = await prisma.$queryRaw<Array<{ allocation_mode: string }>>`
      SELECT allocation_mode FROM public.sys_fin_rcpt_alloc_mode_cd`;
    const db = new Set(rows.map((r) => r.allocation_mode));
    const ts = new Set<string>(Object.values(CUSTOMER_RECEIPT_ALLOCATION_MODES));

    const missingInDb = [...ts].filter((c) => !db.has(c));
    const extraInDb = [...db].filter((c) => !ts.has(c));
    expect({ missingInDb, extraInDb }).toEqual({ missingInDb: [], extraInDb: [] });
  });
});

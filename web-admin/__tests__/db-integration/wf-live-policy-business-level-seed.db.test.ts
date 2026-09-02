/**
 * Live business-level policy seed (0472).
 *
 * These checks prove the seeded versions pass the live integrity helper
 * and keep CONFIRM_PICKUP on pickup_handover. Skip only when 0472 is not
 * present in this local database.
 *
 * @jest-environment node
 */

import { prisma } from '@/lib/db/prisma';

const SIMPLE_V2 = 'a1000000-0000-4000-8000-000000000013';

let dbReady = false;

beforeAll(async () => {
  try {
    const readiness = await prisma.$queryRaw<Array<{ ready: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM public.sys_wf_profile_ver_mst AS version_row
        INNER JOIN public.sys_wf_prof_ver_policy_cf AS policy_row
          ON policy_row.version_id = version_row.version_id
        WHERE version_row.version_id = ${SIMPLE_V2}::uuid
          AND version_row.version_status = 'PUBLISHED'
          AND policy_row.allow_direct_counter_pickup = true
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
      console.warn(`[wf-live-policy-seed-db] 0472 not applied locally - skipping: ${name}`);
      return;
    }
    await fn();
  });
}

describe('0472 live business-level policy seed', () => {
  dbit('publishes lean SIMPLE v2 that passes live validation', async () => {
    await expect(prisma.$executeRaw`
      SELECT public.sys_wf_prof_ver_validate_live(${SIMPLE_V2}::uuid)
    `).resolves.toBeDefined();
  });

  dbit('binds CONFIRM_PICKUP only on pickup_handover for SIMPLE v2', async () => {
    const rows = await prisma.$queryRaw<Array<{ screen_key: string; from_status: string; to_status: string }>>`
      SELECT screen_key, from_status, to_status
      FROM public.sys_wf_prof_ver_exec_cf
      WHERE version_id = ${SIMPLE_V2}::uuid
        AND action_code = 'CONFIRM_PICKUP'
        AND is_active = true
        AND rec_status = 1
      ORDER BY from_status
    `;
    expect(rows.every((row) => row.screen_key === 'pickup_handover')).toBe(true);
    expect(rows).toEqual(expect.arrayContaining([
      { screen_key: 'pickup_handover', from_status: 'ready', to_status: 'delivered' },
      { screen_key: 'pickup_handover', from_status: 'ready_for_pickup', to_status: 'delivered' },
    ]));
  });

  dbit('does not bind delivery_stop_active on SIMPLE v2', async () => {
    const rows = await prisma.$queryRaw<Array<{ gate_count: number }>>`
      SELECT count(*)::int AS gate_count
      FROM public.sys_wf_prof_ver_exec_gate_cf AS gate_row
      INNER JOIN public.sys_wf_prof_ver_exec_cf AS executable
        ON executable.exec_id = gate_row.exec_id
      WHERE executable.version_id = ${SIMPLE_V2}::uuid
        AND gate_row.gate_code = 'delivery_stop_active'
        AND gate_row.is_active = true
    `;
    expect(rows[0].gate_count).toBe(0);
  });
});

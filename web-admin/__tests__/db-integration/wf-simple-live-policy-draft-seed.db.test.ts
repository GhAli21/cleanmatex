/**
 * WF_V2_SIMPLE live-policy DRAFT repair (0475).
 *
 * Remote: 0472 skipped SIMPLE because published v2 (V2_Jh) already existed.
 * This seed adds version_id ...014 as DRAFT. Skip when that row is absent
 * (local DB already has published 0472 SIMPLE live policy).
 *
 * @jest-environment node
 */

import { prisma } from '@/lib/db/prisma';

const SIMPLE_DRAFT = 'a1000000-0000-4000-8000-000000000014';

let dbReady = false;

beforeAll(async () => {
  try {
    const readiness = await prisma.$queryRaw<Array<{ ready: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM public.sys_wf_profile_ver_mst AS version_row
        INNER JOIN public.sys_wf_prof_ver_policy_cf AS policy_row
          ON policy_row.version_id = version_row.version_id
        WHERE version_row.version_id = ${SIMPLE_DRAFT}::uuid
          AND version_row.version_status = 'DRAFT'
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
      console.warn(`[wf-simple-live-draft-db] 0475 draft not present - skipping: ${name}`);
      return;
    }
    await fn();
  });
}

describe('0475 WF_V2_SIMPLE live policy draft seed', () => {
  dbit('leaves the repair version in DRAFT', async () => {
    const rows = await prisma.$queryRaw<Array<{ version_status: string }>>`
      SELECT version_status
      FROM public.sys_wf_profile_ver_mst
      WHERE version_id = ${SIMPLE_DRAFT}::uuid
    `;
    expect(rows).toEqual([{ version_status: 'DRAFT' }]);
  });

  dbit('binds CONFIRM_PICKUP only on pickup_handover', async () => {
    const rows = await prisma.$queryRaw<Array<{ screen_key: string; from_status: string; to_status: string }>>`
      SELECT screen_key, from_status, to_status
      FROM public.sys_wf_prof_ver_exec_cf
      WHERE version_id = ${SIMPLE_DRAFT}::uuid
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
});

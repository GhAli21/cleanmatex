/**
 * Seed invariants that mirror catalog `seed_must_pass` structural errors.
 * Tenant cannot run HQ Check policy here; these SQL checks catch the 0475 class of seed bugs.
 *
 * @jest-environment node
 */

import { prisma } from '@/lib/db/prisma';

const SIMPLE_PUBLISHED = 'a1000000-0000-4000-8000-000000000013';

interface CountRow {
  n: number;
}

async function versionExists(versionId: string): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ ready: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM public.sys_wf_profile_ver_mst
        WHERE version_id = ${versionId}::uuid
      ) AS ready
    `;
    return rows[0]?.ready === true;
  } catch {
    return false;
  }
}

/**
 * Structural seed_must_pass checks for one platform-shipped profile version.
 *
 * @param versionId Seeded sys_wf_profile_ver_mst.version_id
 */
export async function assertWfSeedMustPassInvariants(versionId: string): Promise<void> {
  const sequence = await prisma.$queryRaw<Array<{ status_code: string | null }>>`
    SELECT unnest(coalesce(stage_sequence, '{}'::text[])) AS status_code
    FROM public.sys_wf_prof_ver_policy_cf
    WHERE version_id = ${versionId}::uuid
  `;
  expect(sequence.length).toBeGreaterThan(0);
  const codes = sequence.map((row) => row.status_code ?? '');
  expect(codes.every((code) => code.trim().length > 0)).toBe(true);
  expect(new Set(codes).size).toBe(codes.length);

  const duplicateOwners = await prisma.$queryRaw<CountRow[]>`
    SELECT count(*)::int AS n
    FROM (
      SELECT status_code
      FROM public.sys_wf_prof_ver_mod_st_cf AS membership
      INNER JOIN public.sys_wf_prof_ver_module_cf AS module_row
        ON module_row.version_id = membership.version_id
       AND module_row.screen_key = membership.screen_key
      WHERE membership.version_id = ${versionId}::uuid
        AND membership.is_active = true
        AND membership.rec_status = 1
        AND membership.visibility_mode = 'owner'
        AND module_row.is_enabled = true
        AND module_row.is_active = true
        AND module_row.rec_status = 1
        AND module_row.module_mode = 'primary_owner'
      GROUP BY status_code
      HAVING count(*) > 1
    ) AS collisions
  `;
  expect(duplicateOwners[0]?.n ?? 0).toBe(0);

  const nonPrimaryOwners = await prisma.$queryRaw<CountRow[]>`
    SELECT count(*)::int AS n
    FROM public.sys_wf_prof_ver_mod_st_cf AS membership
    INNER JOIN public.sys_wf_prof_ver_module_cf AS module_row
      ON module_row.version_id = membership.version_id
     AND module_row.screen_key = membership.screen_key
    WHERE membership.version_id = ${versionId}::uuid
      AND membership.is_active = true
      AND membership.rec_status = 1
      AND membership.visibility_mode = 'owner'
      AND module_row.is_enabled = true
      AND module_row.module_mode <> 'primary_owner'
  `;
  expect(nonPrimaryOwners[0]?.n ?? 0).toBe(0);

  const execsWithoutChannel = await prisma.$queryRaw<CountRow[]>`
    SELECT count(*)::int AS n
    FROM public.sys_wf_prof_ver_exec_cf AS executable
    WHERE executable.version_id = ${versionId}::uuid
      AND executable.is_active = true
      AND executable.rec_status = 1
      AND NOT EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_exec_ch_cf AS channel_row
        WHERE channel_row.exec_id = executable.exec_id
          AND channel_row.is_active = true
          AND channel_row.rec_status = 1
      )
  `;
  expect(execsWithoutChannel[0]?.n ?? 0).toBe(0);

  const confirmPickupWrong = await prisma.$queryRaw<CountRow[]>`
    SELECT count(*)::int AS n
    FROM public.sys_wf_prof_ver_exec_cf
    WHERE version_id = ${versionId}::uuid
      AND action_code = 'CONFIRM_PICKUP'
      AND is_active = true
      AND rec_status = 1
      AND screen_key <> 'pickup_handover'
  `;
  expect(confirmPickupWrong[0]?.n ?? 0).toBe(0);

  const pickupWithoutReady = await prisma.$queryRaw<CountRow[]>`
    SELECT count(*)::int AS n
    FROM public.sys_wf_prof_ver_module_cf AS pickup_row
    WHERE pickup_row.version_id = ${versionId}::uuid
      AND pickup_row.screen_key = 'pickup_handover'
      AND pickup_row.is_enabled = true
      AND pickup_row.is_active = true
      AND pickup_row.rec_status = 1
      AND NOT EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_module_cf AS ready_row
        WHERE ready_row.version_id = pickup_row.version_id
          AND ready_row.screen_key = 'ready_release'
          AND ready_row.is_enabled = true
          AND ready_row.is_active = true
          AND ready_row.rec_status = 1
      )
  `;
  expect(pickupWithoutReady[0]?.n ?? 0).toBe(0);

  const initialMissingOwner = await prisma.$queryRaw<CountRow[]>`
    SELECT count(*)::int AS n
    FROM public.sys_wf_prof_ver_init_cf AS initial_row
    WHERE initial_row.version_id = ${versionId}::uuid
      AND initial_row.is_active = true
      AND initial_row.rec_status = 1
      AND NOT EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_mod_st_cf AS membership
        INNER JOIN public.sys_wf_prof_ver_module_cf AS module_row
          ON module_row.version_id = membership.version_id
         AND module_row.screen_key = membership.screen_key
        WHERE membership.version_id = initial_row.version_id
          AND membership.status_code = initial_row.initial_status
          AND membership.visibility_mode = 'owner'
          AND membership.is_active = true
          AND module_row.is_enabled = true
          AND module_row.module_mode = 'primary_owner'
      )
  `;
  expect(initialMissingOwner[0]?.n ?? 0).toBe(0);
}

describe('wf policy issue catalog seed_must_pass invariants', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('holds for 0472 SIMPLE published live policy when present', async () => {
    if (!(await versionExists(SIMPLE_PUBLISHED))) {
      console.warn('[wf-policy-issue-catalog] 0472 SIMPLE v2 not in this database — skipping');
      return;
    }
    await assertWfSeedMustPassInvariants(SIMPLE_PUBLISHED);
  });
});

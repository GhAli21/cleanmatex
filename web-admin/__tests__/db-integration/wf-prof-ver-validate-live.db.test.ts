/**
 * Draft `sys_wf_prof_ver_validate_live` ownership-guard tests (0470 OPEN).
 *
 * 0470 is an unapplied review draft. The public function does not exist until
 * the product owner applies it. These tests install a session `pg_temp` copy
 * extracted from the draft file so the predicate can be proven on pre-0470
 * schema without applying the migration.
 *
 * Local DB only. The suite skips when 0457 policy tables or the draft file
 * are unavailable. Agents never apply 0470.
 *
 * @jest-environment node
 */

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/db/prisma';

const MIGRATION_PATH = path.resolve(
  process.cwd(),
  '..',
  'supabase',
  'migrations',
  '0470_live_normalized_workflow_profile_runtime.sql'
);

let dbReady = false;
let draftFnSql: string | null = null;

interface DraftSeed {
  profileId: string;
  versionId: string;
}

beforeAll(async () => {
  try {
    draftFnSql = extractValidateLiveFnSql();
    const readiness = await prisma.$queryRaw<Array<{ ready: boolean }>>`
      SELECT
        to_regclass('public.sys_wf_prof_ver_module_cf') IS NOT NULL
        AND to_regclass('public.sys_wf_prof_ver_exec_cf') IS NOT NULL
        AND to_regclass('public.sys_wf_prof_ver_exec_ch_cf') IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_screens_cd WHERE screen_key = 'pickup_handover'
        )
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_actions_cd WHERE action_code = 'CONFIRM_PICKUP'
        )
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_statuses_cd WHERE status_code = 'ready_for_pickup'
        ) AS ready
    `;
    dbReady = readiness[0]?.ready === true && Boolean(draftFnSql);
  } catch {
    dbReady = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbReady || !draftFnSql) {
      console.warn(
        `[wf-validate-live-db] Local DB or 0470 draft extract unavailable - skipping: ${name}`
      );
      return;
    }
    await fn();
  });
}

/**
 * Pulls the draft helper from 0470 so tests share one source of truth with the
 * unapplied migration instead of duplicating the predicate.
 */
function extractValidateLiveFnSql(): string {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const start = sql.indexOf(
    'CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_validate_live('
  );
  const end = sql.indexOf(
    '\nREVOKE ALL ON FUNCTION public.sys_wf_prof_ver_validate_live',
    start
  );
  if (start < 0 || end < 0) {
    throw new Error('Could not extract sys_wf_prof_ver_validate_live from 0470');
  }
  return sql
    .slice(start, end)
    .replaceAll(
      'public.sys_wf_prof_ver_validate_live',
      'pg_temp.sys_wf_prof_ver_validate_live'
    )
    .trim();
}

async function callDraftValidate(versionId: string): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(draftFnSql as string);
      await tx.$executeRaw`
        SELECT pg_temp.sys_wf_prof_ver_validate_live(${versionId}::uuid)
      `;
    },
    { timeout: 20000 }
  );
}

async function seedDraftVersion(): Promise<DraftSeed> {
  const profileCode = `LWPR0470T_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
  const profile = await prisma.$queryRaw<Array<{ profile_id: string }>>`
    INSERT INTO public.sys_wf_profiles_cd (profile_code, name, name2, is_system, is_active, rec_status)
    VALUES (${profileCode}, ${`0470 guard ${profileCode}`}, ${`0470 ${profileCode}`}, false, true, 1)
    RETURNING profile_id
  `;
  const version = await prisma.$queryRaw<Array<{ version_id: string }>>`
    INSERT INTO public.sys_wf_profile_ver_mst (
      profile_id, version_no, version_status, name, is_active, rec_status
    ) VALUES (
      ${profile[0].profile_id}::uuid, 1, 'DRAFT', ${`0470 draft ${profileCode}`}, true, 1
    )
    RETURNING version_id
  `;
  await prisma.$executeRaw`
    INSERT INTO public.sys_wf_prof_ver_policy_cf (version_id, is_active, rec_status)
    VALUES (${version[0].version_id}::uuid, true, 1)
  `;
  return {
    profileId: profile[0].profile_id,
    versionId: version[0].version_id,
  };
}

async function insertModule(
  versionId: string,
  screenKey: string,
  moduleMode: 'primary_owner' | 'observer',
  displayOrder: number
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO public.sys_wf_prof_ver_module_cf (
      version_id, screen_key, module_mode, is_enabled, display_order, is_active, rec_status
    ) VALUES (
      ${versionId}::uuid, ${screenKey}, ${moduleMode}, true, ${displayOrder}, true, 1
    )
  `;
}

async function insertMembership(
  versionId: string,
  screenKey: string,
  statusCode: string,
  visibilityMode: 'owner' | 'observer',
  displayOrder: number
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO public.sys_wf_prof_ver_mod_st_cf (
      version_id, screen_key, status_code, visibility_mode, display_order, is_active, rec_status
    ) VALUES (
      ${versionId}::uuid, ${screenKey}, ${statusCode}, ${visibilityMode}, ${displayOrder}, true, 1
    )
  `;
}

async function insertInitDefaultIntake(versionId: string): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO public.sys_wf_prof_ver_init_cf (
      version_id, rule_code, initial_status, priority, is_active, rec_status
    ) VALUES (
      ${versionId}::uuid, 'INIT_DEFAULT', 'intake', 900, true, 1
    )
  `;
}

async function insertExec(
  versionId: string,
  screenKey: string,
  actionCode: string,
  fromStatus: string,
  toStatus: string
): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ exec_id: string }>>`
    INSERT INTO public.sys_wf_prof_ver_exec_cf (
      version_id, screen_key, action_code, from_status, to_status,
      transition_kind, is_active, rec_status
    ) VALUES (
      ${versionId}::uuid, ${screenKey}, ${actionCode}, ${fromStatus}, ${toStatus},
      'fixed', true, 1
    )
    RETURNING exec_id
  `;
  await prisma.$executeRaw`
    INSERT INTO public.sys_wf_prof_ver_exec_ch_cf (exec_id, channel_code, is_active, rec_status)
    VALUES (${rows[0].exec_id}::uuid, 'staff_web', true, 1)
  `;
}

async function seedIntakeOwner(versionId: string): Promise<void> {
  await insertModule(versionId, 'new_order', 'primary_owner', 5);
  await insertMembership(versionId, 'new_order', 'intake', 'owner', 10);
  await insertInitDefaultIntake(versionId);
}

async function cleanupSeed(seed: DraftSeed): Promise<void> {
  // 0469 draft-delete has an ambiguous version_no in the current applied helper.
  // Reverse-delete DRAFT rows instead so tests stay independent of that bug.
  await prisma.$executeRaw`
    DELETE FROM public.sys_wf_prof_ver_exec_ch_cf
    WHERE exec_id IN (
      SELECT exec_id FROM public.sys_wf_prof_ver_exec_cf
      WHERE version_id = ${seed.versionId}::uuid
    )
  `;
  await prisma.$executeRaw`
    DELETE FROM public.sys_wf_prof_ver_exec_gate_cf
    WHERE exec_id IN (
      SELECT exec_id FROM public.sys_wf_prof_ver_exec_cf
      WHERE version_id = ${seed.versionId}::uuid
    )
  `;
  await prisma.$executeRaw`
    DELETE FROM public.sys_wf_prof_ver_exec_cf WHERE version_id = ${seed.versionId}::uuid
  `;
  await prisma.$executeRaw`
    DELETE FROM public.sys_wf_prof_ver_mod_st_cf WHERE version_id = ${seed.versionId}::uuid
  `;
  await prisma.$executeRaw`
    DELETE FROM public.sys_wf_prof_ver_module_cf WHERE version_id = ${seed.versionId}::uuid
  `;
  await prisma.$executeRaw`
    DELETE FROM public.sys_wf_prof_ver_init_cf WHERE version_id = ${seed.versionId}::uuid
  `;
  await prisma.$executeRaw`
    DELETE FROM public.sys_wf_prof_ver_policy_cf WHERE version_id = ${seed.versionId}::uuid
  `;
  await prisma.$executeRaw`
    DELETE FROM public.sys_wf_profile_ver_mst WHERE version_id = ${seed.versionId}::uuid
  `;
  await prisma.$executeRaw`
    DELETE FROM public.sys_wf_profiles_cd WHERE profile_id = ${seed.profileId}::uuid
  `;
}

describe('0470 sys_wf_prof_ver_validate_live (OPEN draft)', () => {
  dbit('0470 still drops the live pre-0470 snapshot constraint names and has no CASCADE', async () => {
    const sql = readFileSync(MIGRATION_PATH, 'utf8');
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS chk_ord_wf_sem_snapshot/);
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS chk_ord_wf_snap_required/);
    expect(sql).not.toMatch(/\bCASCADE\b/);

    const constraints = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.org_orders_mst'::regclass
        AND conname IN ('chk_ord_wf_sem_snapshot', 'chk_ord_wf_snap_required')
    `;
    expect(constraints.map((row) => row.conname).sort()).toEqual([
      'chk_ord_wf_sem_snapshot',
      'chk_ord_wf_snap_required',
    ]);
  });

  dbit('allows pickup_handover CONFIRM_PICKUP from observed ready to delivered plus staged owner confirm', async () => {
    const seed = await seedDraftVersion();
    try {
      await seedIntakeOwner(seed.versionId);
      await insertModule(seed.versionId, 'ready_release', 'primary_owner', 20);
      await insertMembership(seed.versionId, 'ready_release', 'ready', 'owner', 10);
      await insertModule(seed.versionId, 'pickup_handover', 'primary_owner', 30);
      await insertMembership(seed.versionId, 'pickup_handover', 'ready_for_pickup', 'owner', 10);
      await insertMembership(seed.versionId, 'pickup_handover', 'ready', 'observer', 20);
      await insertExec(
        seed.versionId,
        'pickup_handover',
        'CONFIRM_PICKUP',
        'ready',
        'delivered'
      );
      await insertExec(
        seed.versionId,
        'pickup_handover',
        'CONFIRM_PICKUP',
        'ready_for_pickup',
        'delivered'
      );
      await expect(callDraftValidate(seed.versionId)).resolves.toBeUndefined();
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('rejects CONFIRM_PICKUP bound on ready_release even when that module owns ready', async () => {
    const seed = await seedDraftVersion();
    try {
      await seedIntakeOwner(seed.versionId);
      await insertModule(seed.versionId, 'ready_release', 'primary_owner', 20);
      await insertMembership(seed.versionId, 'ready_release', 'ready', 'owner', 10);
      await insertExec(
        seed.versionId,
        'ready_release',
        'CONFIRM_PICKUP',
        'ready',
        'delivered'
      );
      await expect(callDraftValidate(seed.versionId)).rejects.toThrow(
        /CONFIRM_PICKUP must be bound on pickup_handover/
      );
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('rejects direct CONFIRM_PICKUP from ready when pickup has no observer membership', async () => {
    const seed = await seedDraftVersion();
    try {
      await seedIntakeOwner(seed.versionId);
      await insertModule(seed.versionId, 'ready_release', 'primary_owner', 20);
      await insertMembership(seed.versionId, 'ready_release', 'ready', 'owner', 10);
      await insertModule(seed.versionId, 'pickup_handover', 'primary_owner', 30);
      await insertMembership(seed.versionId, 'pickup_handover', 'ready_for_pickup', 'owner', 10);
      await insertExec(
        seed.versionId,
        'pickup_handover',
        'CONFIRM_PICKUP',
        'ready',
        'delivered'
      );
      await expect(callDraftValidate(seed.versionId)).rejects.toThrow(
        /owner visibility for its source status/
      );
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('rejects pickup executing a non-confirm action from observed ready', async () => {
    const seed = await seedDraftVersion();
    try {
      await seedIntakeOwner(seed.versionId);
      await insertModule(seed.versionId, 'ready_release', 'primary_owner', 20);
      await insertMembership(seed.versionId, 'ready_release', 'ready', 'owner', 10);
      await insertModule(seed.versionId, 'pickup_handover', 'primary_owner', 30);
      await insertMembership(seed.versionId, 'pickup_handover', 'ready_for_pickup', 'owner', 10);
      await insertMembership(seed.versionId, 'pickup_handover', 'ready', 'observer', 20);
      await insertExec(
        seed.versionId,
        'pickup_handover',
        'RELEASE_FOR_PICKUP',
        'ready',
        'ready_for_pickup'
      );
      await expect(callDraftValidate(seed.versionId)).rejects.toThrow(
        /owner visibility for its source status/
      );
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('rejects Workboard observer execute from ready', async () => {
    const seed = await seedDraftVersion();
    try {
      await seedIntakeOwner(seed.versionId);
      await insertModule(seed.versionId, 'ready_release', 'primary_owner', 20);
      await insertMembership(seed.versionId, 'ready_release', 'ready', 'owner', 10);
      await insertModule(seed.versionId, 'workboard', 'observer', 90);
      await insertMembership(seed.versionId, 'workboard', 'ready', 'observer', 10);
      await insertExec(
        seed.versionId,
        'workboard',
        'RELEASE_FOR_PICKUP',
        'ready',
        'ready_for_pickup'
      );
      await expect(callDraftValidate(seed.versionId)).rejects.toThrow(
        /owner visibility for its source status/
      );
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('rejects pickup CONFIRM_PICKUP from observed ready when destination is not delivered', async () => {
    const seed = await seedDraftVersion();
    try {
      await seedIntakeOwner(seed.versionId);
      await insertModule(seed.versionId, 'ready_release', 'primary_owner', 20);
      await insertMembership(seed.versionId, 'ready_release', 'ready', 'owner', 10);
      await insertModule(seed.versionId, 'pickup_handover', 'primary_owner', 30);
      await insertMembership(seed.versionId, 'pickup_handover', 'ready_for_pickup', 'owner', 10);
      await insertMembership(seed.versionId, 'pickup_handover', 'ready', 'observer', 20);
      await insertExec(
        seed.versionId,
        'pickup_handover',
        'CONFIRM_PICKUP',
        'ready',
        'processing'
      );
      await expect(callDraftValidate(seed.versionId)).rejects.toThrow(
        /owner visibility for its source status/
      );
    } finally {
      await cleanupSeed(seed);
    }
  });
});

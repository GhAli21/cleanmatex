/**
 * Shared structural report + write-lock tests.
 *
 * Extracts `sys_wf_prof_ver_live_rpt` and `sys_wf_prof_ver_validate_live`
 * from 0477 into `pg_temp` so the predicates can be proven without depending
 * on which host already applied 0477. Pickup and public OFD exceptions stay
 * in the reporter.
 *
 * Local DB only. The suite skips when 0457 policy tables or the migration
 * file are unavailable. Agents never apply migrations.
 *
 * @jest-environment node
 */

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

const MIGRATION_0470_PATH = path.resolve(
  process.cwd(),
  '..',
  'supabase',
  'migrations',
  '0470_live_normalized_workflow_profile_runtime.sql'
);
const MIGRATION_PATH = path.resolve(
  process.cwd(),
  '..',
  'supabase',
  'migrations',
  '0477_wf_live_structural_report.sql'
);

let dbReady = false;
let draftRptSql: string | null = null;
let draftValidateSql: string | null = null;

interface DraftSeed {
  profileId: string;
  versionId: string;
}

beforeAll(async () => {
  try {
    draftRptSql = extractFnSql('sys_wf_prof_ver_live_rpt');
    draftValidateSql = extractFnSql('sys_wf_prof_ver_validate_live');
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
        )
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_screens_cd WHERE screen_key = 'public_tracking'
        )
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_actions_cd WHERE action_code = 'CONFIRM_DELIVERY'
        )
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_statuses_cd WHERE status_code = 'out_for_delivery'
        )
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_screens_cd WHERE screen_key = 'driver_delivery'
        ) AS ready
    `;
    dbReady = readiness[0]?.ready === true && Boolean(draftRptSql) && Boolean(draftValidateSql);
  } catch {
    dbReady = false;
  }
});

afterAll(async () => {
  await prisma.$disconnect();
});

function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbReady || !draftRptSql || !draftValidateSql) {
      console.warn(
        `[wf-validate-live-db] Local DB or 0477 extract unavailable - skipping: ${name}`
      );
      return;
    }
    await fn();
  });
}

/**
 * Pulls one helper from 0477 so tests share the migration source of truth.
 */
function extractFnSql(fnName: 'sys_wf_prof_ver_live_rpt' | 'sys_wf_prof_ver_validate_live'): string {
  const sql = readFileSync(MIGRATION_PATH, 'utf8');
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fnName}(`);
  const end = sql.indexOf(`\nREVOKE ALL ON FUNCTION public.${fnName}`, start);
  if (start < 0 || end < 0) {
    throw new Error(`Could not extract ${fnName} from 0477`);
  }
  return sql
    .slice(start, end)
    .replaceAll('public.sys_wf_prof_ver_validate_live', 'pg_temp.sys_wf_prof_ver_validate_live')
    .replaceAll('public.sys_wf_prof_ver_live_rpt', 'pg_temp.sys_wf_prof_ver_live_rpt')
    .trim();
}

async function installDraftFns(tx: Prisma.TransactionClient): Promise<void> {
  await tx.$executeRawUnsafe(draftRptSql as string);
  await tx.$executeRawUnsafe(draftValidateSql as string);
}

async function callDraftValidate(versionId: string): Promise<void> {
  await prisma.$transaction(
    async (tx) => {
      await installDraftFns(tx);
      await tx.$executeRaw`
        SELECT pg_temp.sys_wf_prof_ver_validate_live(${versionId}::uuid)
      `;
    },
    { timeout: 20000 }
  );
}

async function callDraftReport(versionId: string): Promise<Array<{ issue_code: string }>> {
  return prisma.$transaction(
    async (tx) => {
      await installDraftFns(tx);
      return tx.$queryRaw<Array<{ issue_code: string }>>`
        SELECT issue_code
        FROM pg_temp.sys_wf_prof_ver_live_rpt(${versionId}::uuid)
        ORDER BY issue_code, issue_path
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
  moduleMode: 'primary_owner' | 'observer' | 'cross_cutting_command',
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
  toStatus: string,
  channelCode = 'staff_web'
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
    VALUES (${rows[0].exec_id}::uuid, ${channelCode}, true, 1)
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

describe('0477 sys_wf_prof_ver_live_rpt', () => {
  dbit('0470 dropped the pre-0470 snapshot constraints and has no CASCADE', async () => {
    const sql = readFileSync(MIGRATION_0470_PATH, 'utf8');
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS chk_ord_wf_sem_snapshot/);
    expect(sql).toMatch(/DROP CONSTRAINT IF EXISTS chk_ord_wf_snap_required/);
    expect(sql).not.toMatch(/\bCASCADE\b/);

    const constraints = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'public.org_orders_mst'::regclass
        AND conname IN ('chk_ord_wf_sem_snapshot', 'chk_ord_wf_snap_required')
    `;
    expect(constraints).toEqual([]);
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
        /confirm_pickup_not_on_pickup_handover/
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
        /execution_not_from_status_owner/
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
        /execution_not_from_status_owner/
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
        /execution_not_from_status_owner/
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
        /execution_not_from_status_owner/
      );
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('allows public_tracking CONFIRM_DELIVERY from observed OFD when driver_delivery owns OFD', async () => {
    const seed = await seedDraftVersion();
    try {
      await seedIntakeOwner(seed.versionId);
      await insertModule(seed.versionId, 'driver_delivery', 'primary_owner', 40);
      await insertMembership(seed.versionId, 'driver_delivery', 'out_for_delivery', 'owner', 10);
      await insertModule(seed.versionId, 'public_tracking', 'cross_cutting_command', 50);
      await insertMembership(seed.versionId, 'public_tracking', 'out_for_delivery', 'observer', 10);
      await insertExec(
        seed.versionId,
        'public_tracking',
        'CONFIRM_DELIVERY',
        'out_for_delivery',
        'delivered',
        'public_web'
      );
      await expect(callDraftValidate(seed.versionId)).resolves.toBeUndefined();
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('rejects public_tracking CONFIRM_DELIVERY when driver_delivery does not own OFD', async () => {
    const seed = await seedDraftVersion();
    try {
      await seedIntakeOwner(seed.versionId);
      await insertModule(seed.versionId, 'public_tracking', 'cross_cutting_command', 50);
      await insertMembership(seed.versionId, 'public_tracking', 'out_for_delivery', 'observer', 10);
      await insertExec(
        seed.versionId,
        'public_tracking',
        'CONFIRM_DELIVERY',
        'out_for_delivery',
        'delivered',
        'public_web'
      );
      await expect(callDraftValidate(seed.versionId)).rejects.toThrow(
        /execution_not_from_status_owner/
      );
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('returns every structural catalog code in one report', async () => {
    const seed = await seedDraftVersion();
    try {
      const rows = await callDraftReport(seed.versionId);
      expect(rows.map((row) => row.issue_code).sort()).toEqual([
        'initial_rule_missing',
        'profile_no_primary_owner_module',
      ]);
      await expect(callDraftValidate(seed.versionId)).rejects.toThrow(
        /initial_rule_missing/
      );
      await expect(callDraftValidate(seed.versionId)).rejects.toThrow(
        /profile_no_primary_owner_module/
      );
    } finally {
      await cleanupSeed(seed);
    }
  });
});

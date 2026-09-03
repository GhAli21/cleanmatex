/**
 * Shared structural report + write-lock tests.
 *
 * Extracts `sys_wf_prof_ver_live_rpt` from 0487 and
 * `sys_wf_prof_ver_validate_live` from 0479 into `pg_temp` so the predicates
 * can be proven from the latest function bodies. Observer-execute exceptions
 * come from `sys_wf_observer_exec_x_cd` (0479+).
 *
 * Local DB only. The suite skips when policy tables or the migration
 * files are unavailable. Agents never apply migrations.
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
const MIGRATION_0479_PATH = path.resolve(
  process.cwd(),
  '..',
  'supabase',
  'migrations',
  '0479_sys_wf_observer_exec_x_cd.sql'
);
const MIGRATION_0487_PATH = path.resolve(
  process.cwd(),
  '..',
  'supabase',
  'migrations',
  '0487_wf_live_rpt_create_presets.sql'
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
    await ensureObserverExecCatalog();
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
        )
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_screens_cd WHERE screen_key = 'canceling'
        )
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_screens_cd WHERE screen_key = 'order_control'
        )
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_actions_cd WHERE action_code = 'CANCEL_ORDER'
        )
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_actions_cd WHERE action_code = 'HOLD_ORDER_WORK'
        )
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_statuses_cd WHERE status_code = 'cancelled'
        )
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_statuses_cd WHERE status_code = 'processing'
        )
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_statuses_cd WHERE status_code = 'on_hold'
        )
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_statuses_cd WHERE status_code = 'draft'
        )
        AND EXISTS (
          SELECT 1 FROM public.sys_wf_create_presets_cd
          WHERE create_preset_code = 'BRANCH_DEFAULT'
            AND is_active = true
            AND rec_status = 1
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
        `[wf-validate-live-db] Local DB or 0479/0487 extract unavailable - skipping: ${name}`
      );
      return;
    }
    await fn();
  });
}

/**
 * Pulls live_rpt from 0487 and validate_live from 0479 so tests follow the
 * latest applied CREATE OR REPLACE bodies without calling public writers.
 */
function extractFnSql(fnName: 'sys_wf_prof_ver_live_rpt' | 'sys_wf_prof_ver_validate_live'): string {
  const sourcePath = fnName === 'sys_wf_prof_ver_live_rpt' ? MIGRATION_0487_PATH : MIGRATION_0479_PATH;
  const sql = readFileSync(sourcePath, 'utf8');
  const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${fnName}(`);
  const end = sql.indexOf(`\nREVOKE ALL ON FUNCTION public.${fnName}`, start);
  if (start < 0 || end < 0) {
    throw new Error(`Could not extract ${fnName} from ${path.basename(sourcePath)}`);
  }
  return sql
    .slice(start, end)
    .replaceAll('public.sys_wf_prof_ver_validate_live', 'pg_temp.sys_wf_prof_ver_validate_live')
    .replaceAll('public.sys_wf_prof_ver_live_rpt', 'pg_temp.sys_wf_prof_ver_live_rpt')
    .trim();
}

/** Ensures the observer-exec catalog exists for extracted live_rpt joins. */
async function ensureObserverExecCatalog(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS public.sys_wf_observer_exec_x_cd (
      exception_code TEXT PRIMARY KEY,
      screen_key TEXT NOT NULL,
      action_code TEXT NOT NULL,
      from_status TEXT NOT NULL,
      to_status TEXT NOT NULL,
      owner_screen_key TEXT NOT NULL,
      exec_module_mode TEXT NOT NULL,
      required_channel_code TEXT,
      is_active BOOLEAN NOT NULL DEFAULT true,
      name TEXT NOT NULL,
      name2 TEXT,
      description TEXT NOT NULL DEFAULT '',
      description2 TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_by TEXT,
      created_info TEXT,
      updated_at TIMESTAMPTZ,
      updated_by TEXT,
      updated_info TEXT,
      rec_status SMALLINT NOT NULL DEFAULT 1,
      rec_order INTEGER,
      rec_notes TEXT
    )
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE public.sys_wf_observer_exec_x_cd
      ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS description2 TEXT
  `);
  await prisma.$executeRawUnsafe(`
    INSERT INTO public.sys_wf_observer_exec_x_cd (
      exception_code, screen_key, action_code, from_status, to_status,
      owner_screen_key, exec_module_mode, required_channel_code,
      is_active, name, description, description2, rec_status, rec_order
    ) VALUES
      ('PICKUP_CONFIRM_READY', 'pickup_handover', 'CONFIRM_PICKUP', 'ready', 'delivered',
       'ready_release', 'primary_owner', NULL, true, 'pickup',
       'Allows pickup_handover CONFIRM_PICKUP from observed ready; ready_release owns ready.',
       'يسمح بتأكيد الاستلام من جاهز المراقب؛ إفراج الجاهز يملك جاهز.', 1, 10),
      ('PUBLIC_OFD_CONFIRM', 'public_tracking', 'CONFIRM_DELIVERY', 'out_for_delivery', 'delivered',
       'driver_delivery', 'cross_cutting_command', 'public_web', true, 'public ofd',
       'Allows public_tracking CONFIRM_DELIVERY from observed OFD on public_web; driver_delivery owns OFD.',
       'يسمح بتأكيد التوصيل العام من في الطريق على public_web؛ توصيل السائق يملك الحالة.', 1, 20),
      ('CANCEL_FROM_INTAKE', 'canceling', 'CANCEL_ORDER', 'intake', 'cancelled',
       'new_order', 'primary_owner', NULL, true, 'cancel',
       'Allows canceling CANCEL_ORDER from observed intake; new_order owns intake.',
       'يسمح بإلغاء الطلب من الاستلام المراقب؛ الطلب الجديد يملك الاستلام.', 1, 30),
      ('HOLD_FROM_PROCESSING', 'order_control', 'HOLD_ORDER_WORK', 'processing', 'on_hold',
       'processing', 'primary_owner', NULL, true, 'hold',
       'Allows order_control HOLD_ORDER_WORK from observed processing; processing owns processing.',
       'يسمح بتعليق العمل من التشغيل المراقب؛ التشغيل يملك التشغيل.', 1, 40)
    ON CONFLICT (exception_code) DO UPDATE SET
      description = EXCLUDED.description,
      description2 = EXCLUDED.description2
  `);
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
      version_id, rule_code, initial_status, priority, create_preset_code, is_active, rec_status
    ) VALUES (
      ${versionId}::uuid, 'INIT_DEFAULT', 'intake', 900, 'BRANCH_DEFAULT', true, 1
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

describe('0479/0487 sys_wf_prof_ver_live_rpt', () => {
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

  dbit('allows canceling CANCEL_ORDER from observed intake when new_order owns intake', async () => {
    const seed = await seedDraftVersion();
    try {
      await seedIntakeOwner(seed.versionId);
      await insertModule(seed.versionId, 'canceling', 'primary_owner', 60);
      await insertMembership(seed.versionId, 'canceling', 'intake', 'observer', 10);
      await insertMembership(seed.versionId, 'canceling', 'cancelled', 'owner', 20);
      await insertExec(seed.versionId, 'canceling', 'CANCEL_ORDER', 'intake', 'cancelled');
      await expect(callDraftValidate(seed.versionId)).resolves.toBeUndefined();
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('rejects canceling CANCEL_ORDER from observed intake when new_order does not own intake', async () => {
    const seed = await seedDraftVersion();
    try {
      await insertModule(seed.versionId, 'canceling', 'primary_owner', 10);
      await insertMembership(seed.versionId, 'canceling', 'intake', 'observer', 10);
      await insertMembership(seed.versionId, 'canceling', 'cancelled', 'owner', 20);
      await insertInitDefaultIntake(seed.versionId);
      await insertExec(seed.versionId, 'canceling', 'CANCEL_ORDER', 'intake', 'cancelled');
      await expect(callDraftValidate(seed.versionId)).rejects.toThrow(
        /execution_not_from_status_owner/
      );
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('allows order_control HOLD_ORDER_WORK from observed processing when processing owns it', async () => {
    const seed = await seedDraftVersion();
    try {
      await seedIntakeOwner(seed.versionId);
      await insertModule(seed.versionId, 'processing', 'primary_owner', 20);
      await insertMembership(seed.versionId, 'processing', 'processing', 'owner', 10);
      await insertModule(seed.versionId, 'order_control', 'primary_owner', 70);
      await insertMembership(seed.versionId, 'order_control', 'processing', 'observer', 10);
      await insertMembership(seed.versionId, 'order_control', 'on_hold', 'owner', 20);
      await insertExec(
        seed.versionId,
        'order_control',
        'HOLD_ORDER_WORK',
        'processing',
        'on_hold'
      );
      await expect(callDraftValidate(seed.versionId)).resolves.toBeUndefined();
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('rejects order_control HOLD_ORDER_WORK from observed processing without a processing owner', async () => {
    const seed = await seedDraftVersion();
    try {
      await seedIntakeOwner(seed.versionId);
      await insertModule(seed.versionId, 'order_control', 'primary_owner', 70);
      await insertMembership(seed.versionId, 'order_control', 'processing', 'observer', 10);
      await insertMembership(seed.versionId, 'order_control', 'on_hold', 'owner', 20);
      await insertExec(
        seed.versionId,
        'order_control',
        'HOLD_ORDER_WORK',
        'processing',
        'on_hold'
      );
      await expect(callDraftValidate(seed.versionId)).rejects.toThrow(
        /execution_not_from_status_owner/
      );
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('rejects an active Initial rule with a blank create preset', async () => {
    const seed = await seedDraftVersion();
    try {
      await insertModule(seed.versionId, 'new_order', 'primary_owner', 5);
      await insertMembership(seed.versionId, 'new_order', 'intake', 'owner', 10);
      await prisma.$executeRaw`
        INSERT INTO public.sys_wf_prof_ver_init_cf (
          version_id, rule_code, initial_status, priority, create_preset_code, is_active, rec_status
        ) VALUES (
          ${seed.versionId}::uuid, 'INIT_DEFAULT', 'intake', 900, NULL, true, 1
        )
      `;
      await expect(callDraftValidate(seed.versionId)).rejects.toThrow(
        /initial_rule_preset_missing/
      );
    } finally {
      await cleanupSeed(seed);
    }
  });

  dbit('rejects an active Initial rule whose create preset is inactive', async () => {
    const seed = await seedDraftVersion();
    const deadCode = `DEAD_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    try {
      await prisma.$executeRaw`
        INSERT INTO public.sys_wf_create_presets_cd (
          create_preset_code, name, description,
          physical_intake_status, stamp_physical_intake, stamp_received,
          preparation_status, stamp_prepared,
          is_active, rec_status, rec_notes
        ) VALUES (
          ${deadCode}, 'Dead test preset', 'Inactive catalog row for live_rpt unknown check',
          'pending_dropoff', false, false, 'pending', false,
          false, 1, '0487 db-integration'
        )
      `;
      await insertModule(seed.versionId, 'new_order', 'primary_owner', 5);
      await insertMembership(seed.versionId, 'new_order', 'intake', 'owner', 10);
      await prisma.$executeRaw`
        INSERT INTO public.sys_wf_prof_ver_init_cf (
          version_id, rule_code, initial_status, priority, create_preset_code, is_active, rec_status
        ) VALUES (
          ${seed.versionId}::uuid, 'INIT_DEFAULT', 'intake', 900, ${deadCode}, true, 1
        )
      `;
      await expect(callDraftValidate(seed.versionId)).rejects.toThrow(
        /initial_rule_preset_unknown/
      );
    } finally {
      await cleanupSeed(seed);
      await prisma.$executeRaw`
        DELETE FROM public.sys_wf_create_presets_cd WHERE create_preset_code = ${deadCode}
      `;
    }
  });

  dbit('rejects all-null matchers that start at draft', async () => {
    const seed = await seedDraftVersion();
    try {
      await insertModule(seed.versionId, 'new_order', 'primary_owner', 5);
      await insertMembership(seed.versionId, 'new_order', 'draft', 'owner', 10);
      await prisma.$executeRaw`
        INSERT INTO public.sys_wf_prof_ver_init_cf (
          version_id, rule_code, initial_status, priority, create_preset_code, is_active, rec_status
        ) VALUES (
          ${seed.versionId}::uuid, 'INIT_DEFAULT', 'draft', 900, 'BRANCH_DEFAULT', true, 1
        )
      `;
      await expect(callDraftValidate(seed.versionId)).rejects.toThrow(
        /initial_rule_wildcard_draft/
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

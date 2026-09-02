/** @jest-environment node */

jest.mock('server-only', () => ({}));

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import type { SemanticWorkflowOrderSnapshot } from '@/lib/services/workflow/semantic-workflow-artifact.service';
import {
  clearLiveWorkflowPolicyCache,
  loadLiveWorkflowPolicyForOrder,
  SemanticWorkflowArtifactError,
} from '@/lib/services/workflow/workflow-policy-resolver.service';

const snapshot: SemanticWorkflowOrderSnapshot = {
  wf_profile_id: 'a1000000-0000-4000-8000-000000000001',
  wf_version_no: 1,
  wf_profile_version_id: 'b1000000-0000-4000-8000-000000000001',
  wf_profile_artifact_id: null,
  wf_profile_revision: null,
  wf_profile_checksum: null,
  wf_profile_schema_version: null,
};

const versionRow = {
  version_id: snapshot.wf_profile_version_id as string,
  profile_id: snapshot.wf_profile_id as string,
  version_no: 1,
  version_status: 'PUBLISHED',
  policy_revision: 3,
  is_active: true,
  rec_status: 1,
};

function sqlText(call: unknown[]): string {
  const first = call[0];
  if (first && typeof first === 'object' && 'strings' in (first as object)) {
    return (first as { strings: readonly string[] }).strings.join(' ');
  }
  if (Array.isArray(first)) return first.map(String).join(' ');
  return String(first ?? '');
}

function liveRowsFor(sql: string): unknown[] {
  if (sql.includes('sys_wf_profile_ver_mst')) {
    return [{ ...versionRow }];
  }
  if (sql.includes('sys_wf_prof_ver_policy_cf')) {
    return [{ policy_schema_version: 1, allow_direct_counter_pickup: false }];
  }
  if (sql.includes('sys_wf_prof_ver_module_cf')) {
    return [{
      screen_key: 'new_order',
      module_mode: 'primary_owner',
      is_enabled: true,
      display_order: 1,
    }];
  }
  if (sql.includes('sys_wf_prof_ver_mod_st_cf')) {
    return [{
      screen_key: 'new_order',
      status_code: 'intake',
      visibility_mode: 'owner',
      display_order: 1,
    }];
  }
  if (sql.includes('sys_wf_prof_ver_exec_ch_cf')) {
    return [{
      exec_id: 'd1000000-0000-4000-8000-000000000001',
      channel_code: 'staff_web',
    }];
  }
  if (sql.includes('sys_wf_prof_ver_exec_gate_cf')) {
    return [];
  }
  if (sql.includes('sys_wf_prof_ver_exec_cf')) {
    return [{
      exec_id: 'd1000000-0000-4000-8000-000000000001',
      screen_key: 'new_order',
      action_code: 'CONFIRM_PHYSICAL_INTAKE',
      from_status: 'intake',
      to_status: 'preparation',
      transition_kind: 'fixed',
      requires_expected_version: true,
      requires_idempotency: true,
      requires_reason: false,
      min_reason_length: 0,
      requires_evidence: false,
      display_order: 1,
    }];
  }
  if (sql.includes('sys_wf_prof_ver_init_cf')) {
    return [{
      rule_code: 'DEFAULT',
      order_source_code: null,
      order_type_id: null,
      is_retail: null,
      is_quick_drop: null,
      initial_status: 'intake',
      priority: 1,
    }];
  }
  if (sql.includes('sys_wf_prof_ver_evidence_cf')) {
    return [];
  }
  return [];
}

describe('live workflow policy resolver', () => {
  const queryRaw = prisma.$queryRaw as jest.Mock;

  function sqls(): string[] {
    return queryRaw.mock.calls.map((call) => sqlText(call as unknown[]));
  }

  function countSql(needle: string): number {
    return sqls().filter((sql) => sql.includes(needle)).length;
  }

  beforeEach(() => {
    clearLiveWorkflowPolicyCache();
    jest.clearAllMocks();
    versionRow.version_status = 'PUBLISHED';
    versionRow.policy_revision = 3;
    versionRow.profile_id = snapshot.wf_profile_id as string;
    versionRow.version_no = 1;
    versionRow.is_active = true;
    versionRow.rec_status = 1;
    queryRaw.mockImplementation(async (...call: unknown[]) => liveRowsFor(sqlText(call)));
  });

  it('serves Published policy from cache and never re-reads assignment or artifact tables', async () => {
    await loadLiveWorkflowPolicyForOrder(snapshot);
    await loadLiveWorkflowPolicyForOrder(snapshot);

    expect(countSql('sys_wf_profile_ver_mst')).toBe(2);
    expect(countSql('sys_wf_prof_ver_policy_cf')).toBe(1);
    expect(sqls().some((sql) => sql.includes('sys_wf_prof_ver_artifact_cf'))).toBe(false);
    expect(sqls().some((sql) => sql.includes('org_wf_profile_assign_cf'))).toBe(false);
    expect(logger.debug).toHaveBeenCalledWith(
      'Workflow policy served from Published cache',
      expect.objectContaining({ event: 'wf.policy.cache_hit' }),
    );
  });

  it('reloads Pilot policy on every call so live Studio edits are visible', async () => {
    versionRow.version_status = 'PILOT';

    await loadLiveWorkflowPolicyForOrder(snapshot);
    await loadLiveWorkflowPolicyForOrder(snapshot);

    expect(countSql('sys_wf_prof_ver_policy_cf')).toBe(2);
    expect(logger.debug).not.toHaveBeenCalledWith(
      'Workflow policy served from Published cache',
      expect.anything(),
    );
  });

  it('misses Published cache when the live policy revision changes', async () => {
    await loadLiveWorkflowPolicyForOrder(snapshot);
    versionRow.policy_revision = 4;
    await loadLiveWorkflowPolicyForOrder(snapshot);

    expect(countSql('sys_wf_prof_ver_policy_cf')).toBe(2);
  });

  it('rejects a bound version whose profile id or status is not executable', async () => {
    versionRow.profile_id = 'c1000000-0000-4000-8000-000000000099';

    await expect(loadLiveWorkflowPolicyForOrder(snapshot)).rejects.toMatchObject<
      Partial<SemanticWorkflowArtifactError>
    >({
      code: 'PROFILE_ARTIFACT_UNAVAILABLE',
    });
    expect(countSql('sys_wf_prof_ver_policy_cf')).toBe(0);
  });

  it('rejects RETIRED versions without assembling live rows', async () => {
    versionRow.version_status = 'RETIRED';

    await expect(loadLiveWorkflowPolicyForOrder(snapshot)).rejects.toMatchObject<
      Partial<SemanticWorkflowArtifactError>
    >({
      code: 'PROFILE_ARTIFACT_UNAVAILABLE',
    });
    expect(countSql('sys_wf_prof_ver_exec_cf')).toBe(0);
  });

  it('fails closed when an executable has no active channel', async () => {
    queryRaw.mockImplementation(async (...call: unknown[]) => {
      const sql = sqlText(call);
      if (sql.includes('sys_wf_prof_ver_exec_ch_cf')) return [];
      return liveRowsFor(sql);
    });

    await expect(loadLiveWorkflowPolicyForOrder(snapshot)).rejects.toMatchObject<
      Partial<SemanticWorkflowArtifactError>
    >({
      code: 'PROFILE_ARTIFACT_INVALID',
    });
  });
});

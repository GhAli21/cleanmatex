jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    $queryRaw: jest.fn(),
  },
}));

import { prisma } from '@/lib/db/prisma';
import {
  clearSemanticWorkflowArtifactCache,
  loadSemanticWorkflowArtifactForOrder,
  SemanticWorkflowArtifactError,
  type SemanticWorkflowOrderSnapshot,
} from '@/lib/services/workflow/semantic-workflow-artifact.service';

const snapshot: SemanticWorkflowOrderSnapshot = {
  wf_profile_id: 'a1000000-0000-4000-8000-000000000001',
  wf_version_no: 1,
  wf_profile_version_id: 'b1000000-0000-4000-8000-000000000001',
  wf_profile_artifact_id: null,
  wf_profile_revision: 3,
  wf_profile_checksum: null,
  wf_profile_schema_version: null,
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
    return [{
      version_id: snapshot.wf_profile_version_id,
      profile_id: snapshot.wf_profile_id,
      version_no: 1,
      version_status: 'PUBLISHED',
      policy_revision: 3,
      is_active: true,
      rec_status: 1,
    }];
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

describe('live workflow policy loader', () => {
  const queryRaw = prisma.$queryRaw as jest.Mock;

  beforeEach(() => {
    clearSemanticWorkflowArtifactCache();
    queryRaw.mockReset();
    queryRaw.mockImplementation(async (...call: unknown[]) => liveRowsFor(sqlText(call)));
  });

  it('loads normalized profile-version rows and never reads the artifact table', async () => {
    await expect(loadSemanticWorkflowArtifactForOrder(snapshot)).resolves.toMatchObject({
      profile_id: snapshot.wf_profile_id,
      profile_version_id: snapshot.wf_profile_version_id,
      policy_revision: 3,
      allow_direct_counter_pickup: false,
    });
    const sqls = queryRaw.mock.calls.map((call) => sqlText(call as unknown[]));
    expect(sqls.some((sql) => sql.includes('sys_wf_profile_ver_mst'))).toBe(true);
    expect(sqls.some((sql) => sql.includes('sys_wf_prof_ver_exec_cf'))).toBe(true);
    expect(sqls.some((sql) => sql.includes('sys_wf_prof_ver_artifact_cf'))).toBe(false);
  });

  it('does not require historical artifact identity on the order binding', async () => {
    await expect(loadSemanticWorkflowArtifactForOrder({
      ...snapshot,
      wf_profile_artifact_id: null,
      wf_profile_checksum: null,
      wf_profile_schema_version: null,
      wf_profile_revision: null,
    })).resolves.toMatchObject({
      profile_version_id: snapshot.wf_profile_version_id,
    });
  });

  it('rejects a profile/version pin that is missing the version identity', async () => {
    await expect(loadSemanticWorkflowArtifactForOrder({
      wf_profile_id: snapshot.wf_profile_id,
      wf_version_no: 1,
      wf_profile_version_id: null,
      wf_profile_artifact_id: null,
      wf_profile_revision: null,
      wf_profile_checksum: null,
      wf_profile_schema_version: null,
    })).rejects.toMatchObject<Partial<SemanticWorkflowArtifactError>>({
      code: 'PROFILE_SNAPSHOT_INCOMPLETE',
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('returns null for an unbound legacy order', async () => {
    await expect(loadSemanticWorkflowArtifactForOrder({
      wf_profile_id: null,
      wf_version_no: null,
      wf_profile_version_id: null,
      wf_profile_artifact_id: null,
      wf_profile_revision: null,
      wf_profile_checksum: null,
      wf_profile_schema_version: null,
    })).resolves.toBeNull();
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('rejects a bound version that is not Pilot or Published', async () => {
    queryRaw.mockImplementation(async (...call: unknown[]) => {
      const sql = sqlText(call);
      if (sql.includes('sys_wf_profile_ver_mst')) {
        return [{
          version_id: snapshot.wf_profile_version_id,
          profile_id: snapshot.wf_profile_id,
          version_no: 1,
          version_status: 'DRAFT',
          policy_revision: 3,
          is_active: true,
          rec_status: 1,
        }];
      }
      return liveRowsFor(sql);
    });

    await expect(loadSemanticWorkflowArtifactForOrder(snapshot)).rejects.toMatchObject<Partial<SemanticWorkflowArtifactError>>({
      code: 'PROFILE_ARTIFACT_UNAVAILABLE',
    });
  });
});

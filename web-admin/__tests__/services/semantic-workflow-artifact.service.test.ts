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
  wf_profile_artifact_id: 'c1000000-0000-4000-8000-000000000001',
  wf_profile_revision: 3,
  wf_profile_checksum: 'a'.repeat(64),
  wf_profile_schema_version: 1,
};

function artifactRow() {
  return {
    artifact_id: snapshot.wf_profile_artifact_id,
    version_id: snapshot.wf_profile_version_id,
    policy_revision: snapshot.wf_profile_revision,
    artifact_schema_version: snapshot.wf_profile_schema_version,
    artifact_checksum: snapshot.wf_profile_checksum,
    compiled_artifact: {
      artifact_schema_version: 1,
      profile_id: snapshot.wf_profile_id,
      profile_version_id: snapshot.wf_profile_version_id,
      profile_version_no: snapshot.wf_version_no,
      policy_revision: snapshot.wf_profile_revision,
      policy_schema_version: 1,
      modules: [{
        screen_key: 'new_order',
        module_mode: 'primary_owner',
        is_enabled: true,
        display_order: 1,
      }],
      module_statuses: [{
        screen_key: 'new_order',
        status_code: 'intake',
        visibility_mode: 'owner',
        display_order: 1,
      }],
      executions: [{
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
        channels: [{ channel_code: 'staff_web' }],
        gates: [],
      }],
      initial_rules: [{
        rule_code: 'DEFAULT',
        order_source_code: null,
        order_type_id: null,
        is_retail: null,
        is_quick_drop: null,
        initial_status: 'intake',
        priority: 1,
      }],
      evidence: [],
    },
  };
}

describe('semantic workflow artifact loader', () => {
  const queryRaw = prisma.$queryRaw as jest.Mock;

  beforeEach(() => {
    clearSemanticWorkflowArtifactCache();
    queryRaw.mockReset();
  });

  it('loads the exact immutable artifact named by the order snapshot', async () => {
    queryRaw.mockResolvedValue([artifactRow()]);

    await expect(loadSemanticWorkflowArtifactForOrder(snapshot)).resolves.toMatchObject({
      profile_id: snapshot.wf_profile_id,
      profile_version_id: snapshot.wf_profile_version_id,
      policy_revision: 3,
    });
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects a partially populated semantic order snapshot', async () => {
    await expect(loadSemanticWorkflowArtifactForOrder({
      ...snapshot,
      wf_profile_checksum: null,
    })).rejects.toMatchObject<Partial<SemanticWorkflowArtifactError>>({
      code: 'PROFILE_SNAPSHOT_INCOMPLETE',
    });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('rejects an artifact whose embedded version does not match the order snapshot', async () => {
    const row = artifactRow();
    row.compiled_artifact.profile_version_no = 2;
    queryRaw.mockResolvedValue([row]);

    await expect(loadSemanticWorkflowArtifactForOrder(snapshot)).rejects.toMatchObject<Partial<SemanticWorkflowArtifactError>>({
      code: 'PROFILE_ARTIFACT_INVALID',
    });
  });
});

import { deriveSemanticWorkflowContext } from '@/lib/services/workflow/semantic-workflow-context.service';
import type { SemanticWorkflowArtifact } from '@/lib/services/workflow/semantic-workflow-artifact.service';

const artifact: SemanticWorkflowArtifact = {
  artifact_schema_version: 1,
  profile_id: 'a1000000-0000-4000-8000-000000000001',
  profile_version_id: 'b1000000-0000-4000-8000-000000000001',
  profile_version_no: 2,
  policy_revision: 4,
  policy_schema_version: 1,
  allow_direct_counter_pickup: false,
  policy: null,
  initial_rules: [],
  module_statuses: [],
  executions: [],
  evidence: [],
  modules: [
    { screen_key: 'processing', module_mode: 'primary_owner', is_enabled: true, display_order: 10 },
    { screen_key: 'QA', module_mode: 'primary_owner', is_enabled: true, display_order: 20 },
    { screen_key: 'packing', module_mode: 'primary_owner', is_enabled: false, display_order: 30 },
    { screen_key: 'workboard', module_mode: 'observer', is_enabled: true, display_order: 40 },
  ],
};

describe('semantic workflow context projection', () => {
  it('uses enabled immutable modules rather than live template stage flags', () => {
    expect(deriveSemanticWorkflowContext(artifact)).toEqual({
      profileId: artifact.profile_id,
      profileVersionNo: 2,
      policyRevision: 4,
      enabledScreenKeys: ['processing', 'qa', 'workboard'],
      primaryOwnerScreenKeys: ['processing', 'qa'],
      assemblyEnabled: false,
      qaEnabled: true,
      packingEnabled: false,
    });
  });
});

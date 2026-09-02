import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('semantic snapshot execution isolation', () => {
  it('executes only the order snapshot and never a live workflow catalog', () => {
    const source = readFileSync(
      join(process.cwd(), 'lib/services/workflow/workflow-engine.service.ts'),
      'utf8',
    );
    expect(source).not.toContain('pinned-workflow-graph');
    expect(source).not.toContain('sys_wf_screen_status_cd');
    expect(source).not.toContain('sys_wf_action_trans_cd');
    expect(source).not.toContain("kind: 'legacy'");
    expect(source).not.toContain('sys_wf_prof_ver_artifact_cf');
    expect(source).toContain('loadSemanticActionTransitions');
    expect(source).toContain('PROFILE_SNAPSHOT_INCOMPLETE');
  });

  it('keeps context and client commands on semantic-only API contracts', () => {
    const contextSource = readFileSync(
      join(process.cwd(), 'app/api/v1/orders/[id]/workflow-context/route.ts'),
      'utf8',
    );
    const transitionSource = readFileSync(
      join(process.cwd(), 'lib/hooks/use-order-transition.ts'),
      'utf8',
    );

    expect(contextSource).not.toContain('org_tenant_workflow_templates_cf');
    expect(contextSource).not.toContain('sys_workflow_template_cd');
    expect(contextSource).toContain('PROFILE_SNAPSHOT_INCOMPLETE');
    expect(transitionSource).not.toContain('isWorkflowEngineV2Enabled');
    expect(transitionSource).not.toContain('/transition');
    expect(transitionSource).toContain('postStaffWorkflowCommand');
  });

  it('loads live profile-version rows and never compiled artifact tables', () => {
    const files = [
      'lib/services/workflow/workflow-policy-resolver.service.ts',
      'lib/services/workflow/semantic-workflow-artifact.service.ts',
      'lib/services/workflow/workflow-profile-resolution.service.ts',
      'lib/services/workflow/stage-worklist-query.service.ts',
      'lib/services/workboard/workboard-query.service.ts',
      'lib/services/pickup/pickup-completion.service.ts',
      'lib/services/delivery/delivery-completion.service.ts',
      'lib/services/public-order-tracking.service.ts',
    ];
    for (const relative of files) {
      const source = readFileSync(join(process.cwd(), relative), 'utf8');
      expect(source).not.toContain('sys_wf_prof_ver_artifact_cf');
    }
    const resolver = readFileSync(
      join(process.cwd(), 'lib/services/workflow/workflow-policy-resolver.service.ts'),
      'utf8',
    );
    expect(resolver).not.toContain('current_artifact_id');
    expect(resolver).not.toContain('org_wf_profile_assign_cf');
    expect(resolver).toContain('sys_wf_prof_ver_exec_cf');
    expect(resolver).toContain('sys_wf_prof_ver_mod_st_cf');
  });
});

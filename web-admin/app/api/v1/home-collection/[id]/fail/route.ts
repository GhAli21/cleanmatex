import { createWorkflowStageCommandHandler } from '@/lib/api/workflow-stage-command-route';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

export const POST = createWorkflowStageCommandHandler({
  screen: 'home_collection',
  actionCode: WORKFLOW_ACTIONS.FAIL_HOME_COLLECTION,
  requireReason: true,
  minReasonLength: 10,
});

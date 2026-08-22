/**
 * POST /api/v1/qa/:id/pass
 *
 * Versioned adapter for PASS_QA. The route owns the screen and action so
 * callers cannot guess a destination or bypass the compiled artifact.
 */

import { createWorkflowStageCommandHandler } from '@/lib/api/workflow-stage-command-route';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

export const POST = createWorkflowStageCommandHandler({
  screen: 'qa',
  actionCode: WORKFLOW_ACTIONS.PASS_QA,
});

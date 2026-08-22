/**
 * POST /api/v1/processing/:id/complete
 *
 * Versioned adapter for COMPLETE_PROCESSING. The route owns the screen and
 * action so callers cannot guess a destination or bypass the compiled artifact.
 */

import { createWorkflowStageCommandHandler } from '@/lib/api/workflow-stage-command-route';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

export const POST = createWorkflowStageCommandHandler({
  screen: 'processing',
  actionCode: WORKFLOW_ACTIONS.COMPLETE_PROCESSING,
});

/**
 * POST /api/v1/packing/:id/complete
 *
 * Versioned adapter for COMPLETE_PACKING. The route owns the screen and
 * action so callers cannot guess a destination or bypass the compiled artifact.
 */

import { createWorkflowStageCommandHandler } from '@/lib/api/workflow-stage-command-route';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

export const POST = createWorkflowStageCommandHandler({
  screen: 'packing',
  actionCode: WORKFLOW_ACTIONS.COMPLETE_PACKING,
});

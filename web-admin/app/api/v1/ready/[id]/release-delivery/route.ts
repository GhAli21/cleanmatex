/**
 * POST /api/v1/ready/:id/release-delivery
 *
 * Versioned adapter for RELEASE_FOR_DELIVERY. The route owns the screen and
 * action so callers cannot guess a destination or bypass the compiled artifact.
 */

import { createWorkflowStageCommandHandler } from '@/lib/api/workflow-stage-command-route';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

export const POST = createWorkflowStageCommandHandler({
  screen: 'ready_release',
  actionCode: WORKFLOW_ACTIONS.RELEASE_FOR_DELIVERY,
});

/**
 * POST /api/v1/qa/:id/fail
 *
 * Versioned adapter for FAIL_QA. A reason is required because rework must
 * remain auditable and cannot be inferred from a destination guess.
 */

import { createWorkflowStageCommandHandler } from '@/lib/api/workflow-stage-command-route';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

export const POST = createWorkflowStageCommandHandler({
  screen: 'qa',
  actionCode: WORKFLOW_ACTIONS.FAIL_QA,
  requireReason: true,
  minReasonLength: 10,
});

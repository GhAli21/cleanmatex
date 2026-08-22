import 'server-only';

import { executeAction, type ExecuteActionResult } from '@/lib/services/workflow/workflow-engine.service';
import type { WorkflowActionCode } from '@/lib/constants/workflow-actions';
import type { SemanticWorkflowCommandChannel } from '@/lib/services/workflow/semantic-workflow-artifact.service';

/** Authenticated command accepted by every stage-owned workflow adapter. */
export interface WorkflowStageCommandInput {
  tenantId: string;
  orderId: string;
  actorUserId: string;
  actorName?: string;
  screen: string;
  actionCode: WorkflowActionCode | string;
  expectedStateVersion: number;
  idempotencyKey: string;
  input?: Record<string, unknown>;
  channel?: SemanticWorkflowCommandChannel;
  gateDecisions?: Array<{
    gateCode: string;
    acknowledgementChallenge?: string;
    overrideReason?: string;
  }>;
}

/**
 * Executes one stage-owned workflow command through the shared engine.
 * Stage routes own the screen and action code so callers cannot invent a
 * destination or bypass the compiled artifact.
 *
 * @param command authenticated tenant command with a server-owned screen/action
 * @returns engine result including the resulting status and state version
 */
export async function executeWorkflowStageCommand(
  command: WorkflowStageCommandInput,
): Promise<ExecuteActionResult> {
  return executeAction({
    tenantId: command.tenantId,
    orderId: command.orderId,
    screen: command.screen,
    actionCode: command.actionCode,
    expectedStateVersion: command.expectedStateVersion,
    actorUserId: command.actorUserId,
    actorName: command.actorName ?? 'Stage Service',
    input: command.input,
    idempotencyKey: command.idempotencyKey,
    channel: command.channel ?? 'staff_web',
    gateDecisions: command.gateDecisions,
  });
}

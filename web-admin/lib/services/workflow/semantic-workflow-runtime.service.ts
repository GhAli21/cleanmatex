import 'server-only';

import type {
  SemanticWorkflowArtifact,
  SemanticWorkflowCommandChannel,
  SemanticWorkflowExecution,
} from '@/lib/services/workflow/semantic-workflow-artifact.service';

/** Runtime action projection used by the common workflow command engine. */
export interface SemanticWorkflowActionTransition {
  actionCode: string;
  fromStatus: string;
  toStatus: string;
  transitionKind: 'fixed' | 'resume_from_hold';
  requiresReason: boolean;
  minReasonLength: number;
  requiresEvidence: boolean;
  gateCodes: string[];
  hasUnsupportedGateMode: boolean;
  displayOrder: number;
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function executionAllowsChannel(
  execution: SemanticWorkflowExecution,
  channel: SemanticWorkflowCommandChannel,
): boolean {
  return execution.channels.some((candidate) => candidate.channel_code === channel);
}

/**
 * Checks profile-owned and observer visibility without consulting mutable
 * screen catalog rows. Observers may see a status but cannot expose commands.
 */
export function isSemanticScreenStatusMember(
  artifact: SemanticWorkflowArtifact,
  screen: string,
  statusCode: string,
): boolean {
  const targetScreen = normalise(screen);
  const targetStatus = normalise(statusCode);
  const enabledScreens = new Set(
    artifact.modules
      .filter((module) => module.is_enabled)
      .map((module) => normalise(module.screen_key)),
  );

  return enabledScreens.has(targetScreen) && artifact.module_statuses.some(
    (membership) =>
      normalise(membership.screen_key) === targetScreen
      && normalise(membership.status_code) === targetStatus,
  );
}

/**
 * Resolves only command bindings that are explicitly present in an immutable
 * artifact. This prevents a later HQ catalog change from changing in-flight
 * order behavior or exposing an action on an unauthorized channel.
 */
export function loadSemanticActionTransitions(
  artifact: SemanticWorkflowArtifact,
  input: {
    screen: string;
    fromStatus: string;
    channel: SemanticWorkflowCommandChannel;
    actionCode?: string;
  },
): SemanticWorkflowActionTransition[] {
  const screen = normalise(input.screen);
  const fromStatus = normalise(input.fromStatus);
  const actionCode = input.actionCode?.trim();

  return artifact.executions
    .filter((execution) =>
      normalise(execution.screen_key) === screen
      && normalise(execution.from_status) === fromStatus
      && (!actionCode || execution.action_code === actionCode)
      && executionAllowsChannel(execution, input.channel),
    )
    .map((execution) => ({
      actionCode: execution.action_code,
      fromStatus: normalise(execution.from_status),
      toStatus: normalise(execution.to_status),
      transitionKind: execution.transition_kind,
      requiresReason: execution.requires_reason,
      minReasonLength: execution.min_reason_length,
      requiresEvidence: execution.requires_evidence,
      gateCodes: execution.gates.map((gate) => normalise(gate.gate_code)),
      // The command runtime deliberately supports hard blocks only. Any future
      // acknowledgement or override mode must be implemented atomically first.
      hasUnsupportedGateMode: execution.gates.some(
        (gate) => gate.blocking_mode !== 'hard_block',
      ),
      displayOrder: execution.display_order,
    }))
    .sort((left, right) =>
      left.displayOrder - right.displayOrder
      || left.actionCode.localeCompare(right.actionCode)
      || left.toStatus.localeCompare(right.toStatus),
    );
}

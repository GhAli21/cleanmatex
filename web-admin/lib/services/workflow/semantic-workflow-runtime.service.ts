import 'server-only';

import type {
  SemanticWorkflowArtifact,
  SemanticWorkflowCommandChannel,
  SemanticWorkflowExecution,
} from '@/lib/services/workflow/semantic-workflow-artifact.service';
import type { SemanticGateBinding } from '@/lib/services/workflow/workflow-gate-decision.service';

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
  gates: SemanticGateBinding[];
  hasUnsupportedGateMode: boolean;
  displayOrder: number;
}

function normalise(value: string): string {
  return value.trim().toLowerCase();
}

function isDirectCounterPickupExecution(
  artifact: SemanticWorkflowArtifact,
  execution: SemanticWorkflowExecution,
): boolean {
  if (
    normalise(execution.screen_key) !== 'pickup_handover'
    || execution.action_code !== 'CONFIRM_PICKUP'
    || normalise(execution.from_status) !== 'ready'
    || normalise(execution.to_status) !== 'delivered'
  ) {
    return false;
  }

  const pickup = artifact.modules.find(
    (module) =>
      module.is_enabled
      && module.module_mode === 'primary_owner'
      && normalise(module.screen_key) === 'pickup_handover',
  );
  const observesReady = artifact.module_statuses.some(
    (membership) =>
      normalise(membership.screen_key) === 'pickup_handover'
      && normalise(membership.status_code) === 'ready'
      && membership.visibility_mode === 'observer',
  );
  const readyReleaseOwnsReady = artifact.modules.some(
    (module) =>
      module.is_enabled
      && module.module_mode === 'primary_owner'
      && normalise(module.screen_key) === 'ready_release',
  ) && artifact.module_statuses.some(
    (membership) =>
      normalise(membership.screen_key) === 'ready_release'
      && normalise(membership.status_code) === 'ready'
      && membership.visibility_mode === 'owner',
  );

  return Boolean(
    pickup
    && observesReady
    && readyReleaseOwnsReady
    && artifact.allow_direct_counter_pickup,
  );
}

function executionHasCommandAuthority(
  artifact: SemanticWorkflowArtifact,
  execution: SemanticWorkflowExecution,
): boolean {
  return isSemanticScreenStatusCommandEnabled(
    artifact,
    execution.screen_key,
    execution.from_status,
  ) || isDirectCounterPickupExecution(artifact, execution);
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
 *
 * @param artifact - Immutable compiled profile artifact named by the order.
 * @param screen - Requested workflow screen key.
 * @param statusCode - Order status being rendered on that screen.
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
 * Determines whether a screen has an explicit command authority for a status.
 * Ordinary observer screens are read-only. A `cross_cutting_command` module is
 * the explicit exception used for non-owner command surfaces such as public
 * tracking; it still needs a declared status membership and execution edge.
 *
 * @param artifact - Immutable compiled profile artifact named by the order.
 * @param screen - Requested workflow screen key.
 * @param statusCode - Order status being acted upon.
 */
export function isSemanticScreenStatusCommandEnabled(
  artifact: SemanticWorkflowArtifact,
  screen: string,
  statusCode: string,
): boolean {
  const targetScreen = normalise(screen);
  const targetStatus = normalise(statusCode);
  const screenModule = artifact.modules.find(
    (candidate) => candidate.is_enabled && normalise(candidate.screen_key) === targetScreen,
  );
  if (!screenModule || screenModule.module_mode === 'observer') return false;

  const membership = artifact.module_statuses.find(
    (candidate) =>
      normalise(candidate.screen_key) === targetScreen
      && normalise(candidate.status_code) === targetStatus,
  );
  if (!membership) return false;

  return screenModule.module_mode === 'cross_cutting_command'
    || membership.visibility_mode === 'owner';
}

/**
 * Resolves only command bindings that are explicitly present in an immutable
 * artifact. This prevents a later HQ catalog change from changing in-flight
 * order behavior or exposing an action on an unauthorized channel.
 *
 * @param artifact - Immutable compiled profile artifact named by the order.
 * @param input - Server-derived screen, status, channel, and optional action filter.
 * @param input.screen - Requested workflow screen key.
 * @param input.fromStatus - Current order status.
 * @param input.channel - Server-assigned command channel.
 * @param input.actionCode - Optional exact configured action code.
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
      executionHasCommandAuthority(artifact, execution)
      && normalise(execution.screen_key) === screen
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
      gates: execution.gates.map((gate) => ({
        gate_code: normalise(gate.gate_code),
        blocking_mode: gate.blocking_mode,
        evaluator_version: gate.evaluator_version,
        input_schema_version: gate.input_schema_version,
        override_permission_code: 'override_permission_code' in gate
          ? (gate.override_permission_code as string | null | undefined) ?? null
          : null,
        override_min_reason_length: 'override_min_reason_length' in gate
          ? Number(gate.override_min_reason_length ?? 0)
          : 0,
        message_key: 'message_key' in gate ? (gate.message_key as string | null | undefined) ?? null : null,
      })),
      hasUnsupportedGateMode: execution.gates.some(
        (gate) =>
          gate.blocking_mode !== 'hard_block'
          && gate.blocking_mode !== 'soft_warning'
          && gate.blocking_mode !== 'override_allowed',
      ),
      displayOrder: execution.display_order,
    }))
    .sort((left, right) =>
      left.displayOrder - right.displayOrder
      || left.actionCode.localeCompare(right.actionCode)
      || left.toStatus.localeCompare(right.toStatus),
    );
}

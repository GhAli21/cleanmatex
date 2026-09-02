import { logger, type LogContext } from '@/lib/utils/logger';

/**
 * Stable observe event names for log aggregation and in-process counters.
 * Support searches `event` starting with `wf.`; do not add PII-bearing names.
 */
export const WORKFLOW_OBSERVE_EVENT = {
  POLICY_UNBOUND: 'wf.policy.unbound',
  POLICY_INCOMPLETE: 'wf.policy.incomplete',
  POLICY_UNAVAILABLE: 'wf.policy.unavailable',
  POLICY_LOADED: 'wf.policy.loaded',
  POLICY_CACHE_HIT: 'wf.policy.cache_hit',
  COMMAND_OK: 'wf.command.ok',
  COMMAND_DENIED: 'wf.command.denied',
  COMMAND_CONFLICT: 'wf.command.conflict',
  COMMAND_REPLAY: 'wf.command.idempotent_replay',
  COMMAND_PROFILE: 'wf.command.profile_integrity',
  COMMAND_ERROR: 'wf.command.error',
  PICKUP_COMMITTED: 'wf.pickup.committed',
  DELIVERY_COMMITTED: 'wf.delivery.committed',
  PUBLIC_CONFIRM_REJECTED: 'wf.public_confirm.rejected',
} as const;

/** Union of privacy-safe workflow observe event names. */
export type WorkflowObserveEvent =
  (typeof WORKFLOW_OBSERVE_EVENT)[keyof typeof WORKFLOW_OBSERVE_EVENT];

const FORBIDDEN_CONTEXT_KEY =
  /token|password|secret|authorization|note|proof|object.?key|amount|phone|email|signature|photo|handover|idempotency/i;

const metrics = new Map<WorkflowObserveEvent, number>();

/**
 * Privacy-safe log context for workflow observe events.
 * Tracking tokens, proof keys, money, notes, and PII are dropped, not redacted.
 *
 * @param context Candidate fields from a resolver or command path
 * @returns Fields safe to send to the shared logger
 */
export function toWorkflowObserveContext(context: LogContext): LogContext {
  const safe: LogContext = { feature: 'workflow' };
  for (const [key, value] of Object.entries(context)) {
    if (FORBIDDEN_CONTEXT_KEY.test(key)) continue;
    if (value === undefined) continue;
    safe[key] = value;
  }
  return safe;
}

/**
 * Increments an in-process counter so tests and a future exporter can count
 * policy/command outcomes without standing up a metrics backend.
 *
 * @param event Stable observe event name
 * @returns void
 */
export function incrementWorkflowObserveMetric(event: WorkflowObserveEvent): void {
  metrics.set(event, (metrics.get(event) ?? 0) + 1);
}

/**
 * Returns a copy of the in-process observe counters.
 *
 * @returns Event name to count
 */
export function getWorkflowObserveMetrics(): Record<string, number> {
  return Object.fromEntries(metrics.entries());
}

/**
 * Test-only reset of in-process observe counters.
 *
 * @returns void
 */
export function resetWorkflowObserveMetrics(): void {
  metrics.clear();
}

function emit(
  level: 'debug' | 'info' | 'warn',
  event: WorkflowObserveEvent,
  message: string,
  context: LogContext,
): void {
  incrementWorkflowObserveMetric(event);
  const payload = toWorkflowObserveContext({ ...context, event, action: event });
  if (level === 'debug') logger.debug(message, payload);
  else if (level === 'warn') logger.warn(message, payload);
  else logger.info(message, payload);
}

/** Policy-load outcomes that must stay fail-closed and countable. */
export type WorkflowPolicyObserveOutcome =
  | 'unbound'
  | 'incomplete'
  | 'unavailable'
  | 'loaded'
  | 'cache_hit';

/**
 * Records a live-policy load. Failures are warnings; cache hits and successful
 * loads are debug so floor worklists do not flood INFO.
 *
 * @param input Tenant-safe policy identifiers and outcome
 * @returns void
 */
export function observeWorkflowPolicy(input: {
  tenantId?: string;
  orderId?: string;
  profileId?: string | null;
  profileVersionId?: string | null;
  versionNo?: number | null;
  policyRevision?: number | null;
  versionStatus?: string;
  cacheHit?: boolean;
  outcome: WorkflowPolicyObserveOutcome;
  latencyMs: number;
}): void {
  const context: LogContext = {
    tenantId: input.tenantId,
    orderId: input.orderId,
    profileId: input.profileId ?? undefined,
    profileVersionId: input.profileVersionId ?? undefined,
    versionNo: input.versionNo ?? undefined,
    policyRevision: input.policyRevision ?? undefined,
    versionStatus: input.versionStatus,
    cacheHit: input.cacheHit,
    latencyMs: input.latencyMs,
  };
  if (input.outcome === 'unbound') {
    emit('warn', WORKFLOW_OBSERVE_EVENT.POLICY_UNBOUND, 'Workflow policy unbound', context);
    return;
  }
  if (input.outcome === 'incomplete') {
    emit('warn', WORKFLOW_OBSERVE_EVENT.POLICY_INCOMPLETE, 'Workflow policy binding incomplete', context);
    return;
  }
  if (input.outcome === 'unavailable') {
    emit('warn', WORKFLOW_OBSERVE_EVENT.POLICY_UNAVAILABLE, 'Workflow policy version is not executable', context);
    return;
  }
  if (input.outcome === 'cache_hit') {
    emit('debug', WORKFLOW_OBSERVE_EVENT.POLICY_CACHE_HIT, 'Workflow policy served from Published cache', context);
    return;
  }
  emit('debug', WORKFLOW_OBSERVE_EVENT.POLICY_LOADED, 'Workflow policy loaded from live rows', context);
}

/** Command-execute outcomes used for HTTP-adjacent support diagnosis. */
export type WorkflowCommandObserveOutcome =
  | 'ok'
  | 'denied'
  | 'conflict'
  | 'replay'
  | 'profile'
  | 'error';

/**
 * Classifies a thrown engine failure without importing the engine module
 * (avoids a circular dependency from observe → engine → observe).
 *
 * @param error Unknown catch value from executeAction
 * @returns Observe outcome bucket
 */
export function classifyWorkflowCommandError(error: unknown): WorkflowCommandObserveOutcome {
  const code = error && typeof error === 'object' && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
  if (code === 'VERSION_CONFLICT' || code.startsWith('IDEMPOTENCY')) return 'conflict';
  if (code.startsWith('PROFILE_')) return 'profile';
  if (
    code === 'ACTION_NOT_ALLOWED'
    || code === 'GATE_FAILED'
    || code === 'REASON_REQUIRED'
    || code === 'UNSUPPORTED_GATE_MODE'
    || code === 'EVIDENCE_RUNTIME_UNAVAILABLE'
    || code.startsWith('WF_GATE_')
  ) {
    return 'denied';
  }
  return 'error';
}

/**
 * Records a workflow command execute result. Does not log input, notes, or keys.
 *
 * @param input Adapter-owned command identifiers
 * @returns void
 */
export function observeWorkflowCommand(input: {
  tenantId: string;
  orderId: string;
  screen: string;
  actionCode: string;
  channel: string;
  profileVersionId?: string | null;
  policyRevision?: number | null;
  outcome: WorkflowCommandObserveOutcome;
  errorCode?: string;
  latencyMs: number;
  requestId?: string;
}): void {
  const context: LogContext = {
    tenantId: input.tenantId,
    orderId: input.orderId,
    screen: input.screen,
    actionCode: input.actionCode,
    channel: input.channel,
    profileVersionId: input.profileVersionId ?? undefined,
    policyRevision: input.policyRevision ?? undefined,
    errorCode: input.errorCode,
    latencyMs: input.latencyMs,
    requestId: input.requestId,
  };
  if (input.outcome === 'ok') {
    emit('info', WORKFLOW_OBSERVE_EVENT.COMMAND_OK, 'Workflow command committed', context);
    return;
  }
  if (input.outcome === 'replay') {
    emit('info', WORKFLOW_OBSERVE_EVENT.COMMAND_REPLAY, 'Workflow command idempotent replay', context);
    return;
  }
  if (input.outcome === 'conflict') {
    emit('warn', WORKFLOW_OBSERVE_EVENT.COMMAND_CONFLICT, 'Workflow command conflict', context);
    return;
  }
  if (input.outcome === 'denied') {
    emit('warn', WORKFLOW_OBSERVE_EVENT.COMMAND_DENIED, 'Workflow command denied', context);
    return;
  }
  if (input.outcome === 'profile') {
    emit('warn', WORKFLOW_OBSERVE_EVENT.COMMAND_PROFILE, 'Workflow command blocked by live policy', context);
    return;
  }
  emit('warn', WORKFLOW_OBSERVE_EVENT.COMMAND_ERROR, 'Workflow command failed', context);
}

/**
 * Records a stage-owned pickup or delivery commit (in addition to adapter logs).
 *
 * @param input Fulfilment identifiers without proof or money fields
 * @returns void
 */
export function observeWorkflowFulfilmentCommitted(input: {
  kind: 'pickup' | 'delivery';
  tenantId: string;
  orderId: string;
  channel?: string;
  profileVersionId?: string | null;
  latencyMs?: number;
}): void {
  const event = input.kind === 'pickup'
    ? WORKFLOW_OBSERVE_EVENT.PICKUP_COMMITTED
    : WORKFLOW_OBSERVE_EVENT.DELIVERY_COMMITTED;
  emit('info', event, `Workflow ${input.kind} committed`, {
    tenantId: input.tenantId,
    orderId: input.orderId,
    channel: input.channel,
    profileVersionId: input.profileVersionId ?? undefined,
    latencyMs: input.latencyMs,
  });
}

/**
 * Records a public confirm-received rejection without the tracking token.
 *
 * @param input Tenant-safe reject identifiers
 * @returns void
 */
export function observePublicConfirmRejected(input: {
  tenantId: string;
  orderId?: string;
  code?: string;
  httpStatus: number;
}): void {
  emit('warn', WORKFLOW_OBSERVE_EVENT.PUBLIC_CONFIRM_REJECTED, 'Public confirm-received rejected', {
    tenantId: input.tenantId,
    orderId: input.orderId,
    errorCode: input.code,
    httpStatus: input.httpStatus,
  });
}

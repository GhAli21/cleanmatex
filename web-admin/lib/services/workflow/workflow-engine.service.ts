import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { OUTBOX_STATUSES } from '@/lib/constants/order-financial';
import {
  WORKFLOW_ACTIONS,
  WORKFLOW_ACTION_IDEMPOTENCY_RESOURCE,
  WORKFLOW_OUTBOX_EVENT_TYPE,
  type WorkflowActionCode,
} from '@/lib/constants/workflow-actions';
import {
  findIdempotencyHash,
  hashPayload,
  stakeIdempotencyHash,
} from '@/lib/utils/idempotency';
import {
  classifyWorkflowCommandError,
  observeWorkflowCommand,
} from '@/lib/services/workflow/workflow-observability';
import { resolveOrderControlTransition } from '@/lib/workflow/order-control-transition';
import {
  loadSemanticWorkflowArtifactForOrder,
  SemanticWorkflowArtifactError,
  type SemanticWorkflowArtifact,
  type SemanticWorkflowCommandChannel,
} from '@/lib/services/workflow/semantic-workflow-artifact.service';
import {
  isSemanticScreenStatusMember,
  loadSemanticActionTransitions,
} from '@/lib/services/workflow/semantic-workflow-runtime.service';
import {
  evaluateWorkflowGateSet,
  type WorkflowGateBlockedReason,
} from '@/lib/services/workflow/workflow-gate-evaluator.service';
import { loadWorkflowGateFacts } from '@/lib/services/workflow/workflow-gate-facts.service';
import {
  assertAndRecordSemanticGateDecisions,
  buildAvailableGateDecisions,
  classifySemanticGateFailures,
  WorkflowGateDecisionError,
  type AvailableGateDecision,
  type SemanticGateBinding,
  type SubmittedGateDecision,
} from '@/lib/services/workflow/workflow-gate-decision.service';
import { hasPermissionServer } from '@/lib/services/permission-service-server';

// ─── Error types ───────────────────────────────────────────────────────────

export type WorkflowEngineErrorCode =
  | 'VERSION_CONFLICT'
  | 'GATE_FAILED'
  | 'ACTION_NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT'
  | 'PROFILE_SNAPSHOT_INCOMPLETE'
  | 'PROFILE_ARTIFACT_UNAVAILABLE'
  | 'PROFILE_ARTIFACT_INVALID'
  | 'PROFILE_EXECUTION_INVALID'
  | 'UNSUPPORTED_GATE_MODE'
  | 'REASON_REQUIRED'
  | 'EVIDENCE_RUNTIME_UNAVAILABLE'
  | 'WF_GATE_HARD_BLOCKED'
  | 'WF_GATE_ACK_REQUIRED'
  | 'WF_GATE_ACK_INVALID'
  | 'WF_GATE_OVERRIDE_FORBIDDEN'
  | 'WF_GATE_OVERRIDE_REASON_INVALID'
  | 'WF_GATE_EVALUATOR_UNAVAILABLE'
  | 'WF_GATE_EVALUATION_STALE';

/** Local alias keeps the public command contract stable while gate ownership is shared. */
export type BlockedReason = WorkflowGateBlockedReason;

export class WorkflowEngineError extends Error {
  readonly code: WorkflowEngineErrorCode;
  readonly blockedReasons?: BlockedReason[];

  constructor(
    code: WorkflowEngineErrorCode,
    message: string,
    blockedReasons?: BlockedReason[],
  ) {
    super(message);
    this.name = 'WorkflowEngineError';
    this.code = code;
    this.blockedReasons = blockedReasons;
  }
}

// ─── Public result shapes ────────────────────────────────────────────────────

export interface AvailableAction {
  actionCode: string;
  /** Destination status for this edge (disambiguates skip-path duplicates). */
  toStatus: string;
  label: string;
  label2: string | null;
  enabled: boolean;
  blockedReasons: BlockedReason[];
  /** Lets channel clients render the mandated reason field before command submission. */
  requiresReason?: boolean;
  minReasonLength?: number;
  gateDecisions?: AvailableGateDecision[];
}

export interface ListAvailableActionsResult {
  stateVersion: number;
  currentStatus: string;
  actions: AvailableAction[];
}

export interface ExecuteActionResult {
  ok: boolean;
  currentStatus: string;
  stateVersion: number;
  blockedReasons?: BlockedReason[];
}

export interface ListAvailableActionsParams {
  tenantId: string;
  orderId: string;
  screen: string;
  locale?: string;
  /** Caller channel is a server-owned capability, not an end-user-selected field. */
  channel?: SemanticWorkflowCommandChannel;
  actorUserId?: string;
}

export interface ExecuteActionParams {
  tenantId: string;
  orderId: string;
  screen: string;
  actionCode: string;
  expectedStateVersion: number;
  actorUserId: string;
  actorName?: string;
  input?: Record<string, unknown>;
  idempotencyKey: string;
  /** Caller channel is supplied by the adapter that authenticated the request. */
  channel?: SemanticWorkflowCommandChannel;
  gateDecisions?: SubmittedGateDecision[];
  requestCorrelationId?: string;
  canOverridePermission?: (permissionCode: string) => Promise<boolean>;
}

// ─── Internal row types (raw SQL — tables may not be in Prisma yet) ──────────

type LockedOrderRow = {
  id: string;
  tenant_org_id: string;
  current_status: string | null;
  status: string | null;
  state_version: bigint | number | null;
  preparation_status: string | null;
  rack_location: string | null;
  payment_type_code: string | null;
  outstanding_amount: number | string | null;
  hold_from_status: string | null;
  wf_profile_id: string | null;
  wf_version_no: number | null;
  wf_profile_version_id: string | null;
  wf_profile_artifact_id: string | null;
  wf_profile_revision: number | null;
  wf_profile_checksum: string | null;
  wf_profile_schema_version: number | null;
};

type ActionTransitionRow = {
  action_code: string;
  name: string;
  name2: string | null;
  action_permission_code: string | null;
  from_status: string;
  to_status: string;
  gate_set_code: string | null;
  transition_permission_code: string | null;
  transition_kind: 'fixed' | 'resume_from_hold';
  requires_reason: boolean;
  min_reason_length: number;
  requires_evidence: boolean;
  has_unsupported_gate_mode: boolean;
  is_semantic: boolean;
  semantic_gates: SemanticGateBinding[];
};

type ResolvedWorkflowRuntime = {
  artifact: SemanticWorkflowArtifact;
};

/**
 * Prisma transaction scope accepted by workflow commands that must be composed
 * with a stage-owned write without splitting the business transaction.
 */
export type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// The engine still owns the atomic preparation completion side effect.
const PREPARATION_COMPLETED = 'completed';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeStatus(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeScreen(value: string): string {
  return value.trim().toLowerCase();
}

function readStateVersion(row: LockedOrderRow): number {
  if (row.state_version == null) return 0;
  return typeof row.state_version === 'bigint'
    ? Number(row.state_version)
    : Number(row.state_version);
}

function parseGateSet(gateSetCode: string | null | undefined): string[] {
  if (!gateSetCode?.trim()) return [];
  return gateSetCode
    .split(/[,;|]/)
    .map((g) => g.trim().toLowerCase())
    .filter(Boolean);
}

function pickLabel(row: { name: string; name2: string | null }, locale?: string): string {
  if (locale?.toLowerCase().startsWith('ar') && row.name2) {
    return row.name2;
  }
  return row.name;
}

async function loadOrderForRead(
  tenantId: string,
  orderId: string,
): Promise<LockedOrderRow> {
  const rows = await prisma.$queryRaw<LockedOrderRow[]>`
    SELECT
      id,
      tenant_org_id,
      current_status,
      status,
      COALESCE(state_version, 0)::bigint AS state_version,
      preparation_status,
      rack_location,
      payment_type_code,
      outstanding_amount,
      hold_from_status,
      wf_profile_id::text,
      wf_version_no,
      wf_profile_version_id::text,
      wf_profile_artifact_id::text,
      wf_profile_revision,
      wf_profile_checksum,
      wf_profile_schema_version
    FROM public.org_orders_mst
    WHERE id = ${orderId}::uuid
      AND tenant_org_id = ${tenantId}::uuid
    LIMIT 1
  `;
  const row = rows[0];
  if (!row) {
    throw new WorkflowEngineError('NOT_FOUND', 'Order not found');
  }
  return row;
}

async function loadOrderForUpdate(
  tx: PrismaTransactionClient,
  tenantId: string,
  orderId: string,
): Promise<LockedOrderRow> {
  const rows = await tx.$queryRaw<LockedOrderRow[]>`
    SELECT
      id,
      tenant_org_id,
      current_status,
      status,
      COALESCE(state_version, 0)::bigint AS state_version,
      preparation_status,
      rack_location,
      payment_type_code,
      outstanding_amount,
      hold_from_status,
      wf_profile_id::text,
      wf_version_no,
      wf_profile_version_id::text,
      wf_profile_artifact_id::text,
      wf_profile_revision,
      wf_profile_checksum,
      wf_profile_schema_version
    FROM public.org_orders_mst
    WHERE id = ${orderId}::uuid
      AND tenant_org_id = ${tenantId}::uuid
    FOR UPDATE
  `;
  const row = rows[0];
  if (!row) {
    throw new WorkflowEngineError('NOT_FOUND', 'Order not found');
  }
  return row;
}

function runtimeArtifact(
  runtime: ResolvedWorkflowRuntime,
): SemanticWorkflowArtifact {
  return runtime.artifact;
}

/**
 * Resolves the live runtime policy named by the order's profile-version binding.
 * Artifact columns are historical audit only.
 */
async function resolveWorkflowRuntimeForOrder(
  order: LockedOrderRow,
): Promise<ResolvedWorkflowRuntime> {
  try {
    const artifact = await loadSemanticWorkflowArtifactForOrder(order);
    if (artifact) return { artifact };
  } catch (error) {
    if (error instanceof SemanticWorkflowArtifactError) {
      throw new WorkflowEngineError(error.code, error.message);
    }
    throw error;
  }

  throw new WorkflowEngineError(
    'PROFILE_SNAPSHOT_INCOMPLETE',
    'This order has no workflow profile-version binding and cannot be operated. Recreate the order under an assigned workflow profile.',
  );
}
async function isScreenStatusMemberForOrder(
  order: LockedOrderRow,
  screen: string,
  statusCode: string,
  runtime?: ResolvedWorkflowRuntime,
): Promise<boolean> {
  const resolved = runtime ?? (await resolveWorkflowRuntimeForOrder(order));
  return isSemanticScreenStatusMember(resolved.artifact, screen, statusCode);
}

function semanticActionLabels(actionCode: string): { name: string; name2: string } {
  const labels: Record<string, { name: string; name2: string }> = {
    CONFIRM_PHYSICAL_INTAKE: { name: 'Confirm physical intake', name2: 'تأكيد الاستلام الفعلي' },
    SEND_TO_PREPARATION: { name: 'Send to preparation', name2: 'إرسال إلى التحضير' },
    COMPLETE_PREPARATION: { name: 'Complete preparation', name2: 'إكمال التحضير' },
    COMPLETE_PROCESSING: { name: 'Complete processing', name2: 'إكمال المعالجة' },
    COMPLETE_ASSEMBLY: { name: 'Complete assembly', name2: 'إكمال التجميع' },
    PASS_QA: { name: 'Pass quality check', name2: 'اجتياز فحص الجودة' },
    FAIL_QA: { name: 'Fail quality check', name2: 'فشل فحص الجودة' },
    COMPLETE_PACKING: { name: 'Complete packing', name2: 'إكمال التغليف' },
    MARK_READY: { name: 'Mark as ready', name2: 'تحديد كجاهز' },
    RELEASE_FOR_PICKUP: { name: 'Make available for pickup', name2: 'إتاحة للاستلام' },
    CONFIRM_PICKUP: { name: 'Confirm customer pickup', name2: 'تأكيد استلام العميل' },
    RELEASE_FOR_DELIVERY: { name: 'Release for delivery', name2: 'إتاحة للتوصيل' },
    CONFIRM_DELIVERY: { name: 'Confirm delivery', name2: 'تأكيد التسليم' },
    CANCEL_ORDER: { name: 'Cancel order', name2: 'إلغاء الطلب' },
    RETURN_ORDER: { name: 'Return order', name2: 'إرجاع الطلب' },
    HOLD_ORDER_WORK: { name: 'Hold order work', name2: 'تعليق عمل الطلب' },
    RESUME_ORDER_WORK: { name: 'Resume order work', name2: 'استئناف عمل الطلب' },
    STOP_ORDER_WORK: { name: 'Stop order work', name2: 'إيقاف عمل الطلب' },
  };
  return labels[actionCode] ?? {
    name: actionCode.replaceAll('_', ' ').toLowerCase(),
    name2: actionCode,
  };
}
async function loadActionTransitionsForOrder(
  order: LockedOrderRow,
  screen: string,
  fromStatus: string,
  actionCode?: string,
  runtime?: ResolvedWorkflowRuntime,
  channel: SemanticWorkflowCommandChannel = 'staff_web',
): Promise<ActionTransitionRow[]> {
  const resolved = runtime ?? (await resolveWorkflowRuntimeForOrder(order));
  return loadSemanticActionTransitions(resolved.artifact, {
    screen,
    fromStatus,
    actionCode,
    channel,
  }).map((transition) => {
    const labels = semanticActionLabels(transition.actionCode);
    return {
      action_code: transition.actionCode,
      name: labels.name,
      name2: labels.name2,
      action_permission_code: null,
      from_status: transition.fromStatus,
      to_status: transition.toStatus,
      gate_set_code: transition.gateCodes.join(','),
      transition_permission_code: null,
      transition_kind: transition.transitionKind,
      requires_reason: transition.requiresReason,
      min_reason_length: transition.minReasonLength,
      requires_evidence: transition.requiresEvidence,
      has_unsupported_gate_mode: transition.hasUnsupportedGateMode,
      is_semantic: true,
      semantic_gates: transition.gates,
    };
  });
}

function unsupportedGateModeBlockedReason(locale?: string): BlockedReason {
  const isArabic = locale?.toLowerCase().startsWith('ar');
  return {
    code: 'GATE_DECISION_MODE_UNAVAILABLE',
    message: isArabic
      ? 'يتطلب هذا الإجراء وضع قرار بوابة غير مدعوم بعد.'
      : 'This action requires a gate decision mode that is not available yet.',
    message2: isArabic
      ? 'This action requires a gate decision mode that is not available yet.'
      : 'يتطلب هذا الإجراء وضع قرار بوابة غير مدعوم بعد.',
  };
}

function evidenceRuntimeBlockedReason(locale?: string): BlockedReason {
  const isArabic = locale?.toLowerCase().startsWith('ar');
  return {
    code: 'EVIDENCE_RUNTIME_UNAVAILABLE',
    message: isArabic
      ? 'يتطلب هذا الإجراء دليلاً لم يتم تفعيل وقت تشغيله بعد.'
      : 'This action requires evidence, but the evidence runtime is not available yet.',
    message2: isArabic
      ? 'This action requires evidence, but the evidence runtime is not available yet.'
      : 'يتطلب هذا الإجراء دليلاً لم يتم تفعيل وقت تشغيله بعد.',
  };
}

function hasRequiredReason(
  input: Record<string, unknown> | undefined,
  minimumLength: number,
): boolean {
  const candidate =
    (typeof input?.reason === 'string' && input.reason)
    || (typeof input?.notes === 'string' && input.notes)
    || (typeof input?.hold_note === 'string' && input.hold_note)
    || (typeof input?.stop_note === 'string' && input.stop_note)
    || '';
  return candidate.trim().length >= minimumLength;
}

async function writeOrderHistory(
  tx: PrismaTransactionClient,
  params: {
    tenantId: string;
    orderId: string;
    fromStatus: string;
    toStatus: string;
    actionCode: string;
    actorUserId: string;
    actorName?: string;
    stateVersion: number;
    idempotencyKey: string;
    input?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.org_order_history.create({
    data: {
      tenant_org_id: params.tenantId,
      order_id: params.orderId,
      action_type: 'STATUS_CHANGE',
      from_value: params.fromStatus,
      to_value: params.toStatus,
      done_by: params.actorUserId,
      payload: {
        actionCode: params.actionCode,
        stateVersion: params.stateVersion,
        idempotencyKey: params.idempotencyKey,
        actorName: params.actorName ?? null,
        input: params.input ?? {},
      } as Prisma.InputJsonValue,
    },
  });
}

async function emitWorkflowTransitionOutbox(
  tx: PrismaTransactionClient,
  params: {
    tenantId: string;
    orderId: string;
    actionCode: string;
    screen: string;
    fromStatus: string;
    toStatus: string;
    stateVersion: number;
    actorUserId: string;
    actorName?: string;
    input?: Record<string, unknown>;
  },
): Promise<void> {
  await tx.org_domain_events_outbox.create({
    data: {
      tenant_org_id: params.tenantId,
      event_type: WORKFLOW_OUTBOX_EVENT_TYPE,
      aggregate_type: 'order',
      aggregate_id: params.orderId,
      payload: {
        actionCode: params.actionCode,
        screen: params.screen,
        fromStatus: params.fromStatus,
        toStatus: params.toStatus,
        stateVersion: params.stateVersion,
        actorUserId: params.actorUserId,
        actorName: params.actorName ?? null,
        input: params.input ?? {},
      } as Prisma.InputJsonValue,
      status: OUTBOX_STATUSES.PENDING,
      attempts: 0,
      max_attempts: 6,
      next_retry_at: new Date(),
    },
  });
}

function buildIdempotencyPayload(params: ExecuteActionParams): Record<string, unknown> {
  return {
    orderId: params.orderId,
    screen: normalizeScreen(params.screen),
    actionCode: params.actionCode,
    expectedStateVersion: params.expectedStateVersion,
    channel: params.channel ?? 'staff_web',
    input: params.input ?? {},
    gateDecisions: params.gateDecisions ?? [],
  };
}

function isReleaseAction(actionCode: string): boolean {
  return (
    actionCode === WORKFLOW_ACTIONS.RELEASE_FOR_PICKUP ||
    actionCode === WORKFLOW_ACTIONS.RELEASE_FOR_DELIVERY
  );
}

async function findOpenOrderRelease(input: {
  tenantId: string;
  orderId: string;
  transaction?: PrismaTransactionClient;
}): Promise<{ release_type: string } | null> {
  const db = input.transaction ?? prisma;
  const lockClause = input.transaction ? Prisma.sql`FOR UPDATE` : Prisma.empty;
  const rows = await db.$queryRaw<Array<{ release_type: string }>>(Prisma.sql`
    SELECT release_type
    FROM public.org_wf_release_mst
    WHERE tenant_org_id = ${input.tenantId}::uuid
      AND order_id = ${input.orderId}::uuid
      AND release_status = 'released'
      AND release_type IN ('pickup', 'delivery', 'partial')
      AND COALESCE(rec_status, 1) = 1
    ORDER BY released_at DESC NULLS LAST, id DESC
    LIMIT 1
    ${lockClause}
  `);
  return rows[0] ?? null;
}

function openReleaseBlockedReason(locale?: string): BlockedReason {
  const isArabic = locale?.toLowerCase().startsWith('ar');
  return {
    code: 'GATE_RELEASE_ALREADY_OPEN',
    message: isArabic
      ? 'تم بالفعل إتاحة الطلب للاستلام أو التسليم.'
      : 'This order has already been made available for fulfilment.',
    message2: isArabic
      ? 'This order has already been made available for fulfilment.'
      : 'تم بالفعل إتاحة الطلب للاستلام أو التسليم.',
  };
}

interface CachedExecuteResult {
  payload_hash: string;
  result: ExecuteActionResult;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * List workflow actions available for an order on a given screen.
 * Evaluates gate sets and returns blocked reasons for disabled actions.
 */
export async function listAvailableActions(
  params: ListAvailableActionsParams,
): Promise<ListAvailableActionsResult> {
  const screen = normalizeScreen(params.screen);
  const channel = params.channel ?? 'staff_web';
  const order = await loadOrderForRead(params.tenantId, params.orderId);
  const currentStatus = normalizeStatus(order.current_status ?? order.status);
  const stateVersion = readStateVersion(order);

  if (!currentStatus) {
    return { stateVersion, currentStatus: '', actions: [] };
  }

  const runtime = await resolveWorkflowRuntimeForOrder(order);

  const isMember = await isScreenStatusMemberForOrder(order, screen, currentStatus, runtime);
  if (!isMember) {
    return { stateVersion, currentStatus, actions: [] };
  }

  const transitions = await loadActionTransitionsForOrder(
    order,
    screen,
    currentStatus,
    undefined,
    runtime,
    channel,
  );
  const hasReleaseAction = transitions.some((transition) => isReleaseAction(transition.action_code));
  const openRelease = hasReleaseAction
    ? await findOpenOrderRelease({ tenantId: params.tenantId, orderId: params.orderId })
    : null;
  const discoveryGateCodes = transitions.flatMap((row) => parseGateSet(row.gate_set_code));
  const gateFacts = await loadWorkflowGateFacts({
    tenantId: params.tenantId,
    order,
    gateCodes: discoveryGateCodes,
    phase: 'discover',
    artifact: runtimeArtifact(runtime),
  });
  const actions: AvailableAction[] = [];

  for (const row of transitions) {
    const toStatus = normalizeStatus(row.to_status);
    const baseLabel = pickLabel(row, params.locale);
    const label =
      transitions.filter((t) => t.action_code === row.action_code).length > 1
        ? `${baseLabel} → ${toStatus}`
        : baseLabel;
    const semanticBlockedReasons = [
      ...(row.has_unsupported_gate_mode ? [unsupportedGateModeBlockedReason(params.locale)] : []),
      ...(row.requires_evidence ? [evidenceRuntimeBlockedReason(params.locale)] : []),
    ];
    let gateBlockedReasons: WorkflowGateBlockedReason[] = [];
    let gateDecisions: AvailableGateDecision[] = [];
    if (row.is_semantic && (row.semantic_gates?.length ?? 0) > 0) {
      const classified = classifySemanticGateFailures({
        bindings: row.semantic_gates ?? [],
        facts: gateFacts,
        runtimeMode: 'semantic',
        channel,
        locale: params.locale,
      });
      gateBlockedReasons = classified.hardReasons;
      if (classified.hardReasons.length === 0 && params.actorUserId && order.wf_profile_version_id) {
        gateDecisions = buildAvailableGateDecisions({
          tenantId: params.tenantId,
          orderId: params.orderId,
          artifactId: order.wf_profile_version_id,
          actionCode: row.action_code,
          screen,
          channel,
          actorUserId: params.actorUserId,
          stateVersion,
          facts: gateFacts,
          failedBindings: classified.failedBindings,
        });
      } else if (classified.failedBindings.length > 0 && classified.hardReasons.length === 0) {
        gateBlockedReasons = classified.failedBindings.flatMap((binding) => [{
          code: 'WF_GATE_ACK_REQUIRED',
          message: 'This action requires a current warning acknowledgement or authorized override.',
        }]);
      }
    } else {
      const gateResult = evaluateWorkflowGateSet(
        parseGateSet(row.gate_set_code),
        gateFacts,
        'semantic',
        params.locale,
      );
      gateBlockedReasons = gateResult.blockedReasons;
    }
    const blockedReasons = isReleaseAction(row.action_code) && openRelease
      ? [...gateBlockedReasons, ...semanticBlockedReasons, openReleaseBlockedReason(params.locale)]
      : [...gateBlockedReasons, ...semanticBlockedReasons];
    actions.push({
      actionCode: row.action_code,
      toStatus,
      label,
      label2: row.name2,
      enabled: blockedReasons.length === 0,
      blockedReasons,
      requiresReason: row.requires_reason,
      minReasonLength: row.min_reason_length,
      gateDecisions,
    });
  }

  return { stateVersion, currentStatus, actions };
}

/**
 * Execute a configured workflow action with optimistic concurrency (`state_version`),
 * idempotency, dual-write status fields, history, and central outbox emit.
 *
 * @param params Tenant-authenticated command
 * @param transaction Optional outer transaction from a stage-owned service
 */
export async function executeAction(
  params: ExecuteActionParams,
  transaction?: PrismaTransactionClient,
): Promise<ExecuteActionResult> {
  const startedAt = Date.now();
  const screen = normalizeScreen(params.screen);
  const channel = params.channel ?? 'staff_web';
  try {
    return await executeConfiguredAction(params, transaction, startedAt, screen, channel);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as { code: unknown }).code)
      : undefined;
    observeWorkflowCommand({
      tenantId: params.tenantId,
      orderId: params.orderId,
      screen,
      actionCode: params.actionCode,
      channel,
      outcome: classifyWorkflowCommandError(error),
      errorCode: code,
      latencyMs: Date.now() - startedAt,
      requestId: params.requestCorrelationId,
    });
    throw error;
  }
}

/**
 * Command body kept separate so observe can wrap every throw without
 * touching each fail-closed branch.
 */
async function executeConfiguredAction(
  params: ExecuteActionParams,
  transaction: PrismaTransactionClient | undefined,
  startedAt: number,
  screen: string,
  channel: SemanticWorkflowCommandChannel,
): Promise<ExecuteActionResult> {
  const idempotencyPayload = buildIdempotencyPayload(params);
  const payloadHash = hashPayload(idempotencyPayload);

  if (!transaction) {
    const existing = await findIdempotencyHash(
      params.tenantId,
      params.idempotencyKey,
      WORKFLOW_ACTION_IDEMPOTENCY_RESOURCE,
    );

    if (existing?.hash && existing.hash !== payloadHash) {
      throw new WorkflowEngineError(
        'IDEMPOTENCY_CONFLICT',
        'Same idempotency key used with a different payload.',
      );
    }

    if (existing?.hash === payloadHash) {
      const cachedRow = await prisma.org_idempotency_keys.findFirst({
        where: {
          tenant_org_id: params.tenantId,
          key: params.idempotencyKey,
          resource_type: WORKFLOW_ACTION_IDEMPOTENCY_RESOURCE,
        },
        select: { response_cache: true },
      });
      const cache = cachedRow?.response_cache as unknown as CachedExecuteResult | null;
      if (cache?.result) {
        observeWorkflowCommand({
          tenantId: params.tenantId,
          orderId: params.orderId,
          screen,
          actionCode: params.actionCode,
          channel,
          outcome: 'replay',
          latencyMs: Date.now() - startedAt,
          requestId: params.requestCorrelationId,
        });
        return cache.result;
      }
    }

    const staked = await stakeIdempotencyHash(
      params.tenantId,
      params.idempotencyKey,
      WORKFLOW_ACTION_IDEMPOTENCY_RESOURCE,
      payloadHash,
    );
    if (staked.conflict) {
      throw new WorkflowEngineError(
        'IDEMPOTENCY_CONFLICT',
        'Same idempotency key used with a different payload.',
      );
    }
  }

  const run = async (tx: PrismaTransactionClient): Promise<ExecuteActionResult> => {
    const order = await loadOrderForUpdate(tx, params.tenantId, params.orderId);
    const currentStatus = normalizeStatus(order.current_status ?? order.status);
    const currentVersion = readStateVersion(order);

    if (currentVersion !== params.expectedStateVersion) {
      throw new WorkflowEngineError(
        'VERSION_CONFLICT',
        `Expected state version ${params.expectedStateVersion} but order is at ${currentVersion}.`,
      );
    }

    if (!currentStatus) {
      throw new WorkflowEngineError('ACTION_NOT_ALLOWED', 'Order has no current status.');
    }

    const runtime = await resolveWorkflowRuntimeForOrder(order);
    const isMember = await isScreenStatusMemberForOrder(order, screen, currentStatus, runtime);
    if (!isMember) {
      throw new WorkflowEngineError(
        'ACTION_NOT_ALLOWED',
        `Status "${currentStatus}" is not valid for screen "${screen}".`,
      );
    }

    const transitions = await loadActionTransitionsForOrder(
      order,
      screen,
      currentStatus,
      params.actionCode,
      runtime,
      channel,
    );

    const preferredRaw = params.input?.preferredToStatus ?? params.input?.toStatus;
    const preferredToStatus =
      typeof preferredRaw === 'string' ? normalizeStatus(preferredRaw) : '';

    let transition = transitions[0];
    if (preferredToStatus) {
      const matched = transitions.find(
        (t) => normalizeStatus(t.to_status) === preferredToStatus,
      );
      if (!matched) {
        throw new WorkflowEngineError(
          'ACTION_NOT_ALLOWED',
          `Action "${params.actionCode}" cannot go to "${preferredToStatus}" from "${currentStatus}" on screen "${screen}".`,
        );
      }
      transition = matched;
    }

    if (!transition) {
      throw new WorkflowEngineError(
        'ACTION_NOT_ALLOWED',
        `Action "${params.actionCode}" is not allowed from status "${currentStatus}" on screen "${screen}".`,
      );
    }

    if (transition.has_unsupported_gate_mode) {
      throw new WorkflowEngineError(
        'UNSUPPORTED_GATE_MODE',
        'This action requires a gate decision mode that is not available yet.',
        [unsupportedGateModeBlockedReason()],
      );
    }
    if (transition.requires_evidence) {
      throw new WorkflowEngineError(
        'EVIDENCE_RUNTIME_UNAVAILABLE',
        'This action requires evidence, but the evidence runtime is not available yet.',
        [evidenceRuntimeBlockedReason()],
      );
    }
    if (
      transition.requires_reason
      && !hasRequiredReason(params.input, transition.min_reason_length)
    ) {
      throw new WorkflowEngineError(
        'REASON_REQUIRED',
        `This action requires a reason of at least ${transition.min_reason_length} characters.`,
      );
    }

    const executeFacts = await loadWorkflowGateFacts({
      tenantId: params.tenantId,
      order,
      gateCodes: parseGateSet(transition.gate_set_code),
      phase: 'execute',
      artifact: runtimeArtifact(runtime),
      transaction: tx,
    });
    if (transition.is_semantic && (transition.semantic_gates?.length ?? 0) > 0) {
      try {
        await assertAndRecordSemanticGateDecisions({
          tx,
          tenantId: params.tenantId,
          orderId: params.orderId,
          artifactId: order.wf_profile_version_id ?? order.wf_profile_artifact_id ?? '',
          profileVersionId: order.wf_profile_version_id,
          profileArtifactId: order.wf_profile_artifact_id,
          actionCode: params.actionCode,
          screen,
          channel,
          actorUserId: params.actorUserId,
          actorName: params.actorName,
          idempotencyKey: params.idempotencyKey,
          requestCorrelationId: params.requestCorrelationId,
          stateVersion: currentVersion,
          facts: executeFacts,
          runtimeMode: 'semantic',
          bindings: transition.semantic_gates ?? [],
          submitted: params.gateDecisions ?? [],
          commandInput: params.input,
          canOverridePermission: params.canOverridePermission
            ?? ((permissionCode) => hasPermissionServer(permissionCode, {
              userId: params.actorUserId,
              tenantId: params.tenantId,
            })),
        });
      } catch (error) {
        if (error instanceof WorkflowGateDecisionError) {
          throw new WorkflowEngineError(error.code, error.message, error.blockedReasons);
        }
        throw error;
      }
    } else {
      const gateResult = evaluateWorkflowGateSet(
        parseGateSet(transition.gate_set_code),
        executeFacts,
        'semantic',
        undefined,
        params.input,
      );
      if (!gateResult.allowed) {
        throw new WorkflowEngineError(
          'GATE_FAILED',
          'One or more workflow gates blocked this action.',
          gateResult.blockedReasons,
        );
      }
    }

    const controlNote =
      (typeof params.input?.notes === 'string' ? params.input.notes.trim() : '') ||
      (typeof params.input?.hold_note === 'string'
        ? params.input.hold_note.trim()
        : '') ||
      (typeof params.input?.stop_note === 'string'
        ? params.input.stop_note.trim()
        : '');

    let toStatus = normalizeStatus(transition.to_status);
    let nextHoldFrom: string | null = null;
    let clearHoldFrom = false;

    const orderControl = resolveOrderControlTransition({
      actionCode: params.actionCode,
      currentStatus,
      holdFromStatus: order.hold_from_status,
      note: controlNote,
    });
    if (orderControl !== null && orderControl.ok === false) {
      throw new WorkflowEngineError('ACTION_NOT_ALLOWED', orderControl.message);
    }

    if (isReleaseAction(params.actionCode)) {
      const openRelease = await findOpenOrderRelease({
        tenantId: params.tenantId,
        orderId: params.orderId,
        transaction: tx,
      });
      if (openRelease) {
        throw new WorkflowEngineError(
          'ACTION_NOT_ALLOWED',
          'This order has already been made available for fulfilment.',
          [openReleaseBlockedReason()],
        );
      }
    }
    if (orderControl !== null && orderControl.ok === true) {
      if (transition.is_semantic) {
        const configuredToStatus = normalizeStatus(transition.to_status);
        const controlToStatus = normalizeStatus(orderControl.toStatus);
        const isDynamicResume = transition.transition_kind === 'resume_from_hold';
        const resumeTargetIsDeclared = runtime.artifact.module_statuses.some(
          (membership) => normalizeStatus(membership.status_code) === controlToStatus,
        );

        // Order-control fields are operational state, but profile policy remains
        // the source of truth for fixed destinations. Resume is intentionally
        // dynamic and may restore only a declared workflow status.
        if (
          (!isDynamicResume && configuredToStatus !== controlToStatus)
          || (isDynamicResume && !resumeTargetIsDeclared)
        ) {
          throw new WorkflowEngineError(
            'PROFILE_EXECUTION_INVALID',
            'The semantic profile execution is incompatible with the order-control state.',
          );
        }
      }
      toStatus = orderControl.toStatus;
      nextHoldFrom = orderControl.nextHoldFromStatus;
      clearHoldFrom = orderControl.clearHoldFromStatus;
    }

    const nextVersion = currentVersion + 1;
    const now = new Date();
    const isCompletePreparation =
      params.actionCode === WORKFLOW_ACTIONS.COMPLETE_PREPARATION;
    const isCancelOrder = params.actionCode === WORKFLOW_ACTIONS.CANCEL_ORDER;
    const isReturnOrder = params.actionCode === WORKFLOW_ACTIONS.RETURN_ORDER;

    const rackFromInput =
      typeof params.input?.rackLocation === 'string'
        ? params.input.rackLocation.trim()
        : typeof params.input?.rack_location === 'string'
          ? params.input.rack_location.trim()
          : '';
    const applyRack = rackFromInput.length > 0;

    const cancelNote =
      (typeof params.input?.cancelled_note === 'string'
        ? params.input.cancelled_note.trim()
        : '') ||
      (typeof params.input?.notes === 'string' ? params.input.notes.trim() : '');
    const returnReason =
      (typeof params.input?.return_reason === 'string'
        ? params.input.return_reason.trim()
        : '') || cancelNote;

    const applyHoldFrom = Boolean(nextHoldFrom);
    const holdFromValue = nextHoldFrom ?? '';

    const updated = await tx.$executeRaw`
      UPDATE public.org_orders_mst
      SET
        current_status = ${toStatus},
        status = ${toStatus},
        state_version = COALESCE(state_version, 0) + 1,
        last_transition_at = ${now},
        last_transition_by = ${params.actorUserId}::uuid,
        updated_at = ${now},
        hold_from_status = CASE
          WHEN ${applyHoldFrom} THEN ${holdFromValue}
          WHEN ${clearHoldFrom} THEN NULL
          ELSE hold_from_status
        END,
        rack_location = CASE
          WHEN ${applyRack} THEN ${rackFromInput}
          ELSE rack_location
        END,
        preparation_status = CASE
          WHEN ${isCompletePreparation} THEN ${PREPARATION_COMPLETED}
          ELSE preparation_status
        END,
        prepared_at = CASE
          WHEN ${isCompletePreparation} THEN ${now}
          ELSE prepared_at
        END,
        prepared_by = CASE
          WHEN ${isCompletePreparation} THEN ${params.actorUserId}::uuid
          ELSE prepared_by
        END,
        cancelled_at = CASE
          WHEN ${isCancelOrder} THEN ${now}
          ELSE cancelled_at
        END,
        cancelled_by = CASE
          WHEN ${isCancelOrder} THEN ${params.actorUserId}::uuid
          ELSE cancelled_by
        END,
        cancelled_note = CASE
          WHEN ${isCancelOrder} AND ${cancelNote.length > 0} THEN ${cancelNote}
          ELSE cancelled_note
        END,
        returned_at = CASE
          WHEN ${isReturnOrder} THEN ${now}
          ELSE returned_at
        END,
        returned_by = CASE
          WHEN ${isReturnOrder} THEN ${params.actorUserId}::uuid
          ELSE returned_by
        END,
        return_reason = CASE
          WHEN ${isReturnOrder} AND ${returnReason.length > 0} THEN ${returnReason}
          ELSE return_reason
        END
      WHERE id = ${params.orderId}::uuid
        AND tenant_org_id = ${params.tenantId}::uuid
        AND COALESCE(state_version, 0) = ${params.expectedStateVersion}
    `;

    if (Number(updated) === 0) {
      throw new WorkflowEngineError(
        'VERSION_CONFLICT',
        'Order state changed concurrently. Reload and retry.',
      );
    }

    // Ready ≠ release: persist release records for pickup/delivery release actions
    if (
      params.actionCode === WORKFLOW_ACTIONS.RELEASE_FOR_PICKUP ||
      params.actionCode === WORKFLOW_ACTIONS.RELEASE_FOR_DELIVERY
    ) {
      const releaseType =
        params.actionCode === WORKFLOW_ACTIONS.RELEASE_FOR_PICKUP ? 'pickup' : 'delivery';
      try {
        await tx.$executeRaw`
          INSERT INTO public.org_wf_release_mst (
            tenant_org_id, order_id, release_type, release_status,
            state_version_at, released_at, released_by, created_by
          ) VALUES (
            ${params.tenantId}::uuid,
            ${params.orderId}::uuid,
            ${releaseType},
            'released',
            ${nextVersion},
            ${now},
            ${params.actorUserId}::uuid,
            ${params.actorUserId}::uuid
          )
        `;
      } catch {
        // Table may not exist until migration 0428 is applied — do not fail the transition.
      }
    }

    if (toStatus === 'ready') {
      await tx.$executeRaw`
        UPDATE public.org_orders_mst
        SET ready_at = COALESCE(ready_at, ${now})
        WHERE id = ${params.orderId}::uuid
          AND tenant_org_id = ${params.tenantId}::uuid
      `;
    }

    if (toStatus === 'delivered') {
      await tx.$executeRaw`
        UPDATE public.org_orders_mst
        SET delivered_at = COALESCE(delivered_at, ${now})
        WHERE id = ${params.orderId}::uuid
          AND tenant_org_id = ${params.tenantId}::uuid
      `;
    }

    await writeOrderHistory(tx, {
      tenantId: params.tenantId,
      orderId: params.orderId,
      fromStatus: currentStatus,
      toStatus,
      actionCode: params.actionCode,
      actorUserId: params.actorUserId,
      actorName: params.actorName,
      stateVersion: nextVersion,
      idempotencyKey: params.idempotencyKey,
      input: params.input,
    });

    await emitWorkflowTransitionOutbox(tx, {
      tenantId: params.tenantId,
      orderId: params.orderId,
      actionCode: params.actionCode,
      screen,
      fromStatus: currentStatus,
      toStatus,
      stateVersion: nextVersion,
      actorUserId: params.actorUserId,
      actorName: params.actorName,
      input: params.input,
    });

    const executeResult: ExecuteActionResult = {
      ok: true,
      currentStatus: toStatus,
      stateVersion: nextVersion,
    };

    await tx.org_idempotency_keys.upsert({
      where: {
        tenant_org_id_key_resource_type: {
          tenant_org_id: params.tenantId,
          key: params.idempotencyKey,
          resource_type: WORKFLOW_ACTION_IDEMPOTENCY_RESOURCE,
        },
      },
      create: {
        tenant_org_id: params.tenantId,
        key: params.idempotencyKey,
        resource_type: WORKFLOW_ACTION_IDEMPOTENCY_RESOURCE,
        resource_id: params.orderId,
        response_cache: {
          payload_hash: payloadHash,
          result: executeResult,
        } as unknown as Prisma.InputJsonValue,
        created_at: now,
        expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
      update: {
        resource_id: params.orderId,
        response_cache: {
          payload_hash: payloadHash,
          result: executeResult,
        } as unknown as Prisma.InputJsonValue,
      },
    });

    return executeResult;
  };

  // Stage services can compose operational writes and the workflow transition
  // in one rollback boundary; standalone callers retain the existing behavior.
  const result = transaction ? await run(transaction) : await prisma.$transaction(run);

  observeWorkflowCommand({
    tenantId: params.tenantId,
    orderId: params.orderId,
    screen,
    actionCode: params.actionCode,
    channel,
    outcome: 'ok',
    latencyMs: Date.now() - startedAt,
    requestId: params.requestCorrelationId,
  });
  return result;
}

/** Re-export action codes for consumers that import from the service layer. */
export { WORKFLOW_ACTIONS, type WorkflowActionCode };

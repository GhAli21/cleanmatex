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
import { resolveOrderControlTransition } from '@/lib/workflow/order-control-transition';
import {
  loadPinnedGraphForProfileVersion,
  isPinnedScreenStatusMember,
  loadPinnedActionTransitions,
  type PinnedGraphDefinition,
} from '@/lib/services/workflow/pinned-workflow-graph.service';

// ─── Error types ───────────────────────────────────────────────────────────

export type WorkflowEngineErrorCode =
  | 'VERSION_CONFLICT'
  | 'GATE_FAILED'
  | 'ACTION_NOT_ALLOWED'
  | 'NOT_FOUND'
  | 'IDEMPOTENCY_CONFLICT';

export interface BlockedReason {
  code: string;
  message: string;
  message2?: string;
}

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
  hold_from_status: string | null;
  wf_profile_id: string | null;
  wf_version_no: number | null;
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
};

/**
 * Prisma transaction scope accepted by workflow commands that must be composed
 * with a stage-owned write without splitting the business transaction.
 */
export type PrismaTransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

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

function gateBlockedReason(gateCode: string, locale?: string): BlockedReason {
  const messages: Record<string, { en: string; ar: string; code: string }> = {
    rack_required: {
      code: 'GATE_RACK_REQUIRED',
      en: 'Rack location is required before this action.',
      ar: 'موقع الرف مطلوب قبل هذا الإجراء.',
    },
    prep_stage_complete: {
      code: 'GATE_PREP_INCOMPLETE',
      en: 'Preparation must be completed before this action.',
      ar: 'يجب إكمال التحضير قبل هذا الإجراء.',
    },
    prep_not_completed: {
      code: 'GATE_PREP_ALREADY_COMPLETED',
      en: 'Cancel is only allowed before preparation is completed. Use hold or stop instead.',
      ar: 'الإلغاء مسموح فقط قبل إكمال التحضير. استخدم التعليق أو الإيقاف بدلاً من ذلك.',
    },
    fin_release_eligible: {
      code: 'GATE_FIN_RELEASE',
      en: 'Order is not eligible for release (financial check pending).',
      ar: 'الطلب غير مؤهل للتسليم (التحقق المالي قيد الانتظار).',
    },
  };
  const entry = messages[gateCode] ?? {
    code: `GATE_${gateCode.toUpperCase()}`,
    en: `Gate "${gateCode}" blocked this action.`,
    ar: `البوابة "${gateCode}" منعت هذا الإجراء.`,
  };
  const useAr = locale?.toLowerCase().startsWith('ar');
  return {
    code: entry.code,
    message: useAr ? entry.ar : entry.en,
    message2: useAr ? entry.en : entry.ar,
  };
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
      hold_from_status,
      wf_profile_id::text,
      wf_version_no
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
      hold_from_status,
      wf_profile_id::text,
      wf_version_no
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

async function resolvePinnedGraphForOrder(
  order: LockedOrderRow,
): Promise<PinnedGraphDefinition | null> {
  if (!order.wf_profile_id || order.wf_version_no == null) return null;
  return loadPinnedGraphForProfileVersion(order.wf_profile_id, order.wf_version_no);
}

async function isScreenStatusMemberForOrder(
  order: LockedOrderRow,
  screen: string,
  statusCode: string,
  pinned?: PinnedGraphDefinition | null,
): Promise<boolean> {
  const graph = pinned ?? (await resolvePinnedGraphForOrder(order));
  if (graph) return isPinnedScreenStatusMember(graph, screen, statusCode);
  return isScreenStatusMember(screen, statusCode);
}

async function loadActionTransitionsForOrder(
  order: LockedOrderRow,
  screen: string,
  fromStatus: string,
  actionCode?: string,
  pinned?: PinnedGraphDefinition | null,
): Promise<ActionTransitionRow[]> {
  const graph = pinned ?? (await resolvePinnedGraphForOrder(order));
  if (graph) return loadPinnedActionTransitions(graph, screen, fromStatus, actionCode);
  return loadActionTransitions(screen, fromStatus, actionCode);
}

async function isScreenStatusMember(
  screen: string,
  statusCode: string,
): Promise<boolean> {
  const rows = await prisma.$queryRaw<{ ok: number }[]>`
    SELECT 1 AS ok
    FROM public.sys_wf_screen_status_cd
    WHERE screen_key = ${screen}
      AND status_code = ${statusCode}
      AND COALESCE(is_active, true) = true
    LIMIT 1
  `;
  return rows.length > 0;
}

async function loadActionTransitions(
  screen: string,
  fromStatus: string,
  actionCode?: string,
): Promise<ActionTransitionRow[]> {
  if (actionCode) {
    return prisma.$queryRaw<ActionTransitionRow[]>`
      SELECT
        a.action_code,
        a.name,
        a.name2,
        a.permission_code AS action_permission_code,
        t.from_status,
        t.to_status,
        t.gate_set_code,
        t.permission_code AS transition_permission_code
      FROM public.sys_wf_action_trans_cd at
      INNER JOIN public.sys_wf_actions_cd a
        ON a.action_code = at.action_code
      INNER JOIN public.sys_wf_transitions_cd t
        ON t.id = at.transition_id
      WHERE at.screen_key = ${screen}
        AND COALESCE(at.is_active, true) = true
        AND COALESCE(a.is_active, true) = true
        AND COALESCE(t.is_active, true) = true
        AND t.from_status = ${fromStatus}
        AND a.action_code = ${actionCode}
    `;
  }

  return prisma.$queryRaw<ActionTransitionRow[]>`
    SELECT
      a.action_code,
      a.name,
      a.name2,
      a.permission_code AS action_permission_code,
      t.from_status,
      t.to_status,
      t.gate_set_code,
      t.permission_code AS transition_permission_code
    FROM public.sys_wf_action_trans_cd at
    INNER JOIN public.sys_wf_actions_cd a
      ON a.action_code = at.action_code
    INNER JOIN public.sys_wf_transitions_cd t
      ON t.id = at.transition_id
    WHERE at.screen_key = ${screen}
      AND COALESCE(at.is_active, true) = true
      AND COALESCE(a.is_active, true) = true
      AND COALESCE(t.is_active, true) = true
      AND t.from_status = ${fromStatus}
    ORDER BY a.action_code
  `;
}

interface GateEvaluation {
  allowed: boolean;
  blockedReasons: BlockedReason[];
}

async function evaluateGate(
  gateCode: string,
  order: LockedOrderRow,
  locale?: string,
  input?: Record<string, unknown>,
): Promise<GateEvaluation> {
  const normalized = gateCode.trim().toLowerCase();

  switch (normalized) {
    case 'rack_required': {
      const inputRack =
        typeof input?.rackLocation === 'string'
          ? input.rackLocation.trim()
          : typeof input?.rack_location === 'string'
            ? input.rack_location.trim()
            : '';
      const hasRack = Boolean(order.rack_location?.trim() || inputRack);
      if (hasRack) return { allowed: true, blockedReasons: [] };
      return {
        allowed: false,
        blockedReasons: [gateBlockedReason('rack_required', locale)],
      };
    }
    case 'prep_stage_complete':
    case 'prep_complete': {
      const prepDone =
        normalizeStatus(order.preparation_status) === PREPARATION_COMPLETED;
      if (prepDone) return { allowed: true, blockedReasons: [] };
      return {
        allowed: false,
        blockedReasons: [gateBlockedReason('prep_stage_complete', locale)],
      };
    }
    case 'prep_not_completed': {
      const prepDone =
        normalizeStatus(order.preparation_status) === PREPARATION_COMPLETED;
      if (!prepDone) return { allowed: true, blockedReasons: [] };
      return {
        allowed: false,
        blockedReasons: [gateBlockedReason('prep_not_completed', locale)],
      };
    }
    case 'fin_release_eligible': {
      // TODO(Order Fin): replace stub with real Fin release eligibility check
      // (outstanding balance, hold flags, release policy). Must not invent logic here.
      return { allowed: true, blockedReasons: [] };
    }
    default:
      // Unknown gates default to allowed until catalog + evaluators are seeded.
      return { allowed: true, blockedReasons: [] };
  }
}

async function evaluateGateSet(
  gateSetCode: string | null,
  order: LockedOrderRow,
  locale?: string,
  input?: Record<string, unknown>,
): Promise<GateEvaluation> {
  const gates = parseGateSet(gateSetCode);
  if (gates.length === 0) {
    return { allowed: true, blockedReasons: [] };
  }

  const blockedReasons: BlockedReason[] = [];
  for (const gate of gates) {
    const result = await evaluateGate(gate, order, locale, input);
    if (!result.allowed) {
      blockedReasons.push(...result.blockedReasons);
    }
  }

  return {
    allowed: blockedReasons.length === 0,
    blockedReasons,
  };
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
    input: params.input ?? {},
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
  const order = await loadOrderForRead(params.tenantId, params.orderId);
  const currentStatus = normalizeStatus(order.current_status ?? order.status);
  const stateVersion = readStateVersion(order);

  if (!currentStatus) {
    return { stateVersion, currentStatus: '', actions: [] };
  }

  const pinned = await resolvePinnedGraphForOrder(order);

  const isMember = await isScreenStatusMemberForOrder(order, screen, currentStatus, pinned);
  if (!isMember) {
    return { stateVersion, currentStatus, actions: [] };
  }

  const transitions = await loadActionTransitionsForOrder(order, screen, currentStatus, undefined, pinned);
  const hasReleaseAction = transitions.some((transition) => isReleaseAction(transition.action_code));
  const openRelease = hasReleaseAction
    ? await findOpenOrderRelease({ tenantId: params.tenantId, orderId: params.orderId })
    : null;
  const actions: AvailableAction[] = [];

  for (const row of transitions) {
    const gateResult = await evaluateGateSet(row.gate_set_code, order, params.locale);
    const toStatus = normalizeStatus(row.to_status);
    const baseLabel = pickLabel(row, params.locale);
    // Disambiguate skip-path duplicates (same action, different to_status)
    const label =
      transitions.filter((t) => t.action_code === row.action_code).length > 1
        ? `${baseLabel} → ${toStatus}`
        : baseLabel;
    const blockedReasons = isReleaseAction(row.action_code) && openRelease
      ? [...gateResult.blockedReasons, openReleaseBlockedReason(params.locale)]
      : gateResult.blockedReasons;
    actions.push({
      actionCode: row.action_code,
      toStatus,
      label,
      label2: row.name2,
      enabled: blockedReasons.length === 0,
      blockedReasons,
    });
  }

  return { stateVersion, currentStatus, actions };
}

/**
 * Execute a configured workflow action with optimistic concurrency (`state_version`),
 * idempotency, dual-write status fields, history, and central outbox emit.
 */
export async function executeAction(
  params: ExecuteActionParams,
  transaction?: PrismaTransactionClient,
): Promise<ExecuteActionResult> {
  const screen = normalizeScreen(params.screen);
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

    const pinned = await resolvePinnedGraphForOrder(order);
    const isMember = await isScreenStatusMemberForOrder(order, screen, currentStatus, pinned);
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
      pinned,
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

    const gateResult = await evaluateGateSet(
      transition.gate_set_code,
      order,
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

  return result;
}

/** Re-export action codes for consumers that import from the service layer. */
export { WORKFLOW_ACTIONS, type WorkflowActionCode };

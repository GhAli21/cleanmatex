import 'server-only';

import type { OrderSourceCatalogRow } from '@/lib/services/order-source-policy';
import {
  resolveInitialStatus,
  type ResolveInitialStatusResult,
} from './initial-status-resolver.service';
import {
  hydrateOrderCreateColumns,
  type OrderCreateHydratedColumns,
} from './order-create-hydrator';
import type { ResolvedWorkflowInitialRule } from './workflow-profile-resolution.service';

/** Facts normalized once for Initial-rule matching + hydration. */
export interface OrderCreateWorkflowFacts {
  orderSourceCode: string;
  orderTypeId: string | null;
  isRetail: boolean;
  isQuickDrop: boolean;
  requiresRemoteIntakeConfirm: boolean;
  physicalIntakeOverride?: 'pending_dropoff' | 'received' | 'not_applicable';
  initialWorkflowScreen?: string;
  userId: string | null;
  physicalIntakeInfo?: string | null;
  receivedInfo?: string | null;
}

/** Result consumed by OrderService insert payload builders. */
export interface OrderCreateWorkflowState {
  initialStatus: string;
  ruleCode: string | null;
  createPresetCode: string | null;
  contractScreen: string;
  isRetailOnlyOrder: boolean;
  hydrated: OrderCreateHydratedColumns;
  /** Convenience aliases kept for existing OrderService callers. */
  v_initialStatus: string;
  v_transitionFrom: string;
  v_orderStatus: string;
  v_current_status: string;
  v_current_stage: string;
  physicalIntakeStatus: string;
  receivedAt: Date | null;
}

export interface ResolveOrderCreateWorkflowStateInput {
  items: Array<{ serviceCategoryCode: string }>;
  isQuickDrop?: boolean;
  physicalIntakeStatus?: 'pending_dropoff' | 'received' | 'not_applicable';
  initialWorkflowScreen?: string;
  orderTypeId?: string | null;
  sourceRow: OrderSourceCatalogRow;
  semanticInitialRules: ResolvedWorkflowInitialRule[];
  userId?: string | null;
  physicalIntakeInfo?: string | null;
  receivedInfo?: string | null;
}

/**
 * Normalizes create facts so boolean matchers never see undefined.
 * Quick-drop defaults to false (not null) so POS_PROCESSING rules match.
 */
export function buildOrderCreateWorkflowFacts(
  input: ResolveOrderCreateWorkflowStateInput,
): OrderCreateWorkflowFacts {
  const isRetailOnlyOrder =
    input.items.length > 0
    && input.items.every((item) => item.serviceCategoryCode === 'RETAIL_ITEMS');

  return {
    orderSourceCode: input.sourceRow.order_source_code,
    orderTypeId: input.orderTypeId?.trim() || null,
    isRetail: isRetailOnlyOrder,
    isQuickDrop: input.isQuickDrop === true,
    requiresRemoteIntakeConfirm: input.sourceRow.requires_remote_intake_confirm === true,
    physicalIntakeOverride: input.physicalIntakeStatus,
    initialWorkflowScreen: input.initialWorkflowScreen,
    userId: input.userId ?? null,
    physicalIntakeInfo: input.physicalIntakeInfo,
    receivedInfo: input.receivedInfo,
  };
}

/**
 * Resolves Initial status + create preset hydration for a new order.
 * Profile Initial rules are the only status authority; presets stamp columns.
 */
export async function resolveOrderCreateWorkflowState(
  input: ResolveOrderCreateWorkflowStateInput,
): Promise<OrderCreateWorkflowState> {
  const facts = buildOrderCreateWorkflowFacts(input);

  const resolved: ResolveInitialStatusResult = await resolveInitialStatus({
    orderSourceCode: facts.orderSourceCode,
    orderTypeId: facts.orderTypeId,
    isRetail: facts.isRetail,
    isQuickDrop: facts.isQuickDrop,
    semanticInitialRules: input.semanticInitialRules,
  });

  // Never auto-close: retail ADR maps closed → ready when a bad rule slips through.
  const initialStatus =
    resolved.initialStatus === 'closed' ? 'ready' : resolved.initialStatus;

  const matchedRule = [...input.semanticInitialRules]
    .sort((left, right) => left.priority - right.priority || left.rule_code.localeCompare(right.rule_code))
    .find((rule) => rule.rule_code === resolved.ruleCode);

  const createPresetCode = matchedRule?.create_preset_code ?? null;

  const hydrated = hydrateOrderCreateColumns(createPresetCode, {
    userId: facts.userId,
    physicalIntakeInfo: facts.physicalIntakeInfo,
    receivedInfo: facts.receivedInfo,
  });

  // Explicit create override still wins for physical intake status when callers
  // force pending_dropoff / received / not_applicable (legacy API escape hatch).
  if (facts.physicalIntakeOverride === 'pending_dropoff') {
    hydrated.physical_intake_status = 'pending_dropoff';
    hydrated.physical_intake_at = null;
    hydrated.physical_intake_by = null;
    hydrated.received_at = null;
  } else if (facts.physicalIntakeOverride === 'received') {
    hydrated.physical_intake_status = 'received';
    hydrated.received_at = hydrated.received_at ?? new Date();
  } else if (facts.physicalIntakeOverride === 'not_applicable') {
    hydrated.physical_intake_status = 'not_applicable';
  }

  const contractScreen = facts.isRetail
    ? 'retail'
    : (facts.initialWorkflowScreen ?? 'new_order');

  return {
    initialStatus,
    ruleCode: resolved.ruleCode,
    createPresetCode,
    contractScreen,
    isRetailOnlyOrder: facts.isRetail,
    hydrated,
    v_initialStatus: initialStatus,
    v_transitionFrom: initialStatus,
    v_orderStatus: initialStatus,
    v_current_status: initialStatus,
    v_current_stage: initialStatus,
    physicalIntakeStatus: hydrated.physical_intake_status,
    receivedAt: hydrated.received_at,
  };
}

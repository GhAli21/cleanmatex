import type { OrderChangeOperationCode } from '@/lib/constants/order-change';
import type { OrderChangeEditPolicyInfo, OrderChangeEditPolicyRule } from '@/lib/types/order-change';

/**
 * Screen availability is separate from the policy decision.
 * SUPPORTED can be sent by the current Apply writer. LOCKED_BY_V1 stays closed in this version.
 */
export type EditImplementationAvailability = 'SUPPORTED' | 'NOT_IMPLEMENTED' | 'LOCKED_BY_V1';

/** Derived control state. CREATE is New Order, where no Edit Policy is loaded. */
export type EditControlState = 'OPEN' | 'WARNING' | 'OVERRIDE' | 'DENIED' | 'NOT_AVAILABLE_YET' | 'LOCKED' | 'CREATE';

export type EditControlReasonKey = 'deny' | 'missing' | 'warning' | 'override' | 'notAvailable' | 'locked' | 'totalSame';

export interface EditControlCapability {
  state: EditControlState;
  interactive: boolean;
  reasonKey: EditControlReasonKey | null;
}

const AVAILABILITY: Record<OrderChangeOperationCode, EditImplementationAvailability> = {
  ADD_ITEM: 'SUPPORTED',
  REMOVE_ITEM: 'SUPPORTED',
  CHANGE_ITEM_QUANTITY: 'SUPPORTED',
  ADD_PIECE: 'SUPPORTED',
  REMOVE_PIECE: 'SUPPORTED',
  ADD_PREFERENCE: 'NOT_IMPLEMENTED',
  CHANGE_PREFERENCE: 'NOT_IMPLEMENTED',
  REMOVE_PREFERENCE: 'NOT_IMPLEMENTED',
  CHANGE_PRIORITY: 'NOT_IMPLEMENTED',
  CHANGE_SERVICE_SPEED: 'SUPPORTED',
  CHANGE_READY_BY: 'SUPPORTED',
  CHANGE_ORDER_NOTES: 'SUPPORTED',
  CHANGE_CUSTOMER_SNAPSHOT: 'LOCKED_BY_V1',
  CHANGE_UNLISTED: 'NOT_IMPLEMENTED',
};

const DECISION_RANK = { DENY: 0, REQUIRE_OVERRIDE: 1, ALLOW_WITH_WARNING: 2, ALLOW: 3 } as const;
const STATE_RANK: Record<EditControlState, number> = {
  DENIED: 0,
  LOCKED: 1,
  NOT_AVAILABLE_YET: 2,
  OVERRIDE: 3,
  WARNING: 4,
  OPEN: 5,
  CREATE: 6,
};

const CREATE_CAPABILITY: EditControlCapability = { state: 'CREATE', interactive: true, reasonKey: null };

/**
 * Editing-stage control from the policy already loaded with the order.
 * A missing writer does not close the draft. Review and Apply remain the server checks.
 * It does not resolve assignments or call the server.
 */
export function resolveEditControlCapability(
  policy: OrderChangeEditPolicyInfo | null,
  operationCode: OrderChangeOperationCode,
): EditControlCapability {
  if (!policy) return CREATE_CAPABILITY;
  if (AVAILABILITY[operationCode] === 'LOCKED_BY_V1') {
    return { state: 'LOCKED', interactive: false, reasonKey: 'locked' };
  }
  if (policy.status === 'MISSING') {
    return { state: 'DENIED', interactive: false, reasonKey: 'missing' };
  }
  const rules = policy.rules.filter((rule) => rule.operationCode === operationCode);
  const decision = strictestDecision(rules);
  if (!decision || decision === 'DENY') {
    return { state: 'DENIED', interactive: false, reasonKey: 'deny' };
  }
  if (decision === 'REQUIRE_OVERRIDE') {
    return { state: 'OVERRIDE', interactive: true, reasonKey: 'override' };
  }
  if (decision === 'ALLOW_WITH_WARNING') {
    return { state: 'WARNING', interactive: true, reasonKey: 'warning' };
  }
  return {
    state: 'OPEN',
    interactive: true,
    reasonKey: operationCode === 'CHANGE_SERVICE_SPEED' ? 'totalSame' : null,
  };
}

/** Uses the strictest control in the group so one disabled operation cannot stay clickable. */
export function resolveEditControlGroup(
  policy: OrderChangeEditPolicyInfo | null,
  operationCodes: readonly OrderChangeOperationCode[],
): EditControlCapability {
  if (!policy) return CREATE_CAPABILITY;
  const capabilities = operationCodes.map((code) => resolveEditControlCapability(policy, code));
  return capabilities.reduce((strictest, candidate) =>
    STATE_RANK[candidate.state] < STATE_RANK[strictest.state] ? candidate : strictest,
  );
}

export function strictestDecision(rules: readonly Pick<OrderChangeEditPolicyRule, 'decision'>[]): OrderChangeEditPolicyRule['decision'] | null {
  if (rules.length === 0) return null;
  return rules.reduce((strictest, rule) =>
    DECISION_RANK[rule.decision] < DECISION_RANK[strictest] ? rule.decision : strictest,
  rules[0].decision);
}

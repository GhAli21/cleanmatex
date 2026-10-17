import type { OrderChangeOperationCode } from '@/lib/constants/order-change';
import type { OrderChangeEditPolicyRule } from '@/lib/types/order-change';

/** How this screen can send an operation that the policy already decided. */
export type EditPolicyScreenLimit = 'ready' | 'total' | 'hidden' | 'identity';

/** Explanation fragments the dialog translates. The policy decision stays first. */
export type EditPolicyHowKey =
  | 'allow'
  | 'warning'
  | 'override'
  | 'deny'
  | 'screenClosed'
  | 'editLocally'
  | 'totalSame'
  | 'identityLocked'
  | 'reasonRequired';

const DECISION_ORDER = ['ALLOW', 'ALLOW_WITH_WARNING', 'REQUIRE_OVERRIDE', 'DENY'] as const;

/**
 * Screen limits that are independent of the policy matrix.
 * Hidden and identity rows stay visible so a staff user can see why a control does nothing.
 */
const SCREEN_LIMIT: Record<OrderChangeOperationCode, EditPolicyScreenLimit> = {
  ADD_ITEM: 'hidden',
  REMOVE_ITEM: 'hidden',
  CHANGE_ITEM_QUANTITY: 'hidden',
  ADD_PIECE: 'hidden',
  REMOVE_PIECE: 'hidden',
  ADD_PREFERENCE: 'hidden',
  CHANGE_PREFERENCE: 'hidden',
  REMOVE_PREFERENCE: 'hidden',
  CHANGE_PRIORITY: 'hidden',
  CHANGE_SERVICE_SPEED: 'ready',
  CHANGE_READY_BY: 'ready',
  CHANGE_ORDER_NOTES: 'ready',
  CHANGE_CUSTOMER_SNAPSHOT: 'identity',
  CHANGE_UNLISTED: 'hidden',
};

/**
 * Builds the plain-language lines for one policy rule.
 * A denial is the reason by itself. A screen limit is added only when the policy would otherwise allow the change.
 */
export function editPolicyExplanationKeys(rule: Pick<OrderChangeEditPolicyRule, 'operationCode' | 'decision' | 'requiresReason'>): EditPolicyHowKey[] {
  if (rule.decision === 'DENY') return ['deny'];
  const limit = SCREEN_LIMIT[rule.operationCode];
  if (limit === 'hidden') {
    const keys: EditPolicyHowKey[] = ['editLocally'];
    if (rule.decision === 'ALLOW_WITH_WARNING') keys.push('warning');
    if (rule.decision === 'REQUIRE_OVERRIDE') keys.push('override');
    if (rule.requiresReason) keys.push('reasonRequired');
    return keys;
  }
  const keys: EditPolicyHowKey[] = [
    rule.decision === 'ALLOW' ? 'allow' : rule.decision === 'ALLOW_WITH_WARNING' ? 'warning' : 'override',
  ];
  if (limit === 'total') keys.push('totalSame');
  if (limit === 'identity') keys.push('identityLocked');
  if (rule.requiresReason) keys.push('reasonRequired');
  return keys;
}

/** Keeps allowed changes above denials so the window can be scanned from top to bottom. */
export function sortEditPolicyRules(rules: readonly OrderChangeEditPolicyRule[]): OrderChangeEditPolicyRule[] {
  return [...rules].sort((left, right) => {
    const decisionDelta = DECISION_ORDER.indexOf(left.decision) - DECISION_ORDER.indexOf(right.decision);
    return decisionDelta === 0 ? left.operationCode.localeCompare(right.operationCode) : decisionDelta;
  });
}

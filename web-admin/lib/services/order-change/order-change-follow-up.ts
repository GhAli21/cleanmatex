/**
 * Follow-up actions after a committed Change.
 * This planner does not collect, refund, or move stored value.
 * Collection stays on the existing pay-on-collection route.
 * Cash return and gateway refund stay unavailable here.
 */

import { MONEY_COMPARISON_TOLERANCE } from '@/lib/constants/financial-tolerances';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { OVERPAYMENT_RESOLUTIONS } from '@/lib/constants/settlement-catalog';
import { SETTLEMENT_TYPE_CODES } from '@/lib/constants/order-financial';

export const ORDER_CHANGE_FOLLOW_UP_ACTIONS = {
  COLLECT_PAY_ON_COLLECTION: 'COLLECT_PAY_ON_COLLECTION',
  SAVE_AS_CUSTOMER_ADVANCE: OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_ADVANCE,
  SAVE_AS_CUSTOMER_CREDIT: OVERPAYMENT_RESOLUTIONS.SAVE_AS_CUSTOMER_CREDIT,
  SAVE_TO_CUSTOMER_WALLET: OVERPAYMENT_RESOLUTIONS.SAVE_TO_CUSTOMER_WALLET,
} as const;

export type OrderChangeFollowUpActionCode =
  (typeof ORDER_CHANGE_FOLLOW_UP_ACTIONS)[keyof typeof ORDER_CHANGE_FOLLOW_UP_ACTIONS];

const STORED_VALUE_ACTIONS = [
  ORDER_CHANGE_FOLLOW_UP_ACTIONS.SAVE_AS_CUSTOMER_ADVANCE,
  ORDER_CHANGE_FOLLOW_UP_ACTIONS.SAVE_AS_CUSTOMER_CREDIT,
  ORDER_CHANGE_FOLLOW_UP_ACTIONS.SAVE_TO_CUSTOMER_WALLET,
] as const;

export interface OrderChangeFollowUpAction {
  code: OrderChangeFollowUpActionCode;
  method: 'POST';
  path: string;
  permission: string;
  amountCap: string;
  currencyCode: string;
  executesHere: boolean;
}

export interface OrderChangeFollowUpUnavailable {
  code: 'COLLECT_PAY_ON_COLLECTION' | 'VOID_OR_REFUND_EXCESS' | 'GATEWAY_REFUND';
  reason:
    | 'COLLECTION_UNSUPPORTED_FOR_PAYMENT_TYPE'
    | 'REFUND_LIFECYCLE_SEPARATE'
    | 'GATEWAY_REFUND_NOT_AUTOMATIC'
    | 'CUSTOMER_REQUIRED'
    | 'CURRENCY_UNRESOLVED'
    | 'AMBIGUOUS_BALANCE';
}

export interface OrderChangeFollowUpPlan {
  actions: OrderChangeFollowUpAction[];
  unavailable: OrderChangeFollowUpUnavailable[];
}

export interface OrderChangeFollowUpInput {
  paymentTypeCode: string | null;
  outstandingAmount: string;
  overpaidAmount: string;
  currencyCode: string | null;
  hasCustomer: boolean;
}

const COLLECTION_PATH = '/api/v1/orders/[id]/payments';
const RESOLUTION_PATH = '/api/v1/orders/[id]/financial-resolution';

/**
 * Lists only the follow-up the current Finance owners can perform.
 * A pay-on-collection balance uses the existing collection route.
 * Any other original payment type stays unchanged and is not collected here.
 */
export function planOrderChangeFollowUp(input: OrderChangeFollowUpInput): OrderChangeFollowUpPlan {
  const outstanding = Number(input.outstandingAmount);
  const overpaid = Number(input.overpaidAmount);
  if (!input.currencyCode) {
    return { actions: [], unavailable: [{ code: 'COLLECT_PAY_ON_COLLECTION', reason: 'CURRENCY_UNRESOLVED' }] };
  }
  if (outstanding > MONEY_COMPARISON_TOLERANCE && overpaid > MONEY_COMPARISON_TOLERANCE) {
    return { actions: [], unavailable: [{ code: 'COLLECT_PAY_ON_COLLECTION', reason: 'AMBIGUOUS_BALANCE' }] };
  }
  const actions: OrderChangeFollowUpAction[] = [];
  const unavailable: OrderChangeFollowUpUnavailable[] = [];
  if (outstanding > MONEY_COMPARISON_TOLERANCE) {
    if (input.paymentTypeCode === SETTLEMENT_TYPE_CODES.PAY_ON_COLLECTION) {
      actions.push({
        code: ORDER_CHANGE_FOLLOW_UP_ACTIONS.COLLECT_PAY_ON_COLLECTION,
        method: 'POST',
        path: COLLECTION_PATH,
        permission: ORDERS_PERMISSIONS.COLLECT_PAYMENT,
        amountCap: money(outstanding),
        currencyCode: input.currencyCode,
        executesHere: false,
      });
    } else {
      unavailable.push({
        code: 'COLLECT_PAY_ON_COLLECTION',
        reason: 'COLLECTION_UNSUPPORTED_FOR_PAYMENT_TYPE',
      });
    }
  }
  if (overpaid > MONEY_COMPARISON_TOLERANCE) {
    if (!input.hasCustomer) {
      unavailable.push({ code: 'VOID_OR_REFUND_EXCESS', reason: 'CUSTOMER_REQUIRED' });
    } else {
      for (const code of STORED_VALUE_ACTIONS) {
        actions.push({
          code,
          method: 'POST',
          path: RESOLUTION_PATH,
          permission: ORDERS_PERMISSIONS.OVERPAYMENT_ALLOCATE,
          amountCap: money(overpaid),
          currencyCode: input.currencyCode,
          executesHere: true,
        });
      }
    }
    unavailable.push(
      { code: 'VOID_OR_REFUND_EXCESS', reason: 'REFUND_LIFECYCLE_SEPARATE' },
      { code: 'GATEWAY_REFUND', reason: 'GATEWAY_REFUND_NOT_AUTOMATIC' },
    );
  }
  return { actions, unavailable };
}

export function resolutionAmountWithinCap(overpaidAmount: string, amount: string): boolean {
  const amountNumber = Number(amount);
  return amountNumber > 0 && amountNumber <= Number(overpaidAmount) + MONEY_COMPARISON_TOLERANCE;
}

function money(value: number): string {
  return value.toFixed(4);
}

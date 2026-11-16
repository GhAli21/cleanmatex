import { cmxMessage } from '@ui/feedback';

export type AttemptPayExtraIntentChangeParams = {
  next: boolean;
  current: boolean;
  canEnablePayExtra: boolean;
  canAllocateOverpayment: boolean;
  excessAmount: number;
  moneyEpsilon: number;
  setPayExtraIntent: (value: boolean) => void;
  messages: {
    permissionRequired: string;
    cannotDisableWhileExtra: string;
    disabledNoMethods?: string;
  };
};

/**
 * Central gate for the "Customer is paying extra" toggle (QA-R4.5).
 * Never rewrites money — only accepts/rejects the intent flip.
 *
 * @param params - Gate inputs + i18n messages already interpolated
 * @returns true when the intent value changed
 */
export function attemptPayExtraIntentChange(
  params: AttemptPayExtraIntentChangeParams
): boolean {
  const {
    next,
    current,
    canEnablePayExtra,
    canAllocateOverpayment,
    excessAmount,
    moneyEpsilon,
    setPayExtraIntent,
    messages,
  } = params;

  if (next === current) return false;

  if (!canEnablePayExtra) {
    if (messages.disabledNoMethods) {
      cmxMessage.info(messages.disabledNoMethods);
    }
    return false;
  }

  if (next === true && !canAllocateOverpayment) {
    cmxMessage.error(messages.permissionRequired);
    return false;
  }

  if (next === false && excessAmount > moneyEpsilon) {
    cmxMessage.info(messages.cannotDisableWhileExtra);
    return false;
  }

  setPayExtraIntent(next);
  return true;
}

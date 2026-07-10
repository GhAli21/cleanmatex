import { showErrorToast, showInfoToast } from '@ui/components/cmx-toast';

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
      showInfoToast(messages.disabledNoMethods);
    }
    return false;
  }

  if (next === true && !canAllocateOverpayment) {
    showErrorToast(messages.permissionRequired);
    return false;
  }

  if (next === false && excessAmount > moneyEpsilon) {
    showInfoToast(messages.cannotDisableWhileExtra);
    return false;
  }

  setPayExtraIntent(next);
  return true;
}

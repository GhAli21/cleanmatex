import { attemptPayExtraIntentChange } from '@features/orders/ui/payment-modal/pay-extra/attempt-pay-extra-intent-change';

jest.mock('@ui/components/cmx-toast', () => ({
  showErrorToast: jest.fn(),
  showInfoToast: jest.fn(),
}));

describe('attemptPayExtraIntentChange', () => {
  const setPayExtraIntent = jest.fn();

  beforeEach(() => {
    setPayExtraIntent.mockClear();
  });

  it('blocks ON when allocate permission is missing', () => {
    const ok = attemptPayExtraIntentChange({
      next: true,
      current: false,
      canEnablePayExtra: true,
      canAllocateOverpayment: false,
      excessAmount: 0,
      moneyEpsilon: 0.001,
      setPayExtraIntent,
      messages: {
        permissionRequired: 'no perm',
        cannotDisableWhileExtra: 'cannot off',
      },
    });
    expect(ok).toBe(false);
    expect(setPayExtraIntent).not.toHaveBeenCalled();
  });

  it('blocks OFF when excess remains', () => {
    const ok = attemptPayExtraIntentChange({
      next: false,
      current: true,
      canEnablePayExtra: true,
      canAllocateOverpayment: true,
      excessAmount: 2.103,
      moneyEpsilon: 0.001,
      setPayExtraIntent,
      messages: {
        permissionRequired: 'no perm',
        cannotDisableWhileExtra: 'cannot off',
      },
    });
    expect(ok).toBe(false);
    expect(setPayExtraIntent).not.toHaveBeenCalled();
  });

  it('allows ON when methods + allocate permission', () => {
    const ok = attemptPayExtraIntentChange({
      next: true,
      current: false,
      canEnablePayExtra: true,
      canAllocateOverpayment: true,
      excessAmount: 0,
      moneyEpsilon: 0.001,
      setPayExtraIntent,
      messages: {
        permissionRequired: 'no perm',
        cannotDisableWhileExtra: 'cannot off',
      },
    });
    expect(ok).toBe(true);
    expect(setPayExtraIntent).toHaveBeenCalledWith(true);
  });

  it('allows OFF when excess is cleared', () => {
    const ok = attemptPayExtraIntentChange({
      next: false,
      current: true,
      canEnablePayExtra: true,
      canAllocateOverpayment: true,
      excessAmount: 0,
      moneyEpsilon: 0.001,
      setPayExtraIntent,
      messages: {
        permissionRequired: 'no perm',
        cannotDisableWhileExtra: 'cannot off',
      },
    });
    expect(ok).toBe(true);
    expect(setPayExtraIntent).toHaveBeenCalledWith(false);
  });
});

import {
  DEFAULT_PAYMENT_MODAL_CONFIG,
  resolvePaymentModalConfig,
} from '@features/orders/payment/config/payment-modal-config';
import {
  ACTIVE_PAYMENT_PRESETS,
  PAYMENT_PRESET,
} from '@features/orders/payment/presets/preset-keys';

describe('payment-modal-config (L2 boundary)', () => {
  it('opens in Simple and offers only the active presets', () => {
    expect(DEFAULT_PAYMENT_MODAL_CONFIG.defaultPreset).toBe(PAYMENT_PRESET.SIMPLE);
    expect(DEFAULT_PAYMENT_MODAL_CONFIG.presets).toEqual(ACTIVE_PAYMENT_PRESETS);
    expect(DEFAULT_PAYMENT_MODAL_CONFIG.presets).toEqual([
      PAYMENT_PRESET.SIMPLE,
      PAYMENT_PRESET.FULL,
    ]);
  });

  it('has no capability overrides by default (rules decide)', () => {
    expect(DEFAULT_PAYMENT_MODAL_CONFIG.capabilityOverrides).toEqual({});
  });

  it('resolver returns the code defaults regardless of context (this phase)', () => {
    expect(resolvePaymentModalConfig()).toBe(DEFAULT_PAYMENT_MODAL_CONFIG);
    expect(
      resolvePaymentModalConfig({ tenantOrgId: 't1', branchId: 'b1' }),
    ).toBe(DEFAULT_PAYMENT_MODAL_CONFIG);
  });
});

import {
  SERVER_GUARD_AFFORDANCE,
  resolveServerGuardAffordance,
} from '@features/orders/payment/view/server-guard-affordance';
import { routeServerErrorToGuard } from '@features/orders/payment/domain/server-error-routing';
import { SERVER_ERROR_TO_REASON } from '@features/orders/payment/domain/payment-reasons';
import {
  PAYMENT_CAPABILITY,
  PAYMENT_CAPABILITY_KEYS,
} from '@features/orders/payment/capabilities/capability-keys';

describe('resolveServerGuardAffordance', () => {
  it('resolves a defined affordance for every capability key (exhaustive)', () => {
    for (const key of PAYMENT_CAPABILITY_KEYS) {
      const affordance = resolveServerGuardAffordance(key);
      expect(Object.values(SERVER_GUARD_AFFORDANCE)).toContain(affordance);
    }
  });

  it('maps dialog-owning capabilities to their in-place dialog', () => {
    expect(resolveServerGuardAffordance(PAYMENT_CAPABILITY.SPLIT_TENDER)).toBe(
      SERVER_GUARD_AFFORDANCE.SPLIT_DIALOG,
    );
    expect(resolveServerGuardAffordance(PAYMENT_CAPABILITY.CASH_CARD_SPLIT)).toBe(
      SERVER_GUARD_AFFORDANCE.SPLIT_DIALOG,
    );
    expect(resolveServerGuardAffordance(PAYMENT_CAPABILITY.PAY_LATER)).toBe(
      SERVER_GUARD_AFFORDANCE.PAY_LATER_DIALOG,
    );
    expect(resolveServerGuardAffordance(PAYMENT_CAPABILITY.CASH_DRAWER)).toBe(
      SERVER_GUARD_AFFORDANCE.CASH_DRAWER_DIALOG,
    );
    expect(resolveServerGuardAffordance(PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING)).toBe(
      SERVER_GUARD_AFFORDANCE.OVERPAYMENT_DIALOG,
    );
  });

  it('routes B2B account billing to its in-place dialog (set complete — no workbench hop)', () => {
    expect(resolveServerGuardAffordance(PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING)).toBe(
      SERVER_GUARD_AFFORDANCE.B2B_DIALOG,
    );
  });

  it('keeps aggregate/in-view capabilities message-only', () => {
    expect(resolveServerGuardAffordance(PAYMENT_CAPABILITY.SUBMIT_GUARDS)).toBe(
      SERVER_GUARD_AFFORDANCE.NONE,
    );
    expect(resolveServerGuardAffordance(PAYMENT_CAPABILITY.FX_ROUNDING)).toBe(
      SERVER_GUARD_AFFORDANCE.NONE,
    );
  });

  it('resolves an affordance for every server-routable error code (end-to-end with routing)', () => {
    for (const code of Object.keys(SERVER_ERROR_TO_REASON)) {
      const route = routeServerErrorToGuard(code);
      expect(route).not.toBeNull();
      const affordance = resolveServerGuardAffordance(route!.capability);
      expect(Object.values(SERVER_GUARD_AFFORDANCE)).toContain(affordance);
    }
  });
});

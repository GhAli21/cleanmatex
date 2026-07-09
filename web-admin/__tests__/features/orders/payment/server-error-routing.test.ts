import { routeServerErrorToGuard } from '@features/orders/payment/domain/server-error-routing';
import {
  SERVER_ERROR_TO_REASON,
  PAYMENT_REASON,
} from '@features/orders/payment/domain/payment-reasons';
import {
  PAYMENT_CAPABILITY,
  PAYMENT_CAPABILITY_KEYS,
} from '@features/orders/payment/capabilities/capability-keys';

describe('routeServerErrorToGuard', () => {
  it('routes each dedicated error code to its owning capability', () => {
    expect(routeServerErrorToGuard('B2B_CREDIT_EXCEEDED')).toEqual({
      capability: PAYMENT_CAPABILITY.B2B_ACCOUNT_BILLING,
      reason: PAYMENT_REASON.B2B_CREDIT_EXCEEDED,
    });
    expect(routeServerErrorToGuard('SPLIT_AMOUNT_MISMATCH')?.capability).toBe(
      PAYMENT_CAPABILITY.SPLIT_TENDER,
    );
    expect(routeServerErrorToGuard('CASH_DRAWER_SESSION_CLOSED')?.capability).toBe(
      PAYMENT_CAPABILITY.CASH_DRAWER,
    );
    expect(routeServerErrorToGuard('OVERPAYMENT_RESOLUTION_REQUIRED')?.capability).toBe(
      PAYMENT_CAPABILITY.OVERPAYMENT_ROUTING,
    );
    expect(routeServerErrorToGuard('OUTSTANDING_POLICY_REQUIRED')?.capability).toBe(
      PAYMENT_CAPABILITY.PAY_LATER,
    );
  });

  it('routes ownerless (per-leg tender-detail) codes to the aggregate SUBMIT_GUARDS surface', () => {
    for (const code of [
      'PAYMENT_REFERENCE_REQUIRED',
      'PAYMENT_TERMINAL_REQUIRED',
      'CHECK_NUMBER_REQUIRED',
    ]) {
      const route = routeServerErrorToGuard(code);
      expect(route?.capability).toBe(PAYMENT_CAPABILITY.SUBMIT_GUARDS);
      expect(route?.reason).toBe(SERVER_ERROR_TO_REASON[code]);
    }
  });

  it('returns null for an unknown code (caller uses the generic path, never a view switch)', () => {
    expect(routeServerErrorToGuard('SOME_UNMAPPED_CODE')).toBeNull();
    expect(routeServerErrorToGuard('')).toBeNull();
  });

  it('covers every server-mirror code and preserves the exact reason (server-mirror identity)', () => {
    for (const code of Object.keys(SERVER_ERROR_TO_REASON)) {
      const route = routeServerErrorToGuard(code);
      expect(route).not.toBeNull();
      // Reason is byte-identical to the server-mirror map (never re-derived).
      expect(route?.reason).toBe(SERVER_ERROR_TO_REASON[code]);
    }
  });

  it('only ever routes to real capability keys', () => {
    for (const code of Object.keys(SERVER_ERROR_TO_REASON)) {
      const route = routeServerErrorToGuard(code);
      expect(PAYMENT_CAPABILITY_KEYS).toContain(route?.capability);
    }
  });
});

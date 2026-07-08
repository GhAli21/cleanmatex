/**
 * Phase 0B (Payment Modal composable program, 2026-07-09): B2B credit-limit
 * exceedance is hard-denied by default. `assertCreditWithinPolicy` is the
 * single gate used by the submit orchestrator for CREDIT_INVOICE submissions;
 * it deliberately accepts NO override input — a client-supplied
 * `creditLimitOverride` boolean can never bypass an accounting limit.
 * The gated re-enable (enablement policy + `orders:override_credit_limit`,
 * both required) is tracked in
 * docs/features/Order_Fin/Payment_Modal_08_07_2026/Deferred_Backend_Tasks.md.
 */

import {
  assertCreditWithinPolicy,
  type CreditLimitResult,
} from '@/lib/services/credit-limit.service';

function creditResult(overrides: Partial<CreditLimitResult>): CreditLimitResult {
  return {
    allowed: true,
    currentBalance: 0,
    creditLimit: 0,
    available: 0,
    orderTotal: 100,
    wouldExceed: false,
    ...overrides,
  };
}

describe('assertCreditWithinPolicy (Phase 0B hard-deny)', () => {
  it('passes when the customer is within the credit limit', () => {
    expect(() =>
      assertCreditWithinPolicy(
        creditResult({ creditLimit: 500, currentBalance: 100, available: 400 }),
      ),
    ).not.toThrow();
  });

  it('throws B2B_CREDIT_HOLD when the customer is on credit hold', () => {
    expect(() =>
      assertCreditWithinPolicy(
        creditResult({ isCreditHold: true, wouldExceed: true, allowed: false }),
      ),
    ).toThrow('B2B_CREDIT_HOLD');
  });

  it('throws B2B_CREDIT_EXCEEDED with limit details when the order would exceed', () => {
    let caught: unknown;
    try {
      assertCreditWithinPolicy(
        creditResult({
          wouldExceed: true,
          allowed: false,
          creditLimit: 500,
          currentBalance: 450,
          available: 50,
          orderTotal: 100,
        }),
      );
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(Error);
    const e = caught as Error & {
      creditLimit?: number;
      currentBalance?: number;
      available?: number;
    };
    expect(e.message).toBe('B2B_CREDIT_EXCEEDED');
    expect(e.creditLimit).toBe(500);
    expect(e.currentBalance).toBe(450);
    expect(e.available).toBe(50);
  });

  it('hard-denies structurally: the gate accepts no override input at all', () => {
    // The Phase 0B guarantee is structural — the function signature has exactly
    // one parameter (the credit-check result), so no caller can thread a
    // client override flag through it.
    expect(assertCreditWithinPolicy.length).toBe(1);

    // And a caller attempting to smuggle an override-style flag inside the
    // result object changes nothing: exceeding still throws.
    const smuggled = creditResult({
      wouldExceed: true,
      allowed: false,
      creditLimit: 500,
      currentBalance: 600,
      available: 0,
    }) as CreditLimitResult & { creditLimitOverride?: boolean };
    smuggled.creditLimitOverride = true;
    expect(() => assertCreditWithinPolicy(smuggled)).toThrow('B2B_CREDIT_EXCEEDED');
  });

  it('does not throw for non-B2B / no-limit customers (wouldExceed=false path)', () => {
    expect(() =>
      assertCreditWithinPolicy(
        creditResult({ creditLimit: 0, wouldExceed: false }),
      ),
    ).not.toThrow();
  });
});

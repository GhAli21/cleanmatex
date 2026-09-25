/**
 * Tests: cash-drawer ledger gate policy (CLF, plan §4B.4)
 *
 * Pins every rule of the gate table in both modes, including the ordering
 * (integrity before session state) and the CLOSING behaviour.
 */

import { decideCashLine } from '@/lib/services/cash-drawer-ledger/cash-drawer-ledger-policy';
import type { CashLineDecisionInput, DrawerProfile } from '@/lib/types/cash-drawer-ledger';

const DRAWER: DrawerProfile = {
  id: 'drawer-1',
  tenantOrgId: 'tenant-1',
  branchId: 'branch-1',
  drawerType: 'COUNTER',
  currencyCode: 'OMR',
  isActive: true,
  acceptsCustomerCash: true,
  allowsCustomerCashOut: true,
};

function input(over: Partial<CashLineDecisionInput> & { line?: Partial<CashLineDecisionInput['line']> } = {}): CashLineDecisionInput {
  return {
    drawer: DRAWER,
    liveSession: { id: 'ses-1', status: 'OPEN' },
    requiresSession: true,
    mode: 'INTERACTIVE',
    ...over,
    line: {
      direction: 'IN',
      paymentMethodCode: 'CASH',
      requiresCashDrawer: true,
      isCompleted: true,
      currencyCode: 'OMR',
      branchId: 'branch-1',
      ...over.line,
    },
  };
}

describe('decideCashLine — not cash / untracked / pending', () => {
  it('ignores non-cash methods', () => {
    expect(decideCashLine(input({ line: { paymentMethodCode: 'CARD' } }))).toEqual({ effect: null, sessionId: null, error: null });
  });

  it('ignores NEUTRAL and missing directions (e.g. over/short lines carry no method anyway)', () => {
    expect(decideCashLine(input({ line: { direction: 'NEUTRAL' } })).effect).toBeNull();
    expect(decideCashLine(input({ line: { direction: null } })).effect).toBeNull();
    expect(decideCashLine(input({ line: { paymentMethodCode: null } })).effect).toBeNull();
  });

  it('marks cash on a method not tracked in drawers as UNTRACKED, even without a drawer', () => {
    expect(decideCashLine(input({ drawer: null, line: { requiresCashDrawer: false } }))).toEqual({
      effect: 'UNTRACKED', sessionId: null, error: null,
    });
  });

  it('keeps a not-yet-completed cash leg PENDING, even with the session closed', () => {
    expect(decideCashLine(input({ liveSession: null, line: { isCompleted: false } }))).toEqual({
      effect: 'PENDING', sessionId: null, error: null,
    });
  });
});

describe('decideCashLine — integrity rules apply in both modes', () => {
  for (const mode of ['INTERACTIVE', 'DEFERRED'] as const) {
    it(`[${mode}] requires a drawer`, () => {
      expect(decideCashLine(input({ mode, drawer: null })).error).toBe('CASH_DRAWER_REQUIRED');
    });
    it(`[${mode}] refuses an inactive drawer`, () => {
      expect(decideCashLine(input({ mode, drawer: { ...DRAWER, isActive: false } })).error).toBe('CASH_DRAWER_INACTIVE');
    });
    it(`[${mode}] refuses a drawer of another branch`, () => {
      expect(decideCashLine(input({ mode, line: { branchId: 'branch-2' } })).error).toBe('CASH_DRAWER_BRANCH_MISMATCH');
    });
    it(`[${mode}] refuses customer cash IN on a safe`, () => {
      const safe = { ...DRAWER, drawerType: 'SAFE' as const, acceptsCustomerCash: false, allowsCustomerCashOut: false };
      expect(decideCashLine(input({ mode, drawer: safe })).error).toBe('CASH_DRAWER_TYPE_NOT_ALLOWED');
    });
    it(`[${mode}] refuses cash OUT from a driver bag`, () => {
      const bag = { ...DRAWER, drawerType: 'DRIVER_BAG' as const, allowsCustomerCashOut: false };
      expect(decideCashLine(input({ mode, drawer: bag, line: { direction: 'OUT' } })).error).toBe('CASH_DRAWER_TYPE_NOT_ALLOWED');
    });
    it(`[${mode}] requires a currency`, () => {
      expect(decideCashLine(input({ mode, line: { currencyCode: '  ' } })).error).toBe('CASH_CURRENCY_REQUIRED');
    });
    it(`[${mode}] refuses a currency different from the drawer's`, () => {
      expect(decideCashLine(input({ mode, line: { currencyCode: 'SAR' } })).error).toBe('CASH_CURRENCY_MISMATCH');
    });
  }

  it('skips the branch check when the voucher branch is unknown', () => {
    expect(decideCashLine(input({ line: { branchId: null } })).effect).toBe('DRAWER');
  });

  it('compares currencies case-insensitively', () => {
    expect(decideCashLine(input({ line: { currencyCode: 'omr' } })).effect).toBe('DRAWER');
  });

  it('checks integrity before session state (an inactive drawer is refused even with an open session)', () => {
    expect(decideCashLine(input({ drawer: { ...DRAWER, isActive: false } })).error).toBe('CASH_DRAWER_INACTIVE');
  });
});

describe('decideCashLine — session windows', () => {
  it('attaches cash to the OPEN session (IN and OUT, both modes)', () => {
    for (const mode of ['INTERACTIVE', 'DEFERRED'] as const) {
      for (const direction of ['IN', 'OUT'] as const) {
        expect(decideCashLine(input({ mode, line: { direction } }))).toEqual({
          effect: 'DRAWER', sessionId: 'ses-1', error: null,
        });
      }
    }
  });

  it('refuses interactive cash while the session is CLOSING', () => {
    expect(decideCashLine(input({ liveSession: { id: 'ses-1', status: 'CLOSING' } })).error).toBe('DRAWER_SESSION_CLOSING');
  });

  it('refuses interactive cash while CLOSING even when sessions are optional', () => {
    expect(decideCashLine(input({ requiresSession: false, liveSession: { id: 'ses-1', status: 'CLOSING' } })).error)
      .toBe('DRAWER_SESSION_CLOSING');
  });

  it('sends deferred cash during CLOSING to the next window (no session)', () => {
    expect(decideCashLine(input({ mode: 'DEFERRED', liveSession: { id: 'ses-1', status: 'CLOSING' } }))).toEqual({
      effect: 'DRAWER', sessionId: null, error: null,
    });
  });

  it('refuses interactive cash with no open session when the policy requires one', () => {
    expect(decideCashLine(input({ liveSession: null })).error).toBe('CASH_DRAWER_SESSION_NOT_OPEN');
  });

  it('accepts interactive cash with no session on a drawer that does not require one', () => {
    expect(decideCashLine(input({ liveSession: null, requiresSession: false }))).toEqual({
      effect: 'DRAWER', sessionId: null, error: null,
    });
  });

  it('never refuses deferred cash for a missing session (late verify / reversal)', () => {
    for (const direction of ['IN', 'OUT'] as const) {
      expect(decideCashLine(input({ mode: 'DEFERRED', liveSession: null, line: { direction } }))).toEqual({
        effect: 'DRAWER', sessionId: null, error: null,
      });
    }
  });
});

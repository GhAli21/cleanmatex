/**
 * Tests: customer-receipt-allocation auto algorithm (pure)
 */

import { runAutoAllocationAlgorithm } from '@/lib/services/customer-receipt-allocation.service';
import type { OpenBalanceTarget } from '@/lib/types/customer-receipt-allocation';
import {
  CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES,
  CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES,
} from '@/lib/types/customer-receipt-allocation';
import type { ReceiptAllocationPolicyRow } from '@/lib/services/customer-receipt-allocation-policy.service';

const CUSTOMER_ID = '00000000-0000-4000-8000-000000000010';

function makePolicy(overrides: Partial<ReceiptAllocationPolicyRow> = {}): ReceiptAllocationPolicyRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    tenant_org_id: '00000000-0000-4000-8000-000000000002',
    branch_id: null,
    policy_code: 'DEFAULT_OLDEST_DUE',
    allocation_mode: 'AUTO_OLDEST_DUE',
    fallback_destination: 'CUSTOMER_ADVANCE',
    include_ar_invoices: true,
    include_b2b_statements: false,
    include_pay_on_collection_orders: true,
    include_open_order_balances: true,
    priority_ar_invoices: 10,
    priority_b2b_statements: 20,
    priority_pay_on_collection_orders: 30,
    priority_open_order_balances: 40,
    allow_partial_last_target: true,
    require_same_currency: true,
    allow_cross_branch_allocation: false,
    require_confirmation_before_posting: true,
    max_targets_per_allocation: 100,
    ...overrides,
  };
}

function makeTarget(
  overrides: Partial<OpenBalanceTarget> & Pick<OpenBalanceTarget, 'targetId' | 'outstandingAmount'>
): OpenBalanceTarget {
  return {
    targetType: CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES.AR_INVOICE,
    documentNo: 'INV-001',
    documentDate: '2026-05-01',
    dueDate: '2026-06-01',
    currencyCode: 'OMR',
    lineRole: CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES.INVOICE_PAYMENT,
    priority: 10,
    branchId: null,
    ...overrides,
  };
}

describe('runAutoAllocationAlgorithm', () => {
  it('allocates oldest due first until excess is consumed', () => {
    const targets = [
      makeTarget({ targetId: 'inv-a', dueDate: '2026-06-10', outstandingAmount: 25 }),
      makeTarget({ targetId: 'inv-b', dueDate: '2026-06-01', outstandingAmount: 40 }),
    ];

    const result = runAutoAllocationAlgorithm(50, targets, makePolicy(), CUSTOMER_ID);

    expect(result.remainingUnallocatedAmount).toBe(0);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0]?.targetId).toBe('inv-b');
    expect(result.allocations[0]?.allocationAmount).toBe(40);
    expect(result.allocations[1]?.targetId).toBe('inv-a');
    expect(result.allocations[1]?.allocationAmount).toBe(10);
  });

  it('creates fallback advance when no targets match', () => {
    const result = runAutoAllocationAlgorithm(15, [], makePolicy(), CUSTOMER_ID);

    expect(result.remainingUnallocatedAmount).toBe(0);
    expect(result.fallbackAllocation?.targetType).toBe('CUSTOMER_ADVANCE');
    expect(result.fallbackAllocation?.allocationAmount).toBe(15);
  });

  it('blocks when policy requires manual action and remainder exists', () => {
    const result = runAutoAllocationAlgorithm(
      30,
      [makeTarget({ targetId: 'inv-a', outstandingAmount: 10 })],
      makePolicy({ fallback_destination: 'BLOCK_AND_REQUIRE_MANUAL_ACTION' }),
      CUSTOMER_ID
    );

    expect(result.blocked).toBe(true);
    expect(result.remainingUnallocatedAmount).toBe(20);
    expect(result.warnings.some((w) => w.code === 'RECEIPT_ALLOCATION_BLOCKED')).toBe(true);
  });
});

describe('runAutoAllocationAlgorithm — edge cases (D-12 §3 hardening)', () => {
  it('skips a zero-outstanding target and routes the full excess to fallback', () => {
    const result = runAutoAllocationAlgorithm(
      15,
      [makeTarget({ targetId: 'inv-zero', outstandingAmount: 0 })],
      makePolicy(),
      CUSTOMER_ID
    );
    // The zero-balance target contributes no allocation line.
    expect(result.allocations.filter((a) => a.targetId === 'inv-zero')).toHaveLength(0);
    expect(result.remainingUnallocatedAmount).toBe(0);
    expect(result.fallbackAllocation?.targetType).toBe('CUSTOMER_ADVANCE');
    expect(result.fallbackAllocation?.allocationAmount).toBe(15);
  });

  it('allocates one target then routes the remainder to fallback advance', () => {
    const result = runAutoAllocationAlgorithm(
      50,
      [makeTarget({ targetId: 'inv-a', outstandingAmount: 20 })],
      makePolicy(),
      CUSTOMER_ID
    );
    const toInvoice = result.allocations.find((a) => a.targetId === 'inv-a');
    expect(toInvoice?.allocationAmount).toBe(20);
    expect(result.fallbackAllocation?.allocationAmount).toBe(30); // 50 - 20
    expect(result.remainingUnallocatedAmount).toBe(0);
  });

  it('respects max_targets_per_allocation, routing the uncovered remainder to fallback', () => {
    const targets = [
      makeTarget({ targetId: 'inv-a', dueDate: '2026-06-01', outstandingAmount: 10 }),
      makeTarget({ targetId: 'inv-b', dueDate: '2026-06-02', outstandingAmount: 10 }),
      makeTarget({ targetId: 'inv-c', dueDate: '2026-06-03', outstandingAmount: 10 }),
    ];
    const result = runAutoAllocationAlgorithm(30, targets, makePolicy({ max_targets_per_allocation: 1 }), CUSTOMER_ID);

    // Only the first (oldest-due) target is considered.
    const invoiceLines = result.allocations.filter((a) => a.targetType === 'AR_INVOICE');
    expect(invoiceLines).toHaveLength(1);
    expect(invoiceLines[0]?.targetId).toBe('inv-a');
    expect(result.fallbackAllocation?.allocationAmount).toBe(20); // 30 - 10
  });

  // NOTE (D-12 §4 finding): the `allow_partial_last_target=false` guard in
  // runAutoAllocationAlgorithm is currently unreachable — its `isLastWithRemainder`
  // (allocAmount < outstanding ⇒ remaining < outstanding) contradicts the same `if`'s
  // `remaining > target.outstandingAmount`. Documented in 24_IMPLEMENTATION_STATUS.md §4;
  // no test asserts the dead branch (would lock unreachable behavior).
});

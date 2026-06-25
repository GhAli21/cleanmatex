/**
 * Tests: customer-receipt-allocation fallback-destination matrix (D-12 §3 hardening).
 *
 * When auto-allocation leaves an unallocated remainder, the policy `fallback_destination`
 * decides where it goes. This pins each branch of `buildFallbackAllocationLine` as seen
 * through `runAutoAllocationAlgorithm`:
 *   CUSTOMER_ADVANCE → advance line · CUSTOMER_CREDIT → credit line ·
 *   WALLET_TOPUP → wallet line · RETURN_CHANGE → advance line (default branch) ·
 *   BLOCK_AND_REQUIRE_MANUAL_ACTION → no line, blocked=true.
 */

import { runAutoAllocationAlgorithm } from '@/lib/services/customer-receipt-allocation.service';
import type { OpenBalanceTarget } from '@/lib/types/customer-receipt-allocation';
import type { ReceiptAllocationPolicyRow } from '@/lib/services/customer-receipt-allocation-policy.service';

const CUSTOMER_ID = '00000000-0000-4000-8000-000000000010';

function makePolicy(fallback: string): ReceiptAllocationPolicyRow {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    tenant_org_id: '00000000-0000-4000-8000-000000000002',
    branch_id: null,
    policy_code: 'DEFAULT_OLDEST_DUE',
    allocation_mode: 'AUTO_OLDEST_DUE',
    fallback_destination: fallback,
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
  } as ReceiptAllocationPolicyRow;
}

const NO_TARGETS: OpenBalanceTarget[] = [];

describe('runAutoAllocationAlgorithm — fallback destination matrix', () => {
  it('CUSTOMER_ADVANCE → routes remainder to a customer-advance line', () => {
    const r = runAutoAllocationAlgorithm(15, NO_TARGETS, makePolicy('CUSTOMER_ADVANCE'), CUSTOMER_ID);
    expect(r.blocked).toBe(false);
    expect(r.remainingUnallocatedAmount).toBe(0);
    expect(r.fallbackAllocation).toMatchObject({ targetType: 'CUSTOMER_ADVANCE', targetId: CUSTOMER_ID, allocationAmount: 15 });
  });

  it('CUSTOMER_CREDIT → routes remainder to a customer-credit line', () => {
    const r = runAutoAllocationAlgorithm(15, NO_TARGETS, makePolicy('CUSTOMER_CREDIT'), CUSTOMER_ID);
    expect(r.fallbackAllocation).toMatchObject({ targetType: 'CUSTOMER_CREDIT', allocationAmount: 15 });
  });

  it('WALLET_TOPUP → routes remainder to a wallet-topup line', () => {
    const r = runAutoAllocationAlgorithm(15, NO_TARGETS, makePolicy('WALLET_TOPUP'), CUSTOMER_ID);
    expect(r.fallbackAllocation).toMatchObject({ targetType: 'WALLET_TOPUP', allocationAmount: 15 });
  });

  it('RETURN_CHANGE → falls through to a customer-advance line (default branch)', () => {
    const r = runAutoAllocationAlgorithm(15, NO_TARGETS, makePolicy('RETURN_CHANGE'), CUSTOMER_ID);
    expect(r.fallbackAllocation).toMatchObject({ targetType: 'CUSTOMER_ADVANCE', allocationAmount: 15 });
  });

  it('BLOCK_AND_REQUIRE_MANUAL_ACTION → no fallback line, blocked with remainder + BLOCKED warning', () => {
    const r = runAutoAllocationAlgorithm(15, NO_TARGETS, makePolicy('BLOCK_AND_REQUIRE_MANUAL_ACTION'), CUSTOMER_ID);
    expect(r.blocked).toBe(true);
    expect(r.fallbackAllocation).toBeNull();
    expect(r.remainingUnallocatedAmount).toBe(15);
    expect(r.warnings.some((w) => w.code === 'RECEIPT_ALLOCATION_BLOCKED')).toBe(true);
  });
});

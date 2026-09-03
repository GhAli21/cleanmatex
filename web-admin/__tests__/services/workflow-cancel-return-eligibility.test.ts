import {
  canCancelOrder,
  canReturnOrder,
  canHoldOrderWork,
  canResumeOrderWork,
  canStopOrderWork,
  isReturnEligibleStatus,
} from '@/lib/constants/workflow-cancel-return';

describe('workflow cancel/hold/stop eligibility (ADR lock)', () => {
  it('allows cancel only for draft, intake, and incomplete preparing', () => {
    expect(canCancelOrder('draft')).toBe(true);
    expect(canCancelOrder('intake')).toBe(true);
    expect(canCancelOrder('preparing', 'pending')).toBe(true);
    expect(canCancelOrder('preparing', 'in_progress')).toBe(true);
    expect(canCancelOrder('preparing', 'completed')).toBe(false);
    expect(canCancelOrder('preparation', 'completed')).toBe(false);
    expect(canCancelOrder('processing')).toBe(false);
    expect(canCancelOrder('ready')).toBe(false);
    expect(canCancelOrder('out_for_delivery')).toBe(false);
    expect(canCancelOrder('on_hold')).toBe(false);
    expect(canCancelOrder('delivered')).toBe(false);
    expect(canCancelOrder('closed')).toBe(false);
    expect(canCancelOrder('cancelled')).toBe(false);
    expect(canCancelOrder('returned')).toBe(false);
    expect(canCancelOrder('stopped')).toBe(false);
  });

  it('defers return UI to V1.1 (canReturnOrder always false)', () => {
    expect(canReturnOrder('delivered')).toBe(false);
    expect(canReturnOrder('closed')).toBe(false);
    expect(isReturnEligibleStatus('delivered')).toBe(true);
    expect(isReturnEligibleStatus('closed')).toBe(true);
    expect(isReturnEligibleStatus('ready')).toBe(false);
  });

  it('allows hold/resume/stop per ADR', () => {
    expect(canHoldOrderWork('processing')).toBe(true);
    expect(canHoldOrderWork('preparing')).toBe(true);
    expect(canHoldOrderWork('ready')).toBe(true);
    expect(canHoldOrderWork('on_hold')).toBe(false);
    expect(canHoldOrderWork('draft')).toBe(false);
    expect(canHoldOrderWork('delivered')).toBe(false);
    expect(canHoldOrderWork('cancelled')).toBe(false);
    expect(canHoldOrderWork('stopped')).toBe(false);
    expect(canResumeOrderWork('on_hold')).toBe(true);
    expect(canResumeOrderWork('processing')).toBe(false);
    expect(canStopOrderWork('ready')).toBe(true);
    expect(canStopOrderWork('on_hold')).toBe(true);
    expect(canStopOrderWork('cancelled')).toBe(false);
  });

  it('is mutually exclusive for cancel vs historical return statuses', () => {
    for (const s of ['draft', 'delivered', 'closed', 'cancelled', 'returned']) {
      expect(canCancelOrder(s) && isReturnEligibleStatus(s)).toBe(false);
    }
  });
});

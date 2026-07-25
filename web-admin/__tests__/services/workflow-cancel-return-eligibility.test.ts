import {
  canCancelOrder,
  canReturnOrder,
} from '@/lib/constants/workflow-cancel-return';

describe('workflow cancel/return eligibility', () => {
  it('allows cancel only for ops statuses', () => {
    expect(canCancelOrder('processing')).toBe(true);
    expect(canCancelOrder('ready')).toBe(true);
    expect(canCancelOrder('out_for_delivery')).toBe(true);
    expect(canCancelOrder('delivered')).toBe(false);
    expect(canCancelOrder('closed')).toBe(false);
    expect(canCancelOrder('cancelled')).toBe(false);
    expect(canCancelOrder('returned')).toBe(false);
  });

  it('allows return only for delivered/closed', () => {
    expect(canReturnOrder('delivered')).toBe(true);
    expect(canReturnOrder('closed')).toBe(true);
    expect(canReturnOrder('ready')).toBe(false);
    expect(canReturnOrder('cancelled')).toBe(false);
    expect(canReturnOrder('returned')).toBe(false);
  });

  it('is mutually exclusive for a given status', () => {
    const statuses = [
      'draft',
      'processing',
      'ready',
      'delivered',
      'closed',
      'cancelled',
      'returned',
    ];
    for (const s of statuses) {
      expect(canCancelOrder(s) && canReturnOrder(s)).toBe(false);
    }
  });
});

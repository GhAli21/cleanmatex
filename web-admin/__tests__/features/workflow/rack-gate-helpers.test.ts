import { isOnlyRackBlocked, GATE_RACK_REQUIRED } from '@/src/features/workflow/lib/rack-gate-helpers';
import type { WorkflowActionDto } from '@/lib/hooks/use-workflow-actions';

function action(overrides: Partial<WorkflowActionDto>): WorkflowActionDto {
  return {
    actionCode: 'TEST_ACTION',
    label: 'Test',
    enabled: true,
    blockedReasons: [],
    ...overrides,
  };
}

describe('isOnlyRackBlocked', () => {
  it('returns true when blocked solely by the rack-required gate', () => {
    const a = action({
      enabled: false,
      blockedReasons: [{ code: GATE_RACK_REQUIRED, message: 'Rack required' }],
    });
    expect(isOnlyRackBlocked(a)).toBe(true);
  });

  it('returns false when blocked by rack plus another reason', () => {
    const a = action({
      enabled: false,
      blockedReasons: [
        { code: GATE_RACK_REQUIRED, message: 'Rack required' },
        { code: 'GATE_PAYMENT_REQUIRED', message: 'Payment required' },
      ],
    });
    expect(isOnlyRackBlocked(a)).toBe(false);
  });

  it('returns false when not blocked at all', () => {
    const a = action({ enabled: true, blockedReasons: [] });
    expect(isOnlyRackBlocked(a)).toBe(false);
  });

  it('returns false when disabled with no blocked reasons listed', () => {
    const a = action({ enabled: false, blockedReasons: [] });
    expect(isOnlyRackBlocked(a)).toBe(false);
  });
});

import { WORKFLOW_SCREEN_KEY_SET, WORKFLOW_SCREENS } from '@/lib/constants/workflow-screens';
import { leaveActionForScreen } from '@/lib/constants/workflow-leave-actions';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

describe('workflow screen keys', () => {
  it('maps the canonical driver delivery screen to confirm delivery', () => {
    expect(WORKFLOW_SCREEN_KEY_SET.has(WORKFLOW_SCREENS.DRIVER_DELIVERY)).toBe(true);
    expect(leaveActionForScreen(WORKFLOW_SCREENS.DRIVER_DELIVERY)).toBe(
      WORKFLOW_ACTIONS.CONFIRM_DELIVERY,
    );
  });

  it('does not treat the historical delivery alias as an engine screen', () => {
    expect(WORKFLOW_SCREEN_KEY_SET.has('delivery')).toBe(false);
    expect(leaveActionForScreen('delivery')).toBeNull();
  });
});

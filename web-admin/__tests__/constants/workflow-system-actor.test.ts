import { WORKFLOW_SYSTEM_ACTOR } from '@/lib/constants/workflow-system-actor';
import { leaveActionForScreen } from '@/lib/constants/workflow-leave-actions';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import { WORKFLOW_SCREEN_KEY_SET } from '@/lib/constants/workflow-screens';

describe('workflow system actor + public_tracking', () => {
  it('uses a valid UUID for history FK', () => {
    expect(WORKFLOW_SYSTEM_ACTOR.userId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(WORKFLOW_SYSTEM_ACTOR.userId).toBe(
      'a11ce000-0000-4000-8000-00000000f001',
    );
  });

  it('maps public_tracking leave action to CONFIRM_DELIVERY', () => {
    expect(WORKFLOW_SCREEN_KEY_SET.has('public_tracking')).toBe(true);
    expect(leaveActionForScreen('public_tracking')).toBe(
      WORKFLOW_ACTIONS.CONFIRM_DELIVERY,
    );
  });
});

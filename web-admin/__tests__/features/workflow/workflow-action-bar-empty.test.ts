/**
 * Unit tests: floor action-bar empty vs bounce (hidden leave-actions).
 */

import { workflowActionBarEmptyMode } from '@features/workflow/ui/workflow-action-bar-empty';

describe('workflowActionBarEmptyMode', () => {
  const deliveryFloor = {
    hasSupplementalActions: false,
    hideWhenEmpty: true,
    hasEmptyBackHref: true,
  };

  it('does not bounce when the only engine action is hidden by a stage-owned surface', () => {
    expect(
      workflowActionBarEmptyMode({
        ...deliveryFloor,
        visibleCount: 0,
        engineActionCount: 1,
      }),
    ).toBe('hide');
  });

  it('bounces only when the engine returned no actions for the screen', () => {
    expect(
      workflowActionBarEmptyMode({
        ...deliveryFloor,
        visibleCount: 0,
        engineActionCount: 0,
      }),
    ).toBe('redirect');
  });

  it('keeps the bar when a visible action remains', () => {
    expect(
      workflowActionBarEmptyMode({
        ...deliveryFloor,
        visibleCount: 1,
        engineActionCount: 2,
      }),
    ).toBe('ready');
  });
});

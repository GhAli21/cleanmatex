/**
 * Unit tests: next-step vs action-list ranking for the floor action bar.
 */

import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import type { WorkflowActionDto } from '@/lib/hooks/use-workflow-actions';
import { GATE_RACK_REQUIRED } from '@features/workflow/lib/rack-gate-helpers';
import {
  isWorkflowActionClickable,
  pickWorkflowActionBarPrimary,
  workflowActionBarLayout,
} from '@features/workflow/ui/workflow-action-bar-layout';
import {
  formatWorkflowStatusLabel,
  workflowStatusBadgeVariant,
  workflowStatusLookupKey,
} from '@features/workflow/ui/workflow-action-bar-status';

function action(
  partial: Pick<WorkflowActionDto, 'actionCode'> & Partial<WorkflowActionDto>,
): WorkflowActionDto {
  return {
    label: partial.actionCode,
    label2: null,
    enabled: true,
    blockedReasons: [],
    ...partial,
  };
}

describe('workflowActionBarLayout', () => {
  it('uses next-step with no primary when nothing is visible', () => {
    expect(workflowActionBarLayout([])).toEqual({
      mode: 'next-step',
      primary: null,
      rest: [],
    });
  });

  it('uses next-step for a single visible action', () => {
    const intake = action({
      actionCode: WORKFLOW_ACTIONS.CONFIRM_PHYSICAL_INTAKE,
      toStatus: 'preparing',
    });
    expect(workflowActionBarLayout([intake])).toEqual({
      mode: 'next-step',
      primary: intake,
      rest: [],
    });
  });

  it('uses action-list when two or more actions are visible', () => {
    const complete = action({
      actionCode: WORKFLOW_ACTIONS.COMPLETE_PROCESSING,
      toStatus: 'assembly',
    });
    const hold = action({ actionCode: WORKFLOW_ACTIONS.HOLD_ORDER_WORK, toStatus: 'on_hold' });
    const layout = workflowActionBarLayout([complete, hold]);
    expect(layout.mode).toBe('action-list');
    expect(layout.primary).toBe(complete);
    expect(layout.rest).toEqual([hold]);
  });

  it('keeps a forward action as primary when hold and stop are also listed', () => {
    const intake = action({
      actionCode: WORKFLOW_ACTIONS.CONFIRM_PHYSICAL_INTAKE,
      toStatus: 'preparing',
    });
    const hold = action({ actionCode: WORKFLOW_ACTIONS.HOLD_ORDER_WORK });
    const stop = action({ actionCode: WORKFLOW_ACTIONS.STOP_ORDER_WORK });
    const layout = workflowActionBarLayout([hold, intake, stop]);
    expect(layout.primary).toBe(intake);
    expect(layout.rest).toEqual([hold, stop]);
  });

  it('prefers the first clickable non-exception over an earlier blocked usual action', () => {
    const blockedPass = action({
      actionCode: WORKFLOW_ACTIONS.PASS_QA,
      enabled: false,
      blockedReasons: [{ code: 'GATE_X', message: 'Blocked' }],
      toStatus: 'packing',
    });
    const complete = action({
      actionCode: WORKFLOW_ACTIONS.COMPLETE_PACKING,
      toStatus: 'ready',
    });
    expect(pickWorkflowActionBarPrimary([blockedPass, complete])).toBe(complete);
  });

  it('falls back to hold when only exception actions are clickable', () => {
    const hold = action({ actionCode: WORKFLOW_ACTIONS.HOLD_ORDER_WORK });
    const stop = action({ actionCode: WORKFLOW_ACTIONS.STOP_ORDER_WORK });
    expect(pickWorkflowActionBarPrimary([hold, stop])).toBe(hold);
  });

  it('still shows a lone blocked action as the next-step command', () => {
    const blocked = action({
      actionCode: WORKFLOW_ACTIONS.CONFIRM_PHYSICAL_INTAKE,
      enabled: false,
      blockedReasons: [{ code: 'GATE_PAY', message: 'Pay first' }],
    });
    const layout = workflowActionBarLayout([blocked]);
    expect(layout.mode).toBe('next-step');
    expect(layout.primary).toBe(blocked);
  });

  it('treats rack-only blocks as clickable so the rack modal can open', () => {
    const rackBlocked = action({
      actionCode: WORKFLOW_ACTIONS.MARK_READY,
      enabled: false,
      blockedReasons: [{ code: GATE_RACK_REQUIRED, message: 'Rack required' }],
      toStatus: 'ready',
    });
    expect(isWorkflowActionClickable(rackBlocked)).toBe(true);
    expect(pickWorkflowActionBarPrimary([rackBlocked])).toBe(rackBlocked);
  });
});

describe('formatWorkflowStatusLabel', () => {
  const catalog: Record<string, string> = {
    'statusNames.intake': 'Intake',
    'statusNames.preparing': 'Preparing',
  };

  it('uses the catalog when the code exists', () => {
    expect(
      formatWorkflowStatusLabel(
        'intake',
        (key) => key in catalog,
        (key) => catalog[key] ?? key,
      ),
    ).toBe('Intake');
  });

  it('humanizes unknown codes instead of showing a raw token', () => {
    expect(
      formatWorkflowStatusLabel(
        'Out-For-Collection',
        () => false,
        (key) => key,
      ),
    ).toBe('out for collection');
  });

  it('returns null for empty status', () => {
    expect(formatWorkflowStatusLabel('  ', () => false, (key) => key)).toBeNull();
  });

  it('normalizes hyphenated codes for lookup', () => {
    expect(workflowStatusLookupKey('Ready-For-Pickup')).toBe('ready_for_pickup');
  });

  it('pairs terminal and hold statuses with a matching badge tone', () => {
    expect(workflowStatusBadgeVariant('ready')).toBe('success');
    expect(workflowStatusBadgeVariant('on_hold')).toBe('warning');
    expect(workflowStatusBadgeVariant('stopped')).toBe('error');
    expect(workflowStatusBadgeVariant('intake')).toBe('info');
  });
});

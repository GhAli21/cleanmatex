import {
  isWorkflowProfileCreateErrorCode,
  localizeWorkflowProfileError,
  staffEnForWorkflowProfileError,
  workflowProfileCreateErrorPayload,
  WORKFLOW_PROFILE_STAFF_EN,
} from '@/lib/services/workflow/workflow-profile-error-catalog';

describe('workflow profile error catalog', () => {
  it('maps assignment-required to the service-specific English sentence', () => {
    expect(staffEnForWorkflowProfileError('PROFILE_ASSIGNMENT_REQUIRED', {
      serviceCode: 'DRY_CLEAN',
    })).toBe(
      'No workflow profile is assigned for service category "DRY_CLEAN". Ask your platform administrator to assign a profile for that service before creating this order.',
    );
  });

  it('builds a 422 payload with a stable create errorCode', () => {
    expect(isWorkflowProfileCreateErrorCode('PROFILE_INITIAL_RULE_UNMATCHED')).toBe(true);
    expect(workflowProfileCreateErrorPayload('PROFILE_INITIAL_RULE_UNMATCHED')).toEqual({
      success: false,
      errorCode: 'PROFILE_INITIAL_RULE_UNMATCHED',
      error: WORKFLOW_PROFILE_STAFF_EN.PROFILE_INITIAL_RULE_UNMATCHED,
    });
  });

  it('localizes assignment-required with a service placeholder', () => {
    const keys = new Set(['PROFILE_ASSIGNMENT_REQUIRED', 'PROFILE_ASSIGNMENT_REQUIRED_SERVICE']);
    const t = Object.assign(
      (key: string, values?: Record<string, string>) => {
        if (key === 'PROFILE_ASSIGNMENT_REQUIRED_SERVICE') {
          return `missing ${values?.service ?? ''}`;
        }
        return key;
      },
      { has: (key: string) => keys.has(key) },
    );

    expect(localizeWorkflowProfileError(t, 'PROFILE_ASSIGNMENT_REQUIRED', {
      serviceCode: 'WASH_FOLD',
    })).toBe('missing WASH_FOLD');
  });
});

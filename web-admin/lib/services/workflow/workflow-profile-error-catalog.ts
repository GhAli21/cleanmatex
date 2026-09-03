/**
 * Staff-facing PROFILE_* copy and typed create/runtime codes.
 * UI locales under `workflow.profileErrors` must stay identical to the English
 * catalog so API fallbacks and toasts name the same cause.
 */

export const WORKFLOW_PROFILE_CREATE_ERROR_CODES = [
  'PROFILE_ASSIGNMENT_REQUIRED',
  'PROFILE_ASSIGNMENT_CONFLICT',
  'PROFILE_SERVICE_SCOPE_CONFLICT',
  'PROFILE_INITIAL_RULE_UNMATCHED',
  'PROFILE_NO_EXECUTABLE_VERSION',
  'PROFILE_NO_INITIAL_RULES',
  'PROFILE_INITIAL_RULES_INVALID',
  'PROFILE_INACTIVE',
  'PROFILE_RESOLUTION_FAILED',
] as const;

export type WorkflowProfileCreateErrorCode =
  (typeof WORKFLOW_PROFILE_CREATE_ERROR_CODES)[number];

export const WORKFLOW_PROFILE_RUNTIME_ERROR_CODES = [
  'PROFILE_SNAPSHOT_INCOMPLETE',
  'PROFILE_ARTIFACT_UNAVAILABLE',
  'PROFILE_ARTIFACT_INVALID',
  'PROFILE_EXECUTION_INVALID',
] as const;

export type WorkflowProfileRuntimeErrorCode =
  (typeof WORKFLOW_PROFILE_RUNTIME_ERROR_CODES)[number];

export type WorkflowProfileStaffErrorCode =
  | WorkflowProfileCreateErrorCode
  | WorkflowProfileRuntimeErrorCode;

/** Optional locale key when assignment miss names a service category. */
export const PROFILE_ASSIGNMENT_REQUIRED_SERVICE_KEY =
  'PROFILE_ASSIGNMENT_REQUIRED_SERVICE' as const;

export const WORKFLOW_PROFILE_CREATE_HTTP_STATUS = 422 as const;

export const WORKFLOW_PROFILE_STAFF_EN = {
  PROFILE_ASSIGNMENT_REQUIRED:
    'No workflow profile is assigned for this order. Ask your platform administrator to assign a Published profile, or an eligible Pilot on a test/demo tenant, before creating orders.',
  PROFILE_ASSIGNMENT_REQUIRED_SERVICE:
    'No workflow profile is assigned for service category "{service}". Ask your platform administrator to assign a profile for that service before creating this order.',
  PROFILE_ASSIGNMENT_CONFLICT:
    'More than one workflow profile applies to this order equally. Ask your platform administrator to remove the duplicate assignment in HQ.',
  PROFILE_SERVICE_SCOPE_CONFLICT:
    'This order mixes services that use different workflow profiles. Split them into separate orders, then submit each one.',
  PROFILE_INITIAL_RULE_UNMATCHED:
    'This order does not match any start rule on the assigned workflow profile. Retail, quick drop, order source, and order type each need a matching Initial rule. Ask HQ to add or widen those rules, then try again.',
  PROFILE_NO_EXECUTABLE_VERSION:
    'The assigned workflow profile has no runnable version. A Published version is required, or a Pilot version only on an HQ test/demo tenant. Ask your platform administrator.',
  PROFILE_NO_INITIAL_RULES:
    'The assigned workflow profile has no start rules. Ask HQ to add Initial rules before creating orders.',
  PROFILE_INITIAL_RULES_INVALID:
    'The assigned workflow profile has a damaged start-rule setup. Ask HQ to repair Initial rules.',
  PROFILE_INACTIVE:
    'The assigned workflow profile is no longer active. Ask your platform administrator to assign an active profile.',
  PROFILE_RESOLUTION_FAILED:
    'The workflow profile for this order could not be resolved. Contact your platform administrator.',
  PROFILE_SNAPSHOT_INCOMPLETE:
    'This order has no workflow profile binding, so it cannot be processed. Recreate the order after a workflow profile is assigned.',
  PROFILE_ARTIFACT_UNAVAILABLE:
    'The workflow version on this order is not a runnable Pilot or Published policy. Recreate the order, or ask HQ to publish the bound version.',
  PROFILE_ARTIFACT_INVALID:
    'The workflow profile on this order is missing required setup (modules, start rules, or action channels). Ask HQ to repair that profile version.',
  PROFILE_EXECUTION_INVALID:
    'This action does not match the order’s workflow profile. Refresh the order and use a listed action, or ask HQ to check the profile.',
} as const;

export interface WorkflowProfileErrorDetails {
  serviceCode?: string | null;
}

/**
 * True when `code` is a create-time PROFILE_* failure (submit-order 422).
 *
 * @param code - API `errorCode` or thrown resolution code.
 */
export function isWorkflowProfileCreateErrorCode(
  code: string | null | undefined,
): code is WorkflowProfileCreateErrorCode {
  return typeof code === 'string'
    && (WORKFLOW_PROFILE_CREATE_ERROR_CODES as readonly string[]).includes(code);
}

/**
 * True when `code` is a floor/runtime PROFILE_* integrity failure.
 *
 * @param code - Engine or stage-adapter `code`.
 */
export function isWorkflowProfileRuntimeErrorCode(
  code: string | null | undefined,
): code is WorkflowProfileRuntimeErrorCode {
  return typeof code === 'string'
    && (WORKFLOW_PROFILE_RUNTIME_ERROR_CODES as readonly string[]).includes(code);
}

/**
 * True when `code` has dedicated staff copy (create or runtime).
 *
 * @param code - Any PROFILE_* token from an API body.
 */
export function isWorkflowProfileStaffErrorCode(
  code: string | null | undefined,
): code is WorkflowProfileStaffErrorCode {
  return isWorkflowProfileCreateErrorCode(code) || isWorkflowProfileRuntimeErrorCode(code);
}

function interpolateService(template: string, serviceCode: string): string {
  return template.replaceAll('{service}', serviceCode);
}

/**
 * English staff sentence for API bodies and non-i18n callers.
 *
 * @param code - Typed PROFILE_* code.
 * @param details - Optional service category for assignment-required.
 */
export function staffEnForWorkflowProfileError(
  code: string,
  details?: WorkflowProfileErrorDetails,
): string | undefined {
  if (code === 'PROFILE_ASSIGNMENT_REQUIRED' && details?.serviceCode?.trim()) {
    return interpolateService(
      WORKFLOW_PROFILE_STAFF_EN.PROFILE_ASSIGNMENT_REQUIRED_SERVICE,
      details.serviceCode.trim(),
    );
  }
  if (isWorkflowProfileStaffErrorCode(code)) {
    return WORKFLOW_PROFILE_STAFF_EN[code];
  }
  return undefined;
}

/**
 * Submit-order / POST create JSON for a typed profile configuration failure.
 *
 * @param code - Create-time PROFILE_* code.
 * @param details - Optional service category for assignment-required.
 */
export function workflowProfileCreateErrorPayload(
  code: WorkflowProfileCreateErrorCode,
  details?: WorkflowProfileErrorDetails,
): {
  success: false;
  errorCode: WorkflowProfileCreateErrorCode;
  error: string;
  serviceCode?: string;
} {
  const serviceCode = details?.serviceCode?.trim() || undefined;
  return {
    success: false,
    errorCode: code,
    error: staffEnForWorkflowProfileError(code, details)
      ?? WORKFLOW_PROFILE_STAFF_EN.PROFILE_RESOLUTION_FAILED,
    ...(serviceCode ? { serviceCode } : {}),
  };
}

type ProfileErrorTranslate = {
  (key: string, values?: Record<string, string>): string;
  has: (key: string) => boolean;
};

/**
 * Resolves locale copy from `workflow.profileErrors` for a PROFILE_* code.
 *
 * @param t - `useTranslations('workflow.profileErrors')`.
 * @param code - API errorCode or engine code.
 * @param details - Optional service category for assignment-required.
 */
export function localizeWorkflowProfileError(
  t: ProfileErrorTranslate,
  code: string | null | undefined,
  details?: WorkflowProfileErrorDetails,
): string | undefined {
  if (!code) return undefined;
  if (
    code === 'PROFILE_ASSIGNMENT_REQUIRED'
    && details?.serviceCode?.trim()
    && t.has(PROFILE_ASSIGNMENT_REQUIRED_SERVICE_KEY)
  ) {
    return t(PROFILE_ASSIGNMENT_REQUIRED_SERVICE_KEY, { service: details.serviceCode.trim() });
  }
  if (t.has(code)) return t(code);
  return undefined;
}

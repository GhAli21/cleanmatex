import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { getCSRFToken } from '@/lib/utils/csrf-token';
import { resolveWorkflowStageCommandTarget } from '@/lib/workflow/workflow-stage-command-paths';

/** Authenticated staff/mobile command posted from a floor screen. */
export interface StaffWorkflowCommandRequest {
  orderId: string;
  screen: string;
  actionCode: string;
  expectedStateVersion: number;
  input?: Record<string, unknown>;
  gateDecisions?: Array<{
    gateCode: string;
    acknowledgementChallenge?: string;
    overrideReason?: string;
  }>;
}

/** Normalized engine or stage-adapter result used by floor hooks. */
export interface StaffWorkflowCommandResponse {
  ok: boolean;
  status: number;
  success: boolean;
  currentStatus?: string;
  stateVersion?: number;
  error?: string;
  code?: string;
  blockedReasons?: Array<{ code?: string; message?: string; message2?: string }>;
}

function pickStageInput(
  input: Record<string, unknown> | undefined,
  keys: readonly string[] | undefined,
): Record<string, unknown> {
  if (!input || !keys) return {};
  const body: Record<string, unknown> = {};
  for (const key of keys) {
    const value = input[key];
    if (value != null && value !== '') {
      body[key] = value;
    }
  }
  return body;
}

/**
 * Posts a floor workflow command to its versioned stage API when one exists,
 * otherwise to the shared engine adapter. Stage adapters own the screen and
 * action; callers must not send a guessed destination.
 *
 * @param request tenant-safe command already scoped to the current order
 * @returns normalized success/error payload for ActionBar and legacy hooks
 */
export async function postStaffWorkflowCommand(
  request: StaffWorkflowCommandRequest,
): Promise<StaffWorkflowCommandResponse> {
  const csrfToken = await getCSRFToken();
  const idempotencyKey =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${request.orderId}:${request.actionCode}:${Date.now()}`;
  const target = resolveWorkflowStageCommandTarget(request.screen, request.actionCode);
  const path = target
    ? target.path(request.orderId)
    : `/api/v1/orders/${request.orderId}/actions`;
  const body = target
    ? {
        expectedStateVersion: request.expectedStateVersion,
        ...pickStageInput(request.input, target.inputKeys),
        ...(request.gateDecisions ? { gateDecisions: request.gateDecisions } : {}),
      }
    : {
        screen: request.screen,
        actionCode: request.actionCode,
        expectedStateVersion: request.expectedStateVersion,
        input: request.input,
        ...(request.gateDecisions ? { gateDecisions: request.gateDecisions } : {}),
      };

  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      ...getCSRFHeader(csrfToken),
    },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const nested =
    json.data && typeof json.data === 'object'
      ? (json.data as Record<string, unknown>)
      : json;
  return {
    ok: response.ok,
    status: response.status,
    success: json.success === true,
    currentStatus:
      typeof nested.currentStatus === 'string'
        ? nested.currentStatus
        : typeof json.currentStatus === 'string'
          ? json.currentStatus
          : undefined,
    stateVersion:
      typeof nested.stateVersion === 'number'
        ? nested.stateVersion
        : typeof json.stateVersion === 'number'
          ? json.stateVersion
          : undefined,
    error: typeof json.error === 'string' ? json.error : undefined,
    code: typeof json.code === 'string' ? json.code : undefined,
    blockedReasons: Array.isArray(json.blockedReasons)
      ? (json.blockedReasons as StaffWorkflowCommandResponse['blockedReasons'])
      : undefined,
  };
}

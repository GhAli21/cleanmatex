import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowContextQueryKey } from '@/lib/hooks/use-workflow-context';
import { isWorkflowEngineV2Enabled } from '@/lib/config/features';
import { leaveActionForScreen } from '@/lib/constants/workflow-leave-actions';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';

/**
 *
 */
export interface TransitionInput {
  screen: string;
  to_status?: string;
  notes?: string;
  metadata?: Record<string, any>;
  useOldWfCodeOrNew?: boolean;
  /** Explicit engine action; otherwise derived from screen (+ reject heuristics). */
  actionCode?: string;
  [key: string]: any;
}

/**
 *
 */
export interface TransitionResult {
  success: boolean;
  ok?: boolean;
  data?: {
    order: {
      id: string;
      status: string;
      currentStatus?: string;
      stateVersion?: number;
    };
  };
  error?: string;
  code?: string;
  blockers?: string[];
  details?: any;
  engine?: string;
}

function resolveActionCode(input: TransitionInput): string | null {
  if (typeof input.actionCode === 'string' && input.actionCode.trim()) {
    return input.actionCode.trim();
  }
  const screen = (input.screen || '').toLowerCase();
  const to = (input.to_status || '').toLowerCase();
  if (screen === 'qa' && to === 'processing') {
    return WORKFLOW_ACTIONS.FAIL_QA;
  }
  return leaveActionForScreen(screen);
}

/**
 * Hook to execute order transitions.
 * Under Workflow Engine V2 canary: uses available-actions + executeAction
 * (preferredToStatus = to_status). Otherwise Legacy/Enhanced transition API.
 */
export function useOrderTransition() {
  const queryClient = useQueryClient();

  return useMutation<TransitionResult, Error, { orderId: string; input: TransitionInput }>({
    mutationFn: async ({ orderId, input }) => {
      if (isWorkflowEngineV2Enabled()) {
        const actionCode = resolveActionCode(input);
        if (!actionCode) {
          return {
            success: false,
            ok: false,
            error: `No workflow action mapped for screen "${input.screen}"`,
            code: 'ACTION_NOT_MAPPED',
          };
        }

        const qs = new URLSearchParams({ screen: input.screen });
        const availRes = await fetch(
          `/api/v1/orders/${orderId}/available-actions?${qs.toString()}`,
        );
        const availJson = await availRes.json();
        if (!availRes.ok || !availJson.success) {
          return {
            success: false,
            ok: false,
            error: availJson.error || 'Failed to load available actions',
            code: availJson.code,
          };
        }
        const payload = availJson.data ?? availJson;
        const stateVersion = Number(payload.stateVersion ?? 0);

        const idempotencyKey =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${orderId}:${actionCode}:${Date.now()}`;

        const actionRes = await fetch(`/api/v1/orders/${orderId}/actions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': idempotencyKey,
          },
          body: JSON.stringify({
            screen: input.screen,
            actionCode,
            expectedStateVersion: stateVersion,
            input: {
              preferredToStatus: input.to_status,
              notes: input.notes,
              rackLocation: input.rackLocation ?? input.rack_location,
              metadata: input.metadata,
            },
          }),
        });
        const actionJson = await actionRes.json();
        if (!actionRes.ok || !actionJson.success) {
          return {
            success: false,
            ok: false,
            error: actionJson.error || 'Action failed',
            code: actionJson.code,
            blockers: actionJson.blockedReasons?.map(
              (b: { message?: string }) => b.message || '',
            ),
            details: actionJson.blockedReasons,
            engine: 'workflow_v2',
          };
        }

        const status = actionJson.currentStatus as string;
        return {
          success: true,
          ok: true,
          engine: 'workflow_v2',
          data: {
            order: {
              id: orderId,
              status,
              currentStatus: status,
              stateVersion: actionJson.stateVersion,
            },
          },
        };
      }

      const response = await fetch(`/api/v1/orders/${orderId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screen: input.screen,
          toStatus: input.to_status,
          notes: input.notes,
          metadata: input.metadata,
          useOldWfCodeOrNew: input.useOldWfCodeOrNew,
          input: input,
        }),
      });

      const json = (await response.json()) as TransitionResult;

      if (!response.ok) {
        return {
          success: false,
          ok: false,
          error: json.error || 'Transition failed',
          code: json.code,
          blockers: json.blockers,
          details: json.details,
        };
      }

      return json;
    },
    onSuccess: (data, variables) => {
      if (data?.success) {
        queryClient.invalidateQueries({ queryKey: ['order', variables.orderId] });
        queryClient.invalidateQueries({ queryKey: workflowContextQueryKey(variables.orderId) });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      }
    },
  });
}

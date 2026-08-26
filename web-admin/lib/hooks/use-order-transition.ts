import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowContextQueryKey } from '@/lib/hooks/use-workflow-context';
import { leaveActionForScreen } from '@/lib/constants/workflow-leave-actions';
import { WORKFLOW_ACTIONS } from '@/lib/constants/workflow-actions';
import { postStaffWorkflowCommand } from '@/lib/workflow/post-staff-workflow-command';

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
  /** Only set after the server-provided action list presents multiple valid edges. */
  preferredToStatus?: string;
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
 * Uses the semantic available-actions and execute-action contracts. The client
 * never selects a legacy writer because the order artifact is the sole runtime
 * policy authority.
 */
export function useOrderTransition() {
  const queryClient = useQueryClient();

  return useMutation<TransitionResult, Error, { orderId: string; input: TransitionInput }>({
    mutationFn: async ({ orderId, input }) => {
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

      const actionResult = await postStaffWorkflowCommand({
        orderId,
        screen: input.screen,
        actionCode,
        expectedStateVersion: stateVersion,
        input: {
          // Stage APIs ignore destination guesses; keep explicit edge
          // selection only for unmapped engine-adapter commands.
          preferredToStatus: input.preferredToStatus,
          notes: input.notes,
          reason: input.notes,
          rackLocation: input.rackLocation ?? input.rack_location,
          metadata: input.metadata,
          cancelled_note: input.cancelled_note,
          cancellation_disposition: input.cancellation_disposition,
          cancellation_reason_code: input.cancellation_reason_code,
          return_reason: input.return_reason,
          return_reason_code: input.return_reason_code,
        },
      });
      if (!actionResult.ok || !actionResult.success) {
        return {
          success: false,
          ok: false,
          error: actionResult.error || 'Action failed',
          code: actionResult.code,
          blockers: actionResult.blockedReasons?.map(
            (b) => b.message || '',
          ),
          details: actionResult.blockedReasons,
          engine: 'semantic_profile',
        };
      }

      const status = actionResult.currentStatus as string;
      return {
        success: true,
        ok: true,
        engine: 'semantic_profile',
        data: {
          order: {
            id: orderId,
            status,
            currentStatus: status,
            stateVersion: actionResult.stateVersion,
          },
        },
      };
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

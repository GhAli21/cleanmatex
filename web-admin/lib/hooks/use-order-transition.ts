import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface TransitionInput {
  screen: string;
  to_status?: string;
  notes?: string;
  metadata?: Record<string, any>;
  useOldWfCodeOrNew?: boolean;
  [key: string]: any;
}

export interface TransitionResult {
  success: boolean;
  ok?: boolean;
  data?: {
    order: {
      id: string;
      status: string;
    };
  };
  error?: string;
  code?: string;
  blockers?: string[];
  details?: any;
}

/**
 * Hook to execute order transitions
 */
export function useOrderTransition() {
  const queryClient = useQueryClient();

  return useMutation<TransitionResult, Error, { orderId: string; input: TransitionInput }>({
    mutationFn: async ({ orderId, input }) => {
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

      // Normalize non-2xx into a typed result so callers can show blockers/details.
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
      // Invalidate queries to refresh data
      if (data?.success) {
        queryClient.invalidateQueries({ queryKey: ['order', variables.orderId] });
        queryClient.invalidateQueries({ queryKey: ['workflow-context', variables.orderId] });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      }
    },
  });
}


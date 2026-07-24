import { useQuery } from '@tanstack/react-query';

/**
 *
 */
export interface WorkflowContextFlags {
  template_id?: string | null;
  template_code?: string | null;
  template_name?: string | null;
  template_version_number?: number | null;
  is_tenant_default?: boolean;
  allow_back_steps?: boolean;
  assembly_enabled?: boolean;
  qa_enabled?: boolean;
  packing_enabled?: boolean;
}

/**
 *
 */
export interface WorkflowContext {
  orderId: string;
  flags: WorkflowContextFlags;
  /** @deprecated Metrics removed from API — use local order/items state. */
  metrics?: {
    items_count: number;
    pieces_total: number;
    pieces_scanned: number;
    all_items_processed: boolean;
  };
}

/** Shared query key — invalidate after transitions / item / piece changes. */
export function workflowContextQueryKey(orderId: string) {
  return ['workflow-context', orderId] as const;
}

/**
 * Workflow template flags for an order detail screen.
 *
 * Fetch once; refresh only via invalidation after mutations. No polling.
 */
export function useWorkflowContext(orderId: string | null) {
  return useQuery<WorkflowContext>({
    queryKey: workflowContextQueryKey(orderId ?? ''),
    queryFn: async () => {
      if (!orderId) {
        throw new Error('Order ID is required');
      }
      const response = await fetch(`/api/v1/orders/${orderId}/workflow-context`);
      if (response.status === 404) {
        throw new Error('Order not found');
      }
      if (!response.ok) {
        throw new Error('Failed to fetch workflow context');
      }
      return response.json() as Promise<WorkflowContext>;
    },
    enabled: !!orderId,
    staleTime: 60_000,
    gcTime: 5 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });
}

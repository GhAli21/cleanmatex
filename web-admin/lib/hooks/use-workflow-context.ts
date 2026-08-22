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
  /** Immutable profile metadata when the order has a semantic snapshot. */
  semantic_profile?: {
    profile_id: string;
    profile_version_no: number;
    policy_revision: number;
    enabled_screen_keys: string[];
    primary_owner_screen_keys: string[];
  };
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
 * Read-only workflow capability context for an order detail screen. Semantic
 * orders receive artifact-derived module hints; no client may use them to
 * select a transition destination.
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

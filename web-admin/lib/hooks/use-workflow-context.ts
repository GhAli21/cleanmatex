import { useQuery } from '@tanstack/react-query';

export interface WorkflowContext {
  orderId: string;
  flags: {
    template_id?: string;
    assembly_enabled?: boolean;
    qa_enabled?: boolean;
    packing_enabled?: boolean;
  };
  metrics: {
    items_count: number;
    pieces_total: number;
    pieces_scanned: number;
    all_items_processed: boolean;
  };
}

/**
 * Hook to fetch workflow context (flags and metrics) for an order
 * @param orderId - Order ID
 */
export function useWorkflowContext(orderId: string | null) {
  return useQuery<WorkflowContext>({
    queryKey: ['workflow-context', orderId],
    queryFn: async () => {
      if (!orderId) {
        throw new Error('Order ID is required');
      }
      const response = await fetch(`/api/v1/orders/${orderId}/workflow-context`);
      if (!response.ok) {
        throw new Error('Failed to fetch workflow context');
      }
      return response.json();
    },
    enabled: !!orderId,
    refetchInterval: 30000, // Refresh every 30 seconds
  });
}


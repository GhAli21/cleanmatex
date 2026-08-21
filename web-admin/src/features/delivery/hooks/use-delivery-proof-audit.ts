import { useQuery } from '@tanstack/react-query';
import { getDeliveryProofAudit } from '@features/delivery/api/delivery-proof-audit-api';

/** Shares delivery audit caching between the stop workspace and Order Details. */
export function useDeliveryProofAudit(orderId: string) {
  return useQuery({
    queryKey: ['delivery', 'proof-audit', orderId],
    queryFn: () => getDeliveryProofAudit(orderId),
    enabled: Boolean(orderId),
    staleTime: 60_000,
  });
}

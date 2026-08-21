import type { DeliveryProofAudit } from '@features/delivery/model/delivery-proof-audit';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  code?: string;
  error?: string;
}

/** Stable read error that lets every delivery channel handle proof audit failures consistently. */
export class DeliveryProofAuditApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DeliveryProofAuditApiError';
    this.code = code;
  }
}

/** Reads the authorized order audit rather than allowing UI code to access storage directly. */
export async function getDeliveryProofAudit(orderId: string): Promise<DeliveryProofAudit> {
  const response = await fetch(`/api/v1/delivery/orders/${orderId}/proof`, {
    method: 'GET',
    credentials: 'include',
  });
  const payload = await response.json().catch(() => null) as ApiEnvelope<DeliveryProofAudit> | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new DeliveryProofAuditApiError(
      payload?.code ?? 'DELIVERY_PROOF_AUDIT_FAILED',
      payload?.error ?? 'Delivery proof audit could not be loaded.',
    );
  }
  return payload.data;
}

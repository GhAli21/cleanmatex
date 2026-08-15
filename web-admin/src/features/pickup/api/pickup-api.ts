/** Browser API client for the staff counter-pickup command. */

import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';

/** Request body for the versioned pickup completion endpoint. */
export interface ConfirmPickupRequest {
  expectedStateVersion: number;
  handoverNotes?: string;
}

/** Successful payload returned by the pickup completion endpoint. */
export interface ConfirmPickupResponse {
  orderId: string;
  releaseIds: string[];
  workflow: {
    currentStatus: string;
    stateVersion: number;
  };
}

/** Stable API error exposed to the pickup UI without coupling it to fetch details. */
export class PickupApiError extends Error {
  /** Machine-readable server error code for controlled UX decisions. */
  readonly code: string;

  /**
   * @param code stable API error code
   * @param message operator-facing failure message
   */
  constructor(code: string, message: string) {
    super(message);
    this.name = 'PickupApiError';
    this.code = code;
  }
}

/**
 * Confirm an in-store customer pickup through the stage-owned API.
 *
 * @param orderId order being handed over
 * @param request optimistic-concurrency input
 * @param idempotencyKey replay key retained by the caller on transport failure
 * @param csrfToken session-bound CSRF token
 * @returns atomic pickup completion result
 */
export async function confirmPickup(
  orderId: string,
  request: ConfirmPickupRequest,
  idempotencyKey: string,
  csrfToken: string | null,
): Promise<ConfirmPickupResponse> {
  const response = await fetch(`/api/v1/pickup/orders/${orderId}/complete`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
      ...getCSRFHeader(csrfToken),
    },
    body: JSON.stringify(request),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    code?: string;
    error?: string;
    data?: ConfirmPickupResponse;
  };

  if (!response.ok || payload.success !== true || !payload.data) {
    throw new PickupApiError(
      payload.code ?? 'PICKUP_COMPLETION_FAILED',
      payload.error ?? 'Pickup completion failed.',
    );
  }
  return payload.data;
}

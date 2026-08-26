import { getCSRFToken, getCSRFTokenHeaderName } from '@/lib/utils/csrf-token';
import type { DeliveryPodMethod } from '@/lib/services/delivery/delivery-pod-method.service';
import type { DeliveryStopView } from '@/lib/services/delivery/delivery-route-query.service';

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  code?: string;
  error?: string;
}

export interface DeliveryEvidenceReceipt {
  id: string;
  evidenceType: 'signature' | 'photo';
  expiresAt: string;
}

export interface CompleteDeliveryInput {
  stopId: string;
  expectedStateVersion: number;
  idempotencyKey: string;
  podMethodCode: string;
  podNotes?: string;
  signatureEvidenceId?: string;
  photoEvidenceIds?: string[];
}

export interface CompleteOrderDeliveryInput {
  orderId: string;
  expectedStateVersion: number;
  idempotencyKey: string;
  podNotes?: string;
}

export interface CompleteOrderDeliveryResponse {
  orderId: string;
  workflow: {
    currentStatus: string;
    stateVersion: number;
  };
}

/** Stable client error that preserves safe command error codes for the UI. */
export class DeliveryApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DeliveryApiError';
    this.code = code;
  }
}

async function csrfHeaders(): Promise<Record<string, string>> {
  const token = await getCSRFToken();
  if (!token) {
    throw new DeliveryApiError('CSRF_UNAVAILABLE', 'Unable to verify this delivery request.');
  }

  return { [getCSRFTokenHeaderName()]: token };
}

async function readEnvelope<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as ApiEnvelope<T> | null;
  if (!response.ok || !payload?.success || !payload.data) {
    throw new DeliveryApiError(
      payload?.code ?? 'DELIVERY_REQUEST_FAILED',
      payload?.error ?? 'Delivery request failed.',
    );
  }
  return payload.data;
}

/** Lists methods that the server permits for staff delivery completion. */
export async function listDeliveryPodMethods(stopId?: string): Promise<DeliveryPodMethod[]> {
  const query = stopId ? `?stopId=${encodeURIComponent(stopId)}` : '';
  const response = await fetch(`/api/v1/delivery/pod-methods${query}`, {
    method: 'GET',
    credentials: 'include',
  });
  return readEnvelope<DeliveryPodMethod[]>(response);
}

/** Uploads one private proof file and returns a short-lived completion receipt. */
export async function uploadDeliveryEvidence(input: {
  stopId: string;
  evidenceType: 'signature' | 'photo';
  file: File;
}): Promise<DeliveryEvidenceReceipt> {
  const formData = new FormData();
  formData.append('evidenceType', input.evidenceType);
  formData.append('file', input.file);

  const response = await fetch(`/api/v1/delivery/stops/${input.stopId}/evidence`, {
    method: 'POST',
    credentials: 'include',
    headers: await csrfHeaders(),
    body: formData,
  });
  return readEnvelope<DeliveryEvidenceReceipt>(response);
}

/** Sends the versioned atomic completion command after its proof receipts exist. */
export async function completeDelivery(input: CompleteDeliveryInput): Promise<void> {
  const response = await fetch(`/api/v1/delivery/stops/${input.stopId}/complete`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(await csrfHeaders()),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expectedStateVersion: input.expectedStateVersion,
      idempotencyKey: input.idempotencyKey,
      podMethodCode: input.podMethodCode,
      podNotes: input.podNotes,
      signatureEvidenceId: input.signatureEvidenceId,
      photoEvidenceIds: input.photoEvidenceIds,
    }),
  });
  await readEnvelope<Record<string, never>>(response);
}

/** Completes delivery from the floor screen when no planned stop exists. */
export async function completeOrderDelivery(
  input: CompleteOrderDeliveryInput,
): Promise<CompleteOrderDeliveryResponse> {
  const response = await fetch(`/api/v1/delivery/orders/${input.orderId}/complete`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      ...(await csrfHeaders()),
      'Content-Type': 'application/json',
      'Idempotency-Key': input.idempotencyKey,
    },
    body: JSON.stringify({
      expectedStateVersion: input.expectedStateVersion,
      podNotes: input.podNotes,
    }),
  });
  return readEnvelope<CompleteOrderDeliveryResponse>(response);
}

/** Loads the planned stop for an order, if the profile is using routed delivery. */
export async function getActiveDeliveryStop(orderId: string): Promise<DeliveryStopView | null> {
  const response = await fetch(`/api/v1/delivery/orders/${orderId}/active-stop`, {
    method: 'GET',
    credentials: 'include',
  });
  const data = await readEnvelope<{ stop: DeliveryStopView | null }>(response);
  return data.stop;
}

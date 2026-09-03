import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';

export interface ConfirmHomeCollectionRequest {
  expectedStateVersion: number;
  collectionNotes?: string;
}

export interface ConfirmHomeCollectionResponse {
  orderId: string;
  workflow: {
    currentStatus: string;
    stateVersion: number;
  };
}

export class HomeCollectionApiError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'HomeCollectionApiError';
    this.code = code;
  }
}

export async function confirmHomeCollection(
  orderId: string,
  request: ConfirmHomeCollectionRequest,
  idempotencyKey: string,
  csrfToken: string | null,
): Promise<ConfirmHomeCollectionResponse> {
  const response = await fetch(`/api/v1/home-collection/orders/${orderId}/complete`, {
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
    data?: ConfirmHomeCollectionResponse;
  };

  if (!response.ok || payload.success !== true || !payload.data) {
    throw new HomeCollectionApiError(
      payload.code ?? 'HOME_COLLECTION_COMPLETION_FAILED',
      payload.error ?? 'Home collection confirmation failed.',
    );
  }
  return payload.data;
}

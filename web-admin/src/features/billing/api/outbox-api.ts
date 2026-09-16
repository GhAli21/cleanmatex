import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import type {
  OutboxListQuery,
  OutboxListResponse,
  OutboxMonitorEventDetail,
  OutboxPagination,
} from '../model/outbox-types';

interface SuccessEnvelope<T> {
  success: true;
  data: T;
  pagination?: OutboxPagination;
}

interface ErrorEnvelope {
  success: false;
  error?: string;
}

async function readJson<T>(res: Response): Promise<SuccessEnvelope<T> | ErrorEnvelope> {
  try {
    return (await res.json()) as SuccessEnvelope<T> | ErrorEnvelope;
  } catch {
    return { success: false, error: undefined };
  }
}

export async function fetchOutboxMonitor(
  query: OutboxListQuery,
): Promise<SuccessEnvelope<OutboxListResponse> | ErrorEnvelope> {
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
  });
  if (query.status) params.set('status', query.status);
  if (query.eventType) params.set('eventType', query.eventType);
  if (query.aggregateType) params.set('aggregateType', query.aggregateType);
  if (query.search) params.set('search', query.search);
  if (query.stuckOnly) params.set('stuck', '1');
  if (query.from) params.set('from', query.from);
  if (query.to) params.set('to', query.to);

  const res = await fetch(`/api/v1/finance/outbox?${params.toString()}`);
  return readJson<OutboxListResponse>(res);
}

export async function fetchOutboxEvent(
  eventId: string,
): Promise<SuccessEnvelope<OutboxMonitorEventDetail> | ErrorEnvelope> {
  const res = await fetch(`/api/v1/finance/outbox/${eventId}`);
  return readJson<OutboxMonitorEventDetail>(res);
}

export async function retryOutboxEvent(
  eventId: string,
  csrfToken: string | null,
): Promise<SuccessEnvelope<unknown> | ErrorEnvelope> {
  const res = await fetch(`/api/v1/finance/outbox/${eventId}/retry`, {
    method: 'POST',
    headers: { ...getCSRFHeader(csrfToken) },
  });
  return readJson(res);
}

export async function retryOutboxBulk(
  body: {
    ids?: string[];
    filters?: {
      status?: string;
      eventType?: string;
      aggregateType?: string;
      search?: string;
      stuckOnly?: boolean;
    };
  },
  csrfToken: string | null,
): Promise<SuccessEnvelope<{ retried: number; requested: number }> | ErrorEnvelope> {
  const res = await fetch('/api/v1/finance/outbox/retry-bulk', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...getCSRFHeader(csrfToken),
    },
    body: JSON.stringify(body),
  });
  return readJson(res);
}

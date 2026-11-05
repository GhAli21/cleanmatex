/**
 * Client calls for scanning and piece tags (HFC P3b). Errors come back as `{ ok: false, status, body }` so the UI
 * can show the EN/AR text for `body.code`.
 */
import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import type { ScanContext } from '@/lib/validations/code-format-schemas';
import type { ScanResult } from '@/lib/services/scan-resolve/scan-resolve.service';

export interface ApiErrorBody {
  success?: false;
  error?: string;
  code?: string;
  tag?: string;
  heldByPieceCode?: string | null;
  issues?: unknown[];
}

export type ApiOutcome<T> = { ok: true; data: T } | { ok: false; status: number; body: ApiErrorBody };

async function call<T>(url: string, init: RequestInit): Promise<ApiOutcome<T>> {
  const res = await fetch(url, init);
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; data?: T } & ApiErrorBody;
  if (res.ok && body.success) return { ok: true, data: body.data as T };
  return { ok: false, status: res.status, body };
}

export function resolveScan(raw: string, context: ScanContext = 'any'): Promise<ApiOutcome<ScanResult>> {
  return call<ScanResult>('/api/v1/scan/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw, context }),
  });
}

export interface PieceTagSaved {
  pieceId: string;
  pieceCode: string | null;
  externalTag: string | null;
}

export function linkPieceTag(pieceId: string, tag: string, csrfToken: string | null): Promise<ApiOutcome<PieceTagSaved>> {
  return call<PieceTagSaved>(`/api/v1/orders/pieces/${encodeURIComponent(pieceId)}/external-tag`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
    body: JSON.stringify({ tag }),
  });
}

export function removePieceTag(pieceId: string, csrfToken: string | null): Promise<ApiOutcome<PieceTagSaved>> {
  return call<PieceTagSaved>(`/api/v1/orders/pieces/${encodeURIComponent(pieceId)}/external-tag`, {
    method: 'DELETE',
    headers: getCSRFHeader(csrfToken),
  });
}

/** Where a scan result opens: the order page, with `?piece=` for a piece. */
export function scanResultHref(result: Pick<ScanResult, 'order' | 'piece'>): string {
  const base = `/dashboard/orders/${encodeURIComponent(result.order.id)}`;
  return result.piece ? `${base}?piece=${encodeURIComponent(result.piece.id)}` : base;
}

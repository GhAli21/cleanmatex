'use client';

import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { POS_SHIFT_REPORT_ERROR } from '@/lib/constants/pos-shift-report';
import type {
  PosShiftReportSnapshot,
  PosShiftZArchivePage,
  PosShiftZReport,
} from '@/lib/types/pos-shift-report';
import { PosSessionApiError, type PosSessionApiEnvelope } from '@features/pos-sessions/api/pos-session-api';

/** Query key of a session's live X-report. */
export const posShiftXReportKey = (sessionId: string) => ['pos-sessions', 'x-report', sessionId] as const;
/** Query key of a session's stored Z-report. */
export const posShiftZReportKey = (sessionId: string) => ['pos-sessions', 'z-report', sessionId] as const;

async function readEnvelope<T>(response: Response, fallback: string): Promise<PosSessionApiEnvelope<T>> {
  const payload = (await response.json().catch(() => ({}))) as PosSessionApiEnvelope<T>;
  if (!response.ok || payload.success === false) {
    throw new PosSessionApiError(payload.error || fallback, payload.errorCode, response.status);
  }
  return payload;
}

/** The live X-report of a POS session (computed on demand, never stored). */
export async function fetchPosShiftXReport(sessionId: string): Promise<PosShiftReportSnapshot> {
  const response = await fetch(`/api/v1/pos-sessions/${sessionId}/x-report`, { credentials: 'include' });
  const payload = await readEnvelope<PosShiftReportSnapshot>(response, 'Failed to load the X-report');
  if (!payload.data) throw new PosSessionApiError('Failed to load the X-report', undefined, response.status);
  return payload.data;
}

/**
 * The stored Z-report of a POS session, or `null` when none exists yet (the session is still live,
 * or the tenant does not generate Z-reports automatically).
 */
export async function fetchPosShiftZReport(sessionId: string): Promise<PosShiftZReport | null> {
  const response = await fetch(`/api/v1/pos-sessions/${sessionId}/z-report`, { credentials: 'include' });
  if (response.status === 404) {
    const payload = (await response.json().catch(() => ({}))) as PosSessionApiEnvelope<never>;
    if (payload.errorCode === POS_SHIFT_REPORT_ERROR.Z_NOT_FOUND) return null;
    throw new PosSessionApiError(payload.error || 'POS session was not found', payload.errorCode, 404);
  }
  const payload = await readEnvelope<PosShiftZReport>(response, 'Failed to load the Z-report');
  return payload.data ?? null;
}

/** Generates the Z-report of a closed session that has none (idempotent) and returns it. */
export async function generatePosShiftZReport(
  sessionId: string,
  csrfToken: string | null
): Promise<PosShiftZReport> {
  const response = await fetch(`/api/v1/pos-sessions/${sessionId}/z-report`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
  });
  const payload = await readEnvelope<PosShiftZReport>(response, 'Failed to generate the Z-report');
  if (!payload.data) throw new PosSessionApiError('Failed to generate the Z-report', undefined, response.status);
  return payload.data;
}

/** Filters of the Z-report archive; empty values are omitted from the request. */
export interface PosShiftZArchiveFilters {
  page: number;
  pageSize: number;
  branchId?: string;
  businessDateFrom?: string;
  businessDateTo?: string;
  query?: string;
}

/** Query key of the Z-report archive for one filter set. */
export const posShiftZArchiveKey = (filters: PosShiftZArchiveFilters) =>
  ['pos-sessions', 'z-archive', filters] as const;

/** One page of the Z-report archive (frozen shift reports, newest business day first). */
export async function fetchPosShiftZArchive(filters: PosShiftZArchiveFilters): Promise<PosShiftZArchivePage> {
  const params = new URLSearchParams({ page: String(filters.page), pageSize: String(filters.pageSize) });
  if (filters.branchId) params.set('branchId', filters.branchId);
  if (filters.businessDateFrom) params.set('businessDateFrom', filters.businessDateFrom);
  if (filters.businessDateTo) params.set('businessDateTo', filters.businessDateTo);
  if (filters.query) params.set('query', filters.query);
  const response = await fetch(`/api/v1/pos-sessions/z-reports?${params.toString()}`, { credentials: 'include' });
  const payload = await readEnvelope<PosShiftZArchivePage>(response, 'Failed to load the Z-report archive');
  if (!payload.data) throw new PosSessionApiError('Failed to load the Z-report archive', undefined, response.status);
  return payload.data;
}

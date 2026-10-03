'use client';

import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import type {
  GetMyActivePosSessionResult,
  OpenPosSessionResult,
  PosSessionLifecycleResult,
  PosSessionSummary,
} from '@/lib/types/pos-session';

/** Lifecycle endpoints supported by the POS session command API. */
export type PosSessionLifecycleEndpoint = 'open' | 'pause' | 'resume' | 'close' | 'force-close';

/** Standard response envelope returned by POS session API routes. */
export interface PosSessionApiEnvelope<T> {
  success?: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

/** Error wrapper that preserves API error codes for UI flow decisions. */
export class PosSessionApiError extends Error {
  constructor(
    message: string,
    public readonly errorCode?: string,
    public readonly status?: number
  ) {
    super(message);
    this.name = 'PosSessionApiError';
  }
}

/** Shared active-session query key so order surfaces reuse one cached result. */
export function posSessionActiveQueryKey(branchId?: string | null, includeContext = false) {
  return ['pos-sessions', 'my-active', branchId ?? 'none', includeContext ? 'context' : 'basic'] as const;
}

/**
 * Fetches the active POS session with optional presentation context for compact
 * order-entry surfaces.
 */
export async function fetchMyActivePosSession(input: {
  branchId?: string | null;
  includeContext?: boolean;
} = {}): Promise<GetMyActivePosSessionResult> {
  const params = new URLSearchParams();
  if (input.branchId) params.set('branchId', input.branchId);
  if (input.includeContext) params.set('includeContext', 'true');

  const suffix = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`/api/v1/pos-sessions/my-active${suffix}`, {
    credentials: 'include',
  });
  const payload = (await response.json().catch(() => ({}))) as PosSessionApiEnvelope<GetMyActivePosSessionResult>;

  if (!response.ok && payload.errorCode === 'POS_SESSION_BRANCH_CONFLICT' && payload.data) {
    return payload.data;
  }
  if (!response.ok || payload.success === false) {
    throw new PosSessionApiError(payload.error || 'Failed to load POS session', payload.errorCode, response.status);
  }
  if (!payload.data) {
    throw new PosSessionApiError('Failed to load POS session', undefined, response.status);
  }
  return payload.data;
}

/**
 * Loads finance summary lazily so order entry does not pay this query cost until
 * the operator opens the Session Hub.
 */
export async function fetchPosSessionSummary(sessionId: string): Promise<PosSessionSummary> {
  return fetchPosSessionJson<PosSessionSummary>(`/api/v1/pos-sessions/${sessionId}/summary`);
}

/**
 * Runs a POS lifecycle command with the required idempotency metadata.
 */
export async function postPosSessionLifecycleAction(
  endpoint: PosSessionLifecycleEndpoint,
  input: {
    csrfToken: string | null;
    body?: Record<string, unknown>;
    sourceChannel: string;
  }
): Promise<OpenPosSessionResult | PosSessionLifecycleResult> {
  const response = await fetch(`/api/v1/pos-sessions/${endpoint}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCSRFHeader(input.csrfToken),
    },
    body: JSON.stringify({
      ...(input.body ?? {}),
      idempotencyKey: `${endpoint}:${crypto.randomUUID()}`,
      sourceChannel: input.sourceChannel,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as PosSessionApiEnvelope<
    OpenPosSessionResult | PosSessionLifecycleResult
  >;
  if (!response.ok || payload.success === false) {
    throw new PosSessionApiError(payload.error || 'POS session action failed', payload.errorCode, response.status);
  }
  if (!payload.data) {
    throw new PosSessionApiError('POS session action failed', undefined, response.status);
  }
  return payload.data;
}

/** One row-scoped lifecycle action targeting a specific session (not necessarily the caller's own). */
export type PosSessionRowAction = 'close' | 'force-close';

/**
 * Closes or force-closes a specific session by id. Used for row-level
 * management actions on the POS Sessions list — works on the caller's own
 * session or, with `pos_session:close_others`/`pos_session:full_manage_others`,
 * on another user's session.
 */
export async function postPosSessionRowAction(
  sessionId: string,
  action: PosSessionRowAction,
  input: {
    csrfToken: string | null;
    reason?: string;
    sourceChannel: string;
  }
): Promise<PosSessionLifecycleResult> {
  const response = await fetch(`/api/v1/pos-sessions/${sessionId}/${action}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCSRFHeader(input.csrfToken),
    },
    body: JSON.stringify({
      reason: input.reason || undefined,
      idempotencyKey: `${action}:${sessionId}:${crypto.randomUUID()}`,
      sourceChannel: input.sourceChannel,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as PosSessionApiEnvelope<PosSessionLifecycleResult>;
  if (!response.ok || payload.success === false) {
    throw new PosSessionApiError(payload.error || 'POS session action failed', payload.errorCode, response.status);
  }
  if (!payload.data) {
    throw new PosSessionApiError('POS session action failed', undefined, response.status);
  }
  return payload.data;
}

/**
 * Opens a POS session on behalf of another tenant user (admin/supervisor action).
 */
export async function postOpenPosSessionForUser(input: {
  csrfToken: string | null;
  targetUserId: string;
  branchId: string;
  terminalId?: string | null;
  sourceChannel: string;
}): Promise<OpenPosSessionResult> {
  const response = await fetch('/api/v1/pos-sessions/open-others', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCSRFHeader(input.csrfToken),
    },
    body: JSON.stringify({
      targetUserId: input.targetUserId,
      branchId: input.branchId,
      terminalId: input.terminalId || undefined,
      idempotencyKey: `open-others:${input.targetUserId}:${crypto.randomUUID()}`,
      sourceChannel: input.sourceChannel,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as PosSessionApiEnvelope<OpenPosSessionResult>;
  if (!response.ok && payload.errorCode === 'POS_SESSION_BRANCH_CONFLICT' && payload.data) {
    return payload.data;
  }
  if (!response.ok || payload.success === false) {
    throw new PosSessionApiError(payload.error || 'Failed to open POS session for user', payload.errorCode, response.status);
  }
  if (!payload.data) {
    throw new PosSessionApiError('Failed to open POS session for user', undefined, response.status);
  }
  return payload.data;
}

/** One user option for the "open session for user" picker. */
export interface PosSessionUserOption {
  id: string;
  label: string;
  secondaryLabel: string | null;
}

/** Lists tenant users for the "open session for user" picker. */
export async function fetchPosSessionUsers(query?: string): Promise<{ items: PosSessionUserOption[]; total: number }> {
  const params = new URLSearchParams({ pageSize: '50' });
  if (query) params.set('query', query);
  return fetchPosSessionJson<{ items: PosSessionUserOption[]; total: number }>(`/api/v1/pos-sessions/users?${params.toString()}`);
}

/**
 * Links an OPEN cash drawer session to an OPEN POS session.
 */
export async function postPosSessionAutoLinkDrawer(input: {
  csrfToken: string | null;
  posSessionId: string;
  branchId?: string | null;
  cashDrawerSessionId: string;
  sourceChannel: string;
}): Promise<PosSessionLifecycleResult> {
  const response = await fetch('/api/v1/pos-sessions/auto-link-drawer', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCSRFHeader(input.csrfToken),
    },
    body: JSON.stringify({
      posSessionId: input.posSessionId,
      branchId: input.branchId || undefined,
      cashDrawerSessionId: input.cashDrawerSessionId,
      idempotencyKey: `auto-link-drawer:${crypto.randomUUID()}`,
      sourceChannel: input.sourceChannel,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as PosSessionApiEnvelope<PosSessionLifecycleResult>;
  if (!response.ok || payload.success === false) {
    throw new PosSessionApiError(payload.error || 'POS drawer link failed', payload.errorCode, response.status);
  }
  if (!payload.data) {
    throw new PosSessionApiError('POS drawer link failed', undefined, response.status);
  }
  return payload.data;
}

async function fetchPosSessionJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' });
  const payload = (await response.json().catch(() => ({}))) as PosSessionApiEnvelope<T>;
  if (!response.ok || payload.success === false) {
    throw new PosSessionApiError(payload.error || `Request failed: ${response.status}`, payload.errorCode, response.status);
  }
  if (!payload.data) {
    throw new PosSessionApiError(`Request failed: ${response.status}`, undefined, response.status);
  }
  return payload.data;
}

/**
 * Opens (or reuses) the caller's own POS session for the given branch — the inline recovery for a
 * `POS_SESSION_REQUIRED` refusal (B1). Idempotent per `idempotencyKey`.
 */
export async function postEnsureOwnPosSession(input: {
  csrfToken: string | null;
  branchId: string;
  idempotencyKey: string;
  sourceChannel: string;
}): Promise<OpenPosSessionResult> {
  const response = await fetch('/api/v1/pos-sessions/ensure-for-order-entry', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCSRFHeader(input.csrfToken),
    },
    body: JSON.stringify({
      branchId: input.branchId,
      idempotencyKey: input.idempotencyKey,
      sourceChannel: input.sourceChannel,
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as PosSessionApiEnvelope<OpenPosSessionResult>;
  if (!response.ok || payload.success === false || !payload.data) {
    throw new PosSessionApiError(payload.error || 'Failed to open POS session', payload.errorCode, response.status);
  }
  return payload.data;
}

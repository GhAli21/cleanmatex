/**
 * Session guard — the server-side gate every request passes through.
 *
 * Covers: ACTIVE caching (and its limits), heartbeat bypass, ENDED never cached, lazy registration of
 * pre-registry sessions (incl. blocked / no-membership outcomes), fail-closed on infrastructure errors,
 * and the standard 401 body.
 *
 * @jest-environment node
 */

const mockValidate = jest.fn();
const mockStartSession = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createAdminSupabaseClient: jest.fn(() => ({ __admin: true })),
}));
jest.mock('@/lib/services/auth/session/auth-session.repository', () => ({
  validateOwnSession: (...args: unknown[]) => mockValidate(...args),
}));
jest.mock('@/lib/services/auth/session/use-cases/session-lifecycle', () => ({
  startSession: (...args: unknown[]) => mockStartSession(...args),
}));

import {
  forgetSessionValidation,
  guardSession,
  isSessionActive,
  sessionEndedResponse,
} from '@/lib/auth/session-guard';
import type { SessionValidation } from '@/lib/types/auth-session';

const SID = '11111111-1111-1111-1111-111111111111';
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const token = (sid: string | null) => `${b64({ alg: 'HS256' })}.${b64(sid ? { session_id: sid } : {})}.sig`;

function client(sid: string | null = SID) {
  return {
    auth: {
      getSession: jest.fn(async () => ({
        data: { session: { access_token: token(sid), user: { id: 'user-1' } } },
      })),
    },
  } as never;
}

const meta = { ipAddress: '10.0.0.1', userAgent: 'UA', deviceId: null };

const active = (extra: Partial<SessionValidation> = {}): SessionValidation => ({
  state: 'ACTIVE',
  endReason: null,
  tenantOrgId: 'tenant-1',
  idleRemainingSec: 1800,
  absoluteRemainingSec: 43200,
  idleWarningSec: 60,
  ...extra,
});
const ended = (reason: SessionValidation['endReason']): SessionValidation => ({
  state: 'ENDED',
  endReason: reason,
  tenantOrgId: 'tenant-1',
  idleRemainingSec: 0,
  absoluteRemainingSec: 0,
  idleWarningSec: 60,
});

beforeEach(() => {
  mockValidate.mockReset();
  mockStartSession.mockReset();
  forgetSessionValidation(SID);
});

describe('guardSession — validation and caching', () => {
  it('returns ACTIVE and serves repeat calls from the 5 s cache', async () => {
    mockValidate.mockResolvedValue(active());
    const c = client();

    const first = await guardSession(c, meta);
    const second = await guardSession(c, meta);

    expect(first.state).toBe('ACTIVE');
    expect(second).toEqual(first);
    expect(mockValidate).toHaveBeenCalledTimes(1);
    expect(isSessionActive(first)).toBe(true);
  });

  it('the heartbeat (touch) always hits the DB, passes the IP and never populates the cache', async () => {
    mockValidate.mockResolvedValue(active());
    const c = client();

    await guardSession(c, meta, { touch: true });
    expect(mockValidate).toHaveBeenLastCalledWith(c, { touch: true, ipAddress: '10.0.0.1' });

    // The touch result was not cached, so a plain call validates again.
    await guardSession(c, meta);
    expect(mockValidate).toHaveBeenCalledTimes(2);
  });

  it('never caches ENDED: a revoked session is rejected on every request', async () => {
    mockValidate.mockResolvedValue(ended('ADMIN_REVOKED'));
    const c = client();

    const a = await guardSession(c, meta);
    const b = await guardSession(c, meta);

    expect(a.state).toBe('ENDED');
    expect(b.state).toBe('ENDED');
    expect(mockValidate).toHaveBeenCalledTimes(2);
    expect(isSessionActive(a)).toBe(false);
  });

  it('an ENDED result evicts a previously cached ACTIVE entry', async () => {
    mockValidate.mockResolvedValueOnce(active()).mockResolvedValueOnce(ended('IDLE_TIMEOUT'));
    const c = client();
    await guardSession(c, meta); // cached ACTIVE
    await guardSession(c, meta, { touch: true }); // heartbeat sees ENDED, evicts

    mockValidate.mockResolvedValueOnce(ended('IDLE_TIMEOUT'));
    const after = await guardSession(c, meta);
    expect(after.state).toBe('ENDED');
  });

  it('forgetSessionValidation clears the cache (used right after logout in the same process)', async () => {
    mockValidate.mockResolvedValue(active());
    const c = client();
    await guardSession(c, meta);
    forgetSessionValidation(SID);
    await guardSession(c, meta);
    expect(mockValidate).toHaveBeenCalledTimes(2);
  });

  it('propagates infrastructure errors so callers can fail closed', async () => {
    mockValidate.mockRejectedValue(new Error('rpc unavailable'));
    await expect(guardSession(client(), meta)).rejects.toThrow('rpc unavailable');
  });
});

describe('guardSession — lazy registration of pre-registry sessions', () => {
  const notRegistered: SessionValidation = {
    state: 'NOT_REGISTERED',
    endReason: null,
    tenantOrgId: null,
    idleRemainingSec: null,
    absoluteRemainingSec: null,
    idleWarningSec: null,
  };

  it('registers the session, then re-validates and returns ACTIVE', async () => {
    mockValidate.mockResolvedValueOnce(notRegistered).mockResolvedValueOnce(active());
    mockStartSession.mockResolvedValue({ status: 'REGISTERED' });

    const result = await guardSession(client(), meta);

    expect(mockStartSession).toHaveBeenCalledWith(
      { __admin: true },
      { authSessionId: SID, authUserId: 'user-1', rememberMe: false, meta },
    );
    expect(result.state).toBe('ACTIVE');
    expect(mockValidate).toHaveBeenCalledTimes(2);
  });

  it('a blocked registration (session limit, BLOCK_NEW) ends the request with SESSION_LIMIT', async () => {
    mockValidate.mockResolvedValueOnce(notRegistered);
    mockStartSession.mockResolvedValue({ status: 'BLOCKED_SESSION_LIMIT' });

    const result = await guardSession(client(), meta);
    expect(result.state).toBe('ENDED');
    expect(result.endReason).toBe('SESSION_LIMIT');
    expect(mockValidate).toHaveBeenCalledTimes(1);
  });

  it('a user without an active membership ends with USER_DEACTIVATED', async () => {
    mockValidate.mockResolvedValueOnce(notRegistered);
    mockStartSession.mockResolvedValue({ status: 'NO_MEMBERSHIP' });

    const result = await guardSession(client(), meta);
    expect(result.state).toBe('ENDED');
    expect(result.endReason).toBe('USER_DEACTIVATED');
  });

  it('does not try to register when the token has no session_id claim', async () => {
    mockValidate.mockResolvedValue(notRegistered);
    const result = await guardSession(client(null), meta);
    expect(mockStartSession).not.toHaveBeenCalled();
    expect(result.state).toBe('NOT_REGISTERED');
    expect(isSessionActive(result)).toBe(false);
  });
});

describe('sessionEndedResponse', () => {
  it('is a 401 with the SESSION_ENDED code and the end reason', async () => {
    const res = sessionEndedResponse(ended('PASSWORD_CHANGED'));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Session ended', code: 'SESSION_ENDED', reason: 'PASSWORD_CHANGED' });
  });

  it('reports a null reason when there is none (e.g. no session)', async () => {
    const res = sessionEndedResponse({ ...ended(null), state: 'NO_SESSION' });
    expect((await res.json()).reason).toBeNull();
  });
});

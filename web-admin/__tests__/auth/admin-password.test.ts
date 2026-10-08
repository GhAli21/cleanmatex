/**
 * Administrator credential actions: set password, emailed link, unlock — tenant scoping, self-target guard,
 * session revocation, audit and notification.
 *
 * @jest-environment node
 */

const mockRevoke = jest.fn();
const mockLog = jest.fn();
const mockEmit = jest.fn();
const mockAcceptable = jest.fn();
const mockSendLink = jest.fn();

jest.mock('@/lib/services/auth/session/auth-session.repository', () => ({
  revokeUserSessions: (...a: unknown[]) => mockRevoke(...a),
  logAuthEvent: (...a: unknown[]) => mockLog(...a),
}));
jest.mock('@lib/notifications/event-emitter', () => ({ emitNotificationEvent: (...a: unknown[]) => mockEmit(...a) }));
jest.mock('@/lib/services/auth/password/password-policy', () => ({
  loadPasswordPolicy: jest.fn(async () => ({ requireCurrent: true, freshSigninMin: 15, historyCount: 5, breachCheck: true })),
  assertPasswordAcceptable: (...a: unknown[]) => mockAcceptable(...a),
}));
jest.mock('@/lib/services/auth/password/password-link', () => ({
  ...jest.requireActual('@/lib/services/auth/password/password-link'),
  sendPasswordLink: (...a: unknown[]) => mockSendLink(...a),
}));

import {
  adminSendResetLink,
  adminSetPassword,
  adminUnlockAccount,
  loadTargetUser,
  type AdminActor,
  type TargetUser,
} from '@/lib/services/auth/password/admin-password';
import { PasswordError } from '@/lib/services/auth/password/password-error';

const actor: AdminActor = { userId: 'admin-1', tenantId: 'tenant-1', ipAddress: '1.1.1.1', userAgent: 'UA', siteUrl: 'https://app.test' };
const target: TargetUser = { authUserId: 'user-2', orgUserId: 'org-2', isActive: true, email: 'sara@example.com' };

interface Call { table: string; op: string; payload?: unknown; filters: Record<string, unknown> }

/** Minimal chainable Supabase mock that records filters so tenant scoping can be asserted. */
function makeAdmin(opts: { selectRow?: unknown; updateAuthError?: string } = {}) {
  const calls: Call[] = [];
  const from = (table: string) => {
    const call: Call = { table, op: 'select', filters: {} };
    calls.push(call);
    const chain: Record<string, unknown> = {
      select: () => chain,
      update: (payload: unknown) => {
        call.op = 'update';
        call.payload = payload;
        return chain;
      },
      eq: (col: string, val: unknown) => {
        call.filters[col] = val;
        return chain;
      },
      maybeSingle: async () => ({ data: opts.selectRow ?? null, error: null }),
      then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
    };
    return chain;
  };
  const updateUserById = jest.fn(async () => ({ error: opts.updateAuthError ? { message: opts.updateAuthError } : null }));
  const getUserById = jest.fn(async () => ({ data: { user: { email: 'sara@example.com' } } }));
  return { admin: { from, auth: { admin: { updateUserById, getUserById } } } as never, calls, updateUserById };
}

beforeEach(() => {
  [mockRevoke, mockLog, mockEmit, mockAcceptable, mockSendLink].forEach((m) => m.mockReset());
  mockRevoke.mockResolvedValue(3);
  mockAcceptable.mockResolvedValue(undefined);
  mockSendLink.mockResolvedValue(true);
});

describe('loadTargetUser', () => {
  it('scopes the membership lookup to the caller tenant and returns null for strangers', async () => {
    const { admin, calls } = makeAdmin({ selectRow: null });
    await expect(loadTargetUser(admin, 'tenant-1', 'user-9')).resolves.toBeNull();
    expect(calls[0].filters).toEqual({ tenant_org_id: 'tenant-1', user_id: 'user-9' });
  });

  it('returns the member with the auth email', async () => {
    const { admin } = makeAdmin({ selectRow: { id: 'org-2', user_id: 'user-2', is_active: true } });
    await expect(loadTargetUser(admin, 'tenant-1', 'user-2')).resolves.toEqual({
      authUserId: 'user-2', orgUserId: 'org-2', isActive: true, email: 'sara@example.com',
    });
  });
});

describe('adminSetPassword', () => {
  it('applies the policy, sets the password, flags the forced change, ends all sessions, audits and notifies', async () => {
    const { admin, calls, updateUserById } = makeAdmin();
    const out = await adminSetPassword(admin, actor, target, { newPassword: 'N3w-Str0ng-Passw0rd!', mustChange: true });

    expect(out).toEqual({ revokedSessions: 3 });
    expect(mockAcceptable).toHaveBeenCalled();
    expect(updateUserById).toHaveBeenCalledWith('user-2', { password: 'N3w-Str0ng-Passw0rd!' });
    const flag = calls.find((c) => c.op === 'update');
    expect(flag?.payload).toEqual({ pwd_must_change: true });
    expect(flag?.filters).toEqual({ tenant_org_id: 'tenant-1', user_id: 'user-2' }); // explicit tenant predicate
    expect(mockRevoke).toHaveBeenCalledWith(admin, expect.objectContaining({ authUserId: 'user-2', tenantOrgId: 'tenant-1', reason: 'PASSWORD_CHANGED', exceptAuthSessionId: null, actorId: 'admin-1' }));
    expect(mockLog).toHaveBeenCalledWith(admin, expect.objectContaining({ eventCode: 'PASSWORD_RESET_BY_ADMIN', details: expect.objectContaining({ actor_id: 'admin-1', must_change: true }) }));
    expect(mockEmit).toHaveBeenCalledWith(expect.objectContaining({ code: 'security.password.changed', recipientUserIds: ['user-2'] }));
  });

  it('refuses the administrator\'s own account', async () => {
    const { admin, updateUserById } = makeAdmin();
    await expect(adminSetPassword(admin, actor, { ...target, authUserId: 'admin-1' }, { newPassword: 'x', mustChange: true })).rejects.toMatchObject({ code: 'SELF_RESET_NOT_ALLOWED' });
    expect(updateUserById).not.toHaveBeenCalled();
  });

  it('stops before any change when the password is not acceptable', async () => {
    mockAcceptable.mockRejectedValue(new PasswordError('BREACHED_PASSWORD', 'breached'));
    const { admin, updateUserById } = makeAdmin();
    await expect(adminSetPassword(admin, actor, target, { newPassword: 'x', mustChange: true })).rejects.toMatchObject({ code: 'BREACHED_PASSWORD' });
    expect(updateUserById).not.toHaveBeenCalled();
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it('does not end sessions when the auth update fails', async () => {
    const { admin } = makeAdmin({ updateAuthError: 'db down' });
    await expect(adminSetPassword(admin, actor, target, { newPassword: 'x', mustChange: false })).rejects.toMatchObject({ code: 'UPDATE_FAILED' });
    expect(mockRevoke).not.toHaveBeenCalled();
  });
});

describe('adminSendResetLink', () => {
  it('emails the link, audits, and leaves sessions alone by default', async () => {
    const { admin } = makeAdmin();
    const out = await adminSendResetLink(admin, actor, target, { revokeSessions: false });
    expect(out).toEqual({ revokedSessions: 0 });
    expect(mockSendLink).toHaveBeenCalledWith(admin, { email: 'sara@example.com', siteUrl: 'https://app.test', reason: 'admin' });
    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith(admin, expect.objectContaining({ eventCode: 'PASSWORD_RESET_LINK_SENT' }));
  });

  it('can also sign the user out everywhere', async () => {
    const { admin } = makeAdmin();
    await expect(adminSendResetLink(admin, actor, target, { revokeSessions: true })).resolves.toEqual({ revokedSessions: 3 });
  });

  it('refuses synthetic-address users (nothing to deliver to) and the admin\'s own account', async () => {
    const { admin } = makeAdmin();
    await expect(adminSendResetLink(admin, actor, { ...target, email: 'u1@users.invalid' }, { revokeSessions: false })).rejects.toMatchObject({ code: 'NO_EMAIL' });
    await expect(adminSendResetLink(admin, actor, { ...target, authUserId: 'admin-1' }, { revokeSessions: false })).rejects.toMatchObject({ code: 'SELF_RESET_NOT_ALLOWED' });
    expect(mockSendLink).not.toHaveBeenCalled();
  });

  it('reports EMAIL_FAILED and neither revokes nor audits when the mail could not be sent', async () => {
    mockSendLink.mockResolvedValue(false);
    const { admin } = makeAdmin();
    await expect(adminSendResetLink(admin, actor, target, { revokeSessions: true })).rejects.toMatchObject({ code: 'EMAIL_FAILED' });
    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockLog).not.toHaveBeenCalled();
  });
});

describe('adminUnlockAccount', () => {
  it('clears the lock with an explicit tenant predicate and audits', async () => {
    const { admin, calls } = makeAdmin({ selectRow: { locked_until: new Date(Date.now() + 60000).toISOString(), failed_login_attempts: 5 } });
    await expect(adminUnlockAccount(admin, actor, target)).resolves.toEqual({ wasLocked: true });
    const update = calls.find((c) => c.op === 'update');
    expect(update?.payload).toEqual({ locked_until: null, lock_reason: null, failed_login_attempts: 0, last_failed_login_at: null });
    expect(update?.filters).toEqual({ tenant_org_id: 'tenant-1', user_id: 'user-2' });
    expect(mockLog).toHaveBeenCalledWith(admin, expect.objectContaining({ eventCode: 'ACCOUNT_UNLOCKED' }));
  });

  it('reports wasLocked=false for a clean account and 404-style error for a stranger', async () => {
    const clean = makeAdmin({ selectRow: { locked_until: null, failed_login_attempts: 0 } });
    await expect(adminUnlockAccount(clean.admin, actor, target)).resolves.toEqual({ wasLocked: false });
    const stranger = makeAdmin({ selectRow: null });
    await expect(adminUnlockAccount(stranger.admin, actor, target)).rejects.toMatchObject({ code: 'USER_NOT_FOUND' });
  });
});

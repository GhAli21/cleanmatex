/**
 * Password change / reset rules.
 *
 * @jest-environment node
 */

const mockRevoke = jest.fn();
const mockEnd = jest.fn();
const mockLog = jest.fn();

jest.mock('@/lib/services/auth/session/auth-session.repository', () => ({
  revokeUserSessions: (...a: unknown[]) => mockRevoke(...a),
  endSession: (...a: unknown[]) => mockEnd(...a),
  logAuthEvent: (...a: unknown[]) => mockLog(...a),
}));

import {
  PasswordError,
  changeOwnPassword,
  completePasswordReset,
  type PasswordDeps,
} from '@/lib/services/auth/session/use-cases/password';

const admin = { __admin: true } as never;
const STRONG_NEW = 'N3w-Str0ng-Passw0rd!';
const CURRENT = 'Curr3nt-Passw0rd!';

const actor = {
  userId: 'user-1',
  email: 'mona@example.com',
  tenantId: 'tenant-1',
  authSessionId: 'sess-current',
  ipAddress: '10.0.0.1',
  userAgent: 'UA',
};

function deps(over: Partial<PasswordDeps> = {}): PasswordDeps {
  return {
    verifyPassword: jest.fn(async () => true),
    updatePassword: jest.fn(async () => ({ errorMessage: null })),
    isLocked: jest.fn(async () => false),
    recordFailure: jest.fn(async () => undefined),
    ...over,
  };
}

beforeEach(() => {
  [mockRevoke, mockEnd, mockLog].forEach((m) => m.mockReset());
  mockRevoke.mockResolvedValue(2);
  mockEnd.mockResolvedValue(true);
});

describe('changeOwnPassword', () => {
  it('verifies the current password, updates, ends the OTHER sessions as PASSWORD_CHANGED and audits', async () => {
    const d = deps();
    const out = await changeOwnPassword(admin, d, actor, { currentPassword: CURRENT, newPassword: STRONG_NEW });

    expect(out).toEqual({ revokedOtherSessions: 2 });
    expect(d.verifyPassword).toHaveBeenCalledWith('mona@example.com', CURRENT);
    expect(d.updatePassword).toHaveBeenCalledWith(STRONG_NEW);
    expect(mockRevoke).toHaveBeenCalledWith(admin, {
      authUserId: 'user-1',
      tenantOrgId: 'tenant-1',
      reason: 'PASSWORD_CHANGED',
      exceptAuthSessionId: 'sess-current', // the session the user is on survives
      actorId: 'user-1',
    });
    expect(mockLog).toHaveBeenCalledWith(admin, expect.objectContaining({ eventCode: 'PASSWORD_CHANGED', outcome: 'SUCCESS', reasonCode: 'USER_CHANGE' }));
  });

  it('rejects a weak new password before doing anything else', async () => {
    const d = deps();
    await expect(changeOwnPassword(admin, d, actor, { currentPassword: CURRENT, newPassword: 'short' })).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
    expect(d.verifyPassword).not.toHaveBeenCalled();
    expect(d.updatePassword).not.toHaveBeenCalled();
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it('rejects reusing the current password', async () => {
    const d = deps();
    await expect(changeOwnPassword(admin, d, actor, { currentPassword: STRONG_NEW, newPassword: STRONG_NEW })).rejects.toMatchObject({ code: 'SAME_PASSWORD' });
    expect(d.updatePassword).not.toHaveBeenCalled();
  });

  it('a wrong current password counts as a failed attempt, is audited as DENIED and changes nothing', async () => {
    const d = deps({ verifyPassword: jest.fn(async () => false) });
    await expect(changeOwnPassword(admin, d, actor, { currentPassword: 'nope', newPassword: STRONG_NEW })).rejects.toMatchObject({ code: 'WRONG_PASSWORD' });

    expect(d.recordFailure).toHaveBeenCalledWith('mona@example.com');
    expect(d.updatePassword).not.toHaveBeenCalled();
    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith(admin, expect.objectContaining({ outcome: 'DENIED', reasonCode: 'WRONG_CURRENT_PASSWORD' }));
  });

  it('a locked account cannot be used to guess the current password (no verification attempted)', async () => {
    const d = deps({ isLocked: jest.fn(async () => true) });
    await expect(changeOwnPassword(admin, d, actor, { currentPassword: CURRENT, newPassword: STRONG_NEW })).rejects.toMatchObject({ code: 'ACCOUNT_LOCKED' });
    expect(d.verifyPassword).not.toHaveBeenCalled();
    expect(d.recordFailure).not.toHaveBeenCalled();
  });

  it('does NOT end other sessions when the update itself fails', async () => {
    const d = deps({ updatePassword: jest.fn(async () => ({ errorMessage: 'boom' })) });
    await expect(changeOwnPassword(admin, d, actor, { currentPassword: CURRENT, newPassword: STRONG_NEW })).rejects.toMatchObject({ code: 'UPDATE_FAILED' });
    expect(mockRevoke).not.toHaveBeenCalled();
  });
});

describe('completePasswordReset', () => {
  it('sets the password and ends EVERY session, including the recovery session itself', async () => {
    const d = deps();
    const out = await completePasswordReset(admin, d, actor, { newPassword: STRONG_NEW });

    expect(out).toEqual({ revokedSessions: 2 });
    expect(mockRevoke).toHaveBeenCalledWith(admin, expect.objectContaining({ exceptAuthSessionId: null, reason: 'PASSWORD_CHANGED' }));
    // The recovery session may be unregistered, so it is ended explicitly too.
    expect(mockEnd).toHaveBeenCalledWith(admin, { authSessionId: 'sess-current', reason: 'PASSWORD_CHANGED', actorId: 'user-1' });
    expect(mockLog).toHaveBeenCalledWith(admin, expect.objectContaining({ reasonCode: 'RESET', outcome: 'SUCCESS' }));
  });

  it('enforces the password policy', async () => {
    const d = deps();
    await expect(completePasswordReset(admin, d, actor, { newPassword: 'weak' })).rejects.toBeInstanceOf(PasswordError);
    expect(d.updatePassword).not.toHaveBeenCalled();
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it('leaves sessions alone when the update fails', async () => {
    const d = deps({ updatePassword: jest.fn(async () => ({ errorMessage: 'link expired' })) });
    await expect(completePasswordReset(admin, d, actor, { newPassword: STRONG_NEW })).rejects.toMatchObject({ code: 'UPDATE_FAILED' });
    expect(mockRevoke).not.toHaveBeenCalled();
    expect(mockEnd).not.toHaveBeenCalled();
  });
});

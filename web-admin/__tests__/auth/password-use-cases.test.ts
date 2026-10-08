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
import { DEFAULT_PASSWORD_POLICY, type PasswordPolicy } from '@/lib/services/auth/password/password-policy';

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

function deps(over: Partial<PasswordDeps> = {}, policy: Partial<PasswordPolicy> = {}): PasswordDeps {
  return {
    verifyPassword: jest.fn(async () => true),
    updatePassword: jest.fn(async () => ({ errorMessage: null })),
    isLocked: jest.fn(async () => false),
    recordFailure: jest.fn(async () => undefined),
    loadPolicy: jest.fn(async () => ({ ...DEFAULT_PASSWORD_POLICY, ...policy })),
    assertAcceptable: jest.fn(async () => undefined),
    getSessionAgeMinutes: jest.fn(async () => 1),
    clearMustChange: jest.fn(async () => undefined),
    notifyChanged: jest.fn(async () => undefined),
    ...over,
  };
}

beforeEach(() => {
  [mockRevoke, mockEnd, mockLog].forEach((m) => m.mockReset());
  mockRevoke.mockResolvedValue(2);
  mockEnd.mockResolvedValue(true);
});

describe('changeOwnPassword — current-password mode (policy default)', () => {
  it('verifies the current password, updates, ends the OTHER sessions as PASSWORD_CHANGED, audits and notifies', async () => {
    const d = deps();
    const out = await changeOwnPassword(admin, d, actor, { currentPassword: CURRENT, newPassword: STRONG_NEW });

    expect(out).toEqual({ revokedOtherSessions: 2, mode: 'CURRENT_PASSWORD' });
    expect(d.verifyPassword).toHaveBeenCalledWith('mona@example.com', CURRENT);
    expect(d.updatePassword).toHaveBeenCalledWith(STRONG_NEW);
    expect(mockRevoke).toHaveBeenCalledWith(admin, {
      authUserId: 'user-1',
      tenantOrgId: 'tenant-1',
      reason: 'PASSWORD_CHANGED',
      exceptAuthSessionId: 'sess-current', // the session the user is on survives
      actorId: 'user-1',
    });
    expect(mockLog).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        eventCode: 'PASSWORD_CHANGED',
        outcome: 'SUCCESS',
        reasonCode: 'USER_CHANGE',
        details: expect.objectContaining({ mode: 'CURRENT_PASSWORD', changed_by: 'SELF' }),
      })
    );
    expect(d.notifyChanged).toHaveBeenCalledWith({ authUserId: 'user-1', tenantId: 'tenant-1', actor: 'self' });
    expect(d.clearMustChange).not.toHaveBeenCalled();
  });

  it('requires the current password when the policy says so', async () => {
    const d = deps();
    await expect(changeOwnPassword(admin, d, actor, { newPassword: STRONG_NEW })).rejects.toMatchObject({
      code: 'CURRENT_REQUIRED',
    });
    expect(d.updatePassword).not.toHaveBeenCalled();
  });

  it('runs the acceptability rules (strength / history / breach) and stops on rejection', async () => {
    const d = deps({
      assertAcceptable: jest.fn(async () => {
        throw new PasswordError('REUSED_PASSWORD', 'reused');
      }),
    });
    await expect(changeOwnPassword(admin, d, actor, { currentPassword: CURRENT, newPassword: STRONG_NEW })).rejects.toMatchObject({
      code: 'REUSED_PASSWORD',
    });
    expect(d.updatePassword).not.toHaveBeenCalled();
    expect(mockRevoke).not.toHaveBeenCalled();
    expect(d.notifyChanged).not.toHaveBeenCalled();
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

describe('changeOwnPassword — two-field mode (AUTH_PWD_REQUIRE_CURRENT off)', () => {
  it('accepts only the new password on a fresh sign-in and never asks the current one', async () => {
    const d = deps({}, { requireCurrent: false, freshSigninMin: 15 });
    const out = await changeOwnPassword(admin, d, actor, { newPassword: STRONG_NEW });

    expect(out.mode).toBe('FRESH_SIGNIN');
    expect(d.verifyPassword).not.toHaveBeenCalled();
    expect(d.isLocked).not.toHaveBeenCalled();
    expect(d.updatePassword).toHaveBeenCalledWith(STRONG_NEW);
  });

  it('refuses an old sign-in (REAUTH_REQUIRED) and changes nothing', async () => {
    const d = deps({ getSessionAgeMinutes: jest.fn(async () => 16) }, { requireCurrent: false, freshSigninMin: 15 });
    await expect(changeOwnPassword(admin, d, actor, { newPassword: STRONG_NEW })).rejects.toMatchObject({ code: 'REAUTH_REQUIRED' });
    expect(d.updatePassword).not.toHaveBeenCalled();
    expect(mockRevoke).not.toHaveBeenCalled();
  });

  it('refuses when the session age is unknown (fail closed)', async () => {
    const d = deps({ getSessionAgeMinutes: jest.fn(async () => null) }, { requireCurrent: false });
    await expect(changeOwnPassword(admin, d, actor, { newPassword: STRONG_NEW })).rejects.toMatchObject({ code: 'REAUTH_REQUIRED' });
  });

  it('still verifies the current password when the user chooses to send it', async () => {
    const d = deps({}, { requireCurrent: false });
    const out = await changeOwnPassword(admin, d, actor, { currentPassword: CURRENT, newPassword: STRONG_NEW });
    expect(out.mode).toBe('CURRENT_PASSWORD');
    expect(d.verifyPassword).toHaveBeenCalled();
  });
});

describe('changeOwnPassword — forced change after an administrator-set password', () => {
  const forcedActor = { ...actor, mustChange: true };

  it('needs no current password, clears the flag, ends other sessions and notifies', async () => {
    const d = deps({ verifyPassword: jest.fn(async () => false) }); // new != temporary password
    const out = await changeOwnPassword(admin, d, forcedActor, { newPassword: STRONG_NEW });

    expect(out.mode).toBe('FORCED');
    expect(d.clearMustChange).toHaveBeenCalledWith('tenant-1', 'user-1');
    expect(mockRevoke).toHaveBeenCalled();
    expect(d.notifyChanged).toHaveBeenCalled();
  });

  it('rejects keeping the temporary password as the new one', async () => {
    const d = deps({ verifyPassword: jest.fn(async () => true) }); // new password equals the current one
    await expect(changeOwnPassword(admin, d, forcedActor, { newPassword: STRONG_NEW })).rejects.toMatchObject({ code: 'SAME_PASSWORD' });
    expect(d.updatePassword).not.toHaveBeenCalled();
    expect(d.clearMustChange).not.toHaveBeenCalled();
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
    // A link-chosen password satisfies a pending forced change and is announced to the owner.
    expect(d.clearMustChange).toHaveBeenCalledWith('tenant-1', 'user-1');
    expect(d.notifyChanged).toHaveBeenCalledWith({ authUserId: 'user-1', tenantId: 'tenant-1', actor: 'link' });
  });

  it('enforces the acceptability rules', async () => {
    const d = deps({
      assertAcceptable: jest.fn(async () => {
        throw new PasswordError('WEAK_PASSWORD', 'weak');
      }),
    });
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

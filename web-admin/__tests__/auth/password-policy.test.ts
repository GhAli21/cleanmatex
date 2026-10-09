/**
 * Password policy parsing, acceptability rules, breach check, link helpers, generator and error mapping.
 *
 * @jest-environment node
 */

jest.mock('@/lib/services/auth/config/auth-admin-config.repository', () => ({
  fetchEffectiveAuthConfig: jest.fn(),
}));
jest.mock('@lib/notifications/email-sender', () => ({ sendEmail: jest.fn() }));

import { createHash } from 'crypto';
import {
  DEFAULT_PASSWORD_POLICY,
  assertPasswordAcceptable,
  parsePasswordPolicy,
  type PasswordPolicy,
} from '@/lib/services/auth/password/password-policy';
import { isPasswordBreached } from '@/lib/services/auth/password/breach-check';
import {
  buildPasswordLinkUrl,
  isDeliverableEmail,
  renderPasswordLinkEmail,
  sendPasswordLink,
} from '@/lib/services/auth/password/password-link';
import { notifyPasswordChanged } from '@/lib/services/auth/password/password-notify';
import { generateTemporaryPassword } from '@features/auth-session/model/password-generator';
import { passwordErrorKey } from '@features/auth-session/model/password-errors';
import { evaluatePasswordRules } from '@features/auth-session/model/password-rules';
import { validatePassword } from '@/lib/auth/validation';

const STRONG = 'N3w-Str0ng-Passw0rd!';

function adminWithReuse(result: { data: unknown; error: unknown }) {
  return { rpc: jest.fn(async () => result) } as never;
}

describe('parsePasswordPolicy', () => {
  it('reads the four PASSWORD items', () => {
    expect(
      parsePasswordPolicy([
        { configCode: 'AUTH_PWD_REQUIRE_CURRENT', effectiveValue: 'false' },
        { configCode: 'AUTH_PWD_FRESH_SIGNIN_MIN', effectiveValue: '30' },
        { configCode: 'AUTH_PWD_HISTORY_COUNT', effectiveValue: '0' },
        { configCode: 'AUTH_PWD_BREACH_CHECK', effectiveValue: 'false' },
      ])
    ).toEqual({ requireCurrent: false, freshSigninMin: 30, historyCount: 0, breachCheck: false });
  });

  it('falls back to the secure defaults for missing items', () => {
    expect(parsePasswordPolicy([])).toEqual(DEFAULT_PASSWORD_POLICY);
  });
});

describe('assertPasswordAcceptable', () => {
  const policy: PasswordPolicy = { ...DEFAULT_PASSWORD_POLICY };

  it('rejects a weak password first, without touching the database', async () => {
    const admin = adminWithReuse({ data: false, error: null });
    await expect(assertPasswordAcceptable(admin, policy, 'u1', 'short', async () => false)).rejects.toMatchObject({ code: 'WEAK_PASSWORD' });
    expect((admin as unknown as { rpc: jest.Mock }).rpc).not.toHaveBeenCalled();
  });

  it('rejects a reused password using the configured depth', async () => {
    const admin = adminWithReuse({ data: true, error: null });
    await expect(assertPasswordAcceptable(admin, policy, 'u1', STRONG, async () => false)).rejects.toMatchObject({ code: 'REUSED_PASSWORD' });
    expect((admin as unknown as { rpc: jest.Mock }).rpc).toHaveBeenCalledWith('fn_auth_pwd_reuse_check', {
      p_auth_user_id: 'u1',
      p_new_password: STRONG,
      p_depth: 5,
    });
  });

  it('fails closed when the history check errors', async () => {
    const admin = adminWithReuse({ data: null, error: { message: 'boom' } });
    await expect(assertPasswordAcceptable(admin, policy, 'u1', STRONG, async () => false)).rejects.toMatchObject({ code: 'UPDATE_FAILED' });
  });

  it('skips the history check when the depth is 0 and the breach check when it is off', async () => {
    const admin = adminWithReuse({ data: true, error: null });
    const breach = jest.fn(async () => true);
    await expect(
      assertPasswordAcceptable(admin, { ...policy, historyCount: 0, breachCheck: false }, 'u1', STRONG, breach)
    ).resolves.toBeUndefined();
    expect((admin as unknown as { rpc: jest.Mock }).rpc).not.toHaveBeenCalled();
    expect(breach).not.toHaveBeenCalled();
  });

  it('rejects a breached password', async () => {
    const admin = adminWithReuse({ data: false, error: null });
    await expect(assertPasswordAcceptable(admin, policy, 'u1', STRONG, async () => true)).rejects.toMatchObject({ code: 'BREACHED_PASSWORD' });
  });

  it('allows a breached password when the user skipped that warning', async () => {
    const admin = adminWithReuse({ data: false, error: null });
    const breach = jest.fn(async () => true);
    await expect(assertPasswordAcceptable(admin, policy, 'u1', STRONG, breach, true)).resolves.toBeUndefined();
    expect(breach).not.toHaveBeenCalled();
  });
});

describe('isPasswordBreached (k-anonymity)', () => {
  const sha = createHash('sha1').update('Passw0rd!', 'utf8').digest('hex').toUpperCase();

  it('sends only the 5-char prefix and matches the suffix locally', async () => {
    const fetchImpl = jest.fn(async (url: string) => {
      expect(url.endsWith(sha.slice(0, 5))).toBe(true);
      return { ok: true, text: async () => `AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:0\r\n${sha.slice(5)}:42\r\n` } as Response;
    });
    await expect(isPasswordBreached('Passw0rd!', { fetchImpl: fetchImpl as never })).resolves.toBe(true);
  });

  it('ignores padding rows (count 0)', async () => {
    const fetchImpl = async () => ({ ok: true, text: async () => `${sha.slice(5)}:0\n` }) as Response;
    await expect(isPasswordBreached('Passw0rd!', { fetchImpl: fetchImpl as never })).resolves.toBe(false);
  });

  it('fails open on network errors and non-OK answers', async () => {
    await expect(isPasswordBreached('x', { fetchImpl: (async () => { throw new Error('down'); }) as never })).resolves.toBe(false);
    await expect(isPasswordBreached('x', { fetchImpl: (async () => ({ ok: false, status: 503 })) as never })).resolves.toBe(false);
  });
});

describe('password link helpers', () => {
  it('detects synthetic and missing addresses as undeliverable', () => {
    expect(isDeliverableEmail('a@example.com')).toBe(true);
    expect(isDeliverableEmail('u123@users.invalid')).toBe(false);
    expect(isDeliverableEmail('U123@USERS.INVALID')).toBe(false);
    expect(isDeliverableEmail(null)).toBe(false);
    expect(isDeliverableEmail('')).toBe(false);
  });

  it('builds the confirm URL with an encoded token and no double slash', () => {
    expect(buildPasswordLinkUrl('https://app.example.com/', 'a+b/c=')).toBe(
      'https://app.example.com/auth/confirm?token_hash=a%2Bb%2Fc%3D&type=recovery'
    );
  });

  it('renders a bilingual email that contains the link and never a password', () => {
    const mail = renderPasswordLinkEmail('https://x.test/auth/confirm?token_hash=t&type=recovery', 'admin');
    expect(mail.html).toContain('https://x.test/auth/confirm?token_hash=t&amp;type=recovery');
    expect(mail.html).toContain('dir="rtl"');
    expect(mail.text).toContain('administrator');
  });

  it('sends the email built from the generated token, or reports failure', async () => {
    const send = jest.fn(async () => true);
    const admin = {
      auth: { admin: { generateLink: jest.fn(async () => ({ data: { properties: { hashed_token: 'tok' } }, error: null })) } },
    } as never;
    await expect(sendPasswordLink(admin, { email: 'a@example.com', siteUrl: 'https://x.test', reason: 'self' }, send as never)).resolves.toBe(true);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ to: 'a@example.com' }));

    const failing = { auth: { admin: { generateLink: jest.fn(async () => ({ data: null, error: { message: 'no' } })) } } } as never;
    await expect(sendPasswordLink(failing, { email: 'a@example.com', siteUrl: 'https://x.test', reason: 'self' }, send as never)).resolves.toBe(false);
  });
});

describe('notifyPasswordChanged', () => {
  it('emits security.password.changed with bilingual actor labels and never throws', async () => {
    const emit = jest.fn(async () => undefined);
    await expect(notifyPasswordChanged(emit, { authUserId: 'u1', tenantId: 't1', actor: 'admin', changedAt: new Date('2026-10-09T10:00:00Z') })).resolves.toBe(true);
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'security.password.changed',
        recipientUserIds: ['u1'],
        variables: expect.objectContaining({ actor_label: 'an administrator', actor_label2: 'مسؤول', changed_at: '2026-10-09 10:00 UTC' }),
      })
    );
    const boom = jest.fn(async () => { throw new Error('hub down'); });
    await expect(notifyPasswordChanged(boom, { authUserId: 'u1', tenantId: 't1', actor: 'self', changedAt: new Date() })).resolves.toBe(false);
  });
});

describe('generateTemporaryPassword', () => {
  it('always satisfies the platform policy and honours the minimum length', () => {
    for (let i = 0; i < 50; i++) {
      const pw = generateTemporaryPassword();
      expect(pw).toHaveLength(14);
      expect(validatePassword(pw).isValid).toBe(true);
    }
    expect(generateTemporaryPassword(4)).toHaveLength(12);
  });

  it('avoids look-alike characters', () => {
    for (let i = 0; i < 50; i++) expect(generateTemporaryPassword(40)).not.toMatch(/[0OIl1]/);
  });
});

describe('evaluatePasswordRules', () => {
  it('marks composition rules as they are fulfilled and keeps breach pending until the server says so', () => {
    const pending = evaluatePasswordRules({ password: '', confirmation: '' });
    expect(pending.find((rule) => rule.id === 'length')?.state).toBe('pending');
    expect(pending.find((rule) => rule.id === 'breached')?.state).toBe('pending');

    const met = evaluatePasswordRules({
      password: 'Admin2009',
      confirmation: 'Admin2009',
      currentPassword: 'Old1password',
      compareCurrent: true,
    });
    expect(met.filter((rule) => ['length', 'upper', 'lower', 'number', 'match', 'different'].includes(rule.id)).every((rule) => rule.state === 'met')).toBe(true);
    expect(met.find((rule) => rule.id === 'breached')?.state).toBe('pending');
  });

  it('turns the breach row into a failure only for the password the server rejected', () => {
    const failed = evaluatePasswordRules({ password: 'Admin2009', confirmation: 'Admin2009', serverRule: 'breached' });
    expect(failed.find((rule) => rule.id === 'breached')?.state).toBe('unmet');
    expect(failed.find((rule) => rule.id === 'reused')?.state).toBe('pending');
    const skipped = evaluatePasswordRules({ password: 'Admin2009', confirmation: 'Admin2009', serverRule: 'breached', breachSkipped: true });
    expect(skipped.find((rule) => rule.id === 'breached')?.state).toBe('skipped');
  });
});

describe('passwordErrorKey', () => {
  it('maps every code to its message key and defaults to failed', () => {
    expect(passwordErrorKey('REUSED_PASSWORD')).toBe('reused');
    expect(passwordErrorKey('BREACHED_PASSWORD')).toBe('breached');
    expect(passwordErrorKey('REAUTH_REQUIRED')).toBe('reauth');
    expect(passwordErrorKey('NO_EMAIL')).toBe('noEmail');
    expect(passwordErrorKey('WRONG_PASSWORD')).toBe('wrongPassword');
    expect(passwordErrorKey(undefined)).toBe('failed');
    expect(passwordErrorKey('SOMETHING_ELSE')).toBe('failed');
  });
});

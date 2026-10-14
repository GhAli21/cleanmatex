/** @jest-environment node */
import { bearerMatches, isOutboxRequestAuthorized } from '@lib/notifications/outbox-auth';
import { getOutboxSecret } from '@lib/notifications/provider-secrets';

jest.mock('@lib/notifications/provider-secrets', () => ({ getOutboxSecret: jest.fn() }));

describe('outbox bearer check', () => {
  it('accepts only the exact Bearer secret', () => {
    expect(bearerMatches('Bearer s3cret', 's3cret')).toBe(true);
    expect(bearerMatches('Bearer s3cre', 's3cret')).toBe(false);
    expect(bearerMatches('bearer s3cret', 's3cret')).toBe(false);
    expect(bearerMatches('', 's3cret')).toBe(false);
  });

  it('rejects everything when no secret is configured', () => {
    expect(bearerMatches('Bearer ', undefined)).toBe(false);
    expect(bearerMatches('Bearer ', '')).toBe(false);
  });

  it('reads the secret from the Config Registry getter', async () => {
    jest.mocked(getOutboxSecret).mockResolvedValue('reg-secret');
    const ok = new Request('http://x', { headers: { authorization: 'Bearer reg-secret' } });
    const bad = new Request('http://x', { headers: { authorization: 'Bearer nope' } });
    await expect(isOutboxRequestAuthorized(ok)).resolves.toBe(true);
    await expect(isOutboxRequestAuthorized(bad)).resolves.toBe(false);
  });
});

/** @jest-environment node */
import { checkSuppression, recordSuppression, normalizeEmailAddress, normalizePhoneNumber } from '@lib/notifications/suppression-list';
import { createAdminSupabaseClient } from '@lib/supabase/server';

jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }));

describe('normalizeEmailAddress / normalizePhoneNumber', () => {
  it('lowercases and trims email addresses', () => {
    expect(normalizeEmailAddress('  John.Doe@Example.com ')).toBe('john.doe@example.com');
  });
  it('trims phone numbers without altering case/content', () => {
    expect(normalizePhoneNumber(' +96891234567 ')).toBe('+96891234567');
  });
});

describe('checkSuppression', () => {
  const filters: Array<[string, unknown]> = [];

  function configureSupabase(result: { data: unknown; error: unknown }) {
    filters.length = 0;
    jest.mocked(createAdminSupabaseClient).mockReturnValue({
      from: () => {
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn((field: string, value: unknown) => { filters.push([field, value]); return query; }),
          maybeSingle: jest.fn(async () => result),
        };
        return query;
      },
    } as unknown as ReturnType<typeof createAdminSupabaseClient>);
  }

  beforeEach(() => jest.clearAllMocks());

  it('returns not-suppressed when there is no matching active row', async () => {
    configureSupabase({ data: null, error: null });
    const result = await checkSuppression('tenant-a', 'EMAIL', 'user@example.com');
    expect(result).toEqual({ suppressed: false });
  });

  it('returns suppressed with the stored reason code when a row matches', async () => {
    configureSupabase({ data: { reason_code: 'COMPLAINT' }, error: null });
    const result = await checkSuppression('tenant-a', 'EMAIL', 'user@example.com');
    expect(result).toEqual({ suppressed: true, reasonCode: 'COMPLAINT' });
  });

  it('normalizes the email address before the lookup', async () => {
    configureSupabase({ data: null, error: null });
    await checkSuppression('tenant-a', 'EMAIL', '  User@Example.COM ');
    expect(filters).toContainEqual(['address_or_number', 'user@example.com']);
  });

  it('filters every query by the exact tenant_org_id', async () => {
    configureSupabase({ data: null, error: null });
    await checkSuppression('tenant-a', 'SMS', '+96891234567');
    expect(filters).toContainEqual(['tenant_org_id', 'tenant-a']);
    expect(filters).toContainEqual(['channel_code', 'SMS']);
    expect(filters).toContainEqual(['rec_status', 1]);
  });

  it('fails open (not suppressed) on a lookup error, never blocking a transactional send on a transient DB failure', async () => {
    configureSupabase({ data: null, error: { message: 'db unavailable' } });
    const result = await checkSuppression('tenant-a', 'EMAIL', 'user@example.com');
    expect(result).toEqual({ suppressed: false });
  });

  it('returns not-suppressed with no DB call at all when there is no address', async () => {
    const result = await checkSuppression('tenant-a', 'EMAIL', null);
    expect(result).toEqual({ suppressed: false });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });
});

describe('recordSuppression', () => {
  it('upserts a normalized, tenant-scoped suppression row and returns true on success', async () => {
    const upsert = jest.fn(async () => ({ error: null }));
    jest.mocked(createAdminSupabaseClient).mockReturnValue({
      from: () => ({ upsert }),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>);

    const ok = await recordSuppression('tenant-a', 'EMAIL', 'User@Example.com', 'BOUNCE_HARD', 'RESEND_WEBHOOK');

    expect(ok).toBe(true);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_org_id: 'tenant-a',
        channel_code: 'EMAIL',
        address_or_number: 'user@example.com',
        reason_code: 'BOUNCE_HARD',
        source: 'RESEND_WEBHOOK',
      }),
      { onConflict: 'tenant_org_id,channel_code,address_or_number' },
    );
  });

  it('returns false (and does not throw) when the upsert fails', async () => {
    jest.mocked(createAdminSupabaseClient).mockReturnValue({
      from: () => ({ upsert: jest.fn(async () => ({ error: { message: 'db error' } })) }),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>);

    const ok = await recordSuppression('tenant-a', 'SMS', '+96891234567', 'CARRIER_OPT_OUT', 'TWILIO_INBOUND_SMS');
    expect(ok).toBe(false);
  });
});

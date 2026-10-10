/** @jest-environment node */
import { createHmac } from 'crypto';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/notifications/webhooks/resend/route';
import { createAdminSupabaseClient } from '@lib/supabase/server';
import { recordSuppression } from '@lib/notifications/suppression-list';

jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }));
jest.mock('@lib/notifications/suppression-list', () => ({ recordSuppression: jest.fn(async () => true) }));

const SECRET = 'whsec_' + Buffer.from('test-secret-bytes').toString('base64');

function signedHeaders(body: string, secret = SECRET, id = 'msg_1', timestamp = '1700000000') {
  const secretBytes = Buffer.from(secret.slice('whsec_'.length), 'base64');
  const signedContent = `${id}.${timestamp}.${body}`;
  const sig = createHmac('sha256', secretBytes).update(signedContent).digest('base64');
  return { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${sig}` };
}

function makeRequest(body: string, headers: Record<string, string>) {
  return new NextRequest('http://localhost/api/notifications/webhooks/resend', {
    method: 'POST',
    body,
    headers,
  });
}

describe('POST /api/notifications/webhooks/resend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
  });

  it('rejects a callback with an invalid signature', async () => {
    const body = JSON.stringify({ type: 'email.complained', data: { email_id: 'e1', to: ['a@b.com'] } });
    const res = await POST(makeRequest(body, signedHeaders(body, 'whsec_' + Buffer.from('wrong').toString('base64'))));
    expect(res.status).toBe(401);
  });

  it('rejects when RESEND_WEBHOOK_SECRET is not configured', async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const body = JSON.stringify({ type: 'email.complained', data: { email_id: 'e1', to: ['a@b.com'] } });
    const res = await POST(makeRequest(body, signedHeaders(body)));
    expect(res.status).toBe(401);
  });

  it('acknowledges and ignores a non-bounce/complaint event type', async () => {
    const body = JSON.stringify({ type: 'email.delivered', data: { email_id: 'e1', to: ['a@b.com'] } });
    const res = await POST(makeRequest(body, signedHeaders(body)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('IGNORED_EVENT_TYPE');
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it('acknowledges but does not suppress when no outbox row matches the email_id (not a notification-hub send)', async () => {
    jest.mocked(createAdminSupabaseClient).mockReturnValue({
      from: () => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({ data: null, error: null })),
      }),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>);

    const body = JSON.stringify({ type: 'email.complained', data: { email_id: 'unmatched', to: ['a@b.com'] } });
    const res = await POST(makeRequest(body, signedHeaders(body)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('UNMATCHED_NO_OUTBOX_ROW');
    expect(recordSuppression).not.toHaveBeenCalled();
  });

  it('records a COMPLAINT suppression for the tenant resolved from the matched outbox row', async () => {
    jest.mocked(createAdminSupabaseClient).mockReturnValue({
      from: () => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({ data: { tenant_org_id: 'tenant-a' }, error: null })),
      }),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>);

    const body = JSON.stringify({ type: 'email.complained', data: { email_id: 'e1', to: ['a@b.com'] } });
    const res = await POST(makeRequest(body, signedHeaders(body)));
    expect(res.status).toBe(200);
    expect(recordSuppression).toHaveBeenCalledWith('tenant-a', 'EMAIL', 'a@b.com', 'COMPLAINT', 'RESEND_WEBHOOK');
  });

  it('records a BOUNCE_HARD suppression for a bounce with no transient marker', async () => {
    jest.mocked(createAdminSupabaseClient).mockReturnValue({
      from: () => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({ data: { tenant_org_id: 'tenant-a' }, error: null })),
      }),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>);

    const body = JSON.stringify({ type: 'email.bounced', data: { email_id: 'e1', to: ['a@b.com'] } });
    const res = await POST(makeRequest(body, signedHeaders(body)));
    expect(res.status).toBe(200);
    expect(recordSuppression).toHaveBeenCalledWith('tenant-a', 'EMAIL', 'a@b.com', 'BOUNCE_HARD', 'RESEND_WEBHOOK', undefined);
  });

  it('does not suppress a transient (soft) bounce on a single occurrence', async () => {
    jest.mocked(createAdminSupabaseClient).mockReturnValue({
      from: () => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn(async () => ({ data: { tenant_org_id: 'tenant-a' }, error: null })),
      }),
    } as unknown as ReturnType<typeof createAdminSupabaseClient>);

    const body = JSON.stringify({ type: 'email.bounced', data: { email_id: 'e1', to: ['a@b.com'], bounce: { type: 'Transient' } } });
    const res = await POST(makeRequest(body, signedHeaders(body)));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('SOFT_BOUNCE_NOT_SUPPRESSED');
    expect(recordSuppression).not.toHaveBeenCalled();
  });
});

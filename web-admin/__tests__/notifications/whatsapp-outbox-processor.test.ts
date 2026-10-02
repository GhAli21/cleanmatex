/** @jest-environment node */
import { POST } from '@/app/api/notifications/process-outbox/route';
import { NextRequest } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { deliverWhatsAppOutbox } from '@lib/notifications/adapters/whatsapp';
import { enqueueEmailFallbackFromWhatsApp } from '@lib/notifications/adapters/outbox';

jest.mock('@/lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));
jest.mock('@lib/notifications/adapters/whatsapp', () => ({ deliverWhatsAppOutbox: jest.fn() }));
jest.mock('@lib/notifications/adapters/email', () => ({ deliverEmailOutbox: jest.fn() }));
jest.mock('@lib/notifications/adapters/sms', () => ({ deliverSmsOutbox: jest.fn() }));
jest.mock('@lib/notifications/adapters/push', () => ({ deliverPushOutbox: jest.fn() }));
jest.mock('@lib/notifications/adapters/outbox', () => ({ enqueueEmailFallbackFromWhatsApp: jest.fn() }));

describe('WhatsApp scheduled outbox dispatch', () => {
  const row = { id: 'outbox-a', tenant_org_id: 'tenant-a', channel_code: 'WHATSAPP', recipient_address: '+96890123456', recipient_user_id: 'staff-a', event_code: 'order.created', rendered_subject: 'Order', rendered_body: 'Created', source_entity_type: 'order', source_entity_id: 'order-a', retry_count: 0, max_retries: 3, status: 'QUEUED', metadata: null };
  const request = () => new NextRequest('http://localhost/api/notifications/process-outbox', { method: 'POST', headers: { authorization: 'Bearer test-secret' } });
  let updates: Record<string, unknown>[];
  let filters: unknown[][];
  let claims: boolean;
  let activeTenants: { id: string }[];
  let tenantError: { message: string } | null;
  let claimError: { message: string } | null;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NOTIFICATIONS_OUTBOX_SECRET = 'test-secret';
    updates = [];
    filters = [];
    claims = true;
    activeTenants = [{ id: 'tenant-a' }];
    tenantError = null;
    claimError = null;
    jest.mocked(deliverWhatsAppOutbox).mockResolvedValue({ success: false, skipped: true, errorMessage: 'Customer has not opted in to WhatsApp notifications' });
    jest.mocked(createAdminSupabaseClient).mockReturnValue({
      from: (table: string) => {
        let status = '';
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn((field: string, value: unknown) => { filters.push([table, field, value]); if (field === 'status') status = String(value); return query; }),
          in: jest.fn((field: string, value: unknown) => { filters.push([table, field, value]); return query; }),
          lte: jest.fn(() => query),
          limit: jest.fn(async () => ({ data: status === 'QUEUED' ? [row] : [], error: null })),
          update: jest.fn((data: Record<string, unknown>) => { updates.push(data); return query; }),
          insert: jest.fn(() => query),
          maybeSingle: jest.fn(async () => ({ data: claims ? { id: row.id } : null, error: claimError })),
          then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve({ data: table === 'org_tenants_mst' ? activeTenants : null, error: table === 'org_tenants_mst' ? tenantError : null })),
        };
        return query;
      },
    } as unknown as ReturnType<typeof createAdminSupabaseClient>);
  });

  afterEach(() => { delete process.env.NOTIFICATIONS_OUTBOX_SECRET; });

  it('forwards order sources and records consent denial as SKIPPED without email fallback', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(deliverWhatsAppOutbox).toHaveBeenCalledWith(expect.objectContaining({ source_entity_type: 'order', source_entity_id: 'order-a' }));
    expect(updates[1]).toMatchObject({ status: 'SKIPPED', skip_reason: 'Customer has not opted in to WhatsApp notifications' });
    expect(enqueueEmailFallbackFromWhatsApp).not.toHaveBeenCalled();
    expect(filters).toContainEqual(['org_ntf_outbox_dtl', 'tenant_org_id', ['tenant-a']]);
    expect(filters.filter((filter) => filter[0] === 'org_ntf_outbox_dtl' && filter[1] === 'tenant_org_id' && filter[2] === 'tenant-a')).toHaveLength(2);
  });

  it('does not dispatch or finalize a stale row claimed by another worker', async () => {
    claims = false;
    await POST(request());
    expect(deliverWhatsAppOutbox).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
    expect(filters).toContainEqual(['org_ntf_outbox_dtl', 'status', 'QUEUED']);
    expect(filters).toContainEqual(['org_ntf_outbox_dtl', 'retry_count', 0]);
  });

  it('does not reclassify or send a row when its atomic claim fails', async () => {
    claimError = { message: 'Claim unavailable' };
    const response = await POST(request());
    expect(await response.json()).toMatchObject({ processed: 0, errors: 0 });
    expect(deliverWhatsAppOutbox).not.toHaveBeenCalled();
    expect(updates).toHaveLength(1);
  });

  it('restricts exception recovery to the row still owned by this attempt', async () => {
    jest.mocked(deliverWhatsAppOutbox).mockRejectedValue(new Error('Provider unavailable'));
    const response = await POST(request());
    expect(await response.json()).toMatchObject({ processed: 0, errors: 1 });
    expect(updates[1]).toMatchObject({ status: 'FAILED_TEMPORARY', retry_count: 1 });
    expect(filters).toContainEqual(['org_ntf_outbox_dtl', 'status', 'PROCESSING']);
    expect(filters.filter((filter) => filter[0] === 'org_ntf_outbox_dtl' && filter[1] === 'retry_count' && filter[2] === 0)).toHaveLength(2);
  });

  it('keeps lookup failures retryable instead of skipping or falling back to email', async () => {
    jest.mocked(deliverWhatsAppOutbox).mockResolvedValue({ success: false, permanent: false, errorMessage: 'Lookup unavailable' });
    await POST(request());
    expect(updates[1]).toMatchObject({ status: 'FAILED_TEMPORARY', retry_count: 1, next_retry_at: expect.any(String), skip_reason: null });
    expect(enqueueEmailFallbackFromWhatsApp).not.toHaveBeenCalled();
  });

  it('stops when active tenant discovery fails', async () => {
    tenantError = { message: 'Unavailable' };
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(deliverWhatsAppOutbox).not.toHaveBeenCalled();
  });

  it('returns an empty batch when no active tenant exists', async () => {
    activeTenants = [];
    const response = await POST(request());
    expect(await response.json()).toMatchObject({ processed: 0, errors: 0, total: 0 });
    expect(deliverWhatsAppOutbox).not.toHaveBeenCalled();
  });
});

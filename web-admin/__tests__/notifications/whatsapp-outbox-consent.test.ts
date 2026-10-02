import { enqueueOutbox } from '@lib/notifications/adapters/outbox';
import type { NotificationEvent } from '@lib/notifications/types';
import { createAdminSupabaseClient } from '@lib/supabase/server';
import { notificationSettingsService } from '@lib/notifications/settings-service';
import { resolveWhatsAppCustomerEligibility } from '@lib/notifications/whatsapp-customer-eligibility';
import { resolveRecipientAddress } from '@lib/notifications/recipient-resolver';
import { deliverWhatsAppOutbox } from '@lib/notifications/adapters/whatsapp';

jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }));
jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), error: jest.fn() } }));
jest.mock('@lib/notifications/settings-service', () => ({ notificationSettingsService: { getActiveProvider: jest.fn() } }));
jest.mock('@lib/notifications/whatsapp-customer-eligibility', () => ({ resolveWhatsAppCustomerEligibility: jest.fn() }));
jest.mock('@lib/notifications/recipient-resolver', () => ({ resolveRecipientAddress: jest.fn() }));
jest.mock('@lib/notifications/template-renderer', () => ({ renderChannelTemplate: jest.fn().mockResolvedValue({ title: 'Order', body: 'Created' }) }));
jest.mock('@lib/notifications/config', () => ({ isOutboxInlineDispatchEnabled: jest.fn().mockResolvedValue(true), isWhatsappEmailFallbackEnabled: jest.fn().mockResolvedValue(true) }));
jest.mock('@lib/notifications/adapters/whatsapp', () => ({ deliverWhatsAppOutbox: jest.fn() }));

describe('production WhatsApp outbox consent', () => {
  const event: NotificationEvent = { tenantOrgId: 'tenant-a', code: 'order.created', recipientUserIds: ['staff-a'], sourceEntityType: 'order', sourceEntityId: 'order-a', variables: { order_number: 'ORD-001' } };
  let inserted: Record<string, unknown>[];
  let updated: Record<string, unknown>[];
  let canClaim: boolean;

  beforeEach(() => {
    jest.clearAllMocks();
    inserted = [];
    updated = [];
    canClaim = true;
    jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'TWILIO_WHATSAPP', config: { content_templates: {} } });
    jest.mocked(resolveWhatsAppCustomerEligibility).mockResolvedValue({ allowed: true, customerId: 'customer-a', recipientAddress: '+96890123456' });
    jest.mocked(deliverWhatsAppOutbox).mockResolvedValue({ success: true });
    jest.mocked(createAdminSupabaseClient).mockReturnValue({
      from: () => {
        let isClaim = false;
        const query = {
          insert: jest.fn((row: Record<string, unknown>) => { inserted.push(row); return query; }),
          update: jest.fn((row: Record<string, unknown>) => { updated.push(row); isClaim = row.status === 'PROCESSING'; return query; }),
          select: jest.fn(() => query), eq: jest.fn(() => query),
          maybeSingle: jest.fn(async () => ({ data: isClaim && !canClaim ? null : { id: 'outbox-a' }, error: null })),
        };
        return query;
      },
    } as unknown as ReturnType<typeof createAdminSupabaseClient>);
  });

  it('uses the opted-in customer destination, preserves sources and bypasses sandbox recipient resolution', async () => {
    await enqueueOutbox(event, 'WHATSAPP');
    expect(resolveWhatsAppCustomerEligibility).toHaveBeenCalledWith('tenant-a', 'order', 'order-a');
    expect(resolveRecipientAddress).not.toHaveBeenCalled();
    expect(inserted[0]).toMatchObject({ status: 'QUEUED', recipient_address: '+96890123456', metadata: { whatsapp_production_template: true } });
    expect(deliverWhatsAppOutbox).toHaveBeenCalledWith(expect.objectContaining({ source_entity_type: 'order', source_entity_id: 'order-a', recipient_address: '+96890123456' }));
  });

  it('records denied consent as SKIPPED and never starts inline dispatch or email fallback', async () => {
    jest.mocked(resolveWhatsAppCustomerEligibility).mockResolvedValue({ allowed: false, retryable: false, reason: 'Customer has not opted in to WhatsApp notifications' });
    await enqueueOutbox(event, 'WHATSAPP');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ channel_code: 'WHATSAPP', status: 'SKIPPED', skip_reason: 'Customer has not opted in to WhatsApp notifications' });
    expect(deliverWhatsAppOutbox).not.toHaveBeenCalled();
    expect(resolveRecipientAddress).not.toHaveBeenCalled();
  });

  it('retains lookup outages for later consent recheck without dispatch or fallback', async () => {
    jest.mocked(resolveWhatsAppCustomerEligibility).mockResolvedValue({ allowed: false, retryable: true, reason: 'Lookup unavailable' });
    await enqueueOutbox(event, 'WHATSAPP');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ status: 'FAILED_TEMPORARY', recipient_address: null, next_retry_at: expect.any(String), metadata: { whatsapp_eligibility_pending: true } });
    expect(deliverWhatsAppOutbox).not.toHaveBeenCalled();
    expect(resolveRecipientAddress).not.toHaveBeenCalled();
  });

  it('persists inline consent revocation as SKIPPED without converting it to permanent failure', async () => {
    jest.mocked(deliverWhatsAppOutbox).mockResolvedValue({ success: false, skipped: true, errorMessage: 'Consent revoked' });
    await enqueueOutbox(event, 'WHATSAPP');
    expect(updated.at(-1)).toMatchObject({ status: 'SKIPPED', skip_reason: 'Consent revoked' });
    expect(inserted).toHaveLength(1);
  });

  it('does not dispatch when another processor already claimed the row', async () => {
    canClaim = false;
    await enqueueOutbox(event, 'WHATSAPP');
    expect(deliverWhatsAppOutbox).not.toHaveBeenCalled();
  });

  it('keeps quiet-hours scheduled notifications queued until their due time', async () => {
    await enqueueOutbox(event, 'WHATSAPP', { scheduledAt: new Date(Date.now() + 60_000) });
    expect(inserted[0]).toMatchObject({ status: 'QUEUED', scheduled_at: expect.any(String), metadata: { whatsapp_production_template: true } });
    expect(updated).toHaveLength(0);
    expect(deliverWhatsAppOutbox).not.toHaveBeenCalled();
  });

  it('keeps legacy recipient resolution unchanged without a production template catalog', async () => {
    jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'TWILIO_WHATSAPP', config: {} });
    jest.mocked(resolveRecipientAddress).mockResolvedValue('+96890000000');
    await enqueueOutbox(event, 'WHATSAPP');
    expect(resolveWhatsAppCustomerEligibility).not.toHaveBeenCalled();
    expect(resolveRecipientAddress).toHaveBeenCalled();
    expect(inserted[0]).toMatchObject({ recipient_address: '+96890000000' });
  });
});

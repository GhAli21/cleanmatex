/**
 * Coverage for adapters/outbox.ts's enqueueOutbox (matrix row 1, "same business occurrence
 * processed twice") -- previously untested. An earlier pass claimed this row closed via
 * orchestrator.test.ts, which only asserts orchestrator.ts's own branching and never exercises
 * enqueueOutbox's actual dedup mechanism at all (confirmed by reading both files) -- that claim
 * was inaccurate and is corrected in STATUS.md/the audit doc alongside this file's addition.
 *
 * The real guarantee: buildOutboxIdempotencyKey deterministically derives the same key from the
 * same (tenant, event, channel, source entity, recipient[, suffix]) tuple every time, and
 * insertOutboxRow treats a 23505 (unique violation on idempotency_key) as a safe no-op --
 * never a thrown error, never a retry, never a duplicate notification.
 */
import { enqueueOutbox } from '@lib/notifications/adapters/outbox';
import { createAdminSupabaseClient } from '@lib/supabase/server';
import { renderChannelTemplate } from '@lib/notifications/template-renderer';
import { resolveRecipientAddress } from '@lib/notifications/recipient-resolver';
import { isOutboxInlineDispatchEnabled, isWhatsappEmailFallbackEnabled } from '@lib/notifications/config';
import { NOTIFICATION_CHANNEL } from '@lib/notifications/types';
import type { NotificationEvent } from '@lib/notifications/types';

jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }));
jest.mock('@lib/notifications/template-renderer', () => ({ renderChannelTemplate: jest.fn() }));
jest.mock('@lib/notifications/recipient-resolver', () => ({ resolveRecipientAddress: jest.fn() }));
jest.mock('@lib/notifications/config', () => ({
  isOutboxInlineDispatchEnabled: jest.fn(),
  isWhatsappEmailFallbackEnabled: jest.fn(),
}));
jest.mock('@lib/notifications/settings-service', () => ({ notificationSettingsService: { getActiveProvider: jest.fn() } }));
jest.mock('@lib/notifications/adapters/whatsapp', () => ({ deliverWhatsAppOutbox: jest.fn() }));
jest.mock('@lib/notifications/adapters/whatsapp-template-config', () => ({ isTwilioProductionTemplateProvider: jest.fn(() => false) }));
jest.mock('@lib/notifications/whatsapp-customer-eligibility', () => ({ resolveWhatsAppCustomerEligibility: jest.fn() }));

const event: NotificationEvent = {
  code: 'order.created',
  tenantOrgId: 'tenant-1',
  recipientUserIds: ['user-1'],
  sourceEntityType: 'order',
  sourceEntityId: 'order-1',
  variables: { order_number: 'ORD-001' },
};

function mockInsertOnce(impl: () => Promise<{ data: { id: string } | null; error: { code: string; message: string } | null }>) {
  const insertCalls: Record<string, unknown>[] = [];
  const chain = {
    insert: jest.fn((row: Record<string, unknown>) => {
      insertCalls.push(row);
      return chain;
    }),
    select: jest.fn(() => chain),
    maybeSingle: jest.fn(() => impl()),
  };
  const from = jest.fn(() => chain);
  jest.mocked(createAdminSupabaseClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAdminSupabaseClient>);
  return { insertCalls };
}

describe('enqueueOutbox idempotency (row 1: same business occurrence processed twice)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(renderChannelTemplate).mockResolvedValue({ title: 'Order ready', body: 'Your order ORD-001 is ready', metadata: {} });
    jest.mocked(resolveRecipientAddress).mockResolvedValue('customer@example.com');
    jest.mocked(isOutboxInlineDispatchEnabled).mockResolvedValue(false);
    jest.mocked(isWhatsappEmailFallbackEnabled).mockResolvedValue(false);
  });

  it('computes the identical deterministic idempotency_key across two separate calls for the same business occurrence', async () => {
    const { insertCalls } = mockInsertOnce(async () => ({ data: { id: 'outbox-row-1' }, error: null }));
    await enqueueOutbox(event, NOTIFICATION_CHANNEL.EMAIL);
    await enqueueOutbox(event, NOTIFICATION_CHANNEL.EMAIL);

    expect(insertCalls).toHaveLength(2);
    expect(insertCalls[0].idempotency_key).toBe(insertCalls[1].idempotency_key);
    expect(insertCalls[0].idempotency_key).toBe('tenant-1:order.created:EMAIL:order-1:user-1');
  });

  it('a different recipient or event produces a different idempotency_key (never collides with an unrelated occurrence)', async () => {
    const { insertCalls } = mockInsertOnce(async () => ({ data: { id: 'outbox-row-1' }, error: null }));
    await enqueueOutbox(event, NOTIFICATION_CHANNEL.EMAIL);
    await enqueueOutbox({ ...event, recipientUserIds: ['user-2'] }, NOTIFICATION_CHANNEL.EMAIL);
    await enqueueOutbox({ ...event, code: 'order.ready' }, NOTIFICATION_CHANNEL.EMAIL);

    const keys = insertCalls.map((row) => row.idempotency_key);
    expect(new Set(keys).size).toBe(3);
  });

  it('treats a 23505 unique-violation on idempotency_key as a safe no-op -- never throws, never duplicates', async () => {
    mockInsertOnce(async () => ({ data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint' } }));
    await expect(enqueueOutbox(event, NOTIFICATION_CHANNEL.EMAIL)).resolves.toBeUndefined();
  });

  it('a non-duplicate insert error is also swallowed (logged, not thrown) rather than breaking the caller', async () => {
    mockInsertOnce(async () => ({ data: null, error: { code: '42501', message: 'permission denied' } }));
    await expect(enqueueOutbox(event, NOTIFICATION_CHANNEL.EMAIL)).resolves.toBeUndefined();
  });
});

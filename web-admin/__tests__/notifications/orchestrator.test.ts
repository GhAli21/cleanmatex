/**
 * Notification orchestrator + event-emitter (matrix row 1) — previously had no
 * test file at all, despite being the layer every single notification passes
 * through (business-event dedup, channel fan-out, quiet-hours scheduling,
 * marketing-consent gating, WHATSAPP->EMAIL fallback).
 */
import { orchestrateNotification } from '@lib/notifications/orchestrator';
import { emitNotificationEvent } from '@lib/notifications/event-emitter';
import { createAdminSupabaseClient } from '@lib/supabase/server';
import { renderInAppTemplate } from '@lib/notifications/template-renderer';
import { deliverInApp } from '@lib/notifications/adapters/in-app';
import { enqueueOutbox } from '@lib/notifications/adapters/outbox';
import { isWhatsappEmailFallbackEnabled } from '@lib/notifications/config';
import { notificationSettingsService } from '@lib/notifications/settings-service';
import { NOTIFICATION_CHANNEL, NOTIFICATION_PRIORITY, SKIP_REASON, type NotificationEvent } from '@lib/notifications/types';

jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }));
jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@lib/notifications/template-renderer', () => ({ renderInAppTemplate: jest.fn() }));
jest.mock('@lib/notifications/adapters/in-app', () => ({ deliverInApp: jest.fn() }));
jest.mock('@lib/notifications/adapters/outbox', () => ({ enqueueOutbox: jest.fn() }));
jest.mock('@lib/notifications/config', () => ({ isWhatsappEmailFallbackEnabled: jest.fn() }));
jest.mock('@lib/notifications/settings-service', () => ({
  notificationSettingsService: {
    isChannelEnabled: jest.fn(),
    getActiveProvider: jest.fn(),
    getChannelConfig: jest.fn(),
    hasMarketingConsent: jest.fn(),
  },
}));

const baseEvent: NotificationEvent = {
  code: 'order.created',
  tenantOrgId: 'tenant-a',
  recipientUserIds: ['user-a'],
  sourceEntityType: 'order',
  sourceEntityId: 'order-a',
  variables: { order_number: 'ORD-001' },
};

/** Builds a mock admin Supabase client whose `.from()` branches between the
 * `sys_ntf_event_chan_map` active-channel lookup and the `sys_ntf_events_cd`
 * event-meta lookup (used separately by `getEventMeta` and `isEventTransactional`),
 * exactly as `orchestrator.ts` calls them. */
function makeMockSupabase(opts: {
  channels: string[];
  categoryCode?: string | null;
  isTransactional?: boolean;
}) {
  const { channels, categoryCode = null, isTransactional = true } = opts;

  const chanMapChain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
  };
  // sys_ntf_event_chan_map: .select().eq('event_code',...).eq('is_active',true) -> awaited directly (thenable)
  const chanMapThenable = Promise.resolve({ data: channels.map((c) => ({ channel_code: c })), error: null });
  const chanMapEqFn = jest.fn().mockReturnValue(chanMapThenable);
  const chanMapSelectFn = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ eq: chanMapEqFn }) });

  // sys_ntf_events_cd: .select('...').eq('code', code).maybeSingle() — used both by
  // getEventMeta (category_code) and isEventTransactional (is_transactional).
  const eventsMaybeSingleFn = jest.fn().mockResolvedValue({
    data: { category_code: categoryCode, is_transactional: isTransactional },
    error: null,
  });
  const eventsEqFn = jest.fn().mockReturnValue({ maybeSingle: eventsMaybeSingleFn });
  const eventsSelectFn = jest.fn().mockReturnValue({ eq: eventsEqFn });

  const fromFn = jest.fn((table: string) => {
    if (table === 'sys_ntf_event_chan_map') return { select: chanMapSelectFn };
    return { select: eventsSelectFn };
  });

  jest.mocked(createAdminSupabaseClient).mockReturnValue({ from: fromFn } as unknown as ReturnType<typeof createAdminSupabaseClient>);
  return { fromFn, chanMapSelectFn, eventsSelectFn, eventsMaybeSingleFn };
}

function defaultChannelConfig(overrides: Partial<Awaited<ReturnType<typeof notificationSettingsService.getChannelConfig>>> = {}) {
  return {
    channelCode: 'EMAIL',
    isEnabled: true,
    quietHoursEnabled: false,
    quietHoursStart: null,
    quietHoursEnd: null,
    quietHoursTz: null,
    dailyLimit: null,
    activeProvider: null,
    metadata: null,
    ...overrides,
  };
}

describe('orchestrateNotification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(isWhatsappEmailFallbackEnabled).mockResolvedValue(false);
  });

  it('skips entirely (no DB calls) when there are no recipients', async () => {
    const { fromFn } = makeMockSupabase({ channels: ['IN_APP'] });

    const result = await orchestrateNotification({ ...baseEvent, recipientUserIds: [] });

    expect(result).toEqual({ eventCode: 'order.created', channelsAttempted: [], inAppDelivered: 0, inAppSkipped: 0, errors: [] });
    expect(fromFn).not.toHaveBeenCalled();
  });

  describe('IN_APP channel', () => {
    it('renders and delivers in-app when the channel is enabled, counting delivered vs failed per recipient', async () => {
      makeMockSupabase({ channels: ['IN_APP'], categoryCode: 'ORDER' });
      jest.mocked(notificationSettingsService.isChannelEnabled).mockResolvedValue(true);
      jest.mocked(renderInAppTemplate).mockResolvedValue({ title: 'Order ready', title2: null, body: 'ORD-001', body2: null });
      jest.mocked(deliverInApp).mockResolvedValue([
        { recipientUserId: 'user-a', success: true, inboxId: 'inbox-1' },
      ]);

      const result = await orchestrateNotification({ ...baseEvent, recipientUserIds: ['user-a'] });

      expect(result.channelsAttempted).toEqual([NOTIFICATION_CHANNEL.IN_APP]);
      expect(result.inAppDelivered).toBe(1);
      expect(result.inAppSkipped).toBe(0);
      expect(result.errors).toEqual([]);
      expect(renderInAppTemplate).toHaveBeenCalledWith('order.created', baseEvent.variables);
      expect(deliverInApp).toHaveBeenCalledWith(expect.objectContaining({ code: 'order.created' }), expect.anything(), 'ORDER');
    });

    it('collects a per-recipient error message without throwing when in-app delivery partially fails', async () => {
      makeMockSupabase({ channels: ['IN_APP'] });
      jest.mocked(notificationSettingsService.isChannelEnabled).mockResolvedValue(true);
      jest.mocked(renderInAppTemplate).mockResolvedValue({ title: 'x', title2: null, body: 'y', body2: null });
      jest.mocked(deliverInApp).mockResolvedValue([
        { recipientUserId: 'user-a', success: true, inboxId: 'inbox-1' },
        { recipientUserId: 'user-b', success: false, error: 'insert failed' },
      ]);

      const result = await orchestrateNotification({ ...baseEvent, recipientUserIds: ['user-a', 'user-b'] });

      expect(result.inAppDelivered).toBe(1);
      expect(result.errors).toEqual(['IN_APP[user-b]: insert failed']);
    });

    it('skips rendering entirely and counts every recipient as skipped when IN_APP is disabled for the tenant', async () => {
      makeMockSupabase({ channels: ['IN_APP'] });
      jest.mocked(notificationSettingsService.isChannelEnabled).mockResolvedValue(false);

      const result = await orchestrateNotification({ ...baseEvent, recipientUserIds: ['user-a', 'user-b'] });

      expect(result.inAppSkipped).toBe(2);
      expect(result.inAppDelivered).toBe(0);
      expect(renderInAppTemplate).not.toHaveBeenCalled();
      expect(deliverInApp).not.toHaveBeenCalled();
    });

    it('records a render/deliver exception as an orchestrator-level error instead of throwing out of orchestrateNotification', async () => {
      makeMockSupabase({ channels: ['IN_APP'] });
      jest.mocked(notificationSettingsService.isChannelEnabled).mockResolvedValue(true);
      jest.mocked(renderInAppTemplate).mockRejectedValue(new Error('template not found'));

      const result = await orchestrateNotification(baseEvent);

      expect(result.errors).toEqual(['IN_APP render/deliver: template not found']);
      expect(result.inAppDelivered).toBe(0);
    });
  });

  describe('external channels — transactional events bypass consent and quiet hours', () => {
    it('enqueues every recipient without checking marketing consent for a transactional event', async () => {
      makeMockSupabase({ channels: ['EMAIL'], isTransactional: true });
      jest.mocked(notificationSettingsService.getChannelConfig).mockResolvedValue(defaultChannelConfig());

      const result = await orchestrateNotification({ ...baseEvent, recipientUserIds: ['user-a', 'user-b'] });

      expect(result.channelsAttempted).toEqual([NOTIFICATION_CHANNEL.EMAIL]);
      expect(notificationSettingsService.hasMarketingConsent).not.toHaveBeenCalled();
      expect(enqueueOutbox).toHaveBeenCalledTimes(1);
      expect(enqueueOutbox).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserIds: ['user-a', 'user-b'] }),
        NOTIFICATION_CHANNEL.EMAIL,
        expect.objectContaining({ scheduledAt: expect.any(Date) }),
      );
    });

    it('does not enqueue anything and skips the channel entirely when it is disabled in tenant settings', async () => {
      makeMockSupabase({ channels: ['EMAIL'] });
      jest.mocked(notificationSettingsService.getChannelConfig).mockResolvedValue(defaultChannelConfig({ isEnabled: false }));

      const result = await orchestrateNotification(baseEvent);

      expect(result.channelsAttempted).toEqual([NOTIFICATION_CHANNEL.EMAIL]);
      expect(enqueueOutbox).not.toHaveBeenCalled();
    });

    it('never attempts delivery for IN_APP or WEB_SOCKET inside the external-channel loop (no double enqueue)', async () => {
      makeMockSupabase({ channels: ['IN_APP', 'WEB_SOCKET', 'EMAIL'] });
      jest.mocked(notificationSettingsService.isChannelEnabled).mockResolvedValue(false); // IN_APP off, skip quickly
      jest.mocked(notificationSettingsService.getChannelConfig).mockResolvedValue(defaultChannelConfig());

      const result = await orchestrateNotification(baseEvent);

      expect(result.channelsAttempted).toEqual([NOTIFICATION_CHANNEL.IN_APP, NOTIFICATION_CHANNEL.EMAIL]);
      expect(enqueueOutbox).toHaveBeenCalledTimes(1);
      expect(enqueueOutbox).toHaveBeenCalledWith(expect.anything(), NOTIFICATION_CHANNEL.EMAIL, expect.anything());
    });
  });

  describe('external channels — non-transactional events respect marketing consent', () => {
    it('splits recipients: consenting users go in the main batch, non-consenting users are enqueued individually with NO_MARKETING_CONSENT', async () => {
      makeMockSupabase({ channels: ['EMAIL'], isTransactional: false });
      jest.mocked(notificationSettingsService.getChannelConfig).mockResolvedValue(defaultChannelConfig());
      jest.mocked(notificationSettingsService.hasMarketingConsent).mockImplementation(
        async (_tenant, userId) => userId === 'user-a',
      );

      await orchestrateNotification({ ...baseEvent, recipientUserIds: ['user-a', 'user-b'] });

      // Non-consenting user: a dedicated single-recipient outbox row carrying the skip reason.
      expect(enqueueOutbox).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserIds: ['user-b'] }),
        NOTIFICATION_CHANNEL.EMAIL,
        expect.objectContaining({ skipReason: SKIP_REASON.NO_MARKETING_CONSENT }),
      );
      // Consenting user: part of the normal eligible batch, no skipReason.
      expect(enqueueOutbox).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserIds: ['user-a'] }),
        NOTIFICATION_CHANNEL.EMAIL,
        expect.not.objectContaining({ skipReason: expect.anything() }),
      );
      expect(enqueueOutbox).toHaveBeenCalledTimes(2);
    });

    it('enqueues nothing for the eligible batch when every recipient lacks marketing consent', async () => {
      makeMockSupabase({ channels: ['EMAIL'], isTransactional: false });
      jest.mocked(notificationSettingsService.getChannelConfig).mockResolvedValue(defaultChannelConfig());
      jest.mocked(notificationSettingsService.hasMarketingConsent).mockResolvedValue(false);

      await orchestrateNotification({ ...baseEvent, recipientUserIds: ['user-a'] });

      expect(enqueueOutbox).toHaveBeenCalledTimes(1);
      expect(enqueueOutbox).toHaveBeenCalledWith(
        expect.objectContaining({ recipientUserIds: ['user-a'] }),
        NOTIFICATION_CHANNEL.EMAIL,
        expect.objectContaining({ skipReason: SKIP_REASON.NO_MARKETING_CONSENT }),
      );
    });
  });

  describe('WHATSAPP -> EMAIL fallback', () => {
    it('falls back to EMAIL and tags channelsAttempted with the arrow notation when WhatsApp has no active provider and fallback + EMAIL are both enabled', async () => {
      makeMockSupabase({ channels: ['WHATSAPP'] });
      jest.mocked(notificationSettingsService.isChannelEnabled).mockImplementation(
        async (_tenant, channel) => channel === NOTIFICATION_CHANNEL.EMAIL,
      );
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue(null);
      jest.mocked(isWhatsappEmailFallbackEnabled).mockResolvedValue(true);
      jest.mocked(notificationSettingsService.getChannelConfig).mockResolvedValue(defaultChannelConfig({ channelCode: 'EMAIL' }));

      const result = await orchestrateNotification(baseEvent);

      expect(result.channelsAttempted).toEqual(['WHATSAPP→EMAIL']);
      expect(notificationSettingsService.getChannelConfig).toHaveBeenCalledWith('tenant-a', NOTIFICATION_CHANNEL.EMAIL);
      expect(enqueueOutbox).toHaveBeenCalledWith(
        expect.anything(),
        NOTIFICATION_CHANNEL.EMAIL,
        expect.objectContaining({ idempotencySuffix: 'wa_fb' }),
      );
    });

    it('stays on WHATSAPP (no fallback, no arrow) when no active provider exists but the fallback flag is off', async () => {
      makeMockSupabase({ channels: ['WHATSAPP'] });
      jest.mocked(notificationSettingsService.isChannelEnabled).mockResolvedValue(false);
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue(null);
      jest.mocked(isWhatsappEmailFallbackEnabled).mockResolvedValue(false);
      jest.mocked(notificationSettingsService.getChannelConfig).mockResolvedValue(defaultChannelConfig({ channelCode: 'WHATSAPP', isEnabled: false }));

      const result = await orchestrateNotification(baseEvent);

      expect(result.channelsAttempted).toEqual([NOTIFICATION_CHANNEL.WHATSAPP]);
      expect(notificationSettingsService.getChannelConfig).toHaveBeenCalledWith('tenant-a', NOTIFICATION_CHANNEL.WHATSAPP);
      expect(enqueueOutbox).not.toHaveBeenCalled();
    });

    it('stays on WHATSAPP when a provider IS active, never consulting the fallback flag', async () => {
      makeMockSupabase({ channels: ['WHATSAPP'] });
      jest.mocked(notificationSettingsService.isChannelEnabled).mockResolvedValue(true);
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'TWILIO_WHATSAPP', config: {} });
      jest.mocked(notificationSettingsService.getChannelConfig).mockResolvedValue(defaultChannelConfig({ channelCode: 'WHATSAPP' }));

      const result = await orchestrateNotification(baseEvent);

      expect(result.channelsAttempted).toEqual([NOTIFICATION_CHANNEL.WHATSAPP]);
      expect(isWhatsappEmailFallbackEnabled).not.toHaveBeenCalled();
      expect(enqueueOutbox).toHaveBeenCalledWith(expect.anything(), NOTIFICATION_CHANNEL.WHATSAPP, expect.anything());
    });

    it('does not fall back to EMAIL when fallback is enabled but EMAIL itself is disabled for the tenant', async () => {
      makeMockSupabase({ channels: ['WHATSAPP'] });
      jest.mocked(notificationSettingsService.isChannelEnabled).mockResolvedValue(false); // both WHATSAPP and EMAIL report disabled
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue(null);
      jest.mocked(isWhatsappEmailFallbackEnabled).mockResolvedValue(true);
      jest.mocked(notificationSettingsService.getChannelConfig).mockResolvedValue(defaultChannelConfig({ channelCode: 'WHATSAPP', isEnabled: false }));

      const result = await orchestrateNotification(baseEvent);

      expect(result.channelsAttempted).toEqual([NOTIFICATION_CHANNEL.WHATSAPP]);
      expect(enqueueOutbox).not.toHaveBeenCalled();
    });
  });

  describe('quiet hours scheduling', () => {
    const fixedNow = new Date('2026-10-10T23:00:00.000Z'); // inside a 22:00-08:00 UTC overnight quiet window

    beforeEach(() => {
      jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
      jest.setSystemTime(fixedNow);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('schedules a non-transactional, non-urgent notification for the end of the quiet window instead of sending immediately', async () => {
      makeMockSupabase({ channels: ['EMAIL'], isTransactional: false });
      jest.mocked(notificationSettingsService.hasMarketingConsent).mockResolvedValue(true);
      jest.mocked(notificationSettingsService.getChannelConfig).mockResolvedValue(defaultChannelConfig({
        quietHoursEnabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '08:00',
        quietHoursTz: 'UTC',
      }));

      await orchestrateNotification({ ...baseEvent, recipientUserIds: ['user-a'] });

      const [, , options] = jest.mocked(enqueueOutbox).mock.calls[0];
      // Pushed to 08:00 UTC the next day, strictly after "now" (23:00) — never sent immediately during the quiet window.
      expect((options!.scheduledAt as Date).getTime()).toBeGreaterThan(fixedNow.getTime());
      expect((options!.scheduledAt as Date).toISOString()).toBe('2026-10-11T08:00:00.000Z');
    });

    it('ignores quiet hours and sends immediately for a URGENT/CRITICAL priority notification', async () => {
      makeMockSupabase({ channels: ['EMAIL'], isTransactional: false });
      jest.mocked(notificationSettingsService.hasMarketingConsent).mockResolvedValue(true);
      jest.mocked(notificationSettingsService.getChannelConfig).mockResolvedValue(defaultChannelConfig({
        quietHoursEnabled: true, quietHoursStart: '22:00', quietHoursEnd: '08:00', quietHoursTz: 'UTC',
      }));

      await orchestrateNotification({ ...baseEvent, recipientUserIds: ['user-a'], priority: NOTIFICATION_PRIORITY.CRITICAL });

      const [, , options] = jest.mocked(enqueueOutbox).mock.calls[0];
      // Urgent/critical always uses "now", regardless of the active quiet window.
      expect((options!.scheduledAt as Date).getTime()).toBe(fixedNow.getTime());
    });
  });
});

describe('emitNotificationEvent', () => {
  beforeEach(() => jest.clearAllMocks());

  it('never throws to the caller when orchestrateNotification rejects — a notification failure must not break the business operation', async () => {
    makeMockSupabase({ channels: [] });
    jest.mocked(createAdminSupabaseClient).mockImplementation(() => {
      throw new Error('db unavailable');
    });

    await expect(emitNotificationEvent(baseEvent)).resolves.toBeUndefined();
  });

  it('delegates to orchestrateNotification with the exact event payload it was given', async () => {
    makeMockSupabase({ channels: ['IN_APP'] });
    jest.mocked(notificationSettingsService.isChannelEnabled).mockResolvedValue(false);

    await emitNotificationEvent(baseEvent);

    // isChannelEnabled only gets called from inside orchestrateNotification's IN_APP branch,
    // so its invocation proves the event reached the orchestrator unchanged.
    expect(notificationSettingsService.isChannelEnabled).toHaveBeenCalledWith('tenant-a', NOTIFICATION_CHANNEL.IN_APP);
  });
});

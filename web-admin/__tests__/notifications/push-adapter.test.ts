/** @jest-environment node */
/**
 * Push channel adapter (matrix row 25) — previously had zero test coverage despite
 * real per-device fan-out and failure-count retirement logic
 * (`failure_count >= 3` -> `is_active=false`, or immediate deactivation on a
 * provider-reported permanent rejection).
 */
import { deliverPushOutbox, type OutboxPushRow } from '@lib/notifications/adapters/push';
import { createAdminSupabaseClient } from '@/lib/supabase/server';
import { notificationSettingsService } from '@lib/notifications/settings-service';
import { getNtfHqDispatchUrl, isNtfDispatchViaHq } from '@lib/notifications/config';
import { sendVapidPush } from '@lib/notifications/adapters/push/vapid';
import { sendFcmPush } from '@lib/notifications/adapters/push/fcm';
import { sendOneSignalPush } from '@lib/notifications/adapters/push/onesignal';

jest.mock('@/lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }));
jest.mock('@lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@lib/notifications/settings-service', () => ({
  notificationSettingsService: {
    isHqDispatchEnabledForChannel: jest.fn(),
    getActiveProvider: jest.fn(),
  },
}));
jest.mock('@lib/notifications/config', () => ({
  isNtfDispatchViaHq: jest.fn(),
  getNtfHqDispatchUrl: jest.fn(),
}));
jest.mock('@lib/notifications/adapters/push/vapid', () => ({ sendVapidPush: jest.fn() }));
jest.mock('@lib/notifications/adapters/push/fcm', () => ({ sendFcmPush: jest.fn() }));
jest.mock('@lib/notifications/adapters/push/onesignal', () => ({ sendOneSignalPush: jest.fn() }));

const baseRow: OutboxPushRow = {
  id: 'outbox-push-1',
  tenant_org_id: 'tenant-a',
  recipient_user_id: 'user-a',
  rendered_subject: 'Order ready',
  rendered_body: 'Your order is ready for pickup',
  event_code: 'order.ready',
  retry_count: 0,
};

/** Builds a mock Supabase client whose `.from('org_ntf_push_subs_dtl')` branches
 * between the `select().eq().eq().eq().eq()` subscription-fetch chain and the
 * `update().eq()` failure/success-recording chain, exactly as `push.ts` calls them. */
function makeMockSupabase(subscriptions: unknown[] | null, fetchError: { message: string } | null = null) {
  const updateEqFn = jest.fn().mockResolvedValue({ error: null });
  const updateFn = jest.fn().mockReturnValue({ eq: updateEqFn });

  const selectFn = jest.fn().mockReturnValue({
    eq: jest.fn().mockImplementation(() => ({
      eq: jest.fn().mockImplementation(() => ({
        eq: jest.fn().mockImplementation(() => ({
          eq: jest.fn().mockResolvedValue({ data: subscriptions, error: fetchError }),
        })),
      })),
    })),
  });

  const fromFn = jest.fn().mockReturnValue({ select: selectFn, update: updateFn });
  const client = { from: fromFn };
  jest.mocked(createAdminSupabaseClient).mockReturnValue(client as unknown as ReturnType<typeof createAdminSupabaseClient>);
  return { fromFn, selectFn, updateFn, updateEqFn };
}

describe('push adapter — deliverPushOutbox', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(isNtfDispatchViaHq).mockResolvedValue(false);
    jest.mocked(notificationSettingsService.isHqDispatchEnabledForChannel).mockResolvedValue(false);
    delete (global as { fetch?: unknown }).fetch;
  });

  describe('direct-provider path', () => {
    it('fails without sending when no active PUSH provider is configured for the tenant', async () => {
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue(null);
      const { fromFn } = makeMockSupabase([]);

      const result = await deliverPushOutbox(baseRow);

      expect(result).toEqual({ success: false, sentCount: 0, skippedCount: 0, errorMessage: 'No active PUSH provider configured' });
      expect(fromFn).not.toHaveBeenCalled();
    });

    it('fails without querying subscriptions when the outbox row has no recipient_user_id', async () => {
      const { fromFn } = makeMockSupabase([]);
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'VAPID', config: {} });

      const result = await deliverPushOutbox({ ...baseRow, recipient_user_id: null });

      expect(result).toEqual({ success: false, sentCount: 0, skippedCount: 0, errorMessage: 'No recipient_user_id for PUSH channel' });
      expect(fromFn).not.toHaveBeenCalled();
    });

    it('propagates a subscription-fetch error without attempting delivery', async () => {
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'VAPID', config: {} });
      makeMockSupabase(null, { message: 'connection reset' });

      const result = await deliverPushOutbox(baseRow);

      expect(result).toEqual({ success: false, sentCount: 0, skippedCount: 0, errorMessage: 'Failed to load subscriptions: connection reset' });
      expect(sendVapidPush).not.toHaveBeenCalled();
    });

    it('succeeds trivially with zero sent/skipped when the recipient has no active subscriptions', async () => {
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'VAPID', config: {} });
      makeMockSupabase([]);

      const result = await deliverPushOutbox(baseRow);

      expect(result).toEqual({ success: true, sentCount: 0, skippedCount: 0 });
      expect(sendVapidPush).not.toHaveBeenCalled();
    });

    it('scopes the subscription query to the tenant, user, provider and active flag', async () => {
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'FCM', config: {} });
      const { selectFn } = makeMockSupabase([]);

      await deliverPushOutbox(baseRow);

      expect(selectFn).toHaveBeenCalledWith('id, provider_code, platform, subscription_data, failure_count');
    });

    it('dispatches to the correct provider sub-adapter by provider_code and records success per subscription', async () => {
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'VAPID', config: {} });
      const subs = [
        { id: 'sub-1', provider_code: 'VAPID', platform: 'web', subscription_data: { endpoint: 'https://push.example/1' }, failure_count: 0 },
      ];
      const { updateFn, updateEqFn } = makeMockSupabase(subs);
      jest.mocked(sendVapidPush).mockResolvedValue({ success: true, subscriptionId: 'sub-1' });

      const result = await deliverPushOutbox(baseRow);

      expect(result).toEqual({ success: true, sentCount: 1, skippedCount: 0 });
      expect(sendVapidPush).toHaveBeenCalledWith('sub-1', subs[0].subscription_data, expect.stringContaining('"title":"Order ready"'));
      // Success resets failure_count and stamps last_verified_at — never touches is_active.
      expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ failure_count: 0, last_verified_at: expect.any(String) }));
      expect(updateEqFn).toHaveBeenCalledWith('id', 'sub-1');
    });

    it('routes FCM and ONESIGNAL subscriptions to their own sub-adapters in the same fan-out', async () => {
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'FCM', config: {} });
      const subs = [
        { id: 'sub-fcm', provider_code: 'FCM', platform: 'android', subscription_data: { token: 'fcm-token' }, failure_count: 0 },
        { id: 'sub-os', provider_code: 'ONESIGNAL', platform: 'ios', subscription_data: { playerId: 'player-1' }, failure_count: 0 },
      ];
      makeMockSupabase(subs);
      jest.mocked(sendFcmPush).mockResolvedValue({ success: true, subscriptionId: 'sub-fcm' });
      jest.mocked(sendOneSignalPush).mockResolvedValue({ success: true, subscriptionId: 'sub-os' });

      const result = await deliverPushOutbox(baseRow);

      expect(result).toEqual({ success: true, sentCount: 2, skippedCount: 0 });
      expect(sendFcmPush).toHaveBeenCalledWith('sub-fcm', subs[0].subscription_data, expect.any(String));
      expect(sendOneSignalPush).toHaveBeenCalledWith('sub-os', subs[1].subscription_data, expect.any(String));
    });

    it('skips (without recording failure) a subscription whose provider_code is unrecognized', async () => {
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'VAPID', config: {} });
      const subs = [{ id: 'sub-x', provider_code: 'UNKNOWN_PROVIDER', platform: 'web', subscription_data: {}, failure_count: 0 }];
      const { updateFn } = makeMockSupabase(subs);

      const result = await deliverPushOutbox(baseRow);

      expect(result).toEqual({ success: false, sentCount: 0, skippedCount: 1 });
      expect(updateFn).not.toHaveBeenCalled();
      expect(sendVapidPush).not.toHaveBeenCalled();
    });

    it('increments failure_count on a transient per-subscription failure without deactivating below the retirement threshold', async () => {
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'VAPID', config: {} });
      const subs = [{ id: 'sub-1', provider_code: 'VAPID', platform: 'web', subscription_data: {}, failure_count: 1 }];
      const { updateFn, updateEqFn } = makeMockSupabase(subs);
      jest.mocked(sendVapidPush).mockResolvedValue({ success: false, subscriptionId: 'sub-1', errorMessage: 'network timeout', permanent: false });

      const result = await deliverPushOutbox(baseRow);

      expect(result).toEqual({ success: false, sentCount: 0, skippedCount: 1 });
      expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ failure_count: 2 }));
      expect(updateFn).not.toHaveBeenCalledWith(expect.objectContaining({ is_active: false }));
      expect(updateEqFn).toHaveBeenCalledWith('id', 'sub-1');
    });

    it('deactivates a subscription once failure_count reaches the retirement threshold of 3, even for a transient error', async () => {
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'VAPID', config: {} });
      // failure_count is already 2 -> this failure makes it 3, crossing the >=3 retirement threshold.
      const subs = [{ id: 'sub-1', provider_code: 'VAPID', platform: 'web', subscription_data: {}, failure_count: 2 }];
      const { updateFn } = makeMockSupabase(subs);
      jest.mocked(sendVapidPush).mockResolvedValue({ success: false, subscriptionId: 'sub-1', errorMessage: 'network timeout', permanent: false });

      await deliverPushOutbox(baseRow);

      expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ failure_count: 3, is_active: false }));
    });

    it('deactivates a subscription immediately on a permanent provider rejection, regardless of failure_count', async () => {
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'FCM', config: {} });
      // failure_count is 0 (first-ever attempt) but the provider reports a permanent rejection (e.g. UNREGISTERED).
      const subs = [{ id: 'sub-1', provider_code: 'FCM', platform: 'android', subscription_data: {}, failure_count: 0 }];
      const { updateFn } = makeMockSupabase(subs);
      jest.mocked(sendFcmPush).mockResolvedValue({ success: false, subscriptionId: 'sub-1', errorMessage: 'UNREGISTERED', permanent: true });

      await deliverPushOutbox(baseRow);

      expect(updateFn).toHaveBeenCalledWith(expect.objectContaining({ failure_count: 1, is_active: false }));
    });

    it('reports overall failure when every subscription fails, even though each is individually counted as skipped not errored', async () => {
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'VAPID', config: {} });
      const subs = [
        { id: 'sub-1', provider_code: 'VAPID', platform: 'web', subscription_data: {}, failure_count: 0 },
        { id: 'sub-2', provider_code: 'VAPID', platform: 'web', subscription_data: {}, failure_count: 0 },
      ];
      makeMockSupabase(subs);
      jest.mocked(sendVapidPush).mockResolvedValue({ success: false, subscriptionId: 'x', errorMessage: 'gone', permanent: true });

      const result = await deliverPushOutbox(baseRow);

      // sentCount stays 0 -> overall success is false even though both subscriptions were
      // processed (skippedCount: 2), not silently dropped.
      expect(result).toEqual({ success: false, sentCount: 0, skippedCount: 2 });
    });

    it('reports overall success when at least one of several subscriptions is reached, even if others fail', async () => {
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue({ providerCode: 'VAPID', config: {} });
      const subs = [
        { id: 'sub-1', provider_code: 'VAPID', platform: 'web', subscription_data: {}, failure_count: 0 },
        { id: 'sub-2', provider_code: 'VAPID', platform: 'web', subscription_data: {}, failure_count: 0 },
      ];
      makeMockSupabase(subs);
      jest.mocked(sendVapidPush)
        .mockResolvedValueOnce({ success: true, subscriptionId: 'sub-1' })
        .mockResolvedValueOnce({ success: false, subscriptionId: 'sub-2', errorMessage: 'gone', permanent: true });

      const result = await deliverPushOutbox(baseRow);

      expect(result).toEqual({ success: true, sentCount: 1, skippedCount: 1 });
    });
  });

  describe('HQ dispatch proxy path', () => {
    beforeEach(() => {
      jest.mocked(isNtfDispatchViaHq).mockResolvedValue(true);
      jest.mocked(notificationSettingsService.isHqDispatchEnabledForChannel).mockResolvedValue(true);
      jest.mocked(getNtfHqDispatchUrl).mockResolvedValue('https://hq.cleanmatex.test/dispatch');
      process.env.NTF_HQ_SERVICE_ROLE_KEY = 'hq-service-key';
    });

    afterEach(() => {
      delete process.env.NTF_HQ_SERVICE_ROLE_KEY;
    });

    it('is only taken when both the global HQ-dispatch switch and the per-tenant PUSH opt-in are on', async () => {
      jest.mocked(notificationSettingsService.isHqDispatchEnabledForChannel).mockResolvedValue(false);
      jest.mocked(notificationSettingsService.getActiveProvider).mockResolvedValue(null);
      const fetchMock = jest.fn();
      (global as { fetch: unknown }).fetch = fetchMock;

      await deliverPushOutbox(baseRow);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(notificationSettingsService.isHqDispatchEnabledForChannel).toHaveBeenCalledWith('tenant-a', 'PUSH');
    });

    it('fails closed without calling fetch when NTF_HQ_SERVICE_ROLE_KEY is not configured', async () => {
      delete process.env.NTF_HQ_SERVICE_ROLE_KEY;
      const fetchMock = jest.fn();
      (global as { fetch: unknown }).fetch = fetchMock;

      const result = await deliverPushOutbox(baseRow);

      expect(result).toEqual({ success: false, sentCount: 0, skippedCount: 0, errorMessage: 'NTF_HQ_SERVICE_ROLE_KEY not configured' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fails without calling fetch when the outbox row has no recipient_user_id', async () => {
      const fetchMock = jest.fn();
      (global as { fetch: unknown }).fetch = fetchMock;

      const result = await deliverPushOutbox({ ...baseRow, recipient_user_id: null });

      expect(result).toEqual({ success: false, sentCount: 0, skippedCount: 0, errorMessage: 'No recipient_user_id for PUSH channel' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sends the HQ proxy request with a Bearer auth header and reports success on a 2xx response', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ status: 'SENT', sentCount: 1, skippedCount: 0 }),
      });
      (global as { fetch: unknown }).fetch = fetchMock;

      const result = await deliverPushOutbox(baseRow);

      expect(result).toEqual({ success: true, sentCount: 1, skippedCount: 0 });
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe('https://hq.cleanmatex.test/dispatch');
      expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer hq-service-key' });
      expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({
        tenantOrgId: 'tenant-a', channel: 'PUSH', recipient: 'user-a',
      });
    });

    it('reports failure when the HQ proxy response body reports a PERMANENT_FAILURE status', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ status: 'PERMANENT_FAILURE' }),
      });
      (global as { fetch: unknown }).fetch = fetchMock;

      const result = await deliverPushOutbox(baseRow);

      expect(result).toEqual({ success: false, sentCount: 0, skippedCount: 1 });
    });

    it('reports failure with the HTTP status and body text when the HQ proxy responds non-OK', async () => {
      const fetchMock = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: jest.fn().mockResolvedValue('Bad Gateway'),
      });
      (global as { fetch: unknown }).fetch = fetchMock;

      const result = await deliverPushOutbox(baseRow);

      expect(result).toMatchObject({ success: false, sentCount: 0, skippedCount: 1, errorMessage: 'HQ proxy HTTP 502: Bad Gateway' });
    });

    it('catches a network-level fetch rejection instead of throwing out of the adapter', async () => {
      const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      (global as { fetch: unknown }).fetch = fetchMock;

      const result = await deliverPushOutbox(baseRow);

      expect(result).toEqual({ success: false, sentCount: 0, skippedCount: 1, errorMessage: 'ECONNREFUSED' });
    });
  });
});

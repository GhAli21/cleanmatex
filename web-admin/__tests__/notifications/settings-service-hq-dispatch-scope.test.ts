/**
 * Covers isHqDispatchEnabledForChannel (lib/notifications/settings-service.ts),
 * added 2026-10-10 to close plan item A1's real scoping gap: the platform-wide
 * ntf_dispatch_via_hq runtime flag has no tenant_org_id column (confirmed via
 * information_schema.columns) and so cannot scope the HQ dispatch proxy to one
 * pilot tenant on its own. This method is the per-tenant/channel narrowing
 * every adapter now ANDs with that global flag before routing through the
 * proxy — see adapters/{whatsapp,sms,email,push}.ts.
 */
import { notificationSettingsService } from '@lib/notifications/settings-service';

const mockFrom = jest.fn();
jest.mock('@/lib/supabase/server', () => ({
  createAdminSupabaseClient: () => ({ from: mockFrom }),
}));

function mockSettingsRow(metadata: Record<string, unknown> | null) {
  mockFrom.mockImplementation((table: string) => {
    if (table === 'org_ntf_settings_cf') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => Promise.resolve({
              data: [{
                channel_code: 'WHATSAPP', is_enabled: true,
                quiet_hours_enabled: false, quiet_hours_start: null, quiet_hours_end: null, quiet_hours_tz: null,
                daily_limit: null, metadata,
              }],
            }),
          }),
        }),
      };
    }
    if (table === 'org_ntf_channel_provider_cf') {
      return { select: () => ({ eq: () => ({ eq: () => Promise.resolve({ data: [] }) }) }) };
    }
    throw new Error(`unexpected table in test: ${table}`);
  });
}

describe('isHqDispatchEnabledForChannel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    notificationSettingsService.invalidateChannel('tenant-1');
  });

  it('returns false when no per-tenant opt-in metadata exists at all', async () => {
    mockSettingsRow(null);
    expect(await notificationSettingsService.isHqDispatchEnabledForChannel('tenant-1', 'WHATSAPP')).toBe(false);
  });

  it('returns false when metadata exists but does not set dispatch_via_hq', async () => {
    mockSettingsRow({ some_other_key: true });
    expect(await notificationSettingsService.isHqDispatchEnabledForChannel('tenant-1', 'WHATSAPP')).toBe(false);
  });

  it('returns false for a truthy-but-not-strictly-true value (no implicit coercion)', async () => {
    mockSettingsRow({ dispatch_via_hq: 'true' });
    expect(await notificationSettingsService.isHqDispatchEnabledForChannel('tenant-1', 'WHATSAPP')).toBe(false);
  });

  it('returns true only when this exact tenant/channel explicitly opted in', async () => {
    mockSettingsRow({ dispatch_via_hq: true });
    expect(await notificationSettingsService.isHqDispatchEnabledForChannel('tenant-1', 'WHATSAPP')).toBe(true);
  });

  it('does not leak a WHATSAPP opt-in to a channel with no settings row', async () => {
    mockSettingsRow({ dispatch_via_hq: true }); // row is for WHATSAPP only
    expect(await notificationSettingsService.isHqDispatchEnabledForChannel('tenant-1', 'SMS')).toBe(false);
  });
});

/** A failed required financial resolver must remain distinguishable from an unset setting. */
import { TenantSettingsService } from '@/lib/services/tenant-settings.service';

jest.mock('@/lib/supabase/client', () => ({ createClient: jest.fn().mockReturnValue({}) }));

describe('strict financial setting reads', () => {
  it('retains the authenticated tenant/branch/user resolution scope', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [{ stng_code: 'TENANT_VAT_RATE', stng_value_jsonb: 0.15 }], error: null });
    const service = new TenantSettingsService({ rpc } as never);
    await expect(service.getSettingValueStrict('tenant-A', 'TENANT_VAT_RATE', 'branch-A', 'staff-A')).resolves.toBe(0.15);
    expect(rpc).toHaveBeenCalledWith('fn_stng_resolve_all_settings', { p_tenant_id: 'tenant-A', p_branch_id: 'branch-A', p_user_id: 'staff-A' });
  });
  it.each([{ data: null, error: { message: 'unavailable' } }, { data: null, error: null }])('rejects unverifiable responses', async (result) => {
    const service = new TenantSettingsService({ rpc: jest.fn().mockResolvedValue(result) } as never);
    await expect(service.getSettingValueStrict('tenant-A', 'TENANT_VAT_RATE')).rejects.toThrow('FINANCIAL_SETTINGS_UNAVAILABLE');
  });
  it('returns null for an absent setting only after a successful resolver response', async () => {
    const service = new TenantSettingsService({ rpc: jest.fn().mockResolvedValue({ data: [], error: null }) } as never);
    await expect(service.getSettingValueStrict('tenant-A', 'TENANT_VAT_RATE')).resolves.toBeNull();
  });
});

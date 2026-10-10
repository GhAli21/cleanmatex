/** @jest-environment node */
import { resolveNotificationRecipientLanguage } from '@lib/notifications/recipient-language-resolver';
import { createAdminSupabaseClient } from '@lib/supabase/server';

jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }));
jest.mock('@lib/utils/logger', () => ({ logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));

describe('resolveNotificationRecipientLanguage', () => {
  let orderResult: { data: unknown; error: unknown };
  let customerResult: { data: unknown; error: unknown };
  let tenantResult: { data: unknown; error: unknown };
  const filters: Array<[string, string, unknown]> = [];

  function configureSupabase() {
    filters.length = 0;
    jest.mocked(createAdminSupabaseClient).mockReturnValue({
      from: (table: string) => {
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn((field: string, value: unknown) => { filters.push([table, field, value]); return query; }),
          maybeSingle: jest.fn(async () => {
            if (table === 'org_orders_mst') return orderResult;
            if (table === 'org_customers_mst') return customerResult;
            return tenantResult;
          }),
        };
        return query;
      },
    } as unknown as ReturnType<typeof createAdminSupabaseClient>);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    orderResult = { data: { customer_id: 'customer-a' }, error: null };
    customerResult = { data: { id: 'customer-a', is_active: true, rec_status: 1, preferred_language: 'ar' }, error: null };
    tenantResult = { data: { language: 'en' }, error: null };
    configureSupabase();
  });

  it('tier 1: uses the customer explicit preferred_language when set', async () => {
    const result = await resolveNotificationRecipientLanguage('tenant-a', 'order', 'order-a');
    expect(result).toBe('ar');
  });

  it('tier 2: falls back to the tenant default language when the customer has no preference', async () => {
    customerResult = { data: { id: 'customer-a', is_active: true, rec_status: 1, preferred_language: null }, error: null };
    const result = await resolveNotificationRecipientLanguage('tenant-a', 'order', 'order-a');
    expect(result).toBe('en');
  });

  it('tier 2: falls back to the tenant default language when the customer preference is blank/whitespace', async () => {
    customerResult = { data: { id: 'customer-a', is_active: true, rec_status: 1, preferred_language: '   ' }, error: null };
    tenantResult = { data: { language: 'ar' }, error: null };
    const result = await resolveNotificationRecipientLanguage('tenant-a', 'order', 'order-a');
    expect(result).toBe('ar');
  });

  it('tier 3: hard-falls back to "en" when neither the customer nor the tenant has a language', async () => {
    customerResult = { data: { id: 'customer-a', is_active: true, rec_status: 1, preferred_language: null }, error: null };
    tenantResult = { data: { language: null }, error: null };
    const result = await resolveNotificationRecipientLanguage('tenant-a', 'order', 'order-a');
    expect(result).toBe('en');
  });

  it('tier 3: hard-falls back to "en" when the tenant lookup itself fails', async () => {
    customerResult = { data: { id: 'customer-a', is_active: true, rec_status: 1, preferred_language: null }, error: null };
    tenantResult = { data: null, error: { message: 'db unavailable' } };
    const result = await resolveNotificationRecipientLanguage('tenant-a', 'order', 'order-a');
    expect(result).toBe('en');
  });

  it('missing customer on the order: falls through to tenant default', async () => {
    orderResult = { data: { customer_id: null }, error: null };
    const result = await resolveNotificationRecipientLanguage('tenant-a', 'order', 'order-a');
    expect(result).toBe('en');
  });

  it('inactive/soft-deleted customer: falls through to tenant default instead of using a stale preference', async () => {
    customerResult = { data: { id: 'customer-a', is_active: false, rec_status: 1, preferred_language: 'ar' }, error: null };
    const result = await resolveNotificationRecipientLanguage('tenant-a', 'order', 'order-a');
    expect(result).toBe('en');
  });

  it('missing order (no source_entity_id): skips the customer lookup entirely and uses tenant default', async () => {
    const result = await resolveNotificationRecipientLanguage('tenant-a', 'order', null);
    expect(result).toBe('en');
    const orderFilters = filters.filter(([table]) => table === 'org_orders_mst');
    expect(orderFilters.length).toBe(0);
  });

  it('non-order source (e.g. staff notification): skips the customer lookup and uses tenant default', async () => {
    const result = await resolveNotificationRecipientLanguage('tenant-a', 'staff_notice', 'notice-1');
    expect(result).toBe('en');
    const orderFilters = filters.filter(([table]) => table === 'org_orders_mst');
    expect(orderFilters.length).toBe(0);
  });

  it('order lookup failure: falls through to tenant default rather than throwing', async () => {
    orderResult = { data: null, error: { message: 'db unavailable' } };
    const result = await resolveNotificationRecipientLanguage('tenant-a', 'order', 'order-a');
    expect(result).toBe('en');
  });

  it('filters every query by the exact tenant_org_id — never another tenant', async () => {
    await resolveNotificationRecipientLanguage('tenant-a', 'order', 'order-a');
    const tenantScoped = filters.filter(([table, field]) => (
      (table === 'org_orders_mst' || table === 'org_customers_mst') && field === 'tenant_org_id'
    ));
    expect(tenantScoped.length).toBeGreaterThanOrEqual(2);
    expect(tenantScoped.every(([, , value]) => value === 'tenant-a')).toBe(true);
  });
});

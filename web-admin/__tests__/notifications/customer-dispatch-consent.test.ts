/** @jest-environment node */
import { resolveCustomerDispatchConsent } from '@lib/notifications/customer-dispatch-consent';
import { createAdminSupabaseClient } from '@lib/supabase/server';

jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }));

describe('resolveCustomerDispatchConsent', () => {
  let orderResult: { data: unknown; error: unknown };
  let customerResult: { data: unknown; error: unknown };
  const filters: Array<[string, string, unknown]> = [];

  function configureSupabase() {
    filters.length = 0;
    jest.mocked(createAdminSupabaseClient).mockReturnValue({
      from: (table: string) => {
        const query = {
          select: jest.fn(() => query),
          eq: jest.fn((field: string, value: unknown) => { filters.push([table, field, value]); return query; }),
          maybeSingle: jest.fn(async () => (table === 'org_orders_mst' ? orderResult : customerResult)),
        };
        return query;
      },
    } as unknown as ReturnType<typeof createAdminSupabaseClient>);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    orderResult = { data: { customer_id: 'customer-a' }, error: null };
    customerResult = { data: { id: 'customer-a', preferences: {}, is_active: true, rec_status: 1 }, error: null };
    configureSupabase();
  });

  it('is not applicable without an order source — no customer, no DB call', async () => {
    const result = await resolveCustomerDispatchConsent('tenant-a', 'email', 'staff_notice', null);
    expect(result).toEqual({ applicable: false, allowed: true });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it('is not applicable when the order has no tenant customer (EMAIL auth-user fallback stays unaffected)', async () => {
    orderResult = { data: { customer_id: null }, error: null };
    const result = await resolveCustomerDispatchConsent('tenant-a', 'email', 'order', 'order-a');
    expect(result).toEqual({ applicable: false, allowed: true });
  });

  it('allows a customer who never touched the preference (no behavior change for the common case)', async () => {
    customerResult = { data: { id: 'customer-a', preferences: {}, is_active: true, rec_status: 1 }, error: null };
    const result = await resolveCustomerDispatchConsent('tenant-a', 'email', 'order', 'order-a');
    expect(result).toEqual({ applicable: true, allowed: true });
  });

  it('allows a customer who explicitly opted in', async () => {
    customerResult = { data: { id: 'customer-a', preferences: { notifications: { sms: true } }, is_active: true, rec_status: 1 }, error: null };
    const result = await resolveCustomerDispatchConsent('tenant-a', 'sms', 'order', 'order-a');
    expect(result).toEqual({ applicable: true, allowed: true });
  });

  it('blocks only the channel the customer explicitly opted out of', async () => {
    customerResult = { data: { id: 'customer-a', preferences: { notifications: { email: false, sms: true } }, is_active: true, rec_status: 1 }, error: null };
    const blockedEmail = await resolveCustomerDispatchConsent('tenant-a', 'email', 'order', 'order-a');
    expect(blockedEmail).toEqual({ applicable: true, allowed: false, retryable: false, reason: 'Customer has opted out of email notifications' });

    const allowedSms = await resolveCustomerDispatchConsent('tenant-a', 'sms', 'order', 'order-a');
    expect(allowedSms).toEqual({ applicable: true, allowed: true });
  });

  it('blocks an inactive or soft-deleted customer', async () => {
    customerResult = { data: { id: 'customer-a', preferences: {}, is_active: false, rec_status: 1 }, error: null };
    const result = await resolveCustomerDispatchConsent('tenant-a', 'email', 'order', 'order-a');
    expect(result).toMatchObject({ applicable: true, allowed: false, retryable: false });
  });

  it('keeps order/customer lookup failures retryable instead of permanently blocking', async () => {
    orderResult = { data: null, error: { message: 'db unavailable' } };
    const result = await resolveCustomerDispatchConsent('tenant-a', 'email', 'order', 'order-a');
    expect(result).toMatchObject({ applicable: true, allowed: false, retryable: true });
  });

  it('filters every query by the exact tenant_org_id — never another tenant', async () => {
    await resolveCustomerDispatchConsent('tenant-a', 'email', 'order', 'order-a');
    const tenantFilters = filters.filter(([, field]) => field === 'tenant_org_id');
    expect(tenantFilters.length).toBeGreaterThanOrEqual(2);
    expect(tenantFilters.every(([, , value]) => value === 'tenant-a')).toBe(true);
  });
});

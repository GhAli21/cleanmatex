import { resolveWhatsAppCustomerEligibility } from '@lib/notifications/whatsapp-customer-eligibility';

jest.mock('@lib/supabase/server', () => ({ createAdminSupabaseClient: jest.fn() }));
jest.mock('@lib/services/customers.service', () => ({
  normalizePhone: (phone: string) => {
    const normalized = phone.replace(/\s/g, '');
    return { normalized, isValid: /^\+\d{10,15}$/.test(normalized) };
  },
}));

import { createAdminSupabaseClient } from '@lib/supabase/server';

describe('WhatsApp tenant customer eligibility', () => {
  const customer = {
    id: 'customer-a', phone: '+96890123456', is_active: true, rec_status: 1,
    preferences: { notifications: { whatsapp: true } },
  };

  function configure(orderResponse: unknown, customerResponse: unknown) {
    const orderQuery = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue(orderResponse) };
    const customerQuery = { select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), maybeSingle: jest.fn().mockResolvedValue(customerResponse) };
    const from = jest.fn((table: string) => table === 'org_orders_mst' ? orderQuery : customerQuery);
    jest.mocked(createAdminSupabaseClient).mockReturnValue({ from } as unknown as ReturnType<typeof createAdminSupabaseClient>);
    return { from, orderQuery, customerQuery };
  }

  beforeEach(() => jest.clearAllMocks());

  it('authorizes only the tenant customer phone with explicit tenant filters on both lookups', async () => {
    const queries = configure({ data: { customer_id: 'customer-a' }, error: null }, { data: { ...customer, phone: 'whatsapp:+968 90123456' }, error: null });
    await expect(resolveWhatsAppCustomerEligibility('tenant-a', 'order', 'order-a')).resolves.toEqual({
      allowed: true, recipientAddress: '+96890123456', customerId: 'customer-a',
    });
    expect(queries.orderQuery.eq).toHaveBeenCalledWith('tenant_org_id', 'tenant-a');
    expect(queries.orderQuery.eq).toHaveBeenCalledWith('id', 'order-a');
    expect(queries.customerQuery.eq).toHaveBeenCalledWith('tenant_org_id', 'tenant-a');
    expect(queries.customerQuery.eq).toHaveBeenCalledWith('id', 'customer-a');
  });

  it.each([null, {}, [], 'malformed', { notifications: null }, { notifications: [] }, { notifications: { whatsapp: false } }, { notifications: { whatsapp: 'true' } }, { notifications: { whatsapp: 1 } }])(
    'fails closed for missing, false or malformed consent: %p', async (preferences) => {
      configure({ data: { customer_id: 'customer-a' }, error: null }, { data: { ...customer, preferences }, error: null });
      await expect(resolveWhatsAppCustomerEligibility('tenant-a', 'order', 'order-a')).resolves.toMatchObject({ allowed: false, retryable: false });
    },
  );

  it.each([null, { ...customer, is_active: false }, { ...customer, rec_status: 0 }, { ...customer, phone: null }, { ...customer, phone: 'invalid' }])(
    'blocks missing/inactive customers and invalid phones: %p', async (data) => {
      configure({ data: { customer_id: 'customer-a' }, error: null }, { data, error: null });
      await expect(resolveWhatsAppCustomerEligibility('tenant-a', 'order', 'order-a')).resolves.toMatchObject({ allowed: false, retryable: false });
    },
  );

  it('does not borrow another tenant/customer when source order is missing', async () => {
    const queries = configure({ data: null, error: null }, { data: customer, error: null });
    await expect(resolveWhatsAppCustomerEligibility('tenant-b', 'order', 'order-a')).resolves.toMatchObject({ allowed: false, retryable: false });
    expect(queries.from).not.toHaveBeenCalledWith('org_customers_mst');
  });

  it('requires an order source and does not use staff consent', async () => {
    await expect(resolveWhatsAppCustomerEligibility('tenant-a', 'user', 'staff-a')).resolves.toMatchObject({ allowed: false, retryable: false });
    expect(createAdminSupabaseClient).not.toHaveBeenCalled();
  });

  it('re-reads consent so revocation after enqueue blocks a later dispatch', async () => {
    const queries = configure({ data: { customer_id: 'customer-a' }, error: null }, { data: customer, error: null });
    expect((await resolveWhatsAppCustomerEligibility('tenant-a', 'order', 'order-a')).allowed).toBe(true);
    queries.customerQuery.maybeSingle.mockResolvedValue({ data: { ...customer, preferences: { notifications: { whatsapp: false } } }, error: null });
    expect((await resolveWhatsAppCustomerEligibility('tenant-a', 'order', 'order-a')).allowed).toBe(false);
    expect(queries.customerQuery.maybeSingle).toHaveBeenCalledTimes(2);
  });

  it.each(['order', 'customer'])('retains %s lookup errors as retryable', async (failedLookup) => {
    configure(
      failedLookup === 'order' ? { data: null, error: { message: 'unavailable' } } : { data: { customer_id: 'customer-a' }, error: null },
      { data: null, error: { message: 'unavailable' } },
    );
    await expect(resolveWhatsAppCustomerEligibility('tenant-a', 'order', 'order-a')).resolves.toMatchObject({ allowed: false, retryable: true });
  });
});

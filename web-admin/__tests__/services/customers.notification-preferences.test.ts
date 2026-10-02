/** Tenant preference updates must preserve profile data and other notification choices. */
import { updateCustomer } from '@/lib/services/customers.service';
import { createClient } from '@/lib/supabase/server';
import type { CustomerUpdateRequest } from '@/lib/types/customer';

jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/db/tenant-context', () => ({ getTenantIdFromSession: jest.fn() }));
jest.mock('@/lib/services/tenant-settings.service', () => ({ createTenantSettingsService: jest.fn() }));
jest.mock('@/lib/services/credit-limit-plan-cap.service', () => ({ getCreditLimitPlanCap: jest.fn(), capCreditLimitToPlan: jest.fn() }));
jest.mock('@/lib/utils/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() } }));

function makeQuery(data: Record<string, unknown> | null, error: { message: string } | null = null) {
  const query = {
    select: jest.fn(), eq: jest.fn(), update: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue({ data, error }),
    single: jest.fn().mockResolvedValue({ data, error }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.update.mockReturnValue(query);
  return query;
}

describe('customer notification preferences', () => {
  const tenantId = 'tenant-a';
  const customerId = 'customer-a';
  const previous = { folding: 'fold', fragrance: 'rose', notifications: { email: true, sms: false, whatsapp: false } };
  let read: ReturnType<typeof makeQuery>;
  let write: ReturnType<typeof makeQuery>;
  const from = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    from.mockReset();
    read = makeQuery({ preferences: previous });
    write = makeQuery({ id: customerId, first_name: 'Test', name: 'Test Customer', preferences: previous });
    from.mockReturnValueOnce(read).mockReturnValueOnce(write);
    jest.mocked(createClient).mockResolvedValue({
      from,
      auth: { getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'staff-a', user_metadata: { tenant_org_id: tenantId } } } }) },
      rpc: jest.fn().mockResolvedValue({ data: [{ tenant_id: tenantId, user_role: 'admin' }], error: null }),
    } as unknown as Awaited<ReturnType<typeof createClient>>);
  });

  it('persists opt-in without rewriting names or other preferences', async () => {
    await updateCustomer(customerId, { preferences: { notifications: { whatsapp: true } } });
    expect(read.eq).toHaveBeenCalledWith('tenant_org_id', tenantId);
    expect(read.eq).toHaveBeenCalledWith('id', customerId);
    expect(write.eq).toHaveBeenCalledWith('tenant_org_id', tenantId);
    expect(write.eq).toHaveBeenCalledWith('id', customerId);
    const payload = write.update.mock.calls[0][0];
    expect(payload.preferences).toEqual({ ...previous, notifications: { ...previous.notifications, whatsapp: true } });
    expect(payload.updated_by).toBe('staff-a');
    expect(payload).not.toHaveProperty('first_name');
    expect(payload).not.toHaveProperty('name');
    expect(from.mock.calls.every(([table]) => table === 'org_customers_mst')).toBe(true);
  });

  it('persists revocation while preserving other channel choices', async () => {
    await updateCustomer(customerId, { preferences: { notifications: { whatsapp: false } } });
    expect(write.update.mock.calls[0][0].preferences).toEqual(previous);
  });

  it('cannot update a customer unavailable in the authenticated tenant', async () => {
    read.maybeSingle.mockResolvedValue({ data: null, error: null });
    await expect(updateCustomer(customerId, { preferences: { notifications: { whatsapp: true } } })).rejects.toThrow('access denied');
    expect(write.update).not.toHaveBeenCalled();
  });

  it('does not grant opt-in when a string is supplied instead of a boolean', async () => {
    const updates = { preferences: { notifications: { whatsapp: 'true' } } } as unknown as CustomerUpdateRequest;
    await expect(updateCustomer(customerId, updates)).rejects.toThrow('must be a boolean');
    expect(from).not.toHaveBeenCalled();
  });

  it('rejects malformed preferences without a database write', async () => {
    const updates = { preferences: null } as unknown as CustomerUpdateRequest;
    await expect(updateCustomer(customerId, updates)).rejects.toThrow('must be an object');
    expect(from).not.toHaveBeenCalled();
  });

  it('surfaces a failed preference write', async () => {
    write.single.mockResolvedValue({ data: null, error: { message: 'write denied' } });
    await expect(updateCustomer(customerId, { preferences: { notifications: { whatsapp: true } } })).rejects.toThrow('access denied');
  });
});

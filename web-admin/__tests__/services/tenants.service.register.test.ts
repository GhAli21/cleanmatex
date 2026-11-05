/**
 * registerTenant signup lifecycle (decision A-31, migration 0678):
 * insert as 'creating', finish as 'trial', roll back only a 'creating' tenant.
 */

type Call = { table: string; op: string; payload?: unknown; filters: Array<[string, unknown]> };

let calls: Call[];
let results: Record<string, { data: unknown; error: unknown }>;

function chain(table: string, op: string, payload?: unknown) {
  const call: Call = { table, op, payload, filters: [] };
  calls.push(call);
  const key = `${table}.${op}`;
  const result = () => Promise.resolve(results[key] ?? { data: null, error: null });
  const builder: Record<string, unknown> = {
    eq: (col: string, val: unknown) => {
      call.filters.push([col, val]);
      return builder;
    },
    neq: () => builder,
    select: () => builder,
    single: result,
    then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => result().then(resolve, reject),
  };
  return builder;
}

const signUp = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(async () => ({
    from: (table: string) => ({
      select: () => chain(table, 'select'),
      insert: (payload: unknown) => chain(table, 'insert', payload),
      update: (payload: unknown) => chain(table, 'update', payload),
      delete: () => chain(table, 'delete'),
    }),
    auth: { signUp: (...args: unknown[]) => signUp(...args) },
  })),
}));
jest.mock('@/lib/db/tenant-context', () => ({ getTenantIdFromSession: jest.fn() }));

import { registerTenant, TENANT_SIGNUP_STATUS, TENANT_TRIAL_STATUS } from '@/lib/services/tenants.service';

const request = {
  businessName: 'Test Laundry',
  slug: 'test-laundry',
  email: 'test@laundry.com',
  phone: '+96890123456',
  country: 'OM',
  currency: 'OMR',
  timezone: 'Asia/Muscat',
  language: 'en',
  adminUser: { email: 'admin@test.com', password: 'Test123!@#', displayName: 'Admin' },
} as unknown as Parameters<typeof registerTenant>[0];

const TENANT = { id: 't-1', status: 'creating' };

beforeEach(() => {
  calls = [];
  results = {
    'org_tenants_mst.select': { data: null, error: { code: 'PGRST116' } },
    'org_tenants_mst.insert': { data: TENANT, error: null },
    'org_pln_subscriptions_mst.insert': { data: { id: 's-1' }, error: null },
    'org_tenants_mst.update': { data: [{ id: 't-1' }], error: null },
    'org_tenants_mst.delete': { data: null, error: null },
  };
  signUp.mockReset().mockResolvedValue({
    data: { user: { id: 'u-1', email: 'admin@test.com' }, session: { access_token: 'tok' } },
    error: null,
  });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

const find = (table: string, op: string) => calls.filter((c) => c.table === table && c.op === op);

describe('registerTenant signup lifecycle (A-31)', () => {
  it('inserts the tenant as creating and moves it to trial when signup finishes', async () => {
    const res = await registerTenant(request);

    expect(find('org_tenants_mst', 'insert')[0].payload).toMatchObject({ status: TENANT_SIGNUP_STATUS });
    const update = find('org_tenants_mst', 'update')[0];
    expect(update.payload).toEqual({ status: TENANT_TRIAL_STATUS });
    expect(update.filters).toEqual([
      ['id', 't-1'],
      ['status', 'creating'],
    ]);
    expect(res.tenant.status).toBe('trial');
    expect(find('org_tenants_mst', 'delete')).toHaveLength(0);
  });

  it('rolls back only a creating tenant when the subscription fails (no app-side counter delete)', async () => {
    results['org_pln_subscriptions_mst.insert'] = { data: null, error: { message: 'boom' } };

    await expect(registerTenant(request)).rejects.toThrow('Failed to create subscription');

    const del = find('org_tenants_mst', 'delete');
    expect(del).toHaveLength(1);
    expect(del[0].filters).toEqual([
      ['id', 't-1'],
      ['status', 'creating'],
    ]);
    expect(find('org_tenants_mst', 'update')).toHaveLength(0);
    expect(calls.some((c) => c.table === 'org_doc_seq_mst')).toBe(false);
  });

  it('rolls back subscription and creating tenant when the admin user fails', async () => {
    signUp.mockResolvedValueOnce({ data: { user: null }, error: { message: 'exists' } });

    await expect(registerTenant(request)).rejects.toThrow('Failed to create admin user');

    expect(find('org_pln_subscriptions_mst', 'delete')).toHaveLength(1);
    expect(find('org_tenants_mst', 'delete')[0].filters).toContainEqual(['status', 'creating']);
  });

  it('keeps the original error when the DB refuses the rollback delete', async () => {
    results['org_pln_subscriptions_mst.insert'] = { data: null, error: { message: 'boom' } };
    results['org_tenants_mst.delete'] = { data: null, error: { message: 'TENANT_HARD_DELETE_BLOCKED: ...' } };

    await expect(registerTenant(request)).rejects.toThrow('Failed to create subscription');
  });

  it('does not fail a finished signup when the status flip changes no row; reports creating', async () => {
    results['org_tenants_mst.update'] = { data: [], error: null };

    const res = await registerTenant(request);

    expect(res.tenant.status).toBe('creating');
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("still 'creating'"), 'no row updated');
  });
});

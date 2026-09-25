/**
 * Unit tests for the Tenant Guard (lib/db/tenant-guard.ts).
 *
 * Uses the real generated Prisma datamodel (Prisma.dmmf) so model scoping is
 * verified against the actual schema, not a hand-written fixture.
 *
 * @jest-environment node
 */

import {
  checkTenantGuard,
  evaluateTenantScope,
  getTenantGuardViolations,
  isTenantScopedModel,
  resetTenantGuardViolations,
  TenantGuardViolationError,
  withTenantGuardBypass,
} from '@/lib/db/tenant-guard';
import { withTenantContextSync, withTenantContext } from '@/lib/db/tenant-context';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const ORDER = '33333333-3333-3333-3333-333333333333';

const ORIGINAL_MODE = process.env.TENANT_GUARD_MODE;

beforeEach(() => {
  resetTenantGuardViolations();
  jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  jest.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  process.env.TENANT_GUARD_MODE = ORIGINAL_MODE;
  jest.restoreAllMocks();
});

describe('scoped-model catalog', () => {
  it('scopes every model with tenant_org_id, plus org_tenants_mst on id', () => {
    expect(isTenantScopedModel('org_orders_mst')).toBe(true);
    expect(isTenantScopedModel('org_tenants_mst')).toBe(true);
    expect(isTenantScopedModel('sys_currency_cd')).toBe(false);
  });
});

describe('evaluateTenantScope — where operations', () => {
  const ev = (op: string, args: unknown, ctx: string | null = null) =>
    evaluateTenantScope('org_orders_mst', op, args, ctx);

  it.each(['findUnique', 'findFirst', 'findMany', 'count', 'update', 'updateMany', 'delete', 'deleteMany'])(
    '%s without tenant_org_id is MISSING_TENANT_FILTER',
    (op) => {
      expect(ev(op, { where: { id: ORDER } })?.reason).toBe('MISSING_TENANT_FILTER');
    }
  );

  it('findMany with no args at all is flagged', () => {
    expect(ev('findMany', undefined)?.reason).toBe('MISSING_TENANT_FILTER');
  });

  it('accepts top-level, equals, in, AND and compound-unique forms', () => {
    expect(ev('findFirst', { where: { id: ORDER, tenant_org_id: A } })).toBeNull();
    expect(ev('findMany', { where: { tenant_org_id: { equals: A } } })).toBeNull();
    expect(ev('findMany', { where: { tenant_org_id: { in: [A] } } })).toBeNull();
    expect(ev('findMany', { where: { AND: [{ status: 'x' }, { tenant_org_id: A }] } })).toBeNull();
    expect(ev('findMany', { where: { AND: { tenant_org_id: A } } })).toBeNull();
    expect(ev('findUnique', { where: { id_tenant_org_id: { id: ORDER, tenant_org_id: A } } })).toBeNull();
    expect(ev('findUnique', { where: { tenant_org_id_order_no: { tenant_org_id: A, order_no: 'X' } } })).toBeNull();
  });

  it('OR is scoped only when every branch is scoped', () => {
    expect(ev('findMany', { where: { OR: [{ tenant_org_id: A }, { tenant_org_id: A, id: ORDER }] } })).toBeNull();
    expect(ev('findMany', { where: { OR: [{ tenant_org_id: A }, { id: ORDER }] } })?.reason).toBe(
      'MISSING_TENANT_FILTER'
    );
  });

  it('NOT, notIn, empty in and undefined never count as scoping', () => {
    expect(ev('findMany', { where: { NOT: { tenant_org_id: A } } })).not.toBeNull();
    expect(ev('findMany', { where: { tenant_org_id: { not: A } } })).not.toBeNull();
    expect(ev('findMany', { where: { tenant_org_id: { in: [] } } })).not.toBeNull();
    expect(ev('findMany', { where: { tenant_org_id: undefined } })).not.toBeNull();
  });

  it('flags TENANT_MISMATCH when the query names another tenant than the context', () => {
    expect(ev('findFirst', { where: { tenant_org_id: B } }, A)?.reason).toBe('TENANT_MISMATCH');
    expect(ev('findMany', { where: { tenant_org_id: { in: [A, B] } } }, A)?.reason).toBe('TENANT_MISMATCH');
    expect(ev('findFirst', { where: { tenant_org_id: A } }, A)).toBeNull();
  });

  it('flags an update that moves a row into another tenant', () => {
    expect(ev('update', { where: { id: ORDER, tenant_org_id: A }, data: { tenant_org_id: B } }, A)?.reason).toBe(
      'TENANT_MISMATCH'
    );
  });
});

describe('evaluateTenantScope — create / upsert', () => {
  const ev = (op: string, args: unknown, ctx: string | null = null) =>
    evaluateTenantScope('org_orders_mst', op, args, ctx);

  it('create needs tenant_org_id in data (column or direct tenant relation connect)', () => {
    expect(ev('create', { data: { order_no: 'X' } })?.reason).toBe('MISSING_TENANT_FILTER');
    expect(ev('create', { data: { tenant_org_id: A } })).toBeNull();
    expect(ev('create', { data: { org_tenants_mst: { connect: { id: A } } } })).toBeNull();
  });

  it('a composite relation connect (branch) does not count as a tenant', () => {
    expect(ev('create', { data: { org_branches_mst: { connect: { id: ORDER } } } })?.reason).toBe(
      'MISSING_TENANT_FILTER'
    );
  });

  it('createMany needs tenant_org_id on every row', () => {
    expect(ev('createMany', { data: [{ tenant_org_id: A }, { order_no: 'X' }] })?.reason).toBe('MISSING_TENANT_FILTER');
    expect(ev('createMany', { data: [{ tenant_org_id: A }, { tenant_org_id: A }] })).toBeNull();
    expect(ev('createMany', { data: [{ tenant_org_id: A }, { tenant_org_id: B }] }, A)?.reason).toBe('TENANT_MISMATCH');
  });

  it('upsert needs both where and create scoped', () => {
    expect(ev('upsert', { where: { id: ORDER }, create: { tenant_org_id: A }, update: {} })).not.toBeNull();
    expect(
      ev('upsert', { where: { id_tenant_org_id: { id: ORDER, tenant_org_id: A } }, create: { tenant_org_id: A }, update: {} })
    ).toBeNull();
  });

  it('unknown operations are treated as unscoped', () => {
    expect(ev('someFutureOp', { where: { tenant_org_id: A } })?.reason).toBe('MISSING_TENANT_FILTER');
  });
});

describe('org_tenants_mst is guarded on id', () => {
  it('requires id and checks it against context', () => {
    expect(evaluateTenantScope('org_tenants_mst', 'findMany', {}, null)?.reason).toBe('MISSING_TENANT_FILTER');
    expect(evaluateTenantScope('org_tenants_mst', 'findUnique', { where: { id: A } }, A)).toBeNull();
    expect(evaluateTenantScope('org_tenants_mst', 'findUnique', { where: { id: B } }, A)?.reason).toBe(
      'TENANT_MISMATCH'
    );
  });
});

describe('global models are never checked', () => {
  it('sys_* without tenant_org_id passes', () => {
    expect(evaluateTenantScope('sys_currency_cd', 'findMany', {}, A)).toBeNull();
  });
});

describe('checkTenantGuard — modes and bypass', () => {
  it('log mode records a deduplicated violation and does not throw', () => {
    process.env.TENANT_GUARD_MODE = 'log';
    for (let i = 0; i < 3; i++) checkTenantGuard('org_orders_mst', 'findMany', {});
    const v = getTenantGuardViolations();
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ model: 'org_orders_mst', operation: 'findMany', reason: 'MISSING_TENANT_FILTER' });
    expect(v[0].callsite).toContain('tenant-guard.test');
  });

  it('enforce mode throws TenantGuardViolationError', () => {
    process.env.TENANT_GUARD_MODE = 'enforce';
    expect(() => checkTenantGuard('org_orders_mst', 'findUnique', { where: { id: ORDER } })).toThrow(
      TenantGuardViolationError
    );
  });

  it('enforce mode rejects a cross-tenant filter under tenant context', () => {
    process.env.TENANT_GUARD_MODE = 'enforce';
    expect(() =>
      withTenantContextSync(A, () => checkTenantGuard('org_orders_mst', 'findFirst', { where: { tenant_org_id: B } }))
    ).toThrow(/TENANT_MISMATCH/);
  });

  it('enforce mode lets scoped queries through', () => {
    process.env.TENANT_GUARD_MODE = 'enforce';
    expect(() => checkTenantGuard('org_orders_mst', 'findFirst', { where: { tenant_org_id: A } })).not.toThrow();
  });

  it('withTenantGuardBypass skips the check and requires a reason', async () => {
    process.env.TENANT_GUARD_MODE = 'enforce';
    await expect(
      withTenantGuardBypass('unit-test-sweep', async () => checkTenantGuard('org_orders_mst', 'findMany', {}))
    ).resolves.toBeUndefined();
    expect(() => withTenantGuardBypass('  ', async () => undefined)).toThrow(/requires a reason/);
    expect(getTenantGuardViolations()).toHaveLength(0);
  });

  it('bypass does not leak out of its async scope', async () => {
    process.env.TENANT_GUARD_MODE = 'enforce';
    await withTenantGuardBypass('scoped', async () => undefined);
    await withTenantContext(A, async () => {
      expect(() => checkTenantGuard('org_orders_mst', 'findMany', {})).toThrow(TenantGuardViolationError);
    });
  });
});

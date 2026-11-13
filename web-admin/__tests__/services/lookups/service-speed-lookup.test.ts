/** @jest-environment node */

/**
 * Service Speeds D5: the speed lookup lists every active speed and marks what
 * this organization offers — STANDARD always, any other speed
 * only with an active rule in effect today. The rule read filters the tenant.
 */
jest.mock('@/lib/supabase/server', () => ({ createClient: jest.fn() }));

import { listActiveServiceSpeeds } from '@/lib/services/lookups/service-speed-lookup.service';
import type { LookupSupabaseClient } from '@/lib/services/lookups/types';

const filters: Record<string, [string, unknown][]> = {};

/** A query builder that records `.eq` filters and resolves to the table's rows. */
function client(tables: Record<string, unknown>): LookupSupabaseClient {
  return {
    from(table: string) {
      filters[table] = [];
      const result = { data: tables[table], error: null };
      const builder = {
        select: () => builder,
        eq: (col: string, val: unknown) => { filters[table].push([col, val]); return builder; },
        order: () => Promise.resolve(result),
        maybeSingle: () => Promise.resolve(result),
        then: (ok: (r: typeof result) => unknown) => Promise.resolve(result).then(ok),
      };
      return builder;
    },
  } as unknown as LookupSupabaseClient;
}

const speed = (code: string, display_order: number) => ({
  code, name: code, name2: null, description: null, description2: null, display_order, is_default: code === 'STANDARD', default_turnaround_unit: null,
});
/** An organization-wide rule: every branch, category and product. */
const WIDE = { branch_id: null, service_category_code: null, product_id: null };
const speeds = [speed('ECONOMY', 1), speed('STANDARD', 2), speed('NEXT_DAY', 3), speed('EXPRESS', 4), speed('URGENT', 5)];

beforeEach(() => { for (const k of Object.keys(filters)) delete filters[k]; });

describe('listActiveServiceSpeeds', () => {
  it('marks STANDARD and ruled speeds as offered; an expired rule does not count', async () => {
    const result = await listActiveServiceSpeeds(client({
      sys_service_speed_cd: speeds,
      org_speed_price_rules_cf: [
        { service_speed: 'NEXT_DAY', effective_from: '2026-01-01', effective_to: null, ...WIDE },
        { service_speed: 'URGENT', effective_from: '2020-01-01', effective_to: '2020-12-31', ...WIDE },
      ],
      org_tenants_mst: { timezone: 'Asia/Muscat' },
    }), 'tenant-1');
    expect(result.data?.map((s) => [s.code, s.is_offered])).toEqual([
      ['ECONOMY', false], ['STANDARD', true], ['NEXT_DAY', true], ['EXPRESS', false], ['URGENT', false],
    ]);
    expect(filters.org_speed_price_rules_cf).toContainEqual(['tenant_org_id', 'tenant-1']);
  });

  it('offered_scope: an organization-wide rule is ALL; a branch, category or product rule is only SOME (review B9)', async () => {
    const result = await listActiveServiceSpeeds(client({
      sys_service_speed_cd: speeds,
      org_speed_price_rules_cf: [
        { service_speed: 'NEXT_DAY', effective_from: '2026-01-01', effective_to: null, ...WIDE, branch_id: 'b1' },
        { service_speed: 'EXPRESS', effective_from: '2026-01-01', effective_to: null, ...WIDE, product_id: 'p1' },
        { service_speed: 'EXPRESS', effective_from: '2026-01-01', effective_to: null, ...WIDE },
        { service_speed: 'ECONOMY', effective_from: '2026-01-01', effective_to: null, ...WIDE, service_category_code: 'LAUNDRY' },
      ],
      org_tenants_mst: { timezone: 'Asia/Muscat' },
    }), 'tenant-1');
    expect(result.data?.map((s) => [s.code, s.offered_scope])).toEqual([
      ['ECONOMY', 'SOME'], ['STANDARD', 'ALL'], ['NEXT_DAY', 'SOME'], ['EXPRESS', 'ALL'], ['URGENT', null],
    ]);
  });

  it('without a tenant every speed is offered and no rule is read', async () => {
    const result = await listActiveServiceSpeeds(client({ sys_service_speed_cd: speeds }));
    expect(result.data?.every((s) => s.is_offered)).toBe(true);
    expect(filters.org_speed_price_rules_cf).toBeUndefined();
  });
});

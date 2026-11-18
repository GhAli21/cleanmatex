/**
 * Public tenant profiles (slug resolve, mobile customer tenant list) take the
 * brand colour from the theme resolver, not from org_tenants_mst columns.
 */
const getTenantPrimaryColor = jest.fn()
jest.mock('@/lib/services/ui-theme.service', () => ({ getTenantPrimaryColor: (id: string) => getTenantPrimaryColor(id) }))
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))

const selects: string[] = []
function chain(result: unknown) {
  const q: Record<string, unknown> = {}
  for (const m of ['eq', 'in', 'order', 'or', 'ilike', 'limit']) q[m] = () => q
  q.select = (cols: string) => { selects.push(cols); return q }
  q.single = async () => result
  q.maybeSingle = async () => result
  q.then = (resolve: (v: unknown) => void) => resolve(result)
  return q
}
const tables: Record<string, unknown> = {}
const client = { from: (t: string) => chain(tables[t]) }
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => client,
  createAdminSupabaseClient: () => client,
}))

import { resolveTenantBySlug } from '@/lib/services/tenant-resolve.service'

beforeEach(() => {
  selects.length = 0
  getTenantPrimaryColor.mockReset()
})

test('slug resolve: colour from the resolver, old column not read', async () => {
  tables.org_tenants_mst = { data: { id: 't1', name: 'Shop', name2: null, logo_url: null, slug: 'shop' }, error: null }
  getTenantPrimaryColor.mockResolvedValue('#2563EB')
  const profile = await resolveTenantBySlug('shop')
  expect(profile?.primaryColor).toBe('#2563EB')
  expect(getTenantPrimaryColor).toHaveBeenCalledWith('t1')
  expect(selects.join(' ')).not.toContain('brand_color')
})

test('slug resolve still works when the theme cannot be read', async () => {
  tables.org_tenants_mst = { data: { id: 't1', name: 'Shop', name2: null, logo_url: null, slug: 'shop' }, error: null }
  getTenantPrimaryColor.mockResolvedValue(null)
  expect((await resolveTenantBySlug('shop'))?.tenantOrgId).toBe('t1')
})

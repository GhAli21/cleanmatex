import { describe, it, expect, beforeEach } from '@jest/globals'

// Singleton mock client — shared across all createClient() calls so test
// mock setup (mockResolvedValueOnce etc.) actually reaches the service code.
const mockClient = {
  auth: { getUser: jest.fn(async () => ({ data: { user: { id: 'u1' } } })) },
  rpc: jest.fn(async () => ({ data: [{ tenant_id: 't1', user_role: 'admin' }], error: null })),
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(async () => ({ data: null, error: null })),
  single: jest.fn(async () => ({ data: null, error: null })),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => mockClient),
}))

jest.mock('@/lib/db/tenant-context', () => ({
  getTenantIdFromSession: jest.fn().mockResolvedValue('t1'),
}))

import {
  getServiceCategories,
  enableCategories,
  createProduct,
  searchProducts,
} from '@/lib/services/catalog.service'

describe('catalog.service', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Re-apply stable return-this implementations cleared by clearAllMocks
    mockClient.from.mockReturnThis()
    mockClient.select.mockReturnThis()
    mockClient.eq.mockReturnThis()
    mockClient.order.mockReturnThis()
    mockClient.in.mockReturnThis()
    mockClient.limit.mockReturnThis()
    mockClient.insert.mockReturnThis()
    mockClient.update.mockReturnThis()
    mockClient.delete.mockReturnThis()
    mockClient.range.mockReturnThis()
  })

  it('loads global categories', async () => {
    mockClient.order.mockResolvedValueOnce({ data: [{ service_category_code: 'LAUNDRY' }], error: null })

    const data = await getServiceCategories()
    expect(Array.isArray(data)).toBe(true)
  })

  it('enables categories replaces existing', async () => {
    // delete chain: from().delete().eq() — eq is the terminal method
    mockClient.eq.mockResolvedValueOnce({ error: null })
    // insert chain: from().insert() — insert is terminal (no .select().single() here)
    mockClient.insert.mockResolvedValueOnce({ error: null })

    await expect(enableCategories({ categoryCodes: ['LAUNDRY', 'DRY_CLEAN'] })).resolves.toBeUndefined()
  })

  it('creates product', async () => {
    // generateProductCode() calls maybeSingle first (no existing products → generates PROD-00001)
    mockClient.maybeSingle.mockResolvedValueOnce({ data: null, error: null })
    // category enabled check: from().select().eq().eq().maybeSingle() — second maybeSingle call
    mockClient.maybeSingle.mockResolvedValueOnce({ data: { ok: true }, error: null })
    // insert product: from().insert().select().single()
    mockClient.single.mockResolvedValueOnce({ data: { id: 'p1', product_code: 'PROD-00001' }, error: null })

    const prod = await createProduct({
      service_category_code: 'LAUNDRY',
      product_name: 'Shirt',
      product_unit: 'piece',
      default_sell_price: 1.0,
    } as any)
    expect(prod.id).toBeDefined()
  })

  it('searches products returns structure', async () => {
    mockClient.range.mockResolvedValueOnce({ data: [], error: null, count: 0 })

    const result = await searchProducts({ page: 1, limit: 10 })
    expect(result).toEqual(expect.objectContaining({ products: expect.any(Array), total: 0 }))
  })
})

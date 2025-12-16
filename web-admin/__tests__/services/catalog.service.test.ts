import { describe, it, expect, vi, beforeEach } from '@jest/globals'

vi.mock('@/lib/supabase/server', () => {
  return {
    createClient: vi.fn(async () => ({
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
      rpc: vi.fn(async () => ({ data: [{ tenant_id: 't1', user_role: 'admin' }], error: null })),
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn(async () => ({ data: null })),
      single: vi.fn(async () => ({ data: null })),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      range: vi.fn().mockReturnThis(),
    })),
  }
})

import {
  getServiceCategories,
  enableCategories,
  createProduct,
  searchProducts,
} from '@/lib/services/catalog.service'

describe('catalog.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('loads global categories', async () => {
    const { createClient } = await import('@/lib/supabase/server') as any
    const client = await createClient()
    client.select.mockReturnThis()
    client.eq.mockReturnThis()
    client.order.mockResolvedValueOnce({ data: [{ service_category_code: 'LAUNDRY' }], error: null })

    const data = await getServiceCategories()
    expect(Array.isArray(data)).toBe(true)
  })

  it('enables categories replaces existing', async () => {
    const { createClient } = await import('@/lib/supabase/server') as any
    const client = await createClient()
    client.delete.mockResolvedValueOnce({ error: null })
    client.insert.mockResolvedValueOnce({ error: null })

    await expect(enableCategories({ categoryCodes: ['LAUNDRY', 'DRY_CLEAN'] })).resolves.toBeUndefined()
  })

  it('creates product', async () => {
    const { createClient } = await import('@/lib/supabase/server') as any
    const client = await createClient()
    // category enabled
    client.maybeSingle.mockResolvedValueOnce({ data: { ok: true }, error: null })
    // insert product
    client.select.mockReturnThis()
    client.single.mockResolvedValueOnce({ data: { id: 'p1', product_code: 'PROD-00001' }, error: null })

    const prod = await createProduct({
      service_category_code: 'LAUNDRY',
      product_name: 'Shirt',
      product_unit: 'piece',
      default_sell_price: 1.0,
    } as any)
    expect(prod.id).toBeDefined()
  })

  it('searches products returns structure', async () => {
    const { createClient } = await import('@/lib/supabase/server') as any
    const client = await createClient()
    client.select.mockReturnThis()
    client.eq.mockReturnThis()
    client.order.mockReturnThis()
    client.range.mockResolvedValueOnce({ data: [], error: null, count: 0 })

    const result = await searchProducts({ page: 1, limit: 10 })
    expect(result).toEqual(expect.objectContaining({ products: expect.any(Array), total: 0 }))
  })
})

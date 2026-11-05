/**
 * @jest-environment node
 *
 * HFC P4 (A-46/A-47): GET/PUT /api/v1/settings/label-printing. settings:read / settings:update, CSRF on PUT,
 * branch must belong to the tenant, no feature-flag gate, no caching.
 */
import { NextRequest, NextResponse } from 'next/server'

const getConfig = jest.fn()
const saveOverrides = jest.fn()
const perms: string[] = []
let denied = false
let csrfBad = false
let branchFound = true

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: (perm: string) => async () => {
    perms.push(perm)
    return denied ? NextResponse.json({ perm }, { status: 403 }) : { tenantId: 't1', userId: 'u1' }
  },
}))
jest.mock('@/lib/middleware/csrf', () => ({
  validateCSRF: async () => (csrfBad ? NextResponse.json({ error: 'csrf' }, { status: 403 }) : null),
}))
jest.mock('@/lib/middleware/rate-limit', () => ({ checkAPIRateLimitTenant: async () => null }))
jest.mock('@/lib/utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => {
    const b: Record<string, unknown> = {}
    for (const m of ['from', 'select', 'eq']) b[m] = () => b
    b.maybeSingle = async () => ({ data: branchFound ? { id: 'b' } : null, error: null })
    return b
  },
}))
jest.mock('@/lib/services/labels/label-printing-config.service', () => ({
  LabelPrintingConfigService: {
    getConfig: (...a: unknown[]) => getConfig(...a),
    saveOverrides: (...a: unknown[]) => saveOverrides(...a),
  },
}))

import { GET, PUT } from '@/app/api/v1/settings/label-printing/route'

const B = '0b000000-0000-4000-8000-000000000001'
const CFG = { systemDefaults: [], tenantOverrides: [], branchOverrides: [], effective: [] }
const row = { labelType: 'RECEIPT', sizeCode: null, showQr: null, showCustomerName: null, showOrderBarcode: true, copies: null }
const get = (qs = '') => GET(new NextRequest(`http://x/api/v1/settings/label-printing${qs}`))
const put = (body: unknown) =>
  PUT(new NextRequest('http://x/api/v1/settings/label-printing', { method: 'PUT', body: JSON.stringify(body) }))

beforeEach(() => {
  perms.length = 0
  denied = false
  csrfBad = false
  branchFound = true
  getConfig.mockReset().mockResolvedValue(CFG)
  saveOverrides.mockReset().mockResolvedValue(undefined)
})

describe('GET', () => {
  it('returns the tenant-wide config with settings:read and no-store', async () => {
    const res = await get()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(await res.json()).toEqual({ success: true, data: CFG })
    expect(perms).toEqual(['settings:read'])
    expect(getConfig).toHaveBeenCalledWith(expect.anything(), 't1', null)
  })

  it('scopes to a branch of the tenant; 404 for a foreign branch, 400 for a bad id', async () => {
    await get(`?branchId=${B}`)
    expect(getConfig).toHaveBeenLastCalledWith(expect.anything(), 't1', B)
    branchFound = false
    expect((await get(`?branchId=${B}`)).status).toBe(404)
    expect((await get('?branchId=nope')).status).toBe(400)
  })

  it('returns the permission response when denied, and 500 LOAD_FAILED on errors', async () => {
    denied = true
    expect((await get()).status).toBe(403)
    denied = false
    getConfig.mockRejectedValue(new Error('db'))
    const res = await get()
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('LOAD_FAILED')
  })
})

describe('PUT', () => {
  it('saves with settings:update and returns the new config', async () => {
    const res = await put({ branchId: B, rows: [row] })
    expect(res.status).toBe(200)
    expect(perms).toEqual(['settings:update'])
    expect(saveOverrides).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ tenantId: 't1', branchId: B, userId: 'u1', rows: [row] }))
    expect(getConfig).toHaveBeenCalledWith(expect.anything(), 't1', B)
  })

  it('checks CSRF first', async () => {
    csrfBad = true
    expect((await put({ branchId: null, rows: [row] })).status).toBe(403)
    expect(perms).toEqual([])
    expect(saveOverrides).not.toHaveBeenCalled()
  })

  it('rejects an invalid body with 400 and issues; a foreign branch with 404', async () => {
    const res = await put({ branchId: null, rows: [{ ...row, copies: 2 }] })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe('VALIDATION_ERROR')
    expect(body.issues.length).toBeGreaterThan(0)
    branchFound = false
    expect((await put({ branchId: B, rows: [row] })).status).toBe(404)
    expect(saveOverrides).not.toHaveBeenCalled()
  })

  it('returns 500 SAVE_FAILED when the save throws', async () => {
    saveOverrides.mockRejectedValue(new Error('db'))
    const res = await put({ branchId: null, rows: [row] })
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe('SAVE_FAILED')
  })
})

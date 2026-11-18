/** @jest-environment node */
/**
 * GET/PUT /api/v1/me/ui-preferences: a person reads and changes only their own
 * three appearance columns on sys_users_mst (no permission needed, CSRF on PUT).
 */
import { NextRequest } from 'next/server'

const update = jest.fn()
const findFirst = jest.fn()
const getAuthContext = jest.fn()
const validateCSRF = jest.fn()
jest.mock('@/lib/db/prisma', () => ({ prisma: { sys_users_mst: { update: (a: unknown) => update(a), findFirst: (a: unknown) => findFirst(a) } } }))
jest.mock('@/lib/middleware/require-permission', () => ({ getAuthContext: () => getAuthContext() }))
jest.mock('@/lib/middleware/csrf', () => ({ validateCSRF: () => validateCSRF() }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))

import { GET, PUT } from '@/app/api/v1/me/ui-preferences/route'

const req = (method: string, body?: unknown) =>
  new NextRequest('http://localhost/api/v1/me/ui-preferences', { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })

beforeEach(() => {
  jest.clearAllMocks()
  getAuthContext.mockResolvedValue({ userId: 'user-y', tenantId: 't1' })
  validateCSRF.mockResolvedValue(null)
  findFirst.mockResolvedValue({ ui_color_mode: 'SYSTEM', ui_density: null, ui_font_scale: 'MD' })
  update.mockResolvedValue({ ui_color_mode: 'SYSTEM', ui_density: 'COMPACT', ui_font_scale: 'LG' })
})

test('GET returns the caller\'s own preferences', async () => {
  const res = await GET(req('GET'))
  expect(res.status).toBe(200)
  expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'user-y' } }))
  expect((await res.json()).data).toEqual({ ui_color_mode: 'SYSTEM', ui_density: null, ui_font_scale: 'MD' })
})

test('PUT updates only the caller\'s row and only the three columns', async () => {
  const res = await PUT(req('PUT', { ui_density: 'COMPACT', ui_font_scale: 'LG' }))
  expect(res.status).toBe(200)
  expect(update).toHaveBeenCalledWith({
    where: { id: 'user-y' },
    data: expect.objectContaining({ ui_density: 'COMPACT', ui_font_scale: 'LG', updated_by: 'user-y' }),
    select: { ui_color_mode: true, ui_density: true, ui_font_scale: true },
  })
  const data = update.mock.calls[0][0].data
  expect(Object.keys(data).filter((k) => !k.startsWith('updated_')).sort()).toEqual(['ui_density', 'ui_font_scale'])
})

test('another user\'s id, an email or a bad value is refused before any write', async () => {
  for (const body of [{ id: 'user-x', ui_font_scale: 'LG' }, { email: 'a@b.c' }, { ui_density: 'compact' }, { ui_font_scale: 'XL' }]) {
    expect((await PUT(req('PUT', body))).status).toBe(400)
  }
  expect(update).not.toHaveBeenCalled()
})

test('signed out → 401; bad CSRF → refused', async () => {
  getAuthContext.mockRejectedValue(new Error('Unauthorized'))
  expect((await GET(req('GET'))).status).toBe(401)
  expect((await PUT(req('PUT', { ui_font_scale: 'LG' }))).status).toBe(401)
  validateCSRF.mockResolvedValue(new Response(null, { status: 403 }))
  expect((await PUT(req('PUT', { ui_font_scale: 'LG' }))).status).toBe(403)
  expect(update).not.toHaveBeenCalled()
})

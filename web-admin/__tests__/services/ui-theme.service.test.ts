jest.mock('server-only', () => ({}))
jest.mock('react', () => ({ ...jest.requireActual('react'), cache: (fn: unknown) => fn }))

const prisma = {
  sys_ui_theme_cd: { findMany: jest.fn() },
  sys_ui_radius_cd: { findMany: jest.fn() },
  sys_ui_font_pair_cd: { findMany: jest.fn() },
  org_tenant_ui_theme_dtl: { findFirst: jest.fn() },
  sys_users_mst: { findFirst: jest.fn() },
  org_tenants_mst: { findFirst: jest.fn() },
}
const getSessionIdentity = jest.fn()
const getFeatureFlags = jest.fn()

jest.mock('@/lib/db/prisma', () => ({ get prisma() { return prisma } }))
jest.mock('@/lib/db/tenant-context', () => ({ getSessionIdentity: () => getSessionIdentity() }))
jest.mock('@/lib/services/feature-flags.service', () => ({ getFeatureFlags: (id: string) => getFeatureFlags(id) }))
jest.mock('@/lib/utils/logger', () => ({ logger: { error: jest.fn() } }))

import { DEFAULT_THEME, getRequestTheme, getTenantPrimaryColor, writeLastBrandCookie } from '@/lib/services/ui-theme.service'
import { LAST_BRAND_COOKIE } from '@/lib/theme/last-brand'

beforeEach(() => {
  jest.clearAllMocks()
  prisma.sys_ui_theme_cd.findMany.mockResolvedValue([])
  prisma.sys_ui_radius_cd.findMany.mockResolvedValue([])
  prisma.sys_ui_font_pair_cd.findMany.mockResolvedValue([])
  prisma.org_tenant_ui_theme_dtl.findFirst.mockResolvedValue(null)
  prisma.sys_users_mst.findFirst.mockResolvedValue({ ui_density: 'COMPACT', ui_font_scale: 'LG' })
  prisma.org_tenants_mst.findFirst.mockResolvedValue({ logo_url: null })
  getFeatureFlags.mockResolvedValue({ custom_branding: false, white_label: false })
})

test("reads only the session Organization's theme in use and the session person's preferences", async () => {
  getSessionIdentity.mockResolvedValue({ tenantId: 'tenant-a', userId: 'user-y' })
  const theme = await getRequestTheme()
  expect(prisma.org_tenant_ui_theme_dtl.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { tenant_org_id: 'tenant-a', is_active: true, rec_status: 1 } }),
  )
  expect(prisma.sys_users_mst.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'user-y' } }))
  expect(getFeatureFlags).toHaveBeenCalledWith('tenant-a')
  expect([theme.density, theme.fontScale]).toEqual(['COMPACT', 'LG'])
})

test('signed out: built-in STANDARD, no database read', async () => {
  getSessionIdentity.mockResolvedValue(null)
  expect(await getRequestTheme()).toEqual(DEFAULT_THEME)
  expect(prisma.org_tenant_ui_theme_dtl.findFirst).not.toHaveBeenCalled()
  expect(prisma.sys_users_mst.findFirst).not.toHaveBeenCalled()
})

test("sign-in writes the Organization's public brand as an HttpOnly cookie", async () => {
  prisma.org_tenants_mst.findFirst.mockResolvedValue({ logo_url: 'https://x.supabase.co/storage/v1/object/public/a.webp' })
  const set = jest.fn()
  await writeLastBrandCookie({ set }, 'tenant-a')
  expect(prisma.org_tenants_mst.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'tenant-a' } }))
  expect(prisma.org_tenant_ui_theme_dtl.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { tenant_org_id: 'tenant-a', is_active: true, rec_status: 1 } }),
  )
  expect(set).toHaveBeenCalledWith(
    LAST_BRAND_COOKIE,
    expect.stringContaining('"logo":"https://x.supabase.co/storage/v1/object/public/a.webp"'),
    expect.objectContaining({ httpOnly: true, path: '/', sameSite: 'lax' }),
  )
  expect(set.mock.calls[0][1]).not.toContain('tenant-a')
})

test('a failure while writing the brand cookie never fails sign-in', async () => {
  prisma.org_tenants_mst.findFirst.mockRejectedValue(new Error('db down'))
  const set = jest.fn()
  await expect(writeLastBrandCookie({ set }, 'tenant-a')).resolves.toBeUndefined()
  expect(set).not.toHaveBeenCalled()
})

test("public callers get the Organization's resolved primary colour, or null on failure", async () => {
  prisma.sys_ui_theme_cd.findMany.mockResolvedValue([
    { code: 'STANDARD', brand_color_primary: '#0AB6D8', brand_color_secondary: '#0E2A47', ui_radius_code: 'STANDARD', ui_font_pair_code: 'STANDARD', is_default: true },
  ])
  expect(await getTenantPrimaryColor('tenant-a')).toBe('#0AB6D8')
  expect(prisma.org_tenant_ui_theme_dtl.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({ where: { tenant_org_id: 'tenant-a', is_active: true, rec_status: 1 } }),
  )
  prisma.sys_ui_theme_cd.findMany.mockRejectedValue(new Error('db down'))
  expect(await getTenantPrimaryColor('tenant-a')).toBeNull()
})

test('a failed read never fails the page', async () => {
  getSessionIdentity.mockResolvedValue({ tenantId: 'tenant-a', userId: 'user-y' })
  prisma.sys_ui_theme_cd.findMany.mockRejectedValue(new Error('db down'))
  expect(await getRequestTheme()).toEqual(DEFAULT_THEME)
})

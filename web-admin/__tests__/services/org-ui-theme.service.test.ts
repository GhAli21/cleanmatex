jest.mock('server-only', () => ({}))

const tx = {
  org_tenant_ui_theme_dtl: { findFirst: jest.fn(), findMany: jest.fn(), create: jest.fn(), updateMany: jest.fn() },
  sys_ui_theme_cd: { count: jest.fn() },
  sys_ui_radius_cd: { count: jest.fn() },
  sys_ui_font_pair_cd: { count: jest.fn() },
}
const prisma = { ...tx, $transaction: jest.fn(async (fn: (t: typeof tx) => unknown) => fn(tx)) }
const getFeatureFlags = jest.fn()
jest.mock('@/lib/db/prisma', () => ({ get prisma() { return prisma } }))
jest.mock('@/lib/services/feature-flags.service', () => ({ getFeatureFlags: (id: string) => getFeatureFlags(id) }))

import {
  activateOrgTheme,
  createOrgTheme,
  deleteOrgTheme,
  listOrgThemes,
  updateOrgTheme,
  UiThemeError,
} from '@/lib/services/org-ui-theme.service'

const actor = { userId: 'u1', userInfo: 'jest' }
const T = 'tenant-a'

beforeEach(() => {
  jest.clearAllMocks()
  getFeatureFlags.mockResolvedValue({ custom_branding: true, white_label: true })
  tx.sys_ui_theme_cd.count.mockResolvedValue(1)
  tx.sys_ui_radius_cd.count.mockResolvedValue(1)
  tx.sys_ui_font_pair_cd.count.mockResolvedValue(1)
  tx.org_tenant_ui_theme_dtl.findFirst.mockResolvedValue({ id: 'th1', is_active: false })
  tx.org_tenant_ui_theme_dtl.updateMany.mockResolvedValue({ count: 1 })
  tx.org_tenant_ui_theme_dtl.create.mockResolvedValue({ id: 'new' })
  tx.org_tenant_ui_theme_dtl.findMany.mockResolvedValue([])
})

/** Every org_tenant_ui_theme_dtl call carries the tenant in its where (or data for create). */
function expectTenantOnEveryCall() {
  for (const m of ['findFirst', 'findMany', 'updateMany'] as const) {
    for (const [arg] of tx.org_tenant_ui_theme_dtl[m].mock.calls) expect(arg.where.tenant_org_id).toBe(T)
  }
  for (const [arg] of tx.org_tenant_ui_theme_dtl.create.mock.calls) expect(arg.data.tenant_org_id).toBe(T)
}

test('list returns only live rows of the Organization', async () => {
  await listOrgThemes(T)
  expect(tx.org_tenant_ui_theme_dtl.findMany.mock.calls[0][0].where).toEqual({ tenant_org_id: T, rec_status: 1 })
})

test('create stores the theme for the session Organization, not in use', async () => {
  await createOrgTheme(T, { theme_name: 'Main', ui_theme_code: 'OCEAN' }, actor)
  const data = tx.org_tenant_ui_theme_dtl.create.mock.calls[0][0].data
  expect(data).toMatchObject({ tenant_org_id: T, theme_name: 'Main', ui_theme_code: 'OCEAN', is_active: false, created_by: 'u1' })
  expectTenantOnEveryCall()
})

test('overrides need custom_branding; the app name needs white_label (checked on the server)', async () => {
  getFeatureFlags.mockResolvedValue({ custom_branding: false, white_label: false })
  await expect(createOrgTheme(T, { theme_name: 'X', ui_theme_code: 'OCEAN', brand_color_primary: '#FACC15' }, actor))
    .rejects.toMatchObject({ code: 'FEATURE_NOT_IN_PLAN' })
  await expect(updateOrgTheme(T, 'th1', { theme_name: 'X', ui_theme_code: 'OCEAN', app_display_name: 'Sparkle' }, actor))
    .rejects.toMatchObject({ code: 'FEATURE_NOT_IN_PLAN' })
  // Picking an HQ theme and a default density is allowed on every plan.
  await expect(createOrgTheme(T, { theme_name: 'X', ui_theme_code: 'OCEAN', default_ui_density: 'COMPACT' }, actor)).resolves.toBeDefined()
})

test('an unknown or inactive HQ code is refused', async () => {
  tx.sys_ui_theme_cd.count.mockResolvedValue(0)
  await expect(createOrgTheme(T, { theme_name: 'X', ui_theme_code: 'NOPE' }, actor)).rejects.toMatchObject({ code: 'INVALID_CATALOG_CODE' })
})

test('activate switches in one transaction: old off, new on', async () => {
  await activateOrgTheme(T, 'th1', actor)
  expect(prisma.$transaction).toHaveBeenCalledTimes(1)
  const [off, on] = tx.org_tenant_ui_theme_dtl.updateMany.mock.calls.map((c) => c[0])
  expect(off).toMatchObject({ where: { tenant_org_id: T, is_active: true, rec_status: 1 }, data: { is_active: false } })
  expect(on).toMatchObject({ where: { id: 'th1', tenant_org_id: T, rec_status: 1 }, data: { is_active: true } })
  expectTenantOnEveryCall()
})

test("another Organization's theme id is NOT_FOUND for activate, update and delete", async () => {
  tx.org_tenant_ui_theme_dtl.findFirst.mockResolvedValue(null)
  await expect(activateOrgTheme(T, 'other-tenants-theme', actor)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  await expect(deleteOrgTheme(T, 'other-tenants-theme', actor)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  tx.org_tenant_ui_theme_dtl.updateMany.mockResolvedValue({ count: 0 })
  await expect(updateOrgTheme(T, 'other-tenants-theme', { theme_name: 'X', ui_theme_code: 'OCEAN' }, actor))
    .rejects.toMatchObject({ code: 'NOT_FOUND' })
  expectTenantOnEveryCall()
})

test('the theme in use cannot be deleted; others are soft-deleted', async () => {
  tx.org_tenant_ui_theme_dtl.findFirst.mockResolvedValue({ id: 'th1', is_active: true })
  await expect(deleteOrgTheme(T, 'th1', actor)).rejects.toBeInstanceOf(UiThemeError)
  await expect(deleteOrgTheme(T, 'th1', actor)).rejects.toMatchObject({ code: 'THEME_IN_USE' })

  tx.org_tenant_ui_theme_dtl.findFirst.mockResolvedValue({ id: 'th2', is_active: false })
  await deleteOrgTheme(T, 'th2', actor)
  const del = tx.org_tenant_ui_theme_dtl.updateMany.mock.calls.at(-1)![0]
  expect(del).toMatchObject({ where: { id: 'th2', tenant_org_id: T, is_active: false }, data: { rec_status: 0, deleted_by: 'u1' } })
})

// PR-07 review I1: a delete that commits between the read and the switch must not leave zero themes in use.
test('activate rolls back with NOT_FOUND when the target is gone at the switch', async () => {
  tx.org_tenant_ui_theme_dtl.updateMany
    .mockResolvedValueOnce({ count: 1 }) // old theme off
    .mockResolvedValueOnce({ count: 0 }) // target deleted meanwhile
  await expect(activateOrgTheme(T, 'th1', actor)).rejects.toMatchObject({ code: 'NOT_FOUND' })
})

// PR-07 minor M1: the loser of a concurrent switch hits the one-in-use unique index; that is a 409, not a 500.
test('activate maps the unique-index refusal of a concurrent switch to SWITCH_CONFLICT', async () => {
  tx.org_tenant_ui_theme_dtl.findFirst.mockResolvedValueOnce({ id: 'th1' })
  tx.org_tenant_ui_theme_dtl.updateMany
    .mockResolvedValueOnce({ count: 0 })
    .mockRejectedValueOnce(Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }))
  await expect(activateOrgTheme(T, 'th1', actor)).rejects.toMatchObject({ code: 'SWITCH_CONFLICT' })
})

// PR-07 minor M2: a theme HQ has since deactivated stays editable while the codes it stores are unchanged.
test('an edit that keeps the stored HQ codes is not refused when HQ has deactivated them', async () => {
  tx.sys_ui_theme_cd.count.mockResolvedValue(0)
  tx.sys_ui_radius_cd.count.mockResolvedValue(0)
  tx.sys_ui_font_pair_cd.count.mockResolvedValue(0)
  tx.org_tenant_ui_theme_dtl.findFirst.mockResolvedValue({ ui_theme_code: 'OLD', ui_radius_code: 'SOFT', ui_font_pair_code: 'SERIF' })
  tx.org_tenant_ui_theme_dtl.updateMany.mockResolvedValue({ count: 1 })
  await expect(updateOrgTheme(T, 'th1', { theme_name: 'Renamed', ui_theme_code: 'OLD', ui_radius_code: 'SOFT', ui_font_pair_code: 'SERIF' }, actor)).resolves.toBeUndefined()
  // Switching to a code that is not offered is still refused.
  await expect(updateOrgTheme(T, 'th1', { theme_name: 'Renamed', ui_theme_code: 'GONE' }, actor)).rejects.toMatchObject({ code: 'INVALID_CATALOG_CODE' })
})

// PR-07 review I2: after a plan downgrade, an edit leaves the stored overrides and app name alone.
test('an update that leaves out plan-gated fields keeps them as stored', async () => {
  getFeatureFlags.mockResolvedValue({ custom_branding: false, white_label: false })
  await updateOrgTheme(T, 'th1', { theme_name: 'Renamed', ui_theme_code: 'OCEAN', default_ui_density: 'COMPACT' }, actor)
  const data = tx.org_tenant_ui_theme_dtl.updateMany.mock.calls[0][0].data
  expect(data).toMatchObject({ theme_name: 'Renamed', default_ui_density: 'COMPACT' })
  for (const k of ['brand_color_primary', 'brand_color_secondary', 'ui_radius_code', 'ui_font_pair_code', 'app_display_name', 'app_display_name2']) {
    expect(data).not.toHaveProperty(k)
  }
})

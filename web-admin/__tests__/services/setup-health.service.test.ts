/**
 * Setup Health service: feature-flag, HQ-only and fix-permission filtering, and summary counts.
 */
const mockQueryRaw = jest.fn()
const mockGetFlags = jest.fn()
const mockHasPermission = jest.fn()

jest.mock('@prisma/client', () => ({
  Prisma: { sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }) },
}))
jest.mock('@/lib/db/prisma', () => ({
  prisma: { $queryRaw: (...args: unknown[]) => mockQueryRaw(...args) },
}))
jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: jest.fn(async (_t: string, fn: () => Promise<unknown>) => fn()),
}))
jest.mock('@/lib/services/feature-flags.service', () => ({
  getFeatureFlags: (...args: unknown[]) => mockGetFlags(...args),
}))
jest.mock('@/lib/services/permission-service-server', () => ({
  hasPermissionServer: (...args: unknown[]) => mockHasPermission(...args),
}))
jest.mock('@/lib/utils/logger', () => ({ logger: { error: jest.fn(), warn: jest.fn() } }))

import { getSetupHealthSummary, listSetupHealth } from '@/lib/services/setup-health/setup-health.service'

function row(over: Record<string, unknown>) {
  return {
    check_code: 'X', domain_code: 'CALENDAR', severity: 'WARNING', status: 'FAIL',
    issue_count: 1, sample_ids: [], details: {}, name: 'n', name2: 'n2',
    description: 'd', description2: 'd2', fix_route: '/dashboard/x', hq_fix_route: null,
    fix_permission: null, feature_flag_key: null, shows_banner: false, is_hq_only: false,
    domain_order: 1, display_order: 1, ...over,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockGetFlags.mockResolvedValue({ erp_lite_readiness_enabled: false })
  mockHasPermission.mockImplementation(async (p: string) => p !== 'settings:organization' && p !== 'setup_health:view')
})

describe('listSetupHealth', () => {
  it('passes the tenant id to the check runner and hides flag-off and HQ-only checks', async () => {
    mockQueryRaw.mockResolvedValue([
      row({ check_code: 'A' }),
      row({ check_code: 'ERP', feature_flag_key: 'erp_lite_readiness_enabled' }),
      row({ check_code: 'HQ', is_hq_only: true }),
    ])
    const items = await listSetupHealth('tenant-1')
    expect(items.map((i) => i.checkCode)).toEqual(['A'])
    expect(mockQueryRaw.mock.calls[0][0].values[0]).toBe('tenant-1')
  })

  it('keeps the fix link only when the user holds the fix permission', async () => {
    mockQueryRaw.mockResolvedValue([
      row({ check_code: 'DENIED', fix_permission: 'settings:organization' }),
      row({ check_code: 'ALLOWED', fix_permission: 'pricing:read' }),
      row({ check_code: 'NO_ROUTE', fix_route: null }),
    ])
    const items = await listSetupHealth('tenant-1')
    expect(Object.fromEntries(items.map((i) => [i.checkCode, i.fixRoute]))).toEqual({
      DENIED: null,
      ALLOWED: '/dashboard/x',
      NO_ROUTE: null,
    })
  })
})

describe('getSetupHealthSummary', () => {
  it('counts failing checks by severity, reports errors, and lists only failing banner blockers', async () => {
    mockQueryRaw.mockResolvedValue([
      row({ check_code: 'B1', severity: 'BLOCKER', shows_banner: true }),
      row({ check_code: 'B2', severity: 'BLOCKER', shows_banner: true, status: 'OK' }),
      row({ check_code: 'W', severity: 'WARNING' }),
      row({ check_code: 'I', severity: 'INFO' }),
      row({ check_code: 'E', status: 'ERROR' }),
    ])
    const s = await getSetupHealthSummary('tenant-1')
    expect(s).toMatchObject({ blockers: 1, warnings: 1, infos: 1, errors: 1, canView: false })
    expect(s.bannerItems.map((i) => i.checkCode)).toEqual(['B1'])
  })
})

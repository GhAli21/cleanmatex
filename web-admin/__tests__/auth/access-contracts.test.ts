import {
  evaluateAccessRequirement,
  evaluatePageAccessContract,
  getPagePermissionCodes,
  hasExplicitPermissionGate,
  matchesRoutePattern,
  type PageAccessContract,
} from '@/lib/auth/access-contracts'

describe('access contracts helpers', () => {
  it('matches exact and dynamic route patterns', () => {
    expect(matchesRoutePattern('/dashboard/orders', '/dashboard/orders')).toBe(true)
    expect(matchesRoutePattern('/dashboard/orders/[id]', '/dashboard/orders/123')).toBe(true)
    expect(
      matchesRoutePattern(
        '/dashboard/ready/[id]/print/[type]',
        '/dashboard/ready/abc/print/thermal'
      )
    ).toBe(true)
    expect(matchesRoutePattern('/dashboard/orders/[id]', '/dashboard/orders')).toBe(false)
  })

  it('supports wildcard and exact permission evaluation', () => {
    const result = evaluateAccessRequirement(
      {
        permissions: ['b2b_contracts:create'],
        requireAllPermissions: true,
      },
      {
        userPermissions: ['b2b_contracts:*'],
        userWorkflowRoles: [],
        userTenantRole: null,
        featureFlags: {},
      }
    )

    expect(result.passed).toBe(true)
  })

  it('supports permission prefixes and tenant role alternatives', () => {
    const result = evaluateAccessRequirement(
      {
        permissions: ['settings:*'],
        permissionPrefixes: ['roles:'],
        tenantRoles: ['admin', 'tenant_admin'],
      },
      {
        userPermissions: ['roles:create'],
        userWorkflowRoles: [],
        userTenantRole: 'operator',
        featureFlags: {},
      }
    )

    expect(result.passed).toBe(true)
  })

  it('treats empty permission contracts as valid when no extra gates exist', () => {
    const result = evaluateAccessRequirement(
      {},
      {
        userPermissions: [],
        userWorkflowRoles: [],
        userTenantRole: null,
        featureFlags: {},
      }
    )

    expect(result.passed).toBe(true)
    expect(hasExplicitPermissionGate({})).toBe(false)
  })

  it('requires feature flags and workflow roles when declared', () => {
    const result = evaluateAccessRequirement(
      {
        featureFlags: ['advanced_analytics'],
        workflowRoles: ['ROLE_QA'],
      },
      {
        userPermissions: [],
        userWorkflowRoles: ['ROLE_QA'],
        userTenantRole: null,
        featureFlags: { advanced_analytics: true },
      }
    )

    expect(result.passed).toBe(true)
  })

  it('evaluates page contracts and lists page permission codes', () => {
    const contract: PageAccessContract = {
      routePattern: '/dashboard/catalog',
      label: 'Catalog & Pricing',
      page: {
        permissions: ['admin:manage'],
        requireAllPermissions: true,
      },
    }

    expect(getPagePermissionCodes(contract)).toEqual(['admin:manage'])
    expect(
      evaluatePageAccessContract(contract, {
        userPermissions: ['admin:manage'],
        userWorkflowRoles: [],
        userTenantRole: 'admin',
        featureFlags: {},
      }).passed
    ).toBe(true)
  })
})

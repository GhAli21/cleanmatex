/**
 * Shared UI access contract types and evaluators.
 *
 * Frontend pages and gated UI actions declare their access requirements in one
 * place so runtime gating, debug UI, docs, and tests can consume the same
 * source of truth.
 */

export interface AccessRequirement {
  permissions?: string[]
  permissionPrefixes?: string[]
  requireAllPermissions?: boolean
  featureFlags?: string[]
  requireAllFeatureFlags?: boolean
  workflowRoles?: string[]
  requireAllWorkflowRoles?: boolean
  tenantRoles?: string[]
  requireAllTenantRoles?: boolean
}

export interface AccessActionContract {
  label: string
  requirement: AccessRequirement
  notes?: string[]
}

export interface PageAccessContract {
  routePattern: string
  label: string
  page: AccessRequirement
  actions?: Record<string, AccessActionContract>
  notes?: string[]
}

export interface AccessEvaluationContext {
  userPermissions: string[]
  userWorkflowRoles: string[]
  userTenantRole: string | null
  featureFlags: Record<string, boolean>
}

export interface AccessEvaluationDetail {
  kind: 'permission' | 'permission_prefix' | 'feature_flag' | 'workflow_role' | 'tenant_role'
  value: string
  passed: boolean
}

export interface AccessEvaluationResult {
  passed: boolean
  details: AccessEvaluationDetail[]
}

function normalizePath(value: string): string {
  if (!value) return '/'
  if (value === '/') return '/'

  return value.endsWith('/') ? value.slice(0, -1) : value
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function matchesRoutePattern(routePattern: string, pathname: string): boolean {
  const normalizedPattern = normalizePath(routePattern)
  const normalizedPathname = normalizePath(pathname)
  const patternSegments = normalizedPattern.split('/').filter(Boolean)
  const regexSegments = patternSegments.map((segment) => {
    if (segment.startsWith('[') && segment.endsWith(']')) {
      return '[^/]+'
    }

    return escapeRegex(segment)
  })
  const routeRegex = new RegExp(`^/${regexSegments.join('/')}$`)

  return routeRegex.test(normalizedPathname)
}

export function matchesPermissionCode(
  requiredPermission: string,
  userPermissions: string[]
): boolean {
  if (userPermissions.includes(requiredPermission)) return true
  if (userPermissions.includes('*:*')) return true

  const [requiredResource] = requiredPermission.split(':')

  return userPermissions.includes(`${requiredResource}:*`)
}

function evaluatePermissionList(
  requirement: AccessRequirement,
  userPermissions: string[]
): AccessEvaluationDetail[] {
  return (requirement.permissions ?? []).map((permissionCode) => ({
    kind: 'permission',
    value: permissionCode,
    passed: matchesPermissionCode(permissionCode, userPermissions),
  }))
}

function evaluatePermissionPrefixes(
  requirement: AccessRequirement,
  userPermissions: string[]
): AccessEvaluationDetail[] {
  return (requirement.permissionPrefixes ?? []).map((permissionPrefix) => ({
    kind: 'permission_prefix',
    value: permissionPrefix,
    passed: userPermissions.some((permissionCode) => permissionCode.startsWith(permissionPrefix)),
  }))
}

function evaluateFeatureFlags(
  requirement: AccessRequirement,
  featureFlags: Record<string, boolean>
): AccessEvaluationDetail[] {
  return (requirement.featureFlags ?? []).map((flagKey) => ({
    kind: 'feature_flag',
    value: flagKey,
    passed: featureFlags[flagKey] === true,
  }))
}

function evaluateWorkflowRoles(
  requirement: AccessRequirement,
  userWorkflowRoles: string[]
): AccessEvaluationDetail[] {
  const hasWorkflowRole = (workflowRole: string) =>
    userWorkflowRoles.includes('ROLE_ADMIN') || userWorkflowRoles.includes(workflowRole)

  return (requirement.workflowRoles ?? []).map((workflowRole) => ({
    kind: 'workflow_role',
    value: workflowRole,
    passed: hasWorkflowRole(workflowRole),
  }))
}

function evaluateTenantRoles(
  requirement: AccessRequirement,
  userTenantRole: string | null
): AccessEvaluationDetail[] {
  const normalizedTenantRole = userTenantRole?.toLowerCase() ?? null

  return (requirement.tenantRoles ?? []).map((tenantRole) => ({
    kind: 'tenant_role',
    value: tenantRole,
    passed: normalizedTenantRole === tenantRole.toLowerCase(),
  }))
}

function reduceDetailGroup(
  details: AccessEvaluationDetail[],
  requireAll = false
): boolean {
  if (details.length === 0) return false

  return requireAll
    ? details.every((detail) => detail.passed)
    : details.some((detail) => detail.passed)
}

export function evaluateAccessRequirement(
  requirement: AccessRequirement | undefined,
  context: AccessEvaluationContext
): AccessEvaluationResult {
  const nextRequirement = requirement ?? {}
  const permissionDetails = evaluatePermissionList(nextRequirement, context.userPermissions)
  const permissionPrefixDetails = evaluatePermissionPrefixes(nextRequirement, context.userPermissions)
  const workflowRoleDetails = evaluateWorkflowRoles(nextRequirement, context.userWorkflowRoles)
  const featureFlagDetails = evaluateFeatureFlags(nextRequirement, context.featureFlags)
  const tenantRoleDetails = evaluateTenantRoles(nextRequirement, context.userTenantRole)

  const permissionPassed = reduceDetailGroup(permissionDetails, nextRequirement.requireAllPermissions)
  const permissionPrefixPassed = reduceDetailGroup(
    permissionPrefixDetails,
    nextRequirement.requireAllPermissions
  )
  const tenantRolePassed = reduceDetailGroup(tenantRoleDetails, nextRequirement.requireAllTenantRoles)

  const baseRequirementExists =
    permissionDetails.length > 0 ||
    permissionPrefixDetails.length > 0 ||
    tenantRoleDetails.length > 0

  const basePassed = baseRequirementExists
    ? permissionPassed || permissionPrefixPassed || tenantRolePassed
    : true

  const featureFlagPassed =
    featureFlagDetails.length === 0 ||
    reduceDetailGroup(featureFlagDetails, nextRequirement.requireAllFeatureFlags)

  const workflowRolePassed =
    workflowRoleDetails.length === 0 ||
    reduceDetailGroup(workflowRoleDetails, nextRequirement.requireAllWorkflowRoles)

  return {
    passed: basePassed && featureFlagPassed && workflowRolePassed,
    details: [
      ...permissionDetails,
      ...permissionPrefixDetails,
      ...tenantRoleDetails,
      ...featureFlagDetails,
      ...workflowRoleDetails,
    ],
  }
}

export function hasExplicitPermissionGate(requirement: AccessRequirement | undefined): boolean {
  const nextRequirement = requirement ?? {}

  return (
    (nextRequirement.permissions?.length ?? 0) > 0 ||
    (nextRequirement.permissionPrefixes?.length ?? 0) > 0 ||
    (nextRequirement.tenantRoles?.length ?? 0) > 0
  )
}

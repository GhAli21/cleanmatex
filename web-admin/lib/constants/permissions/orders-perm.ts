/**
 * Orders module RBAC permission codes (mirror DB `sys_auth_permissions.code`
 * exactly — CLAUDE.md DB-mirror rule; format `resource:action`).
 *
 * Usage rule: API route guards (`requirePermission('orders:read')`) and
 * `*-access.ts` contracts keep STRING LITERALS — the platform-inventory
 * extractor resolves literals only (identifier references break the
 * nav↔contract reconciler; see the catalog-access fix, Remediation Phase 3).
 * Import this registry for typed programmatic use (services, hooks, tests)
 * and as the single reference list when seeding/reviewing role migrations.
 */
export const ORDERS_PERMISSIONS = {
  READ: 'orders:read',
  CREATE: 'orders:create',
  UPDATE: 'orders:update',
  DELETE: 'orders:delete',
  TRANSITION: 'orders:transition',
  COLLECT_PAYMENT: 'orders:collect_payment',
  VERIFY_PAYMENT: 'orders:verify_payment',
  PROCESS_REFUND: 'orders:process_refund',
  APPROVE_REFUND: 'orders:approve_refund',
  CREATE_ADJUSTMENT: 'orders:create_adjustment',
  APPLY_CREDIT: 'orders:apply_credit',
  OVERPAYMENT_ALLOCATE: 'orders:overpayment_allocate',
  VIEW_FINANCIAL_BREAKDOWN: 'orders:view_financial_breakdown',
} as const

export type OrdersPermissionCode =
  (typeof ORDERS_PERMISSIONS)[keyof typeof ORDERS_PERMISSIONS]

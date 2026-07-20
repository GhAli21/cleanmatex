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
  // B27 (§43 permission matrix)
  /** Already seeded/granted pre-B27 — added here for a typed reference (was string-literal-only). */
  DISCOUNT: 'orders:discount',
  REFUNDS_MANUAL_EXCEPTION: 'orders:refunds_manual_exception',
  /** D003 v2 REFUND_AND_REBILL gate — B01 rejected it unconditionally until this shipped. */
  REBILL_AUTHORIZE: 'orders:rebill_authorize',
  /** Reserved for B27's threshold-approval pattern; not yet wired (no threshold config exists). */
  DISCOUNT_THRESHOLD_OVERRIDE: 'orders:discount_threshold_override',
  /** Reserved for B18 (manual order charge line) — not built yet. */
  MANUAL_CHARGE: 'orders:manual_charge',
  /** Reserved for B12 (order amendment after settlement) — not built yet. */
  POST_SETTLEMENT_EDIT: 'orders:post_settlement_edit',
  /** Reserved for B26 (FX/gateway/rate override) — not built yet. */
  RATE_OVERRIDE: 'orders:rate_override',
  /** Already seeded/granted pre-B27 (lib/db/orders.ts addOrderItems) — resource is `pricing`, kept here for the orders-domain grouping. */
  PRICING_OVERRIDE: 'pricing:override',
} as const

export type OrdersPermissionCode =
  (typeof ORDERS_PERMISSIONS)[keyof typeof ORDERS_PERMISSIONS]

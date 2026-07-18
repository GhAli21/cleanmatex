import 'server-only'

import { Decimal } from '@prisma/client/runtime/library'

import { lookupAuditActors, type AuditActorLookupResult } from '@lib/services/audit-actor.service'
import { prisma } from '@lib/db/prisma'
import { withTenantContext } from '@lib/db/tenant-context'
import { CASH_VARIANCE_TOLERANCE } from '@/lib/constants/financial-tolerances'
import { canAccess } from '@/lib/services/feature-flags.service'
import {
  effectiveCashPaymentWhere,
  sumEffectiveCashPayments,
} from '@/lib/services/cash-drawer-cash-facts'
import type {
  CashDrawerActorSummary,
  CashDrawerDetailContext,
  CashDrawerLinkedPaymentRow,
  CashDrawerMovementRow,
  CashDrawerOverviewDetail,
  CashDrawerOverviewListResult,
  CashDrawerOverviewRow,
  CashDrawerPaginatedResult,
  CashDrawerReconciliationSummary,
  CashDrawerSessionDetail,
  CashDrawerSessionLifecycleDetail,
  CashDrawerSessionListResult,
  CashDrawerSessionListRow,
  CashDrawerSessionSummarySnapshot,
  CashDrawerVarianceApproval,
} from '@lib/types/cash-drawer'

function toNumber(value: Decimal | number | string | null | undefined): number {
  if (value == null) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return Number(value)
}

function toIsoString(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

function clampPage(page: number): number {
  return Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
}

function clampPageSize(pageSize: number): number {
  if (!Number.isFinite(pageSize) || pageSize <= 0) return 5
  return Math.floor(pageSize)
}

/**
 * Session close input for the close-session mutation flow.
 */
export interface SessionCloseParams {
  physicalCount: number
  closedBy: string
  notes?: string
}

/**
 * Close-session mutation result used by the existing action and API boundary.
 */
export interface SessionCloseResult {
  session: Awaited<ReturnType<typeof prisma.org_cash_drawer_sessions_mst.findFirstOrThrow>>
  variance: number
  isBalanced: boolean
  /**
   * B16: true when drawer-close v2 is on, a variance threshold is configured on
   * the drawer, and |variance| exceeds it. The session still closes (deferred
   * model) but is flagged pending a supervisor's variance approval.
   */
  varianceApprovalPending: boolean
  /** The absolute variance threshold in effect at close (null = no gate configured). */
  varianceThreshold: number | null
}

/** Stable error codes for the variance-approval action. */
export const VARIANCE_APPROVAL_ERRORS = {
  /** Session is not in a state that requires/permits variance approval. */
  NOT_PENDING_APPROVAL: 'VARIANCE_NOT_PENDING_APPROVAL',
  /** Variance was already approved — approval is single-shot. */
  ALREADY_APPROVED: 'VARIANCE_ALREADY_APPROVED',
  /** Maker/checker violation — the approver cannot be the closer. */
  SELF_APPROVAL_BLOCKED: 'VARIANCE_SELF_APPROVAL_BLOCKED',
  /** A non-empty reason is mandatory for a variance approval. */
  REASON_REQUIRED: 'VARIANCE_REASON_REQUIRED',
} as const;

export type VarianceApprovalErrorCode =
  (typeof VARIANCE_APPROVAL_ERRORS)[keyof typeof VARIANCE_APPROVAL_ERRORS];

/** Typed error so the API/action can map an approval failure to a 4xx + code. */
export class VarianceApprovalError extends Error {
  readonly code: VarianceApprovalErrorCode;
  constructor(code: VarianceApprovalErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'VarianceApprovalError';
    this.code = code;
  }
}

/**
 * B16: derive the variance-approval state of a (closed) session from its
 * persisted columns — no extra status enum value is introduced.
 * @param session a session row exposing the variance columns + difference
 */
export function deriveVarianceApprovalState(session: {
  difference_amount: Decimal | number | null
  variance_threshold_snapshot: Decimal | number | null
  variance_approved_by: string | null
  variance_approved_at: Date | null
  variance_approval_reason: string | null
}): { required: boolean; pending: boolean; approved: boolean } {
  const threshold = session.variance_threshold_snapshot
  const required = threshold != null
  const approved = required && session.variance_approved_by != null
  return { required, pending: required && !approved, approved }
}

/**
 * Backward-compatible drawer + current-session DTO used by existing POS and
 * checkout consumers.
 */
export interface CashDrawerWithCurrentSession {
  id: string
  tenant_org_id: string
  branch_id: string | null
  drawer_code: string
  drawer_name: string
  drawer_name2: string | null
  drawer_type: string
  currency_code: string
  requires_session: boolean
  opening_float_required: boolean
  max_cash_limit: number | null
  assigned_terminal_id: string | null
  is_active: boolean
  rec_status: number
  currentSession: {
    id: string
    session_no: string
    opened_at: string | null
    opening_float_amount: number
  } | null
}

interface DrawerBranchInfo {
  id: string
  branch_name: string | null
  name: string | null
  name2: string | null
}

interface DrawerTerminalInfo {
  id: string
  terminal_name: string | null
  terminal_name2: string | null
  terminal_code: string | null
}

interface SummaryDataBundle {
  session: Awaited<ReturnType<typeof prisma.org_cash_drawer_sessions_mst.findFirstOrThrow>>
  movements: Awaited<ReturnType<typeof prisma.org_cash_drawer_movements_dtl.findMany>>
  payments: Awaited<ReturnType<typeof prisma.org_order_payments_dtl.findMany>>
}

interface CashDrawerPaymentRowSelection {
  id: string
  order_id: string
  payment_method_code: string
  payment_method_name_snapshot: string | null
  payment_status: string | null
  amount: Decimal
  currency_code: string
  tendered_amount: Decimal | null
  change_returned_amount: Decimal | null
  paid_at: Date | null
  created_at: Date
  payment_terminal_id: string | null
  received_by: string
  org_payment_terminals_cf?: {
    terminal_name: string | null
    terminal_code: string | null
  } | null
}

function getBranchDisplayName(branch: DrawerBranchInfo | null | undefined): string | null {
  return branch?.name ?? branch?.branch_name ?? null
}

function mapActorToSummary(actor: AuditActorLookupResult | undefined): CashDrawerActorSummary | null {
  if (!actor) return null

  return {
    id: actor.id,
    displayName: actor.displayName ?? null,
    email: actor.email ?? null,
    phone: actor.phone ?? null,
  }
}

async function resolveActorMap(tenantId: string, actorIds: Array<string | null | undefined>) {
  const uniqueActorIds = [...new Set(actorIds.filter((value): value is string => typeof value === 'string' && value.trim().length > 0))]

  if (uniqueActorIds.length === 0) {
    return new Map<string, CashDrawerActorSummary>()
  }

  const actors = await lookupAuditActors(tenantId, uniqueActorIds)

  return new Map(
    actors.map((actor) => [
      actor.id,
      {
        id: actor.id,
        displayName: actor.displayName ?? actor.email ?? actor.id,
        email: actor.email ?? null,
        phone: actor.phone ?? null,
      } satisfies CashDrawerActorSummary,
    ]),
  )
}

function getActorSummary(actorMap: Map<string, CashDrawerActorSummary>, actorId: string | null | undefined) {
  if (!actorId) return null
  return actorMap.get(actorId) ?? { id: actorId, displayName: actorId, email: null, phone: null }
}

async function loadDrawerBranches(tenantId: string, branchIds: string[]) {
  if (branchIds.length === 0) {
    return new Map<string, DrawerBranchInfo>()
  }

  const branches = await withTenantContext(tenantId, () =>
    prisma.org_branches_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        id: { in: branchIds },
      },
      select: {
        id: true,
        branch_name: true,
        name: true,
        name2: true,
      },
    }),
  )

  return new Map(branches.map((branch) => [branch.id, branch]))
}

async function loadDrawerTerminals(tenantId: string, terminalIds: string[]) {
  if (terminalIds.length === 0) {
    return new Map<string, DrawerTerminalInfo>()
  }

  const terminals = await withTenantContext(tenantId, () =>
    prisma.org_payment_terminals_cf.findMany({
      where: {
        tenant_org_id: tenantId,
        id: { in: terminalIds },
      },
      select: {
        id: true,
        terminal_name: true,
        terminal_name2: true,
        terminal_code: true,
      },
    }),
  )

  return new Map(terminals.map((terminal) => [terminal.id, terminal]))
}

/**
 * B16: resolve the `order_fin_drawer_close_v2` tenant flag once per request.
 * When enabled, expected-cash math counts only active, COMPLETED-set,
 * cash-family payments (M2 fix); when disabled, the legacy unfiltered aggregate
 * is used so the change ships as a controlled, reversible rollout.
 * @param tenantId tenant resolved server-side from the authenticated session
 */
async function isDrawerCloseV2Enabled(tenantId: string): Promise<boolean> {
  return canAccess(tenantId, 'order_fin_drawer_close_v2')
}

function buildSessionReconciliation(
  session: SummaryDataBundle['session'],
  movements: SummaryDataBundle['movements'],
  payments: SummaryDataBundle['payments'],
  effectiveCashOnly = false,
): CashDrawerReconciliationSummary {
  const totalCashIn = movements
    .filter((movement) => movement.direction === 'IN')
    .reduce((sum, movement) => sum + toNumber(movement.amount), 0)
  const totalCashOut = movements
    .filter((movement) => movement.direction === 'OUT')
    .reduce((sum, movement) => sum + toNumber(movement.amount), 0)
  // B16: cashCollected counts only effective cash facts when drawer-close v2 is
  // on (active + COMPLETED-set + cash-family); otherwise the legacy raw sum.
  const totalPayments = effectiveCashOnly
    ? sumEffectiveCashPayments(payments)
    : payments.reduce((sum, payment) => sum + toNumber(payment.amount), 0)
  const openingFloat = toNumber(session.opening_float_amount)
  const movementNet = totalCashIn - totalCashOut
  const countedCash = session.counted_cash_amount == null ? null : toNumber(session.counted_cash_amount)
  const expectedCash = openingFloat + totalPayments + movementNet
  const variance = countedCash == null ? null : countedCash - expectedCash

  return {
    openingFloat,
    cashCollected: totalPayments,
    movementCashIn: totalCashIn,
    movementCashOut: totalCashOut,
    movementNet,
    expectedCash,
    countedCash,
    variance,
    paymentCount: payments.length,
    movementCount: movements.length,
    currencyCode: session.currency_code ?? null,
  }
}

function buildSessionSnapshot(
  session: {
    id: string
    session_no: string
    status: string
    opened_at: Date | null
    closed_at: Date | null
    opening_float_amount: Decimal | null
    expected_cash_amount: Decimal | null
    counted_cash_amount: Decimal | null
    difference_amount: Decimal | null
  },
  paymentCount: number,
  movementCount: number,
  paymentTotal: number,
  movementCashIn: number,
  movementCashOut: number,
): CashDrawerSessionSummarySnapshot {
  const derivedExpectedCash =
    toNumber(session.opening_float_amount) + paymentTotal + movementCashIn - movementCashOut
  const expectedCashAmount =
    session.expected_cash_amount == null ? derivedExpectedCash : toNumber(session.expected_cash_amount)
  const countedCashAmount =
    session.counted_cash_amount == null ? null : toNumber(session.counted_cash_amount)
  const differenceAmount =
    session.difference_amount == null && countedCashAmount != null
      ? countedCashAmount - expectedCashAmount
      : session.difference_amount == null
        ? null
        : toNumber(session.difference_amount)

  return {
    id: session.id,
    sessionNo: session.session_no,
    status: session.status,
    openedAt: toIsoString(session.opened_at),
    closedAt: toIsoString(session.closed_at),
    openingFloatAmount: toNumber(session.opening_float_amount),
    expectedCashAmount,
    countedCashAmount,
    differenceAmount,
    paymentCount,
    movementCount,
  }
}

/**
 * B16: build the session-detail variance-approval block from the persisted
 * columns (migration 0407). No new status enum value — required/pending/
 * approved are derived, never stored redundantly.
 * @param session session row exposing the variance columns
 * @param actorMap resolved actor summaries keyed by user id
 */
function buildVarianceApprovalDetail(
  session: {
    variance_threshold_snapshot: Decimal | number | null
    variance_approved_by: string | null
    variance_approved_at: Date | null
    variance_approval_reason: string | null
  },
  actorMap: Map<string, CashDrawerActorSummary>,
): CashDrawerVarianceApproval {
  const required = session.variance_threshold_snapshot != null
  const approved = required && session.variance_approved_by != null

  return {
    required,
    pending: required && !approved,
    approved,
    thresholdSnapshot:
      session.variance_threshold_snapshot == null ? null : toNumber(session.variance_threshold_snapshot),
    approvedBy: getActorSummary(actorMap, session.variance_approved_by),
    approvedAt: toIsoString(session.variance_approved_at),
    reason: session.variance_approval_reason,
  }
}

function buildDrawerContext(
  drawer: {
    id: string
    drawer_code: string
    drawer_name: string
    drawer_name2: string | null
    drawer_type: string
    branch_id: string | null
    currency_code: string
    requires_session: boolean
    opening_float_required: boolean
    max_cash_limit: Decimal | null
    assigned_terminal_id: string | null
  },
  branch: DrawerBranchInfo | undefined,
  terminal: DrawerTerminalInfo | undefined,
): CashDrawerDetailContext {
  return {
    id: drawer.id,
    drawerCode: drawer.drawer_code,
    drawerName: drawer.drawer_name,
    drawerName2: drawer.drawer_name2,
    drawerType: drawer.drawer_type,
    branchId: drawer.branch_id,
    branchName: getBranchDisplayName(branch),
    branchName2: branch?.name2 ?? null,
    currencyCode: drawer.currency_code,
    requiresSession: drawer.requires_session,
    openingFloatRequired: drawer.opening_float_required,
    maxCashLimit: drawer.max_cash_limit == null ? null : toNumber(drawer.max_cash_limit),
    assignedTerminalId: drawer.assigned_terminal_id,
    assignedTerminalName: terminal?.terminal_name ?? terminal?.terminal_name2 ?? null,
    assignedTerminalCode: terminal?.terminal_code ?? null,
  }
}

function mapMovementRow(
  movement: Awaited<ReturnType<typeof prisma.org_cash_drawer_movements_dtl.findMany>>[number],
  actorMap: Map<string, CashDrawerActorSummary>,
): CashDrawerMovementRow {
  return {
    id: movement.id,
    movementType: movement.movement_type,
    direction: movement.direction,
    amount: toNumber(movement.amount),
    currencyCode: movement.currency_code,
    orderId: movement.order_id,
    orderPaymentId: movement.order_payment_id,
    refundId: movement.refund_id,
    referenceNo: movement.reference_no,
    reason: movement.reason,
    performedAt: toIsoString(movement.performed_at),
    performedBy: getActorSummary(actorMap, movement.performed_by),
  }
}

function mapPaymentRow(
  payment: CashDrawerPaymentRowSelection,
  actorMap: Map<string, CashDrawerActorSummary>,
): CashDrawerLinkedPaymentRow {
  return {
    id: payment.id,
    orderId: payment.order_id,
    paymentMethodCode: payment.payment_method_code,
    paymentMethodNameSnapshot: payment.payment_method_name_snapshot,
    paymentStatus: payment.payment_status,
    amount: toNumber(payment.amount),
    currencyCode: payment.currency_code,
    tenderedAmount: payment.tendered_amount == null ? null : toNumber(payment.tendered_amount),
    changeReturnedAmount:
      payment.change_returned_amount == null ? null : toNumber(payment.change_returned_amount),
    paidAt: toIsoString(payment.paid_at ?? payment.created_at),
    terminalId: payment.payment_terminal_id,
    terminalName: payment.org_payment_terminals_cf?.terminal_name ?? null,
    terminalCode: payment.org_payment_terminals_cf?.terminal_code ?? null,
    receivedBy: getActorSummary(actorMap, payment.received_by),
  }
}

async function loadMovementCountsBySession(tenantId: string, sessionIds: string[]) {
  if (sessionIds.length === 0) {
    return new Map<string, number>()
  }

  const rows = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_movements_dtl.groupBy({
      by: ['cash_drawer_session_id'],
      where: {
        tenant_org_id: tenantId,
        cash_drawer_session_id: { in: sessionIds },
        is_active: true,
      },
      _count: {
        _all: true,
      },
    }),
  )

  return new Map(rows.map((row) => [row.cash_drawer_session_id, row._count._all]))
}

async function loadDrawerSessionsPage(
  tenantId: string,
  drawerId: string,
  page: number,
  pageSize: number,
) {
  const openSession = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findFirst({
      where: {
        tenant_org_id: tenantId,
        cash_drawer_id: drawerId,
        is_active: true,
        status: 'OPEN',
      },
      orderBy: [{ opened_at: 'desc' }],
    }),
  )

  if (!openSession) {
    return withTenantContext(tenantId, () =>
      prisma.org_cash_drawer_sessions_mst.findMany({
        where: {
          tenant_org_id: tenantId,
          cash_drawer_id: drawerId,
          is_active: true,
        },
        orderBy: [{ opened_at: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    )
  }

  if (page === 1) {
    const remaining = Math.max(pageSize - 1, 0)
    const rest =
      remaining > 0
        ? await withTenantContext(tenantId, () =>
            prisma.org_cash_drawer_sessions_mst.findMany({
              where: {
                tenant_org_id: tenantId,
                cash_drawer_id: drawerId,
                is_active: true,
                id: { not: openSession.id },
              },
              orderBy: [{ opened_at: 'desc' }],
              take: remaining,
            }),
          )
        : []

    return [openSession, ...rest]
  }

  const skip = Math.max((page - 1) * pageSize - 1, 0)

  return withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        cash_drawer_id: drawerId,
        is_active: true,
        id: { not: openSession.id },
      },
      orderBy: [{ opened_at: 'desc' }],
      skip,
      take: pageSize,
    }),
  )
}

async function loadPaymentCountsBySession(tenantId: string, sessionIds: string[]) {
  if (sessionIds.length === 0) {
    return new Map<string, number>()
  }

  const rows = await withTenantContext(tenantId, () =>
    prisma.org_order_payments_dtl.groupBy({
      by: ['cash_drawer_session_id'],
      where: {
        tenant_org_id: tenantId,
        cash_drawer_session_id: { in: sessionIds },
        is_active: true,
      },
      _count: {
        _all: true,
      },
    }),
  )

  return new Map(
    rows
      .filter((row): row is typeof row & { cash_drawer_session_id: string } => typeof row.cash_drawer_session_id === 'string')
      .map((row) => [row.cash_drawer_session_id, row._count._all]),
  )
}

async function loadMovementTotalsBySession(tenantId: string, sessionIds: string[]) {
  if (sessionIds.length === 0) {
    return new Map<string, { cashIn: number; cashOut: number }>()
  }

  const rows = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_movements_dtl.groupBy({
      by: ['cash_drawer_session_id', 'direction'],
      where: {
        tenant_org_id: tenantId,
        cash_drawer_session_id: { in: sessionIds },
        is_active: true,
      },
      _sum: {
        amount: true,
      },
    }),
  )

  const totals = new Map<string, { cashIn: number; cashOut: number }>()
  for (const row of rows) {
    const sessionId = row.cash_drawer_session_id
    if (!sessionId) continue

    const current = totals.get(sessionId) ?? { cashIn: 0, cashOut: 0 }
    const amount = toNumber(row._sum.amount)

    if (row.direction === 'IN') {
      current.cashIn = amount
    } else if (row.direction === 'OUT') {
      current.cashOut = amount
    }

    totals.set(sessionId, current)
  }

  return totals
}

async function loadPaymentTotalsBySession(
  tenantId: string,
  sessionIds: string[],
  effectiveCashOnly = false,
) {
  if (sessionIds.length === 0) {
    return new Map<string, number>()
  }

  const rows = await withTenantContext(tenantId, () =>
    prisma.org_order_payments_dtl.groupBy({
      by: ['cash_drawer_session_id'],
      where: {
        tenant_org_id: tenantId,
        cash_drawer_session_id: { in: sessionIds },
        // B16: when drawer-close v2 is on, restrict expected-cash contribution
        // to active + COMPLETED-set + cash-family; otherwise legacy is_active-only.
        ...(effectiveCashOnly ? effectiveCashPaymentWhere() : { is_active: true }),
      },
      _sum: {
        amount: true,
      },
    }),
  )

  return new Map(
    rows
      .filter((row): row is typeof row & { cash_drawer_session_id: string } => typeof row.cash_drawer_session_id === 'string')
      .map((row) => [row.cash_drawer_session_id, toNumber(row._sum.amount)]),
  )
}

async function loadSummaryData(tenantId: string, sessionId: string): Promise<SummaryDataBundle> {
  const session = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findFirst({
      where: { id: sessionId, tenant_org_id: tenantId },
    }),
  )

  if (!session) {
    throw new Error('Cash drawer session not found')
  }

  const [movements, payments] = await Promise.all([
    withTenantContext(tenantId, () =>
      prisma.org_cash_drawer_movements_dtl.findMany({
        where: {
          tenant_org_id: tenantId,
          cash_drawer_session_id: sessionId,
          is_active: true,
        },
        orderBy: { performed_at: 'asc' },
      }),
    ),
    withTenantContext(tenantId, () =>
      prisma.org_order_payments_dtl.findMany({
        where: {
          tenant_org_id: tenantId,
          cash_drawer_session_id: sessionId,
          is_active: true,
        },
        orderBy: { created_at: 'asc' },
      }),
    ),
  ])

  return { session, movements, payments }
}

/**
 * List active drawers for the current tenant.
 *
 * Why:
 * the payment flows still depend on the simple drawer list contract, so this
 * method stays intentionally lightweight and backward compatible.
 *
 * @param tenantId tenant resolved server-side from the authenticated session
 * @param branchId optional branch filter for branch-scoped drawer consumers
 * @returns active drawer rows ordered by creation time
 * @example
 * await getDrawers('tenant-001')
 */
export async function getDrawers(tenantId: string, branchId?: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_cash_drawers_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        is_active: true,
        rec_status: 1,
        ...(branchId ? { branch_id: branchId } : {}),
      },
      orderBy: { created_at: 'asc' },
    }),
  )
}

/**
 * Returns active drawers together with their current open session for existing
 * POS and checkout consumers.
 *
 * @param tenantId tenant resolved server-side from the authenticated session
 * @param branchId optional branch filter for branch-scoped drawer consumers
 * @returns backward-compatible drawer rows plus current open session snapshot
 * @example
 * await getDrawersWithCurrentSession('tenant-001', 'branch-001')
 */
export async function getDrawersWithCurrentSession(
  tenantId: string,
  branchId?: string,
): Promise<CashDrawerWithCurrentSession[]> {
  const drawers = await getDrawers(tenantId, branchId)

  if (drawers.length === 0) {
    return []
  }

  const sessions = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        cash_drawer_id: { in: drawers.map((drawer) => drawer.id) },
        status: 'OPEN',
        is_active: true,
      },
      select: {
        id: true,
        cash_drawer_id: true,
        session_no: true,
        opened_at: true,
        opening_float_amount: true,
      },
    }),
  )

  const sessionMap = new Map(sessions.map((session) => [session.cash_drawer_id, session]))

  return drawers.map((drawer) => {
    const currentSession = sessionMap.get(drawer.id) ?? null

    return {
      id: drawer.id,
      tenant_org_id: drawer.tenant_org_id,
      branch_id: drawer.branch_id,
      drawer_code: drawer.drawer_code,
      drawer_name: drawer.drawer_name,
      drawer_name2: drawer.drawer_name2,
      drawer_type: drawer.drawer_type,
      currency_code: drawer.currency_code,
      requires_session: drawer.requires_session,
      opening_float_required: drawer.opening_float_required,
      max_cash_limit: drawer.max_cash_limit != null ? Number(drawer.max_cash_limit) : null,
      assigned_terminal_id: drawer.assigned_terminal_id,
      is_active: drawer.is_active,
      rec_status: drawer.rec_status,
      currentSession: currentSession
        ? {
            id: currentSession.id,
            session_no: currentSession.session_no,
            opened_at: currentSession.opened_at?.toISOString() ?? null,
            opening_float_amount: Number(currentSession.opening_float_amount),
          }
        : null,
    }
  })
}

/**
 * Paginated drawer overview for the master table on the cash-drawer hub.
 *
 * Why:
 * this screen needs operational ordering derived from live session state, so
 * the service assembles drawer config, current sessions, and latest session
 * snapshots into a stable UI-facing contract.
 *
 * @param tenantId tenant resolved server-side from the authenticated session
 * @param page 1-based page index from the hub URL state
 * @param pageSize number of drawer rows to expose for the current page
 * @returns paginated drawer overview rows
 * @example
 * await getCashDrawerOverviewPage('tenant-001', 1, 5)
 */
export async function getCashDrawerOverviewPage(
  tenantId: string,
  page: number,
  pageSize: number,
): Promise<CashDrawerOverviewListResult> {
  const safePage = clampPage(page)
  const safePageSize = clampPageSize(pageSize)
  const drawers = await getDrawers(tenantId)

  if (drawers.length === 0) {
    return {
      items: [],
      total: 0,
      page: safePage,
      pageSize: safePageSize,
    }
  }

  const drawerIds = drawers.map((drawer) => drawer.id)
  const [openSessions, latestSessions, branchesById, terminalsById] = await Promise.all([
    withTenantContext(tenantId, () =>
      prisma.org_cash_drawer_sessions_mst.findMany({
        where: {
          tenant_org_id: tenantId,
          cash_drawer_id: { in: drawerIds },
          status: 'OPEN',
          is_active: true,
        },
        select: {
          id: true,
          cash_drawer_id: true,
          session_no: true,
          status: true,
          opened_at: true,
          closed_at: true,
          opening_float_amount: true,
          expected_cash_amount: true,
          counted_cash_amount: true,
          difference_amount: true,
        },
      }),
    ),
    withTenantContext(tenantId, () =>
      prisma.org_cash_drawer_sessions_mst.findMany({
        where: {
          tenant_org_id: tenantId,
          cash_drawer_id: { in: drawerIds },
          is_active: true,
        },
        select: {
          id: true,
          cash_drawer_id: true,
          session_no: true,
          status: true,
          opened_at: true,
          closed_at: true,
          opening_float_amount: true,
          expected_cash_amount: true,
          counted_cash_amount: true,
          difference_amount: true,
        },
        orderBy: [{ opened_at: 'desc' }],
      }),
    ),
    loadDrawerBranches(
      tenantId,
      [...new Set(drawers.map((drawer) => drawer.branch_id).filter((value): value is string => !!value))],
    ),
    loadDrawerTerminals(
      tenantId,
      [...new Set(drawers.map((drawer) => drawer.assigned_terminal_id).filter((value): value is string => !!value))],
    ),
  ])

  const latestSessionMap = new Map<string, typeof latestSessions[number]>()
  for (const session of latestSessions) {
    if (!latestSessionMap.has(session.cash_drawer_id)) {
      latestSessionMap.set(session.cash_drawer_id, session)
    }
  }

  const sessionsForCounts = [
    ...openSessions.map((session) => session.id),
    ...[...latestSessionMap.values()]
      .map((session) => session.id)
      .filter((sessionId) => !openSessions.some((openSession) => openSession.id === sessionId)),
  ]
  const effectiveCashOnly = await isDrawerCloseV2Enabled(tenantId)
  const [movementCountsBySession, paymentCountsBySession, movementTotalsBySession, paymentTotalsBySession] = await Promise.all([
    loadMovementCountsBySession(tenantId, sessionsForCounts),
    loadPaymentCountsBySession(tenantId, sessionsForCounts),
    loadMovementTotalsBySession(tenantId, sessionsForCounts),
    loadPaymentTotalsBySession(tenantId, sessionsForCounts, effectiveCashOnly),
  ])

  const openSessionMap = new Map(openSessions.map((session) => [session.cash_drawer_id, session]))

  const items = drawers
    .map<CashDrawerOverviewRow>((drawer) => {
      const openSession = openSessionMap.get(drawer.id) ?? null
      const latestSession = latestSessionMap.get(drawer.id) ?? null
      const branch = branchesById.get(drawer.branch_id)
      const terminal = drawer.assigned_terminal_id
        ? terminalsById.get(drawer.assigned_terminal_id)
        : undefined

      return {
        id: drawer.id,
        drawerCode: drawer.drawer_code,
        drawerName: drawer.drawer_name,
        drawerName2: drawer.drawer_name2,
        drawerType: drawer.drawer_type,
        branchId: drawer.branch_id,
        branchName: getBranchDisplayName(branch),
        branchName2: branch?.name2 ?? null,
        currencyCode: drawer.currency_code,
        requiresSession: drawer.requires_session,
        openingFloatRequired: drawer.opening_float_required,
        maxCashLimit: drawer.max_cash_limit == null ? null : toNumber(drawer.max_cash_limit),
        assignedTerminalId: drawer.assigned_terminal_id,
        assignedTerminalName: terminal?.terminal_name ?? terminal?.terminal_name2 ?? null,
        assignedTerminalCode: terminal?.terminal_code ?? null,
        operationalStatus: openSession ? 'OPEN' : 'CLOSED',
        currentSession: openSession
          ? buildSessionSnapshot(
              openSession,
              paymentCountsBySession.get(openSession.id) ?? 0,
              movementCountsBySession.get(openSession.id) ?? 0,
              paymentTotalsBySession.get(openSession.id) ?? 0,
              movementTotalsBySession.get(openSession.id)?.cashIn ?? 0,
              movementTotalsBySession.get(openSession.id)?.cashOut ?? 0,
            )
          : null,
        latestSession: latestSession
          ? buildSessionSnapshot(
              latestSession,
              paymentCountsBySession.get(latestSession.id) ?? 0,
              movementCountsBySession.get(latestSession.id) ?? 0,
              paymentTotalsBySession.get(latestSession.id) ?? 0,
              movementTotalsBySession.get(latestSession.id)?.cashIn ?? 0,
              movementTotalsBySession.get(latestSession.id)?.cashOut ?? 0,
            )
          : null,
      }
    })
    .sort((left, right) => {
      if (left.operationalStatus !== right.operationalStatus) {
        return left.operationalStatus === 'OPEN' ? -1 : 1
      }

      return left.drawerName.localeCompare(right.drawerName)
    })

  const start = (safePage - 1) * safePageSize
  const pagedItems = items.slice(start, start + safePageSize)

  return {
    items: pagedItems,
    total: items.length,
    page: safePage,
    pageSize: safePageSize,
  }
}

/**
 * Paginated sessions list for one cash drawer.
 *
 * Why:
 * the master-detail hub only needs lightweight session rows, while the full
 * session route owns the heavy movement and payment detail payloads.
 *
 * @param tenantId tenant resolved server-side from the authenticated session
 * @param drawerId drawer identifier already checked against tenant scope
 * @param page 1-based page index from the hub URL state
 * @param pageSize number of session rows to expose for the current page
 * @returns paginated session rows ordered with the open session first
 * @throws Error when the drawer does not belong to the tenant
 * @example
 * await getCashDrawerSessionsPage('tenant-001', 'drawer-001', 1, 5)
 */
export async function getCashDrawerSessionsPage(
  tenantId: string,
  drawerId: string,
  page: number,
  pageSize: number,
): Promise<CashDrawerSessionListResult> {
  const safePage = clampPage(page)
  const safePageSize = clampPageSize(pageSize)

  const drawer = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawers_mst.findFirst({
      where: {
        id: drawerId,
        tenant_org_id: tenantId,
        is_active: true,
      },
      select: { id: true },
    }),
  )

  if (!drawer) {
    throw new Error('Cash drawer not found')
  }

  const [total, sessions] = await Promise.all([
    withTenantContext(tenantId, () =>
      prisma.org_cash_drawer_sessions_mst.count({
        where: {
          tenant_org_id: tenantId,
          cash_drawer_id: drawerId,
          is_active: true,
        },
      }),
    ),
    loadDrawerSessionsPage(tenantId, drawerId, safePage, safePageSize),
  ])

  const sessionIds = sessions.map((session) => session.id)
  const effectiveCashOnly = await isDrawerCloseV2Enabled(tenantId)
  const [movementCountsBySession, paymentCountsBySession, movementTotalsBySession, paymentTotalsBySession, actorMap] = await Promise.all([
    loadMovementCountsBySession(tenantId, sessionIds),
    loadPaymentCountsBySession(tenantId, sessionIds),
    loadMovementTotalsBySession(tenantId, sessionIds),
    loadPaymentTotalsBySession(tenantId, sessionIds, effectiveCashOnly),
    resolveActorMap(
      tenantId,
      sessions.flatMap((session) => [session.opened_by, session.closed_by]),
    ),
  ])

  const items = sessions.map<CashDrawerSessionListRow>((session) => ({
    id: session.id,
    sessionNo: session.session_no,
    status: session.status,
    openedAt: toIsoString(session.opened_at),
    closedAt: toIsoString(session.closed_at),
    openingFloatAmount: toNumber(session.opening_float_amount),
    expectedCashAmount:
      session.expected_cash_amount == null
        ? toNumber(session.opening_float_amount) +
          (paymentTotalsBySession.get(session.id) ?? 0) +
          (movementTotalsBySession.get(session.id)?.cashIn ?? 0) -
          (movementTotalsBySession.get(session.id)?.cashOut ?? 0)
        : toNumber(session.expected_cash_amount),
    countedCashAmount: session.counted_cash_amount == null ? null : toNumber(session.counted_cash_amount),
    differenceAmount:
      session.difference_amount == null
        ? session.counted_cash_amount == null
          ? null
          : toNumber(session.counted_cash_amount) -
            (toNumber(session.opening_float_amount) +
              (paymentTotalsBySession.get(session.id) ?? 0) +
              (movementTotalsBySession.get(session.id)?.cashIn ?? 0) -
              (movementTotalsBySession.get(session.id)?.cashOut ?? 0))
        : toNumber(session.difference_amount),
    paymentCount: paymentCountsBySession.get(session.id) ?? 0,
    movementCount: movementCountsBySession.get(session.id) ?? 0,
    openedBy: getActorSummary(actorMap, session.opened_by),
    closedBy: getActorSummary(actorMap, session.closed_by),
  }))

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
  }
}

/**
 * Drawer overview payload used by the drawer-level operational page.
 *
 * Why:
 * the drawer overview page needs a fast snapshot of current activity plus a
 * short recent history without requiring multiple round trips from the route.
 *
 * @param tenantId tenant resolved server-side from the authenticated session
 * @param drawerId drawer identifier already scoped to the current tenant
 * @returns drawer context, current/latest sessions, and recent activity rows
 * @throws Error when the drawer does not belong to the tenant
 * @example
 * await getCashDrawerOverviewDetail('tenant-001', 'drawer-001')
 */
export async function getCashDrawerOverviewDetail(
  tenantId: string,
  drawerId: string,
): Promise<CashDrawerOverviewDetail> {
  const drawer = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawers_mst.findFirst({
      where: {
        id: drawerId,
        tenant_org_id: tenantId,
        is_active: true,
      },
      select: {
        id: true,
        drawer_code: true,
        drawer_name: true,
        drawer_name2: true,
        drawer_type: true,
        branch_id: true,
        currency_code: true,
        requires_session: true,
        opening_float_required: true,
        max_cash_limit: true,
        assigned_terminal_id: true,
      },
    }),
  )

  if (!drawer) {
    throw new Error('Cash drawer not found')
  }

  const [branchMap, terminalMap, sessions, recentMovements] = await Promise.all([
    loadDrawerBranches(tenantId, drawer.branch_id ? [drawer.branch_id] : []),
    loadDrawerTerminals(
      tenantId,
      drawer.assigned_terminal_id ? [drawer.assigned_terminal_id] : [],
    ),
    loadDrawerSessionsPage(tenantId, drawerId, 1, 5),
    withTenantContext(tenantId, () =>
      prisma.org_cash_drawer_movements_dtl.findMany({
        where: {
          tenant_org_id: tenantId,
          cash_drawer_id: drawerId,
          is_active: true,
        },
        orderBy: { performed_at: 'desc' },
        take: 10,
      }),
    ),
  ])

  const recentSessionIds = sessions.map((session) => session.id)
  const effectiveCashOnly = await isDrawerCloseV2Enabled(tenantId)
  const [movementCountsBySession, paymentCountsBySession, movementTotalsBySession, paymentTotalsBySession, actorMap] = await Promise.all([
    loadMovementCountsBySession(tenantId, recentSessionIds),
    loadPaymentCountsBySession(tenantId, recentSessionIds),
    loadMovementTotalsBySession(tenantId, recentSessionIds),
    loadPaymentTotalsBySession(tenantId, recentSessionIds, effectiveCashOnly),
    resolveActorMap(
      tenantId,
      [
        ...sessions.flatMap((session) => [session.opened_by, session.closed_by]),
        ...recentMovements.map((movement) => movement.performed_by),
      ],
    ),
  ])

  const mappedSessions = sessions.map<CashDrawerSessionListRow>((session) => ({
    id: session.id,
    sessionNo: session.session_no,
    status: session.status,
    openedAt: toIsoString(session.opened_at),
    closedAt: toIsoString(session.closed_at),
    openingFloatAmount: toNumber(session.opening_float_amount),
    expectedCashAmount:
      session.expected_cash_amount == null
        ? toNumber(session.opening_float_amount) +
          (paymentTotalsBySession.get(session.id) ?? 0) +
          (movementTotalsBySession.get(session.id)?.cashIn ?? 0) -
          (movementTotalsBySession.get(session.id)?.cashOut ?? 0)
        : toNumber(session.expected_cash_amount),
    countedCashAmount: session.counted_cash_amount == null ? null : toNumber(session.counted_cash_amount),
    differenceAmount:
      session.difference_amount == null
        ? session.counted_cash_amount == null
          ? null
          : toNumber(session.counted_cash_amount) -
            (toNumber(session.opening_float_amount) +
              (paymentTotalsBySession.get(session.id) ?? 0) +
              (movementTotalsBySession.get(session.id)?.cashIn ?? 0) -
              (movementTotalsBySession.get(session.id)?.cashOut ?? 0))
        : toNumber(session.difference_amount),
    paymentCount: paymentCountsBySession.get(session.id) ?? 0,
    movementCount: movementCountsBySession.get(session.id) ?? 0,
    openedBy: getActorSummary(actorMap, session.opened_by),
    closedBy: getActorSummary(actorMap, session.closed_by),
  }))

  return {
    drawer: buildDrawerContext(
      drawer,
      branchMap.get(drawer.branch_id),
      drawer.assigned_terminal_id ? terminalMap.get(drawer.assigned_terminal_id) : undefined,
    ),
    currentSession: mappedSessions.find((session) => session.status === 'OPEN') ?? null,
    latestSession: mappedSessions[0] ?? null,
    recentSessions: mappedSessions,
    recentMovements: recentMovements.map((movement) => mapMovementRow(movement, actorMap)),
  }
}

/**
 * Full session detail payload for the hidden session page and its API.
 *
 * Why:
 * session detail is the reconciliation truth surface, so the service returns
 * drawer context, lifecycle fields, totals, and independently paginated child
 * grids in one stable DTO.
 *
 * @param tenantId tenant resolved server-side from the authenticated session
 * @param drawerId drawer identifier from the route params
 * @param sessionId session identifier from the route params
 * @param options movement/payment page state from the URL
 * @returns full session detail DTO with independently paginated child tables
 * @throws Error when the session does not belong to the supplied drawer/tenant
 * @example
 * await getCashDrawerSessionDetail('tenant-001', 'drawer-001', 'session-001', { movementPage: 1, movementPageSize: 10, paymentPage: 1, paymentPageSize: 10 })
 */
export async function getCashDrawerSessionDetail(
  tenantId: string,
  drawerId: string,
  sessionId: string,
  options: {
    movementPage: number
    movementPageSize: number
    paymentPage: number
    paymentPageSize: number
  },
): Promise<CashDrawerSessionDetail> {
  const movementPage = clampPage(options.movementPage)
  const movementPageSize = clampPageSize(options.movementPageSize)
  const paymentPage = clampPage(options.paymentPage)
  const paymentPageSize = clampPageSize(options.paymentPageSize)

  const [summaryData, effectiveCashOnly] = await Promise.all([
    loadSummaryData(tenantId, sessionId),
    isDrawerCloseV2Enabled(tenantId),
  ])

  if (summaryData.session.cash_drawer_id !== drawerId) {
    throw new Error('Cash drawer session not found')
  }

  const [drawer, branchMap, movementTotal, paymentTotal, pagedMovements, pagedPayments] = await Promise.all([
    withTenantContext(tenantId, () =>
      prisma.org_cash_drawers_mst.findFirstOrThrow({
        where: {
          id: drawerId,
          tenant_org_id: tenantId,
          is_active: true,
        },
        select: {
          id: true,
          drawer_code: true,
          drawer_name: true,
          drawer_name2: true,
          drawer_type: true,
          branch_id: true,
          currency_code: true,
          requires_session: true,
          opening_float_required: true,
          max_cash_limit: true,
          assigned_terminal_id: true,
        },
      }),
    ),
    loadDrawerBranches(tenantId, summaryData.session.branch_id ? [summaryData.session.branch_id] : []),
    withTenantContext(tenantId, () =>
      prisma.org_cash_drawer_movements_dtl.count({
        where: {
          tenant_org_id: tenantId,
          cash_drawer_session_id: sessionId,
          is_active: true,
        },
      }),
    ),
    withTenantContext(tenantId, () =>
      prisma.org_order_payments_dtl.count({
        where: {
          tenant_org_id: tenantId,
          cash_drawer_session_id: sessionId,
          is_active: true,
        },
      }),
    ),
    withTenantContext(tenantId, () =>
      prisma.org_cash_drawer_movements_dtl.findMany({
        where: {
          tenant_org_id: tenantId,
          cash_drawer_session_id: sessionId,
          is_active: true,
        },
        orderBy: { performed_at: 'desc' },
        skip: (movementPage - 1) * movementPageSize,
        take: movementPageSize,
      }),
    ),
    withTenantContext(tenantId, () =>
      prisma.org_order_payments_dtl.findMany({
        where: {
          tenant_org_id: tenantId,
          cash_drawer_session_id: sessionId,
          is_active: true,
        },
        select: {
          id: true,
          order_id: true,
          payment_method_code: true,
          payment_method_name_snapshot: true,
          payment_status: true,
          amount: true,
          currency_code: true,
          tendered_amount: true,
          change_returned_amount: true,
          paid_at: true,
          created_at: true,
          payment_terminal_id: true,
          received_by: true,
          org_payment_terminals_cf: {
            select: {
              terminal_name: true,
              terminal_code: true,
            },
          },
        },
        orderBy: [{ paid_at: 'desc' }, { created_at: 'desc' }],
        skip: (paymentPage - 1) * paymentPageSize,
        take: paymentPageSize,
      }),
    ),
  ])

  const detailTerminalMap = drawer.assigned_terminal_id
    ? await loadDrawerTerminals(tenantId, [drawer.assigned_terminal_id])
    : new Map<string, DrawerTerminalInfo>()

  const actorMap = await resolveActorMap(
    tenantId,
    [
      summaryData.session.opened_by,
      summaryData.session.closed_by,
      summaryData.session.variance_approved_by,
      ...pagedMovements.map((movement) => movement.performed_by),
      ...pagedPayments.map((payment) => payment.received_by),
    ],
  )

  const terminal = drawer.assigned_terminal_id
    ? detailTerminalMap.get(drawer.assigned_terminal_id)
    : undefined

  const reconciliation = buildSessionReconciliation(
    summaryData.session,
    summaryData.movements,
    summaryData.payments,
    effectiveCashOnly,
  )

  const sessionLifecycle: CashDrawerSessionLifecycleDetail = {
    id: summaryData.session.id,
    cashDrawerId: summaryData.session.cash_drawer_id,
    sessionNo: summaryData.session.session_no,
    status: summaryData.session.status,
    openedAt: toIsoString(summaryData.session.opened_at),
    openedBy: getActorSummary(actorMap, summaryData.session.opened_by),
    openingFloatAmount: toNumber(summaryData.session.opening_float_amount),
    currencyCode: summaryData.session.currency_code,
    expectedCashAmount: toNumber(summaryData.session.expected_cash_amount),
    countedCashAmount:
      summaryData.session.counted_cash_amount == null
        ? null
        : toNumber(summaryData.session.counted_cash_amount),
    differenceAmount:
      summaryData.session.difference_amount == null
        ? null
        : toNumber(summaryData.session.difference_amount),
    closedAt: toIsoString(summaryData.session.closed_at),
    closedBy: getActorSummary(actorMap, summaryData.session.closed_by),
    closeNotes: summaryData.session.close_notes,
    forceCloseReason: summaryData.session.force_close_reason,
    varianceApproval: buildVarianceApprovalDetail(summaryData.session, actorMap),
  }

  return {
    drawer: buildDrawerContext(drawer, branchMap.get(drawer.branch_id), terminal),
    session: sessionLifecycle,
    reconciliation,
    movements: {
      items: pagedMovements.map((movement) => mapMovementRow(movement, actorMap)),
      total: movementTotal,
      page: movementPage,
      pageSize: movementPageSize,
    },
    linkedPayments: {
      items: pagedPayments.map((payment) => mapPaymentRow(payment, actorMap)),
      total: paymentTotal,
      page: paymentPage,
      pageSize: paymentPageSize,
    },
  }
}

/**
 * Resolves the open cash-drawer session to use for cash-taking flows.
 *
 * Why:
 * order submission can safely auto-bind a session only when there is exactly
 * one valid open session in scope.
 *
 * @param tenantId tenant resolved server-side from the authenticated session
 * @param branchId optional branch filter for branch checkout flows
 * @param requestedSessionId session already chosen by the caller, if any
 * @returns the provided session id or the single resolvable open session id
 * @throws Error when zero or multiple open sessions exist in scope
 * @example
 * await resolveCashDrawerSessionId('tenant-001', 'branch-001')
 */
export async function resolveCashDrawerSessionId(
  tenantId: string,
  branchId?: string,
  requestedSessionId?: string,
): Promise<string> {
  if (requestedSessionId) {
    return requestedSessionId
  }

  const sessions = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        status: 'OPEN',
        is_active: true,
        ...(branchId ? { branch_id: branchId } : {}),
      },
      select: { id: true },
      orderBy: [{ opened_at: 'desc' }],
      take: 2,
    }),
  )

  if (sessions.length === 0) {
    throw new Error('CASH_DRAWER_SESSION_REQUIRED')
  }

  if (sessions.length > 1) {
    throw new Error('CASH_DRAWER_SESSION_SELECTION_REQUIRED')
  }

  return sessions[0].id
}

/**
 * Open a new drawer session.
 *
 * @param tenantId tenant resolved server-side from the authenticated session
 * @param drawerId drawer identifier already checked against tenant scope
 * @param params mutation payload including opening balance and actor id
 * @returns newly created session row
 * @throws Error when a drawer session is already open
 * @example
 * await openSession('tenant-001', 'drawer-001', { openingBalance: 10, openedBy: 'user-001' })
 */
export async function openSession(
  tenantId: string,
  drawerId: string,
  params: { openingBalance: number; openedBy: string; notes?: string },
) {
  const drawer = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawers_mst.findFirstOrThrow({
      where: { id: drawerId, tenant_org_id: tenantId },
    }),
  )

  const existing = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findFirst({
      where: { tenant_org_id: tenantId, cash_drawer_id: drawerId, status: 'OPEN' },
    }),
  )

  if (existing) {
    throw new Error('A session is already open for this drawer')
  }

  const count = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.count({ where: { tenant_org_id: tenantId } }),
  )

  const sessionNo = `SES-${String(count + 1).padStart(6, '0')}`

  return withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.create({
      data: {
        tenant_org_id: tenantId,
        branch_id: drawer.branch_id,
        cash_drawer_id: drawerId,
        session_no: sessionNo,
        status: 'OPEN',
        currency_code: drawer.currency_code,
        opening_float_amount: params.openingBalance,
        opened_by: params.openedBy,
        opened_at: new Date(),
        is_active: true,
        rec_status: 1,
      },
    }),
  )
}

/**
 * Close an open drawer session using the physical cash count.
 *
 * @param tenantId tenant resolved server-side from the authenticated session
 * @param sessionId session identifier already checked against tenant scope
 * @param params close payload including actor id and optional notes
 * @returns closed session row plus variance summary
 * @throws Error when the session is not open
 * @example
 * await closeSession('tenant-001', 'session-001', { physicalCount: 25, closedBy: 'user-001' })
 */
export async function closeSession(
  tenantId: string,
  sessionId: string,
  params: SessionCloseParams,
): Promise<SessionCloseResult> {
  const session = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findFirstOrThrow({
      where: { id: sessionId, tenant_org_id: tenantId, status: 'OPEN' },
    }),
  )

  // B16: expected cash counts only active, COMPLETED-set, cash-family payments
  // when drawer-close v2 is enabled (M2 fix); flag off keeps the legacy
  // unfiltered aggregate so the rollout is controlled and reversible.
  const effectiveCashOnly = await isDrawerCloseV2Enabled(tenantId)
  const [cashPayments, movements, drawer] = await Promise.all([
    withTenantContext(tenantId, () =>
      prisma.org_order_payments_dtl.aggregate({
        where: {
          tenant_org_id: tenantId,
          cash_drawer_session_id: sessionId,
          ...(effectiveCashOnly ? effectiveCashPaymentWhere() : {}),
        },
        _sum: { amount: true },
      }),
    ),
    withTenantContext(tenantId, () =>
      prisma.org_cash_drawer_movements_dtl.findMany({
        where: {
          tenant_org_id: tenantId,
          cash_drawer_session_id: sessionId,
          is_active: true,
        },
        select: {
          direction: true,
          amount: true,
        },
      }),
    ),
    // B16: per-drawer variance-approval threshold (NULL = no gate).
    withTenantContext(tenantId, () =>
      prisma.org_cash_drawers_mst.findFirst({
        where: { id: session.cash_drawer_id, tenant_org_id: tenantId },
        select: { variance_approval_threshold: true },
      }),
    ),
  ])

  const cashIn = toNumber(cashPayments._sum.amount)
  const movementCashIn = movements
    .filter((movement) => movement.direction === 'IN')
    .reduce((sum, movement) => sum + toNumber(movement.amount), 0)
  const movementCashOut = movements
    .filter((movement) => movement.direction === 'OUT')
    .reduce((sum, movement) => sum + toNumber(movement.amount), 0)
  const expectedCash = toNumber(session.opening_float_amount) + cashIn + movementCashIn - movementCashOut
  const variance = params.physicalCount - expectedCash
  const isBalanced = Math.abs(variance) < CASH_VARIANCE_TOLERANCE

  // B16 (deferred-approval model): when drawer-close v2 is on and the drawer has
  // a configured threshold, a not-balanced close whose |variance| exceeds it is
  // flagged pending approval. The session still closes; a supervisor approves
  // it separately via `approveSessionVariance`. Snapshotting the threshold both
  // marks the pending state and preserves the value in effect at close time.
  const varianceThreshold =
    effectiveCashOnly && drawer?.variance_approval_threshold != null
      ? toNumber(drawer.variance_approval_threshold)
      : null
  const varianceApprovalPending =
    varianceThreshold != null && !isBalanced && Math.abs(variance) > varianceThreshold

  const updated = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.update({
      where: { id: sessionId },
      data: {
        status: 'CLOSED',
        counted_cash_amount: params.physicalCount,
        expected_cash_amount: expectedCash,
        difference_amount: variance,
        closed_by: params.closedBy,
        closed_at: new Date(),
        close_notes: params.notes ?? null,
        variance_threshold_snapshot: varianceApprovalPending ? varianceThreshold : null,
        updated_at: new Date(),
      },
    }),
  )

  return { session: updated, variance, isBalanced, varianceApprovalPending, varianceThreshold }
}

/**
 * B16: approve an over-threshold drawer-close variance (deferred maker-checker
 * model). Performed by a supervisor holding `cash_drawer:approve_variance`, who
 * must differ from the session's closer. Single-shot and fully audited.
 *
 * @param tenantId tenant resolved server-side from the authenticated session
 * @param sessionId closed session whose variance is pending approval
 * @param params approver id (the authenticated supervisor) + mandatory reason
 * @returns the updated session row
 * @throws VarianceApprovalError on state / maker-checker / reason violations
 */
export async function approveSessionVariance(
  tenantId: string,
  sessionId: string,
  params: { approvedBy: string; reason: string },
): Promise<Awaited<ReturnType<typeof prisma.org_cash_drawer_sessions_mst.update>>> {
  const reason = params.reason?.trim()
  if (!reason) {
    throw new VarianceApprovalError(VARIANCE_APPROVAL_ERRORS.REASON_REQUIRED)
  }

  const session = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findFirstOrThrow({
      where: { id: sessionId, tenant_org_id: tenantId },
    }),
  )

  const state = deriveVarianceApprovalState(session)
  if (!state.required) {
    throw new VarianceApprovalError(VARIANCE_APPROVAL_ERRORS.NOT_PENDING_APPROVAL)
  }
  if (state.approved) {
    throw new VarianceApprovalError(VARIANCE_APPROVAL_ERRORS.ALREADY_APPROVED)
  }
  if (session.closed_by && session.closed_by === params.approvedBy) {
    throw new VarianceApprovalError(VARIANCE_APPROVAL_ERRORS.SELF_APPROVAL_BLOCKED)
  }

  return withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.update({
      where: { id: sessionId },
      data: {
        variance_approved_by: params.approvedBy,
        variance_approved_at: new Date(),
        variance_approval_reason: reason,
        updated_at: new Date(),
      },
    }),
  )
}

/**
 * Record a manual cash movement against the drawer's open session.
 *
 * @param tenantId tenant resolved server-side from the authenticated session
 * @param drawerId drawer identifier already checked against tenant scope
 * @param params movement payload including actor id
 * @returns newly created cash movement row
 * @throws Error when no open session exists for the drawer
 * @example
 * await recordMovement('tenant-001', 'drawer-001', { movementType: 'CASH_IN', amount: 5, reason: 'Float top-up', performedBy: 'user-001' })
 */
export async function recordMovement(
  tenantId: string,
  drawerId: string,
  params: {
    movementType: 'CASH_IN' | 'CASH_OUT' | 'PETTY_CASH'
    amount: number
    reason: string
    performedBy: string
  },
) {
  const session = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findFirst({
      where: { tenant_org_id: tenantId, cash_drawer_id: drawerId, status: 'OPEN' },
    }),
  )

  if (!session) {
    throw new Error('No open session found for this drawer')
  }

  const direction = params.movementType === 'CASH_IN' ? 'IN' : 'OUT'

  return withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_movements_dtl.create({
      data: {
        tenant_org_id: tenantId,
        branch_id: session.branch_id,
        cash_drawer_id: drawerId,
        cash_drawer_session_id: session.id,
        movement_type: params.movementType,
        direction,
        amount: params.amount,
        currency_code: session.currency_code,
        reason: params.reason,
        performed_by: params.performedBy,
        performed_at: new Date(),
        is_active: true,
        rec_status: 1,
      },
    }),
  )
}

/**
 * Raw session summary used by the existing print and POS reconciliation flows.
 *
 * Why:
 * those consumers already depend on the low-level session, movements, and
 * payments shape, so this helper preserves that contract while sharing the same
 * reconciliation math used by the new session detail route.
 *
 * @param tenantId tenant resolved server-side from the authenticated session
 * @param sessionId session identifier already checked against tenant scope
 * @returns raw session detail bundle plus reconciliation totals
 * @example
 * await getSessionSummary('tenant-001', 'session-001')
 */
export async function getSessionSummary(tenantId: string, sessionId: string) {
  const effectiveCashOnly = await isDrawerCloseV2Enabled(tenantId)
  const { session, movements, payments } = await loadSummaryData(tenantId, sessionId)
  const reconciliation = buildSessionReconciliation(session, movements, payments, effectiveCashOnly)

  return {
    session,
    movements,
    payments,
    totalCashIn: reconciliation.movementCashIn,
    totalCashOut: reconciliation.movementCashOut,
    totalPayments: reconciliation.cashCollected,
    reconciliation: {
      openingFloat: reconciliation.openingFloat,
      cashCollected: reconciliation.cashCollected,
      movementCashIn: reconciliation.movementCashIn,
      movementCashOut: reconciliation.movementCashOut,
      movementNet: reconciliation.movementNet,
      expectedCash: reconciliation.expectedCash,
      movementExpectedCash: reconciliation.openingFloat + reconciliation.movementNet,
      paymentCount: reconciliation.paymentCount,
      movementCount: reconciliation.movementCount,
      currencyCode: reconciliation.currencyCode,
    },
  }
}

/**
 * Verify that a drawer has an open session before allowing cash-payment
 * routing.
 *
 * @param tenantId tenant resolved server-side from the authenticated session
 * @param drawerId drawer identifier already checked against tenant scope
 * @returns open session id used by the caller's payment wiring
 * @throws Error when no open session exists
 * @example
 * await validateDrawerForCashPayment('tenant-001', 'drawer-001')
 */
export async function validateDrawerForCashPayment(
  tenantId: string,
  drawerId: string,
): Promise<string> {
  const session = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findFirst({
      where: { tenant_org_id: tenantId, cash_drawer_id: drawerId, status: 'OPEN' },
    }),
  )

  if (!session) {
    throw new Error('No open cash drawer session. Please open a session before taking cash payments.')
  }

  return session.id
}

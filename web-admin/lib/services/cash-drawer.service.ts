import 'server-only'

import { Prisma } from '@prisma/client'
import { Decimal } from '@prisma/client/runtime/library'

import { lookupAuditActors, type AuditActorLookupResult } from '@lib/services/audit-actor.service'
import { getCashControlSettings, withCashControlSettingsCache } from '@/lib/services/cash-control-settings.service'
import { prisma } from '@lib/db/prisma'
import { withTenantContext } from '@lib/db/tenant-context'
import { addMoney, subMoney, sumMoney, compareMoney, toDecimal, toMoneyString } from '@/lib/utils/money'
import {
  sumLedgerTotalsBySession,
  loadSessionClosingFigures,
  type SessionClosingFigures,
  getDrawerLedgerMovementsPage,
  type SessionLedgerTotals,
  type DrawerLedgerMovementRow,
} from '@/lib/services/cash-drawer-ledger/cash-drawer-balance.service'
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

export type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0]

/** Stable error codes for cash-drawer session mutations (A2). */
export const CASH_DRAWER_SESSION_ERRORS = {
  /** Another session is already open for this drawer (uq_open_cash_drawer_session). */
  ALREADY_OPEN: 'DRAWER_SESSION_ALREADY_OPEN',
} as const

export type CashDrawerSessionErrorCode =
  (typeof CASH_DRAWER_SESSION_ERRORS)[keyof typeof CASH_DRAWER_SESSION_ERRORS]

/** Typed error so the API/action can map a session-mutation failure to a 4xx + code. */
export class CashDrawerSessionError extends Error {
  readonly code: CashDrawerSessionErrorCode
  constructor(code: CashDrawerSessionErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'CashDrawerSessionError'
    this.code = code
  }
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

/** Stable error codes for the variance-approval action. */
export const VARIANCE_APPROVAL_ERRORS = {
  /** Session is not in a state that requires/permits variance approval. */
  NOT_PENDING_APPROVAL: 'VARIANCE_NOT_PENDING_APPROVAL',
  /** Variance was already approved — approval is single-shot. */
  ALREADY_APPROVED: 'VARIANCE_ALREADY_APPROVED',
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
 * CLF-6-1 (POS Session & Cash Drawer Hardening): Decimal-space reconciliation
 * built from the drawer ledger instead of the retired `org_cash_drawer_
 * movements_dtl` formula. Sourced by `cash_drawer_session_id` directly (set
 * by the CLF gate at posting time — CLF-5/W1-W15), so this works identically
 * for every session, whichever screen opened it; no `open_ledger_seq`/chain
 * math is needed for a single session's own totals.
 *
 * `cashCollected` = FIN-domain cash recognized IN (sales, receipts, cash
 * pay-in). `movementCashIn`/`movementCashOut` = TRX-domain custody transfers,
 * with FIN-domain OUT (refunds, expense/supplier/petty-cash payments) folded
 * into `movementCashOut` — this makes `expectedCash = openingFloat +
 * cashCollected + movementCashIn - movementCashOut` exactly match CLF's own
 * canonical closing formula (`cash-drawer-balance.service.ts`'s
 * `computeClosingExpectedTx`: baseline + finIn - finOut + trxIn - trxOut).
 *
 * Once the count step froze the session's figures (CLOSING, CLOSED,
 * FORCE_CLOSED — `closing`, read from the per-currency balance row), those are
 * what `expectedCash`/`countedCash`/`variance` show, whichever flow closed the
 * session; the ledger-sourced breakdown fields sit alongside for drill-down. A
 * session that has not been counted yet has no frozen record, so every field
 * is computed live and `countedCash`/`variance` stay null (blind close).
 */
function buildLedgerReconciliation(
  session: {
    opening_float_amount: Decimal | null
    currency_code: string | null
  },
  totals: SessionLedgerTotals,
  closing?: SessionClosingFigures,
): CashDrawerReconciliationSummary {
  const openingFloatDecimal = toDecimal(session.opening_float_amount)
  const cashCollectedDecimal = toDecimal(totals.finIn)
  const movementCashInDecimal = toDecimal(totals.trxIn)
  const movementCashOutDecimal = addMoney(totals.finOut, totals.trxOut)
  const movementNetDecimal = subMoney(movementCashInDecimal, movementCashOutDecimal)
  const liveExpectedCashDecimal = addMoney(
    addMoney(openingFloatDecimal, cashCollectedDecimal),
    movementNetDecimal,
  )

  const expectedCashDecimal = closing ? closing.expected : liveExpectedCashDecimal
  const countedCashDecimal = closing?.counted ?? null
  const varianceDecimal =
    closing?.variance != null
      ? closing.variance
      : countedCashDecimal == null
        ? null
        : subMoney(countedCashDecimal, expectedCashDecimal)

  return {
    openingFloat: toMoneyString(openingFloatDecimal),
    cashCollected: toMoneyString(cashCollectedDecimal),
    movementCashIn: toMoneyString(movementCashInDecimal),
    movementCashOut: toMoneyString(movementCashOutDecimal),
    movementNet: toMoneyString(movementNetDecimal),
    expectedCash: toMoneyString(expectedCashDecimal),
    countedCash: countedCashDecimal == null ? null : toMoneyString(countedCashDecimal),
    variance: varianceDecimal == null ? null : toMoneyString(varianceDecimal),
    paymentCount: totals.finCount,
    movementCount: totals.trxCount,
    currencyCode: session.currency_code ?? null,
  }
}

/**
 * Snapshot-shaped variant of {@link buildLedgerReconciliation} for the
 * compact list/overview DTOs, which only expose `expectedCashAmount`/
 * `countedCashAmount`/`differenceAmount` (not the full reconciliation breakdown).
 */
function deriveLedgerExpectedCashAndVariance(
  session: {
    opening_float_amount: Decimal | null
    currency_code: string | null
  },
  totals: SessionLedgerTotals,
  closing?: SessionClosingFigures,
): { expectedCashAmount: string; countedCashAmount: string | null; differenceAmount: string | null } {
  const reconciliation = buildLedgerReconciliation(session, totals, closing)
  return {
    expectedCashAmount: reconciliation.expectedCash,
    countedCashAmount: reconciliation.countedCash,
    differenceAmount: reconciliation.variance,
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
    currency_code: string | null
  },
  totals: SessionLedgerTotals,
  closing?: SessionClosingFigures,
): CashDrawerSessionSummarySnapshot {
  const { expectedCashAmount, countedCashAmount, differenceAmount } = deriveLedgerExpectedCashAndVariance(
    session,
    totals,
    closing,
  )

  return {
    id: session.id,
    sessionNo: session.session_no,
    status: session.status,
    openedAt: toIsoString(session.opened_at),
    closedAt: toIsoString(session.closed_at),
    openingFloatAmount: toMoneyString(session.opening_float_amount),
    expectedCashAmount,
    countedCashAmount,
    differenceAmount,
    paymentCount: totals.finCount,
    movementCount: totals.trxCount,
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
      session.variance_threshold_snapshot == null ? null : toMoneyString(session.variance_threshold_snapshot),
    approvedBy: getActorSummary(actorMap, session.variance_approved_by),
    approvedAt: toIsoString(session.variance_approved_at),
    reason: session.variance_approval_reason,
  }
}

/** The drawer rules the screens show, taken from the effective policy (never a drawer column). */
interface DrawerPolicyView {
  requiresSession: boolean
  openingCountRequired: boolean
}

/**
 * Resolves the effective cash-control policy of one drawer (DRAWER -> USER -> BRANCH -> TENANT ->
 * type default -> default), reduced to what the drawer screens display.
 * @param tenantId tenant of the drawer
 * @param drawer drawer whose policy is wanted
 */
async function resolveDrawerPolicyView(
  tenantId: string,
  drawer: { id: string; branch_id: string | null },
): Promise<DrawerPolicyView> {
  const settings = await getCashControlSettings({ tenantId, branchId: drawer.branch_id, drawerId: drawer.id })
  return { requiresSession: settings.requiresSession, openingCountRequired: settings.openingCountRequired }
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
    max_cash_limit: Decimal | null
    assigned_terminal_id: string | null
  },
  branch: DrawerBranchInfo | undefined,
  terminal: DrawerTerminalInfo | undefined,
  policy: DrawerPolicyView,
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
    requiresSession: policy.requiresSession,
    openingCountRequired: policy.openingCountRequired,
    maxCashLimit: drawer.max_cash_limit == null ? null : toMoneyString(drawer.max_cash_limit),
    assignedTerminalId: drawer.assigned_terminal_id,
    assignedTerminalName: terminal?.terminal_name ?? terminal?.terminal_name2 ?? null,
    assignedTerminalCode: terminal?.terminal_code ?? null,
  }
}

/**
 * CLF-6-1: adapts a unified-ledger entry into the pre-CLF `CashDrawerMovementRow`
 * screen contract. `refundId` has no direct equivalent on a voucher trx line
 * (refunds are identified by `line_role`/`orderId`, not a dedicated FK like the
 * retired movements table had) — left `null`; CLF-8-7/8-8's native Ledger tab
 * is the real fix, this adapter only keeps today's screens working unchanged.
 */
function mapLedgerMovementRow(
  movement: DrawerLedgerMovementRow,
  actorMap: Map<string, CashDrawerActorSummary>,
): CashDrawerMovementRow {
  return {
    id: movement.id,
    movementType: movement.movementType,
    direction: movement.direction,
    amount: toMoneyString(movement.amount),
    currencyCode: movement.currencyCode,
    orderId: movement.orderId,
    orderPaymentId: movement.orderPaymentId,
    refundId: null,
    referenceNo: movement.referenceNo,
    reason: movement.reason,
    performedAt: toIsoString(movement.occurredAt),
    performedBy: getActorSummary(actorMap, movement.performedBy),
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
    amount: toMoneyString(payment.amount),
    currencyCode: payment.currency_code,
    tenderedAmount: payment.tendered_amount == null ? null : toMoneyString(payment.tendered_amount),
    changeReturnedAmount:
      payment.change_returned_amount == null ? null : toMoneyString(payment.change_returned_amount),
    paidAt: toIsoString(payment.paid_at ?? payment.created_at),
    terminalId: payment.payment_terminal_id,
    terminalName: payment.org_payment_terminals_cf?.terminal_name ?? null,
    terminalCode: payment.org_payment_terminals_cf?.terminal_code ?? null,
    receivedBy: getActorSummary(actorMap, payment.received_by),
  }
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

async function loadSummaryData(tenantId: string, sessionId: string): Promise<SummaryDataBundle> {
  const session = await withTenantContext(tenantId, () =>
    prisma.org_cash_drawer_sessions_mst.findFirst({
      where: { id: sessionId, tenant_org_id: tenantId },
    }),
  )

  if (!session) {
    throw new Error('Cash drawer session not found')
  }

  const payments = await withTenantContext(tenantId, () =>
    prisma.org_order_payments_dtl.findMany({
      where: {
        tenant_org_id: tenantId,
        cash_drawer_session_id: sessionId,
        is_active: true,
      },
      orderBy: { created_at: 'asc' },
    }),
  )

  return { session, payments }
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
          currency_code: true,
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
          currency_code: true,
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
  const [ledgerTotalsBySession, closingBySession] = await Promise.all([
    sumLedgerTotalsBySession(tenantId, sessionsForCounts),
    loadSessionClosingFigures(
      tenantId,
      [...openSessions, ...latestSessionMap.values()].filter((session) => sessionsForCounts.includes(session.id)),
    ),
  ])
  const emptyTotals: SessionLedgerTotals = {
    finIn: new Decimal(0), finOut: new Decimal(0), trxIn: new Decimal(0), trxOut: new Decimal(0), finCount: 0, trxCount: 0,
  }

  const openSessionMap = new Map(openSessions.map((session) => [session.cash_drawer_id, session]))

  const items = drawers
    .map<Omit<CashDrawerOverviewRow, 'requiresSession' | 'openingCountRequired'>>((drawer) => {
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
        maxCashLimit: drawer.max_cash_limit == null ? null : toMoneyString(drawer.max_cash_limit),
        assignedTerminalId: drawer.assigned_terminal_id,
        assignedTerminalName: terminal?.terminal_name ?? terminal?.terminal_name2 ?? null,
        assignedTerminalCode: terminal?.terminal_code ?? null,
        operationalStatus: openSession ? 'OPEN' : 'CLOSED',
        currentSession: openSession
          ? buildSessionSnapshot(openSession, ledgerTotalsBySession.get(openSession.id) ?? emptyTotals, closingBySession.get(openSession.id))
          : null,
        latestSession: latestSession
          ? buildSessionSnapshot(latestSession, ledgerTotalsBySession.get(latestSession.id) ?? emptyTotals, closingBySession.get(latestSession.id))
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

  // Policy is resolved only for the rows on this page (one cached lookup per drawer), not the whole tenant.
  const policies = await withCashControlSettingsCache(() =>
    Promise.all(pagedItems.map((row) => resolveDrawerPolicyView(tenantId, { id: row.id, branch_id: row.branchId }))),
  )

  return {
    items: pagedItems.map((row, index) => ({ ...row, ...policies[index] })),
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
  const [ledgerTotalsBySession, closingBySession, actorMap] = await Promise.all([
    sumLedgerTotalsBySession(tenantId, sessionIds),
    loadSessionClosingFigures(tenantId, sessions),
    resolveActorMap(
      tenantId,
      sessions.flatMap((session) => [session.opened_by, session.closed_by]),
    ),
  ])
  const emptyTotals: SessionLedgerTotals = {
    finIn: new Decimal(0), finOut: new Decimal(0), trxIn: new Decimal(0), trxOut: new Decimal(0), finCount: 0, trxCount: 0,
  }

  const items = sessions.map<CashDrawerSessionListRow>((session) => {
    const totals = ledgerTotalsBySession.get(session.id) ?? emptyTotals
    const { expectedCashAmount, countedCashAmount, differenceAmount } = deriveLedgerExpectedCashAndVariance(
      session,
      totals,
      closingBySession.get(session.id),
    )
    return {
      id: session.id,
      sessionNo: session.session_no,
      status: session.status,
      openedAt: toIsoString(session.opened_at),
      closedAt: toIsoString(session.closed_at),
      openingFloatAmount: toMoneyString(session.opening_float_amount),
      expectedCashAmount,
      countedCashAmount,
      differenceAmount,
      paymentCount: totals.finCount,
      movementCount: totals.trxCount,
      openedBy: getActorSummary(actorMap, session.opened_by),
      closedBy: getActorSummary(actorMap, session.closed_by),
    }
  })

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
        max_cash_limit: true,
        assigned_terminal_id: true,
      },
    }),
  )

  if (!drawer) {
    throw new Error('Cash drawer not found')
  }

  const [branchMap, terminalMap, sessions, recentMovementsPage] = await Promise.all([
    loadDrawerBranches(tenantId, drawer.branch_id ? [drawer.branch_id] : []),
    loadDrawerTerminals(
      tenantId,
      drawer.assigned_terminal_id ? [drawer.assigned_terminal_id] : [],
    ),
    loadDrawerSessionsPage(tenantId, drawerId, 1, 5),
    getDrawerLedgerMovementsPage(tenantId, drawerId, {}, 1, 10),
  ])
  const recentMovements = recentMovementsPage.rows

  const recentSessionIds = sessions.map((session) => session.id)
  const [ledgerTotalsBySession, closingBySession, actorMap] = await Promise.all([
    sumLedgerTotalsBySession(tenantId, recentSessionIds),
    loadSessionClosingFigures(tenantId, sessions),
    resolveActorMap(
      tenantId,
      [
        ...sessions.flatMap((session) => [session.opened_by, session.closed_by]),
        ...recentMovements.map((movement) => movement.performedBy),
      ],
    ),
  ])
  const emptyTotals: SessionLedgerTotals = {
    finIn: new Decimal(0), finOut: new Decimal(0), trxIn: new Decimal(0), trxOut: new Decimal(0), finCount: 0, trxCount: 0,
  }

  const mappedSessions = sessions.map<CashDrawerSessionListRow>((session) => {
    const totals = ledgerTotalsBySession.get(session.id) ?? emptyTotals
    const { expectedCashAmount, countedCashAmount, differenceAmount } = deriveLedgerExpectedCashAndVariance(
      session,
      totals,
      closingBySession.get(session.id),
    )
    return {
      id: session.id,
      sessionNo: session.session_no,
      status: session.status,
      openedAt: toIsoString(session.opened_at),
      closedAt: toIsoString(session.closed_at),
      openingFloatAmount: toMoneyString(session.opening_float_amount),
      expectedCashAmount,
      countedCashAmount,
      differenceAmount,
      paymentCount: totals.finCount,
      movementCount: totals.trxCount,
      openedBy: getActorSummary(actorMap, session.opened_by),
      closedBy: getActorSummary(actorMap, session.closed_by),
    }
  })

  return {
    drawer: buildDrawerContext(
      drawer,
      branchMap.get(drawer.branch_id),
      drawer.assigned_terminal_id ? terminalMap.get(drawer.assigned_terminal_id) : undefined,
      await resolveDrawerPolicyView(tenantId, drawer),
    ),
    currentSession: mappedSessions.find((session) => session.status === 'OPEN') ?? null,
    latestSession: mappedSessions[0] ?? null,
    recentSessions: mappedSessions,
    recentMovements: recentMovements.map((movement) => mapLedgerMovementRow(movement, actorMap)),
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

  const summaryData = await loadSummaryData(tenantId, sessionId)

  if (summaryData.session.cash_drawer_id !== drawerId) {
    throw new Error('Cash drawer session not found')
  }

  const [drawer, branchMap, ledgerTotals, closingBySession, movementsPage, paymentTotal, pagedPayments] = await Promise.all([
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
          max_cash_limit: true,
          assigned_terminal_id: true,
        },
      }),
    ),
    loadDrawerBranches(tenantId, summaryData.session.branch_id ? [summaryData.session.branch_id] : []),
    sumLedgerTotalsBySession(tenantId, [sessionId]),
    loadSessionClosingFigures(tenantId, [summaryData.session]),
    getDrawerLedgerMovementsPage(tenantId, drawerId, { sessionId }, movementPage, movementPageSize),
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

  const pagedMovements = movementsPage.rows
  const emptyTotals: SessionLedgerTotals = {
    finIn: new Decimal(0), finOut: new Decimal(0), trxIn: new Decimal(0), trxOut: new Decimal(0), finCount: 0, trxCount: 0,
  }

  const actorMap = await resolveActorMap(
    tenantId,
    [
      summaryData.session.opened_by,
      summaryData.session.closed_by,
      summaryData.session.variance_approved_by,
      ...pagedMovements.map((movement) => movement.performedBy),
      ...pagedPayments.map((payment) => payment.received_by),
    ],
  )

  const terminal = drawer.assigned_terminal_id
    ? detailTerminalMap.get(drawer.assigned_terminal_id)
    : undefined

  const reconciliation = buildLedgerReconciliation(
    summaryData.session,
    ledgerTotals.get(sessionId) ?? emptyTotals,
    closingBySession.get(sessionId),
  )

  const sessionLifecycle: CashDrawerSessionLifecycleDetail = {
    id: summaryData.session.id,
    cashDrawerId: summaryData.session.cash_drawer_id,
    sessionNo: summaryData.session.session_no,
    status: summaryData.session.status,
    openedAt: toIsoString(summaryData.session.opened_at),
    openedBy: getActorSummary(actorMap, summaryData.session.opened_by),
    openingFloatAmount: toMoneyString(summaryData.session.opening_float_amount),
    currencyCode: summaryData.session.currency_code,
    expectedCashAmount: reconciliation.expectedCash,
    countedCashAmount: reconciliation.countedCash,
    differenceAmount: reconciliation.variance,
    closedAt: toIsoString(summaryData.session.closed_at),
    closedBy: getActorSummary(actorMap, summaryData.session.closed_by),
    closeNotes: summaryData.session.close_notes,
    forceCloseReason: summaryData.session.force_close_reason,
    varianceApproval: buildVarianceApprovalDetail(summaryData.session, actorMap),
  }

  return {
    drawer: buildDrawerContext(drawer, branchMap.get(drawer.branch_id), terminal, await resolveDrawerPolicyView(tenantId, drawer)),
    session: sessionLifecycle,
    reconciliation,
    movements: {
      items: pagedMovements.map((movement) => mapLedgerMovementRow(movement, actorMap)),
      total: movementsPage.totalCount,
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
  const { session, payments } = await loadSummaryData(tenantId, sessionId)
  const [ledgerTotalsBySession, closingBySession, movementsPage] = await Promise.all([
    sumLedgerTotalsBySession(tenantId, [sessionId]),
    loadSessionClosingFigures(tenantId, [session]),
    // CLF-6-1: this function returns the session's full movement set (no
    // pagination, unlike the session-detail route) for print/POS
    // reconciliation consumers — a page size large enough for any real
    // session's lifetime activity.
    getDrawerLedgerMovementsPage(tenantId, session.cash_drawer_id, { sessionId }, 1, 10000),
  ])
  const emptyTotals: SessionLedgerTotals = {
    finIn: new Decimal(0), finOut: new Decimal(0), trxIn: new Decimal(0), trxOut: new Decimal(0), finCount: 0, trxCount: 0,
  }
  const reconciliation = buildLedgerReconciliation(
    session,
    ledgerTotalsBySession.get(sessionId) ?? emptyTotals,
    closingBySession.get(sessionId),
  )
  // Legacy-shaped rows for `movements` (print-page + action consumers read
  // snake_case `direction`/`movement_type`/`amount`/`performed_by`/
  // `performed_at` directly off the retired movements-table row shape) — adapted from the unified ledger (CLF-8-12 gives these
  // consumers a proper native shape; this keeps them working unchanged).
  const movements = movementsPage.rows.map((row) => ({
    id: row.id,
    direction: row.direction,
    movement_type: row.movementType,
    amount: row.amount,
    reason: row.reason,
    performed_by: row.performedBy,
    performed_at: row.occurredAt,
  }))

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
      movementExpectedCash: toMoneyString(addMoney(reconciliation.openingFloat, reconciliation.movementNet)),
      countedCash: reconciliation.countedCash,
      variance: reconciliation.variance,
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

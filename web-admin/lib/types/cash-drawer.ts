/**
 * Screen-facing cash-drawer DTOs.
 *
 * Why:
 * cash-drawer operational pages need a stable UI contract that is decoupled
 * from raw Prisma rows so the screens can evolve without leaking database
 * shapes into feature components.
 */

/**
 * Standard 1-based paginated response used by the cash-drawer screen APIs.
 *
 * @template TItem row payload returned for the current page
 */
export interface CashDrawerPaginatedResult<TItem> {
  items: TItem[]
  total: number
  page: number
  pageSize: number
}

/**
 * Resolved actor snapshot used anywhere the UI should show a human-friendly
 * name instead of a raw audit UUID.
 */
export interface CashDrawerActorSummary {
  id: string | null
  displayName: string | null
  email: string | null
  phone: string | null
}

/**
 * Compact session snapshot reused in drawer lists and overview cards.
 */
export interface CashDrawerSessionSummarySnapshot {
  id: string
  sessionNo: string
  status: string
  openedAt: string | null
  closedAt: string | null
  openingFloatAmount: number
  expectedCashAmount: number | null
  countedCashAmount: number | null
  differenceAmount: number | null
  paymentCount: number
  movementCount: number
}

/**
 * Drawer row shown in the master table on the cash-drawer hub.
 */
export interface CashDrawerOverviewRow {
  id: string
  drawerCode: string
  drawerName: string
  drawerName2: string | null
  drawerType: string
  branchId: string | null
  branchName: string | null
  branchName2: string | null
  currencyCode: string
  requiresSession: boolean
  openingFloatRequired: boolean
  maxCashLimit: number | null
  assignedTerminalId: string | null
  assignedTerminalName: string | null
  assignedTerminalCode: string | null
  operationalStatus: 'OPEN' | 'CLOSED'
  currentSession: CashDrawerSessionSummarySnapshot | null
  latestSession: CashDrawerSessionSummarySnapshot | null
}

/**
 * Session row shown in the lower detail table on the cash-drawer hub.
 */
export interface CashDrawerSessionListRow {
  id: string
  sessionNo: string
  status: string
  openedAt: string | null
  closedAt: string | null
  openingFloatAmount: number
  expectedCashAmount: number | null
  countedCashAmount: number | null
  differenceAmount: number | null
  paymentCount: number
  movementCount: number
  openedBy: CashDrawerActorSummary | null
  closedBy: CashDrawerActorSummary | null
}

/**
 * Drawer context used by the drawer overview page and the session detail page.
 */
export interface CashDrawerDetailContext {
  id: string
  drawerCode: string
  drawerName: string
  drawerName2: string | null
  drawerType: string
  branchId: string | null
  branchName: string | null
  branchName2: string | null
  currencyCode: string
  requiresSession: boolean
  openingFloatRequired: boolean
  maxCashLimit: number | null
  assignedTerminalId: string | null
  assignedTerminalName: string | null
  assignedTerminalCode: string | null
}

/**
 * Drawer overview payload used by `/cash-drawers/[drawerId]`.
 */
export interface CashDrawerOverviewDetail {
  drawer: CashDrawerDetailContext
  currentSession: CashDrawerSessionListRow | null
  latestSession: CashDrawerSessionListRow | null
  recentSessions: CashDrawerSessionListRow[]
  recentMovements: CashDrawerMovementRow[]
}

/**
 * Movement row shown in recent movement lists and the session detail page.
 */
export interface CashDrawerMovementRow {
  id: string
  movementType: string
  direction: string
  amount: number
  currencyCode: string
  orderId: string | null
  orderPaymentId: string | null
  refundId: string | null
  referenceNo: string | null
  reason: string | null
  performedAt: string | null
  performedBy: CashDrawerActorSummary | null
}

/**
 * Linked payment row shown in the session detail page.
 */
export interface CashDrawerLinkedPaymentRow {
  id: string
  orderId: string
  paymentMethodCode: string
  paymentMethodNameSnapshot: string | null
  paymentStatus: string | null
  amount: number
  currencyCode: string
  tenderedAmount: number | null
  changeReturnedAmount: number | null
  paidAt: string | null
  terminalId: string | null
  terminalName: string | null
  terminalCode: string | null
  receivedBy: CashDrawerActorSummary | null
}

/**
 * Reconciliation totals rendered as summary cards on the session detail page.
 */
export interface CashDrawerReconciliationSummary {
  openingFloat: number
  cashCollected: number
  movementCashIn: number
  movementCashOut: number
  movementNet: number
  expectedCash: number
  countedCash: number | null
  variance: number | null
  paymentCount: number
  movementCount: number
  currencyCode: string | null
}

/**
 * Session lifecycle payload for the session detail page.
 */
export interface CashDrawerSessionLifecycleDetail {
  id: string
  cashDrawerId: string
  sessionNo: string
  status: string
  openedAt: string | null
  openedBy: CashDrawerActorSummary | null
  openingFloatAmount: number
  currencyCode: string
  expectedCashAmount: number
  countedCashAmount: number | null
  differenceAmount: number | null
  closedAt: string | null
  closedBy: CashDrawerActorSummary | null
  closeNotes: string | null
  forceCloseReason: string | null
}

/**
 * Full session payload returned by the hidden session detail route and API.
 */
export interface CashDrawerSessionDetail {
  drawer: CashDrawerDetailContext
  session: CashDrawerSessionLifecycleDetail
  reconciliation: CashDrawerReconciliationSummary
  movements: CashDrawerPaginatedResult<CashDrawerMovementRow>
  linkedPayments: CashDrawerPaginatedResult<CashDrawerLinkedPaymentRow>
}

/**
 * Named exports for the specific paginated cash-drawer API results.
 */
export type CashDrawerOverviewListResult = CashDrawerPaginatedResult<CashDrawerOverviewRow>
export type CashDrawerSessionListResult = CashDrawerPaginatedResult<CashDrawerSessionListRow>

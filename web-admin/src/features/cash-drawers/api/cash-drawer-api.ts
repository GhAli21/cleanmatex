'use client'

import { getCSRFHeader } from '@lib/hooks/use-csrf-token'
import type { CashControlSettings, CashControlValueSource } from '@lib/constants/cash-control'
import type { CashControlSettingsPatchInput } from '@lib/validations/cash-control-schemas'
import type {
  CashDrawerOverviewListResult,
  CashDrawerSessionDetail,
  CashDrawerSessionListResult,
} from '@lib/types/cash-drawer'

interface CashDrawerApiEnvelope<T> {
  success?: boolean
  data?: T
  error?: string
  /** Stable refusal code (plan §4B.11); preferred over `error`, which can be prose (e.g. a branch 403). */
  code?: string
}

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
    opened_by?: string | null
    session_user_id?: string | null
    branch_id?: string | null
    opening_float_amount: number
    opening_counted_amount?: number | null
    opening_denominations?: CashDrawerOpeningDenomination[]
  } | null
  blockingSession?: {
    id: string
    session_no: string
    status: 'CLOSING'
    opened_by: string | null
    session_user_id?: string | null
    branch_id?: string | null
  } | null
}

export interface CashDrawerOpeningDenomination {
  name: string
  valueMinor: number
  quantity: number
  lineAmount: number
}

// -----------------------------------------------------------------------------
// CLF two-step lifecycle (CLF-7 routes, CLF-8 slice A)
// -----------------------------------------------------------------------------

export interface DenominationCountLineInput {
  denominationId: string
  quantity: number
}

export interface OpeningCountInput {
  countMode: 'TOTAL_ONLY' | 'DENOMINATION'
  totalAmount?: number
  denominations?: DenominationCountLineInput[]
}

export interface CurrencyBalancePreview {
  currencyCode: string
  openingExpected?: string
  openingCounted?: string | null
  openingVariance?: string | null
  closingExpected?: string
  closingCounted?: string | null
  closingVariance?: string | null
  varianceReasonRequired?: boolean
}

export interface OpenCashDrawerSessionV2Result {
  sessionId: string
  sessionNo: string
  currencyBalances: CurrencyBalancePreview[]
}

/**
 * Opens a cash drawer session on the CLF two-step lifecycle (CLF-7
 * `openSessionRequestSchema`). The opening-expected figure is always
 * computed by the server from drawer history — this only ever carries an
 * optional physical count taken against it, never a manually declared float.
 */
/** Books the opening count when the session was opened without one. */
export async function recordMissingOpeningCount(input: {
  drawerId: string
  sessionId: string
  openingCount: OpeningCountInput
  notes?: string
  csrfToken: string | null
}): Promise<{ sessionId: string; countedAmount: string }> {
  const response = await fetch(
    `/api/v1/cash-drawers/${input.drawerId}/session/${input.sessionId}/opening-count`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...getCSRFHeader(input.csrfToken) },
      body: JSON.stringify({ openingCount: input.openingCount, notes: input.notes || undefined }),
    },
  )
  return parseCashDrawerResponse<{ sessionId: string; countedAmount: string }>(response)
}

export async function openCashDrawerSessionV2(input: {
  drawerId: string
  openingCount?: OpeningCountInput
  notes?: string
  sessionUserId?: string
  csrfToken: string | null
}): Promise<OpenCashDrawerSessionV2Result> {
  const response = await fetch(`/api/v1/cash-drawers/${input.drawerId}/open-session-v2`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(input.csrfToken) },
    body: JSON.stringify({
      openingCount: input.openingCount,
      notes: input.notes || undefined,
      sessionUserId: input.sessionUserId || undefined,
    }),
  })
  return parseCashDrawerResponse<OpenCashDrawerSessionV2Result>(response)
}

export interface ClosePreviewResult {
  sessionId: string
  revealed: boolean
  currencyBalances: Array<{ currencyCode: string; expected?: string }>
}

/** Read-only preview of what a close would show right now (CLF-7 `close-preview`). */
export async function fetchCashDrawerClosePreviewV2(drawerId: string, sessionId: string): Promise<ClosePreviewResult> {
  return fetchCashDrawerJson<ClosePreviewResult>(`/api/v1/cash-drawers/${drawerId}/session/${sessionId}/close-preview`)
}

export interface StartCloseResult {
  sessionId: string
  currencyBalances: CurrencyBalancePreview[]
}

/** Frozen closing balances for a session that is already CLOSING. */
export async function fetchClosingResume(drawerId: string, sessionId: string): Promise<StartCloseResult> {
  return fetchCashDrawerJson<StartCloseResult>(
    `/api/v1/cash-drawers/${drawerId}/session/${sessionId}/close/resume`,
  )
}

/** The close wizard's count step — freezes the cut and moves the session to CLOSING (CLF-7 `close/count`). */
export async function startCashDrawerClose(input: {
  drawerId: string
  sessionId: string
  closingCount?: OpeningCountInput
  notes?: string
  csrfToken: string | null
}): Promise<StartCloseResult> {
  const response = await fetch(`/api/v1/cash-drawers/${input.drawerId}/session/${input.sessionId}/close/count`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(input.csrfToken) },
    body: JSON.stringify({ closingCount: input.closingCount, notes: input.notes || undefined }),
  })
  return parseCashDrawerResponse<StartCloseResult>(response)
}

export interface DispositionDecisionInput {
  currencyCode: string
  dispositionCode: string
  dispositionNotes?: string
  destDrawerId?: string
  keptAmount?: number
}

export interface FinalizeCloseResultV2 {
  sessionId: string
  status: 'CLOSED' | 'FORCE_CLOSED'
  varianceApprovalPending: boolean
  dispositionTrxId: string | null
}

/** Finalizes a session already in the count step (CLF-7 `close/finalize`). */
export async function finalizeCashDrawerClose(input: {
  drawerId: string
  sessionId: string
  dispositions: DispositionDecisionInput[]
  varianceReason?: string
  csrfToken: string | null
}): Promise<FinalizeCloseResultV2> {
  const response = await fetch(`/api/v1/cash-drawers/${input.drawerId}/session/${input.sessionId}/close/finalize`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(input.csrfToken) },
    body: JSON.stringify({ dispositions: input.dispositions, varianceReason: input.varianceReason || undefined }),
  })
  return parseCashDrawerResponse<FinalizeCloseResultV2>(response)
}

export interface CashDrawerCatalogsV2 {
  drawerTypes: Array<{ code: string; name: string; name2: string | null; isMobile: boolean; canReceiveDisposition: boolean; displayOrder: number }>
  trxTypes: Array<{ code: string; name: string; name2: string | null; allowedSrcTypes: string[]; allowedDestTypes: string[]; requiresNotes: boolean; isSystem: boolean; displayOrder: number }>
  dispositions: Array<{
    code: string
    name: string
    name2: string | null
    cashMoveMode: 'NONE' | 'ALL' | 'PART'
    destDrawerTypeCode: string | null
    requiresNotes: boolean
    requiresKeptAmount: boolean
    isSelectable: boolean
    displayOrder: number
  }>
  postCloseStatuses: Array<{ code: string; name: string; name2: string | null; requiresNotes: boolean; displayOrder: number }>
  countTypes: Array<{ code: string; name: string; name2: string | null; displayOrder: number }>
}

/** Bilingual drawer-type/trx-type/disposition/post-close/count-type catalogs (CLF-7 `catalogs`). */
export async function fetchCashDrawerCatalogs(): Promise<CashDrawerCatalogsV2> {
  return fetchCashDrawerJson<CashDrawerCatalogsV2>('/api/v1/cash-drawers/catalogs')
}

export interface CurrencyDenominationRow {
  id: string
  denominationCode: string
  denominationMinor: number
  denomKind: string
  name: string
  name2: string | null
  displayOrder: number | null
}

/** Active, in-circulation denominations for one currency (CLF-7, CLF-8-1). */
export async function fetchCurrencyDenominations(currencyCode: string): Promise<CurrencyDenominationRow[]> {
  return fetchCashDrawerJson<CurrencyDenominationRow[]>(`/api/v1/currencies/${currencyCode}/denominations`)
}

export interface CashDrawerSessionCloseSummary {
  session: {
    id: string
    session_no: string
    status: string
    opened_at: string | null
    opening_float_amount: number | string | null
    currency_code: string | null
  }
  movements: Array<{
    id: string
    direction: string | null
    movement_type: string | null
    amount: number | string | null
  }>
  payments: Array<{
    id: string
    amount: number | string | null
    currency_code: string | null
    payment_status?: string | null
  }>
  totalCashIn: number | string | null
  totalCashOut: number | string | null
  totalPayments: number | string | null
  reconciliation?: {
    openingFloat: number | string | null
    cashCollected: number | string | null
    movementCashIn: number | string | null
    movementCashOut: number | string | null
    movementNet: number | string | null
    expectedCash: number | string | null
    movementExpectedCash: number | string | null
    paymentCount: number
    movementCount: number
    currencyCode: string | null
  }
}

export interface CashDrawerClosePreview {
  openingFloat: number
  cashCollected: number
  expectedCash: number
  movementCashIn: number
  movementCashOut: number
  movementNet: number
  countedCash: number | null
  variance: number | null
  currencyCode: string | null
  paymentCount: number
  movementCount: number
}

/**
 * Lists active cash drawers with their current open session for legacy POS and
 * checkout consumers.
 *
 * Why:
 * this contract already powers session-linking flows, so it stays untouched
 * while the richer operational screens move to dedicated endpoints.
 *
 * @param branchId optional branch filter for branch-scoped payment flows
 * @returns backward-compatible drawer rows plus current-session snapshot
 */
export async function fetchCashDrawersWithCurrentSession(
  branchId?: string | null,
): Promise<CashDrawerWithCurrentSession[]> {
  const params = new URLSearchParams()
  if (branchId) params.set('branchId', branchId)
  const suffix = params.toString() ? `?${params.toString()}` : ''

  return fetchCashDrawerJson<CashDrawerWithCurrentSession[]>(`/api/v1/cash-drawers${suffix}`)
}

/**
 * Loads the paginated master drawer table for the operational hub.
 *
 * @param input 1-based drawer paging state from the hub URL
 * @returns paginated drawer overview rows
 */
export async function fetchCashDrawerOverview(input: {
  page: number
  pageSize: number
}): Promise<CashDrawerOverviewListResult> {
  const params = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  })

  return fetchCashDrawerJson<CashDrawerOverviewListResult>(
    `/api/v1/cash-drawers/overview?${params.toString()}`,
  )
}

/**
 * Loads the paginated session rows for the selected drawer in the hub.
 *
 * @param input selected drawer id plus 1-based session paging state
 * @returns paginated session rows
 */
export async function fetchCashDrawerSessions(input: {
  drawerId: string
  page: number
  pageSize: number
}): Promise<CashDrawerSessionListResult> {
  const params = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
  })

  return fetchCashDrawerJson<CashDrawerSessionListResult>(
    `/api/v1/cash-drawers/${input.drawerId}/sessions?${params.toString()}`,
  )
}

/**
 * Loads the canonical session detail payload from the cash-drawer read API.
 *
 * @param input route ids plus independent 1-based paging state for movements and payments
 * @returns full session detail DTO
 */
export async function fetchCashDrawerSessionDetail(input: {
  drawerId: string
  sessionId: string
  movementPage?: number
  movementPageSize?: number
  paymentPage?: number
  paymentPageSize?: number
}): Promise<CashDrawerSessionDetail> {
  const params = new URLSearchParams({
    movementPage: String(input.movementPage ?? 1),
    movementPageSize: String(input.movementPageSize ?? 10),
    paymentPage: String(input.paymentPage ?? 1),
    paymentPageSize: String(input.paymentPageSize ?? 10),
  })

  return fetchCashDrawerJson<CashDrawerSessionDetail>(
    `/api/v1/cash-drawers/${input.drawerId}/session/${input.sessionId}?${params.toString()}`,
  )
}

/**
 * Loads drawer-session totals from the existing close-summary API boundary.
 *
 * @param drawerId drawer identifier used by the route contract
 * @param sessionId session identifier used by the route contract
 * @returns low-level summary payload used by drawer-close preview flows
 */
export async function fetchCashDrawerSessionCloseSummary(
  drawerId: string,
  sessionId: string,
): Promise<CashDrawerSessionCloseSummary> {
  const response = await fetch(
    `/api/v1/cash-drawers/${drawerId}/session/${sessionId}/summary`,
    {
      credentials: 'include',
    },
  )

  return parseCashDrawerResponse<CashDrawerSessionCloseSummary>(response)
}

/**
 * B16 — approve an over-threshold drawer-close variance (deferred approval
 * model). No maker-checker: holding `cash_drawer:approve_variance` is
 * sufficient, even when the approver is the user who closed the session.
 *
 * @param input route ids, mandatory reason, and CSRF token
 * @returns the updated session row (raw API shape; re-fetch detail to refresh the DTO)
 */
export async function approveCashDrawerSessionVariance(input: {
  drawerId: string
  sessionId: string
  reason: string
  csrfToken: string | null
}): Promise<unknown> {
  const response = await fetch(
    `/api/v1/cash-drawers/${input.drawerId}/session/${input.sessionId}/approve-variance`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getCSRFHeader(input.csrfToken),
      },
      body: JSON.stringify({ reason: input.reason }),
    },
  )

  return parseCashDrawerResponse<unknown>(response)
}

/**
 * C3 — reject an over-threshold drawer-close variance: not accepted, needs investigation. Same
 * gate as approval (`cash_drawer:approve_variance`); the decision is final.
 *
 * @param input route ids, mandatory reason, and CSRF token
 * @returns the raw API payload (re-fetch detail to refresh the DTO)
 */
export async function rejectCashDrawerSessionVariance(input: {
  drawerId: string
  sessionId: string
  reason: string
  csrfToken: string | null
}): Promise<unknown> {
  const response = await fetch(
    `/api/v1/cash-drawers/${input.drawerId}/session/${input.sessionId}/reject-variance`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...getCSRFHeader(input.csrfToken),
      },
      body: JSON.stringify({ reason: input.reason }),
    },
  )

  return parseCashDrawerResponse<unknown>(response)
}

/** Decision filter of the variance queue. */
export type VarianceQueueDecision = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ALL'

export interface VarianceQueueEntry {
  sessionId: string
  sessionNo: string
  drawerId: string
  drawerName: string | null
  branchId: string
  branchName: string | null
  closedAt: string | null
  closedById: string | null
  closedByName: string | null
  thresholdSnapshot: string
  decision: Exclude<VarianceQueueDecision, 'ALL'>
  decidedById: string | null
  decidedByName: string | null
  decidedAt: string | null
  decisionReason: string | null
  currencies: Array<{
    currencyCode: string
    closingExpected: string | null
    closingCounted: string | null
    closingVariance: string | null
  }>
}

/** Closed drawer sessions whose variance tripped its threshold, by supervisor decision (C3). */
export async function fetchVarianceQueue(input: {
  page: number
  pageSize: number
  decision: VarianceQueueDecision
}): Promise<PagedResult<VarianceQueueEntry>> {
  const params = new URLSearchParams({
    page: String(input.page),
    pageSize: String(input.pageSize),
    decision: input.decision,
  })
  return fetchCashDrawerJson<PagedResult<VarianceQueueEntry>>(`/api/v1/cash-drawers/variance-approvals?${params.toString()}`)
}

export interface BranchPendingDepositStatusRow {
  branchId: string
  branchName: string | null
  hasPendingDepositDrawer: boolean
  drawerId: string | null
}

export interface EnsurePendingDepositDrawerResult {
  drawerId: string
  created: boolean
}

/**
 * Per-branch present/missing status of the system PENDING_DEPOSIT drawer
 * (CLF §4B.2a-B) — feeds the "Create pending-deposit drawer" button on the
 * three tenant screens.
 */
export async function fetchBranchPendingDepositStatus(): Promise<BranchPendingDepositStatusRow[]> {
  return fetchCashDrawerJson<BranchPendingDepositStatusRow[]>('/api/v1/cash-drawers/pending-deposit/status')
}

/**
 * Idempotently creates the branch's system PENDING_DEPOSIT drawer if missing.
 * A second call for the same branch is a no-op, never a duplicate.
 *
 * @param input branch to provision plus CSRF token
 */
export async function ensureBranchPendingDepositDrawer(input: {
  branchId: string
  csrfToken: string | null
}): Promise<EnsurePendingDepositDrawerResult> {
  const response = await fetch('/api/v1/cash-drawers/pending-deposit/ensure', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getCSRFHeader(input.csrfToken),
    },
    body: JSON.stringify({ branchId: input.branchId }),
  })

  return parseCashDrawerResponse<EnsurePendingDepositDrawerResult>(response)
}

// -----------------------------------------------------------------------------
// Drawer overview tabs — Ledger / Transactions / Counts (CLF-7 routes, CLF-8-7)
// -----------------------------------------------------------------------------

export interface PagedResult<T> {
  rows: T[]
  totalCount: number
  page: number
  pageSize: number
}

export interface DrawerLedgerEntry {
  ledgerSeq: string
  domain: 'FIN' | 'TRX'
  entryId: string
  direction: string
  amount: string
  currencyCode: string
  occurredAt: string
  sessionId: string | null
  description: string | null
}

/** One page of the drawer's unified (finance + custody) ledger, newest first. */
export async function fetchDrawerLedger(input: {
  drawerId: string
  page: number
  pageSize: number
}): Promise<PagedResult<DrawerLedgerEntry>> {
  return fetchCashDrawerJson<PagedResult<DrawerLedgerEntry>>(
    `/api/v1/cash-drawers/${input.drawerId}/ledger?page=${input.page}&pageSize=${input.pageSize}`,
  )
}

export interface DrawerTrxEntry {
  trxId: string
  trxNo: string
  trxTypeCode: string
  reasonCode: string | null
  notes: string | null
  performedBy: string
  reversesTrxId: string | null
  occurredAt: string
  lines: Array<{ drawerId: string; direction: string; amount: string; currencyCode: string }>
}

/** One page of custody transactions touching this drawer (either side). */
export async function fetchDrawerTransactions(input: {
  drawerId: string
  page: number
  pageSize: number
}): Promise<PagedResult<DrawerTrxEntry>> {
  return fetchCashDrawerJson<PagedResult<DrawerTrxEntry>>(
    `/api/v1/cash-drawers/trx?drawerId=${input.drawerId}&page=${input.page}&pageSize=${input.pageSize}`,
  )
}

export interface DrawerCountEntry {
  countId: string
  countType: string
  countMethod: string
  currencyCode: string
  cashDrawerSessionId: string | null
  expectedAmount: string
  countedAmount: string
  varianceAmount: string
  supersedesCountId: string | null
  countedBy: string
  notes: string | null
  createdAt: string
}

/** One page of count history (opening / spot / closing / recount), newest first. */
export async function fetchDrawerCounts(input: {
  drawerId: string
  page: number
  pageSize: number
}): Promise<PagedResult<DrawerCountEntry>> {
  return fetchCashDrawerJson<PagedResult<DrawerCountEntry>>(
    `/api/v1/cash-drawers/${input.drawerId}/counts?page=${input.page}&pageSize=${input.pageSize}`,
  )
}

/** Records a standalone SPOT count (optionally against the open session). */
export async function recordDrawerSpotCount(input: {
  drawerId: string
  currencyCode: string
  cashDrawerSessionId?: string
  count: OpeningCountInput
  notes?: string
  csrfToken: string | null
}): Promise<{ countId: string }> {
  const response = await fetch(`/api/v1/cash-drawers/${input.drawerId}/counts`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(input.csrfToken) },
    body: JSON.stringify({
      countType: 'SPOT',
      currencyCode: input.currencyCode,
      cashDrawerSessionId: input.cashDrawerSessionId,
      count: input.count,
      notes: input.notes || undefined,
    }),
  })
  return parseCashDrawerResponse<{ countId: string }>(response)
}

export interface DrawerPolicy {
  settings: CashControlSettings
  sources: Record<keyof CashControlSettings, CashControlValueSource>
}

/** Effective cash-control policy for one drawer, with the source of each value. */
export async function fetchDrawerPolicy(drawerId: string): Promise<DrawerPolicy> {
  return fetchCashDrawerJson<DrawerPolicy>(`/api/v1/cash-drawers/${drawerId}/policy`)
}

/** The count methods a drawer's policy allows (C1-1c). */
export interface DrawerCountPolicyView {
  opening: Array<'TOTAL_ONLY' | 'DENOMINATION'>
  closing: Array<'TOTAL_ONLY' | 'DENOMINATION'>
  openingRequired: boolean
  closingRequired: boolean
}

/** What the open dialog, close wizard and recount dialog may offer when counting this drawer. */
export async function fetchDrawerCountPolicy(drawerId: string): Promise<DrawerCountPolicyView> {
  return fetchCashDrawerJson<DrawerCountPolicyView>(`/api/v1/cash-drawers/${drawerId}/count-policy`)
}

/** Patches drawer-scoped overrides; a field set to `null` clears the override. */
export async function updateDrawerPolicy(input: {
  drawerId: string
  patch: CashControlSettingsPatchInput
  csrfToken: string | null
}): Promise<DrawerPolicy> {
  const response = await fetch(`/api/v1/cash-drawers/${input.drawerId}/policy`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(input.csrfToken) },
    body: JSON.stringify({ patch: input.patch }),
  })
  return parseCashDrawerResponse<DrawerPolicy>(response)
}

/** Posts a custody transaction between drawers (CLF-7 `POST /cash-drawers/trx`). */
export async function postCashDrawerTrx(input: {
  trxTypeCode: string
  branchId: string
  lines: Array<{ drawerId: string; direction: 'IN' | 'OUT'; amount: number; currencyCode: string }>
  notes?: string
  idempotencyKey: string
  csrfToken: string | null
}): Promise<{ trxId: string; trxNo: string }> {
  const response = await fetch('/api/v1/cash-drawers/trx', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(input.csrfToken) },
    body: JSON.stringify({
      trxTypeCode: input.trxTypeCode,
      branchId: input.branchId,
      lines: input.lines,
      notes: input.notes || undefined,
      idempotencyKey: input.idempotencyKey,
    }),
  })
  return parseCashDrawerResponse<{ trxId: string; trxNo: string }>(response)
}

export interface SessionClosureBalanceView {
  currencyCode: string
  openingExpected: string
  openingCounted: string | null
  openingVariance: string | null
  finIn: string
  finOut: string
  /** Net posted change rounding already inside finIn/finOut (+ gain, − loss). */
  changeRounding: string
  trxIn: string
  trxOut: string
  closingExpected: string | null
  closingCounted: string | null
  closingVariance: string | null
  dispositionCode: string | null
  dispositionNotes: string | null
  dispositionDestDrawerId: string | null
  dispositionDestDrawerName: string | null
  dispositionKeptAmount: string | null
}

export interface SessionClosureCountView {
  countId: string
  countType: string
  countMethod: string
  currencyCode: string
  expectedAmount: string
  countedAmount: string
  varianceAmount: string
  countedBy: string
  countedAt: string
  notes: string | null
  supersedesCountId: string | null
  denominations: Array<{
    denominationId: string
    name: string
    name2: string | null
    valueMinor: number
    quantity: number
    lineAmount: string
  }>
}

/** Cash taken and paid out by one POS session (cashier) inside a drawer session; `posSessionId = null` is unattributed cash (E2). */
export interface SessionCashAttributionView {
  posSessionId: string | null
  posSessionNo: string | null
  operatorUserId: string | null
  operatorName: string | null
  currencyCode: string
  cashIn: string
  cashOut: string
  net: string
  lineCount: number
}

export interface SessionClosureViewResult {
  sessionId: string
  status: string
  balances: SessionClosureBalanceView[]
  counts: SessionClosureCountView[]
  attribution: SessionCashAttributionView[]
  postClose: {
    statusCode: string | null
    notes: string | null
    by: string | null
    at: string | null
    history: Array<{ statusCode: string; notes: string | null; changedBy: string | null; changedAt: string | null }>
  }
}

/** Per-currency balances, counts, disposition and post-close log for one session (CLF-8-8). */
export async function fetchSessionClosure(drawerId: string, sessionId: string): Promise<SessionClosureViewResult> {
  return fetchCashDrawerJson<SessionClosureViewResult>(`/api/v1/cash-drawers/${drawerId}/session/${sessionId}/closure`)
}

/** Updates the post-close follow-up status/notes of a closed session (CLF-8-8). */
export async function updateSessionPostClose(input: {
  drawerId: string
  sessionId: string
  postCloseStatusCode: string
  notes?: string
  csrfToken: string | null
}): Promise<{ sessionId: string }> {
  const response = await fetch(`/api/v1/cash-drawers/${input.drawerId}/session/${input.sessionId}/post-close`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(input.csrfToken) },
    body: JSON.stringify({ postCloseStatusCode: input.postCloseStatusCode, notes: input.notes || undefined }),
  })
  return parseCashDrawerResponse<{ sessionId: string }>(response)
}

export interface FollowUpSessionEntry {
  sessionId: string
  sessionNo: string
  drawerId: string
  drawerName: string | null
  branchId: string
  branchName: string | null
  closedAt: string | null
  postCloseStatusCode: string | null
  postCloseNotes: string | null
  pendingDepositAmounts: Array<{ currencyCode: string; amount: string }>
}

/** Closed sessions whose closing cash went to a PENDING_DEPOSIT drawer (CLF-8-9). */
export async function fetchCashDrawerFollowUp(input: {
  page: number
  pageSize: number
  postCloseStatusCode?: string
}): Promise<PagedResult<FollowUpSessionEntry>> {
  const params = new URLSearchParams({ page: String(input.page), pageSize: String(input.pageSize) })
  if (input.postCloseStatusCode) params.set('postCloseStatusCode', input.postCloseStatusCode)
  return fetchCashDrawerJson<PagedResult<FollowUpSessionEntry>>(`/api/v1/cash-drawers/follow-up?${params.toString()}`)
}

async function fetchCashDrawerJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: 'include' })
  return parseCashDrawerResponse<T>(response)
}

async function parseCashDrawerResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => ({}))) as CashDrawerApiEnvelope<T>

  if (!response.ok || payload.success === false) {
    throw new Error(payload.code || payload.error || `Request failed: ${response.status}`)
  }

  if (!payload.data) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return payload.data as T
}

/**
 * Builds the close preview shown before calling the cash-drawer close API.
 *
 * Why:
 * POS session flows only orchestrate the close sequence; cash-drawer
 * reconciliation stays in the cash-drawer domain so every screen shows the same
 * computed totals.
 *
 * @param summary low-level summary payload returned by the cash-drawer API
 * @param countedCashInput operator-entered counted cash value
 * @returns normalized preview values for the confirmation UI
 */
export function buildCashDrawerClosePreview(
  summary: CashDrawerSessionCloseSummary,
  countedCashInput: string,
): CashDrawerClosePreview {
  const reconciliation = summary.reconciliation
  const openingFloat = toAmount(reconciliation?.openingFloat ?? summary.session.opening_float_amount)
  const cashCollected = toAmount(reconciliation?.cashCollected ?? summary.totalPayments)
  const movementCashIn = toAmount(reconciliation?.movementCashIn ?? summary.totalCashIn)
  const movementCashOut = toAmount(reconciliation?.movementCashOut ?? summary.totalCashOut)
  // A2: drawer movements are audit context, not folded into expected cash — sale
  // cash is already in `cashCollected` (payments). The server's
  // `reconciliation.expectedCash` is preferred when present (it also nets in
  // manual float/petty movements, which this client payload can't distinguish);
  // without it, fall back to opening float + cash collected.
  const expectedCash = toAmount(reconciliation?.expectedCash ?? openingFloat + cashCollected)
  const countedCash = parseCountedCash(countedCashInput)

  return {
    openingFloat,
    cashCollected,
    expectedCash,
    movementCashIn,
    movementCashOut,
    movementNet: movementCashIn - movementCashOut,
    countedCash,
    variance: countedCash == null ? null : countedCash - expectedCash,
    currencyCode:
      reconciliation?.currencyCode ??
      summary.session.currency_code ??
      summary.payments[0]?.currency_code ??
      null,
    paymentCount: reconciliation?.paymentCount ?? summary.payments.length,
    movementCount: reconciliation?.movementCount ?? summary.movements.length,
  }
}

function toAmount(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0

  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }

  return 0
}

function parseCountedCash(value: string): number | null {
  if (value.trim().length === 0) return null

  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export interface RecountCloseResultView {
  sessionId: string
  currencyCode: string
  closingExpected: string
  closingCounted: string
  closingVariance: string
  varianceReasonRequired: boolean
}

/**
 * Supervisor recount of a session in the count step (`CLOSING`). Supersedes the prior closing (or
 * recount) count of one currency against the same frozen cut; needs `cash_drawer:approve_variance`.
 */
export async function recountCashDrawerClose(input: {
  drawerId: string
  sessionId: string
  currencyCode: string
  count: OpeningCountInput
  supersedesCountId: string
  notes?: string
  csrfToken: string | null
}): Promise<RecountCloseResultView> {
  const response = await fetch(`/api/v1/cash-drawers/${input.drawerId}/session/${input.sessionId}/close/recount`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(input.csrfToken) },
    body: JSON.stringify({
      currencyCode: input.currencyCode,
      count: input.count,
      supersedesCountId: input.supersedesCountId,
      notes: input.notes || undefined,
    }),
  })
  return parseCashDrawerResponse<RecountCloseResultView>(response)
}

/**
 * Supervisor force-close of a session from `OPEN` (the count step never ran) or `CLOSING`
 * (abandoned mid-close). A reason is mandatory; the same disposition rules as a normal close
 * apply. Needs `pos_session:force_close`.
 */
export async function forceCloseCashDrawerSession(input: {
  drawerId: string
  sessionId: string
  reason: string
  dispositions: DispositionDecisionInput[]
  csrfToken: string | null
}): Promise<FinalizeCloseResultV2> {
  const response = await fetch(`/api/v1/cash-drawers/${input.drawerId}/session/${input.sessionId}/force-close`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...getCSRFHeader(input.csrfToken) },
    body: JSON.stringify({ reason: input.reason, dispositions: input.dispositions }),
  })
  return parseCashDrawerResponse<FinalizeCloseResultV2>(response)
}

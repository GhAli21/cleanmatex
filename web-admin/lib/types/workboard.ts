/** A tenant branch offered by the Workboard filter. */
export interface WorkboardBranchOption {
  id: string
  name: string
}

/** A tenant user offered by the Workboard assignee filter. */
export interface WorkboardAssigneeOption {
  id: string
  name: string
}

/** Stage screens that can own a Workboard order row. */
export type WorkboardOwnerScreenKey =
  | 'preparation'
  | 'processing'
  | 'assembly'
  | 'qa'
  | 'packing'
  | 'ready_release'
  | 'driver_delivery'

/** Server-side ordering modes available to the Workboard queue. */
export type WorkboardSort =
  | 'age_desc'
  | 'age_asc'
  | 'ready_by_asc'
  | 'ready_by_desc'
  | 'order_no_asc'
  | 'order_no_desc'
  | 'customer_asc'
  | 'customer_desc'
  | 'stage_asc'
  | 'stage_desc'
  | 'priority_asc'
  | 'priority_desc'
  | 'assignee_asc'
  | 'assignee_desc'

/** Server-owned SLA classification evaluated in the tenant business time zone. */
/** Read-only filters accepted by the Workboard API. */
export interface WorkboardQueryInput {
  page: number
  pageSize: number
  search?: string
  branchId?: string
  assigneeId?: string
  priority?: string
  ownerScreenKey?: WorkboardOwnerScreenKey
  blocker?: 'all' | 'blocked' | 'clear'
  sla?: 'all' | 'overdue' | 'due_today' | 'not_due'
  sort?: WorkboardSort
}

/** A configured status that could not be routed to a stage-owned screen. */
export interface WorkboardConfigurationGap {
  statusCode: string
  reason: 'no_stage_owner'
}

/** A single supervisor queue item. This object never exposes a transition command. */
export interface WorkboardOrderRow {
  id: string
  orderNo: string
  customerName: string
  customerPhone: string | null
  branchName: string | null
  statusCode: string
  statusName: string
  statusName2: string | null
  ownerScreenKey: WorkboardOwnerScreenKey
  ownerPath: string
  assigneeName: string | null
  priority: string | null
  isBlocked: boolean
  receivedAt: string | null
  lastTransitionAt: string | null
  readyByAt: string | null
  ageMinutes: number
}

/** Aggregate figures for the active Workboard filter set. */
export interface WorkboardSummary {
  total: number
  blocked: number
  overdue: number
  byOwner: Record<WorkboardOwnerScreenKey, number>
}

/** Filter metadata and policy diagnostics returned with each Workboard page. */
export interface WorkboardMetadata {
  branches: WorkboardBranchOption[]
  assignees: WorkboardAssigneeOption[]
  priorities: string[]
  configurationGaps: WorkboardConfigurationGap[]
}

/** Paginated response returned by the Workboard query API. */
export interface WorkboardListResponse {
  rows: WorkboardOrderRow[]
  total: number
  page: number
  pageSize: number
  summary: WorkboardSummary
  metadata: WorkboardMetadata
}

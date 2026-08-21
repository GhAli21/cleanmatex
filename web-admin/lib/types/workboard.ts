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

/** Read-only filters accepted by the Workboard API. */
export interface WorkboardQueryInput {
  page: number
  pageSize: number
  search?: string
  branchId?: string
  assigneeId?: string
  priority?: string
  blocker?: 'all' | 'blocked' | 'clear'
  sla?: 'all' | 'overdue' | 'due_today' | 'not_due'
  sort?: 'age_desc' | 'ready_by_asc'
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
  ownerScreenKey: string
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

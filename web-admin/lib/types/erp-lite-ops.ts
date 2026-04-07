// ============================================================
// ERP-Lite Operational Screens — Shared Type Definitions
// Covers: Finance Readiness, Usage Maps, Exceptions,
//         Periods, and Posting Audit screens (Phase 4).
// ============================================================

// -------------------------------------------------------
// Finance Readiness
// -------------------------------------------------------

/** Readiness classification returned by vw_fin_tenant_readiness */
export type ReadinessStatus = 'READY' | 'WARNING' | 'NOT_READY'

export interface ErpLiteTenantReadiness {
  tenant_org_id: string
  missing_required_mappings: number
  total_required_mappings: number
  open_exception_count: number
  open_period_count: number
  last_template_applied_at: string | null
  last_template_pkg_code: string | null
  last_apply_status: string | null
  last_posted_at: string | null
  last_failed_at: string | null
  total_coa_accounts: number
  postable_coa_accounts: number
  inactive_coa_accounts: number
  has_gov_assignment: boolean
  readiness_status: ReadinessStatus
}

export type MappingIssue = 'MISSING' | 'ACCOUNT_INACTIVE' | 'ACCOUNT_NOT_POSTABLE' | 'TYPE_MISMATCH' | 'OK'

export interface ErpLiteMissingUsageRow {
  tenant_org_id: string
  usage_code_id: string
  usage_code: string
  usage_code_name: string
  usage_code_name2: string | null
  is_required: boolean
  required_acc_type_code: string | null
  required_acc_type_name: string | null
  mapping_id: string | null
  mapped_account_id: string | null
  mapped_account_code: string | null
  mapped_account_name: string | null
  mapped_acc_type_code: string | null
  mapping_issue: MappingIssue
  effective_from: string | null
  effective_to: string | null
  mapping_status: string | null
}

// -------------------------------------------------------
// Usage Mapping Console
// -------------------------------------------------------

export type UsageMapStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE'

export interface ErpLiteUsageMapRow {
  id: string
  tenant_org_id: string
  branch_id: string | null
  branch_name: string | null
  usage_code_id: string
  usage_code: string
  usage_code_name: string
  usage_code_name2: string | null
  is_required: boolean
  account_id: string
  account_code: string
  account_name: string
  account_name2: string | null
  acc_type_code: string | null
  acc_type_name: string | null
  required_acc_type_code: string | null
  status_code: UsageMapStatus
  effective_from: string | null
  effective_to: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
  mapping_issue: MappingIssue
}

export interface CreateUsageMapInput {
  usage_code_id: string
  account_id: string
  branch_id?: string | null
  effective_from?: string | null
  effective_to?: string | null
}

// -------------------------------------------------------
// Exception Workbench
// -------------------------------------------------------

export type ExceptionStatus =
  | 'NEW'
  | 'OPEN'
  | 'RETRY_PENDING'
  | 'RETRIED'
  | 'REPOST_PENDING'
  | 'REPOSTED'
  | 'RESOLVED'
  | 'IGNORED'
  | 'CLOSED'

export type ExceptionTypeCode =
  | 'RULE_NOT_FOUND'
  | 'AMBIGUOUS_RULE'
  | 'ACCOUNT_NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'SYSTEM_ERROR'
  | 'PERIOD_CLOSED'
  | 'DUPLICATE_POST'
  | 'ACCOUNT_INACTIVE'
  | 'ACCOUNT_NOT_POSTABLE'
  | 'MISSING_USAGE_MAPPING'
  | 'ACCOUNT_TYPE_MISMATCH'

export interface ErpLiteOpenExceptionRow {
  exception_id: string
  tenant_org_id: string
  branch_id: string | null
  posting_log_id: string
  source_doc_id: string
  source_doc_type_code: string
  txn_event_code: string
  exception_type_code: ExceptionTypeCode
  status_code: ExceptionStatus
  error_message: string
  resolution_notes: string | null
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
  created_by: string | null
  // posting log context
  idempotency_key: string | null
  attempt_no: number | null
  attempt_status_code: string | null
  log_status_code: string | null
  source_module_code: string | null
  source_doc_no: string | null
  mapping_rule_id: string | null
  mapping_rule_version_no: number | null
  log_error_code: string | null
  retry_of_log_id: string | null
  repost_of_log_id: string | null
  journal_id: string | null
  is_retry_eligible: boolean
  is_repost_eligible: boolean
}

export interface ResolveExceptionInput {
  exception_id: string
  resolution_notes: string
  action: 'RESOLVE' | 'IGNORE' | 'CLOSE'
}

// -------------------------------------------------------
// Period Management
// -------------------------------------------------------

export type PeriodStatus = 'OPEN' | 'CLOSED' | 'SOFT_LOCKED'

export interface ErpLitePeriodRow {
  id: string
  tenant_org_id: string
  period_code: string
  name: string
  name2: string | null
  description: string | null
  start_date: string
  end_date: string
  status_code: PeriodStatus
  lock_reason: string | null
  closed_at: string | null
  closed_by: string | null
  is_active: boolean
  created_at: string
  updated_at: string | null
}

export interface CreatePeriodInput {
  period_code: string
  name: string
  name2?: string | null
  description?: string | null
  start_date: string
  end_date: string
}

export interface ClosePeriodInput {
  period_id: string
  lock_reason?: string | null
}

// -------------------------------------------------------
// Posting Audit Viewer
// -------------------------------------------------------

export type PostLogStatus = 'POSTED' | 'FAILED' | 'REVERSED' | 'PENDING'

export interface ErpLitePostLogRow {
  id: string
  tenant_org_id: string
  branch_id: string | null
  journal_id: string | null
  source_module_code: string
  source_doc_type_code: string
  source_doc_id: string
  source_doc_no: string | null
  txn_event_code: string
  idempotency_key: string
  attempt_no: number
  attempt_status_code: string
  log_status_code: string
  error_code: string | null
  error_message: string | null
  retry_of_log_id: string | null
  repost_of_log_id: string | null
  created_at: string
  updated_at: string | null
}

export interface PostAuditListResult {
  rows: ErpLitePostLogRow[]
  total: number
  page: number
  pageSize: number
}

import type { Json } from '@/types/database';
import type { PaymentMethodCode } from '@/lib/types/payment';
import type {
  ErpLiteAttemptStatus,
  ErpLiteExceptionType,
  ErpLiteLogStatus,
  ErpLitePostingMode,
} from '@/lib/constants/erp-lite-posting';

export interface ErpLitePostingAmounts {
  net_amount: number;
  tax_amount: number;
  gross_amount: number;
  discount_amount?: number;
  delivery_fee_amount?: number;
  rounding_amount?: number;
}

export interface ErpLitePostingDimensions {
  branch_id?: string | null;
  cost_center_id?: string | null;
  profit_center_id?: string | null;
  party_type_code?: string | null;
  party_id?: string | null;
  tax_code?: string | null;
  tax_rate?: number | null;
}

export interface ErpLitePostingMeta {
  created_by?: string | null;
  payment_method_code?: PaymentMethodCode | 'WALLET' | null;
  source_context?: string | null;
  payload_version?: string | null;
}

export interface ErpLitePostingRequest {
  tenant_org_id?: string;
  branch_id?: string | null;
  txn_event_code: string;
  source_module_code: string;
  source_doc_type_code: string;
  source_doc_id: string;
  source_doc_no?: string | null;
  journal_date: string;
  posting_date?: string;
  currency_code: string;
  exchange_rate?: number;
  amounts: ErpLitePostingAmounts;
  dimensions?: ErpLitePostingDimensions;
  meta?: ErpLitePostingMeta;
}

export interface ErpLiteNormalizedPostingRequest {
  tenant_org_id: string;
  branch_id: string | null;
  txn_event_code: string;
  source_module_code: string;
  source_doc_type_code: string;
  source_doc_id: string;
  source_doc_no: string | null;
  journal_date: string;
  posting_date: string;
  currency_code: string;
  exchange_rate: number;
  amounts: Required<ErpLitePostingAmounts>;
  dimensions: ErpLitePostingDimensions;
  meta: ErpLitePostingMeta;
}

export interface ErpLitePostingPreviewLine {
  line_no: number;
  entry_side: 'DEBIT' | 'CREDIT';
  amount_source_code: string;
  amount: number;
  account_id: string;
  account_code: string;
  account_name: string;
  usage_code?: string | null;
  resolver_code?: string | null;
  line_type_code: string;
}

export interface ErpLitePostingPreviewResult {
  success: boolean;
  mode: ErpLitePostingMode;
  posting_log_id?: string;
  idempotency_key?: string;
  package_code?: string;
  package_version_no?: number;
  rule_code?: string;
  rule_version_no?: number;
  journal_date?: string;
  posting_date?: string;
  total_debit?: number;
  total_credit?: number;
  lines?: ErpLitePostingPreviewLine[];
  error_code?: string;
  error_message?: string;
}

export interface ErpLitePostingExecuteResult extends ErpLitePostingPreviewResult {
  journal_id?: string;
  journal_no?: string;
  attempt_status_code?: ErpLiteAttemptStatus;
  log_status_code?: ErpLiteLogStatus;
  exception_id?: string;
  exception_type_code?: ErpLiteExceptionType;
}

export interface ErpLiteRetryParams {
  posting_log_id: string;
}

export interface ErpLiteRepostParams {
  posting_log_id: string;
}

export interface ErpLitePostingRequestEnvelope {
  request: ErpLiteNormalizedPostingRequest;
  mode: ErpLitePostingMode;
  attempt_no: number;
  idempotency_key: string;
  retry_of_log_id?: string | null;
  repost_of_log_id?: string | null;
}

export interface ErpLitePostingLogPayload {
  request_payload_json: Json;
  resolved_payload_json?: Json;
  preview_result_json?: Json;
  execute_result_json?: Json;
}

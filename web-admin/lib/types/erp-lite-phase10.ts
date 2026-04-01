export interface ErpLiteBranchProfitabilityAdvancedRow {
  branch_id: string | null;
  branch_name: string;
  direct_revenue: number;
  direct_expense: number;
  direct_profit: number;
  allocated_in: number;
  allocated_out: number;
  allocated_profit: number;
}

export interface ErpLiteAllocationRuleListItem {
  id: string;
  rule_code: string;
  rule_name: string;
  basis_code: string;
  status_code: string;
  effective_from: string | null;
}

export interface ErpLiteAllocationRunListItem {
  id: string;
  run_no: string;
  run_date: string;
  status_code: string;
  line_count: number;
}

export interface ErpLiteCostComponentListItem {
  id: string;
  comp_code: string;
  component_name: string;
  cost_class_code: string;
  basis_code: string;
  status_code: string;
}

export interface ErpLiteCostRunListItem {
  id: string;
  run_no: string;
  run_date: string;
  status_code: string;
  line_count: number;
  total_cost: number;
}

export interface ErpLiteCostSummaryRow {
  branch_id: string | null;
  branch_name: string;
  total_cost: number;
}

export interface ErpLitePhase10DashboardSnapshot {
  profitability_rows: ErpLiteBranchProfitabilityAdvancedRow[];
  allocation_rules: ErpLiteAllocationRuleListItem[];
  allocation_runs: ErpLiteAllocationRunListItem[];
  cost_components: ErpLiteCostComponentListItem[];
  cost_runs: ErpLiteCostRunListItem[];
  cost_summary_rows: ErpLiteCostSummaryRow[];
  branch_options: { id: string; label: string }[];
  allocation_rule_options: { id: string; label: string }[];
  allocation_run_options: { id: string; label: string }[];
  cost_component_options: { id: string; label: string }[];
  cost_run_options: { id: string; label: string }[];
  latest_alloc_run_no: string | null;
  latest_cost_run_no: string | null;
}

export interface CreateErpLiteAllocationRuleInput {
  rule_code?: string | null;
  name: string;
  name2?: string | null;
  basis_code: 'REVENUE' | 'WEIGHT' | 'PIECES' | 'ORDERS' | 'MANUAL';
  effective_from?: string | null;
  created_by?: string | null;
}

export interface CreateErpLiteAllocationRunInput {
  run_date: string;
  created_by?: string | null;
}

export interface CreateErpLiteAllocationRunLineInput {
  alloc_run_id: string;
  alloc_rule_id?: string | null;
  source_branch_id?: string | null;
  target_branch_id: string;
  source_amount: number;
  alloc_amount: number;
  created_by?: string | null;
}

export interface CreateErpLiteCostComponentInput {
  comp_code?: string | null;
  name: string;
  name2?: string | null;
  cost_class_code: 'DIRECT' | 'INDIRECT';
  basis_code: 'WEIGHT' | 'PIECES' | 'ORDERS' | 'REVENUE' | 'MANUAL';
  created_by?: string | null;
}

export interface CreateErpLiteCostRunInput {
  run_date: string;
  created_by?: string | null;
}

export interface CreateErpLiteCostRunDetailInput {
  cost_run_id: string;
  cost_comp_id: string;
  branch_id?: string | null;
  basis_value?: number | null;
  alloc_amount: number;
  unit_cost?: number | null;
  total_cost: number;
  created_by?: string | null;
}

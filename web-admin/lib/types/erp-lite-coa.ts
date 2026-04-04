export interface ErpLiteCoaOptionItem {
  id: string;
  label: string;
}

export interface ErpLiteCoaAccountListItem {
  id: string;
  account_code: string;
  account_name: string;
  account_level: number;
  account_type_name: string;
  account_group_name: string | null;
  parent_account_code: string | null;
  parent_account_name: string | null;
  branch_name: string | null;
  is_postable: boolean;
  is_control_account: boolean;
  is_system_linked: boolean;
  is_system_seeded: boolean;
  is_locked: boolean;
  manual_post_allowed: boolean;
  allow_tenant_children: boolean;
  is_active: boolean;
}

export interface ErpLiteCoaDashboardSnapshot {
  account_list: ErpLiteCoaAccountListItem[];
  account_type_options: ErpLiteCoaOptionItem[];
  account_group_options: ErpLiteCoaOptionItem[];
  parent_account_options: ErpLiteCoaOptionItem[];
  branch_options: ErpLiteCoaOptionItem[];
}

export interface CreateErpLiteAccountInput {
  account_code: string;
  name: string;
  name2?: string | null;
  acc_type_id: string;
  acc_group_id?: string | null;
  parent_account_id?: string | null;
  branch_id?: string | null;
  description?: string | null;
  description2?: string | null;
  is_postable?: boolean;
  created_by?: string | null;
}

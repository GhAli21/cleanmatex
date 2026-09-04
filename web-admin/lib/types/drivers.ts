export interface OrgDriver {
  id: string;
  tenant_org_id: string;
  branch_id: string | null;
  linked_user_id: string | null;
  name: string;
  name2: string | null;
  phone: string | null;
  vehicle_type: string | null;
  vehicle_plate_no: string | null;
  license_no: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  /** True when this driver currently has a planned or in-progress route — informs the delete-guard and the double-booking picker warning. */
  hasActiveRoute?: boolean;
}

export interface CreateDriverInput {
  name: string;
  name2?: string;
  phone?: string;
  vehicle_type?: string;
  vehicle_plate_no?: string;
  license_no?: string;
  branch_id?: string;
}

export type UpdateDriverInput = Partial<CreateDriverInput>;

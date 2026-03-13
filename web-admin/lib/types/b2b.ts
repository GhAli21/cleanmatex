/**
 * B2B Feature Types
 */

import type {
  StatementStatusCd,
  ContactRoleCd,
} from '@/lib/constants/b2b';

export interface B2BContact {
  id: string;
  tenantOrgId: string;
  customerId: string;
  contactName: string | null;
  contactName2: string | null;
  phone: string | null;
  email: string | null;
  roleCd: ContactRoleCd | string | null;
  isPrimary: boolean;
  recStatus: number;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface B2BContract {
  id: string;
  tenantOrgId: string;
  customerId: string;
  contractNo: string;
  effectiveFrom: string | null;
  effectiveTo: string | null;
  pricingTerms: Record<string, unknown>;
  recStatus: number;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface B2BStatement {
  id: string;
  tenantOrgId: string;
  customerId: string;
  contractId: string | null;
  statementNo: string;
  periodFrom: string | null;
  periodTo: string | null;
  dueDate: string | null;
  totalAmount: number;
  paidAmount: number;
  balanceAmount: number;
  currencyCd: string | null;
  statusCd: StatementStatusCd;
  recStatus: number;
  isActive: boolean;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

export interface CreateB2BContactRequest {
  customerId: string;
  contactName?: string;
  contactName2?: string;
  phone?: string;
  email?: string;
  roleCd?: ContactRoleCd | string;
  isPrimary?: boolean;
}

export interface UpdateB2BContactRequest {
  contactName?: string;
  contactName2?: string;
  phone?: string;
  email?: string;
  roleCd?: ContactRoleCd | string;
  isPrimary?: boolean;
}

export interface CreateB2BContractRequest {
  customerId: string;
  contractNo: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  pricingTerms?: Record<string, unknown>;
}

export interface UpdateB2BContractRequest {
  contractNo?: string;
  effectiveFrom?: string;
  effectiveTo?: string;
  pricingTerms?: Record<string, unknown>;
}

export interface GenerateStatementRequest {
  customerId: string;
  contractId?: string;
  periodFrom: string;
  periodTo: string;
  dueDate?: string;
}

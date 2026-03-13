/**
 * B2B Contracts Service
 * CRUD for org_b2b_contracts_mst with tenant isolation
 */

import { createClient } from '@/lib/supabase/server';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';
import type {
  B2BContract,
  CreateB2BContractRequest,
  UpdateB2BContractRequest,
} from '@/lib/types/b2b';

function mapRowToContract(row: Record<string, unknown>): B2BContract {
  return {
    id: row.id as string,
    tenantOrgId: row.tenant_org_id as string,
    customerId: row.customer_id as string,
    contractNo: row.contract_no as string,
    effectiveFrom: (row.effective_from as string) ?? null,
    effectiveTo: (row.effective_to as string) ?? null,
    pricingTerms: (row.pricing_terms as Record<string, unknown>) ?? {},
    recStatus: Number(row.rec_status) ?? 1,
    isActive: Boolean(row.is_active),
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    createdBy: (row.created_by as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
    updatedBy: (row.updated_by as string) ?? null,
  };
}

export async function listContractsByCustomer(
  customerId: string
): Promise<B2BContract[]> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  const { data, error } = await supabase
    .from('org_b2b_contracts_mst')
    .select('*')
    .eq('tenant_org_id', tenantId)
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .order('effective_from', { ascending: false, nullsFirst: false });

  if (error) {
    logger.error('Error listing B2B contracts', error as Error, {
      feature: 'b2b',
      action: 'listContracts',
      customerId,
    });
    throw new Error('Failed to list contracts: ' + error.message);
  }
  return (data ?? []).map(mapRowToContract);
}

export async function listContracts(filters?: {
  customerId?: string;
}): Promise<B2BContract[]> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  let query = supabase
    .from('org_b2b_contracts_mst')
    .select('*')
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Error listing B2B contracts', error as Error, {
      feature: 'b2b',
      action: 'listContracts',
    });
    throw new Error('Failed to list contracts: ' + error.message);
  }
  return (data ?? []).map(mapRowToContract);
}

async function generateContractNo(tenantId: string): Promise<string> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('org_b2b_contracts_mst')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_org_id', tenantId);

  if (error) throw new Error('Failed to generate contract number');
  const seq = (count ?? 0) + 1;
  const yyyy = new Date().getFullYear();
  const mm = String(new Date().getMonth() + 1).padStart(2, '0');
  return `CON-${yyyy}${mm}-${String(seq).padStart(4, '0')}`;
}

export async function createContract(
  request: CreateB2BContractRequest
): Promise<B2BContract> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  const contractNo =
    request.contractNo && request.contractNo.trim()
      ? request.contractNo.trim()
      : await generateContractNo(tenantId);

  const { data, error } = await supabase
    .from('org_b2b_contracts_mst')
    .insert({
      tenant_org_id: tenantId,
      customer_id: request.customerId,
      contract_no: contractNo,
      effective_from: request.effectiveFrom ?? null,
      effective_to: request.effectiveTo ?? null,
      pricing_terms: request.pricingTerms ?? {},
      rec_status: 1,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating B2B contract', error as Error, {
      feature: 'b2b',
      action: 'createContract',
      customerId: request.customerId,
    });
    throw new Error('Failed to create contract: ' + error.message);
  }
  return mapRowToContract(data as Record<string, unknown>);
}

export async function getContractById(id: string): Promise<B2BContract | null> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  const { data, error } = await supabase
    .from('org_b2b_contracts_mst')
    .select('*')
    .eq('id', id)
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return mapRowToContract(data as Record<string, unknown>);
}

export async function updateContract(
  id: string,
  request: UpdateB2BContractRequest
): Promise<B2BContract> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (request.contractNo !== undefined) updatePayload.contract_no = request.contractNo;
  if (request.effectiveFrom !== undefined) updatePayload.effective_from = request.effectiveFrom;
  if (request.effectiveTo !== undefined) updatePayload.effective_to = request.effectiveTo;
  if (request.pricingTerms !== undefined) updatePayload.pricing_terms = request.pricingTerms;

  const { data, error } = await supabase
    .from('org_b2b_contracts_mst')
    .update(updatePayload)
    .eq('id', id)
    .eq('tenant_org_id', tenantId)
    .select()
    .single();

  if (error) {
    logger.error('Error updating B2B contract', error as Error, {
      feature: 'b2b',
      action: 'updateContract',
      contractId: id,
    });
    throw new Error('Failed to update contract: ' + error.message);
  }
  return mapRowToContract(data as Record<string, unknown>);
}

export async function deleteContract(id: string): Promise<void> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  const { error } = await supabase
    .from('org_b2b_contracts_mst')
    .update({
      is_active: false,
      rec_status: 0,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_org_id', tenantId);

  if (error) {
    logger.error('Error deleting B2B contract', error as Error, {
      feature: 'b2b',
      action: 'deleteContract',
      contractId: id,
    });
    throw new Error('Failed to delete contract: ' + error.message);
  }
}

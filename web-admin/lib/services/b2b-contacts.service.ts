/**
 * B2B Contacts Service
 * CRUD for org_b2b_contacts_dtl with tenant isolation
 */

import { createClient } from '@/lib/supabase/server';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';
import type {
  B2BContact,
  CreateB2BContactRequest,
  UpdateB2BContactRequest,
} from '@/lib/types/b2b';

function mapRowToContact(row: Record<string, unknown>): B2BContact {
  return {
    id: row.id as string,
    tenantOrgId: row.tenant_org_id as string,
    customerId: row.customer_id as string,
    contactName: (row.contact_name as string) ?? null,
    contactName2: (row.contact_name2 as string) ?? null,
    phone: (row.phone as string) ?? null,
    email: (row.email as string) ?? null,
    roleCd: (row.role_cd as string) ?? null,
    isPrimary: Boolean(row.is_primary),
    recStatus: Number(row.rec_status) ?? 1,
    isActive: Boolean(row.is_active),
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    createdBy: (row.created_by as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
    updatedBy: (row.updated_by as string) ?? null,
  };
}

export async function listContactsByCustomer(
  customerId: string
): Promise<B2BContact[]> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  const { data, error } = await supabase
    .from('org_b2b_contacts_dtl')
    .select('*')
    .eq('tenant_org_id', tenantId)
    .eq('customer_id', customerId)
    .eq('is_active', true)
    .order('is_primary', { ascending: false });

  if (error) {
    logger.error('Error listing B2B contacts', error as Error, {
      feature: 'b2b',
      action: 'listContacts',
      customerId,
    });
    throw new Error('Failed to list contacts: ' + error.message);
  }
  return (data ?? []).map(mapRowToContact);
}

export async function createContact(
  request: CreateB2BContactRequest
): Promise<B2BContact> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  const { data, error } = await supabase
    .from('org_b2b_contacts_dtl')
    .insert({
      tenant_org_id: tenantId,
      customer_id: request.customerId,
      contact_name: request.contactName ?? null,
      contact_name2: request.contactName2 ?? null,
      phone: request.phone ?? null,
      email: request.email ?? null,
      role_cd: request.roleCd ?? null,
      is_primary: request.isPrimary ?? false,
      rec_status: 1,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating B2B contact', error as Error, {
      feature: 'b2b',
      action: 'createContact',
      customerId: request.customerId,
    });
    throw new Error('Failed to create contact: ' + error.message);
  }
  return mapRowToContact(data as Record<string, unknown>);
}

export async function updateContact(
  id: string,
  request: UpdateB2BContactRequest
): Promise<B2BContact> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  const { data, error } = await supabase
    .from('org_b2b_contacts_dtl')
    .update({
      contact_name: request.contactName,
      contact_name2: request.contactName2,
      phone: request.phone,
      email: request.email,
      role_cd: request.roleCd,
      is_primary: request.isPrimary,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_org_id', tenantId)
    .select()
    .single();

  if (error) {
    logger.error('Error updating B2B contact', error as Error, {
      feature: 'b2b',
      action: 'updateContact',
      contactId: id,
    });
    throw new Error('Failed to update contact: ' + error.message);
  }
  return mapRowToContact(data as Record<string, unknown>);
}

export async function deleteContact(id: string): Promise<void> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  const { error } = await supabase
    .from('org_b2b_contacts_dtl')
    .update({ is_active: false, rec_status: 0, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('tenant_org_id', tenantId);

  if (error) {
    logger.error('Error deleting B2B contact', error as Error, {
      feature: 'b2b',
      action: 'deleteContact',
      contactId: id,
    });
    throw new Error('Failed to delete contact: ' + error.message);
  }
}

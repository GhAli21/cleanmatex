'use server';
/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { TAX_PERMISSIONS } from '@/lib/constants/permissions/tax-perm';
import { withTenantContext } from '@/lib/db/tenant-context';
import { prisma } from '@/lib/db/prisma';

const REVALIDATE_PATH = '/dashboard/settings/tax';

/** An exemption changes what orders are taxed, so writes need the tax setup permission. */
const canManage = () => hasPermissionServer(TAX_PERMISSIONS.MANAGE_CONFIG);

// ---------------------------------------------------------------------------
// Tax Exemption types
// ---------------------------------------------------------------------------

export interface TaxExemption {
  id: string;
  tenant_org_id: string;
  customer_id: string | null;
  service_type: string | null;
  exemption_type: string;
  certificate_no: string | null;
  valid_from: Date;
  valid_to: Date | null;
  is_active: boolean;
  created_at: Date;
}

export interface CreateTaxExemptionInput {
  customerId?: string;
  exemptionType: string;
  validFrom: string;
  validTo?: string;
  certificateNo?: string;
  serviceType?: string;
}

export interface UpdateTaxExemptionInput {
  exemptionType?: string;
  certificateNo?: string;
  serviceType?: string;
  validFrom?: string;
  validTo?: string | null;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Fetch all active tax exemptions for the tenant */
export async function getTaxExemptionsAction(): Promise<{
  success: boolean;
  data?: TaxExemption[];
  error?: string;
}> {
  try {
    const { tenantId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const exemptions = await prisma.org_tax_exemptions_cf.findMany({
        where: { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
        orderBy: { created_at: 'desc' },
      });
      return { success: true, data: exemptions as unknown as TaxExemption[] };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tax exemptions',
    };
  }
}

/** Update an existing tax exemption */
export async function updateTaxExemptionAction(
  id: string,
  input: UpdateTaxExemptionInput
): Promise<{ success: boolean; data?: TaxExemption; error?: string }> {
  try {
    if (!(await canManage())) return { success: false, error: 'PERMISSION_DENIED' };
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_tax_exemptions_cf.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!existing) return { success: false, error: 'Tax exemption not found' };

      const exemption = await prisma.org_tax_exemptions_cf.update({
        where: { id, tenant_org_id: tenantId },
        data: {
          ...(input.exemptionType !== undefined && { exemption_type: input.exemptionType }),
          ...(input.certificateNo !== undefined && { certificate_no: input.certificateNo || null }),
          ...(input.serviceType !== undefined && { service_type: input.serviceType || null }),
          ...(input.validFrom !== undefined && { valid_from: new Date(input.validFrom) }),
          ...(input.validTo !== undefined && { valid_to: input.validTo ? new Date(input.validTo) : null }),
          updated_by: userId,
          updated_at: new Date(),
        },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: exemption as unknown as TaxExemption };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update tax exemption' };
  }
}

/** Soft-deactivate a tax exemption */
export async function deactivateTaxExemptionAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await canManage())) return { success: false, error: 'PERMISSION_DENIED' };
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      await prisma.org_tax_exemptions_cf.update({
        where: { id, tenant_org_id: tenantId },
        data: { is_active: false, rec_status: 0, updated_by: userId, updated_at: new Date() },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to deactivate exemption' };
  }
}

/** Create a new tax exemption for the tenant */
export async function createTaxExemptionAction(input: CreateTaxExemptionInput): Promise<{
  success: boolean;
  data?: TaxExemption;
  error?: string;
}> {
  try {
    if (!(await canManage())) return { success: false, error: 'PERMISSION_DENIED' };
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const exemption = await prisma.org_tax_exemptions_cf.create({
        data: {
          tenant_org_id:  tenantId,
          customer_id:    input.customerId ?? null,
          service_type:   input.serviceType ?? null,
          exemption_type: input.exemptionType,
          certificate_no: input.certificateNo ?? null,
          valid_from:     new Date(input.validFrom),
          valid_to:       input.validTo ? new Date(input.validTo) : null,
          is_active:      true,
          rec_status:     1,
          created_by:     userId,
          created_at:     new Date(),
        },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: exemption as unknown as TaxExemption };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create tax exemption',
    };
  }
}

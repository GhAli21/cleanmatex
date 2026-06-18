'use server';
/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { withTenantContext } from '@/lib/db/tenant-context';
import { prisma } from '@/lib/db/prisma';

const REVALIDATE_PATH = '/dashboard/settings/tax';

// ---------------------------------------------------------------------------
// Tax Profile types
// ---------------------------------------------------------------------------

export interface TaxProfile {
  id: string;
  tenant_org_id: string;
  name: string;
  name2: string | null;
  tax_type: string;
  rate: number;
  is_compound: boolean;
  applies_to: string[];
  effective_from: Date | null;
  effective_to: Date | null;
  is_default: boolean;
  is_active: boolean;
  rec_status: number;
  created_at: Date;
}

export interface CreateTaxProfileInput {
  name: string;
  name2?: string;
  taxType: 'VAT' | 'GST' | 'CUSTOM';
  rate: number;
  appliesTo?: string;
  isDefault?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
}

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

export interface UpdateTaxProfileInput {
  name?: string;
  name2?: string;
  taxType?: 'VAT' | 'GST' | 'CUSTOM';
  rate?: number;
  isCompound?: boolean;
  appliesTo?: string;
  effectiveFrom?: string;
  effectiveTo?: string | null;
  isDefault?: boolean;
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

/** Fetch all tax profiles for the tenant (active, inactive, and soft-deleted) */
export async function getTaxProfilesAction(): Promise<{
  success: boolean;
  data?: TaxProfile[];
  error?: string;
}> {
  try {
    const { tenantId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const profiles = await prisma.org_tax_profiles_cf.findMany({
        where: { tenant_org_id: tenantId },
        orderBy: { created_at: 'asc' },
      });
      return { success: true, data: profiles as unknown as TaxProfile[] };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch tax profiles',
    };
  }
}

/** Create a new tax profile for the tenant */
export async function createTaxProfileAction(input: CreateTaxProfileInput): Promise<{
  success: boolean;
  data?: TaxProfile;
  error?: string;
}> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const appliesToArr = input.appliesTo
        ? input.appliesTo.split(',').map((s) => s.trim()).filter(Boolean)
        : [];

      const profile = await prisma.org_tax_profiles_cf.create({
        data: {
          tenant_org_id:  tenantId,
          name:           input.name,
          name2:          input.name2 ?? null,
          tax_type:       input.taxType,
          rate:           input.rate,
          is_compound:    false,
          applies_to:     appliesToArr,
          effective_from: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
          effective_to:   input.effectiveTo ? new Date(input.effectiveTo) : null,
          is_default:     input.isDefault ?? false,
          is_active:      true,
          rec_status:     1,
          created_by:     userId,
          created_at:     new Date(),
        },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: profile as unknown as TaxProfile };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create tax profile',
    };
  }
}

/** Set a tax profile as the default for the tenant */
export async function setDefaultTaxProfileAction(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      // Clear existing default
      await prisma.org_tax_profiles_cf.updateMany({
        where: { tenant_org_id: tenantId, is_default: true },
        data: { is_default: false, updated_by: userId, updated_at: new Date() },
      });
      // Set new default
      await prisma.org_tax_profiles_cf.update({
        where: { id },
        data: { is_default: true, updated_by: userId, updated_at: new Date() },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to set default tax profile',
    };
  }
}

/** Toggle a tax profile to inactive (is_active=false, rec_status unchanged) */
export async function deactivateTaxProfileAction(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      await prisma.org_tax_profiles_cf.update({
        where: { id },
        data: { is_active: false, updated_by: userId, updated_at: new Date() },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to deactivate tax profile',
    };
  }
}

/** Toggle a tax profile back to active */
export async function activateTaxProfileAction(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      await prisma.org_tax_profiles_cf.update({
        where: { id },
        data: { is_active: true, rec_status: 1, updated_by: userId, updated_at: new Date() },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to activate tax profile',
    };
  }
}

/** Soft-delete a tax profile (is_active=false, rec_status=0 — shown in red, no further edits) */
export async function softDeleteTaxProfileAction(id: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      await prisma.org_tax_profiles_cf.update({
        where: { id },
        data: { is_active: false, rec_status: 0, updated_by: userId, updated_at: new Date() },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true };
    });
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete tax profile',
    };
  }
}

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

/** Update an existing tax profile */
export async function updateTaxProfileAction(
  id: string,
  input: UpdateTaxProfileInput
): Promise<{ success: boolean; data?: TaxProfile; error?: string }> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_tax_profiles_cf.findFirst({
        where: { id, tenant_org_id: tenantId, rec_status: 1 },
      });
      if (!existing) return { success: false, error: 'Tax profile not found' };

      const appliesToArr =
        input.appliesTo !== undefined
          ? input.appliesTo.split(',').map((s) => s.trim()).filter(Boolean)
          : undefined;

      const profile = await prisma.org_tax_profiles_cf.update({
        where: { id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.name2 !== undefined && { name2: input.name2 || null }),
          ...(input.taxType !== undefined && { tax_type: input.taxType }),
          ...(input.rate !== undefined && { rate: input.rate }),
          ...(input.isCompound !== undefined && { is_compound: input.isCompound }),
          ...(appliesToArr !== undefined && { applies_to: appliesToArr }),
          ...(input.effectiveFrom !== undefined && { effective_from: new Date(input.effectiveFrom) }),
          ...(input.effectiveTo !== undefined && { effective_to: input.effectiveTo ? new Date(input.effectiveTo) : null }),
          updated_by: userId,
          updated_at: new Date(),
        },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: profile as unknown as TaxProfile };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update tax profile' };
  }
}

/** Update an existing tax exemption */
export async function updateTaxExemptionAction(
  id: string,
  input: UpdateTaxExemptionInput
): Promise<{ success: boolean; data?: TaxExemption; error?: string }> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_tax_exemptions_cf.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!existing) return { success: false, error: 'Tax exemption not found' };

      const exemption = await prisma.org_tax_exemptions_cf.update({
        where: { id },
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
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      await prisma.org_tax_exemptions_cf.update({
        where: { id },
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

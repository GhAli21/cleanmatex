'use server';

import { revalidatePath } from 'next/cache';
import { getAuthContext } from '@/lib/auth/server-auth';
import { withTenantContext } from '@/lib/db/tenant-context';
import { prisma } from '@/lib/db/prisma';
import type {
  OrgPaymentMethodConfig,
  CreatePaymentMethodConfigInput,
  UpdatePaymentMethodConfigInput,
  UpdateGatewayConfigInput,
  GatewayConfig,
} from '@/lib/types/payment';

const REVALIDATE_PATH = '/dashboard/settings/payments';

/** Mask gateway_config secret keys — replaces *_key, *_secret, *_webhook_secret values with "****" */
function maskGatewayConfig(config: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(config).map(([k, v]) => {
      if (typeof v === 'string' && (k.endsWith('_key') || k.endsWith('_secret') || k.endsWith('_webhook_secret'))) {
        return [k, '****'];
      }
      return [k, v];
    })
  );
}

function maskMethodConfig(row: OrgPaymentMethodConfig): OrgPaymentMethodConfig {
  return {
    ...row,
    gateway_config: maskGatewayConfig(row.gateway_config as Record<string, unknown>) as GatewayConfig,
  };
}

/** List all sys_payment_method_cd codes NOT yet configured for this tenant */
export async function getAvailableHqPaymentMethods(): Promise<{
  success: boolean;
  data?: { payment_method_code: string; payment_method_name: string; payment_method_name2: string | null }[];
  error?: string;
}> {
  try {
    const { tenantId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const allMethods = await prisma.sys_payment_method_cd.findMany({
        where: { is_active: true },
        select: { payment_method_code: true, payment_method_name: true, payment_method_name2: true },
        orderBy: { payment_method_name: 'asc' },
      });
      const configured = await prisma.org_payment_methods_cf.findMany({
        where: { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
        select: { payment_method_code: true },
      });
      const configuredCodes = new Set(configured.map((c) => c.payment_method_code));
      const available = allMethods.filter((m) => !configuredCodes.has(m.payment_method_code));
      return { success: true, data: available };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch available methods' };
  }
}

/** List tenant payment method configs with secrets masked */
export async function getPaymentMethodConfigs(): Promise<{
  success: boolean;
  data?: OrgPaymentMethodConfig[];
  error?: string;
}> {
  try {
    const { tenantId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const rows = await prisma.org_payment_methods_cf.findMany({
        where: { tenant_org_id: tenantId, is_active: true, rec_status: 1 },
        orderBy: [{ display_order: 'asc' }, { created_at: 'asc' }],
      });
      return { success: true, data: rows.map((r) => maskMethodConfig(r as unknown as OrgPaymentMethodConfig)) };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch payment methods' };
  }
}

/** Fetch single payment method config */
export async function getPaymentMethodConfig(
  id: string
): Promise<{ success: boolean; data?: OrgPaymentMethodConfig; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const row = await prisma.org_payment_methods_cf.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!row) return { success: false, error: 'Payment method config not found' };
      return { success: true, data: maskMethodConfig(row as unknown as OrgPaymentMethodConfig) };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to fetch payment method config' };
  }
}

/** Enable a new payment method for this tenant */
export async function createPaymentMethodConfig(
  input: CreatePaymentMethodConfigInput
): Promise<{ success: boolean; data?: OrgPaymentMethodConfig; error?: string }> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const row = await prisma.org_payment_methods_cf.create({
        data: {
          tenant_org_id: tenantId,
          payment_method_code: input.payment_method_code,
          gateway_code: input.gateway_code ?? null,
          display_name: input.display_name,
          display_name2: input.display_name2 ?? null,
          description: input.description ?? null,
          description2: input.description2 ?? null,
          payment_nature: input.payment_nature,
          is_enabled: true,
          allowed_in_pos: input.allowed_in_pos ?? true,
          allowed_in_customer_app: input.allowed_in_customer_app ?? false,
          allowed_in_staff_app: input.allowed_in_staff_app ?? true,
          allowed_in_admin_app: input.allowed_in_admin_app ?? true,
          allowed_for_pay_now: input.allowed_for_pay_now ?? true,
          allowed_for_pay_on_collection: input.allowed_for_pay_on_collection ?? true,
          allowed_for_invoice_payment: input.allowed_for_invoice_payment ?? true,
          allowed_for_refund: input.allowed_for_refund ?? true,
          supports_partial_payment: input.supports_partial_payment ?? true,
          supports_overpayment: input.supports_overpayment ?? false,
          supports_change_return: input.supports_change_return ?? false,
          requires_reference: input.requires_reference ?? false,
          requires_approval: input.requires_approval ?? false,
          min_amount: input.min_amount ?? null,
          max_amount: input.max_amount ?? null,
          currency_code: input.currency_code ?? null,
          fee_type: input.fee_type ?? 'NONE',
          fee_amount: input.fee_amount ?? 0,
          fee_rate: input.fee_rate ?? 0,
          gateway_config: (input.gateway_config as object) ?? {},
          display_order: input.display_order ?? 0,
          created_by: userId,
          created_at: new Date(),
          rec_status: 1,
          is_active: true,
        },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: maskMethodConfig(row as unknown as OrgPaymentMethodConfig) };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create payment method config' };
  }
}

/** Update non-secret fields of a payment method config */
export async function updatePaymentMethodConfig(
  id: string,
  input: UpdatePaymentMethodConfigInput
): Promise<{ success: boolean; data?: OrgPaymentMethodConfig; error?: string }> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_payment_methods_cf.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!existing) return { success: false, error: 'Payment method config not found' };
      const row = await prisma.org_payment_methods_cf.update({
        where: { id },
        data: {
          ...(input.display_name !== undefined && { display_name: input.display_name }),
          ...(input.display_name2 !== undefined && { display_name2: input.display_name2 }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.description2 !== undefined && { description2: input.description2 }),
          ...(input.payment_nature !== undefined && { payment_nature: input.payment_nature }),
          ...(input.allowed_in_pos !== undefined && { allowed_in_pos: input.allowed_in_pos }),
          ...(input.allowed_in_customer_app !== undefined && { allowed_in_customer_app: input.allowed_in_customer_app }),
          ...(input.allowed_in_staff_app !== undefined && { allowed_in_staff_app: input.allowed_in_staff_app }),
          ...(input.allowed_in_admin_app !== undefined && { allowed_in_admin_app: input.allowed_in_admin_app }),
          ...(input.allowed_for_pay_now !== undefined && { allowed_for_pay_now: input.allowed_for_pay_now }),
          ...(input.allowed_for_pay_on_collection !== undefined && { allowed_for_pay_on_collection: input.allowed_for_pay_on_collection }),
          ...(input.allowed_for_invoice_payment !== undefined && { allowed_for_invoice_payment: input.allowed_for_invoice_payment }),
          ...(input.allowed_for_refund !== undefined && { allowed_for_refund: input.allowed_for_refund }),
          ...(input.supports_partial_payment !== undefined && { supports_partial_payment: input.supports_partial_payment }),
          ...(input.supports_overpayment !== undefined && { supports_overpayment: input.supports_overpayment }),
          ...(input.supports_change_return !== undefined && { supports_change_return: input.supports_change_return }),
          ...(input.requires_reference !== undefined && { requires_reference: input.requires_reference }),
          ...(input.requires_approval !== undefined && { requires_approval: input.requires_approval }),
          ...(input.min_amount !== undefined && { min_amount: input.min_amount }),
          ...(input.max_amount !== undefined && { max_amount: input.max_amount }),
          ...(input.currency_code !== undefined && { currency_code: input.currency_code }),
          ...(input.fee_type !== undefined && { fee_type: input.fee_type }),
          ...(input.fee_amount !== undefined && { fee_amount: input.fee_amount }),
          ...(input.fee_rate !== undefined && { fee_rate: input.fee_rate }),
          ...(input.display_order !== undefined && { display_order: input.display_order }),
          updated_by: userId,
          updated_at: new Date(),
        },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: maskMethodConfig(row as unknown as OrgPaymentMethodConfig) };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update payment method config' };
  }
}

/** Update gateway credentials — write-only, never returned in full again */
export async function updateGatewayConfig(
  id: string,
  input: UpdateGatewayConfigInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_payment_methods_cf.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!existing) return { success: false, error: 'Payment method config not found' };
      await prisma.org_payment_methods_cf.update({
        where: { id },
        data: {
          gateway_config: input.gateway_config as object,
          updated_by: userId,
          updated_at: new Date(),
        },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to update gateway config' };
  }
}

/** Toggle enabled state — optimistic-friendly, returns updated is_enabled */
export async function togglePaymentMethodEnabled(
  id: string,
  isEnabled: boolean
): Promise<{ success: boolean; data?: { is_enabled: boolean }; error?: string }> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_payment_methods_cf.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!existing) return { success: false, error: 'Payment method config not found' };
      const row = await prisma.org_payment_methods_cf.update({
        where: { id },
        data: { is_enabled: isEnabled, updated_by: userId, updated_at: new Date() },
        select: { is_enabled: true },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true, data: { is_enabled: row.is_enabled } };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to toggle payment method' };
  }
}

/** Soft-delete a payment method config — rejects if active branch overrides exist */
export async function softDeletePaymentMethodConfig(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { tenantId, userId } = await getAuthContext();
    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_payment_methods_cf.findFirst({
        where: { id, tenant_org_id: tenantId, is_active: true },
      });
      if (!existing) return { success: false, error: 'Payment method config not found' };

      const branchOverrides = await prisma.org_branch_payment_methods_cf.count({
        where: { org_payment_method_id: id, is_active: true, rec_status: 1 },
      });
      if (branchOverrides > 0) {
        return { success: false, error: 'Cannot deactivate: active branch overrides exist. Remove them first.' };
      }

      await prisma.org_payment_methods_cf.update({
        where: { id },
        data: { is_active: false, rec_status: 0, updated_by: userId, updated_at: new Date() },
      });
      revalidatePath(REVALIDATE_PATH);
      return { success: true };
    });
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to deactivate payment method config' };
  }
}

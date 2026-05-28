import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import type {
  GatewayConfig,
  OrgBranchPaymentMethodConfig,
  OrgPaymentMethodConfig,
} from '@/lib/types/payment';

interface PaymentMethodSourceRow {
  id: string;
  tenant_org_id: string;
  payment_method_code: string;
  gateway_code: string | null;
  display_name: string;
  display_name2: string | null;
  description: string | null;
  description2: string | null;
  payment_nature: string;
  settlement_type_code: string | null;
  credit_application_type: string | null;
  is_enabled: boolean;
  allowed_in_pos: boolean;
  allowed_in_customer_app: boolean;
  allowed_in_staff_app: boolean;
  allowed_in_admin_app: boolean;
  allowed_for_pay_now: boolean;
  allowed_for_pay_on_collection: boolean;
  allowed_for_invoice_payment: boolean;
  allowed_for_refund: boolean;
  supports_partial_payment: boolean;
  supports_overpayment: boolean;
  supports_change_return: boolean;
  requires_reference: boolean;
  requires_approval: boolean;
  requires_cash_drawer: boolean;
  requires_terminal: boolean;
  min_amount: number | null;
  max_amount: number | null;
  min_order_amount: number | null;
  max_order_amount: number | null;
  currency_code: string | null;
  fee_type: string;
  fee_amount: number;
  fee_rate: number;
  gateway_config: Record<string, unknown>;
  ui_config: Record<string, unknown>;
  validation_rules: Record<string, unknown>;
  metadata: Record<string, unknown>;
  display_order: number;
  is_active: boolean;
  is_platform_disabled: boolean;
  created_at: Date | null;
  created_by: string | null;
  updated_at: Date | null;
  updated_by: string | null;
  rec_status: number;
  sys_globally_disabled: boolean;
  gw_globally_disabled: boolean;
  eff_default_creation_status: string | null;
  eff_allow_status_override: boolean | null;
  eff_requires_reference: boolean | null;
  eff_is_user_id_required: boolean | null;
}

/**
 * Effective tenant payment method config after system defaults and optional branch overrides are applied.
 */
export interface EffectivePaymentMethodConfig extends OrgPaymentMethodConfig {
  settlement_type_code: string | null;
  credit_application_type: string | null;
  min_order_amount: number | null;
  max_order_amount: number | null;
  is_platform_disabled: boolean;
  default_creation_status: string;
  allow_status_override: boolean;
  is_user_id_required: boolean;
  is_globally_disabled: boolean;
  gateway_globally_disabled: boolean;
  branch_override: OrgBranchPaymentMethodConfig | null;
}

/**
 * Branch payment method row shape used by the settings UI to edit nullable overrides against tenant defaults.
 */
export type BranchPaymentMethodView =
  OrgBranchPaymentMethodConfig & {
    payment_method_code: string;
    display_name: string;
    display_name2: string | null;
  };

interface PaymentMethodLookupFilters {
  tenantId: string;
  branchId?: string;
  includeInactive?: boolean;
  methodCodes?: string[];
  methodIds?: string[];
}

interface CheckoutPaymentMethodFilters extends PaymentMethodLookupFilters {
  amount: number;
}

/**
 * Converts nullable Prisma numerics into plain numbers for service comparisons and DTO mapping.
 *
 * @param value Database value that may be null or already numeric-like.
 * @returns Numeric value or null when the source is absent.
 */
function toNumber(value: unknown): number | null {
  return value == null ? null : Number(value);
}

/**
 * Normalizes JSON-like database values into plain records so downstream merges stay type-safe.
 *
 * @param value Database JSON value that may be null, scalar, or object-shaped.
 * @returns Plain record value, or an empty object when the source is not an object.
 */
function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toIsoString(value: Date | null | undefined): string {
  return value?.toISOString() ?? '';
}

function mapBranchOverrideRow(
  row: Awaited<ReturnType<typeof prisma.org_branch_payment_methods_cf.findMany>>[number]
): OrgBranchPaymentMethodConfig {
  return {
    id: row.id,
    tenant_org_id: row.tenant_org_id,
    branch_id: row.branch_id,
    org_payment_method_id: row.org_payment_method_id,
    is_enabled: row.is_enabled ?? null,
    allowed_in_pos: row.allowed_in_pos ?? null,
    allowed_in_customer_app: row.allowed_in_customer_app ?? null,
    allowed_in_staff_app: row.allowed_in_staff_app ?? null,
    allowed_for_pay_now: row.allowed_for_pay_now ?? null,
    allowed_for_pay_on_collection: row.allowed_for_pay_on_collection ?? null,
    allowed_for_invoice_payment: row.allowed_for_invoice_payment ?? null,
    allowed_for_refund: row.allowed_for_refund ?? null,
    cash_drawer_required: row.cash_drawer_required,
    terminal_required: row.terminal_required,
    min_amount: toNumber(row.min_amount),
    max_amount: toNumber(row.max_amount),
    branch_gateway_config: toRecord(row.branch_gateway_config),
    metadata: toRecord(row.metadata),
    display_order: row.display_order,
    is_active: row.is_active,
    created_at: toIsoString(row.created_at ?? null),
    updated_at: row.updated_at?.toISOString() ?? null,
    rec_status: row.rec_status,
  };
}

function mapTenantMethodRow(row: PaymentMethodSourceRow): OrgPaymentMethodConfig {
  return {
    id: row.id,
    tenant_org_id: row.tenant_org_id,
    payment_method_code: row.payment_method_code,
    gateway_code: row.gateway_code ?? null,
    display_name: row.display_name,
    display_name2: row.display_name2 ?? null,
    description: row.description ?? null,
    description2: row.description2 ?? null,
    payment_nature: row.payment_nature as OrgPaymentMethodConfig['payment_nature'],
    is_enabled: row.is_enabled,
    allowed_in_pos: row.allowed_in_pos,
    allowed_in_customer_app: row.allowed_in_customer_app,
    allowed_in_staff_app: row.allowed_in_staff_app,
    allowed_in_admin_app: row.allowed_in_admin_app,
    allowed_for_pay_now: row.allowed_for_pay_now,
    allowed_for_pay_on_collection: row.allowed_for_pay_on_collection,
    allowed_for_invoice_payment: row.allowed_for_invoice_payment,
    allowed_for_refund: row.allowed_for_refund,
    supports_partial_payment: row.supports_partial_payment,
    supports_overpayment: row.supports_overpayment,
    supports_change_return: row.supports_change_return,
    requires_reference: row.eff_requires_reference ?? row.requires_reference,
    requires_approval: row.requires_approval,
    requires_cash_drawer: row.requires_cash_drawer,
    requires_terminal: row.requires_terminal,
    min_amount: toNumber(row.min_amount),
    max_amount: toNumber(row.max_amount),
    currency_code: row.currency_code ?? null,
    fee_type: row.fee_type as OrgPaymentMethodConfig['fee_type'],
    fee_amount: row.fee_amount ?? 0,
    fee_rate: row.fee_rate ?? 0,
    gateway_config: toRecord(row.gateway_config) as GatewayConfig,
    ui_config: toRecord(row.ui_config),
    validation_rules: toRecord(row.validation_rules),
    metadata: toRecord(row.metadata),
    display_order: row.display_order,
    is_active: row.is_active,
    created_at: toIsoString(row.created_at ?? null),
    created_by: row.created_by ?? null,
    updated_at: row.updated_at?.toISOString() ?? null,
    updated_by: row.updated_by ?? null,
    rec_status: row.rec_status,
  };
}

function buildEffectivePaymentMethod(
  row: PaymentMethodSourceRow,
  branchOverride: OrgBranchPaymentMethodConfig | null
): EffectivePaymentMethodConfig {
  return {
    ...mapTenantMethodRow(row),
    settlement_type_code: row.settlement_type_code ?? null,
    credit_application_type: row.credit_application_type ?? null,
    min_order_amount: toNumber(row.min_order_amount),
    max_order_amount: toNumber(row.max_order_amount),
    is_platform_disabled: row.is_platform_disabled,
    default_creation_status: row.eff_default_creation_status ?? 'PENDING',
    allow_status_override: row.eff_allow_status_override ?? false,
    is_user_id_required: row.eff_is_user_id_required ?? false,
    is_globally_disabled: row.sys_globally_disabled ?? false,
    gateway_globally_disabled: row.gw_globally_disabled ?? false,
    branch_override: branchOverride,
  };
}

function mergeBranchOverrides(
  row: PaymentMethodSourceRow,
  branchOverride: OrgBranchPaymentMethodConfig
): PaymentMethodSourceRow {
  return {
    ...row,
    is_enabled: branchOverride.is_enabled ?? row.is_enabled,
    allowed_in_pos: branchOverride.allowed_in_pos ?? row.allowed_in_pos,
    allowed_in_customer_app:
      branchOverride.allowed_in_customer_app ?? row.allowed_in_customer_app,
    allowed_in_staff_app:
      branchOverride.allowed_in_staff_app ?? row.allowed_in_staff_app,
    allowed_for_pay_now:
      branchOverride.allowed_for_pay_now ?? row.allowed_for_pay_now,
    allowed_for_pay_on_collection:
      branchOverride.allowed_for_pay_on_collection ?? row.allowed_for_pay_on_collection,
    allowed_for_invoice_payment:
      branchOverride.allowed_for_invoice_payment ?? row.allowed_for_invoice_payment,
    allowed_for_refund:
      branchOverride.allowed_for_refund ?? row.allowed_for_refund,
    requires_cash_drawer:
      branchOverride.cash_drawer_required ?? row.requires_cash_drawer,
    requires_terminal:
      branchOverride.terminal_required ?? row.requires_terminal,
    min_amount: branchOverride.min_amount ?? row.min_amount,
    max_amount: branchOverride.max_amount ?? row.max_amount,
    min_order_amount: branchOverride.min_amount ?? row.min_order_amount,
    max_order_amount: branchOverride.max_amount ?? row.max_order_amount,
    display_order: branchOverride.display_order ?? row.display_order,
    gateway_config: {
      ...toRecord(row.gateway_config),
      ...toRecord(branchOverride.branch_gateway_config),
    },
    metadata: {
      ...toRecord(row.metadata),
      branch_override: {
        id: branchOverride.id,
        branch_id: branchOverride.branch_id,
        is_enabled: branchOverride.is_enabled,
        allowed_in_pos: branchOverride.allowed_in_pos,
        allowed_in_customer_app: branchOverride.allowed_in_customer_app,
        allowed_in_staff_app: branchOverride.allowed_in_staff_app,
        allowed_for_pay_now: branchOverride.allowed_for_pay_now,
        allowed_for_pay_on_collection: branchOverride.allowed_for_pay_on_collection,
        allowed_for_invoice_payment: branchOverride.allowed_for_invoice_payment,
        allowed_for_refund: branchOverride.allowed_for_refund,
        cash_drawer_required: branchOverride.cash_drawer_required,
        terminal_required: branchOverride.terminal_required,
        min_amount: branchOverride.min_amount,
        max_amount: branchOverride.max_amount,
      },
    },
  };
}

async function loadTenantPaymentMethodRows({
  tenantId,
  includeInactive = false,
  methodCodes,
  methodIds,
}: Omit<PaymentMethodLookupFilters, 'branchId'>): Promise<PaymentMethodSourceRow[]> {
  return withTenantContext(tenantId, async () => {
    const rows = await prisma.org_payment_methods_cf.findMany({
      where: {
        tenant_org_id: tenantId,
        ...(includeInactive ? {} : { is_active: true, rec_status: 1 }),
        ...(methodCodes && methodCodes.length > 0
          ? { payment_method_code: { in: methodCodes } }
          : {}),
        ...(methodIds && methodIds.length > 0
          ? { id: { in: methodIds } }
          : {}),
      },
      include: {
        sys_payment_method_cd: {
          select: {
            is_globally_disabled: true,
            default_creation_status: true,
            allow_status_override: true,
            requires_reference: true,
            is_user_id_required: true,
          },
        },
        sys_payment_gateway_cd: {
          select: {
            is_globally_disabled: true,
          },
        },
      },
      orderBy: [
        { display_order: 'asc' },
        { created_at: 'asc' },
      ],
    }) as Array<
      Awaited<ReturnType<typeof prisma.org_payment_methods_cf.findMany>>[number] & {
        sys_payment_method_cd: {
          is_globally_disabled: boolean;
          default_creation_status: string;
          allow_status_override: boolean;
          requires_reference: boolean;
          is_user_id_required: boolean;
        };
        sys_payment_gateway_cd: {
          is_globally_disabled: boolean;
        } | null;
      }
    >;

    return rows.map((row) => ({
      id: row.id,
      tenant_org_id: row.tenant_org_id,
      payment_method_code: row.payment_method_code,
      gateway_code: row.gateway_code ?? null,
      display_name: row.display_name,
      display_name2: row.display_name2 ?? null,
      description: row.description ?? null,
      description2: row.description2 ?? null,
      payment_nature: row.payment_nature,
      settlement_type_code: row.settlement_type_code ?? null,
      credit_application_type: row.credit_application_type ?? null,
      is_enabled: row.is_enabled,
      allowed_in_pos: row.allowed_in_pos,
      allowed_in_customer_app: row.allowed_in_customer_app,
      allowed_in_staff_app: row.allowed_in_staff_app,
      allowed_in_admin_app: row.allowed_in_admin_app,
      allowed_for_pay_now: row.allowed_for_pay_now,
      allowed_for_pay_on_collection: row.allowed_for_pay_on_collection,
      allowed_for_invoice_payment: row.allowed_for_invoice_payment,
      allowed_for_refund: row.allowed_for_refund,
      supports_partial_payment: row.supports_partial_payment,
      supports_overpayment: row.supports_overpayment,
      supports_change_return: row.supports_change_return,
      requires_reference: row.requires_reference,
      requires_approval: row.requires_approval,
      requires_cash_drawer: row.requires_cash_drawer,
      requires_terminal: row.requires_terminal,
      min_amount: toNumber(row.min_amount),
      max_amount: toNumber(row.max_amount),
      min_order_amount: toNumber(row.min_order_amount),
      max_order_amount: toNumber(row.max_order_amount),
      currency_code: row.currency_code ?? null,
      fee_type: row.fee_type,
      fee_amount: Number(row.fee_amount ?? 0),
      fee_rate: Number(row.fee_rate ?? 0),
      gateway_config: toRecord(row.gateway_config),
      ui_config: toRecord(row.ui_config),
      validation_rules: toRecord(row.validation_rules),
      metadata: toRecord(row.metadata),
      display_order: row.display_order,
      is_active: row.is_active,
      is_platform_disabled: row.is_platform_disabled,
      created_at: row.created_at ?? null,
      created_by: row.created_by ?? null,
      updated_at: row.updated_at ?? null,
      updated_by: row.updated_by ?? null,
      rec_status: row.rec_status,
      sys_globally_disabled: row.sys_payment_method_cd?.is_globally_disabled ?? false,
      gw_globally_disabled: row.sys_payment_gateway_cd?.is_globally_disabled ?? false,
      eff_default_creation_status:
        row.default_creation_status ?? row.sys_payment_method_cd?.default_creation_status ?? null,
      eff_allow_status_override:
        row.allow_status_override ?? row.sys_payment_method_cd?.allow_status_override ?? null,
      eff_requires_reference:
        row.requires_reference ?? row.sys_payment_method_cd?.requires_reference ?? null,
      eff_is_user_id_required:
        row.is_user_id_required ?? row.sys_payment_method_cd?.is_user_id_required ?? null,
    }));
  });
}

async function loadBranchOverrides(
  tenantId: string,
  branchId: string,
  methodIds?: string[]
): Promise<Map<string, OrgBranchPaymentMethodConfig>> {
  const rows = await withTenantContext(tenantId, async () =>
    prisma.org_branch_payment_methods_cf.findMany({
      where: {
        tenant_org_id: tenantId,
        branch_id: branchId,
        is_active: true,
        rec_status: 1,
        ...(methodIds && methodIds.length > 0
          ? { org_payment_method_id: { in: methodIds } }
          : {}),
      },
    })
  );

  return new Map(rows.map((row) => [row.org_payment_method_id, mapBranchOverrideRow(row)]));
}

/**
 * Loads tenant payment method rows exactly as configured at tenant level.
 *
 * @param tenantId Tenant identifier.
 * @returns Active tenant payment method configs without branch merges.
 */
export async function listTenantPaymentMethodConfigs(
  tenantId: string
): Promise<OrgPaymentMethodConfig[]> {
  const rows = await loadTenantPaymentMethodRows({ tenantId });
  return rows.map(mapTenantMethodRow);
}

/**
 * Loads a single tenant payment method config by row ID.
 *
 * @param tenantId Tenant identifier.
 * @param id Tenant payment method config row ID.
 * @returns The tenant-level config row, or `null` when not found.
 */
export async function getTenantPaymentMethodConfigById(
  tenantId: string,
  id: string
): Promise<OrgPaymentMethodConfig | null> {
  const rows = await loadTenantPaymentMethodRows({ tenantId, methodIds: [id] });
  return rows[0] ? mapTenantMethodRow(rows[0]) : null;
}

/**
 * Resolves effective payment methods after applying system defaults and optional branch overrides.
 *
 * @param filters Tenant, branch, and optional row/code filters for payment method lookup.
 * @returns Effective payment methods ordered by the resolved display order.
 */
export async function listEffectivePaymentMethodConfigs(
  filters: PaymentMethodLookupFilters
): Promise<EffectivePaymentMethodConfig[]> {
  const rows = await loadTenantPaymentMethodRows(filters);
  const overrideMap =
    filters.branchId && rows.length > 0
      ? await loadBranchOverrides(filters.tenantId, filters.branchId, rows.map((row) => row.id))
      : new Map<string, OrgBranchPaymentMethodConfig>();

  return rows
    .map((row) => {
      const branchOverride = overrideMap.get(row.id) ?? null;
      const effectiveRow = branchOverride ? mergeBranchOverrides(row, branchOverride) : row;
      return buildEffectivePaymentMethod(effectiveRow, branchOverride);
    })
    .sort((a, b) => {
      if (a.display_order !== b.display_order) {
        return a.display_order - b.display_order;
      }
      return a.created_at.localeCompare(b.created_at);
    });
}

/**
 * Resolves only the payment methods that are eligible for POS checkout in the given context.
 *
 * @param filters Tenant, optional branch, and order amount filters for POS checkout.
 * @returns Effective payment methods that may appear in the checkout method picker.
 */
export async function listCheckoutEligiblePaymentMethodConfigs(
  filters: CheckoutPaymentMethodFilters
): Promise<EffectivePaymentMethodConfig[]> {
  const methods = await listEffectivePaymentMethodConfigs(filters);

  return methods.filter((method) => {
    if (!method.is_enabled || !method.allowed_in_pos) {
      return false;
    }
    if (method.is_platform_disabled || method.is_globally_disabled || method.gateway_globally_disabled) {
      return false;
    }
    if (Number.isFinite(filters.amount) && filters.amount > 0) {
      if (method.min_order_amount != null && filters.amount < method.min_order_amount) {
        return false;
      }
      if (method.max_order_amount != null && filters.amount > method.max_order_amount) {
        return false;
      }
    }
    return true;
  });
}

/**
 * Builds the branch override editor view with nullable override fields preserved.
 *
 * @param tenantId Tenant identifier.
 * @param branchId Branch identifier.
 * @returns Tenant methods paired with their branch override rows when present.
 */
export async function listBranchPaymentMethodViews(
  tenantId: string,
  branchId: string
): Promise<BranchPaymentMethodView[]> {
  const tenantMethods = await listTenantPaymentMethodConfigs(tenantId);
  const overrideMap = await loadBranchOverrides(
    tenantId,
    branchId,
    tenantMethods.map((method) => method.id)
  );

  return tenantMethods.map((method) => {
    const override = overrideMap.get(method.id);
    return {
      id: override?.id ?? '',
      tenant_org_id: tenantId,
      branch_id: branchId,
      org_payment_method_id: method.id,
      is_enabled: override?.is_enabled ?? null,
      allowed_in_pos: override?.allowed_in_pos ?? null,
      allowed_in_customer_app: override?.allowed_in_customer_app ?? null,
      allowed_in_staff_app: override?.allowed_in_staff_app ?? null,
      allowed_for_pay_now: override?.allowed_for_pay_now ?? null,
      allowed_for_pay_on_collection: override?.allowed_for_pay_on_collection ?? null,
      allowed_for_invoice_payment: override?.allowed_for_invoice_payment ?? null,
      allowed_for_refund: override?.allowed_for_refund ?? null,
      cash_drawer_required: override?.cash_drawer_required ?? false,
      terminal_required: override?.terminal_required ?? false,
      min_amount: override?.min_amount ?? null,
      max_amount: override?.max_amount ?? null,
      branch_gateway_config: override?.branch_gateway_config ?? {},
      metadata: override?.metadata ?? {},
      display_order: override?.display_order ?? method.display_order,
      is_active: override?.is_active ?? true,
      created_at: override?.created_at ?? '',
      updated_at: override?.updated_at ?? null,
      rec_status: override?.rec_status ?? 1,
      payment_method_code: method.payment_method_code,
      display_name: method.display_name,
      display_name2: method.display_name2,
    };
  });
}

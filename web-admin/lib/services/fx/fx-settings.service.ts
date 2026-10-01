/**
 * Tenant-wide FX policy (`org_fin_fx_stng_cf`, plan 01 §5). One row per
 * tenant; no row means the defaults apply (`TENANT_THEN_HQ`, imports land as
 * drafts) — the same "no row = defaults" convention `fx-rate-resolver.service.ts`
 * already reads this table with.
 *
 * Permission gating (`fx_rates:manage`) is the caller's responsibility, same
 * convention as every other service here.
 */

import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { FX_RESOLUTION_POLICY, type FxResolutionPolicy } from '@/lib/constants/currency-fx';

export interface FxSettingsRow {
  resolutionPolicy: FxResolutionPolicy;
  defaultRateTypeCode: string | null;
  autoApproveImports: boolean;
}

export interface UpdateFxSettingsInput {
  resolutionPolicy?: FxResolutionPolicy;
  defaultRateTypeCode?: string | null;
  autoApproveImports?: boolean;
}

const DEFAULTS: FxSettingsRow = {
  resolutionPolicy: FX_RESOLUTION_POLICY.TENANT_THEN_HQ,
  defaultRateTypeCode: null,
  autoApproveImports: false,
};

/** Returns the tenant's FX settings, or the documented defaults when no row exists yet. */
export async function getFxSettings(tenantId: string): Promise<FxSettingsRow> {
  return withTenantContext(tenantId, async (tenant) => {
    const row = await prisma.org_fin_fx_stng_cf.findFirst({ where: { tenant_org_id: tenant, rec_status: 1 } });
    if (!row) return DEFAULTS;
    return {
      resolutionPolicy: row.resolution_policy as FxResolutionPolicy,
      defaultRateTypeCode: row.default_rate_type_code,
      autoApproveImports: row.auto_approve_imports,
    };
  });
}

/** Creates or updates the tenant's one FX settings row (upsert on the tenant-unique key). */
export async function updateFxSettings(
  tenantId: string,
  input: UpdateFxSettingsInput,
  actor: { userId: string; reason?: string }
): Promise<FxSettingsRow> {
  return withTenantContext(tenantId, async (tenant) => {
    const existing = await prisma.org_fin_fx_stng_cf.findFirst({ where: { tenant_org_id: tenant, rec_status: 1 } });

    const patch = {
      ...(input.resolutionPolicy !== undefined && { resolution_policy: input.resolutionPolicy }),
      ...(input.defaultRateTypeCode !== undefined && { default_rate_type_code: input.defaultRateTypeCode }),
      ...(input.autoApproveImports !== undefined && { auto_approve_imports: input.autoApproveImports }),
    };

    const row = existing
      ? await prisma.org_fin_fx_stng_cf.update({
          where: { id: existing.id, tenant_org_id: tenant },
          data: { ...patch, updated_at: new Date(), updated_by: actor.userId, updated_info: actor.reason ?? null },
        })
      : await prisma.org_fin_fx_stng_cf.create({
          data: {
            tenant_org_id: tenant,
            resolution_policy: input.resolutionPolicy ?? DEFAULTS.resolutionPolicy,
            default_rate_type_code: input.defaultRateTypeCode ?? null,
            auto_approve_imports: input.autoApproveImports ?? DEFAULTS.autoApproveImports,
            created_by: actor.userId,
            created_info: actor.reason ?? null,
          },
        });

    return {
      resolutionPolicy: row.resolution_policy as FxResolutionPolicy,
      defaultRateTypeCode: row.default_rate_type_code,
      autoApproveImports: row.auto_approve_imports,
    };
  });
}

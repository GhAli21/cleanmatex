/**
 * Extra Tenant Configuration server service (`sys_tenant_extra_config_cf` + `org_tenant_extra_config_cf`).
 *
 * Security & Separation of Concerns:
 * - Reads `sys_tenant_extra_config_cf` via `catalogReadClient` (closed to `anon`/`authenticated`).
 * - Filters every `org_tenant_extra_config_cf` query and mutation explicitly by `tenant_org_id`.
 * - Delegates value validation and merge resolution to pure `@/lib/config/resolve-extra-config`.
 * - Exposes per-request cached `getRequestExtraConfig()` via React `cache()`.
 *
 * @module lib/services/tenant-extra-config.service
 */

import 'server-only';

import { cache } from 'react';
import { prisma } from '@/lib/db/prisma';
import { getSessionIdentity } from '@/lib/db/tenant-context';
import { catalogReadClient } from '@/lib/supabase/catalog-read';
import { getFeatureFlags } from '@/lib/services/feature-flags.service';
import { DEFAULT_RESOLVED_EXTRA_CONFIG } from '@/lib/constants/tenant-extra-config';
import {
  parseExtraConfigOptions,
  resolveExtraConfig,
  validateExtraConfigValue,
} from '@/lib/config/resolve-extra-config';
import type {
  ExtraConfigSaveEntry,
  ExtraConfigScreenPayload,
  OrgExtraConfigOverride,
  ResolvedExtraConfig,
  SysExtraConfigRow,
} from '@/lib/types/tenant-extra-config';
import { logger } from '@/lib/utils/logger';

/** Actor metadata persisted onto audit columns. */
export interface ExtraConfigActor {
  userId: string;
  userInfo?: string;
}

/** Domain error codes surfaced by Extra Config mutations. */
export type ExtraConfigErrorCode =
  | 'NOT_FOUND'
  | 'INACTIVE_KEY'
  | 'NOT_EDITABLE'
  | 'FEATURE_NOT_IN_PLAN'
  | 'INVALID_VALUE';

export const extraConfigErrorStatus: Record<ExtraConfigErrorCode, number> = {
  NOT_FOUND: 404,
  INACTIVE_KEY: 400,
  NOT_EDITABLE: 403,
  FEATURE_NOT_IN_PLAN: 403,
  INVALID_VALUE: 400,
};

/** Typed service error for clean HTTP status/code mapping. */
export class ExtraConfigError extends Error {
  constructor(
    public readonly code: ExtraConfigErrorCode,
    message: string,
    public readonly configKey?: string
  ) {
    super(message);
    this.name = 'ExtraConfigError';
  }
}

const DEFAULT_FALLBACK_RESOLVED: ResolvedExtraConfig = {
  ...DEFAULT_RESOLVED_EXTRA_CONFIG,
  valuesByKey: {},
};

function mapCatalogRow(raw: Record<string, unknown>): SysExtraConfigRow {
  return {
    config_key: String(raw.config_key),
    category_code: String(raw.category_code),
    name: String(raw.name),
    name2: typeof raw.name2 === 'string' ? raw.name2 : null,
    description: typeof raw.description === 'string' ? raw.description : null,
    description2: typeof raw.description2 === 'string' ? raw.description2 : null,
    value_type: String(raw.value_type),
    default_value: String(raw.default_value),
    allowed_values_json: parseExtraConfigOptions(raw.allowed_values_json),
    validation_regex: typeof raw.validation_regex === 'string' ? raw.validation_regex : null,
    min_num: raw.min_num != null ? Number(raw.min_num) : null,
    max_num: raw.max_num != null ? Number(raw.max_num) : null,
    is_editable_by_tenant: Boolean(raw.is_editable_by_tenant),
    plan_flag_key: typeof raw.plan_flag_key === 'string' ? raw.plan_flag_key : null,
    rec_order: raw.rec_order != null ? Number(raw.rec_order) : null,
    rec_status: Number(raw.rec_status ?? 1),
    is_active: Boolean(raw.is_active ?? true),
  };
}

/**
 * Read active catalog definitions from `sys_tenant_extra_config_cf` using `catalogReadClient`.
 */
export async function listExtraConfigCatalog(): Promise<SysExtraConfigRow[]> {
  const supabase = catalogReadClient();
  const { data, error } = await supabase
    .from('sys_tenant_extra_config_cf')
    .select(
      'config_key, category_code, name, name2, description, description2, value_type, default_value, allowed_values_json, validation_regex, min_num, max_num, is_editable_by_tenant, plan_flag_key, rec_order, rec_status, is_active'
    )
    .eq('rec_status', 1)
    .eq('is_active', true)
    .order('category_code', { ascending: true })
    .order('rec_order', { ascending: true });

  if (error) {
    throw new Error(`sys_tenant_extra_config_cf read failed: ${error.message}`);
  }

  return (data ?? []).map((row) => mapCatalogRow(row as Record<string, unknown>));
}

/**
 * List active tenant overrides for one Organization with explicit `tenant_org_id` filter.
 */
export async function listOrgExtraConfigOverrides(
  tenantId: string
): Promise<OrgExtraConfigOverride[]> {
  const rows = await prisma.org_tenant_extra_config_cf.findMany({
    where: {
      tenant_org_id: tenantId,
      rec_status: 1,
      is_active: true,
    },
    select: {
      id: true,
      tenant_org_id: true,
      config_key: true,
      config_value: true,
      rec_status: true,
      is_active: true,
      updated_at: true,
    },
    orderBy: { config_key: 'asc' },
  });

  return rows;
}

/**
 * Resolve extra configuration + metadata items for Settings UI and API GET.
 */
export async function getExtraConfigScreenData(
  tenantId: string
): Promise<ExtraConfigScreenPayload> {
  const [catalog, overrides, flags] = await Promise.all([
    listExtraConfigCatalog(),
    listOrgExtraConfigOverrides(tenantId),
    getFeatureFlags(tenantId),
  ]);

  return resolveExtraConfig(catalog, overrides, flags as unknown as Record<string, unknown>);
}

/**
 * Request-scoped cached resolver for SSR layouts and Server Components.
 * Batches safely in `Promise.all` with `getRequestTheme()`.
 * Never persists invented defaults on read failure; falls back in memory with error logging.
 */
export const getRequestExtraConfig = cache(async (): Promise<ResolvedExtraConfig> => {
  try {
    const identity = await getSessionIdentity();
    if (!identity?.tenantId) {
      const catalog = await listExtraConfigCatalog();
      return resolveExtraConfig(catalog, [], {}).resolved;
    }

    const payload = await getExtraConfigScreenData(identity.tenantId);
    return payload.resolved;
  } catch (error) {
    logger.error(
      'getRequestExtraConfig failed; falling back to GCC defaults',
      error instanceof Error ? error : new Error(String(error)),
      {}
    );
    return DEFAULT_FALLBACK_RESOLVED;
  }
});

/**
 * Validate and persist a batch of extra-config entries inside a Prisma transaction.
 * If an entry equals the system `default_value`, any active override is soft-deleted
 * so `is_overridden` cleanly reflects custom overrides only.
 */
export async function upsertTenantExtraConfigBatch(
  tenantId: string,
  entries: readonly ExtraConfigSaveEntry[],
  actor: ExtraConfigActor
): Promise<ExtraConfigScreenPayload> {
  const [catalog, flags] = await Promise.all([
    listExtraConfigCatalog(),
    getFeatureFlags(tenantId),
  ]);

  const catalogMap = new Map<string, SysExtraConfigRow>();
  for (const row of catalog) {
    catalogMap.set(row.config_key, row);
  }

  const normalizedOps: Array<{
    key: string;
    value: string;
    isDefault: boolean;
  }> = [];

  for (const entry of entries) {
    const def = catalogMap.get(entry.config_key);
    if (!def) {
      throw new ExtraConfigError(
        'NOT_FOUND',
        `Unknown or inactive configuration key: ${entry.config_key}`,
        entry.config_key
      );
    }
    if (!def.is_editable_by_tenant) {
      throw new ExtraConfigError(
        'NOT_EDITABLE',
        `Configuration key ${entry.config_key} cannot be modified by an Organization.`,
        entry.config_key
      );
    }
    if (
      def.plan_flag_key &&
      (flags as unknown as Record<string, unknown>)[def.plan_flag_key] !== true
    ) {
      throw new ExtraConfigError(
        'FEATURE_NOT_IN_PLAN',
        `Your current plan does not allow modifying ${entry.config_key}.`,
        entry.config_key
      );
    }

    const validation = validateExtraConfigValue(def, entry.config_value);
    if (!validation.valid) {
      const failure = validation as Extract<typeof validation, { valid: false }>;
      throw new ExtraConfigError(
        failure.code === 'INACTIVE_KEY' ? 'INACTIVE_KEY' : 'INVALID_VALUE',
        failure.message,
        entry.config_key
      );
    }

    normalizedOps.push({
      key: def.config_key,
      value: validation.normalizedValue,
      isDefault: validation.normalizedValue === def.default_value,
    });
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    for (const op of normalizedOps) {
      if (op.isDefault) {
        await tx.org_tenant_extra_config_cf.updateMany({
          where: {
            tenant_org_id: tenantId,
            config_key: op.key,
            rec_status: 1,
            is_active: true,
          },
          data: {
            is_active: false,
            rec_status: 0,
            deleted_at: now,
            deleted_by: actor.userId,
            deleted_info: actor.userInfo ?? 'Reset to system default',
            updated_at: now,
            updated_by: actor.userId,
            updated_info: actor.userInfo ?? null,
          },
        });
        continue;
      }

      const existing = await tx.org_tenant_extra_config_cf.findFirst({
        where: {
          tenant_org_id: tenantId,
          config_key: op.key,
          rec_status: 1,
          is_active: true,
        },
        select: { id: true, config_value: true },
      });

      if (existing) {
        if (existing.config_value !== op.value) {
          await tx.org_tenant_extra_config_cf.updateMany({
            where: {
              id: existing.id,
              tenant_org_id: tenantId,
              rec_status: 1,
              is_active: true,
            },
            data: {
              config_value: op.value,
              updated_at: now,
              updated_by: actor.userId,
              updated_info: actor.userInfo ?? null,
            },
          });
        }
      } else {
        await tx.org_tenant_extra_config_cf.create({
          data: {
            tenant_org_id: tenantId,
            config_key: op.key,
            config_value: op.value,
            is_active: true,
            rec_status: 1,
            created_by: actor.userId,
            created_info: actor.userInfo ?? null,
          },
        });
      }
    }
  });

  const overrides = await listOrgExtraConfigOverrides(tenantId);
  return resolveExtraConfig(catalog, overrides, flags as unknown as Record<string, unknown>);
}

/**
 * Soft-delete one tenant override so the key reverts to `sys_tenant_extra_config_cf.default_value`.
 */
export async function resetTenantExtraConfigKey(
  tenantId: string,
  configKey: string,
  actor: ExtraConfigActor
): Promise<ExtraConfigScreenPayload> {
  const [catalog, flags] = await Promise.all([
    listExtraConfigCatalog(),
    getFeatureFlags(tenantId),
  ]);

  const exists = catalog.some((row) => row.config_key === configKey);
  if (!exists) {
    throw new ExtraConfigError(
      'NOT_FOUND',
      `Unknown or inactive configuration key: ${configKey}`,
      configKey
    );
  }

  const now = new Date();
  await prisma.org_tenant_extra_config_cf.updateMany({
    where: {
      tenant_org_id: tenantId,
      config_key: configKey,
      rec_status: 1,
      is_active: true,
    },
    data: {
      is_active: false,
      rec_status: 0,
      deleted_at: now,
      deleted_by: actor.userId,
      deleted_info: actor.userInfo ?? 'Reset to system default',
      updated_at: now,
      updated_by: actor.userId,
      updated_info: actor.userInfo ?? null,
    },
  });

  const overrides = await listOrgExtraConfigOverrides(tenantId);
  return resolveExtraConfig(catalog, overrides, flags as unknown as Record<string, unknown>);
}

/**
 * Soft-delete all editable tenant overrides for the Organization.
 */
export async function resetAllTenantExtraConfig(
  tenantId: string,
  actor: ExtraConfigActor
): Promise<ExtraConfigScreenPayload> {
  const now = new Date();
  await prisma.org_tenant_extra_config_cf.updateMany({
    where: {
      tenant_org_id: tenantId,
      rec_status: 1,
      is_active: true,
    },
    data: {
      is_active: false,
      rec_status: 0,
      deleted_at: now,
      deleted_by: actor.userId,
      deleted_info: actor.userInfo ?? 'Reset all to system defaults',
      updated_at: now,
      updated_by: actor.userId,
      updated_info: actor.userInfo ?? null,
    },
  });

  return getExtraConfigScreenData(tenantId);
}

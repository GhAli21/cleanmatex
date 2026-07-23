'use server'
/* eslint-disable jsdoc/require-jsdoc, jsdoc/require-param */

import { revalidatePath } from 'next/cache'
import { Prisma } from '@prisma/client'
import { getAuthContext } from '@/lib/auth/server-auth'
import { withTenantContext } from '@/lib/db/tenant-context'
import { prisma } from '@/lib/db/prisma'
import { hasPermissionServer } from '@/lib/services/permission-service-server'
import { SETTINGS_PERMISSIONS } from '@/lib/constants/permissions/settings-perm'
import { WORKFLOW_SCREEN_KEY_SET } from '@/lib/constants/workflow-screens'
import type {
  ScreenContractFormInput,
  SerializedScreenContract,
} from '@features/settings/workflows/model/screen-contract-types'

const REVALIDATE_PATH = '/dashboard/settings/workflows'

type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function serializeRow(row: {
  id: string
  tenant_org_id: string | null
  screen_key: string
  pre_conditions: Prisma.JsonValue
  required_permissions: Prisma.JsonValue
  is_active: boolean | null
  created_at: Date | null
  updated_at: Date | null
}): SerializedScreenContract {
  const pre = asRecord(row.pre_conditions)
  return {
    id: row.id,
    tenant_org_id: row.tenant_org_id,
    screen_key: row.screen_key,
    statuses: asStringArray(pre.statuses),
    additional_filters: asRecord(pre.additional_filters),
    required_permissions: asStringArray(row.required_permissions),
    is_active: row.is_active !== false,
    is_system: row.tenant_org_id == null,
    created_at: row.created_at?.toISOString() ?? null,
    updated_at: row.updated_at?.toISOString() ?? null,
  }
}

function parseAdditionalFilters(jsonText: string | undefined): Record<string, unknown> {
  const raw = (jsonText ?? '').trim()
  if (!raw) return {}
  const parsed: unknown = JSON.parse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('INVALID_FILTERS_JSON')
  }
  return parsed as Record<string, unknown>
}

function normalizeInput(input: ScreenContractFormInput): {
  screenKey: string
  statuses: string[]
  additionalFilters: Record<string, unknown>
  requiredPermissions: string[]
  isActive: boolean
} {
  const screenKey = input.screenKey.trim()
  if (!WORKFLOW_SCREEN_KEY_SET.has(screenKey)) {
    throw new Error('INVALID_SCREEN_KEY')
  }

  const statuses = input.statuses
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (statuses.length === 0) {
    throw new Error('STATUSES_REQUIRED')
  }

  const requiredPermissions = input.requiredPermissions
    .map((s) => s.trim())
    .filter((s) => s.length > 0)

  return {
    screenKey,
    statuses,
    additionalFilters: parseAdditionalFilters(input.additionalFiltersJson),
    requiredPermissions,
    isActive: input.isActive,
  }
}

async function requireWorkflowPermission(): Promise<ActionResult<never> | null> {
  const allowed = await hasPermissionServer(SETTINGS_PERMISSIONS.WORKFLOW)
  if (!allowed) {
    return { success: false, error: 'PERMISSION_DENIED' }
  }
  return null
}

export async function listScreenContractsAction(): Promise<
  ActionResult<SerializedScreenContract[]>
> {
  try {
    const denied = await requireWorkflowPermission()
    if (denied) return denied

    const { tenantId } = await getAuthContext()
    return withTenantContext(tenantId, async () => {
      const rows = await prisma.org_ord_screen_contracts_cf.findMany({
        where: {
          OR: [{ tenant_org_id: tenantId }, { tenant_org_id: null }],
        },
        orderBy: [{ screen_key: 'asc' }, { tenant_org_id: 'asc' }],
      })
      return { success: true, data: rows.map(serializeRow) }
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'LIST_FAILED',
    }
  }
}

export async function createScreenContractAction(
  input: ScreenContractFormInput
): Promise<ActionResult<SerializedScreenContract>> {
  try {
    const denied = await requireWorkflowPermission()
    if (denied) return denied

    const normalized = normalizeInput(input)
    const { tenantId, userId } = await getAuthContext()

    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_ord_screen_contracts_cf.findFirst({
        where: {
          tenant_org_id: tenantId,
          screen_key: normalized.screenKey,
        },
      })
      if (existing) {
        return { success: false, error: 'DUPLICATE_SCREEN_KEY' }
      }

      const created = await prisma.org_ord_screen_contracts_cf.create({
        data: {
          tenant_org_id: tenantId,
          screen_key: normalized.screenKey,
          pre_conditions: {
            statuses: normalized.statuses,
            additional_filters: normalized.additionalFilters,
          } as Prisma.InputJsonValue,
          required_permissions: normalized.requiredPermissions as Prisma.InputJsonValue,
          is_active: normalized.isActive,
          created_by: userId,
          updated_by: userId,
        },
      })

      revalidatePath(REVALIDATE_PATH)
      return { success: true, data: serializeRow(created) }
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVALID_FILTERS_JSON') {
        return { success: false, error: 'INVALID_FILTERS_JSON' }
      }
      if (error.message === 'INVALID_SCREEN_KEY') {
        return { success: false, error: 'INVALID_SCREEN_KEY' }
      }
      if (error.message === 'STATUSES_REQUIRED') {
        return { success: false, error: 'STATUSES_REQUIRED' }
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'CREATE_FAILED',
    }
  }
}

export async function updateScreenContractAction(
  id: string,
  input: ScreenContractFormInput
): Promise<ActionResult<SerializedScreenContract>> {
  try {
    const denied = await requireWorkflowPermission()
    if (denied) return denied

    const normalized = normalizeInput(input)
    const { tenantId, userId } = await getAuthContext()

    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_ord_screen_contracts_cf.findFirst({
        where: { id, tenant_org_id: tenantId },
      })
      if (!existing) {
        return { success: false, error: 'NOT_FOUND_OR_SYSTEM' }
      }

      const duplicate = await prisma.org_ord_screen_contracts_cf.findFirst({
        where: {
          tenant_org_id: tenantId,
          screen_key: normalized.screenKey,
          NOT: { id },
        },
      })
      if (duplicate) {
        return { success: false, error: 'DUPLICATE_SCREEN_KEY' }
      }

      const updated = await prisma.org_ord_screen_contracts_cf.update({
        where: { id },
        data: {
          screen_key: normalized.screenKey,
          pre_conditions: {
            statuses: normalized.statuses,
            additional_filters: normalized.additionalFilters,
          } as Prisma.InputJsonValue,
          required_permissions: normalized.requiredPermissions as Prisma.InputJsonValue,
          is_active: normalized.isActive,
          updated_by: userId,
          updated_at: new Date(),
        },
      })

      revalidatePath(REVALIDATE_PATH)
      return { success: true, data: serializeRow(updated) }
    })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'INVALID_FILTERS_JSON') {
        return { success: false, error: 'INVALID_FILTERS_JSON' }
      }
      if (error.message === 'INVALID_SCREEN_KEY') {
        return { success: false, error: 'INVALID_SCREEN_KEY' }
      }
      if (error.message === 'STATUSES_REQUIRED') {
        return { success: false, error: 'STATUSES_REQUIRED' }
      }
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : 'UPDATE_FAILED',
    }
  }
}

export async function deleteScreenContractAction(
  id: string
): Promise<ActionResult<{ id: string }>> {
  try {
    const denied = await requireWorkflowPermission()
    if (denied) return denied

    const { tenantId } = await getAuthContext()

    return withTenantContext(tenantId, async () => {
      const existing = await prisma.org_ord_screen_contracts_cf.findFirst({
        where: { id, tenant_org_id: tenantId },
      })
      if (!existing) {
        return { success: false, error: 'NOT_FOUND_OR_SYSTEM' }
      }

      await prisma.org_ord_screen_contracts_cf.delete({ where: { id } })
      revalidatePath(REVALIDATE_PATH)
      return { success: true, data: { id } }
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'DELETE_FAILED',
    }
  }
}

export async function createOverrideFromSystemAction(
  systemContractId: string
): Promise<ActionResult<SerializedScreenContract>> {
  try {
    const denied = await requireWorkflowPermission()
    if (denied) return denied

    const { tenantId, userId } = await getAuthContext()

    return withTenantContext(tenantId, async () => {
      const systemRow = await prisma.org_ord_screen_contracts_cf.findFirst({
        where: { id: systemContractId, tenant_org_id: null },
      })
      if (!systemRow) {
        return { success: false, error: 'SYSTEM_NOT_FOUND' }
      }

      const existing = await prisma.org_ord_screen_contracts_cf.findFirst({
        where: {
          tenant_org_id: tenantId,
          screen_key: systemRow.screen_key,
        },
      })
      if (existing) {
        return { success: false, error: 'DUPLICATE_SCREEN_KEY' }
      }

      const created = await prisma.org_ord_screen_contracts_cf.create({
        data: {
          tenant_org_id: tenantId,
          screen_key: systemRow.screen_key,
          pre_conditions: systemRow.pre_conditions as Prisma.InputJsonValue,
          required_permissions: systemRow.required_permissions as Prisma.InputJsonValue,
          is_active: systemRow.is_active ?? true,
          created_by: userId,
          updated_by: userId,
        },
      })

      revalidatePath(REVALIDATE_PATH)
      return { success: true, data: serializeRow(created) }
    })
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'OVERRIDE_FAILED',
    }
  }
}

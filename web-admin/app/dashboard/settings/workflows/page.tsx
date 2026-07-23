import { getTranslations } from 'next-intl/server'
import { Prisma } from '@prisma/client'
import { getAuthContext } from '@/lib/auth/server-auth'
import { prisma } from '@/lib/db/prisma'
import { withTenantContext } from '@/lib/db/tenant-context'
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { SETTINGS_WORKFLOWS_ACCESS } from '@features/settings/access/settings-access'
import { WorkflowsSettingsScreen } from '@features/settings/workflows/ui/workflows-settings-screen'
import type { SerializedScreenContract } from '@features/settings/workflows/model/screen-contract-types'

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

function serializeContract(row: {
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

/**
 * Workflows settings page — tabs for workflow config + screen contracts CRUD.
 */
export default async function WorkflowsPage() {
  const t = await getTranslations('workflowSettings')
  const { tenantId } = await getAuthContext()

  const [contracts, configs] = await withTenantContext(tenantId, async () => {
    const [contractRows, configRows] = await Promise.all([
      prisma.org_ord_screen_contracts_cf.findMany({
        where: {
          OR: [{ tenant_org_id: tenantId }, { tenant_org_id: null }],
        },
        orderBy: [{ screen_key: 'asc' }, { tenant_org_id: 'asc' }],
      }),
      prisma.org_workflow_settings_cf.findMany({
        where: { tenant_org_id: tenantId },
        orderBy: { created_at: 'desc' },
        take: 100,
        select: {
          id: true,
          service_category_code: true,
          is_active: true,
          updated_at: true,
          created_at: true,
        },
      }),
    ])
    return [contractRows, configRows] as const
  })

  return (
    <RequireAnyPermission
      permissions={SETTINGS_WORKFLOWS_ACCESS.page.permissions ?? []}
    >
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-muted-foreground">{t('description')}</p>
        </div>
        <WorkflowsSettingsScreen
          initialContracts={contracts.map(serializeContract)}
          initialConfigs={configs.map((row) => ({
            id: row.id,
            service_category_code: row.service_category_code,
            is_active: row.is_active !== false,
            updated_at: row.updated_at?.toISOString() ?? null,
            created_at: row.created_at?.toISOString() ?? new Date(0).toISOString(),
          }))}
        />
      </div>
    </RequireAnyPermission>
  )
}

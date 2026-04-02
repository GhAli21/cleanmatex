'use client'

/**
 * UserRolesTab — Four-section RBAC management tab for a user.
 *
 * Sections:
 *   1. Tenant-Level Roles — table of assigned roles with remove actions
 *   2. Resource-Scoped Roles — conditional; shown only when present
 *   3. Workflow Roles — badge list with remove per badge
 *   4. Permission Overrides — table of global + resource overrides
 *
 * Header action bar: "Rebuild Permissions" button
 */

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Shield,
  MapPin,
  RefreshCw,
  Check,
  ShieldOff,
} from 'lucide-react'
import { cmxMessage } from '@ui/feedback'
import { CmxButton } from '@ui/primitives/cmx-button'
import { useUserRoleAssignments, useUserPermissionOverrides } from '@/lib/hooks/use-user-role-assignments'
import { AssignRolesDialog } from './assign-roles-dialog'
import { AssignWorkflowRolesDialog } from './assign-workflow-roles-dialog'
import { PermissionOverrideDialog } from './permission-override-dialog'

interface UserRolesTabProps {
  userId: string
  userName: string
}

export function UserRolesTab({ userId, userName }: UserRolesTabProps) {
  const t = useTranslations('users.rbac')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const isAr = locale === 'ar'

  const {
    tenantRoles,
    resourceRoles,
    workflowRoles,
    loading: rolesLoading,
    removeRole,
    removeWorkflowRole,
    rebuildPermissions,
    rebuilding,
    refetch,
  } = useUserRoleAssignments(userId)

  const { globalOverrides, resourceOverrides } = useUserPermissionOverrides(userId)

  const [assignRolesOpen, setAssignRolesOpen] = useState(false)
  const [assignWorkflowOpen, setAssignWorkflowOpen] = useState(false)
  const [overrideOpen, setOverrideOpen] = useState(false)
  const [removingRole, setRemovingRole] = useState<string | null>(null)
  const [removingWorkflow, setRemovingWorkflow] = useState<string | null>(null)

  const handleRemoveRole = async (roleCode: string) => {
    setRemovingRole(roleCode)
    try {
      await removeRole(roleCode)
      cmxMessage.success(t('roleRemoved'))
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : tCommon('error'))
    } finally {
      setRemovingRole(null)
    }
  }

  const handleRemoveWorkflowRole = async (workflowRole: string) => {
    setRemovingWorkflow(workflowRole)
    try {
      await removeWorkflowRole(workflowRole)
      cmxMessage.success(t('workflowRoleRemoved'))
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : tCommon('error'))
    } finally {
      setRemovingWorkflow(null)
    }
  }

  const handleRebuild = async () => {
    try {
      await rebuildPermissions()
      cmxMessage.success(t('rebuildSuccess'))
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : t('rebuildFailed'))
    }
  }

  const formatDate = (date: string | undefined) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin h-8 w-8 rounded-full border-2 border-[rgb(var(--cmx-primary-rgb,14_165_233))] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header action bar */}
      <div className="flex items-center justify-end">
        <CmxButton
          variant="secondary"
          size="sm"
          onClick={handleRebuild}
          loading={rebuilding}
          disabled={rebuilding}
        >
          <RefreshCw className="h-4 w-4 me-1.5" />
          {rebuilding ? t('rebuilding') : t('rebuildPermissions')}
        </CmxButton>
      </div>

      {/* Section 1: Tenant-Level Roles */}
      <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))] border-b border-[rgb(var(--cmx-border-rgb,226_232_240))]">
          <div>
            <h3 className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
              {t('tenantRoles')}
            </h3>
            <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('tenantRolesDesc')}
            </p>
          </div>
          <CmxButton size="sm" onClick={() => setAssignRolesOpen(true)}>
            <Shield className="h-4 w-4 me-1.5" />
            {t('assignRoles')}
          </CmxButton>
        </div>

        {tenantRoles.length === 0 ? (
          <div className="p-8 text-center text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t('noRolesAssigned')}
          </div>
        ) : (
          <table className="min-w-full divide-y divide-[rgb(var(--cmx-border-rgb,226_232_240))]">
            <thead className="bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))]">
              <tr>
                <th className="px-4 py-2.5 text-start text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
                  {tCommon('name')}
                </th>
                <th className="px-4 py-2.5 text-start text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-2.5 text-start text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
                  Perms
                </th>
                <th className="px-4 py-2.5 text-start text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
                  {t('tenantRolesDesc').split(' ')[0]}
                </th>
                <th className="px-4 py-2.5 text-end text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
                  {tCommon('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--cmx-border-rgb,226_232_240))]">
              {tenantRoles.map((role) => (
                <tr key={role.role_code} className="hover:bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]" />
                      <div>
                        <p className="text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                          {isAr && role.name2 ? role.name2 : role.name}
                        </p>
                        <p className="text-xs font-mono text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                          {role.role_code}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {role.is_system ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                        System
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                    {role.permission_count ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                    {formatDate(role.assigned_at)}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <CmxButton
                      variant="ghost"
                      size="xs"
                      onClick={() => handleRemoveRole(role.role_code)}
                      disabled={removingRole === role.role_code}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {tCommon('delete')}
                    </CmxButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Section 2: Resource-Scoped Roles (conditional) */}
      {resourceRoles.length > 0 && (
        <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] overflow-hidden">
          <div className="px-4 py-3 bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))] border-b border-[rgb(var(--cmx-border-rgb,226_232_240))]">
            <h3 className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
              {t('resourceRoles')}
            </h3>
          </div>
          <table className="min-w-full divide-y divide-[rgb(var(--cmx-border-rgb,226_232_240))]">
            <thead className="bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))]">
              <tr>
                <th className="px-4 py-2.5 text-start text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
                  {tCommon('name')}
                </th>
                <th className="px-4 py-2.5 text-start text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
                  Resource
                </th>
                <th className="px-4 py-2.5 text-start text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
                  Resource ID
                </th>
                <th className="px-4 py-2.5 text-end text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] uppercase tracking-wider">
                  {tCommon('actions')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgb(var(--cmx-border-rgb,226_232_240))]">
              {resourceRoles.map((role, i) => (
                <tr key={i} className="hover:bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]" />
                      <div>
                        <p className="text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                          {isAr && role.name2 ? role.name2 : role.name}
                        </p>
                        <p className="text-xs font-mono text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                          {role.role_code}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))] text-xs font-mono text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                      <MapPin className="h-3 w-3" />
                      {role.resource_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] max-w-[160px] truncate">
                    {role.resource_id}
                  </td>
                  <td className="px-4 py-3 text-end">
                    <CmxButton
                      variant="ghost"
                      size="xs"
                      onClick={() => handleRemoveRole(role.role_code)}
                      disabled={removingRole === role.role_code}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      {tCommon('delete')}
                    </CmxButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Section 3: Workflow Roles */}
      <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))] border-b border-[rgb(var(--cmx-border-rgb,226_232_240))]">
          <div>
            <h3 className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
              {t('workflowRoles')}
            </h3>
            <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('workflowRolesDesc')}
            </p>
          </div>
          <CmxButton size="sm" variant="secondary" onClick={() => setAssignWorkflowOpen(true)}>
            {t('assignWorkflowRoles')}
          </CmxButton>
        </div>
        <div className="p-4">
          {workflowRoles.length === 0 ? (
            <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('noWorkflowRoles')}
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {workflowRoles.map((wr) => (
                <span
                  key={wr.workflow_role}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))] text-[rgb(var(--cmx-foreground-rgb,15_23_42))] border border-[rgb(var(--cmx-border-rgb,226_232_240))]"
                >
                  {wr.workflow_role}
                  <button
                    onClick={() => handleRemoveWorkflowRole(wr.workflow_role)}
                    disabled={removingWorkflow === wr.workflow_role}
                    className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] hover:text-red-600 disabled:opacity-50"
                    aria-label={`Remove ${wr.workflow_role}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Section 4: Permission Overrides */}
      <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))] border-b border-[rgb(var(--cmx-border-rgb,226_232_240))]">
          <div>
            <h3 className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
              {t('permissionOverrides')}
            </h3>
            <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('permissionOverridesDesc')}
            </p>
          </div>
          <CmxButton size="sm" variant="secondary" onClick={() => setOverrideOpen(true)}>
            {t('overridePermissions')}
          </CmxButton>
        </div>
        <div className="p-4">
          {globalOverrides.length === 0 && resourceOverrides.length === 0 ? (
            <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('noOverrides')}
            </p>
          ) : (
            <div className="space-y-1">
              {globalOverrides.map((o) => (
                <div
                  key={o.permission_code}
                  className="flex items-center gap-3 p-2 rounded border border-[rgb(var(--cmx-border-rgb,226_232_240))]"
                >
                  {o.allow ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      <Check className="h-3 w-3" />
                      {t('allow')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      <ShieldOff className="h-3 w-3" />
                      {t('deny')}
                    </span>
                  )}
                  <span className="text-xs font-mono flex-1 text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                    {o.permission_code}
                  </span>
                  <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                    {t('scopeTenant')}
                  </span>
                </div>
              ))}
              {resourceOverrides.map((o, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 rounded border border-[rgb(var(--cmx-border-rgb,226_232_240))]"
                >
                  {o.allow ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                      <Check className="h-3 w-3" />
                      {t('allow')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                      <ShieldOff className="h-3 w-3" />
                      {t('deny')}
                    </span>
                  )}
                  <span className="text-xs font-mono flex-1 text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                    {o.permission_code}
                  </span>
                  <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                    {o.resource_type}/{o.resource_id}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <AssignRolesDialog
        open={assignRolesOpen}
        onOpenChange={setAssignRolesOpen}
        userId={userId}
        userName={userName}
        onSuccess={refetch}
      />
      <AssignWorkflowRolesDialog
        open={assignWorkflowOpen}
        onOpenChange={setAssignWorkflowOpen}
        userId={userId}
        userName={userName}
        onSuccess={refetch}
      />
      <PermissionOverrideDialog
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        userId={userId}
        userName={userName}
        onSuccess={refetch}
      />
    </div>
  )
}

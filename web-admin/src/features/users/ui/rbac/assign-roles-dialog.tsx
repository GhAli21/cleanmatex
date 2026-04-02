'use client'

/**
 * AssignRolesDialog — Assign tenant-level or resource-scoped roles to a user.
 *
 * Sections:
 *   1. Scope selector: Tenant-Level vs Resource-Scoped
 *   2. Resource type/ID selectors (resource scope only)
 *   3. Scrollable role list with checkboxes
 *   4. Change summary (+added / -removed)
 *   5. Footer: Cancel + Save
 */

import { useState, useMemo } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { Shield } from 'lucide-react'
import { cmxMessage } from '@ui/feedback'
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxCheckbox } from '@ui/primitives/cmx-checkbox'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays/cmx-dialog'
import { useTenantRoles } from '@/lib/hooks/use-tenant-roles'
import { useUserRoleAssignments } from '@/lib/hooks/use-user-role-assignments'

interface AssignRolesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
  onSuccess: () => void
}

const RESOURCE_TYPES = ['branch', 'store', 'pos', 'route', 'device'] as const

export function AssignRolesDialog({
  open,
  onOpenChange,
  userId,
  userName,
  onSuccess,
}: AssignRolesDialogProps) {
  const t = useTranslations('users.rbac')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const isAr = locale === 'ar'

  const { roles, loading: rolesLoading } = useTenantRoles()
  const { tenantRoles, assignRoles, loading: assignmentsLoading } = useUserRoleAssignments(userId)

  // Currently assigned tenant-level role codes
  const assignedCodes = useMemo(
    () => new Set(tenantRoles.map((r) => r.role_code)),
    [tenantRoles]
  )

  const [scope, setScope] = useState<'tenant' | 'resource'>('tenant')
  const [resourceType, setResourceType] = useState<string>('')
  const [resourceId, setResourceId] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(assignedCodes))
  const [saving, setSaving] = useState(false)

  // Re-sync selection when dialog opens or assigned codes change
  useMemo(() => {
    setSelected(new Set(assignedCodes))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const added = useMemo(
    () => [...selected].filter((c) => !assignedCodes.has(c)),
    [selected, assignedCodes]
  )
  const removed = useMemo(
    () => [...assignedCodes].filter((c) => !selected.has(c)),
    [selected, assignedCodes]
  )

  const toggle = (code: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await assignRoles(
        Array.from(selected),
        scope === 'resource' ? resourceType : undefined,
        scope === 'resource' ? resourceId : undefined
      )
      cmxMessage.success(t('assignRolesSuccess'))
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : tCommon('error'))
    } finally {
      setSaving(false)
    }
  }

  const loading = rolesLoading || assignmentsLoading

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent className="w-full max-w-lg">
        <CmxDialogHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-[rgb(var(--cmx-primary-rgb,14_165_233))]" />
            <CmxDialogTitle>{t('assignRoles')}</CmxDialogTitle>
          </div>
          <p className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {userName}
          </p>
        </CmxDialogHeader>

        <div className="px-6 py-4 space-y-4">
          {/* Scope selector */}
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="scope"
                value="tenant"
                checked={scope === 'tenant'}
                onChange={() => setScope('tenant')}
                className="h-4 w-4 text-[rgb(var(--cmx-primary-rgb,14_165_233))]"
              />
              {t('scopeTenant')}
            </label>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <input
                type="radio"
                name="scope"
                value="resource"
                checked={scope === 'resource'}
                onChange={() => setScope('resource')}
                className="h-4 w-4 text-[rgb(var(--cmx-primary-rgb,14_165_233))]"
              />
              {t('scopeResource')}
            </label>
          </div>

          {/* Resource type/ID — shown only for resource scope */}
          {scope === 'resource' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))] mb-1">
                  {t('resourceType')}
                </label>
                <select
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value)}
                  className="block w-full rounded border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-background-rgb,255_255_255))] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-primary-rgb,14_165_233))]"
                >
                  <option value="">{tCommon('select')}</option>
                  {RESOURCE_TYPES.map((rt) => (
                    <option key={rt} value={rt}>
                      {rt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))] mb-1">
                  {t('resourceId')}
                </label>
                <input
                  type="text"
                  value={resourceId}
                  onChange={(e) => setResourceId(e.target.value)}
                  placeholder="UUID"
                  className="block w-full rounded border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-background-rgb,255_255_255))] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-primary-rgb,14_165_233))]"
                />
              </div>
            </div>
          )}

          {/* Role list */}
          {loading ? (
            <div className="flex items-center justify-center h-24">
              <div className="animate-spin h-6 w-6 rounded-full border-2 border-[rgb(var(--cmx-primary-rgb,14_165_233))] border-t-transparent" />
            </div>
          ) : (
            <div className="h-[300px] overflow-y-auto space-y-1 border border-[rgb(var(--cmx-border-rgb,226_232_240))] rounded-md p-2">
              {roles.map((role) => (
                <label
                  key={role.code}
                  className="flex items-start gap-3 p-2.5 rounded-lg cursor-pointer hover:bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))] transition-colors"
                >
                  <CmxCheckbox
                    checked={selected.has(role.code)}
                    onChange={() => toggle(role.code)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                        {isAr && role.name2 ? role.name2 : role.name}
                      </span>
                      {role.is_system && (
                        <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                          {/* system badge */}
                          System
                        </span>
                      )}
                      {role.permission_count !== undefined && (
                        <span className="px-1.5 py-0.5 text-xs rounded-full bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                          {role.permission_count} perms
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] font-mono">
                      {role.code}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {/* Change summary */}
          {(added.length > 0 || removed.length > 0) && (
            <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('changesSummary', { added: added.length, removed: removed.length })}
            </p>
          )}
        </div>

        <CmxDialogFooter>
          <CmxButton variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton onClick={handleSave} loading={saving} disabled={saving || loading}>
            {tCommon('save')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}

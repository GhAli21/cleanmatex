'use client'

/**
 * PermissionOverrideDialog — Set per-user permission grants/denials.
 *
 * Sections:
 *   1. Warning alert: overrides take precedence over role-based permissions
 *   2. "Add Override" form: permission selector, allow/deny, global vs resource-scoped
 *   3. Pending overrides list (not yet saved)
 *   4. Current saved overrides table
 *   5. Footer: Cancel + Save All
 */

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { AlertTriangle, X } from 'lucide-react'
import { cmxMessage } from '@ui/feedback'
import { CmxButton } from '@ui/primitives/cmx-button'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays/cmx-dialog'
import { useTenantPermissions } from '@/lib/hooks/use-tenant-permissions'
import { useUserPermissionOverrides } from '@/lib/hooks/use-user-role-assignments'

interface PermissionOverrideDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
  onSuccess: () => void
}

interface PendingOverride {
  permission_code: string
  allow: boolean
  scope: 'global' | 'resource'
  resource_type?: string
  resource_id?: string
}

const RESOURCE_TYPES = ['branch', 'store', 'pos', 'route', 'device'] as const

export function PermissionOverrideDialog({
  open,
  onOpenChange,
  userId,
  userName,
  onSuccess,
}: PermissionOverrideDialogProps) {
  const t = useTranslations('users.rbac')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const isAr = locale === 'ar'

  const { permissions } = useTenantPermissions()
  const {
    globalOverrides,
    resourceOverrides,
    saveGlobalOverrides,
    saveResourceOverrides,
  } = useUserPermissionOverrides(userId)

  // Form state for adding a new pending override
  const [selectedPermCode, setSelectedPermCode] = useState('')
  const [allow, setAllow] = useState(true)
  const [overrideScope, setOverrideScope] = useState<'global' | 'resource'>('global')
  const [resourceType, setResourceType] = useState('')
  const [resourceId, setResourceId] = useState('')
  const [pending, setPending] = useState<PendingOverride[]>([])
  const [saving, setSaving] = useState(false)

  const handleAddPending = () => {
    if (!selectedPermCode) return
    if (overrideScope === 'resource' && (!resourceType || !resourceId)) return
    // Avoid duplicates in pending list
    const exists = pending.some(
      (p) =>
        p.permission_code === selectedPermCode &&
        p.scope === overrideScope &&
        (overrideScope === 'global' ||
          (p.resource_type === resourceType && p.resource_id === resourceId))
    )
    if (exists) return
    setPending((prev) => [
      ...prev,
      {
        permission_code: selectedPermCode,
        allow,
        scope: overrideScope,
        resource_type: overrideScope === 'resource' ? resourceType : undefined,
        resource_id: overrideScope === 'resource' ? resourceId : undefined,
      },
    ])
    setSelectedPermCode('')
    setResourceId('')
  }

  const removePending = (index: number) => {
    setPending((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const globalPending = pending.filter((p) => p.scope === 'global')
      const resourcePending = pending.filter((p) => p.scope === 'resource')

      if (globalPending.length > 0) {
        await saveGlobalOverrides(
          globalPending.map((p) => ({ permission_code: p.permission_code, allow: p.allow }))
        )
      }
      if (resourcePending.length > 0) {
        await saveResourceOverrides(
          resourcePending.map((p) => ({
            permission_code: p.permission_code,
            allow: p.allow,
            resource_type: p.resource_type!,
            resource_id: p.resource_id!,
          }))
        )
      }
      setPending([])
      cmxMessage.success(t('overridesSavedSuccess'))
      onSuccess()
      onOpenChange(false)
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : tCommon('error'))
    } finally {
      setSaving(false)
    }
  }

  // Group permissions by category_main for the select list
  const grouped = permissions.reduce<Record<string, typeof permissions>>((acc, p) => {
    const cat = p.category_main ?? p.category ?? 'Other'
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(p)
    return acc
  }, {})

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent className="w-full max-w-2xl">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('overridePermissions')}</CmxDialogTitle>
          <p className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {userName}
          </p>
        </CmxDialogHeader>

        <div className="px-6 py-4 space-y-5 max-h-[60vh] overflow-y-auto">
          {/* Warning */}
          <div className="flex items-start gap-2 rounded-md bg-yellow-50 border border-yellow-200 p-3">
            <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
            <p className="text-xs text-yellow-800">{t('overrideWarning')}</p>
          </div>

          {/* Add Override form */}
          <div className="border border-[rgb(var(--cmx-border-rgb,226_232_240))] rounded-md p-4 space-y-3">
            <h3 className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
              {t('addOverride')}
            </h3>

            {/* Permission selector */}
            <select
              size={5}
              value={selectedPermCode}
              onChange={(e) => setSelectedPermCode(e.target.value)}
              className="block w-full overflow-y-auto rounded border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-background-rgb,255_255_255))] px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-primary-rgb,14_165_233))]"
            >
              {Object.entries(grouped)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([cat, perms]) => (
                  <optgroup key={cat} label={cat}>
                    {perms.map((p) => (
                      <option key={p.code} value={p.code}>
                        {isAr && p.name2 ? p.name2 : p.name} ({p.code})
                      </option>
                    ))}
                  </optgroup>
                ))}
            </select>

            {/* Allow / Deny */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="allowDeny"
                  checked={allow}
                  onChange={() => setAllow(true)}
                  className="h-4 w-4 text-green-600"
                />
                <span className="text-green-700 font-medium">{t('allow')}</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="allowDeny"
                  checked={!allow}
                  onChange={() => setAllow(false)}
                  className="h-4 w-4 text-red-600"
                />
                <span className="text-red-700 font-medium">{t('deny')}</span>
              </label>
            </div>

            {/* Scope */}
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="overrideScope"
                  value="global"
                  checked={overrideScope === 'global'}
                  onChange={() => setOverrideScope('global')}
                  className="h-4 w-4"
                />
                {t('scopeTenant')}
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <input
                  type="radio"
                  name="overrideScope"
                  value="resource"
                  checked={overrideScope === 'resource'}
                  onChange={() => setOverrideScope('resource')}
                  className="h-4 w-4"
                />
                {t('scopeResource')}
              </label>
            </div>

            {/* Resource fields */}
            {overrideScope === 'resource' && (
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

            <CmxButton
              variant="secondary"
              size="sm"
              onClick={handleAddPending}
              disabled={
                !selectedPermCode ||
                (overrideScope === 'resource' && (!resourceType || !resourceId))
              }
            >
              {t('addOverride')}
            </CmxButton>
          </div>

          {/* Pending overrides list */}
          {pending.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                Pending ({pending.length})
              </h3>
              {pending.map((p, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 p-2 rounded border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))]"
                >
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                      p.allow
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {p.allow ? t('allow') : t('deny')}
                  </span>
                  <span className="text-xs font-mono text-[rgb(var(--cmx-foreground-rgb,15_23_42))] flex-1">
                    {p.permission_code}
                  </span>
                  {p.scope === 'resource' && (
                    <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                      {p.resource_type}/{p.resource_id}
                    </span>
                  )}
                  <button
                    onClick={() => removePending(i)}
                    className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] hover:text-[rgb(var(--cmx-foreground-rgb,15_23_42))]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Saved global overrides */}
          {globalOverrides.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))] mb-2">
                {t('permissionOverrides')} — {t('scopeTenant')} ({globalOverrides.length})
              </h3>
              <div className="space-y-1">
                {globalOverrides.map((o) => (
                  <div
                    key={o.permission_code}
                    className="flex items-center gap-3 p-2 rounded border border-[rgb(var(--cmx-border-rgb,226_232_240))]"
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                        o.allow ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {o.allow ? t('allow') : t('deny')}
                    </span>
                    <span className="text-xs font-mono flex-1 text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                      {o.permission_code}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Saved resource overrides */}
          {resourceOverrides.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))] mb-2">
                {t('permissionOverrides')} — {t('scopeResource')} ({resourceOverrides.length})
              </h3>
              <div className="space-y-1">
                {resourceOverrides.map((o, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2 rounded border border-[rgb(var(--cmx-border-rgb,226_232_240))]"
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
                        o.allow ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {o.allow ? t('allow') : t('deny')}
                    </span>
                    <span className="text-xs font-mono flex-1 text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                      {o.permission_code}
                    </span>
                    <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                      {o.resource_type}/{o.resource_id}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <CmxDialogFooter>
          <CmxButton variant="secondary" onClick={() => onOpenChange(false)} disabled={saving}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton
            onClick={handleSave}
            loading={saving}
            disabled={saving || pending.length === 0}
          >
            {tCommon('save')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}

'use client'

/**
 * SecuritySettingsScreen — "Security & Sessions" settings (/dashboard/settings/security).
 *
 * Shows the effective sign-in / session policy grouped by area. Items the platform lets tenants
 * customize can be edited (when the plan includes session_timeout_control AND the user has
 * auth_config:update); everything else is read-only. Changes apply to NEW sign-ins.
 * Data: GET/PUT /api/settings/auth-config (tenant resolved server-side).
 */

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Alert, AlertDescription, CmxButton, CmxSkeleton } from '@ui/primitives'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'
import { cmxMessage } from '@ui/feedback'
import { useHasPermission } from '@/lib/hooks/use-has-permission'
import { AUTH_CONFIG_GROUPS, AUTH_CONFIG_ERROR_CODES } from '@/lib/constants/auth-admin-config'
import type { AuthConfigGroup } from '@/lib/types/auth-admin-config'
import { AuthConfigApiError } from '../api/auth-config-api'
import { useAuthConfig, useSaveAuthConfig } from '../hooks/use-auth-config'
import { buildChanges, draftError, initialDraft, isDirty, type AuthConfigDraft } from '../model/auth-config-draft'
import { AuthConfigField } from './auth-config-field'

const GROUP_ORDER: AuthConfigGroup[] = [AUTH_CONFIG_GROUPS.SESSION, AUTH_CONFIG_GROUPS.DEVICE, AUTH_CONFIG_GROUPS.LOCKOUT]

/** Security & Sessions settings screen. */
export function SecuritySettingsScreen() {
  const t = useTranslations('authSession.settings')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const canUpdatePermission = useHasPermission('auth_config', 'update')

  const { data, isLoading, isError, refetch, isFetching } = useAuthConfig()
  const save = useSaveAuthConfig()

  // Only items the user touched are stored here; everything else comes from the server data.
  const [drafts, setDrafts] = useState<Record<string, AuthConfigDraft>>({})

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="space-y-4 p-6" aria-busy="true">
        <CmxSkeleton className="h-8 w-64" />
        <CmxSkeleton className="h-32 w-full" />
        <CmxSkeleton className="h-32 w-full" />
      </div>
    )
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (isError || !data) {
    return (
      <div className="space-y-4 p-6">
        <Alert variant="error">
          <AlertDescription>{t('loadFailed')}</AlertDescription>
        </Alert>
        <CmxButton variant="secondary" onClick={() => void refetch()} loading={isFetching}>
          {tCommon('retry')}
        </CmxButton>
      </div>
    )
  }

  const { items, canEdit: planAllowsEdit } = data
  const canEdit = planAllowsEdit && canUpdatePermission
  const { changes, hasInvalid } = buildChanges(items, drafts)
  const dirtyCount = changes.length + (hasInvalid ? 1 : 0)
  const hasErrors = items.some((item) => {
    const draft = drafts[item.configCode]
    return draft && item.isAllowTenantChange && draftError(item, draft) !== undefined
  })

  const handleSave = () => {
    save.mutate(changes, {
      onSuccess: () => {
        setDrafts({})
        cmxMessage.success(t('saved'))
      },
      onError: (error) => {
        const code = error instanceof AuthConfigApiError ? error.code : undefined
        cmxMessage.error(
          code === AUTH_CONFIG_ERROR_CODES.FEATURE_NOT_ENABLED
            ? t('readOnlyPlan')
            : code === AUTH_CONFIG_ERROR_CODES.INVALID_VALUE
              ? t('errors.serverInvalid')
              : t('saveFailed')
        )
      },
    })
  }

  return (
    <div className="space-y-6 p-6 pb-24">
      <div>
        <h1 className="text-2xl font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{t('title')}</h1>
        <p className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('subtitle')}</p>
      </div>

      {!planAllowsEdit ? (
        <Alert variant="info">
          <AlertDescription>{t('readOnlyPlan')}</AlertDescription>
        </Alert>
      ) : !canUpdatePermission ? (
        <Alert variant="info">
          <AlertDescription>{t('readOnlyPermission')}</AlertDescription>
        </Alert>
      ) : (
        <Alert variant="info">
          <AlertDescription>{t('appliesToNewSignIns')}</AlertDescription>
        </Alert>
      )}

      {GROUP_ORDER.map((group) => {
        const groupItems = items.filter((item) => item.configGroup === group)
        if (groupItems.length === 0) return null
        return (
          <CmxCard key={group}>
            <CmxCardHeader>
              <CmxCardTitle>{t(`groups.${group}`)}</CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {groupItems.map((item) => (
                <AuthConfigField
                  key={item.configCode}
                  item={item}
                  draft={drafts[item.configCode] ?? initialDraft(item)}
                  editable={canEdit && item.isAllowTenantChange}
                  locale={locale}
                  onChange={(next) =>
                    setDrafts((current) => {
                      // Drop the draft when it equals the server state so "dirty" stays accurate.
                      if (!isDirty(item, next)) {
                        const rest = { ...current }
                        delete rest[item.configCode]
                        return rest
                      }
                      return { ...current, [item.configCode]: next }
                    })
                  }
                />
              ))}
            </CmxCardContent>
          </CmxCard>
        )
      })}

      {dirtyCount > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-white/95 px-6 py-3 shadow-lg backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('unsavedChanges', { count: dirtyCount })}
            </p>
            <div className="flex gap-2">
              <CmxButton variant="secondary" onClick={() => setDrafts({})} disabled={save.isPending}>
                {t('discard')}
              </CmxButton>
              <CmxButton onClick={handleSave} loading={save.isPending} disabled={save.isPending || hasErrors || hasInvalid}>
                {tCommon('save')}
              </CmxButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

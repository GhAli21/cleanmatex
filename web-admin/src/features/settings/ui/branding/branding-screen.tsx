'use client'

/**
 * Settings → Branding: the Organization's logos (File Util) and its saved
 * themes. One theme is in use; any other can be made active, edited or deleted.
 * With no saved theme the Organization uses the HQ default theme (STANDARD).
 * Plan limits are shown here and enforced again by the server.
 * @module features/settings/ui/branding/branding-screen
 */

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Palette, Plus } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { useHasPermission } from '@/lib/hooks/use-has-permission'
import { FILE_CATEGORIES, FILE_SOURCES } from '@/lib/constants/file-util'
import type { OrgThemeInput } from '@/lib/validations/ui-theme'
import { FileAttachments } from '@features/file-util'
import { BrandingApiError, type OrgThemeRow } from '@features/settings/api/branding-api'
import { useBranding } from '@features/settings/hooks/use-branding'
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxCard, CmxCardContent, CmxCardHeader } from '@ui/primitives/cmx-card'
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays/cmx-dialog'
import { CmxConfirmDialog, CmxStatusBadge, cmxMessage } from '@ui/feedback'
import { ThemeEditorForm } from './theme-editor-form'

/** Error code from the server → message key under settings.brandingScreen.errors. */
const ERROR_KEYS: Record<string, string> = {
  NOT_FOUND: 'notFound',
  THEME_IN_USE: 'themeInUse',
  FEATURE_NOT_IN_PLAN: 'notInPlan',
  INVALID_CATALOG_CODE: 'invalidCode',
}

/** @returns The branding settings screen */
export function BrandingScreen() {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const isAr = useLocale() === 'ar'
  const tenantId = useAuth().currentTenant?.tenant_id
  const canEdit = useHasPermission('settings', 'branding')
  const { query, create, update, activate, remove } = useBranding()
  const [editing, setEditing] = useState<OrgThemeRow | 'new' | null>(null)
  const [deleting, setDeleting] = useState<OrgThemeRow | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const fail = (err: unknown) => {
    const key = err instanceof BrandingApiError && err.code ? ERROR_KEYS[err.code] : undefined
    if (err instanceof BrandingApiError && err.fieldErrors) setFieldErrors(err.fieldErrors)
    cmxMessage.error(key ? t(`brandingScreen.errors.${key}`) : t('saveError'))
  }

  const save = async (input: OrgThemeInput) => {
    setFieldErrors({})
    try {
      if (editing === 'new') await create.mutateAsync(input)
      else if (editing) await update.mutateAsync({ id: editing.id, input })
      cmxMessage.success(t('brandingScreen.saved'))
      setEditing(null)
    } catch (err) {
      fail(err)
    }
  }

  const makeActive = async (row: OrgThemeRow) => {
    try {
      await activate.mutateAsync(row.id)
      cmxMessage.success(t('brandingScreen.activated'))
    } catch (err) {
      fail(err)
    }
  }

  const data = query.data
  const themeName = (row: OrgThemeRow) => (isAr && row.theme_name2) || row.theme_name
  const hqName = (code: string) => {
    const hq = data?.catalog.themes.find((x) => x.code === code)
    return hq ? (isAr && hq.name2) || hq.name : code
  }

  return (
    <div className="max-w-4xl space-y-6">
      <CmxCard>
        <CmxCardHeader>
          <h2 className="text-lg font-semibold text-foreground">{t('brandingScreen.logos')}</h2>
        </CmxCardHeader>
        <CmxCardContent className="space-y-3">
          {tenantId ? (
            <FileAttachments
              category={FILE_CATEGORIES.TENANT_LOGO}
              entityId={tenantId}
              source={FILE_SOURCES.TENANT_SETTINGS}
              readOnly={!canEdit}
            />
          ) : null}
          <p className="text-sm text-muted-foreground">{t('brandingScreen.logosHint')}</p>
        </CmxCardContent>
      </CmxCard>

      <CmxCard>
        <CmxCardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
              <Palette className="h-5 w-5" aria-hidden="true" />
              {t('brandingScreen.savedThemes')}
            </h2>
            <p className="text-sm text-muted-foreground">{t('brandingScreen.savedThemesHint')}</p>
          </div>
          {canEdit && data ? (
            <CmxButton type="button" onClick={() => { setFieldErrors({}); setEditing('new') }}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              {t('brandingScreen.newTheme')}
            </CmxButton>
          ) : null}
        </CmxCardHeader>
        <CmxCardContent>
          {query.isLoading ? (
            <p className="text-sm text-muted-foreground" role="status">{tCommon('loading')}</p>
          ) : query.isError || !data ? (
            <div className="flex items-center justify-between gap-3" role="alert">
              <p className="text-sm text-danger-text">{t('brandingScreen.loadError')}</p>
              <CmxButton type="button" variant="outline" onClick={() => void query.refetch()}>{tCommon('retry')}</CmxButton>
            </div>
          ) : data.themes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('brandingScreen.noSavedThemes')}</p>
          ) : (
            <ul className="divide-y divide-border">
              {data.themes.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <span className="truncate">{themeName(row)}</span>
                      {row.is_active ? <CmxStatusBadge tone="brand" size="sm" label={t('brandingScreen.inUse')} /> : null}
                    </p>
                    <p className="text-sm text-muted-foreground">{t('brandingScreen.startsFrom', { theme: hqName(row.ui_theme_code) })}</p>
                  </div>
                  {canEdit ? (
                    <div className="flex flex-wrap gap-2">
                      {!row.is_active ? (
                        <CmxButton type="button" size="sm" onClick={() => void makeActive(row)} loading={activate.isPending && activate.variables === row.id}>
                          {t('brandingScreen.makeActive')}
                        </CmxButton>
                      ) : null}
                      <CmxButton type="button" size="sm" variant="outline" onClick={() => { setFieldErrors({}); setEditing(row) }}>
                        {tCommon('edit')}
                      </CmxButton>
                      {!row.is_active ? (
                        <CmxButton type="button" size="sm" variant="ghost" onClick={() => setDeleting(row)}>
                          {tCommon('delete')}
                        </CmxButton>
                      ) : null}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CmxCardContent>
      </CmxCard>

      {data && editing ? (
        <CmxDialog open onOpenChange={(open) => { if (!open) setEditing(null) }}>
          <CmxDialogContent className="max-w-4xl" scrollBody>
            <CmxDialogHeader>
              <CmxDialogTitle>{editing === 'new' ? t('brandingScreen.newTheme') : t('brandingScreen.editTheme')}</CmxDialogTitle>
            </CmxDialogHeader>
            <ThemeEditorForm
              catalog={data.catalog}
              plan={data.plan}
              initial={editing === 'new' ? null : editing}
              saving={create.isPending || update.isPending}
              fieldErrors={fieldErrors}
              onSubmit={(input) => void save(input)}
              onCancel={() => setEditing(null)}
            />
          </CmxDialogContent>
        </CmxDialog>
      ) : null}

      {deleting ? (
        <CmxConfirmDialog
          open
          title={t('brandingScreen.deleteTitle')}
          description={t('brandingScreen.deleteDescription', { name: themeName(deleting) })}
          confirmLabel={tCommon('delete')}
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(deleting.id)
              cmxMessage.success(t('brandingScreen.deleted'))
            } catch (err) {
              fail(err)
            } finally {
              setDeleting(null)
            }
          }}
        />
      ) : null}
    </div>
  )
}

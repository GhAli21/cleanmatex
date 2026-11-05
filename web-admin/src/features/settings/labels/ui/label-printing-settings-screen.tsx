'use client'

import { useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Tag } from 'lucide-react'

import { CmxButton, CmxSkeleton } from '@ui/primitives'
import { CmxSummaryMessage, cmxMessage } from '@ui/feedback'
import {
  CmxFormSection,
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms'

import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { SETTINGS_PERMISSIONS } from '@/lib/constants/permissions/settings-perm'
import {
  LABEL_TYPES,
  LABEL_TYPE_FIELDS,
  type LabelPrintingField,
  type LabelType,
} from '@/lib/services/labels/label-types'
import { LabelPrintingApiError } from '@features/settings/labels/api/label-printing-api'
import {
  useBranchOptions,
  useLabelPrintingSettings,
} from '@features/settings/labels/hooks/use-label-printing-settings'
import {
  INHERIT,
  fieldKind,
  fieldOptions,
  inheritedValue,
  type LabelScope,
} from '@features/settings/labels/model/label-printing-form'
import { InheritableSelectField } from './inheritable-select-field'

const ALL_BRANCHES = '__all__'

/**
 * Labels & Tags settings (HFC P4, A-46/A-49): order label, piece tag and receipt barcode, for all branches or one
 * branch, each value with "Use default". Reads need settings:read (page + API); saving needs settings:update
 * (enforced again by PUT /api/v1/settings/label-printing). Route: /dashboard/settings/labels.
 */
export function LabelPrintingSettingsScreen() {
  const t = useTranslations('labelSettings')
  const tCommon = useTranslations('common')
  const locale = useLocale()
  const canManage = useHasPermissionCode(SETTINGS_PERMISSIONS.UPDATE)
  const [branchId, setBranchId] = useState<string | null>(null)
  const scope: LabelScope = branchId ? 'branch' : 'tenant'

  const branches = useBranchOptions()
  const { config, isLoading, isError, values, setField, changes, discard, save, isSaving } =
    useLabelPrintingSettings(branchId)

  const valueLabel = (field: LabelPrintingField, v: string | null): string => {
    if (v === null) return t('values.notSet')
    const kind = fieldKind(field)
    if (kind === 'boolean') return v === 'true' ? t('values.true') : t('values.false')
    if (kind === 'size') return t.has(`sizes.${v}`) ? t(`sizes.${v}`) : v
    return v
  }

  const inUseHint = (type: LabelType, field: LabelPrintingField): string | undefined => {
    const row = config?.effective.find((r) => r.labelType === type)
    if (!row) return undefined
    const source = row.sources[field]
    const raw = row[field]
    const v = raw === null || raw === undefined ? null : String(raw)
    return t('inUse', {
      value: valueLabel(field, v),
      source: source && t.has(`sources.${source}`) ? t(`sources.${source}`) : '-',
    })
  }

  const onSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await save()
      cmxMessage.success(t('messages.saved'))
    } catch (error) {
      cmxMessage.error(error instanceof LabelPrintingApiError && error.status === 403 ? error.message : t('messages.saveFailed'))
    }
  }

  const branchName = (b: { name: string; name2: string | null }) => (locale === 'ar' ? b.name2 || b.name : b.name || b.name2 || '')
  const selectedBranch = branches.data?.find((b) => b.id === branchId)
  const receiptCapped = config?.effective.find((r) => r.labelType === 'RECEIPT')?.sources.showOrderBarcode === 'FEATURE_FLAG'

  return (
    <form onSubmit={onSave} className="max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[rgb(var(--cmx-primary-bg-rgb,239_246_255))] p-2">
          <Tag className="h-6 w-6 text-[rgb(var(--cmx-primary-rgb,14_165_233))]" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      {!canManage && <CmxSummaryMessage type="info" title={t('viewOnly.title')} items={[t('viewOnly.description')]} />}

      <div className="max-w-sm space-y-1">
        <span id="label-settings-scope" className="text-sm font-medium">
          {t('scope.label')}
        </span>
        <CmxSelectDropdown
          value={branchId ?? ALL_BRANCHES}
          onValueChange={(v) => setBranchId(v === ALL_BRANCHES ? null : v)}
          disabled={isSaving || changes > 0}
          isLoading={branches.isLoading}
        >
          <CmxSelectDropdownTrigger aria-labelledby="label-settings-scope">
            <CmxSelectDropdownValue displayValue={selectedBranch ? branchName(selectedBranch) : t('scope.allBranches')} />
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            <CmxSelectDropdownItem value={ALL_BRANCHES}>{t('scope.allBranches')}</CmxSelectDropdownItem>
            {(branches.data ?? []).map((b) => (
              <CmxSelectDropdownItem key={b.id} value={b.id}>
                {branchName(b)}
              </CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>
        <p className="text-xs text-muted-foreground">{scope === 'branch' ? t('scope.hintBranch') : t('scope.hintTenant')}</p>
        {branches.isError ? <p className="text-xs text-[rgb(var(--cmx-warning-rgb,245_158_11))]">{t('scope.branchesFailed')}</p> : null}
      </div>

      {isLoading || (!values && !isError) ? (
        <div className="space-y-4">
          <CmxSkeleton className="h-40 w-full" />
          <CmxSkeleton className="h-40 w-full" />
        </div>
      ) : isError || !config || !values ? (
        <CmxSummaryMessage type="error" title={t('messages.loadFailed')} items={[]} />
      ) : (
        <fieldset disabled={!canManage || isSaving} className="m-0 min-w-0 space-y-6 border-0 p-0">
          {LABEL_TYPES.map((type) => (
            <CmxFormSection
              key={type}
              title={t(`types.${type}.title`)}
              description={t(`types.${type}.description`)}
              layout="twoColumn"
            >
              {LABEL_TYPE_FIELDS[type].map((field) => (
                <InheritableSelectField
                  key={field}
                  label={t(`fields.${field}.label`)}
                  description={t(`fields.${field}.description`)}
                  value={values[type][field] ?? INHERIT}
                  options={fieldOptions(type, field)}
                  optionLabel={(v) => valueLabel(field, v)}
                  inheritLabel={t('useDefault', { value: valueLabel(field, inheritedValue(config, scope, type, field)) })}
                  hint={inUseHint(type, field)}
                  disabled={!canManage || isSaving}
                  onChange={(v) => setField(type, field, v)}
                />
              ))}
              {type === 'RECEIPT' && receiptCapped ? (
                <CmxSummaryMessage type="info" title={t('receiptBarcodeNote')} items={[]} />
              ) : null}
            </CmxFormSection>
          ))}
        </fieldset>
      )}

      {canManage && values ? (
        <div className="sticky bottom-0 -mx-6 flex items-center justify-end gap-3 border-t bg-[rgb(var(--cmx-background-rgb,255_255_255))] px-6 py-3">
          {changes > 0 && (
            <span className="me-auto text-sm text-muted-foreground" aria-live="polite">
              {t('unsavedChanges', { count: changes })}
            </span>
          )}
          <CmxButton type="button" variant="outline" disabled={isSaving || changes === 0} onClick={discard}>
            {t('discard')}
          </CmxButton>
          <CmxButton type="submit" disabled={isSaving || changes === 0}>
            {isSaving ? tCommon('saving') : tCommon('save')}
          </CmxButton>
        </div>
      ) : null}
    </form>
  )
}

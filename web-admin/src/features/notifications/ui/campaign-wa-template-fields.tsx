'use client'

import { useLocale, useTranslations } from 'next-intl'
import { CmxButton, CmxInput, CmxSkeleton, Label } from '@ui/primitives'
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message'
import { CmxSelectDropdown, CmxSelectDropdownTrigger, CmxSelectDropdownContent, CmxSelectDropdownItem } from '@ui/forms'
import type { WhatsAppMarketingTemplate } from '@lib/notifications/campaign-wa-templates.service'
import { useCampaignWhatsAppTemplates } from '../hooks/use-campaign-wa-templates'

/** The campaign's WhatsApp template choice: template code and a value per template variable. */
export interface CampaignWhatsAppTemplateValue {
  templateCode: string
  vars: Record<string, string>
}

interface Props {
  tenantId: string
  value: CampaignWhatsAppTemplateValue
  onChange: (next: CampaignWhatsAppTemplateValue) => void
  /** Variable keys the last submit found empty; shown under those fields. */
  missing: string[]
  templateError?: string
}

/**
 * Required checks the form runs before submitting (the API checks them again).
 * @param template - The chosen template, if any
 * @param vars - Entered values
 * @returns Keys of required variables that are still empty
 */
export function missingTemplateVars(template: WhatsAppMarketingTemplate | undefined, vars: Record<string, string>): string[] {
  return (template?.variables ?? []).filter((v) => v.required && !vars[v.key]?.trim()).map((v) => v.key)
}

/**
 * WhatsApp marketing template picker and its variable inputs for a customer campaign. Meta allows WhatsApp
 * marketing only through an approved MARKETING template, so the campaign has no free-text body on WhatsApp.
 * @param props - Tenant, current choice, change handler and validation state
 * @returns Loading, error, empty or picker state
 */
export function CampaignWhatsAppTemplateFields({ tenantId, value, onChange, missing, templateError }: Props) {
  const t = useTranslations('notifications.campaigns.form')
  const tCommon = useTranslations('common')
  const isArabic = useLocale() === 'ar'
  const query = useCampaignWhatsAppTemplates(tenantId, true)
  const templates = query.data ?? []
  const chosen = templates.find((tpl) => tpl.templateCode === value.templateCode)
  const label = (name: string, name2: string | null) => (isArabic && name2 ? name2 : name)

  if (query.isPending) {
    return (
      <div className="space-y-1" role="status" aria-label={tCommon('loading')}>
        <CmxSkeleton className="h-4 w-32" />
        <CmxSkeleton className="h-10 w-full" />
      </div>
    )
  }
  if (query.isError) {
    return (
      <div className="space-y-2">
        <CmxSummaryMessage type="error" title={t('waTemplatesLoadFailed')} items={[]} />
        <CmxButton type="button" size="sm" variant="outline" onClick={() => void query.refetch()}>{tCommon('retry')}</CmxButton>
      </div>
    )
  }
  if (templates.length === 0) return <CmxSummaryMessage type="warning" title={t('waTemplatesNone')} items={[]} />

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label className="block" htmlFor="wa-template">{t('waTemplate')}</Label>
        <CmxSelectDropdown value={value.templateCode} onValueChange={(code) => onChange({ templateCode: code, vars: {} })}>
          <CmxSelectDropdownTrigger id="wa-template" className="w-full" aria-invalid={Boolean(templateError)}>
            {chosen ? label(chosen.name, chosen.name2) : t('waTemplatePlaceholder')}
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            {templates.map((tpl) => (
              <CmxSelectDropdownItem key={tpl.templateCode} value={tpl.templateCode}>{label(tpl.name, tpl.name2)}</CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>
        {templateError && <p className="text-xs text-danger-text" role="alert">{templateError}</p>}
        <p className="text-xs text-muted-foreground">
          {chosen
            ? t.rich('waTemplateLanguages', { languages: chosen.languages.join(', '), langs: (chunks) => <bdi dir="ltr">{chunks}</bdi> })
            : t('waTemplateHint')}
        </p>
      </div>

      {chosen?.variables.map((v) => {
        const isMissing = missing.includes(v.key)
        return (
          <div key={v.key} className="space-y-1">
            <Label className="block" htmlFor={`wa-var-${v.key}`}>
              {label(v.name, v.name2)}
              {!v.required && <span className="ms-1 text-xs text-muted-foreground">({t('optional')})</span>}
            </Label>
            <CmxInput
              id={`wa-var-${v.key}`}
              value={value.vars[v.key] ?? ''}
              maxLength={1000}
              placeholder={v.example ?? undefined}
              onChange={(e) => onChange({ ...value, vars: { ...value.vars, [v.key]: e.target.value } })}
              error={isMissing ? t('waVarRequired') : undefined}
            />
          </div>
        )
      })}
    </div>
  )
}

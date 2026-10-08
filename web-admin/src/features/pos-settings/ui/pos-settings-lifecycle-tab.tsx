'use client'

import type { UseFormReturn } from 'react-hook-form'
import { useTranslations } from 'next-intl'

import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent } from '@ui/primitives/cmx-card'
import { CASH_CONTROL_ROLLOVER_MODE } from '@lib/constants/cash-control'
import type { PosSettingsFormValues } from '@features/pos-settings/hooks/use-pos-settings-form'
import { NumberField, SelectField, SwitchField } from './pos-settings-fields'

/**
 * "Shift lifecycle" tab: what happens to shifts left open at the business-day rollover, when a
 * shift counts as stale, and whether closing a shift freezes a Z-report.
 */
export function PosSettingsLifecycleTab({ form }: { form: UseFormReturn<PosSettingsFormValues> }) {
  const t = useTranslations('cashControl')
  const tPos = useTranslations('posSettings')

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{tPos('lifecycle.title')}</CmxCardTitle>
        <p className="text-sm text-muted-foreground">{tPos('lifecycle.description')}</p>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        <SelectField
          label={t('settings.posSessionRolloverMode.label')}
          description={t('settings.posSessionRolloverMode.description')}
          value={form.watch('posSessionRolloverMode')}
          options={Object.values(CASH_CONTROL_ROLLOVER_MODE)}
          optionLabel={(v) => t(`enums.posSessionRolloverMode.${v}` as never)}
          onChange={(v) => form.setValue('posSessionRolloverMode', v as never, { shouldDirty: true })}
        />
        <NumberField
          label={t('settings.posSessionStaleHours.label')}
          description={t('settings.posSessionStaleHours.description')}
          value={form.watch('posSessionStaleHours')}
          onChange={(v) => form.setValue('posSessionStaleHours', v ?? 0, { shouldDirty: true })}
        />
        <SwitchField
          label={t('settings.shiftZReportRequired.label')}
          description={t('settings.shiftZReportRequired.description')}
          checked={!!form.watch('shiftZReportRequired')}
          onCheckedChange={(v) => form.setValue('shiftZReportRequired', v, { shouldDirty: true })}
        />
      </CmxCardContent>
    </CmxCard>
  )
}

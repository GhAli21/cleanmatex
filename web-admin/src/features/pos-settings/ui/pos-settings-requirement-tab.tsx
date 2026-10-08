'use client'

import type { UseFormReturn } from 'react-hook-form'
import { useTranslations } from 'next-intl'

import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent } from '@ui/primitives/cmx-card'
import { POS_SESSION_REQUIREMENT_MODE } from '@lib/constants/pos-session'
import type { PosSettingsFormValues } from '@features/pos-settings/hooks/use-pos-settings-form'
import { POS_SESSION_SURFACE_FIELDS } from '@features/pos-settings/model/pos-settings-tabs'
import { SelectField } from './pos-settings-fields'

/** "Session requirement" tab: per finance screen, whether an open POS session is needed. */
export function PosSettingsRequirementTab({ form }: { form: UseFormReturn<PosSettingsFormValues> }) {
  const t = useTranslations('cashControl')
  const tPos = useTranslations('posSettings')

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{tPos('requirement.title')}</CmxCardTitle>
        <p className="text-sm text-muted-foreground">{tPos('requirement.description')}</p>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        {POS_SESSION_SURFACE_FIELDS.map((field) => (
          <SelectField
            key={field}
            label={t(`settings.${field}.label` as never)}
            description={t(`settings.${field}.description` as never)}
            value={form.watch(field)}
            options={Object.values(POS_SESSION_REQUIREMENT_MODE)}
            optionLabel={(v) => t(`enums.posSessionRequirementMode.${v}` as never)}
            onChange={(v) => form.setValue(field, v as never, { shouldDirty: true })}
          />
        ))}
      </CmxCardContent>
    </CmxCard>
  )
}

'use client'

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { fetchDrawerPolicy, updateDrawerPolicy } from '@features/cash-drawers/api/cash-drawer-api'
import { useCSRFToken } from '@lib/hooks/use-csrf-token'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { useCashDrawerErrorMessage } from '@features/cash-drawers/hooks/use-cash-drawer-error-message'
import {
  CASH_CONTROL_VALUE_SOURCE,
  CASH_CONTROL_VARIANCE_GATE_MODE,
  type CashControlSettings,
} from '@lib/constants/cash-control'
import type { CashControlSettingsPatchInput } from '@lib/validations/cash-control-schemas'
import { cmxMessage } from '@ui/feedback'
import { CmxButton, CmxSelect, CmxSkeleton, CmxSwitch } from '@ui/primitives'
import { CmxScopedSettingField } from '@ui/patterns'

type BooleanField = 'requiresSession' | 'openingCountRequired' | 'closingCountRequired' | 'blindCloseEnabled'

const BOOLEAN_FIELDS: BooleanField[] = [
  'requiresSession',
  'openingCountRequired',
  'closingCountRequired',
  'blindCloseEnabled',
]

/**
 * Policy tab (CLF-8-7) — the drawer's effective cash-control rules, each with
 * its inheritance source and a per-drawer override / reset. Writes only
 * drawer-scope overrides; tenant/branch defaults stay on the cash-control
 * settings screen.
 * @param props component props
 * @param props.drawerId drawer whose policy is shown
 */
export function CashDrawerPolicyTab({ drawerId }: { drawerId: string }) {
  const t = useTranslations('billing.cashDrawers.tabs.policy')
  const tCommon = useTranslations('common')
  const tSettings = useTranslations('cashControl.settings')
  const tEnums = useTranslations('cashControl.enums')
  const errorMessage = useCashDrawerErrorMessage()
  const queryClient = useQueryClient()
  const { token: csrfToken } = useCSRFToken()
  const canManage = useHasPermissionCode('cash_control:manage')
  const [savingField, setSavingField] = useState<string | null>(null)

  const queryKey = ['cash-drawers', drawerId, 'policy']
  const query = useQuery({ queryKey, queryFn: () => fetchDrawerPolicy(drawerId) })

  const save = async (field: keyof CashControlSettings, value: boolean | string | null) => {
    setSavingField(field)
    try {
      const updated = await updateDrawerPolicy({
        drawerId,
        patch: { [field]: value } as CashControlSettingsPatchInput,
        csrfToken,
      })
      queryClient.setQueryData(queryKey, updated)
      cmxMessage.success(t('saved'))
    } catch (error) {
      cmxMessage.error(errorMessage(error, t('saveFailed')))
    } finally {
      setSavingField(null)
    }
  }

  if (query.isLoading) return <CmxSkeleton className="h-48 w-full" />
  if (query.isError || !query.data) {
    return (
      <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
        <span>{errorMessage(query.error, t('saveFailed'))}</span>
        <CmxButton size="sm" variant="outline" onClick={() => query.refetch()}>
          {tCommon('retry')}
        </CmxButton>
      </div>
    )
  }

  const { settings, sources } = query.data
  const sourceLabel = (field: keyof CashControlSettings) => t(`source.${sources[field]}`)
  const isOverridden = (field: keyof CashControlSettings) => sources[field] === CASH_CONTROL_VALUE_SOURCE.DRAWER

  return (
    <div className="space-y-3">
      <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('description')}</p>
      {!canManage ? <p role="note" className="text-xs font-medium">{t('viewOnly')}</p> : null}

      {BOOLEAN_FIELDS.map((field) => (
        <CmxScopedSettingField
          key={field}
          label={tSettings(`${field}.label`)}
          description={tSettings(`${field}.description`)}
          sourceLabel={sourceLabel(field)}
          isOverridden={isOverridden(field)}
          onReset={() => save(field, null)}
          resetLabel={t('reset')}
          disabled={!canManage || savingField !== null}
        >
          <CmxSwitch
            checked={settings[field]}
            onCheckedChange={(checked) => save(field, checked)}
            disabled={!canManage || savingField !== null}
            aria-label={tSettings(`${field}.label`)}
          />
        </CmxScopedSettingField>
      ))}

      <CmxScopedSettingField
        label={tSettings('varianceGateMode.label')}
        description={tSettings('varianceGateMode.description')}
        sourceLabel={sourceLabel('varianceGateMode')}
        isOverridden={isOverridden('varianceGateMode')}
        onReset={() => save('varianceGateMode', null)}
        resetLabel={t('reset')}
        disabled={!canManage || savingField !== null}
      >
        <CmxSelect
          value={settings.varianceGateMode}
          onChange={(event) => save('varianceGateMode', event.target.value)}
          disabled={!canManage || savingField !== null}
          aria-label={tSettings('varianceGateMode.label')}
          options={Object.values(CASH_CONTROL_VARIANCE_GATE_MODE).map((mode) => ({
            value: mode,
            label: tEnums(`varianceGateMode.${mode}`),
          }))}
        />
      </CmxScopedSettingField>
    </div>
  )
}

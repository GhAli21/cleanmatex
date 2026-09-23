'use client'

import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { ShieldCheck } from 'lucide-react'

import { CmxButton } from '@ui/primitives'
import { CmxInput } from '@ui/primitives'
import { CmxSwitch } from '@ui/primitives'
import { CmxSkeleton } from '@ui/primitives'
import { CmxCard, CmxCardHeader, CmxCardTitle, CmxCardContent } from '@ui/primitives/cmx-card'
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms'
import { CmxSummaryMessage } from '@ui/feedback'
import { cmxMessage } from '@ui/feedback'

import { useCSRFToken } from '@/lib/hooks/use-csrf-token'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { useTenantCurrency } from '@/lib/context/tenant-currency-context'
import {
  fetchCashControlSettings,
  updateCashControlSettingsApi,
  CashControlSettingsApiError,
} from '@features/cash-drawers/api/cash-control-settings-api'
import {
  cashControlSettingsPatchSchema,
  type CashControlSettingsPatchInput,
} from '@lib/validations/cash-control-schemas'
import {
  CASH_CONTROL_ASSIGNMENT_MODE,
  CASH_CONTROL_CHANGE_BEARER,
  CASH_CONTROL_COUNT_MODE,
  CASH_CONTROL_MAX_CASH_ENFORCE_MODE,
  CASH_CONTROL_ROLLOVER_MODE,
  CASH_CONTROL_SHARED_SESSION_MODE,
  CASH_CONTROL_TRACKING_MODE,
  CASH_CONTROL_VARIANCE_GATE_MODE,
  type CashControlSettings,
} from '@lib/constants/cash-control'

const QUERY_KEY = ['cash-control-settings'] as const

/** RHF form values are the full resolved settings; the PUT patch is derived from dirty fields only. */
type FormValues = CashControlSettings

/**
 * Tenant-level cash-control policy admin screen (POS Session & Cash Drawer
 * Hardening, W0-5). Route: /dashboard/settings/payments/cash-control-settings,
 * gated by cash_control:view (page) / cash_control:manage (save).
 *
 * v1 scope: TENANT-level defaults only. The resolver/service already
 * supports BRANCH/USER/DRAWER overrides (§3.1.3) and a per-field "clear
 * override" action, but the scope picker and reset-to-default affordances
 * are a deliberate follow-up (STATUS.md D19) — building the full
 * scope-cascade UI is a separate, larger pass.
 */
export function CashControlSettingsScreen() {
  const t = useTranslations('cashControl')
  const tCommon = useTranslations('common')
  const { token: csrfToken } = useCSRFToken()
  const { currencyCode } = useTenantCurrency()
  const queryClient = useQueryClient()
  const canManage = useHasPermissionCode('cash_control:manage')

  const settingsQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchCashControlSettings,
  })

  const form = useForm<FormValues>({
    resolver: zodResolver(cashControlSettingsPatchSchema) as unknown as Resolver<FormValues>,
    values: settingsQuery.data,
  })

  useEffect(() => {
    if (settingsQuery.error) {
      cmxMessage.error(
        settingsQuery.error instanceof Error ? settingsQuery.error.message : t('messages.loadFailed')
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsQuery.error])

  const cashChangeBearer = form.watch('cashChangeBearer')

  const onSubmit = async (values: FormValues) => {
    const dirtyFields = form.formState.dirtyFields as Partial<Record<keyof FormValues, boolean>>
    const patch: CashControlSettingsPatchInput = {}
    for (const key of Object.keys(dirtyFields) as (keyof FormValues)[]) {
      if (dirtyFields[key]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(patch as any)[key] = values[key]
      }
    }

    if (Object.keys(patch).length === 0) {
      return
    }

    try {
      const updated = await updateCashControlSettingsApi({ patch, csrfToken })
      queryClient.setQueryData(QUERY_KEY, updated)
      form.reset(updated)
      cmxMessage.success(t('messages.saved'))
    } catch (error) {
      const message =
        error instanceof CashControlSettingsApiError ? error.message : t('messages.saveFailed')
      cmxMessage.error(message)
    }
  }

  /**
   * RHF silently blocks submission on a client-side Zod failure (e.g. a
   * negative threshold) with no visible feedback by default — surface it
   * rather than leaving the Save click looking like a no-op.
   */
  const onInvalid = () => {
    cmxMessage.error(t('messages.saveFailed'))
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="max-w-4xl space-y-4 p-6">
        <CmxSkeleton className="h-8 w-64" />
        <CmxSkeleton className="h-40 w-full" />
        <CmxSkeleton className="h-40 w-full" />
      </div>
    )
  }

  if (settingsQuery.isError) {
    return (
      <div className="max-w-4xl p-6">
        <CmxSummaryMessage type="error" title={t('messages.loadFailed')} items={[]} />
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="max-w-4xl space-y-6 p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-[rgb(var(--cmx-primary-bg-rgb,239_246_255))] p-2">
          <ShieldCheck className="h-6 w-6 text-[rgb(var(--cmx-primary-rgb,14_165_233))]" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
      </div>

      {!canManage && (
        <CmxSummaryMessage
          type="info"
          title={t('viewOnlyTitle')}
          items={[t('viewOnlyDescription')]}
        />
      )}

      <fieldset disabled={!canManage} className="m-0 min-w-0 space-y-6 border-0 p-0">
      {/* Drawer close controls */}
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('sections.drawerClose')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="space-y-4">
          <SwitchField
            label={t('settings.blindCloseEnabled.label')}
            description={t('settings.blindCloseEnabled.description')}
            checked={!!form.watch('blindCloseEnabled')}
            onCheckedChange={(v) => form.setValue('blindCloseEnabled', v, { shouldDirty: true })}
          />
          <SelectField
            label={t('settings.varianceGateMode.label')}
            description={t('settings.varianceGateMode.description')}
            value={form.watch('varianceGateMode')}
            options={Object.values(CASH_CONTROL_VARIANCE_GATE_MODE)}
            optionLabel={(v) => t(`enums.varianceGateMode.${v}` as never)}
            onChange={(v) => form.setValue('varianceGateMode', v as never, { shouldDirty: true })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <NumberField
              label={t('settings.varianceToleranceAmount.label')}
              description={t('settings.varianceToleranceAmount.description')}
              value={form.watch('varianceToleranceAmount')}
              onChange={(v) => form.setValue('varianceToleranceAmount', v, { shouldDirty: true })}
            />
            <NumberField
              label={t('settings.varianceReasonAmount.label')}
              description={t('settings.varianceReasonAmount.description')}
              value={form.watch('varianceReasonAmount')}
              onChange={(v) => form.setValue('varianceReasonAmount', v, { shouldDirty: true })}
            />
            <NumberField
              label={t('settings.varianceThresholdAmount.label')}
              description={t('settings.varianceThresholdAmount.description')}
              value={form.watch('varianceThresholdAmount')}
              onChange={(v) => form.setValue('varianceThresholdAmount', v, { shouldDirty: true })}
            />
          </div>
          <p className="text-xs text-muted-foreground">{t('varianceOrderHint')}</p>
          <SelectField
            label={t('settings.cashTrackingMode.label')}
            description={t('settings.cashTrackingMode.description')}
            value={form.watch('cashTrackingMode')}
            options={Object.values(CASH_CONTROL_TRACKING_MODE)}
            optionLabel={(v) => t(`enums.cashTrackingMode.${v}` as never)}
            onChange={(v) => form.setValue('cashTrackingMode', v as never, { shouldDirty: true })}
          />
          <SelectField
            label={t('settings.openingCountMode.label')}
            description={t('settings.openingCountMode.description')}
            value={form.watch('openingCountMode')}
            options={Object.values(CASH_CONTROL_COUNT_MODE)}
            optionLabel={(v) => t(`enums.countMode.${v}` as never)}
            onChange={(v) => form.setValue('openingCountMode', v as never, { shouldDirty: true })}
          />
          <SelectField
            label={t('settings.closingCountMode.label')}
            description={t('settings.closingCountMode.description')}
            value={form.watch('closingCountMode')}
            options={Object.values(CASH_CONTROL_COUNT_MODE)}
            optionLabel={(v) => t(`enums.countMode.${v}` as never)}
            onChange={(v) => form.setValue('closingCountMode', v as never, { shouldDirty: true })}
          />
        </CmxCardContent>
      </CmxCard>

      {/* Cash-change rounding (D16) */}
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('sections.cashChangeRounding')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="space-y-4">
          <SelectField
            label={t('settings.cashChangeBearer.label')}
            description={t('settings.cashChangeBearer.description')}
            value={cashChangeBearer}
            options={Object.values(CASH_CONTROL_CHANGE_BEARER)}
            optionLabel={(v) => t(`enums.cashChangeBearer.${v}` as never)}
            onChange={(v) => form.setValue('cashChangeBearer', v as never, { shouldDirty: true })}
          />
          <p className="text-sm text-muted-foreground">
            {(t as unknown as (key: string, values?: Record<string, string>) => string)(
              `changeBearerExample.${cashChangeBearer}`,
              { currency: currencyCode }
            )}
          </p>
          {cashChangeBearer === CASH_CONTROL_CHANGE_BEARER.CUSTOMER && (
            <CmxSummaryMessage type="warning" title={t('customerWarningTitle')} items={[t('customerWarning')]} />
          )}
          <NumberField
            label={t('settings.cashChangeRoundToMinor.label')}
            description={t('settings.cashChangeRoundToMinor.description')}
            value={form.watch('cashChangeRoundToMinor')}
            onChange={(v) => form.setValue('cashChangeRoundToMinor', v, { shouldDirty: true })}
          />
        </CmxCardContent>
      </CmxCard>

      {/* Drawer custody */}
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('sections.drawerCustody')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="space-y-4">
          <SelectField
            label={t('settings.drawerAssignmentMode.label')}
            description={t('settings.drawerAssignmentMode.description')}
            value={form.watch('drawerAssignmentMode')}
            options={Object.values(CASH_CONTROL_ASSIGNMENT_MODE)}
            optionLabel={(v) => t(`enums.drawerAssignmentMode.${v}` as never)}
            onChange={(v) => form.setValue('drawerAssignmentMode', v as never, { shouldDirty: true })}
          />
          <SelectField
            label={t('settings.sharedSessionMode.label')}
            description={t('settings.sharedSessionMode.description')}
            value={form.watch('sharedSessionMode')}
            options={Object.values(CASH_CONTROL_SHARED_SESSION_MODE)}
            optionLabel={(v) => t(`enums.sharedSessionMode.${v}` as never)}
            onChange={(v) => form.setValue('sharedSessionMode', v as never, { shouldDirty: true })}
          />
          <SelectField
            label={t('settings.maxCashEnforceMode.label')}
            description={t('settings.maxCashEnforceMode.description')}
            value={form.watch('maxCashEnforceMode')}
            options={Object.values(CASH_CONTROL_MAX_CASH_ENFORCE_MODE)}
            optionLabel={(v) => t(`enums.maxCashEnforceMode.${v}` as never)}
            onChange={(v) => form.setValue('maxCashEnforceMode', v as never, { shouldDirty: true })}
          />
          <SwitchField
            label={t('settings.cashDropRequiresDest.label')}
            description={t('settings.cashDropRequiresDest.description')}
            checked={!!form.watch('cashDropRequiresDest')}
            onCheckedChange={(v) => form.setValue('cashDropRequiresDest', v, { shouldDirty: true })}
          />
        </CmxCardContent>
      </CmxCard>

      {/* POS session controls */}
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('sections.posSession')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="space-y-4">
          <SwitchField
            label={t('settings.posSessionReqForCash.label')}
            description={t('settings.posSessionReqForCash.description')}
            checked={!!form.watch('posSessionReqForCash')}
            onCheckedChange={(v) => form.setValue('posSessionReqForCash', v, { shouldDirty: true })}
          />
          <SwitchField
            label={t('settings.posSessionReqAllTenders.label')}
            description={t('settings.posSessionReqAllTenders.description')}
            checked={!!form.watch('posSessionReqAllTenders')}
            onCheckedChange={(v) => form.setValue('posSessionReqAllTenders', v, { shouldDirty: true })}
          />
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

      <div className="flex items-center justify-end gap-3 border-t pt-4">
        <CmxButton
          type="submit"
          disabled={form.formState.isSubmitting || !form.formState.isDirty || !canManage}
        >
          {form.formState.isSubmitting ? tCommon('saving') : tCommon('save')}
        </CmxButton>
      </div>
      </fieldset>
    </form>
  )
}

// ---------------------------------------------------------------------------
// Small field wrappers (kept local — not reusable enough yet to promote to
// src/ui; extract to Cmx* only if a second screen needs the same shape).
// ---------------------------------------------------------------------------

function SwitchField({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <CmxSwitch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

/**
 * Deliberately typed over plain `string`, not a generic literal union: the
 * DB-mirrored enum catalogs in `lib/constants/cash-control.ts` are
 * `Record<string, string>` objects, so `Object.values(...)` widens to
 * `string[]` at the call sites below. Every call site already casts through
 * `form.setValue(field, v as never, ...)`, so the runtime value is exactly
 * one of the enum's members regardless of this wrapper's static type.
 */
function SelectField({
  label,
  description,
  value,
  options,
  optionLabel,
  onChange,
}: {
  label: string
  description: string
  value: string
  options: readonly string[]
  optionLabel: (value: string) => string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <CmxSelectDropdown value={value} onValueChange={onChange}>
        <CmxSelectDropdownTrigger>
          <CmxSelectDropdownValue />
        </CmxSelectDropdownTrigger>
        <CmxSelectDropdownContent>
          {options.map((option) => (
            <CmxSelectDropdownItem key={option} value={option}>
              {optionLabel(option)}
            </CmxSelectDropdownItem>
          ))}
        </CmxSelectDropdownContent>
      </CmxSelectDropdown>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

function NumberField({
  label,
  description,
  value,
  onChange,
}: {
  label: string
  description: string
  value: number | null
  onChange: (value: number | null) => void
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <CmxInput
        type="number"
        step="0.001"
        min="0"
        value={value ?? ''}
        onChange={(e) => {
          const raw = e.target.value
          onChange(raw === '' ? null : Number(raw))
        }}
      />
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

'use client'

import { useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, type Resolver, type UseFormReturn } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { cmxMessage } from '@ui/feedback'

import { useCSRFToken } from '@/lib/hooks/use-csrf-token'
import {
  fetchCashControlSettings,
  updateCashControlSettingsApi,
  CashControlSettingsApiError,
} from '@features/cash-drawers/api/cash-control-settings-api'
import {
  cashControlSettingsPatchSchema,
  type CashControlSettingsPatchInput,
} from '@lib/validations/cash-control-schemas'
import type { CashControlSettings } from '@lib/constants/cash-control'
import { pickPosSettings, type PosSettingsField } from '@features/pos-settings/model/pos-settings-tabs'

export const POS_SETTINGS_QUERY_KEY = ['cash-control-settings'] as const

/**
 * RHF form values are the POS-owned slice of the resolved policy; the PUT patch is derived from
 * dirty fields only, so the cash-control fields (edited on their own page) are never sent.
 */
export type PosSettingsFormValues = Pick<CashControlSettings, PosSettingsField>

export interface UsePosSettingsForm {
  form: UseFormReturn<PosSettingsFormValues>
  isLoading: boolean
  isError: boolean
  /** Saves only the fields the user changed; resolves without a request when nothing is dirty. */
  save: () => Promise<void>
}

/**
 * Loads the resolved tenant policy, narrowed to the POS-session fields, and owns the single form
 * shared by every settings tab, so one Save covers edits made across tabs.
 */
export function usePosSettingsForm(): UsePosSettingsForm {
  const t = useTranslations('cashControl')
  const { token: csrfToken } = useCSRFToken()
  const queryClient = useQueryClient()

  const settingsQuery = useQuery({
    queryKey: POS_SETTINGS_QUERY_KEY,
    queryFn: fetchCashControlSettings,
  })

  const formValues = useMemo(
    () => (settingsQuery.data ? pickPosSettings(settingsQuery.data) : undefined),
    [settingsQuery.data]
  )

  const form = useForm<PosSettingsFormValues>({
    resolver: zodResolver(cashControlSettingsPatchSchema) as unknown as Resolver<PosSettingsFormValues>,
    values: formValues,
  })

  useEffect(() => {
    if (settingsQuery.error) {
      cmxMessage.error(
        settingsQuery.error instanceof Error ? settingsQuery.error.message : t('messages.loadFailed')
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsQuery.error])

  const submit = async (values: PosSettingsFormValues) => {
    const dirtyFields = form.formState.dirtyFields as Partial<Record<keyof PosSettingsFormValues, boolean>>
    const patch: CashControlSettingsPatchInput = {}
    for (const key of Object.keys(dirtyFields) as (keyof PosSettingsFormValues)[]) {
      if (dirtyFields[key]) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(patch as any)[key] = values[key]
      }
    }
    if (Object.keys(patch).length === 0) return

    try {
      const updated = await updateCashControlSettingsApi({ patch, csrfToken })
      queryClient.setQueryData(POS_SETTINGS_QUERY_KEY, updated)
      form.reset(pickPosSettings(updated))
      cmxMessage.success(t('messages.saved'))
    } catch (error) {
      cmxMessage.error(
        error instanceof CashControlSettingsApiError ? error.message : t('messages.saveFailed')
      )
    }
  }

  // RHF blocks submission silently on a client-side Zod failure (e.g. a negative threshold), so the
  // invalid branch must say something or Save looks like a no-op.
  const onInvalid = () => {
    cmxMessage.error(t('messages.saveFailed'))
  }

  return {
    form,
    isLoading: settingsQuery.isLoading,
    isError: settingsQuery.isError,
    save: form.handleSubmit(submit, onInvalid),
  }
}

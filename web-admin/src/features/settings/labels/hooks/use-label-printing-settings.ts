'use client'

import { useCallback, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useCSRFToken } from '@/lib/hooks/use-csrf-token'
import type { LabelPrintingField, LabelType } from '@/lib/services/labels/label-types'
import {
  fetchLabelPrintingConfig,
  saveLabelPrintingConfig,
} from '@features/settings/labels/api/label-printing-api'
import {
  countChanges,
  toFormValues,
  toSaveRows,
  type LabelFormValues,
  type LabelPrintingConfigView,
} from '@features/settings/labels/model/label-printing-form'

export const LABEL_PRINTING_QUERY_KEY = ['settings', 'label-printing'] as const

export interface BranchOption {
  id: string
  name: string
  name2: string | null
}

/**
 * Loads the label printing config of one scope (tenant-wide when branchId is null) and holds the edit state.
 *
 * @param branchId branch being edited, or null for all branches
 * @returns config, form values, change count and save/discard actions
 */
export function useLabelPrintingSettings(branchId: string | null) {
  const { token: csrfToken } = useCSRFToken()
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: [...LABEL_PRINTING_QUERY_KEY, branchId ?? 'tenant'],
    queryFn: () => fetchLabelPrintingConfig(branchId),
  })

  const saved = useMemo<LabelFormValues | null>(() => {
    if (!query.data) return null
    return toFormValues(branchId ? query.data.branchOverrides : query.data.tenantOverrides)
  }, [query.data, branchId])

  // Edit state keyed by the saved values: a new scope or a fresh load replaces it (state adjusted during render,
  // no effect).
  const [edit, setEdit] = useState<{ base: LabelFormValues | null; values: LabelFormValues | null }>({
    base: saved,
    values: saved,
  })
  if (edit.base !== saved) setEdit({ base: saved, values: saved })
  const values = edit.base === saved ? edit.values : saved
  const [isSaving, setIsSaving] = useState(false)

  const setField = useCallback((type: LabelType, field: LabelPrintingField, value: string) => {
    setEdit((prev) =>
      prev.values ? { ...prev, values: { ...prev.values, [type]: { ...prev.values[type], [field]: value } } } : prev
    )
  }, [])

  const changes = saved && values ? countChanges(saved, values) : 0

  const discard = useCallback(() => setEdit({ base: saved, values: saved }), [saved])

  const save = useCallback(async (): Promise<LabelPrintingConfigView | null> => {
    if (!values) return null
    setIsSaving(true)
    try {
      const updated = await saveLabelPrintingConfig({ branchId, rows: toSaveRows(values), csrfToken })
      queryClient.setQueryData([...LABEL_PRINTING_QUERY_KEY, branchId ?? 'tenant'], updated)
      // Other scopes inherit from this one: reload them when they are opened again.
      await queryClient.invalidateQueries({
        queryKey: LABEL_PRINTING_QUERY_KEY,
        predicate: (q) => q.queryKey[2] !== (branchId ?? 'tenant'),
      })
      return updated
    } finally {
      setIsSaving(false)
    }
  }, [branchId, csrfToken, queryClient, values])

  return {
    config: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    values,
    setField,
    changes,
    discard,
    save,
    isSaving,
  }
}

/**
 * Tenant branches for the scope selector (GET /api/v1/branches).
 *
 * @returns react-query result with the branch list
 */
export function useBranchOptions() {
  return useQuery({
    queryKey: ['branches', 'list'],
    queryFn: async (): Promise<BranchOption[]> => {
      const res = await fetch('/api/v1/branches', { credentials: 'include' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error ?? 'Failed to load branches')
      return (json.data ?? []) as BranchOption[]
    },
  })
}

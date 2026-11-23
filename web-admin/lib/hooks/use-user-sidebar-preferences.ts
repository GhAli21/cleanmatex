'use client'

/**
 * Per-user sidebar preferences hook (sidebar color palette + tenant-scoped pinned screens).
 * Persists to `sys_users_mst` via `GET/PUT /api/v1/me/ui-preferences` with instant optimistic updates.
 *
 * @module lib/hooks/use-user-sidebar-preferences
 */

import { useCallback, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/auth-context'
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token'
import {
  DEFAULT_UI_SIDEBAR_THEME,
  MAX_SIDEBAR_PINS_PER_TENANT,
  UI_SIDEBAR_THEMES,
  type UiSidebarTheme,
} from '@/lib/constants/ui-theme'
import { useMessage } from '@ui/feedback'

interface UserUiPreferencesResponse {
  ui_sidebar_theme?: string | null
  ui_sidebar_pinned?: Record<string, string[]> | null
}

const QUERY_KEY = ['me', 'ui-preferences'] as const

function isSidebarTheme(value: unknown): value is UiSidebarTheme {
  return typeof value === 'string' && (UI_SIDEBAR_THEMES as readonly string[]).includes(value)
}

export function useUserSidebarPreferences() {
  const { user, currentTenant } = useAuth()
  const tenantId = currentTenant?.tenant_id
  const { token: csrfToken } = useCSRFToken()
  const queryClient = useQueryClient()
  const { showError } = useMessage()
  const tSidebar = useTranslations('layout.sidebar')

  const { data } = useQuery<UserUiPreferencesResponse>({
    queryKey: [...QUERY_KEY, user?.id ?? null],
    queryFn: async () => {
      const res = await fetch('/api/v1/me/ui-preferences', { credentials: 'include' })
      if (!res.ok) return {}
      const json = (await res.json()) as { data?: UserUiPreferencesResponse }
      return json.data ?? {}
    },
    enabled: Boolean(user?.id),
    staleTime: 5 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  })

  const sidebarTheme: UiSidebarTheme = isSidebarTheme(data?.ui_sidebar_theme)
    ? data.ui_sidebar_theme
    : DEFAULT_UI_SIDEBAR_THEME

  const pinnedMap = useMemo<Record<string, string[]>>(
    () => (data?.ui_sidebar_pinned && typeof data.ui_sidebar_pinned === 'object' ? data.ui_sidebar_pinned : {}),
    [data],
  )

  const pinnedKeys = useMemo<string[]>(
    () => (tenantId && Array.isArray(pinnedMap[tenantId]) ? pinnedMap[tenantId] : []),
    [pinnedMap, tenantId],
  )

  const mutation = useMutation({
    mutationFn: async (payload: {
      ui_sidebar_theme?: UiSidebarTheme
      ui_sidebar_pinned?: Record<string, string[]>
    }) => {
      const res = await fetch('/api/v1/me/ui-preferences', {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...getCSRFHeader(csrfToken),
        },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        throw new Error('Failed to save sidebar preferences')
      }
      const json = (await res.json()) as { data?: UserUiPreferencesResponse }
      return json.data ?? payload
    },
    onMutate: async (payload) => {
      const key = [...QUERY_KEY, user?.id ?? null]
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<UserUiPreferencesResponse>(key)
      queryClient.setQueryData<UserUiPreferencesResponse>(key, (old) => ({
        ...old,
        ...payload,
      }))
      return { previous, key }
    },
    onError: (_err, _payload, context) => {
      if (context?.previous !== undefined) {
        queryClient.setQueryData(context.key, context.previous)
      }
      showError(tSidebar('savePreferencesError'))
    },
    onSuccess: (saved) => {
      queryClient.setQueryData<UserUiPreferencesResponse>([...QUERY_KEY, user?.id ?? null], (old) => ({
        ...old,
        ...saved,
      }))
    },
  })

  const setSidebarTheme = useCallback(
    (nextTheme: UiSidebarTheme) => {
      if (!user?.id || nextTheme === sidebarTheme) return
      mutation.mutate({ ui_sidebar_theme: nextTheme })
    },
    [mutation, sidebarTheme, user?.id],
  )

  const togglePin = useCallback(
    (menuKey: string) => {
      if (!user?.id || !tenantId) return
      const current = Array.isArray(pinnedMap[tenantId]) ? pinnedMap[tenantId] : []
      const exists = current.includes(menuKey)
      const nextForTenant = exists
        ? current.filter((k) => k !== menuKey)
        : [...current, menuKey].slice(0, MAX_SIDEBAR_PINS_PER_TENANT)
      mutation.mutate({
        ui_sidebar_pinned: {
          ...pinnedMap,
          [tenantId]: nextForTenant,
        },
      })
    },
    [mutation, pinnedMap, tenantId, user?.id],
  )

  const clearPins = useCallback(() => {
    if (!user?.id || !tenantId) return
    mutation.mutate({
      ui_sidebar_pinned: {
        ...pinnedMap,
        [tenantId]: [],
      },
    })
  }, [mutation, pinnedMap, tenantId, user?.id])

  return {
    sidebarTheme,
    pinnedKeys,
    setSidebarTheme,
    togglePin,
    clearPins,
    isSaving: mutation.isPending,
  }
}

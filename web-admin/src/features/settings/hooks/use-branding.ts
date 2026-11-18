/**
 * Branding screen data and actions (TanStack Query). After a change to the theme
 * in use, the page is refreshed so the server re-renders the theme.
 * @module features/settings/hooks/use-branding
 */

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import type { OrgThemeInput } from '@/lib/validations/ui-theme'
import { brandingApi } from '@features/settings/api/branding-api'

const KEY = ['settings', 'branding'] as const

/** @returns The branding query and its mutations */
export function useBranding() {
  const queryClient = useQueryClient()
  const router = useRouter()
  const query = useQuery({ queryKey: KEY, queryFn: brandingApi.load })
  const done = (refreshPage: boolean) => async () => {
    await queryClient.invalidateQueries({ queryKey: KEY })
    if (refreshPage) router.refresh()
  }

  return {
    query,
    create: useMutation({ mutationFn: (input: OrgThemeInput) => brandingApi.create(input), onSuccess: done(false) }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: OrgThemeInput }) => brandingApi.update(id, input),
      onSuccess: done(true),
    }),
    activate: useMutation({ mutationFn: (id: string) => brandingApi.activate(id), onSuccess: done(true) }),
    remove: useMutation({ mutationFn: (id: string) => brandingApi.remove(id), onSuccess: done(false) }),
  }
}

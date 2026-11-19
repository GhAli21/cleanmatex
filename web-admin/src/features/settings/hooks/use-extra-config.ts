'use client';

/**
 * TanStack Query hook for Extra Tenant Configuration screen.
 * Refreshes Next.js RSC layout after every save/reset so formatters, tables,
 * and `<html>` data attributes reflect updates immediately.
 *
 * @module features/settings/hooks/use-extra-config
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import type {
  ExtraConfigSaveEntry,
  ExtraConfigScreenPayload,
} from '@/lib/types/tenant-extra-config';
import { extraConfigApi } from '@features/settings/api/extra-config-api';

const EXTRA_CONFIG_QUERY_KEY = ['settings', 'extra-config'] as const;

/** Query + mutations for `/dashboard/settings/extra-config`. */
export function useExtraConfig() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const query = useQuery({
    queryKey: EXTRA_CONFIG_QUERY_KEY,
    queryFn: extraConfigApi.load,
  });

  const handleSuccess = async (next: ExtraConfigScreenPayload) => {
    queryClient.setQueryData(EXTRA_CONFIG_QUERY_KEY, next);
    await queryClient.invalidateQueries({ queryKey: EXTRA_CONFIG_QUERY_KEY });
    router.refresh();
  };

  return {
    query,
    saveBatch: useMutation({
      mutationFn: (entries: ExtraConfigSaveEntry[]) => extraConfigApi.saveBatch(entries),
      onSuccess: handleSuccess,
    }),
    resetKey: useMutation({
      mutationFn: (key: string) => extraConfigApi.resetKey(key),
      onSuccess: handleSuccess,
    }),
    resetAll: useMutation({
      mutationFn: () => extraConfigApi.resetAll(),
      onSuccess: handleSuccess,
    }),
  };
}

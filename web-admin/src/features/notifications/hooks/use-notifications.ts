'use client';

/**
 * Paginated notification list hook for the Notification Center page.
 * Fetches via /api/v1/notifications with tab and pagination state.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/auth-context';
import type { NotificationRow } from '@lib/notifications/types';

export type NotificationTab = 'all' | 'unread' | string; // 'all' | 'unread' | category_code

interface NotificationsResponse {
  data: NotificationRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

async function fetchNotifications(
  tab: NotificationTab,
  page: number,
  limit: number
): Promise<NotificationsResponse> {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });

  if (tab === 'unread') {
    params.set('is_read', 'false');
  } else if (tab !== 'all') {
    params.set('category_code', tab);
  }

  const res = await fetch(`/api/v1/notifications?${params.toString()}`, {
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
}

export function useNotifications(initialTab: NotificationTab = 'all') {
  const { currentTenant, user } = useAuth();
  const tenantId = currentTenant?.tenant_id ?? '';
  const userId   = user?.id ?? '';

  const [tab, setTab]   = useState<NotificationTab>(initialTab);
  const [page, setPage] = useState(1);
  const limit = 20;

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['notifications-list', tenantId, userId, tab, page],
    queryFn:  () => fetchNotifications(tab, page, limit),
    enabled:  !!tenantId && !!userId,
    staleTime:30_000,
    placeholderData: (prev) => prev, // keep previous while loading next page
  });

  const changeTab = (newTab: NotificationTab) => {
    setTab(newTab);
    setPage(1); // reset to first page on tab change
  };

  return {
    notifications:  data?.data ?? [],
    pagination:     data?.pagination,
    isLoading,
    isFetching,
    error,
    tab,
    page,
    setPage,
    changeTab,
    refetch,
  };
}

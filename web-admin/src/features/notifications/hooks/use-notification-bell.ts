'use client';

/**
 * Notification bell hook.
 * Subscribes to Supabase Realtime (org_ntf_inbox_mst postgres_changes) so the
 * badge updates instantly on INSERT without polling.
 * Also exposes markRead / markAllRead actions.
 */

import { useEffect, useCallback, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth/auth-context';
import type { NotificationRow } from '@lib/notifications/types';

const QUERY_KEY = 'notification-unread-count';
const RECENT_LIMIT = 10;

async function fetchUnreadCount(): Promise<number> {
  const res = await fetch('/api/v1/notifications/unread-count', { credentials: 'include' });
  if (!res.ok) return 0;
  const json = await res.json();
  return json.count ?? 0;
}

async function fetchRecentNotifications(): Promise<NotificationRow[]> {
  const res = await fetch(`/api/v1/notifications?limit=${RECENT_LIMIT}&is_read=false`, {
    credentials: 'include',
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data ?? [];
}

/**
 *
 */
export function useNotificationBell() {
  const { currentTenant, user } = useAuth();
  const tenantId = currentTenant?.tenant_id ?? '';
  const userId   = user?.id ?? '';
  const qc       = useQueryClient();

  const [recentNotifications, setRecentNotifications] = useState<NotificationRow[]>([]);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: [QUERY_KEY, tenantId, userId],
    queryFn:  fetchUnreadCount,
    enabled:  !!tenantId && !!userId,
    staleTime:30_000,        // 30 s cache
    refetchInterval: 60_000, // fallback poll every 60 s in case Realtime drops
  });

  // Load recent notifications for the dropdown
  useEffect(() => {
    if (!tenantId || !userId) return;
    fetchRecentNotifications().then(setRecentNotifications);
  }, [tenantId, userId]);

  // Supabase Realtime subscription — badge increments on INSERT
  useEffect(() => {
    if (!tenantId || !userId) return;

    const supabase = createClient();
    const channel  = supabase
      .channel(`ntf-bell-${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'org_ntf_inbox_mst',
          filter: `recipient_user_id=eq.${userId}`,
        },
        (payload) => {
          const newRow = payload.new as NotificationRow;
          setRecentNotifications((prev) => [newRow, ...prev].slice(0, RECENT_LIMIT));
          qc.invalidateQueries({ queryKey: [QUERY_KEY, tenantId, userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, userId, qc]);

  const markRead = useCallback(async (id: string) => {
    await fetch(`/api/v1/notifications/${id}/read`, {
      method: 'PATCH',
      credentials: 'include',
    });
    setRecentNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    qc.invalidateQueries({ queryKey: [QUERY_KEY, tenantId, userId] });
    qc.invalidateQueries({ queryKey: ['notifications-list'] }); // keep center page in sync
  }, [tenantId, userId, qc]);

  const markAllRead = useCallback(async () => {
    await fetch('/api/v1/notifications/read-all', {
      method: 'PATCH',
      credentials: 'include',
    });
    setRecentNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    qc.invalidateQueries({ queryKey: [QUERY_KEY, tenantId, userId] });
    qc.invalidateQueries({ queryKey: ['notifications-list'] }); // keep center page in sync
  }, [tenantId, userId, qc]);

  return { unreadCount, recentNotifications, markRead, markAllRead };
}

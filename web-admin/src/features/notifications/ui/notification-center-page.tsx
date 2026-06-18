'use client'

import { useCallback } from 'react'
import { Bell } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useQueryClient } from '@tanstack/react-query'
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxSkeleton } from '@ui/primitives/cmx-skeleton'
import { CmxEmptyState } from '@ui/data-display/cmx-empty-state'
import { CmxTabsPanel } from '@ui/navigation/cmx-tabs-panel'
import { useAuth } from '@/lib/auth/auth-context'
import { useNotifications } from '../hooks/use-notifications'
import { NotificationItem } from './notification-item'
import type { NotificationTab } from '../hooks/use-notifications'

type TabDef = { id: NotificationTab; labelKey: string }

const TABS: TabDef[] = [
  { id: 'all',     labelKey: 'center.tabs.all' },
  { id: 'unread',  labelKey: 'center.tabs.unread' },
  { id: 'order',   labelKey: 'center.tabs.orders' },
  { id: 'payment', labelKey: 'center.tabs.payments' },
  { id: 'system',  labelKey: 'center.tabs.system' },
]

function NotificationListSkeleton() {
  return (
    <div className="divide-y divide-[rgb(var(--cmx-border-rgb,226_232_240))]">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 px-4 py-3">
          <CmxSkeleton className="h-9 w-9 flex-shrink-0 rounded-full" />
          <div className="flex-1 space-y-2 py-0.5">
            <CmxSkeleton className="h-3.5 w-3/4" />
            <CmxSkeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 *
 */
export function NotificationCenterPage() {
  const locale = useLocale()
  const t = useTranslations('notifications')
  const qc = useQueryClient()
  const { currentTenant, user } = useAuth()
  const tenantId = currentTenant?.tenant_id ?? ''
  const userId = user?.id ?? ''

  const { notifications, pagination, isLoading, isFetching, tab, page, setPage, changeTab } = useNotifications()

  const markRead = useCallback(async (id: string) => {
    await fetch(`/api/v1/notifications/${id}/read`, { method: 'PATCH', credentials: 'include' })
    qc.invalidateQueries({ queryKey: ['notifications-list'] })
    qc.invalidateQueries({ queryKey: ['notification-unread-count', tenantId, userId] })
  }, [qc, tenantId, userId])

  const markAllRead = useCallback(async () => {
    await fetch('/api/v1/notifications/read-all', { method: 'PATCH', credentials: 'include' })
    qc.invalidateQueries({ queryKey: ['notifications-list'] })
    qc.invalidateQueries({ queryKey: ['notification-unread-count', tenantId, userId] })
  }, [qc, tenantId, userId])

  const emptyTitle = tab === 'unread' ? t('center.emptyUnread') : t('center.empty')
  const emptyDesc  = tab === 'unread' ? t('center.emptyUnreadDesc') : t('center.emptyDesc')

  const listContent = (
    <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-white">
      {isLoading ? (
        <NotificationListSkeleton />
      ) : notifications.length === 0 ? (
        <CmxEmptyState
          icon={<Bell className="h-10 w-10 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]" />}
          title={emptyTitle}
          description={emptyDesc}
        />
      ) : (
        <div className="divide-y divide-[rgb(var(--cmx-border-rgb,226_232_240))]">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onMarkRead={markRead}
            />
          ))}
        </div>
      )}
    </div>
  )

  const tabsWithContent = TABS.map((tab) => ({
    id: tab.id,
    label: t(tab.labelKey as Parameters<typeof t>[0]),
    content: listContent,
  }))

  const isRtl = locale === 'ar'

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
          {t('title')}
        </h1>
        <CmxButton
          variant="outline"
          size="sm"
          onClick={markAllRead}
          disabled={isFetching}
        >
          {t('markAllRead')}
        </CmxButton>
      </div>

      {/* Tabs */}
      <CmxTabsPanel
        tabs={tabsWithContent}
        value={tab}
        onChange={(v) => changeTab(v as NotificationTab)}
      />

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 pt-2">
          <CmxButton
            variant="outline"
            size="sm"
            disabled={page <= 1 || isFetching}
            onClick={() => setPage(page - 1)}
          >
            {t('center.prevPage')}
          </CmxButton>
          <span className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {isRtl
              ? `صفحة ${page} من ${pagination.totalPages}`
              : `Page ${page} of ${pagination.totalPages}`}
          </span>
          <CmxButton
            variant="outline"
            size="sm"
            disabled={page >= pagination.totalPages || isFetching}
            onClick={() => setPage(page + 1)}
          >
            {t('center.nextPage')}
          </CmxButton>
        </div>
      )}
    </div>
  )
}

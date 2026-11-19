'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CmxButton } from '@ui/primitives/cmx-button'
import {
  TOPBAR_POPOVER_OPEN_EVENT,
  type TopbarPopoverOpenDetail,
} from '@lib/session-activity'
import { CmxSkeleton } from '@ui/primitives/cmx-skeleton'
import { useInboxMutations } from '../hooks/use-inbox-mutations'
import { useNotificationBell } from '../hooks/use-notification-bell'
import { NotificationItem } from './notification-item'

/**
 *
 */
export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const t = useTranslations('notifications')

  const { unreadCount, recentNotifications, isRecentLoading } = useNotificationBell({
    dropdownOpen: open,
  })
  const { markRead, markAllRead } = useInboxMutations()

  // Close when Session Activity (or another top-bar popover) opens
  useEffect(() => {
    const handleOtherOpen = (event: Event) => {
      const detail = (event as CustomEvent<TopbarPopoverOpenDetail>).detail
      if (detail?.id && detail.id !== 'notifications') {
        setOpen(false)
      }
    }
    window.addEventListener(TOPBAR_POPOVER_OPEN_EVENT, handleOtherOpen)
    return () => window.removeEventListener(TOPBAR_POPOVER_OPEN_EVENT, handleOtherOpen)
  }, [])

  // Close on outside click or Escape key
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const handleMarkAllRead = async () => {
    await markAllRead()
  }

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev
      if (next && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<TopbarPopoverOpenDetail>(TOPBAR_POPOVER_OPEN_EVENT, {
            detail: { id: 'notifications' },
          })
        )
      }
      return next
    })
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        aria-label={t('title')}
        aria-expanded={open}
        className="relative p-2 rounded-md text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute end-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-destructive px-0.5 text-[10px] font-bold text-destructive-foreground ring-2 ring-card">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('title')}
          className="absolute end-0 z-50 mt-2 w-80 rounded-lg border border-border bg-card shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="text-sm font-semibold text-foreground">
              {t('title')}
              {unreadCount > 0 && (
                <span className="ms-2 rounded-full bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary-text">
                  {unreadCount}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <CmxButton
                variant="ghost"
                size="xs"
                onClick={handleMarkAllRead}
                className="text-primary-text hover:underline"
              >
                {t('markAllRead')}
              </CmxButton>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {isRecentLoading && recentNotifications.length === 0 ? (
              <div className="space-y-3 px-4 py-3" aria-busy="true">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex gap-3">
                    <CmxSkeleton className="h-9 w-9 shrink-0 rounded-full" />
                    <div className="flex-1 space-y-2 py-0.5">
                      <CmxSkeleton className="h-3.5 w-3/4" />
                      <CmxSkeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell className="mb-3 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t('noNotifications')}
                </p>
              </div>
            ) : (
              recentNotifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onMarkRead={markRead}
                  compact
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2.5">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-primary-text hover:underline"
            >
              {t('bell.viewAll')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

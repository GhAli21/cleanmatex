'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CmxButton } from '@ui/primitives/cmx-button'
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

  const { unreadCount, recentNotifications, markRead, markAllRead } = useNotificationBell()

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

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t('title')}
        aria-expanded={open}
        className="relative p-2 rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-primary-rgb,14_165_233))]"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute end-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label={t('title')}
          className="absolute end-0 z-50 mt-2 w-80 rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-white shadow-lg"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[rgb(var(--cmx-border-rgb,226_232_240))] px-4 py-3">
            <span className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
              {t('title')}
              {unreadCount > 0 && (
                <span className="ms-2 rounded-full bg-[rgb(var(--cmx-primary-rgb,14_165_233)_/_.1)] px-1.5 py-0.5 text-[11px] font-bold text-[rgb(var(--cmx-primary-rgb,14_165_233))]">
                  {unreadCount}
                </span>
              )}
            </span>
            {unreadCount > 0 && (
              <CmxButton
                variant="ghost"
                size="xs"
                onClick={handleMarkAllRead}
                className="text-[rgb(var(--cmx-primary-rgb,14_165_233))] hover:text-[rgb(var(--cmx-primary-hover-rgb,3_105_161))]"
              >
                {t('markAllRead')}
              </CmxButton>
            )}
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto">
            {recentNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-center">
                <Bell className="mb-3 h-8 w-8 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]" />
                <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
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
          <div className="border-t border-[rgb(var(--cmx-border-rgb,226_232_240))] px-4 py-2.5">
            <Link
              href="/dashboard/notifications"
              onClick={() => setOpen(false)}
              className="block text-center text-xs font-medium text-[rgb(var(--cmx-primary-rgb,14_165_233))] hover:underline"
            >
              {t('bell.viewAll')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

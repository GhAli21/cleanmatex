'use client'

import type { ElementType } from 'react'
import { Bell, ShoppingBag, CreditCard, Settings, Package } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { NotificationRow } from '@lib/notifications/types'

const CATEGORY_ICON: Record<string, ElementType> = {
  order:    ShoppingBag,
  orders:   ShoppingBag,
  payment:  CreditCard,
  payments: CreditCard,
  system:   Settings,
  delivery: Package,
}

function getRelativeTime(isoString: string, locale: string, justNow: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return justNow
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', { numeric: 'auto', style: 'short' })
  if (mins < 60) return rtf.format(-mins, 'minute')
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return rtf.format(-hrs, 'hour')
  return rtf.format(-Math.floor(hrs / 24), 'day')
}

/**
 *
 */
export interface NotificationItemProps {
  notification: NotificationRow
  onMarkRead?: (id: string) => void
  compact?: boolean
  className?: string
}

/**
 *
 * @param root0
 * @param root0.notification
 * @param root0.onMarkRead
 * @param root0.compact
 * @param root0.className
 */
export function NotificationItem({ notification, onMarkRead, compact = false, className }: NotificationItemProps) {
  const locale = useLocale()
  const isAr = locale === 'ar'
  const t = useTranslations('notifications')

  const title = isAr && notification.title2 ? notification.title2 : notification.title
  const body  = isAr && notification.body2  ? notification.body2  : notification.body

  const CategoryIcon = CATEGORY_ICON[notification.category_code ?? ''] ?? Bell

  const handleClick = () => {
    if (!notification.is_read) onMarkRead?.(notification.id)
  }

  return (
    <div
      role={compact ? 'button' : undefined}
      tabIndex={compact ? 0 : undefined}
      onClick={compact ? handleClick : undefined}
      onKeyDown={compact ? (e) => { if (e.key === 'Enter' || e.key === ' ') handleClick() } : undefined}
      className={cn(
        'relative flex gap-3 border-b border-border last:border-0',
        compact
          ? 'px-3 py-2.5 cursor-pointer transition-colors hover:bg-accent'
          : 'px-4 py-3',
        !notification.is_read && 'bg-primary/4',
        className
      )}
    >
      {/* Unread dot */}
      {!notification.is_read && (
        <span className="absolute start-1 top-3.5 h-1.5 w-1.5 rounded-full bg-primary" />
      )}

      {/* Category icon */}
      <div className={cn(
        'flex-shrink-0 rounded-full flex items-center justify-center mt-0.5',
        compact ? 'h-7 w-7' : 'h-9 w-9',
        'bg-primary/10 text-primary-text'
      )}>
        <CategoryIcon className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={cn(
          'line-clamp-2 text-foreground',
          compact ? 'text-xs' : 'text-sm',
          !notification.is_read ? 'font-semibold' : 'font-medium'
        )}>
          {title}
        </p>
        {!compact && body && (
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">
            {body}
          </p>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-[11px] text-muted-foreground">
            {getRelativeTime(notification.created_at, locale, t('item.justNow'))}
          </span>
          {!notification.is_read && onMarkRead && !compact && (
            <button
              type="button"
              onClick={() => onMarkRead(notification.id)}
              className="text-[11px] font-medium text-primary-text hover:underline"
            >
              {t('item.markRead')}
            </button>
          )}
        </div>
        {!compact && notification.action_url && notification.action_label && (
          <a
            href={notification.action_url}
            onClick={(e) => e.stopPropagation()}
            className="mt-1.5 inline-block text-xs font-medium text-primary-text hover:underline"
          >
            {isAr && notification.action_label2 ? notification.action_label2 : notification.action_label}
          </a>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, type ElementType } from 'react'
import { AlertCircle, AlertTriangle, Copy, Info } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { CmxButton } from '@ui/primitives/cmx-button'
import { cn } from '@/lib/utils'
import { cmxMessage } from '@ui/feedback'
import type { SessionActivityEntry } from '@lib/session-activity'

const TYPE_ICON: Record<SessionActivityEntry['type'], ElementType> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
}

const TYPE_ICON_CLASS: Record<SessionActivityEntry['type'], string> = {
  error: 'bg-[rgb(var(--cmx-destructive-rgb,239_68_68)_/_.1)] text-[rgb(var(--cmx-destructive-rgb,239_68_68))]',
  warning: 'bg-[rgb(var(--cmx-warning-rgb,245_158_11)_/_.1)] text-[rgb(var(--cmx-warning-rgb,245_158_11))]',
  info: 'bg-[rgb(var(--cmx-primary-rgb,14_165_233)_/_.1)] text-[rgb(var(--cmx-primary-rgb,14_165_233))]',
}

function getRelativeTime(isoString: string, locale: string, justNow: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return justNow
  const rtf = new Intl.RelativeTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    numeric: 'auto',
    style: 'short',
  })
  if (mins < 60) return rtf.format(-mins, 'minute')
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return rtf.format(-hrs, 'hour')
  return rtf.format(-Math.floor(hrs / 24), 'day')
}

export interface SessionActivityItemProps {
  entry: SessionActivityEntry
  onMarkRead: (id: string) => void
}

/**
 * Compact row for a session activity entry.
 */
export function SessionActivityItem({ entry, onMarkRead }: SessionActivityItemProps) {
  const locale = useLocale()
  const t = useTranslations('sessionActivity')
  const [expanded, setExpanded] = useState(false)
  const Icon = TYPE_ICON[entry.type]

  const typeLabel =
    entry.type === 'error'
      ? t('item.typeError')
      : entry.type === 'warning'
        ? t('item.typeWarning')
        : t('item.typeInfo')

  const handleCopy = async () => {
    const text = entry.description
      ? `${entry.title}\n${entry.description}`
      : entry.title
    try {
      await navigator.clipboard.writeText(text)
      cmxMessage.success(t('copied'), { skipSessionLog: true })
    } catch {
      cmxMessage.error(t('copyFailed'), { skipSessionLog: true })
    }
  }

  const handleActivate = () => {
    setExpanded((v) => !v)
    if (!entry.read) onMarkRead(entry.id)
  }

  return (
    <div
      className={cn(
        'relative flex gap-3 border-b border-[rgb(var(--cmx-border-rgb,226_232_240))] px-3 py-2.5 last:border-0',
        !entry.read && 'bg-[rgb(var(--cmx-primary-rgb,14_165_233)_/_.04)]'
      )}
    >
      {!entry.read && (
        <span className="absolute start-1 top-3.5 h-1.5 w-1.5 rounded-full bg-[rgb(var(--cmx-primary-rgb,14_165_233))]" />
      )}

      <div
        className={cn(
          'mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full',
          TYPE_ICON_CLASS[entry.type]
        )}
        aria-hidden
      >
        <Icon className="h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={handleActivate}
          className="w-full text-start"
        >
          <span className="sr-only">{typeLabel}</span>
          <p
            className={cn(
              'text-xs text-[rgb(var(--cmx-foreground-rgb,15_23_42))]',
              expanded ? '' : 'line-clamp-2',
              !entry.read ? 'font-semibold' : 'font-medium'
            )}
          >
            {entry.title}
          </p>
          {entry.description && (
            <p
              className={cn(
                'mt-0.5 text-[11px] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]',
                expanded ? '' : 'line-clamp-2'
              )}
            >
              {entry.description}
            </p>
          )}
        </button>

        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-[11px] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {getRelativeTime(entry.createdAt, locale, t('item.justNow'))}
          </span>
          {entry.route && (
            <span
              className="max-w-[8rem] truncate text-[11px] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]"
              title={entry.route}
            >
              {entry.route}
            </span>
          )}
          <CmxButton
            type="button"
            variant="ghost"
            size="xs"
            className="min-h-9 min-w-9 px-1.5 text-[rgb(var(--cmx-primary-rgb,14_165_233))]"
            aria-label={t('copyMessage')}
            onClick={() => void handleCopy()}
          >
            <Copy className="h-3.5 w-3.5" />
          </CmxButton>
          {!entry.read && (
            <CmxButton
              type="button"
              variant="ghost"
              size="xs"
              className="text-[11px] text-[rgb(var(--cmx-primary-rgb,14_165_233))]"
              onClick={() => onMarkRead(entry.id)}
            >
              {t('item.markRead')}
            </CmxButton>
          )}
        </div>
      </div>
    </div>
  )
}

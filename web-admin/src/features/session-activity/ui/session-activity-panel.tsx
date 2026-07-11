'use client'

import { useState } from 'react'
import { ScrollText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CmxButton } from '@ui/primitives/cmx-button'
import { cmxMessage } from '@ui/feedback'
import { SESSION_ACTIVITY_CLEAR_CONFIRM_THRESHOLD } from '@lib/session-activity'
import {
  useSessionActivity,
  type SessionActivityFilter,
} from '../hooks/use-session-activity'
import { SessionActivityItem } from './session-activity-item'
import { cn } from '@/lib/utils'

export interface SessionActivityPanelProps {
  onRequestClose?: () => void
}

/**
 * Dropdown panel listing session toast/alert messages for the current browser session.
 */
export function SessionActivityPanel({ onRequestClose: _onRequestClose }: SessionActivityPanelProps) {
  const t = useTranslations('sessionActivity')
  const [filter, setFilter] = useState<SessionActivityFilter>('all')
  const { entries, allEntries, unreadCount, markRead, markAllRead, clear } =
    useSessionActivity(filter)

  const handleClear = async () => {
    if (allEntries.length > SESSION_ACTIVITY_CLEAR_CONFIRM_THRESHOLD) {
      const confirmed = await cmxMessage.confirm({
        title: t('clearLogConfirmTitle'),
        message: t('clearLogConfirmBody'),
        variant: 'destructive',
      })
      if (!confirmed) return
    }
    clear()
  }

  const filters: { id: SessionActivityFilter; label: string }[] = [
    { id: 'all', label: t('filters.all') },
    { id: 'errors', label: t('filters.errors') },
    { id: 'warnings', label: t('filters.warnings') },
  ]

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-[rgb(var(--cmx-border-rgb,226_232_240))] px-4 py-3">
        <span className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
          {t('title')}
          {unreadCount > 0 && (
            <span className="ms-2 rounded-full bg-[rgb(var(--cmx-primary-rgb,14_165_233)_/_.1)] px-1.5 py-0.5 text-[11px] font-bold text-[rgb(var(--cmx-primary-rgb,14_165_233))]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <CmxButton
              variant="ghost"
              size="xs"
              onClick={markAllRead}
              className="text-[rgb(var(--cmx-primary-rgb,14_165_233))]"
            >
              {t('markAllRead')}
            </CmxButton>
          )}
          {allEntries.length > 0 && (
            <CmxButton
              variant="ghost"
              size="xs"
              onClick={() => void handleClear()}
              className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]"
            >
              {t('clearLog')}
            </CmxButton>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b border-[rgb(var(--cmx-border-rgb,226_232_240))] px-3 py-2">
        {filters.map((f) => (
          <CmxButton
            key={f.id}
            type="button"
            variant={filter === f.id ? 'secondary' : 'ghost'}
            size="xs"
            onClick={() => setFilter(f.id)}
            className={cn(
              'min-h-9',
              filter === f.id && 'font-semibold'
            )}
          >
            {f.label}
          </CmxButton>
        ))}
      </div>

      <div className="max-h-[min(20rem,60vh)] overflow-y-auto">
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
            <ScrollText className="mb-3 h-8 w-8 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]" />
            <p className="text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
              {t('empty')}
            </p>
            <p className="mt-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('emptyDesc')}
            </p>
          </div>
        ) : (
          entries.map((entry) => (
            <SessionActivityItem
              key={entry.id}
              entry={entry}
              onMarkRead={markRead}
            />
          ))
        )}
      </div>
    </div>
  )
}

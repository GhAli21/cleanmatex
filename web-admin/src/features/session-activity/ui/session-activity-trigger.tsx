'use client'

import { useEffect, useRef, useState } from 'react'
import { ScrollText } from 'lucide-react'
import { useTranslations } from 'next-intl'
import {
  TOPBAR_POPOVER_OPEN_EVENT,
  type TopbarPopoverOpenDetail,
} from '@lib/session-activity'
import { useSessionActivity } from '../hooks/use-session-activity'
import { SessionActivityPanel } from './session-activity-panel'

/**
 * Top-bar trigger for the Session Activity log (distinct from Notifications bell).
 */
export function SessionActivityTrigger() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const t = useTranslations('sessionActivity')
  const { unreadCount } = useSessionActivity()

  // Close when another top-bar popover opens
  useEffect(() => {
    const handleOtherOpen = (event: Event) => {
      const detail = (event as CustomEvent<TopbarPopoverOpenDetail>).detail
      if (detail?.id && detail.id !== 'session-activity') {
        setOpen(false)
      }
    }
    window.addEventListener(TOPBAR_POPOVER_OPEN_EVENT, handleOtherOpen)
    return () => window.removeEventListener(TOPBAR_POPOVER_OPEN_EVENT, handleOtherOpen)
  }, [])

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    const handleClick = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev
      if (next && typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent<TopbarPopoverOpenDetail>(TOPBAR_POPOVER_OPEN_EVENT, {
            detail: { id: 'session-activity' },
          })
        )
      }
      return next
    })
  }

  const badgeLabel =
    unreadCount > 0
      ? t('badgeLabel', { count: unreadCount > 9 ? 9 : unreadCount })
      : t('title')

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleToggle}
        title={t('title')}
        aria-label={badgeLabel}
        aria-expanded={open}
        className="relative rounded-md p-2 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-primary-rgb,14_165_233))]"
      >
        <ScrollText className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute end-0.5 top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-amber-500 px-0.5 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 9 ? '9+' : unreadCount}
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
          <SessionActivityPanel onRequestClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}

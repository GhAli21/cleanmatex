'use client'

/**
 * Sidebar Context - Collapsible sidebar state for dashboard
 * Persists collapsed state to localStorage across sessions
 * Respects prefers-reduced-motion for accessibility
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react'

const STORAGE_KEY = 'cmx-sidebar-collapsed'

export interface SidebarContextType {
  isCollapsed: boolean
  toggleCollapse: () => void
  /** Width in Tailwind units: 64 = w-64 (256px), 16 = w-16 (64px) */
  sidebarWidth: 64 | 16
  /** True when user prefers reduced motion - use instant transitions */
  prefersReducedMotion: boolean
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsedState] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored !== null) {
        setIsCollapsedState(stored === 'true')
      }
    } catch {
      // Ignore localStorage errors (SSR, private mode)
    }
    setMounted(true)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mq.matches)
    const handler = () => setPrefersReducedMotion(mq.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  const toggleCollapse = useCallback(() => {
    setIsCollapsedState((prev) => {
      const next = !prev
      try {
        localStorage.setItem(STORAGE_KEY, String(next))
      } catch {
        // Ignore
      }
      return next
    })
  }, [])

  const sidebarWidth = isCollapsed ? 16 : 64

  const value: SidebarContextType = useMemo(
    () => ({
      isCollapsed: mounted ? isCollapsed : false,
      toggleCollapse,
      sidebarWidth,
      prefersReducedMotion,
    }),
    [mounted, isCollapsed, toggleCollapse, sidebarWidth, prefersReducedMotion]
  )

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (ctx === undefined) {
    throw new Error('useSidebar must be used within SidebarProvider')
  }
  return ctx
}

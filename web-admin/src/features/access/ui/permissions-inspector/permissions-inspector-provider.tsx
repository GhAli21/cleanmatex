'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { CmxPermissionsInspectorPanel } from './cmx-permissions-inspector-panel'
import { permissionsInspector } from './permissions-inspector-manager'
import type {
  OpenPermissionsInspectorOptions,
  PermissionsInspectorTab,
} from './permissions-inspector-types'

interface PermissionsInspectorContextValue {
  open: (options?: OpenPermissionsInspectorOptions) => void
  close: () => void
  isOpen: boolean
}

const PermissionsInspectorContext = createContext<PermissionsInspectorContextValue | null>(null)

interface InspectorState {
  open: boolean
  tab: PermissionsInspectorTab
  routePath?: string
}

/**
 * Mount once at app root (AppProviders) to enable global permissions inspector.
 */
export function PermissionsInspectorProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InspectorState>({
    open: false,
    tab: 'ui',
    routePath: undefined,
  })
  const isOpenRef = useRef(false)

  useEffect(() => {
    isOpenRef.current = state.open
  }, [state.open])

  const open = useCallback((options?: OpenPermissionsInspectorOptions) => {
    setState({
      open: true,
      tab: options?.tab ?? 'ui',
      routePath: options?.routePath,
    })
  }, [])

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, open: false, routePath: undefined }))
  }, [])

  useEffect(() => {
    permissionsInspector.setController({
      open,
      close,
      isOpen: () => isOpenRef.current,
    })
    return () => {
      permissionsInspector.setController(null)
    }
  }, [open, close])

  const contextValue: PermissionsInspectorContextValue = {
    open,
    close,
    isOpen: state.open,
  }

  return (
    <PermissionsInspectorContext.Provider value={contextValue}>
      {children}
      {typeof window !== 'undefined' &&
        createPortal(
          <CmxPermissionsInspectorPanel
            open={state.open}
            onClose={close}
            initialTab={state.tab}
            routePathOverride={state.routePath}
          />,
          document.body
        )}
    </PermissionsInspectorContext.Provider>
  )
}

/**
 * React hook for opening/closing the permissions inspector.
 */
export function usePermissionsInspector(): PermissionsInspectorContextValue {
  const context = useContext(PermissionsInspectorContext)
  if (!context) {
    throw new Error('usePermissionsInspector must be used within PermissionsInspectorProvider')
  }
  return context
}

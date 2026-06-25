'use client'

import { ShieldCheck } from 'lucide-react'
import { usePermissionsInspector } from './permissions-inspector-provider'
import type { OpenPermissionsInspectorOptions } from './permissions-inspector-types'

export interface CmxPermissionsInspectorTriggerProps {
  className?: string
  title?: string
  options?: OpenPermissionsInspectorOptions
}

/**
 * Shield button that opens the global permissions inspector.
 */
export function CmxPermissionsInspectorTrigger({
  className = 'rounded-md p-2 text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500',
  title = 'Open permissions inspector',
  options,
}: CmxPermissionsInspectorTriggerProps) {
  const { open } = usePermissionsInspector()

  return (
    <button
      type="button"
      onClick={() => open(options)}
      title={title}
      className={className}
      aria-label={title}
    >
      <ShieldCheck className="h-5 w-5" />
    </button>
  )
}

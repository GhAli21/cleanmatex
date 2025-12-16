/**
 * CmxCrudPageShell - CRUD page shell pattern
 * @module ui/patterns
 */

import { ReactNode } from 'react'

interface CmxCrudPageShellProps {
  listView: ReactNode
  detailView?: ReactNode
  mode: 'list' | 'detail'
}

export function CmxCrudPageShell({ listView, detailView, mode }: CmxCrudPageShellProps) {
  if (mode === 'detail' && detailView) {
    return <>{detailView}</>
  }
  return <>{listView}</>
}

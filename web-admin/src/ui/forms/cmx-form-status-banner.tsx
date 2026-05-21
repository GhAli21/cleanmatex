/* eslint-disable jsdoc/require-jsdoc */
/**
 * CmxFormStatusBanner - Shared form-level feedback banner for save, warning,
 * and validation states. This keeps pilot forms from rebuilding slightly
 * different status treatments on every screen.
 * @module ui/forms
 */

'use client'

import type { ReactNode } from 'react'
import { CmxSummaryMessage } from '@ui/feedback'

export interface CmxFormStatusBannerProps {
  type: 'success' | 'warning' | 'info' | 'error'
  title: string
  items: string[]
  onDismiss?: () => void
  actions?: ReactNode
  className?: string
}

/**
 * Banner wraps the existing summary-message component so form screens get
 * one consistent message treatment without duplicating list and dismiss logic.
 *
 * @param root0 Banner props.
 * @param root0.type Visual status variant.
 * @param root0.title Banner title text.
 * @param root0.items Detail lines rendered under the title.
 * @param root0.onDismiss Optional dismiss callback.
 * @param root0.actions Optional trailing action content.
 * @param root0.className Optional wrapper className.
 * @returns Shared form-level status banner.
 */
export function CmxFormStatusBanner({
  type,
  title,
  items,
  onDismiss,
  actions,
  className,
}: CmxFormStatusBannerProps) {
  return (
    <div className={className}>
      <CmxSummaryMessage type={type} title={title} items={items} onDismiss={onDismiss} />
      {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

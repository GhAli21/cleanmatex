/**
 * CmxConfirmDialog - Confirmation dialog
 * @module ui/feedback
 */

'use client'

import { useState, type ReactNode } from 'react'
import { CmxButton } from '../primitives/cmx-button'

/**
 *
 */
export interface CmxConfirmDialogProps {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => Promise<void> | void
  /** Uncontrolled trigger mode — wraps a clickable element that opens the dialog */
  trigger?: React.ReactNode
  /** Controlled mode — when provided, dialog visibility is managed by the parent */
  open?: boolean
  /** Called when the user clicks Cancel in controlled mode */
  onCancel?: () => void
  /** Optional body content such as an override-reason field. */
  children?: ReactNode
  /** Disables confirm while required input is incomplete. */
  confirmDisabled?: boolean
}

/**
 *
 * @param root0
 * @param root0.title
 * @param root0.description
 * @param root0.confirmLabel
 * @param root0.cancelLabel
 * @param root0.onConfirm
 * @param root0.trigger
 * @param root0.open
 * @param root0.onCancel
 */
export function CmxConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  trigger,
  open: openProp,
  onCancel,
  children,
  confirmDisabled = false,
}: CmxConfirmDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen
  const handleClose = () => isControlled ? onCancel?.() : setInternalOpen(false)

  const handleConfirm = async () => {
    if (confirmDisabled) return
    try {
      setLoading(true)
      await onConfirm()
    } finally {
      setLoading(false)
      handleClose()
    }
  }

  return (
    <>
      {!isControlled && trigger && (
        <span onClick={() => setInternalOpen(true)}>{trigger}</span>
      )}
      {open && (
        <div
          className="fixed inset-0 z-[var(--cmx-z-modal,1050)] flex items-center justify-center bg-black/40"
          role="presentation"
        >
          <div
            className="w-full max-w-md rounded-xl bg-[rgb(var(--cmx-card-bg-rgb,255_255_255))] p-4 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cmx-confirm-title"
          >
            <h2 id="cmx-confirm-title" className="text-sm font-semibold">{title}</h2>
            {description && (
              <p className="mt-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
                {description}
              </p>
            )}
            {children ? <div className="mt-3 space-y-2">{children}</div> : null}
            <div className="mt-4 flex justify-end gap-2">
              <CmxButton variant="ghost" onClick={handleClose}>
                {cancelLabel}
              </CmxButton>
              <CmxButton loading={loading} disabled={confirmDisabled} onClick={handleConfirm}>
                {confirmLabel}
              </CmxButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

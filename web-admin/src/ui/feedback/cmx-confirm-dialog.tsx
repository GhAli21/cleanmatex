/**
 * CmxConfirmDialog - Confirmation dialog
 * @module ui/feedback
 */

'use client'

import { useState } from 'react'
import { CmxButton } from '../primitives/cmx-button'

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
}

export function CmxConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  trigger,
  open: openProp,
  onCancel,
}: CmxConfirmDialogProps) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen
  const handleClose = () => isControlled ? onCancel?.() : setInternalOpen(false)

  const handleConfirm = async () => {
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
        <div className="fixed inset-0 z-[var(--cmx-z-modal,1050)] flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-xl bg-[rgb(var(--cmx-card-bg-rgb,255_255_255))] p-4 shadow-xl">
            <h2 className="text-sm font-semibold">{title}</h2>
            {description && (
              <p className="mt-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
                {description}
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <CmxButton variant="ghost" onClick={handleClose}>
                {cancelLabel}
              </CmxButton>
              <CmxButton loading={loading} onClick={handleConfirm}>
                {confirmLabel}
              </CmxButton>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

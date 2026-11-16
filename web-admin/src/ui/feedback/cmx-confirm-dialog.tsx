/**
 * CmxConfirmDialog - Confirmation dialog
 * @module ui/feedback
 */

'use client'

import { useState, type ReactNode } from 'react'
import { CmxButton } from '../primitives/cmx-button'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '../overlays/cmx-dialog'

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
      {/* CmxDialog supplies the portal, focus trap, Escape handling and accessible name.
          Escape and the header close button cancel, exactly like the Cancel button,
          and like it are ignored while the confirm is running. */}
      <CmxDialog
        open={open}
        onOpenChange={(next) => {
          if (!next && !loading) handleClose()
        }}
        stackAboveModals
      >
        <CmxDialogContent className="w-full max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>{title}</CmxDialogTitle>
            {description && <CmxDialogDescription>{description}</CmxDialogDescription>}
          </CmxDialogHeader>
          {children ? <div className="space-y-2">{children}</div> : null}
          <CmxDialogFooter>
            <CmxButton variant="ghost" onClick={handleClose} disabled={loading}>
              {cancelLabel}
            </CmxButton>
            <CmxButton loading={loading} disabled={confirmDisabled} onClick={handleConfirm}>
              {confirmLabel}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </>
  )
}

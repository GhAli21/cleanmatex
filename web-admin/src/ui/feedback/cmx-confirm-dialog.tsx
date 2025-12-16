/**
 * CmxConfirmDialog - Confirmation dialog
 * @module ui/feedback
 */

'use client'

import { useState } from 'react'
import { CmxButton } from '../primitives/cmx-button'

interface CmxConfirmDialogProps {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => Promise<void> | void
  trigger: React.ReactNode
}

export function CmxConfirmDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  trigger,
}: CmxConfirmDialogProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    try {
      setLoading(true)
      await onConfirm()
    } finally {
      setLoading(false)
      setOpen(false)
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)}>{trigger}</span>
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
              <CmxButton variant="ghost" onClick={() => setOpen(false)}>
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

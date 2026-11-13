'use client'

import { CmxButton } from '@ui/primitives'
import { CmxDialog, CmxDialogContent, CmxDialogDescription, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import type { LaundryChoice } from '@/types/auth'

/** Props for the organization picker shown after a multi-organization password success. */
export interface TenantPickerDialogProps {
  open: boolean
  laundries: LaundryChoice[]
  lastChosenTenantId: string | null
  isSubmitting: boolean
  title: string
  hint: string
  lastLabel: string
  cancelLabel: string
  onChoose: (orgUserId: string) => void
  onCancel: () => void
}

/**
 * Lists only the caller's own organization names. Escape cancels the sign-in.
 *
 * @param props - Open state, names, and the choose or cancel actions
 */
export function TenantPickerDialog({
  open,
  laundries,
  lastChosenTenantId,
  isSubmitting,
  title,
  hint,
  lastLabel,
  cancelLabel,
  onChoose,
  onCancel,
}: TenantPickerDialogProps) {
  return (
    <CmxDialog open={open} onOpenChange={(next) => { if (!next) onCancel() }}>
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle>{title}</CmxDialogTitle>
          <CmxDialogDescription>{hint}</CmxDialogDescription>
        </CmxDialogHeader>
        <ul className="flex flex-col gap-2" role="list">
          {laundries.map((tenant) => {
            const highlighted = tenant.tenantOrgId === lastChosenTenantId
            return (
              <li key={tenant.orgUserId}>
                <CmxButton
                  type="button"
                  variant={highlighted ? 'primary' : 'outline'}
                  className="h-auto w-full justify-start px-4 py-3 text-start"
                  disabled={isSubmitting}
                  aria-current={highlighted ? 'true' : undefined}
                  onClick={() => onChoose(tenant.orgUserId)}
                >
                  <span className="flex flex-col items-start gap-1">
                    <span>{tenant.name}</span>
                    {tenant.name2 ? <span className="text-sm opacity-80">{tenant.name2}</span> : null}
                    {highlighted ? <span className="text-xs">{lastLabel}</span> : null}
                  </span>
                </CmxButton>
              </li>
            )
          })}
        </ul>
        <CmxButton type="button" variant="ghost" disabled={isSubmitting} onClick={onCancel}>
          {cancelLabel}
        </CmxButton>
      </CmxDialogContent>
    </CmxDialog>
  )
}

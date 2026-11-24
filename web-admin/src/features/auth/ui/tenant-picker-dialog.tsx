'use client'

import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxDialog, CmxDialogContent, CmxDialogDescription, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays/cmx-dialog'
import type { TenantChoice } from '@/types/auth'

/** Props for the organization picker shown after a multi-organization password success. */
export interface TenantPickerDialogProps {
  open: boolean
  tenants: TenantChoice[]
  lastChosenTenantId: string | null
  isSubmitting: boolean
  /** The orgUserId currently being submitted, so its row shows a loading spinner. */
  choosingOrgUserId?: string | null
  title: string
  hint: string
  lastLabel: string
  cancelLabel: string
  onChoose: (orgUserId: string) => void
  onCancel: () => void
}

/**
 * Lists only the caller's own organization names. Escape cancels the sign-in when idle.
 *
 * @param props - Open state, names, and the choose or cancel actions
 */
export function TenantPickerDialog({
  open,
  tenants,
  lastChosenTenantId,
  isSubmitting,
  choosingOrgUserId = null,
  title,
  hint,
  lastLabel,
  cancelLabel,
  onChoose,
  onCancel,
}: TenantPickerDialogProps) {
  return (
    <CmxDialog open={open} onOpenChange={(next) => { if (!next && !isSubmitting) onCancel() }}>
      <CmxDialogContent className="max-w-md" aria-busy={isSubmitting}>
        <CmxDialogHeader>
          <CmxDialogTitle>{title}</CmxDialogTitle>
          <CmxDialogDescription>{hint}</CmxDialogDescription>
        </CmxDialogHeader>
        <ul className="flex flex-col gap-2" role="list">
          {tenants.map((tenant) => {
            const highlighted = tenant.tenantOrgId === lastChosenTenantId
            const isChoosingThis = isSubmitting && choosingOrgUserId === tenant.orgUserId
            return (
              <li key={tenant.orgUserId}>
                <CmxButton
                  type="button"
                  variant={highlighted ? 'primary' : 'outline'}
                  className="h-auto w-full justify-start px-4 py-3 text-start"
                  disabled={isSubmitting}
                  loading={isChoosingThis}
                  aria-current={highlighted ? 'true' : undefined}
                  onClick={() => {
                    if (!isSubmitting) onChoose(tenant.orgUserId)
                  }}
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

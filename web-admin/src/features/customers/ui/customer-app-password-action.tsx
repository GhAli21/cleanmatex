'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { CUSTOMERS_PERMISSIONS } from '@lib/constants/permissions/customers-perm'
import { useHasPermissionCode } from '@lib/hooks/usePermissions'
import { cmxMessage, CmxConfirmDialog, CmxSummaryMessage } from '@ui/feedback'
import { CmxButton, CmxInput, Label } from '@ui/primitives'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays'

import {
  issueCustomerAppTemporaryPassword,
  type CustomerAppTemporaryPassword,
} from '../api/customer-app-credentials-api'

interface CustomerAppPasswordActionProps {
  tenantId: string
  customerId: string
}

/**
 * Tenant-staff action that reveals a generated Customer App temporary password
 * once. The value stays in component memory only and is discarded on close.
 * @param props - Current Organization and customer relationship identifiers
 * @returns Permission-gated credential reset controls
 */
export function CustomerAppPasswordAction({
  tenantId,
  customerId,
}: CustomerAppPasswordActionProps) {
  const t = useTranslations('customers.customerAppCredential')
  const tCommon = useTranslations('common')
  const canManageCredentials = useHasPermissionCode(CUSTOMERS_PERMISSIONS.MANAGE_CREDENTIALS)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [issued, setIssued] = useState<CustomerAppTemporaryPassword | null>(null)

  if (!canManageCredentials) return null

  const issuePassword = async () => {
    try {
      const result = await issueCustomerAppTemporaryPassword(tenantId, customerId)
      setIssued(result)
      cmxMessage.success(t('issued'))
    } catch {
      cmxMessage.error(t('issueFailed'))
    }
  }

  return (
    <>
      <CmxButton
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setConfirmOpen(true)}
      >
        {t('issueAction')}
      </CmxButton>
      <CmxConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        title={t('confirmTitle')}
        description={t('confirmDescription')}
        confirmLabel={t('issueAction')}
        cancelLabel={tCommon('cancel')}
        onConfirm={issuePassword}
      />
      <CmxDialog
        open={issued !== null}
        onOpenChange={(open) => {
          if (!open) setIssued(null)
        }}
      >
        <CmxDialogContent className="w-full max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('issuedTitle')}</CmxDialogTitle>
            <CmxDialogDescription>{t('issuedDescription')}</CmxDialogDescription>
          </CmxDialogHeader>
          <CmxSummaryMessage type="warning" title={t('oneTimeWarning')} items={[]} />
          <div className="space-y-2">
            <Label htmlFor="customer-app-temporary-password">{t('temporaryPassword')}</Label>
            <CmxInput
              id="customer-app-temporary-password"
              readOnly
              value={issued?.temporaryPassword ?? ''}
              className="text-center font-mono text-lg tracking-[0.35em]"
              aria-describedby="customer-app-password-help"
            />
            <p id="customer-app-password-help" className="text-sm text-muted-foreground">
              {t('expiresIn24Hours')}
            </p>
          </div>
          <CmxDialogFooter>
            <CmxButton type="button" onClick={() => setIssued(null)}>
              {tCommon('close')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </>
  )
}

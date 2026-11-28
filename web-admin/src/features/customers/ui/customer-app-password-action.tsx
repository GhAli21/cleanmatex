'use client'

import { useCallback, useEffect, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Copy, Eye, EyeOff, KeyRound, RefreshCw } from 'lucide-react'

import { CUSTOMERS_PERMISSIONS } from '@lib/constants/permissions/customers-perm'
import { useHasAnyPermission } from '@lib/hooks/usePermissions'
import {
  cmxMessage,
  CmxConfirmDialog,
  CmxStatusBadge,
  CmxSummaryMessage,
} from '@ui/feedback'
import { CmxButton, CmxCheckbox, CmxInput, Label } from '@ui/primitives'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays'

import {
  fetchCustomerAppCredentialStatus,
  issueCustomerAppTemporaryPassword,
  setCustomerAppPassword,
  type CustomerAppCredentialStatus,
  type CustomerAppTemporaryPassword,
} from '../api/customer-app-credentials-api'

interface CustomerAppPasswordActionProps {
  tenantId: string
  customerId: string
}

interface CustomerAppPasswordDialogsProps {
  tenantId: string
  customerId: string
  hasExistingPassword: boolean
  setDialogOpen: boolean
  onSetDialogOpenChange: (open: boolean) => void
  confirmTempOpen: boolean
  onConfirmTempOpenChange: (open: boolean) => void
  onStatusUpdated?: (status: CustomerAppCredentialStatus) => void
  onTempIssued?: () => void
}

function CustomerAppPasswordDialogs({
  tenantId,
  customerId,
  hasExistingPassword,
  setDialogOpen,
  onSetDialogOpenChange,
  confirmTempOpen,
  onConfirmTempOpenChange,
  onStatusUpdated,
  onTempIssued,
}: CustomerAppPasswordDialogsProps) {
  const t = useTranslations('customers.customerAppCredential')
  const tCommon = useTranslations('common')

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [requireChange, setRequireChange] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [issued, setIssued] = useState<CustomerAppTemporaryPassword | null>(null)

  const resetForm = () => {
    setNewPassword('')
    setConfirmPassword('')
    setShowPassword(false)
    setRequireChange(false)
    setValidationError(null)
  }

  const handleCloseSetDialog = (open: boolean) => {
    if (!open) {
      resetForm()
    }
    onSetDialogOpenChange(open)
  }

  const handleSavePassword = async () => {
    if (newPassword.length < 8) {
      setValidationError(t('passwordTooShort'))
      return
    }
    if (newPassword !== confirmPassword) {
      setValidationError(t('passwordsDoNotMatch'))
      return
    }

    setValidationError(null)
    setSaving(true)
    try {
      const updated = await setCustomerAppPassword(
        tenantId,
        customerId,
        newPassword,
        requireChange,
      )
      onStatusUpdated?.(updated)
      cmxMessage.success(t('saved'))
      handleCloseSetDialog(false)
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleIssueTemporary = async () => {
    try {
      const result = await issueCustomerAppTemporaryPassword(tenantId, customerId)
      setIssued(result)
      onTempIssued?.()
      cmxMessage.success(t('issued'))
    } catch (err) {
      cmxMessage.error(err instanceof Error ? err.message : t('issueFailed'))
    }
  }

  const handleCopyTemp = async () => {
    if (!issued?.temporaryPassword) return
    try {
      await navigator.clipboard.writeText(issued.temporaryPassword)
      cmxMessage.success(t('copied'))
    } catch {
      // Clipboard API may be unavailable in restricted contexts.
    }
  }

  return (
    <>
      <CmxDialog open={setDialogOpen} onOpenChange={handleCloseSetDialog}>
        <CmxDialogContent className="w-full max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>
              {hasExistingPassword ? t('resetDialogTitle') : t('setDialogTitle')}
            </CmxDialogTitle>
            <CmxDialogDescription>{t('setDialogDescription')}</CmxDialogDescription>
          </CmxDialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="customer-app-new-password">{t('newPasswordLabel')}</Label>
              <div className="flex items-center gap-2">
                <CmxInput
                  id="customer-app-new-password"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    if (validationError) setValidationError(null)
                  }}
                  placeholder={t('newPasswordPlaceholder')}
                  autoComplete="new-password"
                  disabled={saving}
                />
                <CmxButton
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </CmxButton>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="customer-app-confirm-password">{t('confirmPasswordLabel')}</Label>
              <CmxInput
                id="customer-app-confirm-password"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  if (validationError) setValidationError(null)
                }}
                placeholder={t('confirmPasswordPlaceholder')}
                autoComplete="new-password"
                disabled={saving}
              />
            </div>

            <CmxCheckbox
              id="customer-app-require-change"
              checked={requireChange}
              onChange={(e) => setRequireChange(e.target.checked)}
              label={t('requireChangeLabel')}
              description={t('requireChangeHint')}
              disabled={saving}
            />

            {validationError && (
              <p className="text-sm text-danger-text" role="alert">
                {validationError}
              </p>
            )}
          </div>

          <CmxDialogFooter>
            <CmxButton
              type="button"
              variant="outline"
              onClick={() => handleCloseSetDialog(false)}
              disabled={saving}
            >
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton
              type="button"
              onClick={handleSavePassword}
              disabled={saving}
            >
              {saving ? t('savingAction') : t('saveAction')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxConfirmDialog
        open={confirmTempOpen}
        onCancel={() => onConfirmTempOpenChange(false)}
        title={t('confirmTitle')}
        description={t('confirmDescription')}
        confirmLabel={t('issueAction')}
        cancelLabel={tCommon('cancel')}
        onConfirm={handleIssueTemporary}
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
            <div className="flex items-center gap-2">
              <CmxInput
                id="customer-app-temporary-password"
                readOnly
                value={issued?.temporaryPassword ?? ''}
                className="text-center font-mono text-lg tracking-[0.35em]"
                aria-describedby="customer-app-password-help"
              />
              <CmxButton
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyTemp}
                aria-label={t('copyAction')}
              >
                <Copy className="h-4 w-4" />
              </CmxButton>
            </div>
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

/**
 * Compact header button for adding or resetting a customer's Customer App password.
 * @param props - Current Organization and customer relationship identifiers
 * @returns Permission-gated credential action button
 */
export function CustomerAppPasswordAction({
  tenantId,
  customerId,
}: CustomerAppPasswordActionProps) {
  const t = useTranslations('customers.customerAppCredential')
  const canManageCredentials = useHasAnyPermission([
    CUSTOMERS_PERMISSIONS.MANAGE_CREDENTIALS,
    'customers:update',
  ])
  const [setDialogOpen, setSetDialogOpen] = useState(false)
  const [confirmTempOpen, setConfirmTempOpen] = useState(false)

  if (!canManageCredentials) return null

  return (
    <>
      <CmxButton
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setSetDialogOpen(true)}
      >
        <KeyRound className="me-1.5 h-3.5 w-3.5" />
        {t('resetAction')}
      </CmxButton>
      <CustomerAppPasswordDialogs
        tenantId={tenantId}
        customerId={customerId}
        hasExistingPassword={true}
        setDialogOpen={setDialogOpen}
        onSetDialogOpenChange={setSetDialogOpen}
        confirmTempOpen={confirmTempOpen}
        onConfirmTempOpenChange={setConfirmTempOpen}
      />
    </>
  )
}

/**
 * Profile -> Account Information card showing safe Customer App password state
 * and staff controls to add/reset a password or generate a one-time temporary password.
 * @param props - Current Organization and customer relationship identifiers
 * @returns Customer App credential management card
 */
export function CustomerAppPasswordCard({
  tenantId,
  customerId,
}: CustomerAppPasswordActionProps) {
  const t = useTranslations('customers.customerAppCredential')
  const locale = useLocale()
  const canManageCredentials = useHasAnyPermission([
    CUSTOMERS_PERMISSIONS.MANAGE_CREDENTIALS,
    'customers:update',
  ])
  const [status, setStatus] = useState<CustomerAppCredentialStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [setDialogOpen, setSetDialogOpen] = useState(false)
  const [confirmTempOpen, setConfirmTempOpen] = useState(false)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const data = await fetchCustomerAppCredentialStatus(tenantId, customerId)
      setStatus(data)
    } catch {
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [tenantId, customerId])

  useEffect(() => {
    void loadStatus()
  }, [loadStatus])

  const badge = (() => {
    if (status?.isLocked) {
      return { label: t('statusLocked'), tone: 'danger' as const }
    }
    if (status?.hasPassword && status?.mustChangePassword) {
      return { label: t('statusTemporary'), tone: 'warning' as const }
    }
    if (status?.hasPassword) {
      return { label: t('statusSet'), tone: 'success' as const }
    }
    return { label: t('statusNotSet'), tone: 'neutral' as const }
  })()

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-foreground">{t('cardTitle')}</h4>
        </div>
        {!loading && <CmxStatusBadge label={badge.label} tone={badge.tone} size="sm" />}
      </div>

      <p className="text-xs text-muted-foreground">{t('cardDescription')}</p>

      {status?.passwordChangedAt && (
        <p className="text-xs text-muted-foreground tabular-nums">
          {t('lastUpdated')}:{' '}
          {new Date(status.passwordChangedAt).toLocaleDateString(
            locale === 'ar' ? 'ar' : 'en-US',
          )}
        </p>
      )}

      {!loading && status && !status.hasContactIdentity && (
        <p className="text-xs text-warning-text">{t('missingContactHint')}</p>
      )}

      {canManageCredentials && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <CmxButton
            type="button"
            variant="primary"
            size="sm"
            disabled={loading || (status !== null && !status.hasContactIdentity)}
            onClick={() => setSetDialogOpen(true)}
          >
            <KeyRound className="me-1.5 h-3.5 w-3.5" />
            {status?.hasPassword ? t('resetAction') : t('addAction')}
          </CmxButton>
          <CmxButton
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || (status !== null && !status.hasContactIdentity)}
            onClick={() => setConfirmTempOpen(true)}
          >
            <RefreshCw className="me-1.5 h-3.5 w-3.5" />
            {t('issueAction')}
          </CmxButton>
        </div>
      )}

      <CustomerAppPasswordDialogs
        tenantId={tenantId}
        customerId={customerId}
        hasExistingPassword={Boolean(status?.hasPassword)}
        setDialogOpen={setDialogOpen}
        onSetDialogOpenChange={setSetDialogOpen}
        confirmTempOpen={confirmTempOpen}
        onConfirmTempOpenChange={setConfirmTempOpen}
        onStatusUpdated={(updated) => setStatus(updated)}
        onTempIssued={() => {
          void loadStatus()
        }}
      />
    </div>
  )
}

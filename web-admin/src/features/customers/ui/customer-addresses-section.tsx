'use client'

/**
 * Customer Addresses Section
 *
 * Displays and manages delivery addresses for a customer (Addresses tab content).
 * Supports add, edit, delete, and set default with RTL, i18n, loading and error states.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CmxButton } from '@ui/primitives'
import { CmxConfirmDialog } from '@ui/feedback'
import { updateAddress, deleteAddress } from '@/lib/api/customers'
import type { CustomerAddress } from '@/lib/types/customer'
import AddressFormModal from './address-form-modal'

interface CustomerAddressesSectionProps {
  customerId: string
  addresses: CustomerAddress[]
  onAddressesChange?: () => void | Promise<void>
}

/**
 *
 * @param root0
 * @param root0.customerId
 * @param root0.addresses
 * @param root0.onAddressesChange
 */
export function CustomerAddressesSection({
  customerId,
  addresses,
  onAddressesChange,
}: CustomerAddressesSectionProps) {
  const t = useTranslations('customers')
  const tCommon = useTranslations('common')

  const [showModal, setShowModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteAddress, setConfirmDeleteAddress] = useState<CustomerAddress | null>(null)
  const [settingDefaultId, setSettingDefaultId] = useState<string | null>(null)

  const handleOpenAdd = () => {
    setEditingAddress(null)
    setActionError(null)
    setShowModal(true)
  }

  const handleOpenEdit = (address: CustomerAddress) => {
    setEditingAddress(address)
    setActionError(null)
    setShowModal(true)
  }

  const handleCloseModal = () => {
    setShowModal(false)
    setEditingAddress(null)
  }

  const handleModalSuccess = async (_address: CustomerAddress) => {
    setShowModal(false)
    setEditingAddress(null)
    setActionError(null)
    await onAddressesChange?.()
  }

  const handleDeleteConfirm = async () => {
    if (!confirmDeleteAddress) return
    const address = confirmDeleteAddress
    setConfirmDeleteAddress(null)

    setActionError(null)
    setDeletingId(address.id)
    try {
      await deleteAddress(customerId, address.id)
      await onAddressesChange?.()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('failedToSaveAddress'))
    } finally {
      setDeletingId(null)
    }
  }

  const handleSetDefault = async (address: CustomerAddress) => {
    if (address.isDefault) return
    setActionError(null)
    setSettingDefaultId(address.id)
    try {
      await updateAddress(customerId, address.id, { isDefault: true })
      await onAddressesChange?.()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : t('failedToSaveAddress'))
    } finally {
      setSettingDefaultId(null)
    }
  }

  return (
    <div className="text-start">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">
          {t('deliveryAddresses')}
        </h3>
        <CmxButton type="button" variant="primary" size="sm" onClick={handleOpenAdd}>
          {t('addAddress')}
        </CmxButton>
      </div>

      {actionError && (
        <div className="mb-4 p-3 rounded-md bg-danger-bg border border-danger-border text-sm text-danger-text text-start border-s-4 border-e-0">
          {actionError}
        </div>
      )}

      {addresses.length === 0 ? (
        <div className="text-center py-12 bg-muted rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-muted-foreground mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="text-muted-foreground mb-4">{t('noAddresses')}</p>
          <CmxButton type="button" variant="primary" size="sm" onClick={handleOpenAdd}>
            {t('addFirstAddress')}
          </CmxButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div
              key={address.id}
              className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-foreground">
                  {address.label ?? t('addressLabel')}
                </h4>
                {address.isDefault && (
                  <span className="px-2 py-1 bg-info-bg text-info-text text-xs rounded-full">
                    {t('defaultAddress')}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                {[address.street, address.area].filter(Boolean).join(', ')}
                <br />
                {address.city ?? ''}
              </p>
              {address.deliveryNotes && (
                <p className="text-xs text-muted-foreground mb-2">
                  {address.deliveryNotes}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                {!address.isDefault && (
                  <CmxButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSetDefault(address)}
                    disabled={settingDefaultId !== null}
                    className="px-0 h-auto"
                  >
                    {settingDefaultId === address.id
                      ? tCommon('loading')
                      : t('setAsDefault')}
                  </CmxButton>
                )}
                {!address.isDefault && (
                  <span className="text-muted-foreground">|</span>
                )}
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleOpenEdit(address)}
                  className="px-0 h-auto"
                >
                  {tCommon('edit')}
                </CmxButton>
                <span className="text-muted-foreground">|</span>
                <CmxButton
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDeleteAddress(address)}
                  disabled={deletingId !== null}
                  className="px-1 h-auto text-danger-text hover:text-danger-text/80"
                >
                  {deletingId === address.id
                    ? tCommon('deleting')
                    : tCommon('delete')}
                </CmxButton>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddressFormModal
          customerId={customerId}
          address={editingAddress ?? undefined}
          open={showModal}
          onClose={handleCloseModal}
          onSuccess={handleModalSuccess}
        />
      )}

      <CmxConfirmDialog
        open={Boolean(confirmDeleteAddress)}
        title={tCommon('delete')}
        description={t('deleteAddressConfirm')}
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setConfirmDeleteAddress(null)}
      />
    </div>
  )
}

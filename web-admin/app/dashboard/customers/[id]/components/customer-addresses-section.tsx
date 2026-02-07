'use client'

/**
 * Customer Addresses Section
 *
 * Displays and manages delivery addresses for a customer (Addresses tab content).
 * Supports add, edit, delete, and set default with RTL, i18n, loading and error states.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { updateAddress, deleteAddress } from '@/lib/api/customers'
import type { CustomerAddress } from '@/lib/types/customer'
import AddressFormModal from '../../components/address-form-modal'

interface CustomerAddressesSectionProps {
  customerId: string
  addresses: CustomerAddress[]
  onAddressesChange?: () => void | Promise<void>
}

export function CustomerAddressesSection({
  customerId,
  addresses,
  onAddressesChange,
}: CustomerAddressesSectionProps) {
  const t = useTranslations('customers')
  const tCommon = useTranslations('common')
  const isRTL = useRTL()

  const [showModal, setShowModal] = useState(false)
  const [editingAddress, setEditingAddress] = useState<CustomerAddress | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
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

  const handleModalSuccess = async (address: CustomerAddress) => {
    setShowModal(false)
    setEditingAddress(null)
    setActionError(null)
    await onAddressesChange?.()
  }

  const handleDelete = async (address: CustomerAddress) => {
    const message = t('deleteAddressConfirm')
    if (typeof window !== 'undefined' && !window.confirm(message)) return

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
    <div className={isRTL ? 'text-right' : 'text-left'}>
      <div
        className={`flex items-center justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}
      >
        <h3 className="text-lg font-semibold text-gray-900">
          {t('deliveryAddresses')}
        </h3>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          {t('addAddress')}
        </button>
      </div>

      {actionError && (
        <div
          className={`mb-4 p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-800 ${isRTL ? 'text-right border-r-4 border-l-0' : 'text-left border-l-4 border-r-0'}`}
        >
          {actionError}
        </div>
      )}

      {addresses.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 mb-4"
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
          <p className="text-gray-500 mb-4">{t('noAddresses')}</p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {t('addFirstAddress')}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div
              key={address.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div
                className={`flex items-start justify-between mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <h4 className="font-medium text-gray-900">
                  {address.label ?? t('addressLabel')}
                </h4>
                {address.isDefault && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    {t('defaultAddress')}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {[address.street, address.area].filter(Boolean).join(', ')}
                <br />
                {address.city ?? ''}
              </p>
              {address.deliveryNotes && (
                <p className="text-xs text-gray-500 mb-2">
                  {address.deliveryNotes}
                </p>
              )}
              <div
                className={`flex items-center gap-2 flex-wrap ${isRTL ? 'flex-row-reverse justify-end' : ''}`}
              >
                {!address.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(address)}
                    disabled={settingDefaultId !== null}
                    className="text-sm text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    {settingDefaultId === address.id
                      ? tCommon('loading')
                      : t('setAsDefault')}
                  </button>
                )}
                {!address.isDefault && (
                  <span className="text-gray-300">|</span>
                )}
                <button
                  type="button"
                  onClick={() => handleOpenEdit(address)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {tCommon('edit')}
                </button>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={() => handleDelete(address)}
                  disabled={deletingId !== null}
                  className="text-sm text-red-600 hover:text-red-700 disabled:opacity-50"
                >
                  {deletingId === address.id
                    ? tCommon('deleting')
                    : tCommon('delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <AddressFormModal
          customerId={customerId}
          address={editingAddress ?? undefined}
          onClose={handleCloseModal}
          onSuccess={handleModalSuccess}
        />
      )}
    </div>
  )
}

'use client'

/**
 * PRD-003: Address Form Modal Component
 *
 * Modal for adding or editing customer addresses
 * Features:
 * - Add new address
 * - Edit existing address
 * - GPS coordinate input (optional)
 * - Default address toggle
 * - Form validation
 */

'use client'

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { createAddress, updateAddress } from '@/lib/api/customers'
import type {
  CustomerAddress,
  CreateAddressRequest,
  UpdateAddressRequest,
} from '@/lib/types/customer'

interface AddressFormModalProps {
  customerId: string
  address?: CustomerAddress // If provided, edit mode
  onClose: () => void
  onSuccess: (address: CustomerAddress) => void
}

export default function AddressFormModal({
  customerId,
  address,
  onClose,
  onSuccess,
}: AddressFormModalProps) {
  const t = useTranslations('customers')
  const tCommon = useTranslations('common')
  const isRTL = useRTL()
  const isEditMode = !!address

  // Form state
  const [formData, setFormData] = useState({
    label: address?.label || '',
    street_address: address?.street || '',
    building_name: address?.building || '',
    area: address?.area || '',
    city: address?.city || '',
    postal_code: address?.postalCode || '',
    gps_latitude: address?.latitude?.toString() || '',
    gps_longitude: address?.longitude?.toString() || '',
    delivery_instructions: address?.deliveryNotes || '',
    is_default: address?.isDefault || false,
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)

  // Validate form
  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.label.trim()) {
      newErrors.label = t('addressLabelRequired')
    }

    if (!formData.street_address.trim()) {
      newErrors.street_address = t('streetAddressRequired')
    }

    if (!formData.area.trim()) {
      newErrors.area = t('areaRequired')
    }

    if (!formData.city.trim()) {
      newErrors.city = t('cityRequired')
    }

    // Validate GPS coordinates if provided
    if (formData.gps_latitude || formData.gps_longitude) {
      const lat = parseFloat(formData.gps_latitude)
      const lng = parseFloat(formData.gps_longitude)

      if (isNaN(lat) || lat < -90 || lat > 90) {
        newErrors.gps_latitude = t('invalidLatitude')
      }

      if (isNaN(lng) || lng < -180 || lng > 180) {
        newErrors.gps_longitude = t('invalidLongitude')
      }

      // Both must be provided or neither
      if ((formData.gps_latitude && !formData.gps_longitude) ||
          (!formData.gps_latitude && formData.gps_longitude)) {
        newErrors.gps_latitude = t('bothCoordinatesRequired')
        newErrors.gps_longitude = t('bothCoordinatesRequired')
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle input change
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target
    const checked = (e.target as HTMLInputElement).checked

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev }
        delete newErrors[name]
        return newErrors
      })
    }
  }

  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) return

    setLoading(true)
    try {
      const addressData = {
        label: formData.label,
        street: formData.street_address,
        building: formData.building_name || undefined,
        area: formData.area,
        city: formData.city,
        postalCode: formData.postal_code || undefined,
        latitude: formData.gps_latitude
          ? parseFloat(formData.gps_latitude)
          : undefined,
        longitude: formData.gps_longitude
          ? parseFloat(formData.gps_longitude)
          : undefined,
        deliveryNotes: formData.delivery_instructions || undefined,
        isDefault: formData.is_default,
      }

      let result: CustomerAddress

      if (isEditMode && address) {
        result = await updateAddress(
          customerId,
          address.id,
          addressData as UpdateAddressRequest
        )
      } else {
        result = await createAddress(
          customerId,
          addressData as CreateAddressRequest
        )
      }

      onSuccess(result)
    } catch (error) {
      console.error('Error saving address:', error)
      setErrors({
        submit: error instanceof Error ? error.message : t('failedToSaveAddress'),
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className={`inline-block align-bottom bg-white rounded-lg ${isRTL ? 'text-right' : 'text-left'} overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full`}>
          {/* Header */}
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className={`flex items-center ${isRTL ? 'flex-row-reverse justify-between' : 'justify-between'}`}>
              <h3 className="text-lg font-semibold text-gray-900">
                {isEditMode ? t('editAddress') : t('addNewAddress')}
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="px-6 py-4 max-h-[70vh] overflow-y-auto">
              <div className="space-y-4">
                {/* Label */}
                <div>
                  <label
                    htmlFor="label"
                    className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {t('addressLabel')} *
                  </label>
                  <input
                    type="text"
                    id="label"
                    name="label"
                    value={formData.label}
                    onChange={handleChange}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    placeholder={t('addressLabel')}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'} ${
                      errors.label ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.label && (
                    <p className={`mt-1 text-sm text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>{errors.label}</p>
                  )}
                </div>

                {/* Building Name */}
                <div>
                  <label
                    htmlFor="building_name"
                    className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {t('buildingName')}
                  </label>
                  <input
                    type="text"
                    id="building_name"
                    name="building_name"
                    value={formData.building_name}
                    onChange={handleChange}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    placeholder={t('buildingName')}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                  />
                </div>

                {/* Street Address */}
                <div>
                  <label
                    htmlFor="street_address"
                    className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {t('streetAddress')} *
                  </label>
                  <input
                    type="text"
                    id="street_address"
                    name="street_address"
                    value={formData.street_address}
                    onChange={handleChange}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    placeholder={t('streetAddress')}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'} ${
                      errors.street_address ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors.street_address && (
                    <p className={`mt-1 text-sm text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>{errors.street_address}</p>
                  )}
                </div>

                {/* Area & City */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="area"
                      className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {tCommon('area')} *
                    </label>
                    <input
                      type="text"
                      id="area"
                      name="area"
                      value={formData.area}
                      onChange={handleChange}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      placeholder={tCommon('area')}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'} ${
                        errors.area ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.area && (
                      <p className={`mt-1 text-sm text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>{errors.area}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="city"
                      className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      {tCommon('city')} *
                    </label>
                    <input
                      type="text"
                      id="city"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      dir={isRTL ? 'rtl' : 'ltr'}
                      placeholder={tCommon('city')}
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'} ${
                        errors.city ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                    {errors.city && (
                      <p className={`mt-1 text-sm text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>{errors.city}</p>
                    )}
                  </div>
                </div>

                {/* Postal Code */}
                <div>
                  <label
                    htmlFor="postal_code"
                    className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {t('postalCode')}
                  </label>
                  <input
                    type="text"
                    id="postal_code"
                    name="postal_code"
                    value={formData.postal_code}
                    onChange={handleChange}
                    dir="ltr"
                    placeholder="100"
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                  />
                </div>

                {/* GPS Coordinates */}
                <div className="border-t border-gray-200 pt-4">
                  <h4 className={`text-sm font-medium text-gray-700 mb-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    {t('gpsCoordinates')}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="gps_latitude"
                        className={`block text-sm font-medium text-gray-600 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        {t('latitude')}
                      </label>
                      <input
                        type="text"
                        id="gps_latitude"
                        name="gps_latitude"
                        value={formData.gps_latitude}
                        onChange={handleChange}
                        dir="ltr"
                        placeholder="23.588660"
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.gps_latitude ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.gps_latitude && (
                        <p className={`mt-1 text-sm text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {errors.gps_latitude}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="gps_longitude"
                        className={`block text-sm font-medium text-gray-600 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                      >
                        {t('longitude')}
                      </label>
                      <input
                        type="text"
                        id="gps_longitude"
                        name="gps_longitude"
                        value={formData.gps_longitude}
                        onChange={handleChange}
                        dir="ltr"
                        placeholder="58.382897"
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          errors.gps_longitude ? 'border-red-500' : 'border-gray-300'
                        }`}
                      />
                      {errors.gps_longitude && (
                        <p className={`mt-1 text-sm text-red-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                          {errors.gps_longitude}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Delivery Instructions */}
                <div>
                  <label
                    htmlFor="delivery_instructions"
                    className={`block text-sm font-medium text-gray-700 mb-1 ${isRTL ? 'text-right' : 'text-left'}`}
                  >
                    {t('deliveryInstructions')}
                  </label>
                  <textarea
                    id="delivery_instructions"
                    name="delivery_instructions"
                    value={formData.delivery_instructions}
                    onChange={handleChange}
                    rows={3}
                    dir={isRTL ? 'rtl' : 'ltr'}
                    placeholder={t('deliveryInstructions')}
                    className={`w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${isRTL ? 'text-right' : 'text-left'}`}
                  />
                </div>

                {/* Default Address Toggle */}
                <div className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input
                    type="checkbox"
                    id="is_default"
                    name="is_default"
                    checked={formData.is_default}
                    onChange={handleChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="is_default"
                    className={`${isRTL ? 'mr-2' : 'ml-2'} block text-sm text-gray-700`}
                  >
                    {t('setAsDefault')}
                  </label>
                </div>

                {/* Submit Error */}
                {errors.submit && (
                  <div className={`bg-red-50 border ${isRTL ? 'border-r-4 border-l-0' : 'border-l-4 border-r-0'} border-red-200 rounded-md p-3`}>
                    <p className={`text-sm text-red-800 ${isRTL ? 'text-right' : 'text-left'}`}>{errors.submit}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className={`bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center ${isRTL ? 'flex-row-reverse justify-start space-x-reverse space-x-3' : 'justify-end space-x-3'}`}>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                {loading ? (
                  <span className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <svg
                      className={`animate-spin h-4 w-4 text-white ${isRTL ? 'ml-2 -mr-1' : '-ml-1 mr-2'}`}
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {t('saving')}
                  </span>
                ) : (
                  <span>{isEditMode ? t('updateAddress') : t('addAddress')}</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

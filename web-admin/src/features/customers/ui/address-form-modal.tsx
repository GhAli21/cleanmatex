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

import { useState } from 'react'
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

/**
 *
 * @param root0
 * @param root0.customerId
 * @param root0.address
 * @param root0.onClose
 * @param root0.onSuccess
 */
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
      const baseData = {
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
          baseData as UpdateAddressRequest
        )
      } else {
        result = await createAddress(customerId, {
          ...baseData,
          addressType: 'home',
        } as CreateAddressRequest)
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
    <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true" aria-labelledby="address-modal-title">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop - semi-transparent so page content is visible behind */}
        <div
          className="fixed inset-0 z-0 transition-opacity bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />

        {/* Modal content - above backdrop */}
        <div className="relative z-10 inline-block align-bottom bg-card rounded-lg text-start overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl sm:w-full">
          {/* Header */}
          <div className="bg-muted px-6 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <h3 id="address-modal-title" className="text-lg font-semibold text-foreground">
                {isEditMode ? t('editAddress') : t('addNewAddress')}
              </h3>
              <button
                onClick={onClose}
                className="text-muted-foreground hover:text-foreground"
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
                    className="block text-sm font-medium text-foreground mb-1 text-start"
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
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-start ${
                      errors.label ? 'border-destructive' : 'border-border'
                    }`}
                  />
                  {errors.label && (
                    <p className="mt-1 text-sm text-danger-text text-start">{errors.label}</p>
                  )}
                </div>

                {/* Building Name */}
                <div>
                  <label
                    htmlFor="building_name"
                    className="block text-sm font-medium text-foreground mb-1 text-start"
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
                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-start"
                  />
                </div>

                {/* Street Address */}
                <div>
                  <label
                    htmlFor="street_address"
                    className="block text-sm font-medium text-foreground mb-1 text-start"
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
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-start ${
                      errors.street_address ? 'border-destructive' : 'border-border'
                    }`}
                  />
                  {errors.street_address && (
                    <p className="mt-1 text-sm text-danger-text text-start">{errors.street_address}</p>
                  )}
                </div>

                {/* Area & City */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="area"
                      className="block text-sm font-medium text-foreground mb-1 text-start"
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
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-start ${
                        errors.area ? 'border-destructive' : 'border-border'
                      }`}
                    />
                    {errors.area && (
                      <p className="mt-1 text-sm text-danger-text text-start">{errors.area}</p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="city"
                      className="block text-sm font-medium text-foreground mb-1 text-start"
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
                      className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-start ${
                        errors.city ? 'border-destructive' : 'border-border'
                      }`}
                    />
                    {errors.city && (
                      <p className="mt-1 text-sm text-danger-text text-start">{errors.city}</p>
                    )}
                  </div>
                </div>

                {/* Postal Code */}
                <div>
                  <label
                    htmlFor="postal_code"
                    className="block text-sm font-medium text-foreground mb-1 text-start"
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
                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-start"
                  />
                </div>

                {/* GPS Coordinates */}
                <div className="border-t border-border pt-4">
                  <h4 className="text-sm font-medium text-foreground mb-3 text-start">
                    {t('gpsCoordinates')}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="gps_latitude"
                        className="block text-sm font-medium text-muted-foreground mb-1 text-start"
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
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${
                          errors.gps_latitude ? 'border-destructive' : 'border-border'
                        }`}
                      />
                      {errors.gps_latitude && (
                        <p className="mt-1 text-sm text-danger-text text-start">
                          {errors.gps_latitude}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="gps_longitude"
                        className="block text-sm font-medium text-muted-foreground mb-1 text-start"
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
                        className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-ring ${
                          errors.gps_longitude ? 'border-destructive' : 'border-border'
                        }`}
                      />
                      {errors.gps_longitude && (
                        <p className="mt-1 text-sm text-danger-text text-start">
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
                    className="block text-sm font-medium text-foreground mb-1 text-start"
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
                    className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring text-start"
                  />
                </div>

                {/* Default Address Toggle */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="is_default"
                    name="is_default"
                    checked={formData.is_default}
                    onChange={handleChange}
                    className="h-4 w-4 text-primary-text focus:ring-ring border-border rounded"
                  />
                  <label
                    htmlFor="is_default"
                    className="ms-2 block text-sm text-foreground"
                  >
                    {t('setAsDefault')}
                  </label>
                </div>

                {/* Submit Error */}
                {errors.submit && (
                  <div className="bg-danger-bg border border-s-4 border-e-0 border-danger-border rounded-md p-3">
                    <p className="text-sm text-danger-text text-start">{errors.submit}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-muted px-6 py-4 border-t border-border flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-md text-sm font-medium text-foreground hover:bg-muted focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring"
              >
                {tCommon('cancel')}
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-ring disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin h-4 w-4 text-on-solid -ms-1 me-2"
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

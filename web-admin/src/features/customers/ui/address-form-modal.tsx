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
import { CmxButton, CmxCheckbox, CmxInput, CmxTextarea, Label } from '@ui/primitives'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays'
import type {
  CustomerAddress,
  CreateAddressRequest,
  UpdateAddressRequest,
} from '@/lib/types/customer'

interface AddressFormModalProps {
  customerId: string
  address?: CustomerAddress // If provided, edit mode
  open?: boolean
  onClose: () => void
  onSuccess: (address: CustomerAddress) => void
}

/**
 *
 * @param root0
 * @param root0.customerId
 * @param root0.address
 * @param root0.open
 * @param root0.onClose
 * @param root0.onSuccess
 */
export default function AddressFormModal({
  customerId,
  address,
  open = true,
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
    <CmxDialog open={open} onOpenChange={(next) => { if (!next) onClose() }} stackAboveModals>
      <CmxDialogContent className="max-w-2xl w-full p-0" scrollBody>
        <CmxDialogHeader>
          <CmxDialogTitle id="address-modal-title">
            {isEditMode ? t('editAddress') : t('addNewAddress')}
          </CmxDialogTitle>
        </CmxDialogHeader>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Label */}
            <div>
              <Label htmlFor="label" className="mb-1 block text-start">
                {t('addressLabel')} *
              </Label>
              <CmxInput
                type="text"
                id="label"
                name="label"
                value={formData.label}
                onChange={handleChange}
                dir={isRTL ? 'rtl' : 'ltr'}
                placeholder={t('addressLabel')}
                error={errors.label}
              />
            </div>

            {/* Building Name */}
            <div>
              <Label htmlFor="building_name" className="mb-1 block text-start">
                {t('buildingName')}
              </Label>
              <CmxInput
                type="text"
                id="building_name"
                name="building_name"
                value={formData.building_name}
                onChange={handleChange}
                dir={isRTL ? 'rtl' : 'ltr'}
                placeholder={t('buildingName')}
              />
            </div>

            {/* Street Address */}
            <div>
              <Label htmlFor="street_address" className="mb-1 block text-start">
                {t('streetAddress')} *
              </Label>
              <CmxInput
                type="text"
                id="street_address"
                name="street_address"
                value={formData.street_address}
                onChange={handleChange}
                dir={isRTL ? 'rtl' : 'ltr'}
                placeholder={t('streetAddress')}
                error={errors.street_address}
              />
            </div>

            {/* Area & City */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="area" className="mb-1 block text-start">
                  {tCommon('area')} *
                </Label>
                <CmxInput
                  type="text"
                  id="area"
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  placeholder={tCommon('area')}
                  error={errors.area}
                />
              </div>

              <div>
                <Label htmlFor="city" className="mb-1 block text-start">
                  {tCommon('city')} *
                </Label>
                <CmxInput
                  type="text"
                  id="city"
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  dir={isRTL ? 'rtl' : 'ltr'}
                  placeholder={tCommon('city')}
                  error={errors.city}
                />
              </div>
            </div>

            {/* Postal Code */}
            <div>
              <Label htmlFor="postal_code" className="mb-1 block text-start">
                {t('postalCode')}
              </Label>
              <CmxInput
                type="text"
                id="postal_code"
                name="postal_code"
                value={formData.postal_code}
                onChange={handleChange}
                dir="ltr"
                placeholder="100"
              />
            </div>

            {/* GPS Coordinates */}
            <div className="border-t border-border pt-4">
              <h4 className="text-sm font-medium text-foreground mb-3 text-start">
                {t('gpsCoordinates')}
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gps_latitude" className="mb-1 block text-muted-foreground text-start">
                    {t('latitude')}
                  </Label>
                  <CmxInput
                    type="text"
                    id="gps_latitude"
                    name="gps_latitude"
                    value={formData.gps_latitude}
                    onChange={handleChange}
                    dir="ltr"
                    placeholder="23.588660"
                    className="tabular-nums"
                    error={errors.gps_latitude}
                  />
                </div>

                <div>
                  <Label htmlFor="gps_longitude" className="mb-1 block text-muted-foreground text-start">
                    {t('longitude')}
                  </Label>
                  <CmxInput
                    type="text"
                    id="gps_longitude"
                    name="gps_longitude"
                    value={formData.gps_longitude}
                    onChange={handleChange}
                    dir="ltr"
                    placeholder="58.382897"
                    className="tabular-nums"
                    error={errors.gps_longitude}
                  />
                </div>
              </div>
            </div>

            {/* Delivery Instructions */}
            <div>
              <Label htmlFor="delivery_instructions" className="mb-1 block text-start">
                {t('deliveryInstructions')}
              </Label>
              <CmxTextarea
                id="delivery_instructions"
                name="delivery_instructions"
                value={formData.delivery_instructions}
                onChange={handleChange}
                rows={3}
                dir={isRTL ? 'rtl' : 'ltr'}
                placeholder={t('deliveryInstructions')}
              />
            </div>

            {/* Default Address Toggle */}
            <CmxCheckbox
              id="is_default"
              name="is_default"
              checked={formData.is_default}
              onChange={handleChange}
              label={t('setAsDefault')}
            />

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-danger-bg border border-s-4 border-e-0 border-danger-border rounded-md p-3">
                <p className="text-sm text-danger-text text-start">{errors.submit}</p>
              </div>
            )}
          </div>

          <CmxDialogFooter className="bg-muted px-6 py-4 border-t border-border">
            <CmxButton type="button" variant="outline" onClick={onClose}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton type="submit" variant="primary" loading={loading} disabled={loading}>
              {loading ? t('saving') : isEditMode ? t('updateAddress') : t('addAddress')}
            </CmxButton>
          </CmxDialogFooter>
        </form>
      </CmxDialogContent>
    </CmxDialog>
  )
}

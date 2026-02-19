/**
 * PRD-003: Address Card Component
 *
 * Displays a customer address with edit and delete actions
 * Features:
 * - Address formatting
 * - Default address badge
 * - GPS coordinates display (optional)
 * - Edit and delete actions
 */

import type { CustomerAddress } from '@/lib/types/customer'

interface AddressCardProps {
  address: CustomerAddress
  onEdit?: (address: CustomerAddress) => void
  onDelete?: (addressId: string) => void
  onSetDefault?: (addressId: string) => void
}

export default function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
}: AddressCardProps) {
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-1">
            <h4 className="font-semibold text-gray-900">{address.label}</h4>
            {address.isDefault && (
              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                Default
              </span>
            )}
          </div>
          {address.building && (
            <p className="text-xs text-gray-500">{address.building}</p>
          )}
        </div>

        {/* Location Icon */}
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-gray-400"
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
        </div>
      </div>

      {/* Address Details */}
      <div className="text-sm text-gray-600 mb-4 space-y-1">
        {address.street && <p>{address.street}</p>}
        {address.area && <p>{address.area}</p>}
        {address.city && <p>{address.city}</p>}
        {address.postalCode && <p>{address.postalCode}</p>}

        {/* Additional Details */}
        {address.deliveryNotes && (
          <div className="mt-2 pt-2 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              <span className="font-medium">Instructions:</span>{' '}
              {address.deliveryNotes}
            </p>
          </div>
        )}
      </div>

      {/* GPS Coordinates (if available) */}
      {address.latitude && address.longitude && (
        <div className="mb-4 p-2 bg-gray-50 rounded text-xs text-gray-600">
          <div className="flex items-center space-x-2">
            <svg
              className="h-4 w-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <span>
              {address.latitude.toFixed(6)}, {address.longitude.toFixed(6)}
            </span>
            <a
              href={`https://www.google.com/maps?q=${address.latitude},${address.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 ml-auto"
            >
              View Map →
            </a>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center space-x-3 pt-3 border-t border-gray-100">
        {!address.isDefault && onSetDefault && (
          <button
            onClick={() => onSetDefault(address.id)}
            className="text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors"
          >
            Set as Default
          </button>
        )}

        {onEdit && (
          <>
            {!address.isDefault && onSetDefault && (
              <span className="text-gray-300">|</span>
            )}
            <button
              onClick={() => onEdit(address)}
              className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
            >
              Edit
            </button>
          </>
        )}

        {onDelete && (
          <>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => onDelete(address.id)}
              className="text-sm text-red-600 hover:text-red-700 font-medium transition-colors"
              disabled={address.isDefault}
              title={
                address.isDefault
                  ? 'Cannot delete default address. Set another address as default first.'
                  : 'Delete address'
              }
            >
              Delete
            </button>
          </>
        )}
      </div>
    </div>
  )
}

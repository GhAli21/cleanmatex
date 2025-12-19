'use client'

/**
 * PRD-003: Customer Detail Page
 *
 * Detailed view of a single customer with tabbed interface
 * Features:
 * - Profile tab with inline editing
 * - Addresses tab with CRUD operations
 * - Orders tab with order history
 * - Loyalty tab with points and rewards
 */

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { getCustomerById } from '@/lib/api/customers'
import type { CustomerWithTenantData } from '@/lib/types/customer'

// Tab definitions
type TabId = 'profile' | 'addresses' | 'orders' | 'loyalty'

interface Tab {
  id: TabId
  label: string
  icon: string
}

const tabs: Tab[] = [
  { id: 'profile', label: 'Profile', icon: '👤' },
  { id: 'addresses', label: 'Addresses', icon: '📍' },
  { id: 'orders', label: 'Orders', icon: '📦' },
  { id: 'loyalty', label: 'Loyalty', icon: '⭐' },
]

export default function CustomerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const customerId = params.id as string

  // State
  const [customer, setCustomer] = useState<CustomerWithTenantData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [error, setError] = useState<string | null>(null)

  // Fetch customer data
  useEffect(() => {
    async function loadCustomer() {
      setLoading(true)
      setError(null)
      try {
        const data = await getCustomerById(customerId)
        setCustomer(data)
      } catch (err) {
        console.error('Error loading customer:', err)
        setError(err instanceof Error ? err.message : 'Failed to load customer')
      } finally {
        setLoading(false)
      }
    }

    if (customerId) {
      loadCustomer()
    }
  }, [customerId])

  // Get customer type badge
  const getTypeBadge = (type: string) => {
    const badges = {
      guest: { color: 'bg-gray-100 text-gray-800', label: 'Guest' },
      stub: { color: 'bg-blue-100 text-blue-800', label: 'Stub' },
      full: { color: 'bg-green-100 text-green-800', label: 'Full Profile' },
    }
    return badges[type as keyof typeof badges] || badges.guest
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="h-32 bg-gray-200 rounded mb-4"></div>
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !customer) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <svg
              className="mx-auto h-12 w-12 text-red-500 mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-red-900 mb-2">
              Customer Not Found
            </h2>
            <p className="text-red-700 mb-6">{error || 'Customer does not exist'}</p>
            <Link
              href="/dashboard/customers"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Back to Customers
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const typeBadge = getTypeBadge(customer.type)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center text-sm text-gray-500">
          <Link
            href="/dashboard/customers"
            className="hover:text-gray-700 transition-colors"
          >
            Customers
          </Link>
          <svg
            className="mx-2 h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
          <span className="text-gray-900 font-medium">
            {customer.firstName} {customer.lastName}
          </span>
        </nav>

        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-4">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className="h-20 w-20 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                  {customer.firstName?.charAt(0).toUpperCase() || 'C'}
                  {customer.lastName?.charAt(0).toUpperCase() || ''}
                </div>
              </div>

              {/* Customer Info */}
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {customer.firstName} {customer.lastName}
                  </h1>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${typeBadge.color}`}
                  >
                    {typeBadge.label}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {customer.customerNumber && (
                    <div>
                      <span className="text-gray-500">Customer #:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {customer.customerNumber}
                      </span>
                    </div>
                  )}
                  {customer.phone && (
                    <div>
                      <span className="text-gray-500">Phone:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {customer.phone}
                      </span>
                      {customer.phoneVerified && (
                        <span className="ml-1 text-green-600" title="Verified">
                          ✓
                        </span>
                      )}
                    </div>
                  )}
                  {customer.email && (
                    <div>
                      <span className="text-gray-500">Email:</span>
                      <span className="ml-2 font-medium text-gray-900">
                        {customer.email}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center space-x-2">
              {customer.type === 'stub' && (
                <button
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 text-sm font-medium"
                  onClick={() => {
                    /* TODO: Implement upgrade modal */
                  }}
                >
                  Upgrade to Full
                </button>
              )}
              <button
                className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm font-medium text-gray-700"
                onClick={() => {
                  /* TODO: Implement edit modal */
                }}
              >
                Edit
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm">
          {/* Tab Navigation */}
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    px-6 py-4 text-sm font-medium border-b-2 transition-colors
                    ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }
                  `}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'profile' && (
              <ProfileTab customer={customer} onUpdate={setCustomer} />
            )}
            {activeTab === 'addresses' && (
              <AddressesTab
                customerId={customer.id}
                addresses={[]}
              />
            )}
            {activeTab === 'orders' && <OrdersTab customerId={customer.id} />}
            {activeTab === 'loyalty' && (
              <LoyaltyTab
                customerId={customer.id}
                loyaltyPoints={customer.tenantData?.loyaltyPoints || 0}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================================================================
// TAB COMPONENTS
// ==================================================================

/**
 * Profile Tab - Customer information with inline editing
 */
function ProfileTab({
  customer,
  onUpdate,
}: {
  customer: CustomerWithTenantData
  onUpdate: (customer: CustomerWithTenantData) => void
}) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Personal Information
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">First Name</dt>
              <dd className="mt-1 text-sm text-gray-900">{customer.firstName}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Last Name</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {customer.lastName || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {customer.phone || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {customer.email || '—'}
              </dd>
            </div>
          </dl>
        </div>

        {/* Preferences (Full Profile Only) */}
        {customer.type === 'full' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Preferences
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-gray-500">Language</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  English
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Folding</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {customer.preferences?.folding || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Fragrance</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {customer.preferences?.fragrance || '—'}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-gray-500">Starch Level</dt>
                <dd className="mt-1 text-sm text-gray-900">
                  —
                </dd>
              </div>
            </dl>
          </div>
        )}

        {/* Account Information */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Account Information
          </h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-gray-500">Customer Type</dt>
              <dd className="mt-1 text-sm text-gray-900 capitalize">
                {customer.type}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {customer.profileStatus === 3 ? 'Active' : `Status ${customer.profileStatus}`}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Phone Verified</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {customer.phoneVerified ? 'Yes ✓' : 'No'}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500">Member Since</dt>
              <dd className="mt-1 text-sm text-gray-900">
                {new Date(customer.createdAt).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  )
}

/**
 * Addresses Tab - Address management
 */
function AddressesTab({
  customerId,
  addresses,
}: {
  customerId: string
  addresses: any[]
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-gray-900">Delivery Addresses</h3>
        <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">
          Add Address
        </button>
      </div>

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
          <p className="text-gray-500 mb-4">No addresses added yet</p>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium">
            Add First Address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((address) => (
            <div
              key={address.id}
              className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <h4 className="font-medium text-gray-900">{address.label}</h4>
                {address.is_default && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    Default
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {address.street_address}, {address.area}
                <br />
                {address.city}
              </p>
              <div className="flex items-center space-x-2">
                <button className="text-sm text-blue-600 hover:text-blue-700">
                  Edit
                </button>
                <span className="text-gray-300">|</span>
                <button className="text-sm text-red-600 hover:text-red-700">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Orders Tab - Order history
 */
function OrdersTab({ customerId }: { customerId: string }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">Order History</h3>

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
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p className="text-gray-500 mb-2">No orders yet</p>
        <p className="text-sm text-gray-400">
          Order history will appear here once the customer places orders
        </p>
      </div>
    </div>
  )
}

/**
 * Loyalty Tab - Loyalty points and rewards
 */
function LoyaltyTab({
  customerId,
  loyaltyPoints,
}: {
  customerId: string
  loyaltyPoints: number
}) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        Loyalty Points & Rewards
      </h3>

      <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg p-6 text-white mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-purple-100 text-sm mb-1">Current Balance</p>
            <p className="text-4xl font-bold">{loyaltyPoints}</p>
            <p className="text-purple-100 text-sm mt-1">points</p>
          </div>
          <div className="text-6xl">⭐</div>
        </div>
      </div>

      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <p className="text-gray-500 mb-2">No transactions yet</p>
        <p className="text-sm text-gray-400">
          Points history will appear here once the customer earns or redeems points
        </p>
      </div>
    </div>
  )
}

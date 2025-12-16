'use client'

/**
 * Tenant Switcher Component
 *
 * Dropdown in header for multi-tenant users to switch between organizations
 * Shows current tenant, role, and list of accessible tenants
 */

import { Fragment, useState } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import type { UserTenant } from '@/types/auth'

export function TenantSwitcher() {
  const { currentTenant, availableTenants, switchTenant, isLoading } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isSwitching, setIsSwitching] = useState(false)

  // Don't show if user has no tenants or only one tenant
  if (!availableTenants || availableTenants.length <= 1) {
    return null
  }

  const handleTenantSwitch = async (tenantId: string) => {
    if (currentTenant?.tenant_id === tenantId) {
      setIsOpen(false)
      return
    }

    setIsSwitching(true)
    try {
      await switchTenant(tenantId)
      setIsOpen(false)
    } catch (error) {
      console.error('Failed to switch tenant:', error)
      // Error handling is done in the auth context
    } finally {
      setIsSwitching(false)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-800'
      case 'operator':
        return 'bg-blue-100 text-blue-800'
      case 'viewer':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return 'Admin'
      case 'operator':
        return 'Operator'
      case 'viewer':
        return 'Viewer'
      default:
        return role
    }
  }

  return (
    <div className="relative">
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isSwitching}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {/* Building Icon */}
        <svg
          className="w-5 h-5 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>

        <div className="flex flex-col items-start">
          <span className="text-xs text-gray-500">Organization</span>
          <span className="font-semibold text-gray-900">
            {currentTenant?.tenant_name || 'Select Organization'}
          </span>
        </div>

        {/* Dropdown Arrow */}
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${
            isOpen ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown Panel */}
          <div className="absolute right-0 z-20 w-80 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">
                Switch Organization
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                You have access to {availableTenants.length} organizations
              </p>
            </div>

            {/* Tenant List */}
            <div className="py-2 max-h-96 overflow-y-auto">
              {availableTenants.map((tenant) => {
                const isActive = currentTenant?.tenant_id === tenant.tenant_id

                return (
                  <button
                    key={tenant.tenant_id}
                    onClick={() => handleTenantSwitch(tenant.tenant_id)}
                    disabled={isSwitching || isActive}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      isActive
                        ? 'bg-blue-50 cursor-default'
                        : 'hover:bg-gray-50 cursor-pointer'
                    } ${isSwitching ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        {/* Tenant Name */}
                        <div className="flex items-center gap-2">
                          <p
                            className={`text-sm font-medium truncate ${
                              isActive ? 'text-blue-900' : 'text-gray-900'
                            }`}
                          >
                            {tenant.tenant_name}
                          </p>
                          {isActive && (
                            <svg
                              className="w-4 h-4 text-blue-600 flex-shrink-0"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>

                        {/* Tenant Slug */}
                        <p className="text-xs text-gray-500 truncate mt-0.5">
                          {tenant.tenant_slug}
                        </p>

                        {/* Role Badge */}
                        <div className="flex items-center gap-2 mt-2">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getRoleBadgeColor(
                              tenant.user_role
                            )}`}
                          >
                            {getRoleLabel(tenant.user_role)}
                          </span>

                          {/* Last Login */}
                          {tenant.last_login_at && (
                            <span className="text-xs text-gray-400">
                              Last login:{' '}
                              {new Date(tenant.last_login_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Switch Icon */}
                      {!isActive && (
                        <svg
                          className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Footer Note */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 rounded-b-lg">
              <p className="text-xs text-gray-600">
                <svg
                  className="w-3 h-3 inline mr-1"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                    clipRule="evenodd"
                  />
                </svg>
                Switching organizations will reload the page
              </p>
            </div>
          </div>
        </>
      )}

      {/* Loading Overlay */}
      {isSwitching && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-75 rounded-md">
          <svg
            className="animate-spin h-5 w-5 text-blue-600"
            xmlns="http://www.w3.org/2000/svg"
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
        </div>
      )}
    </div>
  )
}

/**
 * Compact version for mobile/narrow screens
 */
export function TenantSwitcherCompact() {
  const { currentTenant, availableTenants } = useAuth()

  if (!availableTenants || availableTenants.length <= 1) {
    return null
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-50 border-b border-gray-200">
      <svg
        className="w-4 h-4 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
      <span className="text-gray-600 truncate">
        {currentTenant?.tenant_name}
      </span>
      <span
        className={`ml-auto text-xs px-2 py-0.5 rounded ${
          currentTenant?.user_role === 'admin'
            ? 'bg-purple-100 text-purple-800'
            : currentTenant?.user_role === 'operator'
            ? 'bg-blue-100 text-blue-800'
            : 'bg-gray-100 text-gray-800'
        }`}
      >
        {currentTenant?.user_role}
      </span>
    </div>
  )
}

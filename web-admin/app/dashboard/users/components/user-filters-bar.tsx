'use client'

/**
 * User Filters Bar Component
 *
 * Search, filters, and bulk actions for user list
 */

import { useState } from 'react'
import type { UserFilters } from '@/types/user-management'
import { bulkUserAction } from '@/lib/api/users'
import { useAuth } from '@/lib/auth/auth-context'

interface UserFiltersBarProps {
  filters: UserFilters
  onFilterChange: (filters: Partial<UserFilters>) => void
  selectedCount: number
  onBulkActionComplete?: () => void
}

export default function UserFiltersBar({
  filters,
  onFilterChange,
  selectedCount,
  onBulkActionComplete,
}: UserFiltersBarProps) {
  const { currentTenant } = useAuth()
  const [bulkActionLoading, setBulkActionLoading] = useState(false)

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({ search: e.target.value })
  }

  const handleRoleFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ role: e.target.value as any })
  }

  const handleStatusFilter = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ status: e.target.value as any })
  }

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onFilterChange({ sortBy: e.target.value as any })
  }

  const handleClearFilters = () => {
    onFilterChange({
      search: '',
      role: 'all',
      status: 'all',
      sortBy: 'created_at',
      sortOrder: 'desc',
    })
  }

  const handleBulkAction = async (action: 'activate' | 'deactivate' | 'delete') => {
    if (!currentTenant) return

    const confirmMessage = {
      activate: 'Are you sure you want to activate the selected users?',
      deactivate: 'Are you sure you want to deactivate the selected users?',
      delete: 'Are you sure you want to delete the selected users? This action cannot be undone.',
    }

    if (!confirm(confirmMessage[action])) return

    setBulkActionLoading(true)
    try {
      // Note: This needs the selected user IDs to be passed from parent
      // For now, this is a placeholder
      alert('Bulk action functionality requires selected user IDs from parent component')

      onBulkActionComplete?.()
    } catch (error) {
      console.error('Bulk action error:', error)
    } finally {
      setBulkActionLoading(false)
    }
  }

  const hasActiveFilters = filters.search || filters.role !== 'all' || filters.status !== 'all'

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Search and Filters */}
      <div className="p-4 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={filters.search || ''}
            onChange={handleSearch}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
        </div>

        {/* Filters Row */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {/* Role Filter */}
          <div>
            <label htmlFor="role-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              id="role-filter"
              value={filters.role || 'all'}
              onChange={handleRoleFilter}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">All Roles</option>
              <option value="admin">Admin</option>
              <option value="operator">Operator</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status-filter"
              value={filters.status || 'all'}
              onChange={handleStatusFilter}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Sort By */}
          <div>
            <label htmlFor="sort-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Sort By
            </label>
            <select
              id="sort-filter"
              value={filters.sortBy || 'created_at'}
              onChange={handleSortChange}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="created_at">Date Created</option>
              <option value="email">Email</option>
              <option value="name">Name</option>
              <option value="role">Role</option>
              <option value="last_login">Last Login</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          <div className="flex items-end">
            <button
              onClick={handleClearFilters}
              disabled={!hasActiveFilters}
              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions Bar */}
      {selectedCount > 0 && (
        <div className="bg-blue-50 border-t border-blue-100 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg
                className="h-5 w-5 text-blue-600 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="text-sm font-medium text-blue-900">
                {selectedCount} user{selectedCount !== 1 ? 's' : ''} selected
              </span>
            </div>

            <div className="flex space-x-3">
              {bulkActionLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 mr-2"></div>
                  <span className="text-sm text-blue-900">Processing...</span>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => handleBulkAction('activate')}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    Activate
                  </button>
                  <button
                    onClick={() => handleBulkAction('deactivate')}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                  >
                    Deactivate
                  </button>
                  <button
                    onClick={() => handleBulkAction('delete')}
                    className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-2">
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-xs font-medium text-gray-500">Active filters:</span>
            {filters.search && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Search: &quot;{filters.search}&quot;
                <button
                  onClick={() => onFilterChange({ search: '' })}
                  className="ml-1 inline-flex items-center"
                >
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            )}
            {filters.role && filters.role !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                Role: {filters.role}
                <button
                  onClick={() => onFilterChange({ role: 'all' })}
                  className="ml-1 inline-flex items-center"
                >
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            )}
            {filters.status && filters.status !== 'all' && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Status: {filters.status}
                <button
                  onClick={() => onFilterChange({ status: 'all' })}
                  className="ml-1 inline-flex items-center"
                >
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

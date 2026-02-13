'use client'

/**
 * User Table Component
 *
 * Displays list of users with actions.
 * All API calls go through platform-api via lib/api/users.
 * No Supabase imports.
 */

import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import Link from 'next/link'
import { activateUser, deactivateUser } from '@/lib/api/users'
import { useAuth } from '@/lib/auth/auth-context'
import type { TenantUser } from '@/lib/api/users'

interface PaginationData {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface UserTableProps {
  users: TenantUser[]
  loading: boolean
  pagination: PaginationData
  selectedUsers: string[]
  onPageChange: (page: number) => void
  onEditUser: (user: TenantUser) => void
  onSelectionChange: (userIds: string[]) => void
  onRefresh: () => void
  accessToken?: string
}

export default function UserTable({
  users,
  loading,
  pagination,
  selectedUsers,
  onPageChange,
  onEditUser,
  onSelectionChange,
  onRefresh,
  accessToken = '',
}: UserTableProps) {
  const t = useTranslations('users.table')
  const tCommon = useTranslations('common')
  const tSettings = useTranslations('settings')
  const tPagination = useTranslations('users.pagination')
  const locale = useLocale()
  const { currentTenant, user: currentUser } = useAuth()
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
      case 'tenant_admin':
        return 'bg-purple-100 text-purple-800'
      case 'operator':
        return 'bg-blue-100 text-blue-800'
      case 'viewer':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return t('never')
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const handleToggleSelect = (userId: string) => {
    if (selectedUsers.includes(userId)) {
      onSelectionChange(selectedUsers.filter((id) => id !== userId))
    } else {
      onSelectionChange([...selectedUsers, userId])
    }
  }

  const handleSelectAll = () => {
    if (selectedUsers.length === users.length) {
      onSelectionChange([])
    } else {
      onSelectionChange(users.map((u) => u.user_id))
    }
  }

  const handleActivate = async (user: TenantUser) => {
    if (!currentTenant) return

    setActionLoading(user.user_id)
    const result = await activateUser(currentTenant.tenant_id, user.user_id, accessToken)
    setActionLoading(null)

    if (result.success) {
      onRefresh()
    }
  }

  const handleDeactivate = async (user: TenantUser) => {
    if (!currentTenant) return
    if (!confirm(t('confirmDeactivate', { email: user.email }))) return

    setActionLoading(user.user_id)
    const result = await deactivateUser(currentTenant.tenant_id, user.user_id, accessToken)
    setActionLoading(null)

    if (result.success) {
      onRefresh()
    }
  }

  if (loading) {
    return (
      <div className="bg-white shadow rounded-lg p-8">
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <span className="ml-3 rtl:ml-0 rtl:mr-3">{tCommon('loading')}</span>
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="bg-white shadow rounded-lg p-8 text-center">
        <p className="text-gray-500">{t('noUsers')}</p>
      </div>
    )
  }

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left">
              <input
                type="checkbox"
                checked={selectedUsers.length === users.length && users.length > 0}
                onChange={handleSelectAll}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
            </th>
            <th className="px-6 py-3 text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              {tSettings('user')}
            </th>
            <th className="px-6 py-3 text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              {tSettings('role')}
            </th>
            <th className="px-6 py-3 text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              {tCommon('status')}
            </th>
            <th className="px-6 py-3 text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              {t('lastLogin')}
            </th>
            <th className="px-6 py-3 text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
              {tCommon('actions')}
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.map((user) => (
            <tr key={user.user_id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(user.user_id)}
                  onChange={() => handleToggleSelect(user.user_id)}
                  disabled={user.user_id === currentUser?.id}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded disabled:opacity-50"
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-600 font-medium">
                        {(user.display_name || user.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 rtl:ml-0 rtl:mr-4">
                    <div className="text-sm font-medium text-gray-900">
                      {user.display_name || t('noName')}
                    </div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(
                    user.role
                  )}`}
                >
                  {user.role}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.is_active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {user.is_active ? tCommon('active') : tCommon('inactive')}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {formatDate(user.last_login_at)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {actionLoading === user.user_id ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                ) : (
                  <div className="flex space-x-2 rtl:space-x-reverse">
                    {/* View Details link */}
                    <Link
                      href={`/dashboard/users/${user.user_id}`}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      {t('details')}
                    </Link>
                    <button
                      onClick={() => onEditUser(user)}
                      className="text-blue-600 hover:text-blue-900"
                      disabled={user.user_id === currentUser?.id}
                    >
                      {tCommon('edit')}
                    </button>
                    {user.is_active ? (
                      <button
                        onClick={() => handleDeactivate(user)}
                        className="text-red-600 hover:text-red-900"
                        disabled={user.user_id === currentUser?.id}
                      >
                        {t('deactivate')}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivate(user)}
                        className="text-green-600 hover:text-green-900"
                      >
                        {t('activate')}
                      </button>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {tCommon('previous')}
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="ml-3 rtl:ml-0 rtl:mr-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              {tCommon('next')}
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                {tPagination('showing', {
                  from: (pagination.page - 1) * pagination.limit + 1,
                  to: Math.min(pagination.page * pagination.limit, pagination.total),
                  total: pagination.total,
                })}
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => onPageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md rtl:rounded-l-none rtl:rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  {tCommon('previous')}
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      page === pagination.page
                        ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                        : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => onPageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md rtl:rounded-r-none rtl:rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                  {tCommon('next')}
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

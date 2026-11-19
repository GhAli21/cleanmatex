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
import { cmxMessage } from '@ui/feedback'
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

/**
 *
 * @param root0
 * @param root0.users
 * @param root0.loading
 * @param root0.pagination
 * @param root0.selectedUsers
 * @param root0.onPageChange
 * @param root0.onEditUser
 * @param root0.onSelectionChange
 * @param root0.onRefresh
 * @param root0.accessToken
 */
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
        return 'bg-info-bg text-info-text'
      case 'operator':
        return 'bg-info-bg text-info-text'
      case 'viewer':
        return 'bg-muted text-foreground'
      default:
        return 'bg-muted text-foreground'
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
    const confirmed = await cmxMessage.confirm({
      title: t('deactivate'),
      description: t('confirmDeactivate', { email: user.email }),
      confirmLabel: t('deactivate'),
      cancelLabel: tCommon('cancel'),
      variant: 'warning',
    })
    if (!confirmed) return

    setActionLoading(user.user_id)
    const result = await deactivateUser(currentTenant.tenant_id, user.user_id, accessToken)
    setActionLoading(null)

    if (result.success) {
      cmxMessage.success(t('deactivated'))
      onRefresh()
    } else {
      cmxMessage.error(result.message || t('deactivateFailed'))
    }
  }

  if (loading) {
    return (
      <div className="bg-card shadow rounded-lg p-8">
        <div className="flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <span className="ms-3">{tCommon('loading')}</span>
        </div>
      </div>
    )
  }

  if (users.length === 0) {
    return (
      <div className="bg-card shadow rounded-lg p-8 text-center">
        <p className="text-muted-foreground">{t('noUsers')}</p>
      </div>
    )
  }

  return (
    <div className="bg-card shadow rounded-lg overflow-hidden">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            <th className="px-6 py-3 text-start">
              <input
                type="checkbox"
                checked={selectedUsers.length === users.length && users.length > 0}
                onChange={handleSelectAll}
                className="h-4 w-4 text-primary-text focus:ring-ring border-border rounded"
              />
            </th>
            <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tSettings('user')}
            </th>
            <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tSettings('role')}
            </th>
            <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tCommon('status')}
            </th>
            <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {t('lastLogin')}
            </th>
            <th className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
              {tCommon('actions')}
            </th>
          </tr>
        </thead>
        <tbody className="bg-card divide-y divide-border">
          {users.map((user) => (
            <tr key={user.user_id} className="hover:bg-muted">
              <td className="px-6 py-4 whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(user.user_id)}
                  onChange={() => handleToggleSelect(user.user_id)}
                  disabled={user.user_id === currentUser?.id}
                  className="h-4 w-4 text-primary-text focus:ring-ring border-border rounded disabled:opacity-50"
                />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="flex items-center">
                  <div className="flex-shrink-0 h-10 w-10">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-muted-foreground font-medium">
                        {(user.display_name || user.email).charAt(0).toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="ms-4">
                    <div className="text-sm font-medium text-foreground">
                      {user.display_name || t('noName')}
                    </div>
                    <div className="text-sm text-muted-foreground">{user.email}</div>
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
                      ? 'bg-success-bg text-success-text'
                      : 'bg-danger-bg text-danger-text'
                  }`}
                >
                  {user.is_active ? tCommon('active') : tCommon('inactive')}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                {formatDate(user.last_login_at)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                {actionLoading === user.user_id ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                ) : (
                  <div className="flex space-x-2">
                    {/* View Details link */}
                    <Link
                      href={`/dashboard/users/${user.user_id}`}
                      className="text-primary-text hover:text-primary-text/80"
                    >
                      {t('details')}
                    </Link>
                    <button
                      onClick={() => onEditUser(user)}
                      className="text-primary-text hover:text-primary-text/80"
                      disabled={user.user_id === currentUser?.id}
                    >
                      {tCommon('edit')}
                    </button>
                    {user.is_active ? (
                      <button
                        onClick={() => handleDeactivate(user)}
                        className="text-danger-text hover:text-danger-text/80"
                        disabled={user.user_id === currentUser?.id}
                      >
                        {t('deactivate')}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleActivate(user)}
                        className="text-success-text hover:text-success-text/80"
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
        <div className="bg-card px-4 py-3 flex items-center justify-between border-t border-border sm:px-6">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => onPageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-foreground bg-card hover:bg-muted disabled:opacity-50"
            >
              {tCommon('previous')}
            </button>
            <button
              onClick={() => onPageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.totalPages}
              className="ms-3 relative inline-flex items-center px-4 py-2 border border-border text-sm font-medium rounded-md text-foreground bg-card hover:bg-muted disabled:opacity-50"
            >
              {tCommon('next')}
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-foreground">
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
                  className="relative inline-flex items-center px-2 py-2 rounded-s-md border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
                >
                  {tCommon('previous')}
                </button>
                {Array.from({ length: pagination.totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => onPageChange(page)}
                    className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                      page === pagination.page
                        ? 'z-10 bg-info-bg border-primary text-info-text'
                        : 'bg-card border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={() => onPageChange(pagination.page + 1)}
                  disabled={pagination.page === pagination.totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-e-md border border-border bg-card text-sm font-medium text-muted-foreground hover:bg-muted disabled:opacity-50"
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

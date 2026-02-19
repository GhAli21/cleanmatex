'use client'

/**
 * User Management Page
 *
 * Admin-only page for managing users within a tenant.
 * All data fetched via platform-api (no Supabase imports).
 * Features:
 * - User list with pagination
 * - Search and filters
 * - Add/edit/delete users
 * - Role management
 * - Bulk actions
 */

import { useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { withAdminRole } from '@/lib/auth/with-role'
import { useAuth } from '@/lib/auth/auth-context'
import { fetchUsers, fetchUserStats } from '@/lib/api/users'
import { getAllRoles } from '@/lib/api/roles'
import type { TenantUser, UserFilters, UserStats } from '@/lib/api/users'
import type { TenantRole } from '@/lib/api/roles'
import UserTable from '@features/users/ui/user-table'
import UserFiltersBar from '@features/users/ui/user-filters-bar'
import UserStatsCards from '@features/users/ui/user-stats-cards'
import UserModal from '@features/users/ui/user-modal'

function UsersPage() {
  const t = useTranslations('users')
  const { currentTenant, session } = useAuth()
  const accessToken = session?.access_token ?? ''

  // State
  const [users, setUsers] = useState<TenantUser[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [availableRoles, setAvailableRoles] = useState<TenantRole[]>([])
  const [filters, setFilters] = useState<UserFilters>({
    search: '',
    role: 'all',
    status: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc',
  })
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [loading, setLoading] = useState(true)
  const [showUserModal, setShowUserModal] = useState(false)
  const [selectedUser, setSelectedUser] = useState<TenantUser | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])

  // Fetch users
  const loadUsers = async () => {
    if (!currentTenant?.tenant_id || !accessToken) return

    setLoading(true)
    try {
      const response = await fetchUsers(
        currentTenant.tenant_id,
        filters,
        pagination.page,
        pagination.limit,
        accessToken
      )

      setUsers(response.data)
      setPagination((prev) => ({
        ...prev,
        total: response.total,
        totalPages: Math.ceil(response.total / prev.limit),
      }))
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch stats
  const loadStats = async () => {
    if (!currentTenant?.tenant_id || !accessToken) return

    try {
      const statsData = await fetchUserStats(currentTenant.tenant_id, accessToken)
      setStats(statsData)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  // Fetch roles for filter dropdown
  const loadRoles = async () => {
    if (!accessToken) return
    try {
      const roles = await getAllRoles(accessToken)
      setAvailableRoles(roles)
    } catch (error) {
      console.error('Error loading roles:', error)
    }
  }

  // Load users on mount and when filters/pagination change
  useEffect(() => {
    if (accessToken) {
      loadUsers()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant, filters, pagination.page, accessToken])

  // Load stats and roles on mount
  useEffect(() => {
    if (accessToken) {
      loadStats()
      loadRoles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTenant, accessToken])

  // Handlers
  const handleFilterChange = (newFilters: Partial<UserFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
    setPagination((prev) => ({ ...prev, page: 1 })) // Reset to first page
  }

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }))
  }

  const handleEditUser = (user: TenantUser) => {
    setSelectedUser(user)
    setShowUserModal(true)
  }

  const handleUserSaved = () => {
    setShowUserModal(false)
    setSelectedUser(null)
    loadUsers()
    loadStats()
  }

  const handleSelectionChange = (userIds: string[]) => {
    setSelectedUsers(userIds)
  }

  // Prepare roles for filter bar
  const rolesForFilter = availableRoles.map((r) => ({ code: r.code, name: r.name }))

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                {t('title')}
              </h1>
              <p className="mt-1 text-sm text-gray-500">{t('subtitle')}</p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4 rtl:md:ml-0 rtl:md:mr-4">
              <Link
                href="/dashboard/users/new"
                className="ml-3 rtl:ml-0 rtl:mr-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <svg
                  className="-ml-1 mr-2 h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                  />
                </svg>
                {t('addUser')}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && <UserStatsCards stats={stats} />}

        {/* Filters */}
        <div className="mt-6">
          <UserFiltersBar
            filters={filters}
            onFilterChange={handleFilterChange}
            selectedCount={selectedUsers.length}
            availableRoles={rolesForFilter.length > 0 ? rolesForFilter : undefined}
          />
        </div>

        {/* User Table */}
        <div className="mt-6">
          <UserTable
            users={users}
            loading={loading}
            pagination={pagination}
            selectedUsers={selectedUsers}
            onPageChange={handlePageChange}
            onEditUser={handleEditUser}
            onSelectionChange={handleSelectionChange}
            onRefresh={loadUsers}
            accessToken={accessToken}
          />
        </div>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <UserModal
          user={selectedUser}
          onClose={() => {
            setShowUserModal(false)
            setSelectedUser(null)
          }}
          onSaved={handleUserSaved}
          accessToken={accessToken}
          availableRoles={availableRoles}
        />
      )}
    </div>
  )
}

export default withAdminRole(UsersPage)

'use client'

/**
 * User Management Page
 *
 * Admin-only page for managing users within a tenant
 * Features:
 * - User list with pagination
 * - Search and filters
 * - Add/edit/delete users
 * - Role management
 * - Bulk actions
 */

import { useState, useEffect } from 'react'
import { withAdminRole } from '@/lib/auth/with-role'
import { useAuth } from '@/lib/auth/auth-context'
import { fetchUsers, fetchUserStats } from '@/lib/api/users'
import type { UserListItem, UserFilters, UserStats } from '@/types/user-management'
import UserTable from './components/user-table'
import UserFiltersBar from './components/user-filters-bar'
import UserStatsCards from './components/user-stats-cards'
import UserModal from './components/user-modal'

function UsersPage() {
  const { currentTenant } = useAuth()

  // State
  const [users, setUsers] = useState<UserListItem[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
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
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null)
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])

  // Fetch users
  const loadUsers = async () => {
    if (!currentTenant) return

    setLoading(true)
    try {
      const response = await fetchUsers(
        currentTenant.tenant_id,
        filters,
        pagination.page,
        pagination.limit
      )

      setUsers(response.users)
      setPagination(response.pagination)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch stats
  const loadStats = async () => {
    if (!currentTenant) return

    try {
      const statsData = await fetchUserStats(currentTenant.tenant_id)
      setStats(statsData)
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  // Load users on mount and when filters/pagination change
  useEffect(() => {
    loadUsers()
  }, [currentTenant, filters, pagination.page])

  // Load stats on mount
  useEffect(() => {
    loadStats()
  }, [currentTenant])

  // Handlers
  const handleFilterChange = (newFilters: Partial<UserFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }))
    setPagination((prev) => ({ ...prev, page: 1 })) // Reset to first page
  }

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, page }))
  }

  const handleAddUser = () => {
    setSelectedUser(null)
    setShowUserModal(true)
  }

  const handleEditUser = (user: UserListItem) => {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="md:flex md:items-center md:justify-between">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
                User Management
              </h1>
              <p className="mt-1 text-sm text-gray-500">
                Manage users, roles, and permissions for your organization
              </p>
            </div>
            <div className="mt-4 flex md:mt-0 md:ml-4">
              <button
                onClick={handleAddUser}
                className="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
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
                Add User
              </button>
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
        />
      )}
    </div>
  )
}

export default withAdminRole(UsersPage)

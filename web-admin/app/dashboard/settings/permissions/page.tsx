'use client'

/**
 * Permissions Management Page
 *
 * All data fetched from platform-api via rbacFetch.
 * Permissions use a resource:action code format.
 *
 * Features:
 * - View all permissions grouped by category
 * - Category filter tabs
 * - Search bar
 * - Create custom permissions
 * - Edit custom permissions
 * - Delete custom permissions (blocked if role_count > 0)
 */

import { useState, useEffect } from 'react'
import { Plus, Lock, Edit, Trash2, AlertCircle, X, Search } from 'lucide-react'
import {
  getPermissionsByCategory,
  createPermission,
  updatePermission,
  deletePermission,
  isValidPermissionCode,
} from '@/lib/api/permissions'
import { useAuth } from '@/lib/auth/auth-context'
import type { TenantPermission, PermissionsByCategory } from '@/lib/api/permissions'

export default function PermissionsManagementPage() {
  const { currentTenant, permissions, session } = useAuth()
  const accessToken = session?.access_token ?? ''

  const [permissionsByCategory, setPermissionsByCategory] = useState<PermissionsByCategory>({})
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedPermission, setSelectedPermission] = useState<TenantPermission | null>(null)
  const [deleteConfirmPermission, setDeleteConfirmPermission] = useState<TenantPermission | null>(null)

  const [createForm, setCreateForm] = useState({
    code: '',
    name: '',
    name2: '',
    category: '',
    description: '',
    description2: '',
  })

  const [editForm, setEditForm] = useState({
    name: '',
    name2: '',
    category: '',
    description: '',
    description2: '',
  })

  useEffect(() => {
    if (accessToken) {
      loadPermissions()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  const loadPermissions = async () => {
    try {
      setLoading(true)
      setError(null)
      const grouped = await getPermissionsByCategory(accessToken)
      setPermissionsByCategory(grouped)
    } catch (err) {
      console.error('Error loading permissions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!isValidPermissionCode(createForm.code)) {
      setActionError('Permission code must match format: resource:action (lowercase letters and underscores only)')
      return
    }
    if (!createForm.name.trim() || !createForm.category.trim()) {
      setActionError('Name and Category are required')
      return
    }

    try {
      setSaving(true)
      setActionError(null)
      await createPermission(
        {
          code: createForm.code,
          name: createForm.name,
          name2: createForm.name2 || undefined,
          category: createForm.category,
          description: createForm.description || undefined,
          description2: createForm.description2 || undefined,
        },
        accessToken
      )
      await loadPermissions()
      setShowCreateModal(false)
      setCreateForm({ code: '', name: '', name2: '', category: '', description: '', description2: '' })
    } catch (err) {
      console.error('Error creating permission:', err)
      setActionError(err instanceof Error ? err.message : 'Failed to create permission')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (permission: TenantPermission) => {
    setSelectedPermission(permission)
    setEditForm({
      name: permission.name,
      name2: permission.name2 || '',
      category: permission.category,
      description: permission.description || '',
      description2: permission.description2 || '',
    })
    setActionError(null)
    setShowEditModal(true)
  }

  const handleUpdate = async () => {
    if (!selectedPermission || !editForm.name.trim()) return
    try {
      setSaving(true)
      setActionError(null)
      await updatePermission(
        selectedPermission.code,
        {
          name: editForm.name,
          name2: editForm.name2 || undefined,
          category: editForm.category || undefined,
          description: editForm.description || undefined,
          description2: editForm.description2 || undefined,
        },
        accessToken
      )
      await loadPermissions()
      setShowEditModal(false)
      setSelectedPermission(null)
    } catch (err) {
      console.error('Error updating permission:', err)
      setActionError(err instanceof Error ? err.message : 'Failed to update permission')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmPermission) return
    try {
      setSaving(true)
      setError(null)
      await deletePermission(deleteConfirmPermission.code, accessToken)
      await loadPermissions()
      setDeleteConfirmPermission(null)
    } catch (err) {
      console.error('Error deleting permission:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete permission')
      setDeleteConfirmPermission(null)
    } finally {
      setSaving(false)
    }
  }

  // Access control check
  const isAdmin =
    currentTenant?.user_role?.toLowerCase() === 'admin' ||
    currentTenant?.user_role?.toLowerCase() === 'tenant_admin' ||
    permissions?.includes('*:*') ||
    permissions?.includes('settings:*') ||
    permissions?.includes('permissions:*') ||
    permissions?.some((p) => p.startsWith('permissions:'))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow">
        <div className="text-center">
          <Lock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don&apos;t have permission to view permissions management.</p>
          <p className="text-sm text-gray-500 mt-2">Admin access required.</p>
        </div>
      </div>
    )
  }

  const categories = Object.keys(permissionsByCategory).sort()
  const allPermissions = Object.values(permissionsByCategory).flat()

  // Filter permissions based on selected category and search query
  const filteredPermissions = (() => {
    let perms =
      selectedCategory === 'all'
        ? allPermissions
        : permissionsByCategory[selectedCategory] ?? []

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      perms = perms.filter(
        (p) =>
          p.code.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          (p.name2 && p.name2.toLowerCase().includes(q)) ||
          p.category.toLowerCase().includes(q)
      )
    }

    return perms
  })()

  const systemCount = allPermissions.filter((p) => p.is_system).length
  const customCount = allPermissions.filter((p) => !p.is_system).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Permissions Management</h1>
          <p className="text-sm text-gray-600 mt-1">
            View and manage permissions for your organization
          </p>
        </div>
        <button
          onClick={() => {
            setCreateForm({ code: '', name: '', name2: '', category: '', description: '', description2: '' })
            setActionError(null)
            setShowCreateModal(true)
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Permission
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-gray-900">{allPermissions.length}</div>
          <div className="text-sm text-gray-500">Total Permissions</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-blue-600">{systemCount}</div>
          <div className="text-sm text-gray-500">System Permissions</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">{customCount}</div>
          <div className="text-sm text-gray-500">Custom Permissions</div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search permissions by code, name, or category..."
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
        />
      </div>

      {/* Category Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 overflow-x-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
              selectedCategory === 'all'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            All ({allPermissions.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                selectedCategory === cat
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {cat} ({(permissionsByCategory[cat] ?? []).length})
            </button>
          ))}
        </nav>
      </div>

      {/* Permissions Table */}
      <div className="bg-white shadow overflow-hidden rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name (EN / AR)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Used By
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredPermissions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  {searchQuery ? 'No permissions match your search.' : 'No permissions found.'}
                </td>
              </tr>
            ) : (
              filteredPermissions.map((permission) => (
                <tr key={permission.code} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-mono font-semibold rounded-full bg-gray-100 text-gray-800">
                      {permission.code}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900">{permission.name}</div>
                    {permission.name2 && (
                      <div className="text-sm text-gray-500 text-right" dir="rtl">
                        {permission.name2}
                      </div>
                    )}
                    {permission.description && (
                      <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">
                        {permission.description}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {permission.category}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {permission.role_count ?? '—'} role{permission.role_count !== 1 ? 's' : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {permission.is_system ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        System
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleEdit(permission)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={permission.is_system}
                        title={permission.is_system ? 'System permissions cannot be edited' : 'Edit Permission'}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmPermission(permission)}
                        className="text-red-600 hover:text-red-900 p-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={
                          permission.is_system ||
                          (permission.role_count !== undefined && permission.role_count > 0)
                        }
                        title={
                          permission.is_system
                            ? 'System permissions cannot be deleted'
                            : permission.role_count && permission.role_count > 0
                            ? 'Cannot delete permission used by roles'
                            : 'Delete Permission'
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Create New Permission</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {actionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                {actionError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Code * <span className="text-gray-400 text-xs">(format: resource:action)</span>
                </label>
                <input
                  type="text"
                  value={createForm.code}
                  onChange={(e) =>
                    setCreateForm({ ...createForm, code: e.target.value.toLowerCase() })
                  }
                  placeholder="e.g. orders:read"
                  className="block w-full rounded-md border-gray-300 border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Only lowercase letters and underscores allowed, separated by colon
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (English) *</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Read Orders"
                  className="block w-full rounded-md border-gray-300 border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (Arabic)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={createForm.name2}
                  onChange={(e) => setCreateForm({ ...createForm, name2: e.target.value })}
                  className="block w-full rounded-md border-gray-300 border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <input
                  type="text"
                  value={createForm.category}
                  onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                  placeholder="e.g. Orders"
                  className="block w-full rounded-md border-gray-300 border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  rows={2}
                  className="block w-full rounded-md border-gray-300 border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowCreateModal(false)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedPermission && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">Edit Permission</h3>
              <button onClick={() => setShowEditModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            {actionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                {actionError}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <input
                  type="text"
                  value={selectedPermission.code}
                  disabled
                  className="block w-full rounded-md border-gray-200 border px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">Permission code cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (English) *</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="block w-full rounded-md border-gray-300 border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (Arabic)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={editForm.name2}
                  onChange={(e) => setEditForm({ ...editForm, name2: e.target.value })}
                  className="block w-full rounded-md border-gray-300 border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input
                  type="text"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                  className="block w-full rounded-md border-gray-300 border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="block w-full rounded-md border-gray-300 border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                onClick={() => setShowEditModal(false)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdate}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmPermission && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Delete Permission</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete the permission{' '}
              <strong>&quot;{deleteConfirmPermission.code}&quot;</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmPermission(null)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

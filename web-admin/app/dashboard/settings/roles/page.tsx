'use client'

/**
 * Roles Management Page
 *
 * All data fetched from platform-api via rbacFetch.
 * Roles identified by `code` (string), NOT role_id (UUID).
 *
 * Features:
 * - View all roles (system + custom)
 * - Create custom roles
 * - Edit custom role details
 * - Assign permissions to roles
 * - Delete custom roles (blocked if users assigned)
 */

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Shield, Edit, Trash2, Key, AlertCircle, X } from 'lucide-react'
import {
  getAllRoles,
  getRoleByCode,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
} from '@/lib/api/roles'
import PermissionAssignmentModal from '@features/auth/ui/PermissionAssignmentModal'
import { useAuth } from '@/lib/auth/auth-context'
import type { TenantRole } from '@/lib/api/roles'

export default function RolesManagementPage() {
  const t = useTranslations('settings')
  const { currentTenant, permissions, session } = useAuth()
  const accessToken = session?.access_token ?? ''

  const [roles, setRoles] = useState<TenantRole[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [selectedRole, setSelectedRole] = useState<TenantRole | null>(null)
  const [selectedRoleForPermissions, setSelectedRoleForPermissions] = useState<TenantRole | null>(null)
  // Cache permission codes per role code
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirmRole, setDeleteConfirmRole] = useState<TenantRole | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    name2: '',
    description: '',
  })

  useEffect(() => {
    if (accessToken) {
      loadRoles()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken])

  const loadRoles = async () => {
    try {
      setLoading(true)
      setError(null)
      const allRoles = await getAllRoles(accessToken)
      setRoles(allRoles)
    } catch (err) {
      console.error('Error loading roles:', err)
      setError(err instanceof Error ? err.message : 'Failed to load roles')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    if (!formData.code.trim() || !formData.name.trim()) {
      setActionError('Code and Name are required')
      return
    }
    try {
      setSaving(true)
      setActionError(null)
      await createCustomRole(formData, accessToken)
      await loadRoles()
      setShowCreateModal(false)
      setFormData({ code: '', name: '', name2: '', description: '' })
    } catch (err) {
      console.error('Error creating role:', err)
      setActionError(err instanceof Error ? err.message : 'Failed to create role')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (role: TenantRole) => {
    setSelectedRole(role)
    setFormData({
      code: role.code,
      name: role.name,
      name2: role.name2 || '',
      description: role.description || '',
    })
    setActionError(null)
    setShowEditModal(true)
  }

  const handleUpdate = async () => {
    if (!selectedRole || !formData.name.trim()) return
    try {
      setSaving(true)
      setActionError(null)
      // Use role.code as the identifier — NOT role_id
      await updateCustomRole(selectedRole.code, {
        name: formData.name,
        name2: formData.name2 || undefined,
        description: formData.description || undefined,
      }, accessToken)
      await loadRoles()
      setShowEditModal(false)
      setSelectedRole(null)
    } catch (err) {
      console.error('Error updating role:', err)
      setActionError(err instanceof Error ? err.message : 'Failed to update role')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmRole) return
    try {
      setSaving(true)
      setError(null)
      // Use role.code as the identifier — NOT role_id
      await deleteCustomRole(deleteConfirmRole.code, accessToken)
      await loadRoles()
      setDeleteConfirmRole(null)
    } catch (err) {
      console.error('Error deleting role:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete role')
      setDeleteConfirmRole(null)
    } finally {
      setSaving(false)
    }
  }

  const loadRolePermissions = async (roleCode: string) => {
    try {
      const role = await getRoleByCode(roleCode, accessToken)
      const codes = role.permissions?.map((p) => p.code) ?? []
      setRolePermissions((prev) => ({ ...prev, [roleCode]: codes }))
      return codes
    } catch (err) {
      console.error('Error loading role permissions:', err)
      return []
    }
  }

  const handleManagePermissions = async (role: TenantRole) => {
    setSelectedRoleForPermissions(role)
    setActionError(null)
    // Load permissions if not already cached
    if (!rolePermissions[role.code]) {
      await loadRolePermissions(role.code)
    }
    setShowPermissionsModal(true)
  }

  // Access control check
  const isAdmin =
    currentTenant?.user_role?.toLowerCase() === 'admin' ||
    currentTenant?.user_role?.toLowerCase() === 'tenant_admin' ||
    permissions?.includes('*:*') ||
    permissions?.includes('settings:*') ||
    permissions?.includes('roles:*') ||
    permissions?.some((p) => p.startsWith('roles:'))

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
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don&apos;t have permission to view roles and permissions.</p>
          <p className="text-sm text-gray-500 mt-2">Admin access required.</p>
        </div>
      </div>
    )
  }

  const systemRoles = roles.filter((r) => r.is_system)
  const customRoles = roles.filter((r) => !r.is_system)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t('roles.title', { defaultValue: 'Roles Management' })}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {t('roles.description', { defaultValue: 'Manage roles and permissions for your organization' })}
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({ code: '', name: '', name2: '', description: '' })
            setActionError(null)
            setShowCreateModal(true)
          }}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('roles.create', { defaultValue: 'Create Role' })}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-gray-900">{roles.length}</div>
          <div className="text-sm text-gray-500">Total Roles</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-blue-600">{systemRoles.length}</div>
          <div className="text-sm text-gray-500">System Roles</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-green-600">{customRoles.length}</div>
          <div className="text-sm text-gray-500">Custom Roles</div>
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

      {/* Roles Table */}
      <div className="bg-white shadow overflow-hidden rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Permissions
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Users
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {roles.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                  No roles found.
                </td>
              </tr>
            ) : (
              roles.map((role) => (
                <tr key={role.code} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Shield className="h-5 w-5 text-gray-400 mr-3 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{role.name}</div>
                        {role.name2 && (
                          <div className="text-sm text-gray-500">{role.name2}</div>
                        )}
                        {role.description && (
                          <div className="text-xs text-gray-400 mt-0.5 max-w-xs truncate">
                            {role.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-mono font-semibold rounded-full bg-gray-100 text-gray-800">
                      {role.code}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {role.is_system ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                        System
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Custom
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {role.permission_count ?? '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {role.user_count ?? '—'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleManagePermissions(role)}
                        className="text-purple-600 hover:text-purple-900 p-1 rounded"
                        title="Manage Permissions"
                      >
                        <Key className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(role)}
                        className="text-blue-600 hover:text-blue-900 p-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={role.is_system}
                        title={role.is_system ? 'System roles cannot be edited' : 'Edit Role'}
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => setDeleteConfirmRole(role)}
                        className="text-red-600 hover:text-red-900 p-1 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                        disabled={role.is_system || (role.user_count !== undefined && role.user_count > 0)}
                        title={
                          role.is_system
                            ? 'System roles cannot be deleted'
                            : role.user_count && role.user_count > 0
                            ? 'Cannot delete role with assigned users'
                            : 'Delete Role'
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
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {t('roles.createTitle', { defaultValue: 'Create New Role' })}
              </h3>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Code *</label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                  placeholder="e.g. warehouse_manager"
                  className="block w-full rounded-md border-gray-300 border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (English) *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Warehouse Manager"
                  className="block w-full rounded-md border-gray-300 border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (Arabic)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={formData.name2}
                  onChange={(e) => setFormData({ ...formData, name2: e.target.value })}
                  className="block w-full rounded-md border-gray-300 border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
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
      {showEditModal && selectedRole && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {t('roles.editTitle', { defaultValue: 'Edit Role' })}
              </h3>
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
                  value={formData.code}
                  disabled
                  className="block w-full rounded-md border-gray-200 border px-3 py-2 text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-400 mt-1">Role code cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (English) *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="block w-full rounded-md border-gray-300 border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name (Arabic)</label>
                <input
                  type="text"
                  dir="rtl"
                  value={formData.name2}
                  onChange={(e) => setFormData({ ...formData, name2: e.target.value })}
                  className="block w-full rounded-md border-gray-300 border px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
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
      {deleteConfirmRole && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">Delete Role</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete the role{' '}
              <strong>&quot;{deleteConfirmRole.name}&quot;</strong>? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmRole(null)}
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

      {/* Permission Assignment Modal */}
      {showPermissionsModal && selectedRoleForPermissions && (
        <PermissionAssignmentModal
          role={selectedRoleForPermissions}
          assignedPermissions={rolePermissions[selectedRoleForPermissions.code] ?? []}
          accessToken={accessToken}
          onClose={() => {
            setShowPermissionsModal(false)
            setSelectedRoleForPermissions(null)
          }}
          onSuccess={async () => {
            // Reload permissions cache for this role and refresh roles list
            await loadRolePermissions(selectedRoleForPermissions.code)
            await loadRoles()
          }}
        />
      )}
    </div>
  )
}

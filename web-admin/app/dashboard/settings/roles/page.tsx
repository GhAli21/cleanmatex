'use client'

/**
 * Roles Management Page
 *
 * Features:
 * - View all roles (system + custom)
 * - Create custom roles
 * - Edit role permissions
 * - Assign roles to users
 * - Delete custom roles
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Plus, Shield, Edit, Trash2, Users, CheckCircle2, Key } from 'lucide-react'
import { getAllRoles, getRolePermissions, createCustomRole, updateCustomRole, deleteCustomRole } from '@/lib/api/roles'
import { RequirePermission, RequireAnyPermission } from '@/components/auth/RequirePermission'
import PermissionAssignmentModal from '@/components/permissions/PermissionAssignmentModal'
import { useAuth } from '@/lib/auth/auth-context'
import type { Role } from '@/lib/api/roles'

export default function RolesManagementPage() {
  const t = useTranslations('settings')
  const { currentTenant, permissions } = useAuth()
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showPermissionsModal, setShowPermissionsModal] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [selectedRoleForPermissions, setSelectedRoleForPermissions] = useState<Role | null>(null)
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({})
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    name2: '',
    description: '',
  })

  useEffect(() => {
    loadRoles()
  }, [])

  const loadRoles = async () => {
    try {
      setLoading(true)
      setError(null)
      const allRoles = await getAllRoles()
      setRoles(allRoles)
    } catch (error) {
      console.error('Error loading roles:', error)
      const message = error instanceof Error ? error.message : 'Failed to load roles'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      await createCustomRole(formData)
      await loadRoles()
      setShowCreateModal(false)
      setFormData({ code: '', name: '', name2: '', description: '' })
    } catch (error) {
      console.error('Error creating role:', error)
      alert('Failed to create role')
    }
  }

  const handleEdit = (role: Role) => {
    setSelectedRole(role)
    setFormData({
      code: role.code,
      name: role.name,
      name2: role.name2 || '',
      description: role.description || '',
    })
    setShowEditModal(true)
  }

  const handleUpdate = async () => {
    if (!selectedRole) return
    try {
      await updateCustomRole(selectedRole.role_id, formData)
      await loadRoles()
      setShowEditModal(false)
      setSelectedRole(null)
    } catch (error) {
      console.error('Error updating role:', error)
      alert('Failed to update role')
    }
  }

  const handleDelete = async (role: Role) => {
    if (!confirm(`Delete role "${role.name}"?`)) return
    try {
      await deleteCustomRole(role.role_id)
      await loadRoles()
    } catch (error) {
      console.error('Error deleting role:', error)
      const message = error instanceof Error ? error.message : 'Failed to delete role'
      alert(message)
    }
  }

  const loadRolePermissions = async (roleId: string) => {
    try {
      const permissions = await getRolePermissions(roleId)
      setRolePermissions(prev => ({ ...prev, [roleId]: permissions }))
      return permissions
    } catch (error) {
      console.error('Error loading role permissions:', error)
      return []
    }
  }

  const handleManagePermissions = async (role: Role) => {
    setSelectedRoleForPermissions(role)
    if (!rolePermissions[role.role_id]) {
      await loadRolePermissions(role.role_id)
    }
    setShowPermissionsModal(true)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  // Check if user has admin role or relevant permissions
  const isAdmin = currentTenant?.user_role?.toLowerCase() === 'admin' || 
                  currentTenant?.user_role?.toLowerCase() === 'tenant_admin' ||
                  permissions?.includes('*:*') ||
                  permissions?.includes('settings:*') ||
                  permissions?.includes('roles:*') ||
                  permissions?.includes('settings:read') ||
                  permissions?.includes('users:read') ||
                  permissions?.some(p => p.startsWith('roles:'))

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow">
        <div className="text-center">
          <Shield className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
          <p className="text-gray-600">You don't have permission to view roles and permissions.</p>
          <p className="text-sm text-gray-500 mt-2">Admin access required.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
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
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            {t('roles.create', { defaultValue: 'Create Role' })}
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Shield className="h-5 w-5 text-red-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error loading roles</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Roles List */}
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {roles.map((role) => (
                <tr key={role.role_id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Shield className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {role.name}
                        </div>
                        {role.name2 && (
                          <div className="text-sm text-gray-500">
                            {role.name2}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
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
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleManagePermissions(role)}
                        className="text-purple-600 hover:text-purple-900"
                        title="Manage Permissions"
                      >
                        <Key className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(role)}
                        className="text-blue-600 hover:text-blue-900"
                        disabled={role.is_system}
                        title="Edit Role"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(role)}
                        className="text-red-600 hover:text-red-900"
                        disabled={role.is_system}
                        title="Delete Role"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Create Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {t('roles.createTitle', { defaultValue: 'Create New Role' })}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Code
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Name (English)
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Name (Arabic)
                  </label>
                  <input
                    type="text"
                    value={formData.name2}
                    onChange={(e) => setFormData({ ...formData, name2: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                {t('roles.editTitle', { defaultValue: 'Edit Role' })}
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Code
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Name (English)
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Name (Arabic)
                  </label>
                  <input
                    type="text"
                    value={formData.name2}
                    onChange={(e) => setFormData({ ...formData, name2: e.target.value })}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end space-x-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdate}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Permission Assignment Modal */}
        {showPermissionsModal && selectedRoleForPermissions && (
          <PermissionAssignmentModal
            role={selectedRoleForPermissions}
            assignedPermissions={rolePermissions[selectedRoleForPermissions.role_id] || []}
            onClose={() => {
              setShowPermissionsModal(false)
              setSelectedRoleForPermissions(null)
            }}
            onSuccess={async () => {
              // Reload permissions for this role
              await loadRolePermissions(selectedRoleForPermissions.role_id)
            }}
          />
        )}
      </div>
    </div>
  )
}

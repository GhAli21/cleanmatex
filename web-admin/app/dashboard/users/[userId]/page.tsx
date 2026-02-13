'use client'

/**
 * User Detail Page
 *
 * Shows full user profile, assigned roles, and effective permissions.
 * All data fetched from platform-api via lib/api/users and lib/api/roles.
 */

import { useLocale, useTranslations } from 'next-intl'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertCircle, X, Shield, Check } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import {
  fetchUser,
  getUserRoles,
  getEffectivePermissions,
  assignRolesToUser,
  removeRoleFromUser,
} from '@/lib/api/users'
import { getAllRoles } from '@/lib/api/roles'
import type { TenantUser, UserRoleAssignment } from '@/lib/api/users'
import type { TenantRole } from '@/lib/api/roles'

type ActiveTab = 'roles' | 'permissions'

export default function UserDetailPage() {
  const params = useParams()
  const userId = params.userId as string
  const t = useTranslations('users.detail')
  const tTable = useTranslations('users.table')
  const tCommon = useTranslations('common')
  const tSettings = useTranslations('settings')
  const locale = useLocale()
  const { currentTenant, session } = useAuth()
  const accessToken = session?.access_token ?? ''

  const [user, setUser] = useState<TenantUser | null>(null)
  const [userRoles, setUserRoles] = useState<UserRoleAssignment[]>([])
  const [effectivePermissions, setEffectivePermissions] = useState<string[]>([])
  const [allRoles, setAllRoles] = useState<TenantRole[]>([])
  const [activeTab, setActiveTab] = useState<ActiveTab>('roles')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // Assign role modal state
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [selectedRoleCodes, setSelectedRoleCodes] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  // Delete confirm state
  const [deleteConfirmRole, setDeleteConfirmRole] = useState<UserRoleAssignment | null>(null)

  const tenantId = currentTenant?.tenant_id ?? ''

  useEffect(() => {
    if (!tenantId || !accessToken || !userId) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, accessToken, userId])

  const loadData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [userData, rolesData, permsData, allRolesData] = await Promise.all([
        fetchUser(tenantId, userId, accessToken),
        getUserRoles(tenantId, userId, accessToken),
        getEffectivePermissions(tenantId, userId, accessToken),
        getAllRoles(accessToken),
      ])

      setUser(userData)
      setUserRoles(rolesData)
      setEffectivePermissions(permsData.permissions)
      setAllRoles(allRolesData)
    } catch (err) {
      console.error('Error loading user data:', err)
      setError(err instanceof Error ? err.message : t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleOpenAssignModal = () => {
    // Pre-check currently assigned roles
    const assigned = new Set(userRoles.map((r) => r.role_code))
    setSelectedRoleCodes(assigned)
    setActionError(null)
    setShowAssignModal(true)
  }

  const handleToggleRole = (roleCode: string) => {
    setSelectedRoleCodes((prev) => {
      const next = new Set(prev)
      if (next.has(roleCode)) {
        next.delete(roleCode)
      } else {
        next.add(roleCode)
      }
      return next
    })
  }

  const handleSaveRoles = async () => {
    setSaving(true)
    setActionError(null)
    try {
      await assignRolesToUser(tenantId, userId, Array.from(selectedRoleCodes), accessToken)
      setShowAssignModal(false)
      // Reload roles and permissions
      const [rolesData, permsData] = await Promise.all([
        getUserRoles(tenantId, userId, accessToken),
        getEffectivePermissions(tenantId, userId, accessToken),
      ])
      setUserRoles(rolesData)
      setEffectivePermissions(permsData.permissions)
    } catch (err) {
      console.error('Error assigning roles:', err)
      setActionError(err instanceof Error ? err.message : t('assignFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleRemoveRole = async () => {
    if (!deleteConfirmRole) return
    setSaving(true)
    setError(null)
    try {
      await removeRoleFromUser(tenantId, userId, deleteConfirmRole.role_code, accessToken)
      setDeleteConfirmRole(null)
      const [rolesData, permsData] = await Promise.all([
        getUserRoles(tenantId, userId, accessToken),
        getEffectivePermissions(tenantId, userId, accessToken),
      ])
      setUserRoles(rolesData)
      setEffectivePermissions(permsData.permissions)
    } catch (err) {
      console.error('Error removing role:', err)
      setError(err instanceof Error ? err.message : t('removeFailed'))
      setDeleteConfirmRole(null)
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (date: string | null) => {
    if (!date) return tTable('never')
    return new Date(date).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Group permissions by resource prefix (before the colon)
  const groupedPermissions = effectivePermissions.reduce<Record<string, string[]>>((acc, perm) => {
    const [resource] = perm.split(':')
    const key = resource ?? 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(perm)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error && !user) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/users"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1 rtl:mr-0 rtl:ml-1" />
          {t('backToUsers')}
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <Link
          href="/dashboard/users"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4 mr-1 rtl:mr-0 rtl:ml-1" />
          {t('backToUsers')}
        </Link>
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <p className="text-gray-500">{t('userNotFound')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link
        href="/dashboard/users"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4 mr-1 rtl:mr-0 rtl:ml-1" />
        {t('backToUsers')}
      </Link>

      {/* Error banner */}
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

      {/* User Info Card */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <span className="text-blue-700 font-bold text-2xl">
              {(user.display_name || user.email).charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 truncate">
              {user.display_name || tTable('noName')}
            </h1>
            <p className="text-sm text-gray-500">{user.email}</p>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-purple-100 text-purple-800">
                {user.role}
              </span>
              <span
                className={`px-2 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  user.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {user.is_active ? tCommon('active') : tCommon('inactive')}
              </span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-4 text-sm text-gray-500">
              <div>
                <span className="font-medium text-gray-700">{t('lastLogin')}</span>{' '}
                {formatDate(user.last_login_at)}
              </div>
              <div>
                <span className="font-medium text-gray-700">{t('loginCount')}</span> {user.login_count}
              </div>
              <div>
                <span className="font-medium text-gray-700">{t('memberSince')}</span>{' '}
                {formatDate(user.created_at)}
              </div>
              {user.phone && (
                <div>
                <span className="font-medium text-gray-700">{t('phone')}</span> {user.phone}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 rtl:space-x-reverse">
          <button
            onClick={() => setActiveTab('roles')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'roles'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('rolesTab')} ({userRoles.length})
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'permissions'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            {t('effectivePermissions')} ({effectivePermissions.length})
          </button>
        </nav>
      </div>

      {/* Roles Tab */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">{t('assignedRoles')}</h2>
            <button
              onClick={handleOpenAssignModal}
              className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
            >
              <Shield className="h-4 w-4 mr-1 rtl:mr-0 rtl:ml-1" />
              {t('assignRole')}
            </button>
          </div>

          <div className="bg-white shadow overflow-hidden rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {tSettings('role')}
                  </th>
                  <th className="px-6 py-3 text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('type')}
                  </th>
                  <th className="px-6 py-3 text-left rtl:text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('assignedAt')}
                  </th>
                  <th className="px-6 py-3 text-right rtl:text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {tCommon('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {userRoles.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-10 text-center text-gray-500">
                      {t('noRolesAssigned')}
                    </td>
                  </tr>
                ) : (
                  userRoles.map((assignment) => (
                    <tr key={assignment.role_code} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-gray-400" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {assignment.role_name}
                            </div>
                            <div className="text-xs text-gray-400 font-mono">
                              {assignment.role_code}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {assignment.is_system ? (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {t('system')}
                          </span>
                        ) : (
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {t('custom')}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(assignment.assigned_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => setDeleteConfirmRole(assignment)}
                          className="text-red-600 hover:text-red-900 text-sm"
                        >
                          {t('remove')}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Permissions Tab */}
      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium text-gray-900">{t('effectivePermissions')}</h2>
            <p className="text-sm text-gray-500 bg-blue-50 border border-blue-100 rounded px-3 py-1.5">
              {t('computedFromRoles')}
            </p>
          </div>

          {effectivePermissions.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-500">{t('noEffectivePermissions')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedPermissions)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([resource, perms]) => (
                  <div key={resource} className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        {resource}
                      </h3>
                    </div>
                    <div className="p-4">
                      <div className="flex flex-wrap gap-2">
                        {perms.sort().map((perm) => (
                          <span
                            key={perm}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-mono font-medium bg-gray-100 text-gray-700"
                          >
                            <Check className="h-3 w-3 text-green-500" />
                            {perm}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Assign Role Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full shadow-xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">{t('assignRolesTitle')}</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {actionError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-800">
                {actionError}
              </div>
            )}
            <p className="text-sm text-gray-500 mb-4">{t('assignRolesHint')}</p>
            <div className="space-y-2">
              {allRoles.map((role) => (
                <label
                  key={role.code}
                  className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedRoleCodes.has(role.code)}
                    onChange={() => handleToggleRole(role.code)}
                    className="mt-0.5 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{role.name}</span>
                      {role.is_system && (
                        <span className="px-1.5 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">
                          {t('system')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">{role.code}</div>
                    {role.description && (
                      <div className="text-xs text-gray-500 mt-0.5 truncate">{role.description}</div>
                    )}
                  </div>
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-end space-x-3 rtl:space-x-reverse">
              <button
                onClick={() => setShowAssignModal(false)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handleSaveRoles}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                )}
                {tCommon('save')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Role Confirmation Modal */}
      {deleteConfirmRole && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertCircle className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900">{t('removeRoleTitle')}</h3>
            </div>
            <p className="text-sm text-gray-600 mb-6">
              {t('removeRoleConfirm', { roleName: deleteConfirmRole.role_name })}
            </p>
            <div className="flex justify-end space-x-3 rtl:space-x-reverse">
              <button
                onClick={() => setDeleteConfirmRole(null)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {tCommon('cancel')}
              </button>
              <button
                onClick={handleRemoveRole}
                disabled={saving}
                className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                )}
                {t('remove')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

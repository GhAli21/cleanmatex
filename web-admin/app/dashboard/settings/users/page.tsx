'use client'

/**
 * Users Settings Page
 *
 * Team management features:
 * - View team members
 * - Invite new users
 * - Manage roles and permissions
 * - Deactivate users
 */

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { UserPlus, Mail, Shield, MoreVertical, Trash2, Edit, CheckCircle2, X } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import { updateUser, deleteUser, activateUser, resetUserPassword } from '@/lib/api/users'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'pending' | 'inactive'
  joinedAt: string
}

const MOCK_TEAM: TeamMember[] = [
  { id: '1', name: 'Ahmed Al-Said', email: 'ahmed@example.com', role: 'admin', status: 'active', joinedAt: '2024-01-15' },
  { id: '2', name: 'Fatima Hassan', email: 'fatima@example.com', role: 'operator', status: 'active', joinedAt: '2024-02-20' },
  { id: '3', name: 'Ali Mohammed', email: 'ali@example.com', role: 'operator', status: 'active', joinedAt: '2024-03-10' }
]

export default function UsersSettingsPage() {
  const t = useTranslations('settings')
  const { currentTenant, user: currentUser } = useAuth()
  const [team, setTeam] = useState<TeamMember[]>(MOCK_TEAM)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteData, setInviteData] = useState({ email: '', role: 'operator' })
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const handleInvite = async () => {
    // TODO: API call
    console.log('Inviting:', inviteData)
    setShowInvite(false)
    setInviteData({ email: '', role: 'operator' })
  }

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-800',
      operator: 'bg-blue-100 text-blue-800',
      viewer: 'bg-gray-100 text-gray-800'
    }
    return colors[role as keyof typeof colors] || colors.viewer
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-gray-100 text-gray-800'
    }
    return colors[status as keyof typeof colors] || colors.inactive
  }

  const handleEdit = (member: TeamMember) => {
    setSelectedMember(member)
    setShowEditModal(true)
    setOpenMenuId(null)
  }

  const handleResetPassword = async (member: TeamMember) => {
    if (!confirm(t('confirmResetPassword', { email: member.email }))) return
    if (!currentTenant) return

    setActionLoading(member.id)
    try {
      const result = await resetUserPassword(member.email)
      if (result.success) {
        alert(t('passwordResetSent'))
      } else {
        alert(result.message || 'Failed to send password reset email')
      }
    } catch (error) {
      console.error('Error resetting password:', error)
      alert('Failed to send password reset email')
    } finally {
      setActionLoading(null)
      setOpenMenuId(null)
    }
  }

  const handleDeactivate = async (member: TeamMember) => {
    if (!confirm(t('confirmDeactivate'))) return
    if (!currentTenant) return

    // Prevent self-deactivation
    if (member.id === currentUser?.id) {
      alert(t('cannotDeactivateSelf'))
      setOpenMenuId(null)
      return
    }

    setActionLoading(member.id)
    try {
      const result = await deleteUser(member.id, currentTenant.tenant_id)
      if (result.success) {
        setTeam(team.map(m => m.id === member.id ? { ...m, status: 'inactive' as const } : m))
        alert(t('userDeactivated'))
      } else {
        alert(result.message || 'Failed to deactivate user')
      }
    } catch (error) {
      console.error('Error deactivating user:', error)
      alert('Failed to deactivate user')
    } finally {
      setActionLoading(null)
      setOpenMenuId(null)
    }
  }

  const handleActivate = async (member: TeamMember) => {
    if (!confirm(t('confirmActivate'))) return
    if (!currentTenant) return

    setActionLoading(member.id)
    try {
      const result = await activateUser(member.id, currentTenant.tenant_id)
      if (result.success) {
        setTeam(team.map(m => m.id === member.id ? { ...m, status: 'active' as const } : m))
        alert(t('userActivated'))
      } else {
        alert(result.message || 'Failed to activate user')
      }
    } catch (error) {
      console.error('Error activating user:', error)
      alert('Failed to activate user')
    } finally {
      setActionLoading(null)
      setOpenMenuId(null)
    }
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (openMenuId && !(event.target as Element).closest('.dropdown-menu')) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenuId])

  return (
    <div className="max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('teamMembers')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('manageTeamDesc')}</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <UserPlus className="h-5 w-5" />
          {t('inviteUser')}
        </button>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">{t('inviteNewUser')}</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('email')}
                </label>
                <input
                  type="email"
                  value={inviteData.email}
                  onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                  placeholder="user@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('role')}
                </label>
                <select
                  value={inviteData.role}
                  onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="viewer">{t('roleViewer')}</option>
                  <option value="operator">{t('roleOperator')}</option>
                  <option value="admin">{t('roleAdmin')}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowInvite(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleInvite}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('sendInvite')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('user')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('role')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('status')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('joined')}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {t('actions')}
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {team.map((member) => (
              <tr key={member.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <span className="text-blue-600 font-medium">
                        {member.name.charAt(0)}
                      </span>
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{member.name}</div>
                      <div className="text-sm text-gray-500">{member.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadge(member.role)}`}>
                    {member.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(member.status)}`}>
                    {member.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(member.joinedAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="relative dropdown-menu">
                    <button
                      onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                      disabled={actionLoading === member.id}
                      className="text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-50"
                    >
                      {actionLoading === member.id ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400"></div>
                      ) : (
                        <MoreVertical className="h-5 w-5" />
                      )}
                    </button>
                    
                    {openMenuId === member.id && (
                      <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                        <div className="py-1">
                          <button
                            onClick={() => handleEdit(member)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <Edit className="h-4 w-4" />
                            {t('editUser')}
                          </button>
                          
                          <button
                            onClick={() => handleResetPassword(member)}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                          >
                            <Mail className="h-4 w-4" />
                            {t('resetPassword')}
                          </button>
                          
                          {member.status === 'active' ? (
                            <button
                              onClick={() => handleDeactivate(member)}
                              disabled={member.id === currentUser?.id}
                              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Trash2 className="h-4 w-4" />
                              {t('deactivateUser')}
                            </button>
                          ) : (
                            <button
                              onClick={() => handleActivate(member)}
                              className="w-full text-left px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                              {t('activateUser')}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit User Modal */}
      {showEditModal && selectedMember && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{t('editUser')}</h3>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedMember(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('email')}
                </label>
                <input
                  type="email"
                  value={selectedMember.email}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('role')}
                </label>
                <select
                  value={selectedMember.role}
                  onChange={(e) => {
                    if (selectedMember) {
                      setSelectedMember({ ...selectedMember, role: e.target.value })
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="viewer">{t('roleViewer')}</option>
                  <option value="operator">{t('roleOperator')}</option>
                  <option value="admin">{t('roleAdmin')}</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setSelectedMember(null)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                {t('cancel')}
              </button>
              <button
                onClick={async () => {
                  if (!selectedMember || !currentTenant) return
                  
                  try {
                    const result = await updateUser(selectedMember.id, currentTenant.tenant_id, {
                      role: selectedMember.role as 'admin' | 'operator' | 'viewer',
                    })
                    
                    if (result.success) {
                      setTeam(team.map(m => 
                        m.id === selectedMember.id 
                          ? { ...m, role: selectedMember.role }
                          : m
                      ))
                      setShowEditModal(false)
                      setSelectedMember(null)
                      alert(t('saveSuccess'))
                    } else {
                      alert(result.message || 'Failed to update user')
                    }
                  } catch (error) {
                    console.error('Error updating user:', error)
                    alert('Failed to update user')
                  }
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {t('saveChanges')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roles Info */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          {t('rolesPermissions')}
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• <strong>{t('roleAdmin')}:</strong> {t('roleAdminDesc')}</li>
          <li>• <strong>{t('roleOperator')}:</strong> {t('roleOperatorDesc')}</li>
          <li>• <strong>{t('roleViewer')}:</strong> {t('roleViewerDesc')}</li>
        </ul>
      </div>
    </div>
  )
}

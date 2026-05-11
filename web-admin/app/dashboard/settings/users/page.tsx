'use client'

/**
 * Users Settings Page — team list, invite, and role updates via platform-api (rbacFetch).
 */

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { UserPlus, Mail, Shield, MoreVertical, Trash2, Edit, CheckCircle2 } from 'lucide-react'
import { useAuth } from '@/lib/auth/auth-context'
import {
  fetchUsers,
  createUser,
  updateUser,
  deactivateUser,
  activateUser,
  type TenantUser,
} from '@/lib/api/users'
import { CmxButton, CmxInput, CmxSelect, Label } from '@ui/primitives'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogClose,
} from '@ui/overlays'
import { cmxMessage } from '@ui/feedback'

interface TeamMember {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'pending' | 'inactive'
  joinedAt: string
}

const ROLE_OPTIONS = [
  { value: 'viewer', labelKey: 'roleViewer' as const },
  { value: 'operator', labelKey: 'roleOperator' as const },
  { value: 'admin', labelKey: 'roleAdmin' as const },
]

function mapTenantUserToMember(u: TenantUser): TeamMember {
  const name =
    (u.display_name && u.display_name.trim()) ||
    [u.first_name, u.last_name].filter(Boolean).join(' ').trim() ||
    u.email

  return {
    id: u.id,
    name,
    email: u.email,
    role: u.role || 'viewer',
    status: u.is_active ? 'active' : 'inactive',
    joinedAt: u.created_at,
  }
}

function generateSecurePassword(length = 24): string {
  const alphabet =
    'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*-_'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

export default function UsersSettingsPage() {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
  const { currentTenant, user: currentUser, session } = useAuth()
  const accessToken = session?.access_token ?? ''

  const [team, setTeam] = useState<TeamMember[]>([])
  const [listLoading, setListLoading] = useState(true)
  const [listError, setListError] = useState<string | null>(null)

  const [showInvite, setShowInvite] = useState(false)
  const [inviteData, setInviteData] = useState({ email: '', role: 'operator' })
  const [inviteSubmitting, setInviteSubmitting] = useState(false)

  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [confirm, setConfirm] = useState<{
    kind: 'deactivate' | 'activate'
    member: TeamMember
  } | null>(null)

  const roleSelectOptions = ROLE_OPTIONS.map((r) => ({
    value: r.value,
    label: t(r.labelKey),
  }))

  const isSelfMember = (member: TeamMember) =>
    member.email.toLowerCase() === (currentUser?.email ?? '').toLowerCase()

  const loadTeam = useCallback(async () => {
    if (!currentTenant || !accessToken) {
      setTeam([])
      setListLoading(false)
      return
    }
    setListLoading(true)
    setListError(null)
    try {
      const res = await fetchUsers(currentTenant.tenant_id, {}, 1, 200, accessToken)
      setTeam(res.data.map(mapTenantUserToMember))
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'load failed'
      setListError(msg)
      cmxMessage.error(t('teamLoadError'))
    } finally {
      setListLoading(false)
    }
  }, [currentTenant, accessToken, t])

  useEffect(() => {
    void loadTeam()
  }, [loadTeam])

  const handleInvite = async () => {
    if (!currentTenant || !accessToken) return
    const email = inviteData.email.trim().toLowerCase()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      cmxMessage.error(t('inviteInvalidEmail'))
      return
    }
    setInviteSubmitting(true)
    try {
      const displayName = email.split('@')[0] || email
      const result = await createUser(
        currentTenant.tenant_id,
        {
          email,
          password: generateSecurePassword(28),
          display_name: displayName,
          role: inviteData.role,
        },
        accessToken
      )
      if (result.success) {
        cmxMessage.success(t('inviteSuccess'))
        setShowInvite(false)
        setInviteData({ email: '', role: 'operator' })
        await loadTeam()
      } else {
        cmxMessage.error(result.message || t('inviteError'))
      }
    } catch (e) {
      cmxMessage.error(e instanceof Error ? e.message : t('inviteError'))
    } finally {
      setInviteSubmitting(false)
    }
  }

  const getRoleBadge = (role: string) => {
    const colors = {
      admin: 'bg-purple-100 text-purple-800',
      operator: 'bg-blue-100 text-blue-800',
      viewer: 'bg-gray-100 text-gray-800',
    }
    return colors[role as keyof typeof colors] || colors.viewer
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      active: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      inactive: 'bg-gray-100 text-gray-800',
    }
    return colors[status as keyof typeof colors] || colors.inactive
  }

  const handleEdit = (member: TeamMember) => {
    setSelectedMember(member)
    setShowEditModal(true)
    setOpenMenuId(null)
  }

  const handleResetPassword = () => {
    setOpenMenuId(null)
    cmxMessage.info(t('passwordResetUnavailable'), { duration: 8000 })
  }

  const runDeactivate = async (member: TeamMember) => {
    if (!currentTenant || !accessToken) return
    setActionLoading(member.id)
    try {
      const result = await deactivateUser(currentTenant.tenant_id, member.id, accessToken)
      if (result.success) {
        cmxMessage.success(t('userDeactivated'))
        setTeam((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, status: 'inactive' as const } : m))
        )
      } else {
        cmxMessage.error(result.message || t('teamActionError'))
      }
    } catch (e) {
      cmxMessage.error(e instanceof Error ? e.message : t('teamActionError'))
    } finally {
      setActionLoading(null)
      setOpenMenuId(null)
      setConfirm(null)
    }
  }

  const runActivate = async (member: TeamMember) => {
    if (!currentTenant || !accessToken) return
    setActionLoading(member.id)
    try {
      const result = await activateUser(currentTenant.tenant_id, member.id, accessToken)
      if (result.success) {
        cmxMessage.success(t('userActivated'))
        setTeam((prev) =>
          prev.map((m) => (m.id === member.id ? { ...m, status: 'active' as const } : m))
        )
      } else {
        cmxMessage.error(result.message || t('teamActionError'))
      }
    } catch (e) {
      cmxMessage.error(e instanceof Error ? e.message : t('teamActionError'))
    } finally {
      setActionLoading(null)
      setOpenMenuId(null)
      setConfirm(null)
    }
  }

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">{t('teamMembers')}</h2>
          <p className="text-sm text-gray-500 mt-1">{t('manageTeamDesc')}</p>
        </div>
        <CmxButton
          onClick={() => setShowInvite(true)}
          disabled={!currentTenant || !accessToken}
          className="w-full sm:w-auto"
        >
          <UserPlus className="h-5 w-5 me-2" />
          {t('inviteUser')}
        </CmxButton>
      </div>

      {listError && (
        <p className="text-sm text-red-600 mb-4" role="alert">
          {listError}
        </p>
      )}

      <CmxDialog open={showInvite} onOpenChange={(o) => !inviteSubmitting && setShowInvite(o)}>
        <CmxDialogContent className="max-w-md w-full mx-4">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('inviteNewUser')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">{t('invitePasswordHint')}</p>
            <div>
              <Label htmlFor="invite-email">{t('email')}</Label>
              <CmxInput
                id="invite-email"
                type="email"
                value={inviteData.email}
                onChange={(e) => setInviteData({ ...inviteData, email: e.target.value })}
                className="mt-1"
                autoComplete="off"
              />
            </div>
            <CmxSelect
              id="invite-role"
              label={t('role')}
              options={roleSelectOptions}
              value={inviteData.role}
              onChange={(e) => setInviteData({ ...inviteData, role: e.target.value })}
            />
          </div>
          <CmxDialogFooter className="gap-2 sm:gap-0">
            <CmxDialogClose asChild>
              <CmxButton variant="outline" type="button" disabled={inviteSubmitting}>
                {tCommon('cancel')}
              </CmxButton>
            </CmxDialogClose>
            <CmxButton
              type="button"
              loading={inviteSubmitting}
              disabled={inviteSubmitting}
              onClick={() => void handleInvite()}
            >
              {t('sendInvite')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog
        open={showEditModal}
        onOpenChange={(o) => {
          setShowEditModal(o)
          if (!o) setSelectedMember(null)
        }}
      >
        <CmxDialogContent className="max-w-md w-full mx-4">
          {selectedMember && (
            <>
              <CmxDialogHeader>
                <CmxDialogTitle>{t('editUser')}</CmxDialogTitle>
              </CmxDialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="edit-email">{t('email')}</Label>
                  <CmxInput id="edit-email" value={selectedMember.email} disabled className="mt-1" />
                  <p className="text-xs text-gray-500 mt-1">{t('emailReadOnlyHint')}</p>
                </div>
                <CmxSelect
                  id="edit-role"
                  label={t('role')}
                  options={roleSelectOptions}
                  value={selectedMember.role}
                  onChange={(e) =>
                    setSelectedMember({ ...selectedMember, role: e.target.value })
                  }
                />
              </div>
              <CmxDialogFooter className="gap-2 sm:gap-0">
                <CmxButton
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setShowEditModal(false)
                    setSelectedMember(null)
                  }}
                >
                  {tCommon('cancel')}
                </CmxButton>
                <CmxButton
                  type="button"
                  disabled={!currentTenant || !accessToken}
                  onClick={async () => {
                    if (!selectedMember || !currentTenant || !accessToken) return
                    try {
                      const result = await updateUser(
                        currentTenant.tenant_id,
                        selectedMember.id,
                        { role: selectedMember.role },
                        accessToken
                      )
                      if (result.success) {
                        cmxMessage.success(t('userUpdateSuccess'))
                        setTeam((prev) =>
                          prev.map((m) =>
                            m.id === selectedMember.id
                              ? { ...m, role: selectedMember.role }
                              : m
                          )
                        )
                        setShowEditModal(false)
                        setSelectedMember(null)
                      } else {
                        cmxMessage.error(result.message || t('teamActionError'))
                      }
                    } catch (e) {
                      cmxMessage.error(e instanceof Error ? e.message : t('teamActionError'))
                    }
                  }}
                >
                  {t('saveChanges')}
                </CmxButton>
              </CmxDialogFooter>
            </>
          )}
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog
        open={!!confirm}
        onOpenChange={(o) => {
          if (!o) setConfirm(null)
        }}
      >
        <CmxDialogContent className="max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>
              {confirm?.kind === 'deactivate' ? t('deactivateUser') : t('activateUser')}
            </CmxDialogTitle>
          </CmxDialogHeader>
          <p className="text-sm text-gray-600">
            {confirm?.kind === 'deactivate'
              ? t('confirmDeactivateMember', { email: confirm.member.email })
              : t('confirmActivateMember', { email: confirm?.member.email ?? '' })}
          </p>
          <CmxDialogFooter>
            <CmxButton variant="outline" type="button" onClick={() => setConfirm(null)}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton
              type="button"
              variant={confirm?.kind === 'deactivate' ? 'destructive' : 'primary'}
              onClick={() => {
                if (!confirm) return
                if (confirm.kind === 'deactivate') void runDeactivate(confirm.member)
                else void runActivate(confirm.member)
              }}
            >
              {tCommon('confirm')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {listLoading ? (
          <div className="p-8 text-center text-sm text-gray-500">{tCommon('loading')}</div>
        ) : team.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-500">{tCommon('noData')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('user')}
                  </th>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('role')}
                  </th>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('status')}
                  </th>
                  <th className="px-6 py-3 text-start text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {t('joined')}
                  </th>
                  <th className="px-6 py-3 text-end text-xs font-medium text-gray-500 uppercase tracking-wider">
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
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="ms-4">
                          <div className="text-sm font-medium text-gray-900">{member.name}</div>
                          <div className="text-sm text-gray-500">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getRoleBadge(member.role)}`}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(member.status)}`}
                      >
                        {member.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(member.joinedAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-end text-sm font-medium">
                      <div className="relative dropdown-menu inline-block text-start">
                        <button
                          type="button"
                          onClick={() => setOpenMenuId(openMenuId === member.id ? null : member.id)}
                          disabled={actionLoading === member.id}
                          className="text-gray-400 hover:text-gray-600 focus:outline-none disabled:opacity-50"
                          aria-expanded={openMenuId === member.id}
                          aria-haspopup="true"
                        >
                          {actionLoading === member.id ? (
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-400" />
                          ) : (
                            <MoreVertical className="h-5 w-5" />
                          )}
                        </button>

                        {openMenuId === member.id && (
                          <div className="absolute end-0 mt-2 w-48 bg-white rounded-md shadow-lg z-20 border border-gray-200">
                            <div className="py-1">
                              <button
                                type="button"
                                onClick={() => handleEdit(member)}
                                className="w-full text-start px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Edit className="h-4 w-4" />
                                {t('editUser')}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleResetPassword()}
                                className="w-full text-start px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                              >
                                <Mail className="h-4 w-4" />
                                {t('resetPassword')}
                              </button>

                              {member.status === 'active' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (isSelfMember(member)) {
                                      cmxMessage.warning(t('cannotDeactivateSelf'))
                                      setOpenMenuId(null)
                                      return
                                    }
                                    setOpenMenuId(null)
                                    setConfirm({ kind: 'deactivate', member })
                                  }}
                                  disabled={isSelfMember(member)}
                                  className="w-full text-start px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {t('deactivateUser')}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null)
                                    setConfirm({ kind: 'activate', member })
                                  }}
                                  className="w-full text-start px-4 py-2 text-sm text-green-600 hover:bg-green-50 flex items-center gap-2"
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
        )}
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
          <Shield className="h-4 w-4" />
          {t('rolesPermissions')}
        </h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>
            • <strong>{t('roleAdmin')}:</strong> {t('roleAdminDesc')}
          </li>
          <li>
            • <strong>{t('roleOperator')}:</strong> {t('roleOperatorDesc')}
          </li>
          <li>
            • <strong>{t('roleViewer')}:</strong> {t('roleViewerDesc')}
          </li>
        </ul>
      </div>
    </div>
  )
}

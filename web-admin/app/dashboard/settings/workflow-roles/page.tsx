'use client'

/**
 * Workflow Roles Management Page
 *
 * Features:
 * - View all users and their workflow roles
 * - Assign workflow roles to users
 * - Remove workflow roles from users
 * - Multi-role support (users can have multiple workflow roles)
 */

import { useState, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { UserPlus, Shield, X, CheckCircle2 } from 'lucide-react'
import {
  getUsersWithWorkflowRoles,
  assignWorkflowRoleToUser,
  removeWorkflowRoleFromUser,
} from '@/lib/api/workflow-roles'
import type { UserWithWorkflowRoles, User } from '@/lib/api/workflow-roles'
import { RequirePermission } from '@/components/auth/RequirePermission'
import { useAuth } from '@/lib/auth/auth-context'

const WORKFLOW_ROLES = [
  { code: 'ROLE_RECEPTION', name: 'Reception', name2: 'الاستقبال', description: 'Order intake & delivery' },
  { code: 'ROLE_PREPARATION', name: 'Preparation', name2: 'التحضير', description: 'Item tagging & prep' },
  { code: 'ROLE_PROCESSING', name: 'Processing', name2: 'المعالجة', description: 'Wash, dry, iron' },
  { code: 'ROLE_QA', name: 'Quality Assurance', name2: 'الفحص', description: 'Quality inspection' },
  { code: 'ROLE_DELIVERY', name: 'Delivery', name2: 'التسليم', description: 'Delivery operations' },
  { code: 'ROLE_ADMIN', name: 'Workflow Admin', name2: 'مدير سير العمل', description: 'Full workflow access' },
]

export default function WorkflowRolesPage() {
  const t = useTranslations('settings')
  const { currentTenant } = useAuth()
  const [users, setUsers] = useState<UserWithWorkflowRoles[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedUser, setSelectedUser] = useState<UserWithWorkflowRoles | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false)

  useEffect(() => {
    if (currentTenant) {
      loadUsers()
    }
  }, [currentTenant])

  const loadUsers = async () => {
    if (!currentTenant) return

    try {
      setLoading(true)
      const usersWithRoles = await getUsersWithWorkflowRoles()
      setUsers(usersWithRoles)
    } catch (error) {
      console.error('Error loading users:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAssignRole = async (userId: string, workflowRole: string) => {
    if (!currentTenant) return

    try {
      await assignWorkflowRoleToUser({
        user_id: userId,
        workflow_role: workflowRole,
      })
      await loadUsers()
      setShowAssignModal(false)
      setSelectedUser(null)
    } catch (error) {
      console.error('Error assigning workflow role:', error)
      alert('Failed to assign workflow role')
    }
  }

  const handleRemoveRole = async (assignmentId: string) => {
    try {
      await removeWorkflowRoleFromUser(assignmentId)
      await loadUsers()
    } catch (error) {
      console.error('Error removing workflow role:', error)
      alert('Failed to remove workflow role')
    }
  }

  const getUserRoles = (user: UserWithWorkflowRoles): string[] => {
    return user.workflow_roles?.map(a => a.workflow_role) || []
  }

  if (loading) {
    return (
      <RequirePermission permission="settings:workflow_roles:view">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </RequirePermission>
    )
  }

  return (
    <RequirePermission permission="settings:workflow_roles:view">
      <div className="max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {t('workflowRoles.title', { defaultValue: 'Workflow Roles' })}
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              {t('workflowRoles.description', { defaultValue: 'Manage workflow role assignments for users' })}
            </p>
          </div>
        </div>

        {/* Users List */}
        <div className="bg-white shadow overflow-hidden rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workflow Roles
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.display_name || user.email}
                      </div>
                      <div className="text-sm text-gray-500">{user.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      {getUserRoles(user).length === 0 ? (
                        <span className="text-sm text-gray-400">No workflow roles assigned</span>
                      ) : (
                        getUserRoles(user).map((roleCode) => {
                          const role = WORKFLOW_ROLES.find(r => r.code === roleCode)
                          const assignment = user.workflow_roles?.find(a => a.workflow_role === roleCode)
                          return (
                            <span
                              key={roleCode}
                              className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                            >
                              <Shield className="h-3 w-3" />
                              {role?.name || roleCode}
                              <button
                                onClick={() => {
                                  if (assignment) {
                                    handleRemoveRole(assignment.id)
                                  }
                                }}
                                className="ml-1 hover:text-red-600"
                                title="Remove role"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          )
                        })
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => {
                        setSelectedUser(user)
                        setShowAssignModal(true)
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      Assign Roles
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Assign Modal */}
        {showAssignModal && selectedUser && (
          <AssignWorkflowRoleModal
            user={selectedUser}
            currentRoles={getUserRoles(selectedUser)}
            onAssign={handleAssignRole}
            onClose={() => {
              setShowAssignModal(false)
              setSelectedUser(null)
            }}
          />
        )}
      </div>
    </RequirePermission>
  )
}

// Assign Workflow Role Modal
function AssignWorkflowRoleModal({
  user,
  currentRoles,
  onAssign,
  onClose,
}: {
  user: UserWithWorkflowRoles
  currentRoles: string[]
  onAssign: (userId: string, role: string) => void
  onClose: () => void
}) {
  const handleAssign = (roleCode: string) => {
    onAssign(user.id, roleCode)
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Assign Workflow Roles to {user.display_name || user.email}
        </h3>

        <div className="space-y-3 mb-6">
          {WORKFLOW_ROLES.map((role) => {
            const isAssigned = currentRoles.includes(role.code)
            return (
              <div
                key={role.code}
                className={`flex items-center justify-between p-4 border rounded-lg ${
                  isAssigned ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {isAssigned ? (
                    <CheckCircle2 className="h-5 w-5 text-blue-600" />
                  ) : (
                    <div className="h-5 w-5 border-2 border-gray-300 rounded-full" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{role.name}</div>
                    {role.name2 && <div className="text-sm text-gray-500">{role.name2}</div>}
                    <div className="text-xs text-gray-400 mt-1">{role.description}</div>
                  </div>
                </div>
                <button
                  onClick={() => handleAssign(role.code)}
                  disabled={isAssigned}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    isAssigned
                      ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {isAssigned ? 'Assigned' : 'Assign'}
                </button>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

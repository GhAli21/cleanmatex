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
import { RBAC_CATALOG_TENANT_WRITABLE } from '@/lib/constants/rbac-catalog'
import { Plus, Shield, Edit, Trash2, Key, AlertCircle, X } from 'lucide-react'
import {
  CmxButton,
  CmxInput,
  CmxTextarea,
  Label,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@ui/primitives'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays'
import { CmxConfirmDialog, CmxStatusBadge } from '@ui/feedback'
import {
  getAllRoles,
  getRoleByCode,
  createCustomRole,
  updateCustomRole,
  deleteCustomRole,
} from '@/lib/api/roles'
import PermissionAssignmentModal from '@features/auth/ui/PermissionAssignmentModal'
import { useAuth } from '@/lib/auth/auth-context'
import { evaluateAccessRequirement } from '@/lib/auth/access-contracts'
import type { TenantRole } from '@/lib/api/roles'
import { SETTINGS_ROLES_ACCESS } from '@features/settings/access/settings-access'
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { SETTINGS_SETTINGS_ROLES_ACCESS } from '@features/settings/access/settings-access'

/**
 *
 */
export default function RolesManagementPage() {
  const t = useTranslations('settings')
  const tCommon = useTranslations('common')
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
  const isAdmin = evaluateAccessRequirement(SETTINGS_ROLES_ACCESS.page, {
    userPermissions: permissions ?? [],
    userTenantRole: currentTenant?.user_role ?? null,
    featureFlags: {},
  }).passed

  if (loading) {
    return (
    <RequireAnyPermission permissions={SETTINGS_SETTINGS_ROLES_ACCESS.page.permissions ?? []}>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    </RequireAnyPermission>
  )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64 bg-card rounded-lg shadow">
        <div className="text-center">
          <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">{t('roles.accessDeniedTitle')}</h3>
          <p className="text-muted-foreground">{t('roles.accessDeniedDescription')}</p>
          <p className="text-sm text-muted-foreground mt-2">{t('roles.adminRequired')}</p>
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
          <h1 className="text-2xl font-bold text-foreground">
            {t('roles.title', { defaultValue: 'Roles Management' })}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('roles.description', { defaultValue: 'Manage roles and permissions for your organization' })}
          </p>
        </div>
        {RBAC_CATALOG_TENANT_WRITABLE && (
        <CmxButton
          type="button"
          variant="primary"
          size="sm"
          onClick={() => {
            setFormData({ code: '', name: '', name2: '', description: '' })
            setActionError(null)
            setShowCreateModal(true)
          }}
        >
          <Plus className="h-4 w-4 me-2" />
          {t('roles.create', { defaultValue: 'Create Role' })}
        </CmxButton>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-foreground tabular-nums">{roles.length}</div>
          <div className="text-sm text-muted-foreground">{t('roles.totalRoles')}</div>
        </div>
        <div className="bg-card rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-primary-text tabular-nums">{systemRoles.length}</div>
          <div className="text-sm text-muted-foreground">{t('systemRoles')}</div>
        </div>
        <div className="bg-card rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-success-text tabular-nums">{customRoles.length}</div>
          <div className="text-sm text-muted-foreground">{t('customRoles')}</div>
        </div>
      </div>

      {!RBAC_CATALOG_TENANT_WRITABLE && (
        <div className="rounded-md border border-info-border bg-info-bg p-3 text-sm text-info-text" role="note">
          {t('catalogReadOnly')}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-danger-bg border border-danger-border rounded-lg p-4 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-danger-text shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-danger-text">{error}</p>
          </div>
          <CmxButton type="button" variant="ghost" size="xs" onClick={() => setError(null)} className="text-danger-text hover:text-danger-text/80" aria-label={t('roles.dismissError')}>
            <X className="h-4 w-4" />
          </CmxButton>
        </div>
      )}

      {/* Roles Table */}
      <div className="bg-card shadow overflow-hidden rounded-lg">
        <Table className="min-w-full divide-y divide-border">
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('role')}
              </TableHead>
              <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('roles.code')}
              </TableHead>
              <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('roles.type')}
              </TableHead>
              <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('permissions')}
              </TableHead>
              <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {t('roles.users')}
              </TableHead>
              <TableHead className="px-6 py-3 text-end text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {tCommon('actions')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-card divide-y divide-border">
            {roles.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  {t('roles.noRolesFound')}
                </TableCell>
              </TableRow>
            ) : (
              roles.map((role) => (
                <TableRow key={role.code} className="hover:bg-muted">
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Shield className="h-5 w-5 text-muted-foreground me-3 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-foreground">{role.name}</div>
                        {role.name2 && (
                          <div className="text-sm text-muted-foreground">{role.name2}</div>
                        )}
                        {role.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">
                            {role.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <bdi dir="ltr" className="px-2 inline-flex text-xs leading-5 font-mono font-semibold rounded-full bg-muted text-foreground">
                      {role.code}
                    </bdi>
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    {role.is_system ? (
                      <CmxStatusBadge size="sm" tone="info">{t('systemPermission')}</CmxStatusBadge>
                    ) : (
                      <CmxStatusBadge size="sm" tone="success">{t('customPermission')}</CmxStatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                    {role.permission_count ?? '—'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                    {role.user_count ?? '—'}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-end text-sm font-medium">
                    {RBAC_CATALOG_TENANT_WRITABLE && (
                    <div className="flex items-center justify-end gap-2">
                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleManagePermissions(role)}
                        className="text-primary-text hover:text-primary-text/80 h-8 w-8"
                        aria-label={t('roles.managePermissions')}
                        title={t('roles.managePermissions')}
                      >
                        <Key className="h-4 w-4" />
                      </CmxButton>
                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(role)}
                        className="text-primary-text hover:text-primary-text/80 h-8 w-8"
                        disabled={role.is_system}
                        aria-label={role.is_system ? t('roles.cannotEditSystemRole') : t('roles.editTitle')}
                        title={role.is_system ? t('roles.cannotEditSystemRole') : t('roles.editTitle')}
                      >
                        <Edit className="h-4 w-4" />
                      </CmxButton>
                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmRole(role)}
                        className="text-danger-text hover:text-danger-text/80 h-8 w-8"
                        disabled={role.is_system || (role.user_count !== undefined && role.user_count > 0)}
                        aria-label={t('roles.deleteRole')}
                        title={
                          role.is_system
                            ? t('roles.cannotDeleteSystemRole')
                            : role.user_count && role.user_count > 0
                            ? t('roles.cannotDeleteRoleWithUsers')
                            : t('roles.deleteRole')
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </CmxButton>
                    </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Modal */}
      <CmxDialog open={showCreateModal} onOpenChange={(next) => { if (!next && !saving) setShowCreateModal(false) }}>
        <CmxDialogContent className="max-w-md w-full p-6">
          <CmxDialogHeader className="mb-4">
            <CmxDialogTitle>
              {t('roles.createTitle', { defaultValue: 'Create New Role' })}
            </CmxDialogTitle>
          </CmxDialogHeader>
          {actionError && (
            <div className="mb-4 p-3 bg-danger-bg border border-danger-border rounded-md text-sm text-danger-text">
              {actionError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <Label htmlFor="role-create-code" className="mb-1 block">{t('roles.code')} *</Label>
              <CmxInput
                id="role-create-code"
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                placeholder={t('roles.codePlaceholder')}
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="role-create-name" className="mb-1 block">{t('roles.nameEn')} *</Label>
              <CmxInput
                id="role-create-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('roles.namePlaceholder')}
              />
            </div>
            <div>
              <Label htmlFor="role-create-name2" className="mb-1 block">{t('roles.nameAr')}</Label>
              <CmxInput
                id="role-create-name2"
                type="text"
                dir="rtl"
                value={formData.name2}
                onChange={(e) => setFormData({ ...formData, name2: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="role-create-desc" className="mb-1 block">{t('roles.descriptionLabel')}</Label>
              <CmxTextarea
                id="role-create-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <CmxDialogFooter className="mt-6">
            <CmxButton type="button" variant="outline" onClick={() => setShowCreateModal(false)} disabled={saving}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton type="button" variant="primary" onClick={handleCreate} loading={saving} disabled={saving}>
              {tCommon('create')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      {/* Edit Modal */}
      <CmxDialog
        open={Boolean(showEditModal && selectedRole)}
        onOpenChange={(next) => { if (!next && !saving) setShowEditModal(false) }}
      >
        <CmxDialogContent className="max-w-md w-full p-6">
          <CmxDialogHeader className="mb-4">
            <CmxDialogTitle>
              {t('roles.editTitle', { defaultValue: 'Edit Role' })}
            </CmxDialogTitle>
          </CmxDialogHeader>
          {actionError && (
            <div className="mb-4 p-3 bg-danger-bg border border-danger-border rounded-md text-sm text-danger-text">
              {actionError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <Label htmlFor="role-edit-code" className="mb-1 block">{t('roles.code')}</Label>
              <CmxInput
                id="role-edit-code"
                type="text"
                value={formData.code}
                disabled
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground mt-1">{t('roles.codeImmutable')}</p>
            </div>
            <div>
              <Label htmlFor="role-edit-name" className="mb-1 block">{t('roles.nameEn')} *</Label>
              <CmxInput
                id="role-edit-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="role-edit-name2" className="mb-1 block">{t('roles.nameAr')}</Label>
              <CmxInput
                id="role-edit-name2"
                type="text"
                dir="rtl"
                value={formData.name2}
                onChange={(e) => setFormData({ ...formData, name2: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="role-edit-desc" className="mb-1 block">{t('roles.descriptionLabel')}</Label>
              <CmxTextarea
                id="role-edit-desc"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <CmxDialogFooter className="mt-6">
            <CmxButton type="button" variant="outline" onClick={() => setShowEditModal(false)} disabled={saving}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton type="button" variant="primary" onClick={handleUpdate} loading={saving} disabled={saving}>
              {tCommon('update')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      {/* Delete Confirmation Modal */}
      <CmxConfirmDialog
        open={Boolean(deleteConfirmRole)}
        title={t('roles.deleteRole')}
        description={
          deleteConfirmRole
            ? t('roles.deleteRoleConfirm', { name: deleteConfirmRole.name })
            : undefined
        }
        confirmLabel={tCommon('delete')}
        cancelLabel={tCommon('cancel')}
        confirmDisabled={saving}
        onConfirm={handleDeleteConfirm}
        onCancel={() => { if (!saving) setDeleteConfirmRole(null) }}
      />

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

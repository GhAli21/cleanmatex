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
import { useTranslations } from 'next-intl'
import { RBAC_CATALOG_TENANT_WRITABLE } from '@/lib/constants/rbac-catalog'
import { Plus, Lock, Edit, Trash2, AlertCircle, X, Search } from 'lucide-react'
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
  getPermissionsByCategory,
  createPermission,
  updatePermission,
  deletePermission,
  isValidPermissionCode,
} from '@/lib/api/permissions'
import { useAuth } from '@/lib/auth/auth-context'
import { evaluateAccessRequirement } from '@/lib/auth/access-contracts'
import type { TenantPermission, PermissionsByCategory } from '@/lib/api/permissions'
import { SETTINGS_PERMISSIONS_ACCESS } from '@features/settings/access/settings-access'
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { SETTINGS_SETTINGS_PERMISSIONS_ACCESS } from '@features/settings/access/settings-access'

/**
 *
 */
export default function PermissionsManagementPage() {
  const t = useTranslations('settings')
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
  const isAdmin = evaluateAccessRequirement(SETTINGS_PERMISSIONS_ACCESS.page, {
    userPermissions: permissions ?? [],
    userTenantRole: currentTenant?.user_role ?? null,
    featureFlags: {},
  }).passed

  if (loading) {
    return (
    <RequireAnyPermission permissions={SETTINGS_SETTINGS_PERMISSIONS_ACCESS.page.permissions ?? []}>
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
          <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">Access Denied</h3>
          <p className="text-muted-foreground">You don&apos;t have permission to view permissions management.</p>
          <p className="text-sm text-muted-foreground mt-2">Admin access required.</p>
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
          <h1 className="text-2xl font-bold text-foreground">Permissions Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View and manage permissions for your organization
          </p>
        </div>
        {RBAC_CATALOG_TENANT_WRITABLE && (
        <CmxButton
          type="button"
          variant="primary"
          size="sm"
          onClick={() => {
            setCreateForm({ code: '', name: '', name2: '', category: '', description: '', description2: '' })
            setActionError(null)
            setShowCreateModal(true)
          }}
        >
          <Plus className="h-4 w-4 me-2" />
          Create Permission
        </CmxButton>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-foreground tabular-nums">{allPermissions.length}</div>
          <div className="text-sm text-muted-foreground">Total Permissions</div>
        </div>
        <div className="bg-card rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-primary-text tabular-nums">{systemCount}</div>
          <div className="text-sm text-muted-foreground">System Permissions</div>
        </div>
        <div className="bg-card rounded-lg shadow p-4">
          <div className="text-2xl font-bold text-success-text tabular-nums">{customCount}</div>
          <div className="text-sm text-muted-foreground">Custom Permissions</div>
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
          <CmxButton type="button" variant="ghost" size="xs" onClick={() => setError(null)} className="text-danger-text hover:text-danger-text/80" aria-label="Dismiss error">
            <X className="h-4 w-4" />
          </CmxButton>
        </div>
      )}

      {/* Search bar */}
      <CmxInput
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        placeholder="Search permissions by code, name, or category..."
        leftIcon={<Search className="h-5 w-5" />}
      />

      {/* Category Tabs */}
      <div className="border-b border-border">
        <nav className="-mb-px flex space-x-4 overflow-x-auto">
          <CmxButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setSelectedCategory('all')}
            className={`rounded-none py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap tabular-nums ${
              selectedCategory === 'all'
                ? 'border-primary text-primary-text'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            }`}
          >
            All ({allPermissions.length})
          </CmxButton>
          {categories.map((cat) => (
            <CmxButton
              key={cat}
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-none py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap tabular-nums ${
                selectedCategory === cat
                  ? 'border-primary text-primary-text'
                  : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {cat} ({(permissionsByCategory[cat] ?? []).length})
            </CmxButton>
          ))}
        </nav>
      </div>

      {/* Permissions Table */}
      <div className="bg-card shadow overflow-hidden rounded-lg">
        <Table className="min-w-full divide-y divide-border">
          <TableHeader className="bg-muted">
            <TableRow>
              <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Code
              </TableHead>
              <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Name (EN / AR)
              </TableHead>
              <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Category
              </TableHead>
              <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Used By
              </TableHead>
              <TableHead className="px-6 py-3 text-start text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Type
              </TableHead>
              <TableHead className="px-6 py-3 text-end text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="bg-card divide-y divide-border">
            {filteredPermissions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="px-6 py-12 text-center text-muted-foreground">
                  {searchQuery ? 'No permissions match your search.' : 'No permissions found.'}
                </TableCell>
              </TableRow>
            ) : (
              filteredPermissions.map((permission) => (
                <TableRow key={permission.code} className="hover:bg-muted">
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    <bdi dir="ltr" className="px-2 inline-flex text-xs leading-5 font-mono font-semibold rounded-full bg-muted text-foreground">
                      {permission.code}
                    </bdi>
                  </TableCell>
                  <TableCell className="px-6 py-4">
                    <div className="text-sm font-medium text-foreground">{permission.name}</div>
                    {permission.name2 && (
                      <div className="text-sm text-muted-foreground text-end" dir="rtl">
                        {permission.name2}
                      </div>
                    )}
                    {permission.description && (
                      <div className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">
                        {permission.description}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {permission.category}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground tabular-nums">
                    {permission.role_count ?? '—'} role{permission.role_count !== 1 ? 's' : ''}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap">
                    {permission.is_system ? (
                      <CmxStatusBadge size="sm" tone="info">System</CmxStatusBadge>
                    ) : (
                      <CmxStatusBadge size="sm" tone="success">Custom</CmxStatusBadge>
                    )}
                  </TableCell>
                  <TableCell className="px-6 py-4 whitespace-nowrap text-end text-sm font-medium">
                    {RBAC_CATALOG_TENANT_WRITABLE && (
                    <div className="flex items-center justify-end gap-2">
                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(permission)}
                        className="text-primary-text hover:text-primary-text/80 h-8 w-8"
                        disabled={permission.is_system}
                        aria-label={permission.is_system ? 'System permissions cannot be edited' : 'Edit Permission'}
                        title={permission.is_system ? 'System permissions cannot be edited' : 'Edit Permission'}
                      >
                        <Edit className="h-4 w-4" />
                      </CmxButton>
                      <CmxButton
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirmPermission(permission)}
                        className="text-danger-text hover:text-danger-text/80 h-8 w-8"
                        disabled={
                          permission.is_system ||
                          (permission.role_count !== undefined && permission.role_count > 0)
                        }
                        aria-label="Delete Permission"
                        title={
                          permission.is_system
                            ? 'System permissions cannot be deleted'
                            : permission.role_count && permission.role_count > 0
                            ? 'Cannot delete permission used by roles'
                            : 'Delete Permission'
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
        <CmxDialogContent className="max-w-md w-full p-6" scrollBody>
          <CmxDialogHeader className="mb-4">
            <CmxDialogTitle>Create New Permission</CmxDialogTitle>
          </CmxDialogHeader>
          {actionError && (
            <div className="mb-4 p-3 bg-danger-bg border border-danger-border rounded-md text-sm text-danger-text">
              {actionError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <Label htmlFor="perm-create-code" className="mb-1 block">
                Code * <span className="text-muted-foreground text-xs">(format: resource:action)</span>
              </Label>
              <CmxInput
                id="perm-create-code"
                type="text"
                value={createForm.code}
                onChange={(e) =>
                  setCreateForm({ ...createForm, code: e.target.value.toLowerCase() })
                }
                placeholder="e.g. orders:read"
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Only lowercase letters and underscores allowed, separated by colon
              </p>
            </div>
            <div>
              <Label htmlFor="perm-create-name" className="mb-1 block">Name (English) *</Label>
              <CmxInput
                id="perm-create-name"
                type="text"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                placeholder="e.g. Read Orders"
              />
            </div>
            <div>
              <Label htmlFor="perm-create-name2" className="mb-1 block">Name (Arabic)</Label>
              <CmxInput
                id="perm-create-name2"
                type="text"
                dir="rtl"
                value={createForm.name2}
                onChange={(e) => setCreateForm({ ...createForm, name2: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="perm-create-category" className="mb-1 block">Category *</Label>
              <CmxInput
                id="perm-create-category"
                type="text"
                value={createForm.category}
                onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                placeholder="e.g. Orders"
              />
            </div>
            <div>
              <Label htmlFor="perm-create-desc" className="mb-1 block">Description</Label>
              <CmxTextarea
                id="perm-create-desc"
                value={createForm.description}
                onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <CmxDialogFooter className="mt-6">
            <CmxButton type="button" variant="outline" onClick={() => setShowCreateModal(false)} disabled={saving}>
              Cancel
            </CmxButton>
            <CmxButton type="button" variant="primary" onClick={handleCreate} loading={saving} disabled={saving}>
              Create
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      {/* Edit Modal */}
      <CmxDialog
        open={Boolean(showEditModal && selectedPermission)}
        onOpenChange={(next) => { if (!next && !saving) setShowEditModal(false) }}
      >
        <CmxDialogContent className="max-w-md w-full p-6" scrollBody>
          <CmxDialogHeader className="mb-4">
            <CmxDialogTitle>Edit Permission</CmxDialogTitle>
          </CmxDialogHeader>
          {actionError && (
            <div className="mb-4 p-3 bg-danger-bg border border-danger-border rounded-md text-sm text-danger-text">
              {actionError}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <Label htmlFor="perm-edit-code" className="mb-1 block">Code</Label>
              <CmxInput
                id="perm-edit-code"
                type="text"
                value={selectedPermission?.code ?? ''}
                disabled
                dir="ltr"
              />
              <p className="text-xs text-muted-foreground mt-1">Permission code cannot be changed</p>
            </div>
            <div>
              <Label htmlFor="perm-edit-name" className="mb-1 block">Name (English) *</Label>
              <CmxInput
                id="perm-edit-name"
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="perm-edit-name2" className="mb-1 block">Name (Arabic)</Label>
              <CmxInput
                id="perm-edit-name2"
                type="text"
                dir="rtl"
                value={editForm.name2}
                onChange={(e) => setEditForm({ ...editForm, name2: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="perm-edit-category" className="mb-1 block">Category</Label>
              <CmxInput
                id="perm-edit-category"
                type="text"
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="perm-edit-desc" className="mb-1 block">Description</Label>
              <CmxTextarea
                id="perm-edit-desc"
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <CmxDialogFooter className="mt-6">
            <CmxButton type="button" variant="outline" onClick={() => setShowEditModal(false)} disabled={saving}>
              Cancel
            </CmxButton>
            <CmxButton type="button" variant="primary" onClick={handleUpdate} loading={saving} disabled={saving}>
              Update
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      {/* Delete Confirmation Modal */}
      <CmxConfirmDialog
        open={Boolean(deleteConfirmPermission)}
        title="Delete Permission"
        description={
          deleteConfirmPermission
            ? `Are you sure you want to delete the permission "${deleteConfirmPermission.code}"? This action cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        confirmDisabled={saving}
        onConfirm={handleDeleteConfirm}
        onCancel={() => { if (!saving) setDeleteConfirmPermission(null) }}
      />
    </div>
  )
}

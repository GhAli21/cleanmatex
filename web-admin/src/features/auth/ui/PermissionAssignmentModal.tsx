'use client'

/**
 * Permission Assignment Modal
 *
 * Modal for assigning permissions to a role.
 * All data fetched from platform-api via rbacFetch.
 *
 * Features:
 * - Grouped permissions by category
 * - Search/filter functionality
 * - Select all per category
 * - Visual indicators for assigned permissions
 */

import { useState, useEffect, useMemo } from 'react'
import { X, Search, CheckCircle2, Shield, ChevronDown, ChevronRight } from 'lucide-react'
import { getAllPermissions, type TenantPermission } from '@/lib/api/permissions'
import { assignPermissionsToRole } from '@/lib/api/roles'
import type { TenantRole } from '@/lib/api/roles'

interface PermissionAssignmentModalProps {
  role: TenantRole
  assignedPermissions: string[]
  /** JWT access token from session.access_token */
  accessToken: string
  onClose: () => void
  onSuccess: () => void
}

// Category display names (bilingual)
const CATEGORY_NAMES: Record<string, { name: string; name2: string }> = {
  orders: { name: 'Orders Management', name2: 'إدارة الطلبات' },
  customers: { name: 'Customers Management', name2: 'إدارة العملاء' },
  products: { name: 'Products & Catalog', name2: 'المنتجات والفهرس' },
  pricing: { name: 'Pricing Management', name2: 'إدارة الأسعار' },
  users: { name: 'Users & Roles', name2: 'المستخدمين والأدوار' },
  invoices: { name: 'Invoices & Billing', name2: 'الفواتير والفوترة' },
  payments: { name: 'Payments', name2: 'المدفوعات' },
  reports: { name: 'Reports & Analytics', name2: 'التقارير والتحليلات' },
  settings: { name: 'Settings & Configuration', name2: 'الإعدادات والتكوين' },
  drivers: { name: 'Drivers & Delivery', name2: 'السائقين والتسليم' },
  branches: { name: 'Branches', name2: 'الفروع' },
  integrations: { name: 'Integrations', name2: 'التكاملات' },
  audit: { name: 'Audit & Logs', name2: 'المراجعة والسجلات' },
  workflow: { name: 'Workflow', name2: 'سير العمل' },
  other: { name: 'Other', name2: 'أخرى' },
}

/**
 *
 * @param root0
 * @param root0.role
 * @param root0.assignedPermissions
 * @param root0.accessToken
 * @param root0.onClose
 * @param root0.onSuccess
 */
export default function PermissionAssignmentModal({
  role,
  assignedPermissions,
  accessToken,
  onClose,
  onSuccess,
}: PermissionAssignmentModalProps) {
  const [permissions, setPermissions] = useState<TenantPermission[]>([])
  const [groupedPermissions, setGroupedPermissions] = useState<Record<string, TenantPermission[]>>({})
  const [selectedPermissions, setSelectedPermissions] = useState<Set<string>>(
    new Set(assignedPermissions)
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPermissions()
     
  }, [])

  const loadPermissions = async () => {
    try {
      setLoading(true)
      const data = await getAllPermissions(accessToken)
      setPermissions(data.permissions)
      setGroupedPermissions(data.grouped)
      // Expand all categories by default
      setExpandedCategories(new Set(Object.keys(data.grouped)))
    } catch (err) {
      console.error('Error loading permissions:', err)
      setError(err instanceof Error ? err.message : 'Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }

  const togglePermission = (code: string) => {
    setSelectedPermissions(prev => {
      const newSet = new Set(prev)
      if (newSet.has(code)) {
        newSet.delete(code)
      } else {
        newSet.add(code)
      }
      return newSet
    })
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(category)) {
        newSet.delete(category)
      } else {
        newSet.add(category)
      }
      return newSet
    })
  }

  const toggleCategorySelection = (category: string) => {
    const categoryPerms = groupedPermissions[category] || []
    const allSelected = categoryPerms.every(p => selectedPermissions.has(p.code))

    setSelectedPermissions(prev => {
      const newSet = new Set(prev)
      categoryPerms.forEach(perm => {
        if (allSelected) {
          newSet.delete(perm.code)
        } else {
          newSet.add(perm.code)
        }
      })
      return newSet
    })
  }

  const filteredGrouped = useMemo(() => {
    if (!searchQuery) return groupedPermissions

    const query = searchQuery.toLowerCase()
    const filtered: Record<string, TenantPermission[]> = {}

    Object.entries(groupedPermissions).forEach(([category, perms]) => {
      const matching = perms.filter(
        p =>
          p.code.toLowerCase().includes(query) ||
          p.name?.toLowerCase().includes(query) ||
          p.name2?.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      )
      if (matching.length > 0) {
        filtered[category] = matching
      }
    })

    return filtered
  }, [groupedPermissions, searchQuery])

  const handleSave = async () => {
    try {
      setSaving(true)
      setError(null)
      // Use role.code (string identifier) — NOT role_id (UUID)
      await assignPermissionsToRole(role.code, Array.from(selectedPermissions), accessToken)
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error assigning permissions:', err)
      setError(err instanceof Error ? err.message : 'Failed to assign permissions')
    } finally {
      setSaving(false)
    }
  }

  const getCategoryDisplayName = (category: string) => {
    return CATEGORY_NAMES[category] || { name: category, name2: category }
  }

  const getResourceFromCode = (code: string) => {
    return code.split(':')[0]
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50">
        <div className="bg-card rounded-lg p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              Assign Permissions to {role.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Select permissions to assign to this role. Users with this role will have access to the selected permissions.
            </p>
            {role.is_system && (
              <p className="text-xs text-warning-text mt-1 font-medium">
                ⚠ System role — changes will affect all users with this role
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-border">
          <div className="relative">
            <Search className="absolute start-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search permissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full ps-10 pe-4 py-2 border border-border rounded-lg focus:ring-2 focus:ring-ring focus:border-ring"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 py-3 bg-danger-bg border-b border-danger-border">
            <p className="text-sm text-danger-text">{error}</p>
          </div>
        )}

        {/* Permissions List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {Object.keys(filteredGrouped).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'No permissions match your search.' : 'No permissions available.'}
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(filteredGrouped).map(([category, perms]) => {
                const categoryInfo = getCategoryDisplayName(category)
                const isExpanded = expandedCategories.has(category)
                const allSelected = perms.every(p => selectedPermissions.has(p.code))

                return (
                  <div key={category} className="border border-border rounded-lg">
                    {/* Category Header */}
                    <div className="bg-muted px-4 py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1">
                        <button
                          onClick={() => toggleCategory(category)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={isExpanded ? 'Collapse' : 'Expand'}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-5 w-5" />
                          ) : (
                            <ChevronRight className="h-5 w-5" />
                          )}
                        </button>
                        <Shield className="h-5 w-5 text-muted-foreground" />
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{categoryInfo.name}</div>
                          {categoryInfo.name2 && (
                            <div className="text-sm text-muted-foreground">{categoryInfo.name2}</div>
                          )}
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {perms.length} permission{perms.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <button
                        onClick={() => toggleCategorySelection(category)}
                        className="ms-4 text-sm text-primary-text hover:text-primary-text/80 font-medium"
                      >
                        {allSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>

                    {/* Permissions */}
                    {isExpanded && (
                      <div className="divide-y divide-border">
                        {perms.map((perm) => {
                          const isSelected = selectedPermissions.has(perm.code)
                          const resource = getResourceFromCode(perm.code)

                          return (
                            <label
                              key={perm.code}
                              className={`flex items-start p-4 hover:bg-muted cursor-pointer ${
                                isSelected ? 'bg-info-bg' : ''
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => togglePermission(perm.code)}
                                className="mt-1 h-4 w-4 text-primary-text focus:ring-ring border-border rounded"
                              />
                              <div className="ms-3 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-foreground">
                                    {perm.name || perm.code}
                                  </span>
                                  {isSelected && (
                                    <CheckCircle2 className="h-4 w-4 text-primary-text" />
                                  )}
                                  {perm.is_system && (
                                    <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                                      system
                                    </span>
                                  )}
                                </div>
                                {perm.name2 && (
                                  <div className="text-sm text-muted-foreground mt-1">{perm.name2}</div>
                                )}
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs font-mono text-muted-foreground">{perm.code}</span>
                                  <span className="text-xs text-muted-foreground">•</span>
                                  <span className="text-xs text-muted-foreground capitalize">{resource}</span>
                                </div>
                                {perm.description && (
                                  <p className="text-sm text-muted-foreground mt-1">{perm.description}</p>
                                )}
                              </div>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between bg-muted">
          <div className="text-sm text-muted-foreground">
            <strong>{selectedPermissions.size}</strong> permission{selectedPermissions.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-border rounded-lg text-foreground hover:bg-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-card"></div>
              )}
              Save Permissions
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

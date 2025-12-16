'use client'

/**
 * Permission Assignment Modal
 *
 * Modal for assigning permissions to a role
 * Features:
 * - Grouped permissions by category
 * - Search/filter functionality
 * - Select all per category
 * - Visual indicators for assigned permissions
 */

import { useState, useEffect, useMemo } from 'react'
import { X, Search, CheckCircle2, Shield, ChevronDown, ChevronRight } from 'lucide-react'
import { getAllPermissions, type Permission } from '@/lib/api/permissions'
import { assignPermissionsToRole } from '@/lib/api/roles'
import type { Role } from '@/lib/api/roles'

interface PermissionAssignmentModalProps {
  role: Role
  assignedPermissions: string[]
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

export default function PermissionAssignmentModal({
  role,
  assignedPermissions,
  onClose,
  onSuccess,
}: PermissionAssignmentModalProps) {
  const [permissions, setPermissions] = useState<Permission[]>([])
  const [groupedPermissions, setGroupedPermissions] = useState<Record<string, Permission[]>>({})
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
      const data = await getAllPermissions()
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
    const filtered: Record<string, Permission[]> = {}

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
      await assignPermissionsToRole(role.role_id, Array.from(selectedPermissions))
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
    const categoryInfo = CATEGORY_NAMES[category] || { name: category, name2: category }
    return categoryInfo
  }

  const getResourceFromCode = (code: string) => {
    return code.split(':')[0]
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Assign Permissions to {role.name}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Select permissions to assign to this role. Users with this role will have access to the selected permissions.
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search permissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="px-6 py-3 bg-red-50 border-b border-red-200">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Permissions List */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="space-y-4">
            {Object.entries(filteredGrouped).map(([category, perms]) => {
              const categoryInfo = getCategoryDisplayName(category)
              const isExpanded = expandedCategories.has(category)
              const allSelected = perms.every(p => selectedPermissions.has(p.code))
              const someSelected = perms.some(p => selectedPermissions.has(p.code))

              return (
                <div key={category} className="border border-gray-200 rounded-lg">
                  {/* Category Header */}
                  <div className="bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <button
                        onClick={() => toggleCategory(category)}
                        className="text-gray-600 hover:text-gray-900"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5" />
                        ) : (
                          <ChevronRight className="h-5 w-5" />
                        )}
                      </button>
                      <Shield className="h-5 w-5 text-gray-400" />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{categoryInfo.name}</div>
                        {categoryInfo.name2 && (
                          <div className="text-sm text-gray-500">{categoryInfo.name2}</div>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">
                        {perms.length} permission{perms.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleCategorySelection(category)}
                      className="ml-4 text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      {allSelected ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {/* Permissions */}
                  {isExpanded && (
                    <div className="divide-y divide-gray-200">
                      {perms.map((perm) => {
                        const isSelected = selectedPermissions.has(perm.code)
                        const resource = getResourceFromCode(perm.code)

                        return (
                          <label
                            key={perm.permission_id}
                            className={`flex items-start p-4 hover:bg-gray-50 cursor-pointer ${
                              isSelected ? 'bg-blue-50' : ''
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => togglePermission(perm.code)}
                              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                            />
                            <div className="ml-3 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {perm.name || perm.code}
                                </span>
                                {isSelected && (
                                  <CheckCircle2 className="h-4 w-4 text-blue-600" />
                                )}
                              </div>
                              {perm.name2 && (
                                <div className="text-sm text-gray-500 mt-1">{perm.name2}</div>
                              )}
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs font-mono text-gray-400">{perm.code}</span>
                                <span className="text-xs text-gray-400">•</span>
                                <span className="text-xs text-gray-400 capitalize">{resource}</span>
                              </div>
                              {perm.description && (
                                <p className="text-sm text-gray-600 mt-1">{perm.description}</p>
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
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between bg-gray-50">
          <div className="text-sm text-gray-600">
            <strong>{selectedPermissions.size}</strong> permission{selectedPermissions.size !== 1 ? 's' : ''} selected
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              Save Permissions
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

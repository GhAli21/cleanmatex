'use client'

import { useState, useEffect } from 'react'
import { X, Save } from 'lucide-react'
import { getAvailableIcons } from '@/lib/utils/icon-registry'
import type {
  NavigationComponent,
  CreateComponentData,
  UpdateComponentData,
} from '@/lib/services/navigation-management.service'

interface NavigationItemFormProps {
  component?: NavigationComponent | null
  parentOptions: Array<{ comp_id: string; comp_code: string; label: string | null }>
  onSave: (data: CreateComponentData | UpdateComponentData) => Promise<void>
  onCancel: () => void
}

export function NavigationItemForm({
  component,
  parentOptions,
  onSave,
  onCancel,
}: NavigationItemFormProps) {
  const isEdit = !!component
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    comp_code: component?.comp_code || '',
    parent_comp_code: component?.parent_comp_code || null,
    label: component?.label || '',
    label2: component?.label2 || '',
    comp_path: component?.comp_path || '',
    comp_icon: component?.comp_icon || 'Home',
    main_permission_code: component?.main_permission_code || '',
    display_order: component?.display_order ?? 0,
    is_active: component?.is_active ?? true,
    is_navigable: component?.is_navigable ?? true,
    roles: (component?.roles || []).join(', '),
    permissions: (component?.permissions || []).join(', '),
    feature_flag: (component?.feature_flag || []).join(', '),
    badge: component?.badge || '',
  })

  const availableIcons = getAvailableIcons()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)

    try {
      const data: any = {
        comp_code: formData.comp_code,
        parent_comp_code: formData.parent_comp_code || null,
        label: formData.label,
        label2: formData.label2 || undefined,
        comp_path: formData.comp_path || undefined,
        comp_icon: formData.comp_icon,
        main_permission_code: formData.main_permission_code || null,
        display_order: formData.display_order,
        is_active: formData.is_active,
        is_navigable: formData.is_navigable,
        badge: formData.badge || null,
      }

      // Parse arrays
      if (formData.roles) {
        data.roles = formData.roles.split(',').map((r) => r.trim()).filter(Boolean)
      }
      if (formData.permissions) {
        data.permissions = formData.permissions.split(',').map((p) => p.trim()).filter(Boolean)
      }
      if (formData.feature_flag) {
        data.feature_flag = formData.feature_flag.split(',').map((f) => f.trim()).filter(Boolean)
      }

      await onSave(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save component')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {isEdit ? 'Edit Navigation Item' : 'Add Navigation Item'}
          </h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Comp Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Component Code *
              </label>
              <input
                type="text"
                value={formData.comp_code}
                onChange={(e) => setFormData({ ...formData, comp_code: e.target.value })}
                required
                disabled={isEdit}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
                placeholder="e.g., orders_list"
              />
            </div>

            {/* Parent */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parent Component
              </label>
              <select
                value={formData.parent_comp_code || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    parent_comp_code: e.target.value || null,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">None (Root Level)</option>
                {parentOptions.map((parent) => (
                  <option key={parent.comp_id} value={parent.comp_code}>
                    {parent.label || parent.comp_code}
                  </option>
                ))}
              </select>
            </div>

            {/* Label */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Label *
              </label>
              <input
                type="text"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., All Orders"
              />
            </div>

            {/* Label2 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Label (Arabic)
              </label>
              <input
                type="text"
                value={formData.label2}
                onChange={(e) => setFormData({ ...formData, label2: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., جميع الطلبات"
              />
            </div>

            {/* Path */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Path
              </label>
              <input
                type="text"
                value={formData.comp_path}
                onChange={(e) => setFormData({ ...formData, comp_path: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., /dashboard/orders"
              />
            </div>

            {/* Icon */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Icon
              </label>
              <select
                value={formData.comp_icon}
                onChange={(e) => setFormData({ ...formData, comp_icon: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              >
                {availableIcons.map((icon) => (
                  <option key={icon} value={icon}>
                    {icon}
                  </option>
                ))}
              </select>
            </div>

            {/* Permission Code */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Main Permission Code
              </label>
              <input
                type="text"
                value={formData.main_permission_code}
                onChange={(e) =>
                  setFormData({ ...formData, main_permission_code: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., orders:read"
              />
            </div>

            {/* Display Order */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Order
              </label>
              <input
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Badge */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Badge
              </label>
              <input
                type="text"
                value={formData.badge}
                onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., New"
              />
            </div>
          </div>

          {/* Arrays */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Roles (comma-separated)
              </label>
              <input
                type="text"
                value={formData.roles}
                onChange={(e) => setFormData({ ...formData, roles: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="admin, operator"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Permissions (comma-separated)
              </label>
              <input
                type="text"
                value={formData.permissions}
                onChange={(e) => setFormData({ ...formData, permissions: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="orders:read, orders:create"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Feature Flags (comma-separated)
              </label>
              <input
                type="text"
                value={formData.feature_flag}
                onChange={(e) => setFormData({ ...formData, feature_flag: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                placeholder="driver_app, advanced_analytics"
              />
            </div>
          </div>

          {/* Checkboxes */}
          <div className="flex gap-6">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Active</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_navigable}
                onChange={(e) => setFormData({ ...formData, is_navigable: e.target.checked })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm text-gray-700">Navigable</span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

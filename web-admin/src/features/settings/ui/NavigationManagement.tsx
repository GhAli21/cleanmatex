'use client'

import { useState, useEffect } from 'react'
import {
  Plus,
  Edit,
  Trash2,
  ChevronRight,
  ChevronDown,
  RefreshCw,
} from 'lucide-react'
import { getIcon } from '@/lib/utils/icon-registry'
import {
  getAllComponents,
  createComponent,
  updateComponent,
  deleteComponent,
  buildComponentTree,
  type NavigationComponent,
  type CreateComponentData,
  type UpdateComponentData,
} from '@/lib/services/navigation-management.service'
import { NavigationItemForm } from './NavigationItemForm'

export function NavigationManagement() {
  const [components, setComponents] = useState<NavigationComponent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [editingComponent, setEditingComponent] = useState<NavigationComponent | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [parentComponent, setParentComponent] = useState<NavigationComponent | null>(null)

  useEffect(() => {
    loadComponents()
  }, [])

  const loadComponents = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await getAllComponents()
      setComponents(data)
      // Expand all by default
      setExpandedItems(new Set(data.map((c) => c.comp_id)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load components')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAdd = (parent?: NavigationComponent) => {
    setParentComponent(parent || null)
    setEditingComponent(null)
    setIsFormOpen(true)
  }

  const handleEdit = (component: NavigationComponent) => {
    setEditingComponent(component)
    setParentComponent(null)
    setIsFormOpen(true)
  }

  const handleDelete = async (component: NavigationComponent) => {
    if (!confirm(`Are you sure you want to delete "${component.label}"?`)) {
      return
    }

    try {
      await deleteComponent(component.comp_id)
      await loadComponents()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete component')
    }
  }

  const handleSave = async (data: CreateComponentData | UpdateComponentData) => {
    try {
      if (editingComponent) {
        await updateComponent(editingComponent.comp_id, data as UpdateComponentData)
      } else {
        const createData = data as CreateComponentData
        if (parentComponent) {
          createData.parent_comp_code = parentComponent.comp_code
        }
        await createComponent(createData)
      }
      setIsFormOpen(false)
      setEditingComponent(null)
      setParentComponent(null)
      await loadComponents()
    } catch (err) {
      throw err // Let form handle error display
    }
  }

  const toggleExpanded = (compId: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(compId)) {
      newExpanded.delete(compId)
    } else {
      newExpanded.add(compId)
    }
    setExpandedItems(newExpanded)
  }

  const tree = buildComponentTree(components)

  const renderComponent = (component: NavigationComponent & { children?: NavigationComponent[] }, level = 0) => {
    const hasChildren = component.children && component.children.length > 0
    const isExpanded = expandedItems.has(component.comp_id)
    const Icon = getIcon(component.comp_icon)

    return (
      <div key={component.comp_id} className="border-b border-gray-200">
        <div
          className={`flex items-center gap-2 px-4 py-3 hover:bg-gray-50 ${
            level > 0 ? 'bg-gray-50' : ''
          }`}
          style={{ paddingLeft: `${level * 24 + 16}px` }}
        >
          {hasChildren ? (
            <button
              onClick={() => toggleExpanded(component.comp_id)}
              className="text-gray-400 hover:text-gray-600"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </button>
          ) : (
            <span className="w-4" />
          )}

          <div className="flex-1 flex items-center gap-3">
            {typeof Icon === 'function' ? (
              <Icon className="h-5 w-5 text-gray-500" />
            ) : (
              <span className="h-5 w-5" />
            )}
            <div className="flex-1">
              <div className="font-medium text-gray-900">{component.label}</div>
              <div className="text-sm text-gray-500">
                {component.comp_code} • {component.comp_path || 'No path'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {component.badge && (
                <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded">
                  {component.badge}
                </span>
              )}
              {!component.is_active && (
                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded">
                  Inactive
                </span>
              )}
              {component.main_permission_code && (
                <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                  {component.main_permission_code}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleAdd(component)}
              className="p-1 text-gray-400 hover:text-blue-600"
              title="Add child"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleEdit(component)}
              className="p-1 text-gray-400 hover:text-blue-600"
              title="Edit"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => handleDelete(component)}
              className="p-1 text-gray-400 hover:text-red-600"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div>
            {component.children!.map((child) => renderComponent(child, level + 1))}
          </div>
        )}
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
        {error}
      </div>
    )
  }

  const parentOptions = components.filter((c) => c.comp_level === 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Navigation Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage system navigation components and their hierarchy
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={loadComponents}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
          <button
            onClick={() => handleAdd()}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Component
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-200">
          {tree.length === 0 ? (
            <div className="px-6 py-12 text-center text-gray-500">
              No navigation components found. Click "Add Component" to create one.
            </div>
          ) : (
            tree.map((component) => renderComponent(component))
          )}
        </div>
      </div>

      {isFormOpen && (
        <NavigationItemForm
          component={editingComponent}
          parentOptions={parentOptions}
          onSave={handleSave}
          onCancel={() => {
            setIsFormOpen(false)
            setEditingComponent(null)
            setParentComponent(null)
          }}
        />
      )}
    </div>
  )
}

/**
 * Navigation Management Service
 * 
 * Client-side service for managing navigation components
 */

'use client'

export interface NavigationComponent {
  comp_id: string
  parent_comp_id: string | null
  comp_code: string
  parent_comp_code: string | null
  label: string | null
  label2: string | null
  comp_path: string | null
  comp_icon: string | null
  main_permission_code: string | null
  display_order: number | null
  comp_level: number | null
  is_leaf: boolean | null
  is_navigable: boolean | null
  is_active: boolean | null
  roles: string[]
  permissions: string[]
  feature_flag: string[]
  badge: string | null
}

export interface CreateComponentData {
  comp_code: string
  parent_comp_code?: string | null
  label: string
  label2?: string
  comp_path?: string
  comp_icon?: string
  main_permission_code?: string | null
  display_order?: number
  is_active?: boolean
  is_navigable?: boolean
  roles?: string[]
  permissions?: string[]
  feature_flag?: string[]
  badge?: string | null
}

export interface UpdateComponentData {
  parent_comp_code?: string | null
  label?: string
  label2?: string
  comp_path?: string
  comp_icon?: string
  main_permission_code?: string | null
  display_order?: number
  is_active?: boolean
  is_navigable?: boolean
  roles?: string[]
  permissions?: string[]
  feature_flag?: string[]
  badge?: string | null
}

/**
 * Get all navigation components
 */
export async function getAllComponents(): Promise<NavigationComponent[]> {
  const response = await fetch('/api/navigation/components')
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    const errorMessage = errorData.error || `Failed to fetch components (${response.status})`
    throw new Error(errorMessage)
  }
  const data = await response.json()
  return data.components || []
}

/**
 * Get a single component by ID
 */
export async function getComponentById(id: string): Promise<NavigationComponent> {
  const response = await fetch(`/api/navigation/components/${id}`)
  if (!response.ok) {
    throw new Error('Failed to fetch component')
  }
  const data = await response.json()
  return data.component
}

/**
 * Create a new component
 */
export async function createComponent(
  data: CreateComponentData
): Promise<NavigationComponent> {
  const response = await fetch('/api/navigation/components', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to create component')
  }

  const result = await response.json()
  return result.component
}

/**
 * Update a component
 */
export async function updateComponent(
  id: string,
  data: UpdateComponentData
): Promise<NavigationComponent> {
  const response = await fetch(`/api/navigation/components/${id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to update component')
  }

  const result = await response.json()
  return result.component
}

/**
 * Delete a component
 */
export async function deleteComponent(id: string): Promise<void> {
  const response = await fetch(`/api/navigation/components/${id}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || 'Failed to delete component')
  }
}

/**
 * Build a tree structure from flat component list
 */
export function buildComponentTree(
  components: NavigationComponent[]
): NavigationComponent[] {
  const componentMap = new Map<string, NavigationComponent & { children?: NavigationComponent[] }>()
  const rootComponents: NavigationComponent[] = []

  // Create map of all components
  components.forEach((comp) => {
    componentMap.set(comp.comp_id, { ...comp, children: [] })
  })

  // Build tree structure
  components.forEach((comp) => {
    const component = componentMap.get(comp.comp_id)!
    if (comp.parent_comp_id) {
      const parent = componentMap.get(comp.parent_comp_id)
      if (parent) {
        if (!parent.children) {
          parent.children = []
        }
        parent.children.push(component)
      }
    } else {
      rootComponents.push(component)
    }
  })

  // Sort by display_order
  const sortByOrder = (a: NavigationComponent, b: NavigationComponent) => {
    const orderA = a.display_order ?? 999
    const orderB = b.display_order ?? 999
    return orderA - orderB
  }

  rootComponents.sort(sortByOrder)
  componentMap.forEach((comp) => {
    if (comp.children) {
      comp.children.sort(sortByOrder)
    }
  })

  return rootComponents
}

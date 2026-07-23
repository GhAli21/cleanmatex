import type { WorkflowScreenKey } from '@/lib/constants/workflow-screens'

export interface ScreenContractPreConditions {
  statuses: string[]
  additional_filters?: Record<string, unknown>
}

export interface SerializedScreenContract {
  id: string
  tenant_org_id: string | null
  screen_key: WorkflowScreenKey | string
  statuses: string[]
  additional_filters: Record<string, unknown>
  required_permissions: string[]
  is_active: boolean
  is_system: boolean
  created_at: string | null
  updated_at: string | null
}

export interface ScreenContractFormInput {
  screenKey: string
  statuses: string[]
  additionalFiltersJson?: string
  requiredPermissions: string[]
  isActive: boolean
}

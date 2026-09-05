import type { ReactNode } from 'react'

/**
 * Describes the display contract for one order lifecycle stage.
 * The server remains authoritative for transition availability; this type only
 * describes the information needed to make that contract understandable.
 */
export interface OrderWorkspaceStage {
  id: string
  label: string
  state: 'complete' | 'current' | 'upcoming' | 'blocked'
  description?: string
}

/** A localized, ordered stage from the workflow policy pinned to this order. */
export interface OrderWorkspaceWorkflowJourneyStage {
  /** Persisted workflow status code used to identify the current stage. */
  statusCode: string
  /** Locale-selected status label from the workflow status catalog. */
  label: string
  /** Whether this policy stage is terminal for the order lifecycle. */
  isTerminal: boolean
}

/** A safe, localized operational attention item shown above the work area. */
export interface OrderWorkspaceAttention {
  id: string
  severity: 'error' | 'warning' | 'info'
  title: string
  description: string
  actionLabel?: string
  onAction?: () => void
}

/** One item in the compact activity preview. */
export interface OrderWorkspaceActivity {
  id: string
  label: string
  occurredAt: string
  actor?: string
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}

/** Props for the complete, domain-agnostic workspace composition. */
export interface OrderWorkspaceProps {
  orderNumber: string
  customerName: string
  customerMobileNumber?: string | null
  statusLabel: string
  statusTone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  paymentLabel?: string
  paymentTone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  receivedAt?: string
  branchLabel?: string
  address?: string | null
  locationLabel?: string | null
  totalAmount?: string
  paidAmount?: string
  creditAmount?: string
  balanceAmount?: string
  collectionLabel?: string
  preparationLabel?: string
  workCompleted?: number
  workTotal?: number
  workflowStages: OrderWorkspaceStage[]
  currentStageLabel?: string
  nextAction?: {
    label: string
    description?: string
    disabled?: boolean
    disabledReason?: string
    onClick?: () => void
  }
  secondaryAction?: {
    label: string
    onClick?: () => void
  }
  onBack?: () => void
  onEdit?: () => void
  onPrint?: () => void
  onCopyMobile?: () => void
  onCollectPayment?: () => void
  onSectionChange?: (sectionId: OrderWorkspaceSectionId) => void
  activeSection?: OrderWorkspaceSectionId
  attention?: OrderWorkspaceAttention[]
  activities?: OrderWorkspaceActivity[]
  workContent?: ReactNode
  customerContent?: ReactNode
  financialContent?: ReactNode
  activityContent?: ReactNode
  loading?: boolean
  error?: string | null
  onRetry?: () => void
  emptyWorkLabel?: string
}

/** Stable URL-safe section identifiers for deep links and analytics. */
export type OrderWorkspaceSectionId = 'overview' | 'work' | 'customer' | 'financials' | 'activity' | 'actions'

/** Localized labels required by the workspace shell. */
export interface OrderWorkspaceLabels {
  back: string
  print: string
  edit: string
  more: string
  copyMobile: string
  copied: string
  collectPayment: string
  overview: string
  work: string
  customer: string
  financials: string
  activity: string
  actions: string
  workflow: string
  nextAction: string
  attention: string
  workProgress: string
  customerContext: string
  financialSnapshot: string
  recentActivity: string
  noActivity: string
  noWork: string
  noAddress: string
  retry: string
  unableToLoad: string
  received: string
  balanceDue: string
  total: string
  paid: string
  credits: string
  balance: string
  collection: string
  preparation: string
  of: string
  items: string
}

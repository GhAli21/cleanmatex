/**
 * Workflow & Status Management Types
 * PRD-005: Basic Workflow & Status Transitions
 */

// ==================================================================
// Order Status Types
// ==================================================================

export type OrderStatus =
  | 'draft'
  | 'intake'
  | 'preparation'
  | 'processing'
  | 'sorting'
  | 'washing'
  | 'drying'
  | 'finishing'
  | 'assembly'
  | 'qa'
  | 'packing'
  | 'ready'
  | 'out_for_delivery'
  | 'delivered'
  | 'closed'
  | 'cancelled';

export const ORDER_STATUSES: OrderStatus[] = [
  'draft',
  'intake',
  'preparation',
  'processing',
  'sorting',
  'washing',
  'drying',
  'finishing',
  'assembly',
  'qa',
  'packing',
  'ready',
  'out_for_delivery',
  'delivered',
  'closed',
  'cancelled',
];

// Status metadata for UI rendering
export const STATUS_META: Record<OrderStatus, {
  label: string;
  labelAr: string;
  color: string;
  icon: string;
  description: string;
}> = {
  draft: {
    label: 'Draft',
    labelAr: 'مسودة',
    color: 'gray',
    icon: 'FileText',
    description: 'Order is being created',
  },
  intake: {
    label: 'Intake',
    labelAr: 'استقبال',
    color: 'blue',
    icon: 'ClipboardList',
    description: 'Items received from customer',
  },
  preparation: {
    label: 'Preparation',
    labelAr: 'تحضير',
    color: 'indigo',
    icon: 'Package',
    description: 'Items being tagged and prepared',
  },
  processing: {
    label: 'Processing',
    labelAr: 'معالجة',
    color: 'blue',
    icon: 'Cog',
    description: 'Items in processing queue',
  },
  sorting: {
    label: 'Sorting',
    labelAr: 'فرز',
    color: 'purple',
    icon: 'Shuffle',
    description: 'Items sorted by type and color',
  },
  washing: {
    label: 'Washing',
    labelAr: 'غسيل',
    color: 'cyan',
    icon: 'Droplets',
    description: 'Items in wash cycle',
  },
  drying: {
    label: 'Drying',
    labelAr: 'تجفيف',
    color: 'sky',
    icon: 'Wind',
    description: 'Items being dried',
  },
  finishing: {
    label: 'Finishing',
    labelAr: 'كوي',
    color: 'violet',
    icon: 'Sparkles',
    description: 'Ironing and pressing',
  },
  assembly: {
    label: 'Assembly',
    labelAr: 'تجميع',
    color: 'fuchsia',
    icon: 'Boxes',
    description: 'Items grouped together',
  },
  qa: {
    label: 'Quality Check',
    labelAr: 'فحص الجودة',
    color: 'orange',
    icon: 'CheckCircle',
    description: 'Quality inspection',
  },
  packing: {
    label: 'Packing',
    labelAr: 'تعبئة',
    color: 'amber',
    icon: 'Package2',
    description: 'Items being packed',
  },
  ready: {
    label: 'Ready',
    labelAr: 'جاهز',
    color: 'green',
    icon: 'CheckCheck',
    description: 'Ready for pickup/delivery',
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    labelAr: 'قيد التوصيل',
    color: 'teal',
    icon: 'Truck',
    description: 'Driver en route',
  },
  delivered: {
    label: 'Delivered',
    labelAr: 'تم التسليم',
    color: 'emerald',
    icon: 'Check',
    description: 'Customer received items',
  },
  closed: {
    label: 'Closed',
    labelAr: 'مغلق',
    color: 'slate',
    icon: 'Archive',
    description: 'Order completed and archived',
  },
  cancelled: {
    label: 'Cancelled',
    labelAr: 'ملغى',
    color: 'red',
    icon: 'XCircle',
    description: 'Order cancelled',
  },
};

// ==================================================================
// Status History Types
// ==================================================================

export interface StatusHistoryEntry {
  id: string;
  order_id: string;
  tenant_org_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  changed_by: string | null;
  changed_by_name: string;
  changed_at: string;
  notes?: string;
  metadata?: Record<string, any>;
}

// ==================================================================
// Workflow Configuration Types
// ==================================================================

export interface WorkflowSettings {
  id: string;
  tenant_org_id: string;
  service_category_code: string | null;
  workflow_steps: OrderStatus[];
  status_transitions: Record<OrderStatus, OrderStatus[]>;
  quality_gate_rules: QualityGateRules;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface QualityGateRules {
  [status: string]: {
    requireAllItemsAssembled?: boolean;
    requireQAPassed?: boolean;
    requireNoUnresolvedIssues?: boolean;
    customValidation?: string;
  };
}

export interface WorkflowRule {
  id: string;
  tenant_org_id: string;
  from_status: OrderStatus;
  to_status: OrderStatus;
  is_allowed: boolean;
  requires_role?: string;
  validation_rules?: Record<string, any>;
  created_at: string;
}

// ==================================================================
// Status Change Types
// ==================================================================

export interface ChangeStatusParams {
  orderId: string;
  tenantId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  userId: string;
  userName: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export interface ChangeStatusResult {
  success: boolean;
  order?: {
    id: string;
    status: OrderStatus;
    updated_at: string;
  };
  statusHistory?: StatusHistoryEntry;
  error?: string;
  blockers?: string[];
}

export interface BulkChangeStatusParams {
  orderIds: string[];
  tenantId: string;
  toStatus: OrderStatus;
  userId: string;
  userName: string;
  notes?: string;
}

export interface BulkChangeStatusResult {
  success: boolean;
  successCount: number;
  failureCount: number;
  results: Array<{
    orderId: string;
    success: boolean;
    error?: string;
  }>;
}

// ==================================================================
// Transition Validation Types
// ==================================================================

export interface TransitionCheckParams {
  tenantId: string;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  serviceCategoryCode?: string;
  userRole?: string;
}

export interface TransitionCheckResult {
  isAllowed: boolean;
  reason?: string;
  requiresRole?: string;
}

// ==================================================================
// Quality Gate Types
// ==================================================================

export interface QualityGateCheckResult {
  canMove: boolean;
  blockers: string[];
  details?: {
    unassembledItems?: number;
    failedQAItems?: number;
    unresolvedIssues?: number;
  };
}

// ==================================================================
// Overdue Orders Types
// ==================================================================

export interface OverdueOrder {
  id: string;
  order_no: string;
  customer_name: string;
  status: OrderStatus;
  ready_by: string;
  hours_overdue: number;
  branch_name?: string;
}

// ==================================================================
// Workflow Statistics Types
// ==================================================================

export interface WorkflowStats {
  statusDistribution: Array<{
    status: OrderStatus;
    count: number;
    percentage: number;
  }>;
  averageTimePerStage: Array<{
    status: OrderStatus;
    averageHours: number;
  }>;
  slaCompliance: {
    onTime: number;
    late: number;
    complianceRate: number;
  };
  currentOrders: {
    total: number;
    inProgress: number;
    ready: number;
    overdue: number;
  };
}

// ==================================================================
// API Response Types
// ==================================================================

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ==================================================================
// Utility Functions
// ==================================================================

/**
 * Get the index of a status in the workflow
 */
export function getStatusIndex(status: OrderStatus): number {
  return ORDER_STATUSES.indexOf(status);
}

/**
 * Check if a status is before another in the workflow
 */
export function isStatusBefore(status1: OrderStatus, status2: OrderStatus): boolean {
  return getStatusIndex(status1) < getStatusIndex(status2);
}

/**
 * Get the next status in the workflow
 */
export function getNextStatus(currentStatus: OrderStatus): OrderStatus | null {
  const index = getStatusIndex(currentStatus);
  if (index >= 0 && index < ORDER_STATUSES.length - 1) {
    return ORDER_STATUSES[index + 1];
  }
  return null;
}

/**
 * Get allowed transitions for a status from workflow settings
 */
export function getAllowedTransitions(
  status: OrderStatus,
  workflowSettings?: WorkflowSettings
): OrderStatus[] {
  if (workflowSettings?.status_transitions[status]) {
    return workflowSettings.status_transitions[status];
  }
  // Fallback to next status if no settings
  const next = getNextStatus(status);
  return next ? [next, 'cancelled'] : ['cancelled'];
}

/**
 * Format duration in hours to human-readable string
 */
export function formatDuration(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)} minutes`;
  }
  if (hours < 24) {
    return `${Math.round(hours)} hours`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = Math.round(hours % 24);
  return `${days} days${remainingHours > 0 ? ` ${remainingHours} hours` : ''}`;
}

/**
 * Get status color class for Tailwind
 */
export function getStatusColorClass(status: OrderStatus): string {
  const color = STATUS_META[status].color;
  return `bg-${color}-100 text-${color}-800 border-${color}-200`;
}

// ==================================================================
// PRD-010: Advanced Workflow Types
// ==================================================================

export interface WorkflowTemplate {
  template_id: string;
  template_code: string;
  template_name: string;
  template_name2: string;
  template_desc: string;
  is_active: boolean;
}

export interface WorkflowStage {
  id: string;
  template_id: string;
  stage_code: string;
  stage_name: string;
  stage_name2: string;
  stage_type: 'operational' | 'qa' | 'delivery';
  seq_no: number;
  is_terminal: boolean;
}

export interface WorkflowTransition {
  id: string;
  template_id: string;
  from_stage_code: string;
  to_stage_code: string;
  requires_scan_ok: boolean;
  requires_invoice: boolean;
  requires_pod: boolean;
  allow_manual: boolean;
  auto_when_done: boolean;
}

export interface TenantWorkflowSettings {
  tenant_org_id: string;
  use_preparation_screen: boolean;
  use_assembly_screen: boolean;
  use_qa_screen: boolean;
  track_individual_piece: boolean;
  orders_split_enabled: boolean;
}

export interface OrderIssue {
  id: string;
  tenant_org_id: string;
  order_id: string;
  order_item_id: string;
  issue_code: 'damage' | 'stain' | 'complaint' | 'other';
  issue_text: string;
  photo_url?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_by: string;
  created_at: string;
  solved_at?: string;
  solved_by?: string;
  solved_notes?: string;
}

export interface ProcessingStep {
  id: string;
  tenant_org_id: string;
  order_id: string;
  order_item_id: string;
  step_code: 'sorting' | 'pretreatment' | 'washing' | 'drying' | 'finishing';
  step_seq: number;
  done_by: string;
  done_at: string;
  notes?: string;
}

export interface OrderHistoryEntry {
  id: string;
  tenant_org_id: string;
  order_id: string;
  action_type: 'ORDER_CREATED' | 'STATUS_CHANGE' | 'FIELD_UPDATE' | 'SPLIT' | 'QA_DECISION' | 'ITEM_STEP' | 'ISSUE_CREATED' | 'ISSUE_SOLVED';
  from_value?: string;
  to_value?: string;
  payload: Record<string, any>;
  done_by?: string;
  done_at: string;
}

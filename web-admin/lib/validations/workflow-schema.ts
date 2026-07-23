import { z } from 'zod';

export const OrderStatusEnum = z.enum([
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
]);

export const QualityGateRuleSchema = z.object({
  requireAllItemsAssembled: z.boolean().optional(),
  requireQAPassed: z.boolean().optional(),
  requireNoUnresolvedIssues: z.boolean().optional(),
  customValidation: z.string().optional(),
});

export const QualityGateRulesSchema = z.record(z.string(), QualityGateRuleSchema);

export const WorkflowSettingsSchema = z.object({
  id: z.string().uuid(),
  tenant_org_id: z.string().uuid(),
  service_category_code: z.string().nullable(),
  workflow_steps: z.array(OrderStatusEnum),
  status_transitions: z.record(z.string(), z.array(OrderStatusEnum)),
  quality_gate_rules: QualityGateRulesSchema,
  is_active: z.boolean(),
  created_at: z.string(),
  updated_at: z.string().optional(),
});

export const StatusHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  order_id: z.string().uuid(),
  tenant_org_id: z.string().uuid(),
  from_status: OrderStatusEnum.nullable(),
  to_status: OrderStatusEnum,
  changed_by: z.string().uuid().nullable(),
  changed_by_name: z.string().optional().default(''),
  changed_at: z.string(),
  notes: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const TransitionRequestSchema = z.object({
  toStatus: OrderStatusEnum,
  notes: z.string().max(1000).optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const AllowedTransitionsResponseSchema = z.object({
  success: z.literal(true),
  data: z.array(OrderStatusEnum),
});

export const TransitionResponseSchema = z.object({
  success: z.boolean(),
  data: z
    .object({
      id: z.string().uuid(),
      status: OrderStatusEnum,
      updated_at: z.string(),
    })
    .optional(),
  error: z.string().optional(),
});

/**
 *
 */
export type OrderStatus = z.infer<typeof OrderStatusEnum>;
/**
 *
 */
export type WorkflowSettings = z.infer<typeof WorkflowSettingsSchema>;
/**
 *
 */
export type StatusHistoryEntry = z.infer<typeof StatusHistoryEntrySchema>;

// PRD-010: Additional Workflow Schemas
export const WorkflowTemplateSchema = z.object({
  template_id: z.string().uuid(),
  template_code: z.string(),
  template_name: z.string(),
  template_name2: z.string().nullable(),
  template_desc: z.string().nullable(),
  is_active: z.boolean(),
});

export const WorkflowStageSchema = z.object({
  id: z.string().uuid(),
  template_id: z.string().uuid(),
  stage_code: z.string(),
  stage_name: z.string(),
  stage_name2: z.string().nullable(),
  stage_type: z.enum(['operational', 'qa', 'delivery']),
  seq_no: z.number(),
  is_terminal: z.boolean(),
});

export const TenantWorkflowSettingsSchema = z.object({
  tenant_org_id: z.string().uuid(),
  use_preparation_screen: z.boolean(),
  use_assembly_screen: z.boolean(),
  use_qa_screen: z.boolean(),
  track_individual_piece: z.boolean(),
  orders_split_enabled: z.boolean(),
});

export const OrderIssueSchema = z.object({
  id: z.string().uuid(),
  tenant_org_id: z.string().uuid(),
  order_id: z.string().uuid(),
  scope_level: z.enum(['ORDER', 'ITEM', 'PIECE']),
  /** Null for ORDER scope. */
  order_item_id: z.string().uuid().nullable(),
  /** Null for ORDER/ITEM scope. */
  order_item_piece_id: z.string().uuid().nullable(),
  issue_code: z.enum(['damage', 'stain', 'complaint', 'other']),
  issue_text: z.string(),
  photo_url: z.string().url().nullable(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  solved_at: z.string().nullable(),
  solved_by: z.string().uuid().nullable(),
  solved_notes: z.string().nullable(),
});

export const ProcessingStepSchema = z.object({
  id: z.string().uuid(),
  tenant_org_id: z.string().uuid(),
  order_id: z.string().uuid(),
  order_item_id: z.string().uuid(),
  step_code: z.enum(['sorting', 'pretreatment', 'washing', 'drying', 'finishing']),
  step_seq: z.number().min(1).max(5),
  done_by: z.string().uuid().nullable(),
  done_at: z.string(),
  notes: z.string().nullable(),
});

export const OrderHistoryEntrySchema = z.object({
  id: z.string().uuid(),
  tenant_org_id: z.string().uuid(),
  order_id: z.string().uuid(),
  action_type: z.enum(['ORDER_CREATED', 'STATUS_CHANGE', 'FIELD_UPDATE', 'SPLIT', 'QA_DECISION', 'ITEM_STEP', 'ISSUE_CREATED', 'ISSUE_SOLVED']),
  from_value: z.string().nullable(),
  to_value: z.string().nullable(),
  payload: z.record(z.string(), z.any()),
  done_by: z.string().uuid().nullable(),
  done_at: z.string(),
});

// PRD-010: API Request Schemas
export const CreateOrderPieceDataSchema = z.object({
  pieceSeq: z.number().positive(),
  color: z.string().optional(),
  colorCodes: z.array(z.string()).optional(),
  colorCfIds: z.array(z.union([z.string().uuid(), z.null()])).optional(),
  brand: z.string().optional(),
  hasStain: z.boolean().optional(),
  hasDamage: z.boolean().optional(),
  notes: z.string().optional(),
  rackLocation: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
  conditions: z.array(z.string()).optional(),
  packingPrefCode: z.string().optional(),
  packingCfId: z.string().uuid().optional().nullable(),
  servicePrefs: z.array(z.object({
    preference_code: z.string(),
    source: z.string().optional(),
    extra_price: z.number().optional(),
    preferenceCfId: z.string().uuid().optional().nullable(),
  })).optional(),
});

const CreateOrderTotalsSchema = z.object({
  subtotal: z.number().min(0),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
  total: z.number().min(0),
  vatRate: z.number().min(0).max(100).optional(),
  vatAmount: z.number().min(0).optional(),
}).optional();

export const CreateOrderRequestSchema = z.object({
  customerId: z.string(),//.uuid(),
  branchId: z.string().uuid().optional(),
  orderTypeId: z.string(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    pricePerUnit: z.number().nonnegative(),
    totalPrice: z.number().nonnegative(),
    serviceCategoryCode: z.string().optional(),
    notes: z.string().optional(),
    hasStain: z.boolean().optional(),
    hasDamage: z.boolean().optional(),
    stainNotes: z.string().optional(),
    damageNotes: z.string().optional(),
    packingPrefCode: z.string().optional(),
    packingCfId: z.string().uuid().optional().nullable(),
    servicePrefs: z.array(z.object({
      preference_code: z.string(),
      source: z.string().optional(),
      extra_price: z.number().optional(),
      preferenceCfId: z.string().uuid().optional().nullable(),
    })).optional(),
    pieces: z.array(CreateOrderPieceDataSchema).optional(), // Optional piece-level data for order items
  })),
  isQuickDrop: z.boolean().optional(),
  quickDropQuantity: z.number().positive().optional(),
  priority: z.enum(['normal', 'urgent', 'express']).optional(),
  express: z.boolean().optional(),
  customerNotes: z.string().optional(),
  internalNotes: z.string().optional(),
  paymentMethod: z.string().optional(),
  readyByAt: z.string().datetime().optional(), // ISO datetime string for ready-by date
  totals: CreateOrderTotalsSchema.optional(),
  discountRate: z.number().min(0).max(100).optional(),
  discountType: z.string().optional(),
  promoCodeId: z.string().uuid().optional(),
  giftCardId: z.string().uuid().optional(),
  promoDiscountAmount: z.number().min(0).optional(),
  giftCardDiscountAmount: z.number().min(0).optional(),
  paymentTypeCode: z.string().optional(),
  currencyCode: z.string().length(3).optional(),
  currencyExRate: z.number().min(0).optional(),
  orderSourceCode: z.string().min(1).max(64).optional(),
  physicalIntakeStatus: z.enum(['pending_dropoff', 'received', 'not_applicable']).optional(),
  physicalIntakeInfo: z.string().max(8000).optional().nullable(),
  receivedInfo: z.string().max(8000).optional().nullable(),
});

export const TransitionOrderRequestSchema = z.object({
  toStatus: z.string(),
  notes: z.string().max(1000).optional(),
  rackLocation: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const SplitOrderRequestSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1).optional(), // Legacy: item-level splitting
  pieceIds: z.array(z.string()).min(1).optional(), // New: piece-level splitting
  reason: z.string().min(3).max(500),
}).refine(
  (data) => data.itemIds || data.pieceIds,
  { message: 'Either itemIds or pieceIds must be provided' }
);

export const CreateIssueRequestSchema = z
  .object({
    scopeLevel: z.enum(['ORDER', 'ITEM', 'PIECE']).optional(),
    orderItemId: z.string().uuid().nullable().optional(),
    orderItemPieceId: z.string().uuid().nullable().optional(),
    issueCode: z.string().min(1).max(50),
    issueText: z.string().min(3).max(1000),
    photoUrl: z.string().url().optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  })
  .superRefine((data, ctx) => {
    const pieceId = data.orderItemPieceId ?? null;
    const itemId = data.orderItemId ?? null;
    const scope =
      data.scopeLevel ??
      (pieceId ? 'PIECE' : itemId ? 'ITEM' : 'ORDER');

    if (scope === 'ORDER' && (itemId || pieceId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ORDER scope must not include item or piece ids',
        path: ['scopeLevel'],
      });
    }
    if (scope === 'ITEM' && (!itemId || pieceId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'ITEM scope requires orderItemId and no piece',
        path: ['orderItemId'],
      });
    }
    if (scope === 'PIECE' && (!itemId || !pieceId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'PIECE scope requires orderItemId and orderItemPieceId',
        path: ['orderItemPieceId'],
      });
    }
  });

export const ResolveIssueRequestSchema = z.object({
  solvedNotes: z.string().min(3).max(2000),
});

export const RecordStepRequestSchema = z.object({
  stepCode: z.enum(['sorting', 'pretreatment', 'washing', 'drying', 'finishing']),
  stepSeq: z.number().min(1).max(5),
  notes: z.string().optional(),
});

/**
 *
 */
export type WorkflowTemplate = z.infer<typeof WorkflowTemplateSchema>;
/**
 *
 */
export type WorkflowStage = z.infer<typeof WorkflowStageSchema>;
/**
 *
 */
export type TenantWorkflowSettings = z.infer<typeof TenantWorkflowSettingsSchema>;
/**
 *
 */
export type OrderIssue = z.infer<typeof OrderIssueSchema>;
/**
 *
 */
export type ProcessingStep = z.infer<typeof ProcessingStepSchema>;
/**
 *
 */
export type OrderHistoryEntry = z.infer<typeof OrderHistoryEntrySchema>;
/**
 *
 */
export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;
/**
 *
 */
export type TransitionOrderRequest = z.infer<typeof TransitionOrderRequestSchema>;
/**
 *
 */
export type SplitOrderRequest = z.infer<typeof SplitOrderRequestSchema>;
/**
 *
 */
export type CreateIssueRequest = z.infer<typeof CreateIssueRequestSchema>;
/**
 *
 */
export type RecordStepRequest = z.infer<typeof RecordStepRequestSchema>;


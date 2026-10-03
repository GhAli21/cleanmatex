import type { OrderChangeOperationCode, OrderChangeTargetKind } from '@/lib/constants/order-change';

/** Persisted or batch-local identity used by a typed Change operation. */
export interface OrderChangeTarget {
  /** Distinguishes server-persisted records from identities created within the submitted batch. */
  kind: OrderChangeTargetKind;
  /** UUID required when the operation addresses a previously persisted commercial record. */
  id?: string;
  /** Client-generated UUID used only to connect dependent operations in the same request batch. */
  clientRef?: string;
}

/** Typed request intent retained for later Preview and Apply packages. */
export interface OrderChangeOperationInput {
  /** Caller-defined sequence used to make validation failures and future gate decisions deterministic. */
  seq: number;
  code: OrderChangeOperationCode;
  target: OrderChangeTarget;
  payload: Record<string, unknown>;
}

/** Read-only commercial item facts with the persisted identity preserved. */
export interface OrderChangeContextItem {
  id: string;
  orderId: string;
  productId: string | null;
  productName: string | null;
  productName2: string | null;
  serviceCategoryCode: string | null;
  quantity: number | null;
  pricePerUnit: string;
  totalPrice: string;
  priceOverride: string | null;
  preferenceCharge: string;
  packingPreferenceCode: string | null;
  /** Always true because the context query includes only explicitly active governed commercial rows. */
  active: true;
}

/** Read-only piece facts with their real parent item UUID. */
export interface OrderChangeContextPiece {
  id: string;
  orderId: string;
  orderItemId: string;
  pieceSeq: number;
  pieceStatus: string | null;
  pieceStage: string | null;
  scanState: string | null;
  /** Always true because the context query includes only explicitly active governed commercial rows. */
  active: true;
}

/** Read-only unified preference facts with the persisted hierarchy preserved. */
export interface OrderChangeContextPreference {
  id: string;
  orderId: string;
  level: string;
  orderItemId: string | null;
  orderItemPieceId: string | null;
  preferenceId: string | null;
  preferenceCode: string;
  preferenceKind: string | null;
  preferenceCategory: string | null;
  preferenceContent: string | null;
  extraPrice: string;
  processingConfirmed: boolean;
  /** Always true because the context query includes only explicitly active governed commercial rows. */
  active: true;
}

/** Authoritative, read-only aggregate returned by GET change-context. */
export interface OrderChangeContext {
  orderId: string;
  orderNo: string;
  committedAt: string;
  /** Optimistic-concurrency token for future commercial Change application. */
  editStateVersion: number;
  /** Workflow-version token prevents evaluating a Change against stale workflow facts. */
  wfStateVersion: number;
  workflow: {
    currentStatus: string | null;
    profileId: string | null;
    profileVersionId: string | null;
  };
  editAccess: {
    status: string;
    reasonCode: string | null;
    reasonText: string | null;
    blockedUntil: string | null;
  };
  permissions: {
    canEdit: false;
    canOverride: false;
    canOverridePrice: false;
  };
  configuration: {
    featureEnabled: false;
    newItemPricePolicy: null;
    existingDiscountPolicy: null;
    reasonPolicy: null;
    /** Explains why policy-derived capability values remain unavailable before WP05. */
    deferredReason: string;
  };
  order: {
    customer: { id: string | null };
    customerSnapshot: { name: string | null; mobile: string | null; email: string | null };
    branchId: string | null;
    currencyCode: string | null;
    priority: string | null;
    serviceSpeed: string | null;
    readyBy: string | null;
    notes: string | null;
    customerNotes: string | null;
  };
  items: OrderChangeContextItem[];
  pieces: OrderChangeContextPiece[];
  preferences: OrderChangeContextPreference[];
  financial: {
    totalAmount: string;
    netCollectedAmount: string;
    outstandingAmount: string;
    overpaidAmount: string;
  };
  capabilitySummary: {
    /** Explicitly communicates that this read model grants no edit capability by itself. */
    status: 'DEFERRED';
    reasonCode: string;
  };
}

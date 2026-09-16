export type OutboxStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'FAILED'
  | 'DEAD_LETTERED';

export type OutboxRelatedKind =
  | 'order'
  | 'invoice'
  | 'voucher'
  | 'pending_payments'
  | 'refunds'
  | 'customer';

export interface OutboxRelatedLink {
  href: string;
  label: string;
  kind: OutboxRelatedKind;
}

export interface OutboxHandlerCatalogEntry {
  handler: string;
  eventTypes: readonly string[];
}

export interface OutboxMonitorEvent {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  status: OutboxStatus | string;
  attempts: number;
  max_attempts: number;
  next_retry_at: string | null;
  processed_at: string | null;
  error_message: string | null;
  created_at: string;
  handlers: string[];
  hasConsumer: boolean;
  ageMinutes: number;
  isStuck: boolean;
  retryable: boolean;
  relatedLabel: string | null;
  relatedLinks: OutboxRelatedLink[];
}

export interface OutboxMonitorEventDetail extends OutboxMonitorEvent {
  payload: unknown;
  relatedEvents: OutboxMonitorEvent[];
}

export interface OutboxMonitorCounts {
  pending: number;
  processing: number;
  failed: number;
  deadLettered: number;
  processedLast24h: number;
  stuck: number;
  attention: number;
}

export interface OutboxMonitorHealth {
  oldestPendingAt: string | null;
  oldestPendingAgeMinutes: number | null;
  lastProcessedAt: string | null;
  processorHint: 'healthy' | 'backlog' | 'stuck' | 'idle';
}

export interface OutboxListResponse {
  counts: OutboxMonitorCounts;
  health: OutboxMonitorHealth;
  events: OutboxMonitorEvent[];
  eventTypes: string[];
  aggregateTypes: string[];
  handlerCatalog: OutboxHandlerCatalogEntry[];
}

export interface OutboxListQuery {
  page: number;
  limit: number;
  status: string;
  eventType: string;
  aggregateType: string;
  search: string;
  stuckOnly: boolean;
  from: string;
  to: string;
}

export interface OutboxPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  OUTBOX_EVENT_TYPES,
  OUTBOX_HANDLER_CATALOG,
  OUTBOX_STATUSES,
  outboxHandlersForEventType,
  type OutboxStatus,
} from '@/lib/constants/order-financial';
import { manualRetryMany, OUTBOX_BULK_RETRY_MAX } from '@/lib/services/outbox.service';

const STATUS_VALUES = Object.values(OUTBOX_STATUSES);
const STUCK_PENDING_FAILED_MS = 60 * 60 * 1000;
const STUCK_PROCESSING_MS = 5 * 60 * 1000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const OUTBOX_PAGE_SIZE_MAX = 50;

export interface OutboxListFilters {
  status?: OutboxStatus;
  eventType?: string;
  aggregateType?: string;
  search?: string;
  stuckOnly?: boolean;
  from?: Date;
  to?: Date;
}

export interface OutboxRelatedLink {
  href: string;
  label: string;
  kind: 'order' | 'invoice' | 'voucher' | 'pending_payments' | 'refunds' | 'customer';
}

export interface OutboxMonitorEvent {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  status: string;
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
  payload: Prisma.JsonValue;
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

export interface OutboxListResult {
  counts: OutboxMonitorCounts;
  health: OutboxMonitorHealth;
  events: OutboxMonitorEvent[];
  total: number;
  eventTypes: string[];
  aggregateTypes: string[];
  handlerCatalog: typeof OUTBOX_HANDLER_CATALOG;
}

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function asRecord(payload: Prisma.JsonValue): Record<string, unknown> {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return payload as Record<string, unknown>;
  }
  return {};
}

function payloadString(payload: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === 'string' && value.trim().length > 0) return value;
  }
  return null;
}

function isStuckEvent(status: string, createdAt: Date, now: Date): boolean {
  const ageMs = now.getTime() - createdAt.getTime();
  if (status === OUTBOX_STATUSES.PROCESSING) return ageMs >= STUCK_PROCESSING_MS;
  if (status === OUTBOX_STATUSES.PENDING || status === OUTBOX_STATUSES.FAILED) {
    return ageMs >= STUCK_PENDING_FAILED_MS;
  }
  return false;
}

function stuckWhere(now: Date): Prisma.org_domain_events_outboxWhereInput {
  const pendingFailedCutoff = new Date(now.getTime() - STUCK_PENDING_FAILED_MS);
  const processingCutoff = new Date(now.getTime() - STUCK_PROCESSING_MS);
  return {
    OR: [
      {
        status: { in: [OUTBOX_STATUSES.PENDING, OUTBOX_STATUSES.FAILED] },
        created_at: { lte: pendingFailedCutoff },
      },
      {
        status: OUTBOX_STATUSES.PROCESSING,
        created_at: { lte: processingCutoff },
      },
    ],
  };
}

export function buildOutboxWhere(
  tenantId: string,
  filters: OutboxListFilters,
  now = new Date(),
): Prisma.org_domain_events_outboxWhereInput {
  const clauses: Prisma.org_domain_events_outboxWhereInput[] = [{ tenant_org_id: tenantId }];

  if (filters.status) clauses.push({ status: filters.status });
  if (filters.eventType) clauses.push({ event_type: filters.eventType });
  if (filters.aggregateType) clauses.push({ aggregate_type: filters.aggregateType });
  if (filters.from || filters.to) {
    clauses.push({
      created_at: {
        ...(filters.from ? { gte: filters.from } : {}),
        ...(filters.to ? { lte: filters.to } : {}),
      },
    });
  }
  if (filters.stuckOnly) clauses.push(stuckWhere(now));

  const search = filters.search?.trim();
  if (search) {
    const or: Prisma.org_domain_events_outboxWhereInput[] = [
      { event_type: { contains: search, mode: 'insensitive' } },
      { aggregate_type: { contains: search, mode: 'insensitive' } },
      { error_message: { contains: search, mode: 'insensitive' } },
    ];
    if (isUuid(search)) {
      or.push({ id: search }, { aggregate_id: search });
    }
    clauses.push({ OR: or });
  }

  return { AND: clauses };
}

function mapEventBase(
  row: {
    id: string;
    event_type: string;
    aggregate_type: string;
    aggregate_id: string;
    status: string;
    attempts: number | null;
    max_attempts: number | null;
    next_retry_at: Date | null;
    processed_at: Date | null;
    error_message: string | null;
    created_at: Date;
  },
  now: Date,
  relatedLabel: string | null,
  relatedLinks: OutboxRelatedLink[],
): OutboxMonitorEvent {
  const handlers = outboxHandlersForEventType(row.event_type);
  const status = row.status;
  return {
    id: row.id,
    event_type: row.event_type,
    aggregate_type: row.aggregate_type,
    aggregate_id: row.aggregate_id,
    status,
    attempts: row.attempts ?? 0,
    max_attempts: row.max_attempts ?? 6,
    next_retry_at: iso(row.next_retry_at),
    processed_at: iso(row.processed_at),
    error_message: row.error_message,
    created_at: row.created_at.toISOString(),
    handlers,
    hasConsumer: handlers.length > 0,
    ageMinutes: Math.max(0, Math.floor((now.getTime() - row.created_at.getTime()) / 60_000)),
    isStuck: isStuckEvent(status, row.created_at, now),
    retryable: status === OUTBOX_STATUSES.FAILED || status === OUTBOX_STATUSES.DEAD_LETTERED,
    relatedLabel,
    relatedLinks,
  };
}

async function resolveRelated(
  tenantId: string,
  rows: Array<{
    aggregate_type: string;
    aggregate_id: string;
    event_type: string;
    payload: Prisma.JsonValue;
  }>,
): Promise<Map<string, { label: string | null; links: OutboxRelatedLink[] }>> {
  const orderIds = new Set<string>();
  const invoiceIds = new Set<string>();
  const voucherIds = new Set<string>();
  const paymentIds = new Set<string>();

  for (const row of rows) {
    const payload = asRecord(row.payload);
    const payloadOrderId = payloadString(payload, 'orderId', 'order_id');
    if (row.aggregate_type === 'order' || payloadOrderId) {
      orderIds.add(payloadOrderId ?? row.aggregate_id);
    }
    if (row.aggregate_type === 'ar_invoice') invoiceIds.add(row.aggregate_id);
    if (row.aggregate_type === 'fin_voucher') voucherIds.add(row.aggregate_id);
    if (row.aggregate_type === 'order_payment' || row.aggregate_type === 'payment') {
      paymentIds.add(row.aggregate_id);
      if (payloadOrderId) orderIds.add(payloadOrderId);
    }
  }

  const [orders, invoices, vouchers, payments] = await Promise.all([
    orderIds.size
      ? prisma.org_orders_mst.findMany({
          where: { tenant_org_id: tenantId, id: { in: [...orderIds] } },
          select: { id: true, order_no: true },
        })
      : Promise.resolve([]),
    invoiceIds.size
      ? prisma.org_invoice_mst.findMany({
          where: { tenant_org_id: tenantId, id: { in: [...invoiceIds] } },
          select: { id: true, invoice_no: true, order_id: true },
        })
      : Promise.resolve([]),
    voucherIds.size
      ? prisma.org_fin_vouchers_mst.findMany({
          where: { tenant_org_id: tenantId, id: { in: [...voucherIds] } },
          select: { id: true, voucher_no: true, order_id: true },
        })
      : Promise.resolve([]),
    paymentIds.size
      ? prisma.org_order_payments_dtl.findMany({
          where: { tenant_org_id: tenantId, id: { in: [...paymentIds] } },
          select: { id: true, order_id: true },
        })
      : Promise.resolve([]),
  ]);

  const orderNoById = new Map(orders.map((row) => [row.id, row.order_no]));
  const invoiceById = new Map(invoices.map((row) => [row.id, row]));
  const voucherById = new Map(vouchers.map((row) => [row.id, row]));
  const paymentOrderById = new Map(payments.map((row) => [row.id, row.order_id]));

  const extraOrderIds = new Set<string>();
  for (const invoice of invoices) {
    if (invoice.order_id) extraOrderIds.add(invoice.order_id);
  }
  for (const voucher of vouchers) {
    if (voucher.order_id) extraOrderIds.add(voucher.order_id);
  }
  for (const orderId of paymentOrderById.values()) extraOrderIds.add(orderId);
  const missingOrderIds = [...extraOrderIds].filter((id) => !orderNoById.has(id));
  if (missingOrderIds.length > 0) {
    const extraOrders = await prisma.org_orders_mst.findMany({
      where: { tenant_org_id: tenantId, id: { in: missingOrderIds } },
      select: { id: true, order_no: true },
    });
    for (const row of extraOrders) orderNoById.set(row.id, row.order_no);
  }

  const result = new Map<string, { label: string | null; links: OutboxRelatedLink[] }>();
  for (const row of rows) {
    const key = `${row.aggregate_type}:${row.aggregate_id}:${row.event_type}`;
    const payload = asRecord(row.payload);
    const links: OutboxRelatedLink[] = [];
    let label: string | null = null;

    const payloadOrderId = payloadString(payload, 'orderId', 'order_id');
    const paymentOrderId = paymentOrderById.get(row.aggregate_id) ?? payloadOrderId;
    const orderId =
      row.aggregate_type === 'order' ? row.aggregate_id : paymentOrderId;

    if (row.aggregate_type === 'order' || orderId) {
      const resolvedOrderId = orderId ?? row.aggregate_id;
      const orderNo = orderNoById.get(resolvedOrderId) ?? null;
      if (orderNo) label = orderNo;
      links.push({
        href: `/dashboard/orders/${resolvedOrderId}`,
        label: orderNo ?? resolvedOrderId.slice(0, 8),
        kind: 'order',
      });
    }

    if (row.aggregate_type === 'ar_invoice') {
      const invoice = invoiceById.get(row.aggregate_id);
      label = invoice?.invoice_no ?? label;
      links.push({
        href: `/dashboard/internal_fin/invoices/${row.aggregate_id}`,
        label: invoice?.invoice_no ?? row.aggregate_id.slice(0, 8),
        kind: 'invoice',
      });
      if (invoice?.order_id && !links.some((link) => link.kind === 'order')) {
        links.push({
          href: `/dashboard/orders/${invoice.order_id}`,
          label: orderNoById.get(invoice.order_id) ?? invoice.order_id.slice(0, 8),
          kind: 'order',
        });
      }
    }

    if (row.aggregate_type === 'fin_voucher') {
      const voucher = voucherById.get(row.aggregate_id);
      label = voucher?.voucher_no ?? label;
      links.push({
        href: `/dashboard/internal_fin/vouchers/${row.aggregate_id}`,
        label: voucher?.voucher_no ?? row.aggregate_id.slice(0, 8),
        kind: 'voucher',
      });
      if (voucher?.order_id && !links.some((link) => link.kind === 'order')) {
        links.push({
          href: `/dashboard/orders/${voucher.order_id}`,
          label: orderNoById.get(voucher.order_id) ?? voucher.order_id.slice(0, 8),
          kind: 'order',
        });
      }
    }

    if (row.aggregate_type === 'order_payment' || row.aggregate_type === 'payment') {
      links.push({
        href: '/dashboard/internal_fin/pending-payments',
        label: 'pending-payments',
        kind: 'pending_payments',
      });
    }

    if (row.event_type === OUTBOX_EVENT_TYPES.REFUND_PROCESSED) {
      links.push({
        href: '/dashboard/internal_fin/refunds',
        label: 'refunds',
        kind: 'refunds',
      });
    }

    const customerId = payloadString(payload, 'customerId', 'customer_id');
    if (customerId && isUuid(customerId)) {
      links.push({
        href: `/dashboard/customers/${customerId}`,
        label: customerId.slice(0, 8),
        kind: 'customer',
      });
    }

    result.set(key, { label, links });
  }

  return result;
}

function relatedKey(row: { aggregate_type: string; aggregate_id: string; event_type: string }): string {
  return `${row.aggregate_type}:${row.aggregate_id}:${row.event_type}`;
}

async function enrichEvents<T extends {
  id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  status: string;
  attempts: number | null;
  max_attempts: number | null;
  next_retry_at: Date | null;
  processed_at: Date | null;
  error_message: string | null;
  created_at: Date;
  payload: Prisma.JsonValue;
}>(tenantId: string, rows: T[], now: Date): Promise<OutboxMonitorEvent[]> {
  const related = await resolveRelated(tenantId, rows);
  return rows.map((row) => {
    const info = related.get(relatedKey(row));
    return mapEventBase(row, now, info?.label ?? null, info?.links ?? []);
  });
}

export async function listOutboxMonitor(
  tenantId: string,
  filters: OutboxListFilters,
  page: number,
  limit: number,
): Promise<OutboxListResult> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const where = buildOutboxWhere(tenantId, filters, now);
  const tenantWhere = { tenant_org_id: tenantId };

  const [
    pending,
    processing,
    failed,
    deadLettered,
    processedLast24h,
    stuck,
    total,
    events,
    oldestPending,
    lastProcessed,
    eventTypeGroups,
    aggregateTypeGroups,
  ] = await Promise.all([
    prisma.org_domain_events_outbox.count({ where: { ...tenantWhere, status: OUTBOX_STATUSES.PENDING } }),
    prisma.org_domain_events_outbox.count({ where: { ...tenantWhere, status: OUTBOX_STATUSES.PROCESSING } }),
    prisma.org_domain_events_outbox.count({ where: { ...tenantWhere, status: OUTBOX_STATUSES.FAILED } }),
    prisma.org_domain_events_outbox.count({ where: { ...tenantWhere, status: OUTBOX_STATUSES.DEAD_LETTERED } }),
    prisma.org_domain_events_outbox.count({
      where: { ...tenantWhere, status: OUTBOX_STATUSES.PROCESSED, processed_at: { gte: dayAgo } },
    }),
    prisma.org_domain_events_outbox.count({ where: { ...tenantWhere, ...stuckWhere(now) } }),
    prisma.org_domain_events_outbox.count({ where }),
    prisma.org_domain_events_outbox.findMany({
      where,
      orderBy: { created_at: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.org_domain_events_outbox.findFirst({
      where: { ...tenantWhere, status: OUTBOX_STATUSES.PENDING },
      orderBy: { created_at: 'asc' },
      select: { created_at: true },
    }),
    prisma.org_domain_events_outbox.findFirst({
      where: { ...tenantWhere, status: OUTBOX_STATUSES.PROCESSED, processed_at: { not: null } },
      orderBy: { processed_at: 'desc' },
      select: { processed_at: true },
    }),
    prisma.org_domain_events_outbox.groupBy({
      by: ['event_type'],
      where: tenantWhere,
      _count: { _all: true },
      orderBy: { event_type: 'asc' },
    }),
    prisma.org_domain_events_outbox.groupBy({
      by: ['aggregate_type'],
      where: tenantWhere,
      _count: { _all: true },
      orderBy: { aggregate_type: 'asc' },
    }),
  ]);

  const attention = failed + deadLettered + stuck;
  const oldestPendingAt = oldestPending?.created_at ?? null;
  const oldestPendingAgeMinutes = oldestPendingAt
    ? Math.max(0, Math.floor((now.getTime() - oldestPendingAt.getTime()) / 60_000))
    : null;

  let processorHint: OutboxMonitorHealth['processorHint'] = 'healthy';
  if (stuck > 0) processorHint = 'stuck';
  else if (pending + failed > 0) processorHint = 'backlog';
  else if (processedLast24h === 0 && pending === 0) processorHint = 'idle';

  const knownEventTypes = new Set<string>(Object.values(OUTBOX_EVENT_TYPES));
  const eventTypes = [
    ...new Set([...eventTypeGroups.map((row) => row.event_type), ...knownEventTypes]),
  ].sort();

  return {
    counts: {
      pending,
      processing,
      failed,
      deadLettered,
      processedLast24h,
      stuck,
      attention,
    },
    health: {
      oldestPendingAt: iso(oldestPendingAt),
      oldestPendingAgeMinutes,
      lastProcessedAt: iso(lastProcessed?.processed_at ?? null),
      processorHint,
    },
    events: await enrichEvents(tenantId, events, now),
    total,
    eventTypes,
    aggregateTypes: aggregateTypeGroups.map((row) => row.aggregate_type),
    handlerCatalog: OUTBOX_HANDLER_CATALOG,
  };
}

export async function getOutboxMonitorEvent(
  tenantId: string,
  eventId: string,
): Promise<OutboxMonitorEventDetail | null> {
  const now = new Date();
  const event = await prisma.org_domain_events_outbox.findFirst({
    where: { id: eventId, tenant_org_id: tenantId },
  });
  if (!event) return null;

  const relatedRows = await prisma.org_domain_events_outbox.findMany({
    where: {
      tenant_org_id: tenantId,
      aggregate_id: event.aggregate_id,
      id: { not: event.id },
    },
    orderBy: { created_at: 'desc' },
    take: 8,
  });

  const [mappedEvent, mappedRelated] = await Promise.all([
    enrichEvents(tenantId, [event], now),
    enrichEvents(tenantId, relatedRows, now),
  ]);

  const head = mappedEvent[0];
  if (!head) return null;

  return {
    ...head,
    payload: event.payload,
    relatedEvents: mappedRelated,
  };
}

export async function bulkRetryOutbox(
  tenantId: string,
  input: { ids?: string[]; filters?: OutboxListFilters },
): Promise<{ retried: number; requested: number }> {
  if (input.ids && input.ids.length > 0) {
    const requested = Math.min(input.ids.length, OUTBOX_BULK_RETRY_MAX);
    const retried = await manualRetryMany(input.ids, tenantId);
    return { retried, requested };
  }

  const filters: OutboxListFilters = { ...(input.filters ?? {}) };
  if (
    filters.status &&
    filters.status !== OUTBOX_STATUSES.FAILED &&
    filters.status !== OUTBOX_STATUSES.DEAD_LETTERED
  ) {
    return { retried: 0, requested: 0 };
  }

  const now = new Date();
  const where = buildOutboxWhere(tenantId, filters, now);
  where.AND = [
    ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
    { status: { in: [OUTBOX_STATUSES.FAILED, OUTBOX_STATUSES.DEAD_LETTERED] } },
  ];

  const rows = await prisma.org_domain_events_outbox.findMany({
    where,
    select: { id: true },
    orderBy: { created_at: 'asc' },
    take: OUTBOX_BULK_RETRY_MAX,
  });
  const retried = await manualRetryMany(rows.map((row) => row.id), tenantId);
  return { retried, requested: rows.length };
}

export function parseOutboxStatus(value: string | null): OutboxStatus | undefined {
  if (!value) return undefined;
  return STATUS_VALUES.includes(value as OutboxStatus) ? (value as OutboxStatus) : undefined;
}

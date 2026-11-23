import type { Prisma } from '@prisma/client';

/**
 * One `org_domain_events_outbox` row as a reaction reads it (docs/features/Background_Jobs).
 * The row is the permanent event log; reactions re-read current data by `aggregate_id`.
 */
export interface DomainEventRow {
  id: string;
  tenant_org_id: string;
  event_type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: Prisma.JsonValue;
  created_at: Date;
}

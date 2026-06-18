import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import {
  AR_DISPUTE_STATUSES,
  AR_INVOICE_STATUSES,
  deriveArInvoiceStatus,
} from '@/lib/constants/ar-invoice';
import type { ArDisputeCase } from '@/lib/types/ar-invoice';
import type {
  ArDisputesQuery,
  CreateArDisputeInput,
  ResolveArDisputeInput,
} from '@/lib/validations/ar-invoice-schemas';

interface ActorContext {
  tenantId?: string;
  userId?: string | null;
}

interface DisputeRow {
  id: string;
  tenant_org_id: string;
  invoice_id: string;
  customer_id: string;
  dispute_no: string;
  status_cd: string;
  reason_cd: string;
  title: string;
  description: string;
  description2: string | null;
  disputed_amount: Prisma.Decimal;
  opened_at: Date;
  opened_by: string | null;
  assigned_to: string | null;
  assigned_at: Date | null;
  due_by_at: Date | null;
  resolved_at: Date | null;
  resolved_by: string | null;
  resolution_summary: string | null;
  metadata: Prisma.JsonValue;
  invoice_no: string | null;
  customer_name: string | null;
  customer_name2: string | null;
}

function toNumber(value: unknown): number {
  return Number(value ?? 0);
}

function parseJsonRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

async function resolveTenantId(inputTenantId?: string): Promise<string> {
  const tenantId = inputTenantId ?? (await getTenantIdFromSession());
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }
  return tenantId;
}

function buildDisputeNo(): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
  const entropy = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `ARD-${stamp}-${entropy}`;
}

function mapDispute(row: DisputeRow): ArDisputeCase {
  return {
    id: row.id,
    tenant_org_id: row.tenant_org_id,
    invoice_id: row.invoice_id,
    customer_id: row.customer_id,
    dispute_no: row.dispute_no,
    status_cd: row.status_cd as ArDisputeCase['status_cd'],
    reason_cd: row.reason_cd,
    title: row.title,
    description: row.description,
    description2: row.description2 ?? undefined,
    disputed_amount: toNumber(row.disputed_amount),
    opened_at: row.opened_at.toISOString(),
    opened_by: row.opened_by ?? undefined,
    assigned_to: row.assigned_to ?? undefined,
    assigned_at: row.assigned_at?.toISOString(),
    due_by_at: row.due_by_at?.toISOString(),
    resolved_at: row.resolved_at?.toISOString(),
    resolved_by: row.resolved_by ?? undefined,
    resolution_summary: row.resolution_summary ?? undefined,
    metadata: parseJsonRecord(row.metadata),
    invoice_no: row.invoice_no ?? undefined,
    customer_name: row.customer_name ?? undefined,
    customer_name2: row.customer_name2 ?? undefined,
  };
}

/**
 *
 * @param query
 * @param actor
 */
export async function listArDisputes(
  query: ArDisputesQuery,
  actor: ActorContext = {}
): Promise<{
  data: ArDisputeCase[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const tenantId = await resolveTenantId(actor.tenantId);
  const offset = (query.page - 1) * query.limit;
  const conditions: Prisma.Sql[] = [Prisma.sql`disp.tenant_org_id = ${tenantId}::uuid`];

  if (query.status_cd) {
    conditions.push(Prisma.sql`disp.status_cd = ${query.status_cd}`);
  }
  if (query.customer_id) {
    conditions.push(Prisma.sql`disp.customer_id = ${query.customer_id}::uuid`);
  }
  if (query.invoice_id) {
    conditions.push(Prisma.sql`disp.invoice_id = ${query.invoice_id}::uuid`);
  }
  if (query.search?.trim()) {
    const search = `%${query.search.trim()}%`;
    conditions.push(
      Prisma.sql`(
        disp.dispute_no ILIKE ${search}
        OR disp.title ILIKE ${search}
        OR inv.invoice_no ILIKE ${search}
        OR cust.name ILIKE ${search}
        OR cust.name2 ILIKE ${search}
      )`
    );
  }

  const whereClause = Prisma.join(conditions, ' AND ');

  return withTenantContext(tenantId, async () => {
    const rows = await prisma.$queryRaw<DisputeRow[]>(Prisma.sql`
      SELECT
        disp.id,
        disp.tenant_org_id,
        disp.invoice_id,
        disp.customer_id,
        disp.dispute_no,
        disp.status_cd,
        disp.reason_cd,
        disp.title,
        disp.description,
        disp.description2,
        disp.disputed_amount,
        disp.opened_at,
        disp.opened_by,
        disp.assigned_to,
        disp.assigned_at,
        disp.due_by_at,
        disp.resolved_at,
        disp.resolved_by,
        disp.resolution_summary,
        disp.metadata,
        inv.invoice_no,
        cust.name AS customer_name,
        cust.name2 AS customer_name2
      FROM public.org_ar_disputes_mst disp
      INNER JOIN public.org_invoice_mst inv
        ON inv.id = disp.invoice_id
       AND inv.tenant_org_id = disp.tenant_org_id
      INNER JOIN public.org_customers_mst cust
        ON cust.id = disp.customer_id
       AND cust.tenant_org_id = disp.tenant_org_id
      WHERE ${whereClause}
      ORDER BY disp.opened_at DESC
      OFFSET ${offset}
      LIMIT ${query.limit}
    `);

    const totals = await prisma.$queryRaw<Array<{ total_count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total_count
      FROM public.org_ar_disputes_mst disp
      INNER JOIN public.org_invoice_mst inv
        ON inv.id = disp.invoice_id
       AND inv.tenant_org_id = disp.tenant_org_id
      INNER JOIN public.org_customers_mst cust
        ON cust.id = disp.customer_id
       AND cust.tenant_org_id = disp.tenant_org_id
      WHERE ${whereClause}
    `);

    const total = Number(totals[0]?.total_count ?? 0);
    return {
      data: rows.map(mapDispute),
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.ceil(total / query.limit),
    };
  });
}

/**
 *
 * @param input
 * @param actor
 */
export async function createArDispute(
  input: CreateArDisputeInput,
  actor: ActorContext = {}
): Promise<ArDisputeCase> {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  return withTenantContext(tenantId, async () =>
    prisma.$transaction(async (tx) => {
      const invoice = await tx.org_invoice_mst.findUnique({
        where: {
          id_tenant_org_id: {
            id: input.invoice_id,
            tenant_org_id: tenantId,
          },
        },
        select: {
          id: true,
          customer_id: true,
          invoice_no: true,
          status: true,
        },
      });

      if (!invoice) {
        throw new Error('AR invoice not found.');
      }
      if (!invoice.customer_id || invoice.customer_id !== input.customer_id) {
        throw new Error('Dispute customer must match the invoice customer.');
      }

      const disputeNo = buildDisputeNo();
      const inserted = await tx.$queryRaw<DisputeRow[]>(Prisma.sql`
        INSERT INTO public.org_ar_disputes_mst (
          tenant_org_id,
          invoice_id,
          customer_id,
          dispute_no,
          status_cd,
          reason_cd,
          title,
          description,
          description2,
          disputed_amount,
          due_by_at,
          metadata,
          opened_by,
          created_by,
          updated_by
        )
        VALUES (
          ${tenantId}::uuid,
          ${input.invoice_id}::uuid,
          ${input.customer_id}::uuid,
          ${disputeNo},
          ${AR_DISPUTE_STATUSES.OPEN},
          ${input.reason_cd},
          ${input.title},
          ${input.description},
          ${input.description2 ?? null},
          ${input.disputed_amount},
          ${input.due_by_at ? new Date(input.due_by_at) : null},
          ${JSON.stringify(input.metadata ?? {})}::jsonb,
          ${userId},
          ${userId},
          ${userId}
        )
        RETURNING
          id,
          tenant_org_id,
          invoice_id,
          customer_id,
          dispute_no,
          status_cd,
          reason_cd,
          title,
          description,
          description2,
          disputed_amount,
          opened_at,
          opened_by,
          assigned_to,
          assigned_at,
          due_by_at,
          resolved_at,
          resolved_by,
          resolution_summary,
          metadata,
          ${invoice.invoice_no}::varchar AS invoice_no,
          NULL::varchar AS customer_name,
          NULL::varchar AS customer_name2
      `);

      await tx.org_invoice_mst.update({
        where: {
          id_tenant_org_id: {
            id: input.invoice_id,
            tenant_org_id: tenantId,
          },
        },
        data: {
          status: AR_INVOICE_STATUSES.DISPUTED,
          updated_at: new Date(),
          updated_by: userId,
        },
      });

      await tx.org_invoice_status_history_dtl.create({
        data: {
          tenant_org_id: tenantId,
          invoice_id: input.invoice_id,
          from_status: invoice.status,
          to_status: AR_INVOICE_STATUSES.DISPUTED,
          action_cd: 'CREATE_DISPUTE',
          reason: input.reason_cd,
          metadata: {
            dispute_id: inserted[0].id,
            dispute_no: disputeNo,
          },
          created_by: userId,
          updated_by: userId,
        },
      });

      return mapDispute(inserted[0]);
    })
  );
}

/**
 *
 * @param disputeId
 * @param input
 * @param actor
 */
export async function resolveArDispute(
  disputeId: string,
  input: ResolveArDisputeInput,
  actor: ActorContext = {}
): Promise<ArDisputeCase> {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  return withTenantContext(tenantId, async () =>
    prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<DisputeRow[]>(Prisma.sql`
        SELECT
          disp.id,
          disp.tenant_org_id,
          disp.invoice_id,
          disp.customer_id,
          disp.dispute_no,
          disp.status_cd,
          disp.reason_cd,
          disp.title,
          disp.description,
          disp.description2,
          disp.disputed_amount,
          disp.opened_at,
          disp.opened_by,
          disp.assigned_to,
          disp.assigned_at,
          disp.due_by_at,
          disp.resolved_at,
          disp.resolved_by,
          disp.resolution_summary,
          disp.metadata,
          inv.invoice_no,
          cust.name AS customer_name,
          cust.name2 AS customer_name2
        FROM public.org_ar_disputes_mst disp
        INNER JOIN public.org_invoice_mst inv
          ON inv.id = disp.invoice_id
         AND inv.tenant_org_id = disp.tenant_org_id
        INNER JOIN public.org_customers_mst cust
          ON cust.id = disp.customer_id
         AND cust.tenant_org_id = disp.tenant_org_id
        WHERE disp.tenant_org_id = ${tenantId}::uuid
          AND disp.id = ${disputeId}::uuid
        LIMIT 1
      `);

      const dispute = rows[0];
      if (!dispute) {
        throw new Error('AR dispute not found.');
      }
      if (
        dispute.status_cd === AR_DISPUTE_STATUSES.RESOLVED ||
        dispute.status_cd === AR_DISPUTE_STATUSES.REJECTED ||
        dispute.status_cd === AR_DISPUTE_STATUSES.CANCELLED
      ) {
        throw new Error('This AR dispute is already closed.');
      }

      const invoice = await tx.org_invoice_mst.findUnique({
        where: {
          id_tenant_org_id: {
            id: dispute.invoice_id,
            tenant_org_id: tenantId,
          },
        },
        select: {
          total: true,
          paid_amount: true,
          due_date: true,
          status: true,
        },
      });
      if (!invoice) {
        throw new Error('AR invoice not found.');
      }

      const normalizedStatus = deriveArInvoiceStatus({
        currentStatus: AR_INVOICE_STATUSES.OPEN,
        totalAmount: Number(invoice.total ?? 0),
        paidAmount: Number(invoice.paid_amount ?? 0),
        dueDate: invoice.due_date,
      });

      const updated = await tx.$queryRaw<DisputeRow[]>(Prisma.sql`
        UPDATE public.org_ar_disputes_mst
        SET
          status_cd = ${input.status_cd},
          resolved_at = CURRENT_TIMESTAMP,
          resolved_by = ${userId},
          resolution_summary = ${input.resolution_summary},
          updated_at = CURRENT_TIMESTAMP,
          updated_by = ${userId}
        WHERE tenant_org_id = ${tenantId}::uuid
          AND id = ${disputeId}::uuid
        RETURNING
          id,
          tenant_org_id,
          invoice_id,
          customer_id,
          dispute_no,
          status_cd,
          reason_cd,
          title,
          description,
          description2,
          disputed_amount,
          opened_at,
          opened_by,
          assigned_to,
          assigned_at,
          due_by_at,
          resolved_at,
          resolved_by,
          resolution_summary,
          metadata,
          ${dispute.invoice_no}::varchar AS invoice_no,
          ${dispute.customer_name}::varchar AS customer_name,
          ${dispute.customer_name2}::varchar AS customer_name2
      `);

      await tx.org_invoice_mst.update({
        where: {
          id_tenant_org_id: {
            id: dispute.invoice_id,
            tenant_org_id: tenantId,
          },
        },
        data: {
          status: normalizedStatus,
          updated_at: new Date(),
          updated_by: userId,
        },
      });

      await tx.org_invoice_status_history_dtl.create({
        data: {
          tenant_org_id: tenantId,
          invoice_id: dispute.invoice_id,
          from_status: invoice.status,
          to_status: normalizedStatus,
          action_cd: 'RESOLVE_DISPUTE',
          reason: input.status_cd,
          metadata: {
            dispute_id: dispute.id,
            dispute_no: dispute.dispute_no,
            dispute_status: input.status_cd,
          },
          created_by: userId,
          updated_by: userId,
        },
      });

      return mapDispute(updated[0]);
    })
  );
}

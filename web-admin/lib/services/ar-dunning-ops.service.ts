import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import {
  AR_DUNNING_ACTIONS,
  AR_DUNNING_RUN_STATUSES,
} from '@/lib/constants/ar-invoice';
import type { ArDunningRun } from '@/lib/types/ar-invoice';
import type {
  ArDunningQuery,
  RunArDunningInput,
} from '@/lib/validations/ar-invoice-schemas';
import { sendEmail } from '@/lib/notifications/email-sender';
import { sendSMS } from '@/lib/notifications/sms-sender';

interface ActorContext {
  tenantId?: string;
  userId?: string | null;
}

interface DunningRunRow {
  id: string;
  tenant_org_id: string;
  customer_id: string;
  invoice_id: string | null;
  run_no: number;
  stage_cd: string;
  action_cd: string;
  status_cd: string;
  scheduled_for: Date | null;
  executed_at: Date | null;
  response_message: string | null;
  metadata: Prisma.JsonValue;
  customer_name: string | null;
  customer_name2: string | null;
  invoice_no: string | null;
}

async function resolveTenantId(inputTenantId?: string): Promise<string> {
  const tenantId = inputTenantId ?? (await getTenantIdFromSession());
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID required');
  }
  return tenantId;
}

function parseJsonRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function mapRun(row: DunningRunRow): ArDunningRun {
  return {
    id: row.id,
    tenant_org_id: row.tenant_org_id,
    customer_id: row.customer_id,
    invoice_id: row.invoice_id ?? undefined,
    run_no: row.run_no,
    stage_cd: row.stage_cd as ArDunningRun['stage_cd'],
    action_cd: row.action_cd as ArDunningRun['action_cd'],
    status_cd: row.status_cd as ArDunningRun['status_cd'],
    scheduled_for: row.scheduled_for?.toISOString(),
    executed_at: row.executed_at?.toISOString(),
    response_message: row.response_message ?? undefined,
    metadata: parseJsonRecord(row.metadata),
    customer_name: row.customer_name ?? undefined,
    customer_name2: row.customer_name2 ?? undefined,
    invoice_no: row.invoice_no ?? undefined,
  };
}

async function nextRunNoTx(tx: Prisma.TransactionClient, tenantId: string, customerId: string) {
  const rows = await tx.$queryRaw<Array<{ next_no: number }>>(Prisma.sql`
    SELECT COALESCE(MAX(run_no), 0) + 1 AS next_no
    FROM public.org_ar_dunning_runs_mst
    WHERE tenant_org_id = ${tenantId}::uuid
      AND customer_id = ${customerId}::uuid
  `);
  return rows[0]?.next_no ?? 1;
}

/**
 *
 * @param query
 * @param actor
 */
export async function listArDunningRuns(
  query: ArDunningQuery,
  actor: ActorContext = {}
): Promise<{
  data: ArDunningRun[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const tenantId = await resolveTenantId(actor.tenantId);
  const offset = (query.page - 1) * query.limit;
  const conditions: Prisma.Sql[] = [Prisma.sql`run.tenant_org_id = ${tenantId}::uuid`];

  if (query.customer_id) {
    conditions.push(Prisma.sql`run.customer_id = ${query.customer_id}::uuid`);
  }
  if (query.invoice_id) {
    conditions.push(Prisma.sql`run.invoice_id = ${query.invoice_id}::uuid`);
  }
  if (query.status_cd) {
    conditions.push(Prisma.sql`run.status_cd = ${query.status_cd}`);
  }

  const whereClause = Prisma.join(conditions, ' AND ');

  return withTenantContext(tenantId, async () => {
    const rows = await prisma.$queryRaw<DunningRunRow[]>(Prisma.sql`
      SELECT
        run.id,
        run.tenant_org_id,
        run.customer_id,
        run.invoice_id,
        run.run_no,
        run.stage_cd,
        run.action_cd,
        run.status_cd,
        run.scheduled_for,
        run.executed_at,
        run.response_message,
        run.metadata,
        cust.name AS customer_name,
        cust.name2 AS customer_name2,
        inv.invoice_no
      FROM public.org_ar_dunning_runs_mst run
      INNER JOIN public.org_customers_mst cust
        ON cust.id = run.customer_id
       AND cust.tenant_org_id = run.tenant_org_id
      LEFT JOIN public.org_invoice_mst inv
        ON inv.id = run.invoice_id
       AND inv.tenant_org_id = run.tenant_org_id
      WHERE ${whereClause}
      ORDER BY COALESCE(run.executed_at, run.created_at) DESC
      OFFSET ${offset}
      LIMIT ${query.limit}
    `);

    const totals = await prisma.$queryRaw<Array<{ total_count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total_count
      FROM public.org_ar_dunning_runs_mst run
      WHERE ${whereClause}
    `);

    const total = Number(totals[0]?.total_count ?? 0);
    return {
      data: rows.map(mapRun),
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
export async function runArDunningAction(
  input: RunArDunningInput,
  actor: ActorContext = {}
): Promise<ArDunningRun> {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  return withTenantContext(tenantId, async () =>
    prisma.$transaction(async (tx) => {
      const customer = await tx.org_customers_mst.findFirst({
        where: {
          tenant_org_id: tenantId,
          id: input.customer_id,
        },
        select: {
          id: true,
          name: true,
          name2: true,
          email: true,
          phone: true,
        },
      });

      if (!customer) {
        throw new Error('Customer not found.');
      }

      const invoice = input.invoice_id
        ? await tx.org_invoice_mst.findFirst({
            where: {
              tenant_org_id: tenantId,
              id: input.invoice_id,
              customer_id: input.customer_id,
            },
            select: {
              id: true,
              invoice_no: true,
              outstanding_amount: true,
            },
          })
        : null;

      if (input.invoice_id && !invoice) {
        throw new Error('Invoice not found for the selected customer.');
      }

      let statusCd: string = AR_DUNNING_RUN_STATUSES.SENT;
      let responseMessage = 'Dunning action completed.';

      if (input.action_cd === AR_DUNNING_ACTIONS.EMAIL) {
        if (!customer.email) {
          statusCd = AR_DUNNING_RUN_STATUSES.SKIPPED;
          responseMessage = 'Customer has no email address.';
        } else {
          const sent = await sendEmail({
            to: customer.email,
            subject: `Payment reminder${invoice?.invoice_no ? ` for ${invoice.invoice_no}` : ''}`,
            html: `<p>Dear ${customer.name ?? 'customer'},</p><p>This is a reminder about your outstanding receivable${invoice?.invoice_no ? ` on invoice ${invoice.invoice_no}` : ''}.</p><p>${input.notes ?? 'Please arrange payment at your earliest convenience.'}</p>`,
          });
          statusCd = sent ? AR_DUNNING_RUN_STATUSES.SENT : AR_DUNNING_RUN_STATUSES.FAILED;
          responseMessage = sent ? 'Reminder email sent.' : 'Reminder email failed.';
        }
      } else if (input.action_cd === AR_DUNNING_ACTIONS.SMS) {
        if (!customer.phone) {
          statusCd = AR_DUNNING_RUN_STATUSES.SKIPPED;
          responseMessage = 'Customer has no phone number.';
        } else {
          const sent = await sendSMS(
            customer.phone,
            `Reminder${invoice?.invoice_no ? ` ${invoice.invoice_no}` : ''}: ${input.notes ?? 'Please arrange payment for your outstanding balance.'}`
          );
          statusCd = sent ? AR_DUNNING_RUN_STATUSES.SENT : AR_DUNNING_RUN_STATUSES.FAILED;
          responseMessage = sent ? 'Reminder SMS sent.' : 'Reminder SMS failed.';
        }
      } else if (input.action_cd === AR_DUNNING_ACTIONS.HOLD) {
        await tx.org_customers_mst.update({
          where: { id: customer.id },
          data: {
            is_credit_hold: true,
            updated_at: new Date(),
            updated_by: userId,
          },
        });
        responseMessage = 'Customer moved to credit hold.';
      }

      const runNo = await nextRunNoTx(tx, tenantId, input.customer_id);
      const rows = await tx.$queryRaw<DunningRunRow[]>(Prisma.sql`
        INSERT INTO public.org_ar_dunning_runs_mst (
          tenant_org_id,
          customer_id,
          invoice_id,
          run_no,
          stage_cd,
          action_cd,
          status_cd,
          scheduled_for,
          executed_at,
          response_message,
          metadata,
          created_by,
          updated_by
        )
        VALUES (
          ${tenantId}::uuid,
          ${input.customer_id}::uuid,
          ${input.invoice_id ?? null}::uuid,
          ${runNo},
          ${input.stage_cd},
          ${input.action_cd},
          ${statusCd},
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP,
          ${responseMessage},
          ${JSON.stringify({
            notes: input.notes ?? null,
            outstanding_amount: Number(invoice?.outstanding_amount ?? 0),
          })}::jsonb,
          ${userId},
          ${userId}
        )
        RETURNING
          id,
          tenant_org_id,
          customer_id,
          invoice_id,
          run_no,
          stage_cd,
          action_cd,
          status_cd,
          scheduled_for,
          executed_at,
          response_message,
          metadata,
          ${customer.name}::varchar AS customer_name,
          ${customer.name2}::varchar AS customer_name2,
          ${invoice?.invoice_no ?? null}::varchar AS invoice_no
      `);

      return mapRun(rows[0]);
    })
  );
}

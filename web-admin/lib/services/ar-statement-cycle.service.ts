import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import type {
  ArStatementCycle,
  ArStatementCycleCustomer,
} from '@/lib/types/ar-invoice';
import type {
  ArStatementCyclesQuery,
  CreateArStatementCycleInput,
  PreviewArStatementCycleInput,
} from '@/lib/validations/ar-invoice-schemas';

interface ActorContext {
  tenantId?: string;
  userId?: string | null;
}

interface StatementCycleRow {
  id: string;
  tenant_org_id: string;
  cycle_code: string;
  cycle_name: string;
  cycle_name2: string | null;
  cadence_cd: string;
  customer_scope_cd: string;
  day_of_month: number | null;
  day_of_week: number | null;
  issue_day_offset: number;
  due_terms_days: number;
  last_run_at: Date | null;
  next_run_at: Date | null;
  is_active: boolean;
  metadata: Prisma.JsonValue;
}

interface StatementCycleCustomerRow {
  id: string;
  cycle_id: string;
  customer_id: string;
  b2b_contract_id: string | null;
  is_active: boolean;
  customer_name: string | null;
  customer_name2: string | null;
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

function mapCycle(row: StatementCycleRow): ArStatementCycle {
  return {
    id: row.id,
    tenant_org_id: row.tenant_org_id,
    cycle_code: row.cycle_code,
    cycle_name: row.cycle_name,
    cycle_name2: row.cycle_name2 ?? undefined,
    cadence_cd: row.cadence_cd as ArStatementCycle['cadence_cd'],
    customer_scope_cd: row.customer_scope_cd as ArStatementCycle['customer_scope_cd'],
    day_of_month: row.day_of_month ?? undefined,
    day_of_week: row.day_of_week ?? undefined,
    issue_day_offset: row.issue_day_offset,
    due_terms_days: row.due_terms_days,
    last_run_at: row.last_run_at?.toISOString(),
    next_run_at: row.next_run_at?.toISOString(),
    is_active: row.is_active,
    metadata: parseJsonRecord(row.metadata),
  };
}

function mapCycleCustomer(row: StatementCycleCustomerRow): ArStatementCycleCustomer {
  return {
    id: row.id,
    cycle_id: row.cycle_id,
    customer_id: row.customer_id,
    b2b_contract_id: row.b2b_contract_id ?? undefined,
    is_active: row.is_active,
    customer_name: row.customer_name ?? undefined,
    customer_name2: row.customer_name2 ?? undefined,
  };
}

function computeNextRunAt(input: CreateArStatementCycleInput): Date | null {
  const now = new Date();
  if (input.cadence_cd === 'MONTHLY' && input.day_of_month) {
    const candidate = new Date(now.getFullYear(), now.getMonth(), input.day_of_month);
    if (candidate < now) {
      candidate.setMonth(candidate.getMonth() + 1);
    }
    return candidate;
  }
  if (input.cadence_cd === 'WEEKLY' || input.cadence_cd === 'BIWEEKLY') {
    const dayOfWeek = input.day_of_week ?? now.getDay();
    const candidate = new Date(now);
    const delta = (dayOfWeek - now.getDay() + 7) % 7;
    candidate.setDate(now.getDate() + delta);
    if (input.cadence_cd === 'BIWEEKLY' && candidate <= now) {
      candidate.setDate(candidate.getDate() + 14);
    }
    return candidate;
  }
  return null;
}

/**
 *
 * @param query
 * @param actor
 */
export async function listArStatementCycles(
  query: ArStatementCyclesQuery,
  actor: ActorContext = {}
): Promise<{
  data: ArStatementCycle[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const tenantId = await resolveTenantId(actor.tenantId);
  const offset = (query.page - 1) * query.limit;
  const conditions: Prisma.Sql[] = [Prisma.sql`tenant_org_id = ${tenantId}::uuid`];

  if (query.is_active != null) {
    conditions.push(Prisma.sql`is_active = ${query.is_active}`);
  }
  if (query.search?.trim()) {
    const search = `%${query.search.trim()}%`;
    conditions.push(
      Prisma.sql`(
        cycle_code ILIKE ${search}
        OR cycle_name ILIKE ${search}
        OR cycle_name2 ILIKE ${search}
      )`
    );
  }

  const whereClause = Prisma.join(conditions, ' AND ');

  return withTenantContext(tenantId, async () => {
    const rows = await prisma.$queryRaw<StatementCycleRow[]>(Prisma.sql`
      SELECT
        id,
        tenant_org_id,
        cycle_code,
        cycle_name,
        cycle_name2,
        cadence_cd,
        customer_scope_cd,
        day_of_month,
        day_of_week,
        issue_day_offset,
        due_terms_days,
        last_run_at,
        next_run_at,
        is_active,
        metadata
      FROM public.org_ar_stmt_cycles_mst
      WHERE ${whereClause}
      ORDER BY cycle_code ASC
      OFFSET ${offset}
      LIMIT ${query.limit}
    `);

    const totals = await prisma.$queryRaw<Array<{ total_count: bigint }>>(Prisma.sql`
      SELECT COUNT(*)::bigint AS total_count
      FROM public.org_ar_stmt_cycles_mst
      WHERE ${whereClause}
    `);

    const total = Number(totals[0]?.total_count ?? 0);
    return {
      data: rows.map(mapCycle),
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
export async function createArStatementCycle(
  input: CreateArStatementCycleInput,
  actor: ActorContext = {}
): Promise<{
  cycle: ArStatementCycle;
  customers: ArStatementCycleCustomer[];
}> {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;
  const nextRunAt = computeNextRunAt(input);

  return withTenantContext(tenantId, async () =>
    prisma.$transaction(async (tx) => {
      const inserted = await tx.$queryRaw<StatementCycleRow[]>(Prisma.sql`
        INSERT INTO public.org_ar_stmt_cycles_mst (
          tenant_org_id,
          cycle_code,
          cycle_name,
          cycle_name2,
          cadence_cd,
          customer_scope_cd,
          day_of_month,
          day_of_week,
          issue_day_offset,
          due_terms_days,
          next_run_at,
          is_active,
          metadata,
          created_by,
          updated_by
        )
        VALUES (
          ${tenantId}::uuid,
          ${input.cycle_code},
          ${input.cycle_name},
          ${input.cycle_name2 ?? null},
          ${input.cadence_cd},
          ${input.customer_scope_cd},
          ${input.day_of_month ?? null},
          ${input.day_of_week ?? null},
          ${input.issue_day_offset},
          ${input.due_terms_days},
          ${nextRunAt},
          ${input.is_active},
          ${JSON.stringify(input.metadata ?? {})}::jsonb,
          ${userId},
          ${userId}
        )
        RETURNING
          id,
          tenant_org_id,
          cycle_code,
          cycle_name,
          cycle_name2,
          cadence_cd,
          customer_scope_cd,
          day_of_month,
          day_of_week,
          issue_day_offset,
          due_terms_days,
          last_run_at,
          next_run_at,
          is_active,
          metadata
      `);

      const cycleRow = inserted[0];
      const customerRows: ArStatementCycleCustomer[] = [];

      if (input.customer_scope_cd === 'CUSTOM_LIST' && input.customer_ids?.length) {
        for (const customerId of input.customer_ids) {
          const rows = await tx.$queryRaw<StatementCycleCustomerRow[]>(Prisma.sql`
            INSERT INTO public.org_ar_stmt_cycle_cust_dtl (
              tenant_org_id,
              cycle_id,
              customer_id,
              b2b_contract_id,
              is_active,
              metadata,
              created_by,
              updated_by
            )
            SELECT
              ${tenantId}::uuid,
              ${cycleRow.id}::uuid,
              cust.id,
              NULL::uuid,
              true,
              '{}'::jsonb,
              ${userId},
              ${userId}
            FROM public.org_customers_mst cust
            WHERE cust.tenant_org_id = ${tenantId}::uuid
              AND cust.id = ${customerId}::uuid
            RETURNING
              id,
              cycle_id,
              customer_id,
              b2b_contract_id,
              is_active,
              NULL::varchar AS customer_name,
              NULL::varchar AS customer_name2
          `);

          if (rows[0]) {
            customerRows.push(mapCycleCustomer(rows[0]));
          }
        }
      }

      return {
        cycle: mapCycle(cycleRow),
        customers: customerRows,
      };
    })
  );
}

/**
 *
 * @param cycleId
 * @param input
 * @param actor
 */
export async function previewArStatementCycle(
  cycleId: string,
  input: PreviewArStatementCycleInput,
  actor: ActorContext = {}
): Promise<{
  cycle: ArStatementCycle;
  customers: ArStatementCycleCustomer[];
}> {
  const tenantId = await resolveTenantId(actor.tenantId);

  return withTenantContext(tenantId, async () => {
    const cycleRows = await prisma.$queryRaw<StatementCycleRow[]>(Prisma.sql`
      SELECT
        id,
        tenant_org_id,
        cycle_code,
        cycle_name,
        cycle_name2,
        cadence_cd,
        customer_scope_cd,
        day_of_month,
        day_of_week,
        issue_day_offset,
        due_terms_days,
        last_run_at,
        next_run_at,
        is_active,
        metadata
      FROM public.org_ar_stmt_cycles_mst
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${cycleId}::uuid
      LIMIT 1
    `);

    const cycleRow = cycleRows[0];
    if (!cycleRow) {
      throw new Error('AR statement cycle not found.');
    }

    const customers = cycleRow.customer_scope_cd === 'CUSTOM_LIST'
      ? await prisma.$queryRaw<StatementCycleCustomerRow[]>(Prisma.sql`
          SELECT
            link.id,
            link.cycle_id,
            link.customer_id,
            link.b2b_contract_id,
            link.is_active,
            cust.name AS customer_name,
            cust.name2 AS customer_name2
          FROM public.org_ar_stmt_cycle_cust_dtl link
          INNER JOIN public.org_customers_mst cust
            ON cust.id = link.customer_id
           AND cust.tenant_org_id = link.tenant_org_id
          WHERE link.tenant_org_id = ${tenantId}::uuid
            AND link.cycle_id = ${cycleId}::uuid
            AND link.is_active = true
          ORDER BY cust.name ASC
        `)
      : await prisma.$queryRaw<StatementCycleCustomerRow[]>(Prisma.sql`
          SELECT
            gen_random_uuid() AS id,
            ${cycleId}::uuid AS cycle_id,
            cust.id AS customer_id,
            NULL::uuid AS b2b_contract_id,
            true AS is_active,
            cust.name AS customer_name,
            cust.name2 AS customer_name2
          FROM public.org_customers_mst cust
          WHERE cust.tenant_org_id = ${tenantId}::uuid
            AND LOWER(COALESCE(cust.type, '')) = 'b2b'
            AND EXISTS (
              SELECT 1
              FROM public.org_invoice_mst inv
              WHERE inv.tenant_org_id = cust.tenant_org_id
                AND inv.customer_id = cust.id
                AND COALESCE(inv.outstanding_amount, 0) > 0
            )
          ORDER BY cust.name ASC
        `);

    return {
      cycle: mapCycle(cycleRow),
      customers: customers.map(mapCycleCustomer),
    };
  });
}

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { getTenantIdFromSession, withTenantContext } from '@/lib/db/tenant-context';
import {
  AR_CREDIT_ALLOCATION_STATUSES,
  AR_LEDGER_MOVEMENTS,
} from '@/lib/constants/ar-invoice';
import type {
  ArCreditApplication,
  ArCustomerCreditRow,
} from '@/lib/types/ar-invoice';
import type {
  ApplyArCreditInput,
  ArCreditsQuery,
  ReverseArCreditApplicationInput,
} from '@/lib/validations/ar-invoice-schemas';
import {
  allocateArPaymentTx,
  reverseArPaymentAllocationTx,
} from '@/lib/services/ar-invoice.service';

type PrismaTx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

interface ActorContext {
  tenantId?: string;
  userId?: string | null;
}

interface CreditRowRecord {
  source_ledger_id: string;
  customer_id: string;
  customer_name: string | null;
  customer_name2: string | null;
  currency_code: string;
  available_credit_amount: Prisma.Decimal;
  last_credit_at: Date;
  ref_doc_no: string | null;
}

interface CreditApplicationRecord {
  id: string;
  tenant_org_id: string;
  customer_id: string;
  invoice_id: string;
  source_ledger_id: string;
  invoice_alloc_id: string | null;
  allocation_no: number;
  allocation_status_cd: string;
  applied_amount: Prisma.Decimal;
  applied_at: Date;
  reversed_at: Date | null;
  reversed_by: string | null;
  reversal_reason: string | null;
  metadata: Prisma.JsonValue;
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

function mapCreditApplication(row: CreditApplicationRecord): ArCreditApplication {
  return {
    id: row.id,
    tenant_org_id: row.tenant_org_id,
    customer_id: row.customer_id,
    invoice_id: row.invoice_id,
    source_ledger_id: row.source_ledger_id,
    invoice_alloc_id: row.invoice_alloc_id ?? undefined,
    allocation_no: row.allocation_no,
    allocation_status_cd: row.allocation_status_cd as ArCreditApplication['allocation_status_cd'],
    applied_amount: toNumber(row.applied_amount),
    applied_at: row.applied_at.toISOString(),
    reversed_at: row.reversed_at?.toISOString(),
    reversed_by: row.reversed_by ?? undefined,
    reversal_reason: row.reversal_reason ?? undefined,
    metadata: parseJsonRecord(row.metadata),
  };
}

async function getNextCreditAllocationNoTx(
  tx: PrismaTx,
  tenantId: string,
  invoiceId: string
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ next_no: number }>>(Prisma.sql`
    SELECT COALESCE(MAX(allocation_no), 0) + 1 AS next_no
    FROM public.org_ar_credit_allocs_dtl
    WHERE tenant_org_id = ${tenantId}::uuid
      AND invoice_id = ${invoiceId}::uuid
  `);

  return rows[0]?.next_no ?? 1;
}

async function getAvailableSourceCreditAmountTx(
  tx: PrismaTx,
  tenantId: string,
  sourceLedgerId: string
): Promise<number> {
  const rows = await tx.$queryRaw<Array<{ available_amount: Prisma.Decimal }>>(Prisma.sql`
    WITH src AS (
      SELECT amount
      FROM public.org_customer_ar_ledger_dtl
      WHERE tenant_org_id = ${tenantId}::uuid
        AND id = ${sourceLedgerId}::uuid
        AND movement_cd = ${AR_LEDGER_MOVEMENTS.OVERPAY_CREDIT}
      LIMIT 1
    ),
    applied AS (
      SELECT COALESCE(SUM(applied_amount), 0) AS applied_amount
      FROM public.org_ar_credit_allocs_dtl
      WHERE tenant_org_id = ${tenantId}::uuid
        AND source_ledger_id = ${sourceLedgerId}::uuid
        AND allocation_status_cd = ${AR_CREDIT_ALLOCATION_STATUSES.APPLIED}
    )
    SELECT GREATEST(0, COALESCE((SELECT amount FROM src), 0) - COALESCE((SELECT applied_amount FROM applied), 0)) AS available_amount
  `);

  return toNumber(rows[0]?.available_amount);
}

/**
 *
 * @param query
 * @param actor
 */
export async function listArCredits(
  query: ArCreditsQuery,
  actor: ActorContext = {}
): Promise<{
  data: ArCustomerCreditRow[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}> {
  const tenantId = await resolveTenantId(actor.tenantId);
  const offset = (query.page - 1) * query.limit;
  const search = query.search?.trim();

  const customerFilter = query.customer_id
    ? Prisma.sql`AND ledger.customer_id = ${query.customer_id}::uuid`
    : Prisma.empty;
  const searchFilter = search
    ? Prisma.sql`
        AND (
          customer.name ILIKE ${`%${search}%`}
          OR customer.name2 ILIKE ${`%${search}%`}
          OR COALESCE(ledger.ref_doc_no, '') ILIKE ${`%${search}%`}
        )
      `
    : Prisma.empty;

  return withTenantContext(tenantId, async () => {
    const rows = await prisma.$queryRaw<CreditRowRecord[]>(Prisma.sql`
      WITH src AS (
        SELECT
          ledger.id AS source_ledger_id,
          ledger.customer_id,
          ledger.currency_code,
          ledger.amount,
          ledger.event_at,
          ledger.ref_doc_no
        FROM public.org_customer_ar_ledger_dtl ledger
        WHERE ledger.tenant_org_id = ${tenantId}::uuid
          AND ledger.movement_cd = ${AR_LEDGER_MOVEMENTS.OVERPAY_CREDIT}
          ${customerFilter}
      ),
      applied AS (
        SELECT
          source_ledger_id,
          COALESCE(SUM(applied_amount), 0) AS applied_amount
        FROM public.org_ar_credit_allocs_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND allocation_status_cd = ${AR_CREDIT_ALLOCATION_STATUSES.APPLIED}
        GROUP BY source_ledger_id
      )
      SELECT
        src.source_ledger_id,
        src.customer_id,
        customer.name AS customer_name,
        customer.name2 AS customer_name2,
        src.currency_code,
        GREATEST(0, src.amount - COALESCE(applied.applied_amount, 0)) AS available_credit_amount,
        src.event_at AS last_credit_at,
        src.ref_doc_no
      FROM src
      INNER JOIN public.org_customers_mst customer
        ON customer.id = src.customer_id
       AND customer.tenant_org_id = ${tenantId}::uuid
      LEFT JOIN applied
        ON applied.source_ledger_id = src.source_ledger_id
      WHERE GREATEST(0, src.amount - COALESCE(applied.applied_amount, 0)) > 0
      ${searchFilter}
      ORDER BY src.event_at ASC
      OFFSET ${offset}
      LIMIT ${query.limit}
    `);

    const totalRows = await prisma.$queryRaw<Array<{ total_count: bigint }>>(Prisma.sql`
      WITH src AS (
        SELECT
          ledger.id AS source_ledger_id,
          ledger.customer_id,
          ledger.amount,
          ledger.event_at,
          ledger.ref_doc_no
        FROM public.org_customer_ar_ledger_dtl ledger
        WHERE ledger.tenant_org_id = ${tenantId}::uuid
          AND ledger.movement_cd = ${AR_LEDGER_MOVEMENTS.OVERPAY_CREDIT}
          ${customerFilter}
      ),
      applied AS (
        SELECT
          source_ledger_id,
          COALESCE(SUM(applied_amount), 0) AS applied_amount
        FROM public.org_ar_credit_allocs_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND allocation_status_cd = ${AR_CREDIT_ALLOCATION_STATUSES.APPLIED}
        GROUP BY source_ledger_id
      )
      SELECT COUNT(*)::bigint AS total_count
      FROM src
      INNER JOIN public.org_customers_mst customer
        ON customer.id = src.customer_id
       AND customer.tenant_org_id = ${tenantId}::uuid
      LEFT JOIN applied
        ON applied.source_ledger_id = src.source_ledger_id
      WHERE GREATEST(0, src.amount - COALESCE(applied.applied_amount, 0)) > 0
      ${searchFilter}
    `);

    return {
      data: rows.map((row) => ({
        source_ledger_id: row.source_ledger_id,
        customer_id: row.customer_id,
        customer_name: row.customer_name ?? undefined,
        customer_name2: row.customer_name2 ?? undefined,
        currency_code: row.currency_code,
        available_credit_amount: toNumber(row.available_credit_amount),
        last_credit_at: row.last_credit_at?.toISOString(),
        ref_doc_no: row.ref_doc_no ?? undefined,
      })),
      page: query.page,
      limit: query.limit,
      total: Number(totalRows[0]?.total_count ?? 0),
      totalPages: Math.ceil(Number(totalRows[0]?.total_count ?? 0) / query.limit),
    };
  });
}

/**
 *
 * @param input
 * @param actor
 */
export async function applyArCredit(
  input: ApplyArCreditInput,
  actor: ActorContext = {}
): Promise<ArCreditApplication> {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  return withTenantContext(tenantId, async () =>
    prisma.$transaction(async (tx) => {
      const [invoice, sourceLedger] = await Promise.all([
        tx.org_invoice_mst.findUnique({
          where: {
            id_tenant_org_id: {
              id: input.invoice_id,
              tenant_org_id: tenantId,
            },
          },
          select: {
            id: true,
            customer_id: true,
            outstanding_amount: true,
          },
        }),
        tx.org_customer_ar_ledger_dtl.findFirst({
          where: {
            tenant_org_id: tenantId,
            id: input.source_ledger_id,
            customer_id: input.customer_id,
            movement_cd: AR_LEDGER_MOVEMENTS.OVERPAY_CREDIT,
          },
          select: {
            id: true,
            customer_id: true,
          },
        }),
      ]);

      if (!invoice) {
        throw new Error('AR invoice not found');
      }
      if (!invoice.customer_id || invoice.customer_id !== input.customer_id) {
        throw new Error('Credit customer must match the invoice customer.');
      }
      if (!sourceLedger) {
        throw new Error('Available AR credit source not found.');
      }

      const [availableAmount, nextAllocationNo] = await Promise.all([
        getAvailableSourceCreditAmountTx(tx, tenantId, input.source_ledger_id),
        getNextCreditAllocationNoTx(tx, tenantId, input.invoice_id),
      ]);

      if (input.applied_amount > availableAmount) {
        throw new Error('Applied amount exceeds the remaining available AR credit.');
      }

      const maxInvoiceAmount = toNumber(invoice.outstanding_amount);
      if (input.applied_amount > maxInvoiceAmount) {
        throw new Error('Applied amount exceeds the invoice outstanding balance.');
      }

      await allocateArPaymentTx(
        tx,
        input.invoice_id,
        {
          allocated_amount: input.applied_amount,
          unapplied_credit_amount: 0,
          applied_at: new Date().toISOString(),
          notes: input.notes,
          idempotency_key: input.idempotency_key,
        },
        {
          tenantId,
          userId,
        }
      );

      const latestAllocation = await tx.org_invoice_payments_dtl.findFirst({
        where: {
          tenant_org_id: tenantId,
          invoice_id: input.invoice_id,
          payment_id: null,
          voucher_id: null,
        },
        orderBy: { allocation_no: 'desc' },
        select: { id: true },
      });

      const rows = await tx.$queryRaw<CreditApplicationRecord[]>(Prisma.sql`
        INSERT INTO public.org_ar_credit_allocs_dtl (
          tenant_org_id,
          customer_id,
          invoice_id,
          source_ledger_id,
          invoice_alloc_id,
          allocation_no,
          allocation_status_cd,
          applied_amount,
          applied_at,
          metadata,
          created_by,
          updated_by
        )
        VALUES (
          ${tenantId}::uuid,
          ${input.customer_id}::uuid,
          ${input.invoice_id}::uuid,
          ${input.source_ledger_id}::uuid,
          ${latestAllocation?.id ?? null}::uuid,
          ${nextAllocationNo},
          ${AR_CREDIT_ALLOCATION_STATUSES.APPLIED},
          ${input.applied_amount},
          CURRENT_TIMESTAMP,
          ${JSON.stringify({ notes: input.notes ?? null })}::jsonb,
          ${userId},
          ${userId}
        )
        RETURNING
          id,
          tenant_org_id,
          customer_id,
          invoice_id,
          source_ledger_id,
          invoice_alloc_id,
          allocation_no,
          allocation_status_cd,
          applied_amount,
          applied_at,
          reversed_at,
          reversed_by,
          reversal_reason,
          metadata
      `);

      return mapCreditApplication(rows[0]);
    })
  );
}

/**
 *
 * @param applicationId
 * @param input
 * @param actor
 */
export async function reverseArCreditApplication(
  applicationId: string,
  input: ReverseArCreditApplicationInput,
  actor: ActorContext = {}
): Promise<ArCreditApplication> {
  const tenantId = await resolveTenantId(actor.tenantId);
  const userId = actor.userId ?? null;

  return withTenantContext(tenantId, async () =>
    prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<CreditApplicationRecord[]>(Prisma.sql`
        SELECT
          id,
          tenant_org_id,
          customer_id,
          invoice_id,
          source_ledger_id,
          invoice_alloc_id,
          allocation_no,
          allocation_status_cd,
          applied_amount,
          applied_at,
          reversed_at,
          reversed_by,
          reversal_reason,
          metadata
        FROM public.org_ar_credit_allocs_dtl
        WHERE tenant_org_id = ${tenantId}::uuid
          AND id = ${applicationId}::uuid
        LIMIT 1
      `);

      const application = rows[0];
      if (!application) {
        throw new Error('AR credit application not found.');
      }
      if (application.allocation_status_cd === AR_CREDIT_ALLOCATION_STATUSES.REVERSED) {
        throw new Error('This AR credit application has already been reversed.');
      }
      if (!application.invoice_alloc_id) {
        throw new Error('AR credit application is missing the linked invoice allocation.');
      }

      await reverseArPaymentAllocationTx(
        tx,
        application.invoice_id,
        application.invoice_alloc_id,
        {
          reason: input.reason,
          reversed_at: new Date().toISOString(),
          idempotency_key: input.idempotency_key,
        },
        {
          tenantId,
          userId,
        }
      );

      const updated = await tx.$queryRaw<CreditApplicationRecord[]>(Prisma.sql`
        UPDATE public.org_ar_credit_allocs_dtl
        SET
          allocation_status_cd = ${AR_CREDIT_ALLOCATION_STATUSES.REVERSED},
          reversed_at = CURRENT_TIMESTAMP,
          reversed_by = ${userId},
          reversal_reason = ${input.reason},
          updated_at = CURRENT_TIMESTAMP,
          updated_by = ${userId}
        WHERE tenant_org_id = ${tenantId}::uuid
          AND id = ${applicationId}::uuid
        RETURNING
          id,
          tenant_org_id,
          customer_id,
          invoice_id,
          source_ledger_id,
          invoice_alloc_id,
          allocation_no,
          allocation_status_cd,
          applied_amount,
          applied_at,
          reversed_at,
          reversed_by,
          reversal_reason,
          metadata
      `);

      return mapCreditApplication(updated[0]);
    })
  );
}

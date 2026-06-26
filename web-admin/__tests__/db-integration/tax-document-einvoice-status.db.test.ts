/**
 * F-05 §7 — tax-document e_invoice_status wiring (DB-level, mig 0386).
 *
 * Proves `createTaxDocumentTx` stamps the initial `org_tax_documents_mst.e_invoice_status`
 * from the order's activation window:
 *   - ENABLED tenant + order on/after start → PENDING
 *   - DISABLED tenant                        → NOT_APPLICABLE (flat-VAT flow unchanged)
 * and that the live CHECK `chk_tax_doc_einv_status` rejects an out-of-catalog value.
 *
 * `createTaxDocumentTx` takes an external tx, so all writes (tenant-flag flip, order
 * seed, document create) run inside a rolled-back transaction — nothing persists.
 * Skips when no DB is reachable.
 *
 * @jest-environment node
 */
import { prisma } from '@/lib/db/prisma';
import { createTaxDocumentTx } from '@/lib/services/tax-document-write.service';
import { randomUUID } from 'node:crypto';

let dbUp = false;
let tenantA = '';

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const tenants = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM public.org_tenants_mst ORDER BY created_at LIMIT 1`;
    tenantA = tenants[0]?.id ?? '';
    dbUp = tenantA.length > 0;
  } catch {
    dbUp = false;
  }
});
afterAll(async () => {
  await prisma.$disconnect();
});

const ROLLBACK = Symbol('tax-doc-einv-rollback');
type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
async function runRollback(fn: (tx: TxClient) => Promise<void>): Promise<void> {
  try {
    await prisma.$transaction(async (tx) => {
      await fn(tx as TxClient);
      throw ROLLBACK;
    });
  } catch (e) {
    if (e !== ROLLBACK) throw e;
  }
}
function dbit(name: string, fn: () => Promise<void>): void {
  it(name, async () => {
    if (!dbUp) {
      console.warn(`[tax-document-einvoice-status] DB unavailable — skipping: ${name}`);
      return;
    }
    await fn();
  });
}

async function seedOrder(tx: TxClient): Promise<string> {
  const cust = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_customers_mst (tenant_org_id) VALUES (${tenantA}::uuid) RETURNING id`;
  const order = await tx.$queryRaw<Array<{ id: string }>>`
    INSERT INTO public.org_orders_mst (tenant_org_id, customer_id, order_no, currency_code, taxable_amount)
    VALUES (${tenantA}::uuid, ${cust[0].id}::uuid, ${`TDOC-${randomUUID()}`}, 'OMR', 100)
    RETURNING id`;
  return order[0].id;
}

async function setTenantEInvoice(tx: TxClient, enabled: boolean): Promise<void> {
  await tx.$executeRaw`
    UPDATE public.org_tenants_mst
    SET is_e_invoice_enabled = ${enabled},
        e_invoice_enabled_start_date = ${enabled ? '2020-01-01' : null}::date
    WHERE id = ${tenantA}::uuid`;
}

async function statusOf(tx: TxClient, docId: string): Promise<string> {
  const r = await tx.$queryRaw<Array<{ e_invoice_status: string }>>`
    SELECT e_invoice_status FROM public.org_tax_documents_mst WHERE id = ${docId}::uuid`;
  return r[0].e_invoice_status;
}

describe('createTaxDocumentTx — e_invoice_status wiring (DB-level)', () => {
  dbit('ENABLED tenant → document stamped PENDING', async () => {
    let status = '';
    await runRollback(async (tx) => {
      await setTenantEInvoice(tx, true);
      const orderId = await seedOrder(tx);
      const docId = await createTaxDocumentTx(tx, {
        tenantId: tenantA,
        orderId,
        documentType: 'INVOICE',
        triggerEvent: 'ON_ORDER_SUBMIT',
        totalAmount: 105,
        taxAmount: 5,
        currencyCode: 'OMR',
      });
      status = await statusOf(tx, docId);
    });
    expect(status).toBe('PENDING');
  });

  dbit('DISABLED tenant → document stamped NOT_APPLICABLE', async () => {
    let status = '';
    await runRollback(async (tx) => {
      await setTenantEInvoice(tx, false);
      const orderId = await seedOrder(tx);
      const docId = await createTaxDocumentTx(tx, {
        tenantId: tenantA,
        orderId,
        documentType: 'INVOICE',
        triggerEvent: 'ON_ORDER_SUBMIT',
        totalAmount: 105,
        taxAmount: 5,
        currencyCode: 'OMR',
      });
      status = await statusOf(tx, docId);
    });
    expect(status).toBe('NOT_APPLICABLE');
  });

  dbit('live CHECK chk_tax_doc_einv_status rejects an out-of-catalog value', async () => {
    await expect(
      prisma.$transaction(async (tx) => {
        const orderId = await seedOrder(tx as TxClient);
        await tx.$executeRaw`
          INSERT INTO public.org_tax_documents_mst
            (tenant_org_id, order_id, document_type, trigger_event, status, e_invoice_status,
             fiscal_year, total_amount, tax_amount, currency_code)
          VALUES (${tenantA}::uuid, ${orderId}::uuid, 'INVOICE', 'ON_ORDER_SUBMIT', 'DRAFT', 'BOGUS',
             2026, 105, 5, 'OMR')`;
      }),
    ).rejects.toThrow(/chk_tax_doc_einv_status|violates check constraint/i);
  });
});

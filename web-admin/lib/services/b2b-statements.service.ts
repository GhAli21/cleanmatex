/**
 * B2B Statements Service
 * CRUD and generation for org_b2b_statements_mst with tenant isolation
 */

import { createClient } from '@/lib/supabase/server';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';
import type {
  B2BStatement,
  GenerateStatementRequest,
} from '@/lib/types/b2b';

function mapRowToStatement(row: Record<string, unknown>): B2BStatement {
  return {
    id: row.id as string,
    tenantOrgId: row.tenant_org_id as string,
    customerId: row.customer_id as string,
    contractId: (row.contract_id as string) ?? null,
    statementNo: row.statement_no as string,
    periodFrom: (row.period_from as string) ?? null,
    periodTo: (row.period_to as string) ?? null,
    dueDate: (row.due_date as string) ?? null,
    totalAmount: Number(row.total_amount) ?? 0,
    paidAmount: Number(row.paid_amount) ?? 0,
    balanceAmount: Number(row.balance_amount) ?? 0,
    currencyCd: (row.currency_cd as string) ?? null,
    statusCd: (row.status_cd as string) ?? 'DRAFT',
    recStatus: Number(row.rec_status) ?? 1,
    isActive: Boolean(row.is_active),
    createdAt: (row.created_at as string) ?? new Date().toISOString(),
    createdBy: (row.created_by as string) ?? null,
    updatedAt: (row.updated_at as string) ?? null,
    updatedBy: (row.updated_by as string) ?? null,
  };
}

export async function listStatements(filters?: {
  customerId?: string;
}): Promise<B2BStatement[]> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  let query = supabase
    .from('org_b2b_statements_mst')
    .select('*')
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (filters?.customerId) {
    query = query.eq('customer_id', filters.customerId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Error listing B2B statements', error as Error, {
      feature: 'b2b',
      action: 'listStatements',
    });
    throw new Error('Failed to list statements: ' + error.message);
  }
  return (data ?? []).map(mapRowToStatement);
}

async function generateStatementNo(tenantId: string): Promise<string> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from('org_b2b_statements_mst')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_org_id', tenantId);

  if (error) throw new Error('Failed to generate statement number');
  const seq = (count ?? 0) + 1;
  const yyyy = new Date().getFullYear();
  const mm = String(new Date().getMonth() + 1).padStart(2, '0');
  return `STMT-${yyyy}${mm}-${String(seq).padStart(4, '0')}`;
}

export async function generateStatement(
  request: GenerateStatementRequest
): Promise<B2BStatement> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  // Verify customer is B2B
  const { data: customer, error: custErr } = await supabase
    .from('org_customers_mst')
    .select('id, type')
    .eq('id', request.customerId)
    .eq('tenant_org_id', tenantId)
    .single();

  if (custErr || !customer || (customer as { type?: string }).type !== 'b2b') {
    throw new Error('Customer not found or not a B2B customer');
  }

  // Find unpaid B2B invoices for this customer (statement_id is null, balance > 0)
  // invoice_type_cd may not be set on older invoices; we include all invoices for B2B customer
  const { data: invoices, error: invErr } = await supabase
    .from('org_invoice_mst')
    .select('id, total, paid_amount')
    .eq('tenant_org_id', tenantId)
    .eq('customer_id', request.customerId)
    .or('invoice_type_cd.eq.B2B,invoice_type_cd.is.null')
    .is('statement_id', null)
    .eq('is_active', true);

  if (invErr) {
    logger.error('Error fetching invoices for statement', invErr as Error, {
      feature: 'b2b',
      action: 'generateStatement',
      customerId: request.customerId,
    });
    throw new Error('Failed to fetch invoices: ' + invErr.message);
  }

  const invoiceList = (invoices ?? []) as Array<{ id: string; total: number | string; paid_amount: number | string }>;
  const invoicesWithBalance = invoiceList.filter((inv) => {
    const total = Number(inv.total) ?? 0;
    const paid = Number(inv.paid_amount) ?? 0;
    return total - paid > 0;
  });

  const totalAmount = invoicesWithBalance.reduce((sum, inv) => {
    const total = Number(inv.total) ?? 0;
    const paid = Number(inv.paid_amount) ?? 0;
    return sum + (total - paid);
  }, 0);

  if (totalAmount <= 0 || invoicesWithBalance.length === 0) {
    throw new Error('No unpaid invoices to include in statement');
  }

  const statementNo = await generateStatementNo(tenantId);
  const dueDate = request.dueDate ?? request.periodTo;

  const { data: stmt, error: stmtErr } = await supabase
    .from('org_b2b_statements_mst')
    .insert({
      tenant_org_id: tenantId,
      customer_id: request.customerId,
      contract_id: request.contractId ?? null,
      statement_no: statementNo,
      period_from: request.periodFrom ?? null,
      period_to: request.periodTo ?? null,
      due_date: dueDate ?? null,
      total_amount: totalAmount,
      paid_amount: 0,
      balance_amount: totalAmount,
      currency_cd: null,
      status_cd: 'DRAFT',
      rec_status: 1,
      is_active: true,
    })
    .select()
    .single();

  if (stmtErr) {
    logger.error('Error creating B2B statement', stmtErr as Error, {
      feature: 'b2b',
      action: 'generateStatement',
      customerId: request.customerId,
    });
    throw new Error('Failed to create statement: ' + stmtErr.message);
  }

  const statementId = (stmt as { id: string }).id;

  // Link invoices with balance to statement
  for (const inv of invoicesWithBalance) {
    await supabase
      .from('org_invoice_mst')
      .update({
        statement_id: statementId,
        invoice_type_cd: 'B2B',
        updated_at: new Date().toISOString(),
      })
      .eq('id', inv.id)
      .eq('tenant_org_id', tenantId);
  }

  return mapRowToStatement(stmt as Record<string, unknown>);
}

export interface StatementForPrint {
  statement: B2BStatement;
  customer: { name: string; companyName?: string; phone?: string; email?: string };
  primaryContact: { name: string; email?: string; phone?: string } | null;
  invoices: Array<{
    id: string;
    invoiceNo: string | null;
    invoiceDate: string | null;
    total: number;
    paidAmount: number;
    remaining: number;
    currencyCode: string | null;
  }>;
}

export async function getStatementForPrint(id: string): Promise<StatementForPrint | null> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  const { data: stmt, error: stmtErr } = await supabase
    .from('org_b2b_statements_mst')
    .select('*')
    .eq('id', id)
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true)
    .single();

  if (stmtErr || !stmt) return null;

  const customerId = stmt.customer_id as string;

  const { data: customer } = await supabase
    .from('org_customers_mst')
    .select('name, name2, company_name, phone, email')
    .eq('id', customerId)
    .eq('tenant_org_id', tenantId)
    .single();

  const { data: primaryContactRow } = await supabase
    .from('org_b2b_contacts_dtl')
    .select('contact_name, contact_name2, email, phone')
    .eq('customer_id', customerId)
    .eq('tenant_org_id', tenantId)
    .eq('is_primary', true)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();

  const { data: invoices } = await supabase
    .from('org_invoice_mst')
    .select('id, invoice_no, invoice_date, created_at, total, paid_amount, currency_code')
    .eq('tenant_org_id', tenantId)
    .eq('statement_id', id)
    .eq('is_active', true);

  const cust = customer as { name?: string; name2?: string; company_name?: string; phone?: string; email?: string } | null;
  const primaryContact = primaryContactRow
    ? {
        name: ((primaryContactRow as { contact_name?: string }).contact_name ?? (primaryContactRow as { contact_name2?: string }).contact_name2 ?? '') || '—',
        email: (primaryContactRow as { email?: string }).email ?? undefined,
        phone: (primaryContactRow as { phone?: string }).phone ?? undefined,
      }
    : null;

  const invList = (invoices ?? []) as Array<{
    id: string;
    invoice_no: string | null;
    invoice_date: string | null;
    created_at: string | null;
    total: number | string;
    paid_amount: number | string;
    currency_code: string | null;
  }>;

  return {
    statement: mapRowToStatement(stmt as Record<string, unknown>),
    customer: {
      name: cust?.name ?? cust?.company_name ?? '—',
      companyName: cust?.company_name ?? undefined,
      phone: cust?.phone ?? undefined,
      email: cust?.email ?? undefined,
    },
    primaryContact,
    invoices: invList.map((inv) => {
      const total = Number(inv.total) ?? 0;
      const paid = Number(inv.paid_amount) ?? 0;
      return {
        id: inv.id,
        invoiceNo: inv.invoice_no,
        invoiceDate: inv.invoice_date ?? inv.created_at,
        total,
        paidAmount: paid,
        remaining: Math.max(0, total - paid),
        currencyCode: inv.currency_code,
      };
    }),
  };
}

export async function getStatementById(id: string): Promise<B2BStatement | null> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  const { data, error } = await supabase
    .from('org_b2b_statements_mst')
    .select('*')
    .eq('id', id)
    .eq('tenant_org_id', tenantId)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return mapRowToStatement(data as Record<string, unknown>);
}

export async function updateStatementStatus(
  id: string,
  statusCd: string
): Promise<B2BStatement> {
  const supabase = await createClient();
  const tenantId = await getTenantIdFromSession();
  if (!tenantId) throw new Error('Unauthorized: Tenant ID required');

  const { data, error } = await supabase
    .from('org_b2b_statements_mst')
    .update({
      status_cd: statusCd,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_org_id', tenantId)
    .select()
    .single();

  if (error) {
    logger.error('Error updating B2B statement', error as Error, {
      feature: 'b2b',
      action: 'updateStatementStatus',
      statementId: id,
    });
    throw new Error('Failed to update statement: ' + error.message);
  }
  return mapRowToStatement(data as Record<string, unknown>);
}

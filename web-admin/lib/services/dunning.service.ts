/**
 * B2B Dunning Service
 * Evaluates overdue statements and triggers notifications (email/SMS/hold_orders)
 * Config via tenant settings: b2b_dunning_levels
 */

import { createClient } from '@/lib/supabase/server';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';
import { logger } from '@/lib/utils/logger';
import { sendEmail } from '@/lib/notifications/email-sender';
import { sendSMS } from '@/lib/notifications/sms-sender';

export interface DunningLevel {
  days: number;
  action: 'email' | 'sms' | 'hold_orders';
}

export interface OverdueStatement {
  id: string;
  statementNo: string;
  customerId: string;
  dueDate: string;
  balanceAmount: number;
  daysOverdue: number;
}

export interface DunningActionResult {
  statementId: string;
  customerId: string;
  action: string;
  success: boolean;
  message?: string;
}

/**
 * Get primary contact email for a B2B customer.
 * Falls back to org_customers_mst.email if no primary contact.
 */
async function getPrimaryContactEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  customerId: string
): Promise<string | null> {
  const { data: contact } = await supabase
    .from('org_b2b_contacts_dtl')
    .select('email')
    .eq('tenant_org_id', tenantId)
    .eq('customer_id', customerId)
    .eq('is_primary', true)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (contact?.email) return contact.email as string;
  const { data: cust } = await supabase
    .from('org_customers_mst')
    .select('email')
    .eq('id', customerId)
    .eq('tenant_org_id', tenantId)
    .single();
  return (cust?.email as string) ?? null;
}

/**
 * Get primary contact phone for a B2B customer.
 * Falls back to org_customers_mst.phone if no primary contact.
 */
async function getPrimaryContactPhone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  customerId: string
): Promise<string | null> {
  const { data: contact } = await supabase
    .from('org_b2b_contacts_dtl')
    .select('phone')
    .eq('tenant_org_id', tenantId)
    .eq('customer_id', customerId)
    .eq('is_primary', true)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle();
  if (contact?.phone) return contact.phone as string;
  const { data: cust } = await supabase
    .from('org_customers_mst')
    .select('phone')
    .eq('id', customerId)
    .eq('tenant_org_id', tenantId)
    .single();
  return (cust?.phone as string) ?? null;
}

/**
 * Execute dunning actions for overdue statements.
 * Sends email/SMS and sets is_credit_hold when configured.
 * Call from cron or manual trigger.
 */
export async function executeDunningActions(
  tenantId: string,
  dunningLevels: DunningLevel[]
): Promise<DunningActionResult[]> {
  const supabase = await createClient();
  const statements = await getOverdueStatements(tenantId);
  const results: DunningActionResult[] = [];

  for (const stmt of statements) {
    const level = await evaluateDunningLevels(stmt, dunningLevels);
    if (!level) continue;

    if (level.action === 'email') {
      const email = await getPrimaryContactEmail(supabase, tenantId, stmt.customerId);
      if (email) {
        const sent = await sendEmail({
          to: email,
          subject: `Overdue Statement ${stmt.statementNo} - Action Required`,
          html: `<p>Your statement ${stmt.statementNo} is ${stmt.daysOverdue} days overdue. Balance: ${stmt.balanceAmount.toLocaleString()}.</p><p>Please arrange payment.</p>`,
        });
        results.push({
          statementId: stmt.id,
          customerId: stmt.customerId,
          action: 'email',
          success: sent,
          message: sent ? 'Email sent' : 'Email failed or skipped',
        });
      } else {
        results.push({
          statementId: stmt.id,
          customerId: stmt.customerId,
          action: 'email',
          success: false,
          message: 'No email address found',
        });
      }
    } else if (level.action === 'sms') {
      const phone = await getPrimaryContactPhone(supabase, tenantId, stmt.customerId);
      if (phone) {
        const sent = await sendSMS(
          phone,
          `Overdue: Statement ${stmt.statementNo} is ${stmt.daysOverdue} days overdue. Balance: ${stmt.balanceAmount.toLocaleString()}. Please arrange payment.`
        );
        results.push({
          statementId: stmt.id,
          customerId: stmt.customerId,
          action: 'sms',
          success: sent,
          message: sent ? 'SMS sent' : 'SMS failed or skipped',
        });
      } else {
        results.push({
          statementId: stmt.id,
          customerId: stmt.customerId,
          action: 'sms',
          success: false,
          message: 'No phone number found',
        });
      }
    } else if (level.action === 'hold_orders') {
      const { error } = await supabase
        .from('org_customers_mst')
        .update({ is_credit_hold: true, updated_at: new Date().toISOString() })
        .eq('id', stmt.customerId)
        .eq('tenant_org_id', tenantId);
      const success = !error;
      if (error) {
        logger.error('Dunning hold_orders failed', error as Error, {
          feature: 'b2b',
          action: 'hold_orders',
          customerId: stmt.customerId,
        });
      }
      results.push({
        statementId: stmt.id,
        customerId: stmt.customerId,
        action: 'hold_orders',
        success,
        message: success ? 'Credit hold set' : (error?.message ?? 'Update failed'),
      });
    }
  }

  return results;
}

export async function getOverdueStatements(
  tenantId?: string
): Promise<OverdueStatement[]> {
  const supabase = await createClient();
  const resolvedTenantId = tenantId ?? (await getTenantIdFromSession());
  if (!resolvedTenantId) throw new Error('Unauthorized: Tenant ID required');

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('org_b2b_statements_mst')
    .select('id, statement_no, customer_id, due_date, balance_amount')
    .eq('tenant_org_id', resolvedTenantId)
    .eq('is_active', true)
    .gt('balance_amount', 0)
    .lt('due_date', today)
    .in('status_cd', ['DRAFT', 'ISSUED', 'PARTIAL']);

  if (error) {
    logger.error('Error fetching overdue statements', error as Error, {
      feature: 'b2b',
      action: 'getOverdueStatements',
    });
    throw new Error('Failed to fetch overdue statements: ' + error.message);
  }

  const statements = (data ?? []) as Array<{
    id: string;
    statement_no: string;
    customer_id: string;
    due_date: string;
    balance_amount: number;
  }>;

  return statements.map((s) => {
    const due = new Date(s.due_date);
    const now = new Date();
    const daysOverdue = Math.floor(
      (now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
    );
    return {
      id: s.id,
      statementNo: s.statement_no,
      customerId: s.customer_id,
      dueDate: s.due_date,
      balanceAmount: Number(s.balance_amount),
      daysOverdue,
    };
  });
}

export async function evaluateDunningLevels(
  statement: OverdueStatement,
  levels: DunningLevel[]
): Promise<DunningLevel | null> {
  const sorted = [...levels].sort((a, b) => b.days - a.days);
  for (const level of sorted) {
    if (statement.daysOverdue >= level.days) {
      return level;
    }
  }
  return null;
}

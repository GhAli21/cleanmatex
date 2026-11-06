/**
 * Source-contract checks for the unapplied STOCK_TRANSACTION HFC repair.
 * These checks prevent either active writer from reintroducing local numbering;
 * post-apply database behavior remains covered by the SQL safety test.
 */
import fs from 'node:fs';
import path from 'node:path';

const repositoryRoot = path.join(__dirname, '..', '..', '..');

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repositoryRoot, relativePath), 'utf8');
}

const migration = read('supabase/migrations/0703_stock_transaction_hfc.sql');
const inventoryService = read('web-admin/lib/services/inventory-service.ts');

describe('STOCK_TRANSACTION human-friendly code source contracts', () => {
  it('leaves manual inventory numbering to the database trigger', () => {
    expect(inventoryService).not.toMatch(/generateTransactionNo/);
    expect(inventoryService).not.toMatch(/transaction_no\s*:/);
    expect(inventoryService).not.toMatch(/\.like\(\s*['"]transaction_no['"]/);
  });

  it('replaces caller values through the atomic sequence engine', () => {
    expect(migration).toMatch(/NEW\.transaction_no\s*:=\s*public\.fn_doc_seq_next\(/);
    expect(migration).toMatch(/CREATE TRIGGER trg_inv_stock_no_assign[\s\S]*BEFORE INSERT ON public\.org_inv_stock_tr/);
    expect(migration).toMatch(/CREATE TRIGGER trg_inv_stock_no_guard[\s\S]*BEFORE UPDATE OF transaction_no/);
  });

  it('repairs duplicates before enforcing the tenant-scoped invariant', () => {
    const repair = migration.indexOf('FOR r IN');
    const constraint = migration.indexOf('ADD CONSTRAINT uq_inv_stock_tr_no');
    expect(repair).toBeGreaterThan(-1);
    expect(constraint).toBeGreaterThan(repair);
    expect(migration).toMatch(/PARTITION BY s\.tenant_org_id, s\.transaction_no/);
    expect(migration).toMatch(/CREATE UNIQUE INDEX uq_inv_stock_tr_no\s+ON public\.org_inv_stock_tr \(tenant_org_id, transaction_no\)/);
  });

  it('removes order-deduction local counters and omits transaction_no from its insert', () => {
    const orderWriter = migration.slice(migration.indexOf('CREATE OR REPLACE FUNCTION public.deduct_retail_stock_for_order'));
    expect(orderWriter).not.toMatch(/v_trans_no|lpad\s*\(\s*v_seq/i);
    expect(orderWriter).not.toMatch(/INSERT INTO public\.org_inv_stock_tr \([\s\S]*?transaction_no[\s\S]*?\) VALUES/);
  });
});

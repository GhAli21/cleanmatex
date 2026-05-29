/**
 * BVM Phase 4 — Stored-value ledger reconciliation checks.
 *
 * Covers PRD §22.1:
 *   - STORED_VALUE_LEDGER              (wallet balance ↔ ledger sum invariant)
 *   - WALLET_LEDGER_LINK_EXISTS
 *   - ADVANCE_LEDGER_LINK_EXISTS
 *   - GIFT_CARD_LEDGER_LINK_EXISTS
 *   - CREDIT_NOTE_LEDGER_LINK_EXISTS
 *   - LOYALTY_LEDGER_LINK_EXISTS
 *
 * Why these checks live together:
 * They all use the FK backlinks `fin_voucher_id` + `fin_voucher_trx_line_id`
 * added in migration 0329 (Phase 2 BVM Wiring). The presence of the backlink
 * proves the ledger row was written from inside a voucher transaction; its
 * absence on a row created after the Phase 2 cutover indicates either a
 * legacy bypass path or a wiring regression.
 *
 * Window semantics:
 * Reconciliation runs are scoped by `periodFrom..periodTo`. Only ledger rows
 * `created_at` in that window are validated — pre-Phase-2 rows are out of
 * scope by construction.
 */

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  RECONCILIATION_CHECK_NAMES,
  RECONCILIATION_SEVERITIES,
} from '@/lib/constants/order-financial';

import {
  RECONCILIATION_TOLERANCE,
  toNumber,
  type CheckResult,
} from './types';

interface PeriodWindow {
  periodFrom: Date;
  periodTo: Date;
}

/**
 * STORED_VALUE_LEDGER — for every active wallet, the ledger amount sum must
 * equal the wallet header balance. A drift indicates a missing or duplicate
 * txn row and is always a BLOCKER.
 *
 * Not period-scoped — this is a snapshot invariant. A reconciliation run that
 * fires it is reporting a real consistency violation regardless of when the
 * drift originated.
 *
 * @param tenantOrgId active tenant — all queries scoped via `withTenantContext`
 *   so RLS enforces tenant isolation as defense in depth.
 */
export async function checkWalletBalanceMatchesLedger(
  tenantOrgId: string,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  const wallets = await withTenantContext(tenantOrgId, () =>
    prisma.org_customer_wallets_mst.findMany({
      where: { tenant_org_id: tenantOrgId, is_active: true },
      select: { id: true, balance: true },
    }),
  );

  for (const wallet of wallets) {
    const ledgerSum = await withTenantContext(tenantOrgId, () =>
      prisma.org_wallet_txn_dtl.aggregate({
        where: { tenant_org_id: tenantOrgId, wallet_id: wallet.id },
        _sum: { amount: true },
      }),
    );
    const ledger = toNumber(ledgerSum._sum.amount);
    const balance = toNumber(wallet.balance);
    if (Math.abs(ledger - balance) >= RECONCILIATION_TOLERANCE) {
      results.push({
        checkName: RECONCILIATION_CHECK_NAMES.STORED_VALUE_LEDGER,
        severity: RECONCILIATION_SEVERITIES.BLOCKER,
        passed: false,
        expectedValue: balance,
        actualValue: ledger,
        delta: ledger - balance,
        message: `Wallet ${wallet.id}: ledger sum (${ledger}) does not match balance (${balance})`,
        affectedEntityType: 'wallet',
        affectedEntityId: wallet.id,
      });
    }
  }

  return results;
}

/**
 * Generic *_LEDGER_LINK_EXISTS check: any ledger txn in the recon window with
 * the BVM linkage policy expected by Phase 2 must carry both a `fin_voucher_id`
 * and a `fin_voucher_trx_line_id` backlink (FK enforced; see migration 0329).
 *
 * Implementation: we only check DEBIT rows. CREDIT (top-up / issuance) rows
 * may legitimately have no voucher backlink if they were created by an admin
 * top-up action that does not write through a Business Voucher.
 *
 * @internal — call via the named wrappers below for type-safety on table names.
 */
async function runLedgerLinkExistsCheck(
  tenantOrgId: string,
  window: PeriodWindow,
  checkName: typeof RECONCILIATION_CHECK_NAMES[keyof typeof RECONCILIATION_CHECK_NAMES],
  entityType: string,
  // Each call site supplies a query strategy because the txn tables have
  // different column names (amount vs points, direction enum, etc.) — passing
  // a callback keeps the FK-backlink rule centralised here.
  findOrphanedDebits: () => Promise<Array<{ id: string; amount: number }>>,
): Promise<CheckResult[]> {
  const orphans = await findOrphanedDebits();
  return orphans.map((row) => ({
    checkName,
    severity: RECONCILIATION_SEVERITIES.BLOCKER,
    passed: false,
    actualValue: row.amount,
    message: `${entityType} ledger row ${row.id} (debit ${row.amount}) has no fin_voucher backlink — created outside a Business Voucher transaction`,
    affectedEntityType: entityType,
    affectedEntityId: row.id,
  }));
}

/** WALLET_LEDGER_LINK_EXISTS — see `runLedgerLinkExistsCheck`. */
export async function checkWalletLedgerLink(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  return runLedgerLinkExistsCheck(
    tenantOrgId,
    window,
    RECONCILIATION_CHECK_NAMES.WALLET_LEDGER_LINK_EXISTS,
    'wallet_txn',
    async () => {
      const rows = await withTenantContext(tenantOrgId, () =>
        prisma.org_wallet_txn_dtl.findMany({
          where: {
            tenant_org_id: tenantOrgId,
            created_at: { gte: window.periodFrom, lte: window.periodTo },
            // Debit = redemption against an order; should always go via voucher.
            // TODO Phase 4 Step 2c: add per-table debit filter before wiring.
            // wallet/advance/credit_note/loyalty use `txn_type` (e.g. 'REDEMPTION');
            // gift_card uses `transaction_type`. Until the filter is added, this
            // check will over-flag top-up/issuance rows that legitimately have
            // no voucher backlink. The module is not wired into the orchestrator
            // yet — only the constants are live.
            fin_voucher_id: null,
          },
          select: { id: true, amount: true },
        }),
      );
      return rows.map((r) => ({ id: r.id, amount: toNumber(r.amount) }));
    },
  );
}

/** ADVANCE_LEDGER_LINK_EXISTS — see `runLedgerLinkExistsCheck`. */
export async function checkAdvanceLedgerLink(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  return runLedgerLinkExistsCheck(
    tenantOrgId,
    window,
    RECONCILIATION_CHECK_NAMES.ADVANCE_LEDGER_LINK_EXISTS,
    'advance_txn',
    async () => {
      const rows = await withTenantContext(tenantOrgId, () =>
        prisma.org_advance_txn_dtl.findMany({
          where: {
            tenant_org_id: tenantOrgId,
            created_at: { gte: window.periodFrom, lte: window.periodTo },
            // TODO Phase 4 Step 2c: add per-table debit filter before wiring.
            // wallet/advance/credit_note/loyalty use `txn_type` (e.g. 'REDEMPTION');
            // gift_card uses `transaction_type`. Until the filter is added, this
            // check will over-flag top-up/issuance rows that legitimately have
            // no voucher backlink. The module is not wired into the orchestrator
            // yet — only the constants are live.
            fin_voucher_id: null,
          },
          select: { id: true, amount: true },
        }),
      );
      return rows.map((r) => ({ id: r.id, amount: toNumber(r.amount) }));
    },
  );
}

/** GIFT_CARD_LEDGER_LINK_EXISTS — see `runLedgerLinkExistsCheck`. */
export async function checkGiftCardLedgerLink(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  return runLedgerLinkExistsCheck(
    tenantOrgId,
    window,
    RECONCILIATION_CHECK_NAMES.GIFT_CARD_LEDGER_LINK_EXISTS,
    'gift_card_txn',
    async () => {
      const rows = await withTenantContext(tenantOrgId, () =>
        prisma.org_gift_card_txn_dtl.findMany({
          where: {
            tenant_org_id: tenantOrgId,
            created_at: { gte: window.periodFrom, lte: window.periodTo },
            // TODO Phase 4 Step 2c: add per-table debit filter before wiring.
            // wallet/advance/credit_note/loyalty use `txn_type` (e.g. 'REDEMPTION');
            // gift_card uses `transaction_type`. Until the filter is added, this
            // check will over-flag top-up/issuance rows that legitimately have
            // no voucher backlink. The module is not wired into the orchestrator
            // yet — only the constants are live.
            fin_voucher_id: null,
          },
          select: { id: true, amount: true },
        }),
      );
      return rows.map((r) => ({ id: r.id, amount: toNumber(r.amount) }));
    },
  );
}

/** CREDIT_NOTE_LEDGER_LINK_EXISTS — see `runLedgerLinkExistsCheck`. */
export async function checkCreditNoteLedgerLink(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  return runLedgerLinkExistsCheck(
    tenantOrgId,
    window,
    RECONCILIATION_CHECK_NAMES.CREDIT_NOTE_LEDGER_LINK_EXISTS,
    'credit_note_txn',
    async () => {
      const rows = await withTenantContext(tenantOrgId, () =>
        prisma.org_credit_note_txn_dtl.findMany({
          where: {
            tenant_org_id: tenantOrgId,
            created_at: { gte: window.periodFrom, lte: window.periodTo },
            // TODO Phase 4 Step 2c: add per-table debit filter before wiring.
            // wallet/advance/credit_note/loyalty use `txn_type` (e.g. 'REDEMPTION');
            // gift_card uses `transaction_type`. Until the filter is added, this
            // check will over-flag top-up/issuance rows that legitimately have
            // no voucher backlink. The module is not wired into the orchestrator
            // yet — only the constants are live.
            fin_voucher_id: null,
          },
          select: { id: true, amount: true },
        }),
      );
      return rows.map((r) => ({ id: r.id, amount: toNumber(r.amount) }));
    },
  );
}

/**
 * LOYALTY_LEDGER_LINK_EXISTS — extension beyond PRD §22.1 explicit list,
 * implied by §22 ("every operational effect linked"). Migration 0329 added
 * the loyalty backlink columns specifically so this check is possible.
 *
 * Loyalty ledger stores points, not money; `actualValue` reports raw points.
 */
export async function checkLoyaltyLedgerLink(
  tenantOrgId: string,
  window: PeriodWindow,
): Promise<CheckResult[]> {
  return runLedgerLinkExistsCheck(
    tenantOrgId,
    window,
    RECONCILIATION_CHECK_NAMES.LOYALTY_LEDGER_LINK_EXISTS,
    'loyalty_txn',
    async () => {
      const rows = await withTenantContext(tenantOrgId, () =>
        prisma.org_loyalty_txn_dtl.findMany({
          where: {
            tenant_org_id: tenantOrgId,
            created_at: { gte: window.periodFrom, lte: window.periodTo },
            // TODO Phase 4 Step 2c: add per-table debit filter before wiring.
            // wallet/advance/credit_note/loyalty use `txn_type` (e.g. 'REDEMPTION');
            // gift_card uses `transaction_type`. Until the filter is added, this
            // check will over-flag top-up/issuance rows that legitimately have
            // no voucher backlink. The module is not wired into the orchestrator
            // yet — only the constants are live.
            fin_voucher_id: null,
          },
          select: { id: true, points: true },
        }),
      );
      return rows.map((r) => ({ id: r.id, amount: toNumber(r.points) }));
    },
  );
}

import 'server-only';

import { Prisma } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { postDrawerTrxTx } from '@/lib/services/cash-drawer-trx.service';
import { CashDrawerLedgerError } from '@/lib/services/cash-drawer-ledger/cash-drawer-errors';
import { toMoneyString } from '@/lib/utils/money';
import {
  CASH_DRAWER_TRX_TYPES,
  CASH_LEDGER_ERRORS,
  CASH_TRANSIT_STATUS,
  type CashTransitStatus,
} from '@/lib/constants/cash-drawer';

/**
 * In-transit cash transfers (D1-4, migration 0562). Moving cash between two drawers in two legs with
 * a visible middle:
 *
 *   send     source OUT  → the branch IN_TRANSIT holder IN     (TRANSIT_SEND)
 *   receive  holder OUT  → destination IN                      (TRANSIT_RECEIVE)
 *   cancel   holder OUT  → source IN, reason mandatory         (TRANSIT_CANCEL)
 *
 * Every leg is an ordinary balanced custody transaction (so drawer sequences, balances and the
 * "custody never creates or destroys cash" trigger apply unchanged), posted in the same database
 * transaction as the transfer row's change — a transfer can never be half-applied, and it settles
 * exactly once (row lock + forward-only trigger + unique settle link). Permission is the only gate:
 * the person who sent a transfer may receive or cancel it (no maker≠checker).
 */

export interface SendTransitInput {
  sourceDrawerId: string;
  destDrawerId: string;
  /** Exact decimal string, > 0, at most 4 decimals. */
  amount: string;
  notes?: string;
  carriedByUserId?: string;
  idempotencyKey?: string;
}

export interface TransitRow {
  id: string;
  transitNo: string;
  branchId: string;
  branchName: string | null;
  sourceDrawerId: string;
  sourceDrawerName: string | null;
  destDrawerId: string;
  destDrawerName: string | null;
  currencyCode: string;
  amount: string;
  status: CashTransitStatus;
  notes: string | null;
  carriedByUserId: string | null;
  carriedByName: string | null;
  sentBy: string;
  sentByName: string | null;
  sentAt: string;
  settledBy: string | null;
  settledByName: string | null;
  settledAt: string | null;
  cancelReason: string | null;
}

export interface TransitPage {
  rows: TransitRow[];
  totalCount: number;
  page: number;
  pageSize: number;
}

interface TransitDbRow {
  id: string;
  branch_id: string;
  transit_no: string;
  source_drawer_id: string;
  dest_drawer_id: string;
  transit_drawer_id: string;
  currency_code: string;
  amount: string;
  status: string;
  send_trx_id: string;
}

type Tx = Prisma.TransactionClient;
type Ctx = { tenantOrgId: string; userId: string };

const fail = (code: (typeof CASH_LEDGER_ERRORS)[keyof typeof CASH_LEDGER_ERRORS], message: string) =>
  new CashDrawerLedgerError(code, message);

async function lockTransitTx(tx: Tx, tenantOrgId: string, transitId: string): Promise<TransitDbRow> {
  const rows = await tx.$queryRaw<TransitDbRow[]>(Prisma.sql`
    SELECT id, branch_id, transit_no, source_drawer_id, dest_drawer_id, transit_drawer_id,
           currency_code, amount::text AS amount, status, send_trx_id
    FROM public.org_cash_drawer_transit_tr
    WHERE tenant_org_id = ${tenantOrgId}::uuid AND id = ${transitId}::uuid
    FOR UPDATE
  `);
  if (!rows[0]) throw fail(CASH_LEDGER_ERRORS.CASH_TRANSIT_NOT_FOUND, `transit ${transitId} not found`);
  return rows[0];
}

/**
 * Sends cash in transit: takes it out of the source drawer into the branch's holder drawer and
 * opens the transfer. The destination is validated now (same branch and currency, active, a type
 * that can receive) so cash is never sent somewhere it could not arrive.
 *
 * @param tx open transaction
 * @param ctx tenant and acting user
 * @param input source, destination, exact amount and optional note / carrier / idempotency key
 * @returns the new (or, on a repeated idempotency key, the existing) transfer id and number
 * @throws CashDrawerLedgerError on any structural refusal (types, branch, currency, inactive drawer)
 */
export async function sendTransitTx(
  tx: Tx,
  ctx: Ctx,
  input: SendTransitInput,
): Promise<{ transitId: string; transitNo: string }> {
  const drawers = await tx.org_cash_drawers_mst.findMany({
    where: { tenant_org_id: ctx.tenantOrgId, id: { in: [input.sourceDrawerId, input.destDrawerId] } },
    select: { id: true, branch_id: true, drawer_type: true, currency_code: true, is_active: true },
  });
  const source = drawers.find((d) => d.id === input.sourceDrawerId);
  const dest = drawers.find((d) => d.id === input.destDrawerId);
  if (!source || !dest || input.sourceDrawerId === input.destDrawerId) {
    throw fail(CASH_LEDGER_ERRORS.CASH_TRX_SAME_DRAWER, 'send transit needs two distinct, existing drawers');
  }
  if (!source.is_active || !dest.is_active) {
    throw fail(CASH_LEDGER_ERRORS.CASH_DRAWER_INACTIVE, 'send transit: both drawers must be active');
  }
  if (source.branch_id !== dest.branch_id) {
    throw fail(CASH_LEDGER_ERRORS.CASH_TRX_CROSS_BRANCH, 'send transit: both drawers must be in the same branch');
  }
  if (source.currency_code !== dest.currency_code) {
    throw fail(CASH_LEDGER_ERRORS.CASH_CURRENCY_MISMATCH, 'send transit: both drawers must hold the same currency');
  }

  const [sendType, receiveType] = await Promise.all([
    tx.sys_cash_drawer_trx_type_cd.findUnique({
      where: { code: CASH_DRAWER_TRX_TYPES.TRANSIT_SEND },
      select: { allowed_src_types: true },
    }),
    tx.sys_cash_drawer_trx_type_cd.findUnique({
      where: { code: CASH_DRAWER_TRX_TYPES.TRANSIT_RECEIVE },
      select: { allowed_dest_types: true },
    }),
  ]);
  if (!sendType || !receiveType) throw new Error('sendTransitTx: transit transaction types are not seeded (migration 0562)');
  if (!sendType.allowed_src_types.includes(source.drawer_type) || !receiveType.allowed_dest_types.includes(dest.drawer_type)) {
    throw fail(CASH_LEDGER_ERRORS.CASH_DRAWER_TYPE_NOT_ALLOWED, 'send transit: drawer type cannot take part in a transfer');
  }

  const holderRows = await tx.$queryRaw<Array<{ drawer_id: string }>>(Prisma.sql`
    SELECT drawer_id
    FROM public.ensure_branch_transit_drawer(
      ${ctx.tenantOrgId}::uuid, ${source.branch_id}::uuid, ${source.currency_code}, ${ctx.userId})
  `);
  const holderId = holderRows[0]?.drawer_id;
  if (!holderId) throw new Error('sendTransitTx: could not provision the in-transit drawer');

  const amount = new Decimal(input.amount);
  const sendKey = input.idempotencyKey ? `transit-send:${input.idempotencyKey}` : undefined;
  const leg = await postDrawerTrxTx(
    tx,
    { tenantOrgId: ctx.tenantOrgId, userId: ctx.userId },
    {
      trxTypeCode: CASH_DRAWER_TRX_TYPES.TRANSIT_SEND,
      branchId: source.branch_id,
      lines: [
        { drawerId: source.id, direction: 'OUT', amount, currencyCode: source.currency_code },
        { drawerId: holderId, direction: 'IN', amount, currencyCode: source.currency_code },
      ],
      notes: input.notes,
      idempotencyKey: sendKey,
    },
  );

  // A repeated idempotency key returns the same leg: it already opened its transfer.
  const existing = await tx.$queryRaw<Array<{ id: string; transit_no: string }>>(Prisma.sql`
    SELECT id, transit_no FROM public.org_cash_drawer_transit_tr
    WHERE tenant_org_id = ${ctx.tenantOrgId}::uuid AND send_trx_id = ${leg.trxId}::uuid
  `);
  if (existing[0]) return { transitId: existing[0].id, transitNo: existing[0].transit_no };

  const inserted = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO public.org_cash_drawer_transit_tr (
      tenant_org_id, branch_id, transit_no, source_drawer_id, dest_drawer_id, transit_drawer_id,
      currency_code, amount, status, send_trx_id, carried_by_user_id, notes, sent_by, created_by, created_info
    ) VALUES (
      ${ctx.tenantOrgId}::uuid, ${source.branch_id}::uuid, ${leg.trxNo}, ${source.id}::uuid, ${dest.id}::uuid,
      ${holderId}::uuid, ${source.currency_code}, ${amount.toFixed(4)}::numeric, ${CASH_TRANSIT_STATUS.IN_TRANSIT},
      ${leg.trxId}::uuid, ${input.carriedByUserId ?? null}::uuid, ${input.notes?.trim() || null}, ${ctx.userId},
      ${ctx.userId}, 'cash-transit.send'
    )
    RETURNING id
  `);
  return { transitId: inserted[0].id, transitNo: leg.trxNo };
}

/**
 * Receives an in-transit transfer into its destination drawer. Locks the transfer row, so two people
 * receiving (or one receiving while another cancels) can never both succeed.
 *
 * @param tx open transaction
 * @param ctx tenant and acting user
 * @param transitId the transfer to receive
 * @throws CashDrawerLedgerError CASH_TRANSIT_NOT_FOUND / CASH_TRANSIT_NOT_OPEN, or a ledger refusal
 *         (for example the destination was deactivated — cancel the transfer instead)
 */
export async function receiveTransitTx(tx: Tx, ctx: Ctx, transitId: string): Promise<{ trxNo: string }> {
  const transit = await lockTransitTx(tx, ctx.tenantOrgId, transitId);
  if (transit.status !== CASH_TRANSIT_STATUS.IN_TRANSIT) {
    throw fail(CASH_LEDGER_ERRORS.CASH_TRANSIT_NOT_OPEN, `transfer ${transit.transit_no} is already ${transit.status}`);
  }

  const amount = new Decimal(transit.amount);
  const leg = await postDrawerTrxTx(
    tx,
    { tenantOrgId: ctx.tenantOrgId, userId: ctx.userId },
    {
      trxTypeCode: CASH_DRAWER_TRX_TYPES.TRANSIT_RECEIVE,
      branchId: transit.branch_id,
      lines: [
        { drawerId: transit.transit_drawer_id, direction: 'OUT', amount, currencyCode: transit.currency_code },
        { drawerId: transit.dest_drawer_id, direction: 'IN', amount, currencyCode: transit.currency_code },
      ],
      idempotencyKey: `transit-receive:${transit.id}`,
    },
  );

  await tx.$executeRaw(Prisma.sql`
    UPDATE public.org_cash_drawer_transit_tr
    SET status = ${CASH_TRANSIT_STATUS.RECEIVED}, settle_trx_id = ${leg.trxId}::uuid,
        received_by = ${ctx.userId}, received_at = clock_timestamp(),
        updated_at = CURRENT_TIMESTAMP, updated_by = ${ctx.userId}, updated_info = 'cash-transit.receive'
    WHERE tenant_org_id = ${ctx.tenantOrgId}::uuid AND id = ${transit.id}::uuid
  `);
  return { trxNo: leg.trxNo };
}

/**
 * Cancels an in-transit transfer: the cash goes back to its source drawer. A reason is mandatory
 * and kept with the transfer.
 *
 * @param tx open transaction
 * @param ctx tenant and acting user
 * @param transitId the transfer to cancel
 * @param reason why it is being cancelled
 * @throws CashDrawerLedgerError CASH_TRANSIT_REASON_REQUIRED / NOT_FOUND / NOT_OPEN, or a ledger refusal
 */
export async function cancelTransitTx(
  tx: Tx,
  ctx: Ctx,
  transitId: string,
  reason: string,
): Promise<{ trxNo: string }> {
  const cleanReason = reason?.trim();
  if (!cleanReason) throw fail(CASH_LEDGER_ERRORS.CASH_TRANSIT_REASON_REQUIRED, 'a reason is required to cancel a transfer');

  const transit = await lockTransitTx(tx, ctx.tenantOrgId, transitId);
  if (transit.status !== CASH_TRANSIT_STATUS.IN_TRANSIT) {
    throw fail(CASH_LEDGER_ERRORS.CASH_TRANSIT_NOT_OPEN, `transfer ${transit.transit_no} is already ${transit.status}`);
  }

  const amount = new Decimal(transit.amount);
  const leg = await postDrawerTrxTx(
    tx,
    { tenantOrgId: ctx.tenantOrgId, userId: ctx.userId },
    {
      trxTypeCode: CASH_DRAWER_TRX_TYPES.TRANSIT_CANCEL,
      branchId: transit.branch_id,
      lines: [
        { drawerId: transit.transit_drawer_id, direction: 'OUT', amount, currencyCode: transit.currency_code },
        { drawerId: transit.source_drawer_id, direction: 'IN', amount, currencyCode: transit.currency_code },
      ],
      notes: cleanReason,
      idempotencyKey: `transit-cancel:${transit.id}`,
    },
  );

  await tx.$executeRaw(Prisma.sql`
    UPDATE public.org_cash_drawer_transit_tr
    SET status = ${CASH_TRANSIT_STATUS.CANCELLED}, settle_trx_id = ${leg.trxId}::uuid,
        cancelled_by = ${ctx.userId}, cancelled_at = clock_timestamp(), cancel_reason = ${cleanReason},
        updated_at = CURRENT_TIMESTAMP, updated_by = ${ctx.userId}, updated_info = 'cash-transit.cancel'
    WHERE tenant_org_id = ${ctx.tenantOrgId}::uuid AND id = ${transit.id}::uuid
  `);
  return { trxNo: leg.trxNo };
}

export function sendTransit(tenantId: string, userId: string, input: SendTransitInput) {
  return withTenantContext(tenantId, () =>
    prisma.$transaction((tx) => sendTransitTx(tx, { tenantOrgId: tenantId, userId }, input)),
  );
}

export function receiveTransit(tenantId: string, userId: string, transitId: string) {
  return withTenantContext(tenantId, () =>
    prisma.$transaction((tx) => receiveTransitTx(tx, { tenantOrgId: tenantId, userId }, transitId)),
  );
}

export function cancelTransit(tenantId: string, userId: string, transitId: string, reason: string) {
  return withTenantContext(tenantId, () =>
    prisma.$transaction((tx) => cancelTransitTx(tx, { tenantOrgId: tenantId, userId }, transitId, reason)),
  );
}

/**
 * The branch of a transfer, for the route's branch-scope guard. Tenant-scoped.
 *
 * @param tenantId tenant
 * @param transitId transfer id
 * @returns the branch id, or null when the transfer does not exist for this tenant
 */
export async function getTransitBranchId(tenantId: string, transitId: string): Promise<string | null> {
  return withTenantContext(tenantId, async () => {
    const rows = await prisma.$queryRaw<Array<{ branch_id: string }>>(Prisma.sql`
      SELECT branch_id FROM public.org_cash_drawer_transit_tr
      WHERE tenant_org_id = ${tenantId}::uuid AND id = ${transitId}::uuid
    `);
    return rows[0]?.branch_id ?? null;
  });
}

interface TransitListRaw {
  id: string;
  transit_no: string;
  branch_id: string;
  branch_name: string | null;
  source_drawer_id: string;
  source_name: string | null;
  dest_drawer_id: string;
  dest_name: string | null;
  currency_code: string;
  amount: string;
  status: string;
  notes: string | null;
  carried_by_user_id: string | null;
  carried_by_name: string | null;
  sent_by: string;
  sent_by_name: string | null;
  sent_at: Date;
  settled_by: string | null;
  settled_by_name: string | null;
  settled_at: Date | null;
  cancel_reason: string | null;
}

/**
 * Lists in-transit transfers for the actor's branches, newest first.
 *
 * @param tenantId tenant (explicitly filtered in every query)
 * @param filter status (`ALL` for every status) and paging
 * @param scopeBranchIds the actor's permitted branches; undefined = all branches, empty = nothing
 */
export async function listTransits(
  tenantId: string,
  filter: { status: CashTransitStatus | 'ALL'; page: number; pageSize: number },
  scopeBranchIds?: readonly string[],
): Promise<TransitPage> {
  if (scopeBranchIds && scopeBranchIds.length === 0) {
    return { rows: [], totalCount: 0, page: filter.page, pageSize: filter.pageSize };
  }
  return withTenantContext(tenantId, async () => {
    const statusSql = filter.status === 'ALL' ? Prisma.empty : Prisma.sql`AND t.status = ${filter.status}`;
    const branchSql = scopeBranchIds
      ? Prisma.sql`AND t.branch_id IN (${Prisma.join([...scopeBranchIds].map((id) => Prisma.sql`${id}::uuid`))})`
      : Prisma.empty;

    const [rows, counts] = await Promise.all([
      prisma.$queryRaw<TransitListRaw[]>(Prisma.sql`
        SELECT t.id, t.transit_no, t.branch_id, COALESCE(b.name, b.branch_name) AS branch_name,
               t.source_drawer_id, sd.drawer_name AS source_name,
               t.dest_drawer_id, dd.drawer_name AS dest_name,
               t.currency_code, t.amount::text AS amount, t.status, t.notes,
               t.carried_by_user_id, COALESCE(cu.display_name, cu.name, cu.email) AS carried_by_name,
               t.sent_by, COALESCE(su.display_name, su.name, su.email) AS sent_by_name, t.sent_at,
               COALESCE(t.received_by, t.cancelled_by) AS settled_by,
               COALESCE(ru.display_name, ru.name, ru.email) AS settled_by_name,
               COALESCE(t.received_at, t.cancelled_at) AS settled_at, t.cancel_reason
        FROM public.org_cash_drawer_transit_tr t
        LEFT JOIN public.org_branches_mst b ON b.tenant_org_id = t.tenant_org_id AND b.id = t.branch_id
        LEFT JOIN public.org_cash_drawers_mst sd ON sd.tenant_org_id = t.tenant_org_id AND sd.id = t.source_drawer_id
        LEFT JOIN public.org_cash_drawers_mst dd ON dd.tenant_org_id = t.tenant_org_id AND dd.id = t.dest_drawer_id
        LEFT JOIN public.org_users_mst cu ON cu.tenant_org_id = t.tenant_org_id AND cu.user_id = t.carried_by_user_id
        LEFT JOIN public.org_users_mst su ON su.tenant_org_id = t.tenant_org_id AND su.user_id::text = t.sent_by
        LEFT JOIN public.org_users_mst ru ON ru.tenant_org_id = t.tenant_org_id
          AND ru.user_id::text = COALESCE(t.received_by, t.cancelled_by)
        WHERE t.tenant_org_id = ${tenantId}::uuid ${statusSql} ${branchSql}
        ORDER BY t.sent_at DESC
        LIMIT ${filter.pageSize} OFFSET ${Math.max(0, (filter.page - 1) * filter.pageSize)}
      `),
      prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM public.org_cash_drawer_transit_tr t
        WHERE t.tenant_org_id = ${tenantId}::uuid ${statusSql} ${branchSql}
      `),
    ]);

    return {
      rows: rows.map((r) => ({
        id: r.id,
        transitNo: r.transit_no,
        branchId: r.branch_id,
        branchName: r.branch_name,
        sourceDrawerId: r.source_drawer_id,
        sourceDrawerName: r.source_name,
        destDrawerId: r.dest_drawer_id,
        destDrawerName: r.dest_name,
        currencyCode: r.currency_code,
        amount: toMoneyString(r.amount),
        status: r.status as CashTransitStatus,
        notes: r.notes,
        carriedByUserId: r.carried_by_user_id,
        carriedByName: r.carried_by_name,
        sentBy: r.sent_by,
        sentByName: r.sent_by_name,
        sentAt: r.sent_at.toISOString(),
        settledBy: r.settled_by,
        settledByName: r.settled_by_name,
        settledAt: r.settled_at ? r.settled_at.toISOString() : null,
        cancelReason: r.cancel_reason,
      })),
      totalCount: counts[0]?.total ?? 0,
      page: filter.page,
      pageSize: filter.pageSize,
    };
  });
}

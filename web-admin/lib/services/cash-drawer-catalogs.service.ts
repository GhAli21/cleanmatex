import 'server-only';

import { prisma } from '@/lib/db/prisma';

/**
 * Read-only bilingual catalogs backing the CLF UI (§4B.7
 * `GET /api/v1/cash-drawers/catalogs`): drawer types, custody trx types,
 * close dispositions, post-close statuses, count types. These are global
 * `sys_*` tables (no `tenant_org_id`) seeded by migration 0523 — read
 * directly here rather than duplicating `name`/`name2` into the TS constants
 * in `lib/constants/cash-drawer.ts` (those mirror only the `code` values for
 * type-safety; the DB is the single source of truth for display labels).
 */

export interface CashDrawerCatalogs {
  drawerTypes: Array<{
    code: string;
    name: string;
    name2: string | null;
    isMobile: boolean;
    canReceiveDisposition: boolean;
    displayOrder: number;
  }>;
  trxTypes: Array<{
    code: string;
    name: string;
    name2: string | null;
    allowedSrcTypes: string[];
    allowedDestTypes: string[];
    requiresNotes: boolean;
    isSystem: boolean;
    displayOrder: number;
  }>;
  dispositions: Array<{
    code: string;
    name: string;
    name2: string | null;
    cashMoveMode: string;
    destDrawerTypeCode: string | null;
    requiresNotes: boolean;
    requiresKeptAmount: boolean;
    isSelectable: boolean;
    displayOrder: number;
  }>;
  postCloseStatuses: Array<{ code: string; name: string; name2: string | null; requiresNotes: boolean; displayOrder: number }>;
  countTypes: Array<{ code: string; name: string; name2: string | null; displayOrder: number }>;
}

export async function getCashDrawerCatalogs(): Promise<CashDrawerCatalogs> {
  const [drawerTypes, trxTypes, dispositions, postCloseStatuses, countTypes] = await Promise.all([
    prisma.sys_cash_drawer_type_cd.findMany({
      where: { is_active: true },
      orderBy: { display_order: 'asc' },
      select: { code: true, name: true, name2: true, is_mobile: true, can_receive_disposition: true, display_order: true },
    }),
    prisma.sys_cash_drawer_trx_type_cd.findMany({
      where: { is_active: true },
      orderBy: { display_order: 'asc' },
      select: { code: true, name: true, name2: true, allowed_src_types: true, allowed_dest_types: true, requires_notes: true, is_system: true, display_order: true },
    }),
    prisma.sys_cash_drawer_ses_disp_cd.findMany({
      where: { is_active: true },
      orderBy: { display_order: 'asc' },
      select: {
        code: true,
        name: true,
        name2: true,
        cash_move_mode: true,
        dest_drawer_type_code: true,
        requires_notes: true,
        requires_kept_amount: true,
        is_selectable: true,
        display_order: true,
      },
    }),
    prisma.sys_cash_drawer_ses_post_cd.findMany({
      where: { is_active: true },
      orderBy: { display_order: 'asc' },
      select: { code: true, name: true, name2: true, requires_notes: true, display_order: true },
    }),
    prisma.sys_cash_drawer_cnt_type_cd.findMany({
      where: { is_active: true },
      orderBy: { display_order: 'asc' },
      select: { code: true, name: true, name2: true, display_order: true },
    }),
  ]);

  return {
    drawerTypes: drawerTypes.map((t) => ({
      code: t.code,
      name: t.name,
      name2: t.name2,
      isMobile: t.is_mobile,
      canReceiveDisposition: t.can_receive_disposition,
      displayOrder: t.display_order,
    })),
    trxTypes: trxTypes.map((t) => ({
      code: t.code,
      name: t.name,
      name2: t.name2,
      allowedSrcTypes: t.allowed_src_types,
      allowedDestTypes: t.allowed_dest_types,
      requiresNotes: t.requires_notes,
      isSystem: t.is_system,
      displayOrder: t.display_order,
    })),
    dispositions: dispositions.map((d) => ({
      code: d.code,
      name: d.name,
      name2: d.name2,
      cashMoveMode: d.cash_move_mode,
      destDrawerTypeCode: d.dest_drawer_type_code,
      requiresNotes: d.requires_notes,
      requiresKeptAmount: d.requires_kept_amount,
      isSelectable: d.is_selectable,
      displayOrder: d.display_order,
    })),
    postCloseStatuses: postCloseStatuses.map((p) => ({ code: p.code, name: p.name, name2: p.name2, requiresNotes: p.requires_notes, displayOrder: p.display_order })),
    countTypes: countTypes.map((c) => ({ code: c.code, name: c.name, name2: c.name2, displayOrder: c.display_order })),
  };
}

export interface CurrencyDenominationRow {
  id: string;
  denominationCode: string;
  denominationMinor: number;
  denomKind: string;
  name: string;
  name2: string | null;
  displayOrder: number | null;
}

/**
 * Active, in-circulation denominations for one currency, ordered for display
 * (CLF-8-1 `CmxDenominationCounter`). `org_currency_denom_cf` tenant
 * overrides are a documented C1 follow-up, not read here (plan §4B.7).
 * @param currencyCode ISO currency code
 */
export async function getCurrencyDenominations(currencyCode: string): Promise<CurrencyDenominationRow[]> {
  const rows = await prisma.sys_currency_denominations_cd.findMany({
    where: { currency_code: currencyCode, is_active: true, is_in_circulation: true },
    orderBy: [{ display_order: 'asc' }, { denomination_minor: 'asc' }],
    select: { id: true, denomination_code: true, denomination_minor: true, denom_kind: true, name: true, name2: true, display_order: true },
  });
  return rows.map((r) => ({
    id: r.id,
    denominationCode: r.denomination_code,
    denominationMinor: r.denomination_minor,
    denomKind: r.denom_kind,
    name: r.name,
    name2: r.name2,
    displayOrder: r.display_order,
  }));
}

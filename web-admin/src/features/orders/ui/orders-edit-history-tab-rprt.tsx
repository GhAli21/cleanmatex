'use client';

import { CmxInstant, useDateValueFormatter, useInstantFormatter } from '@ui/clock';
import { useState } from 'react';
import {
  History,
  ChevronDown,
  ChevronRight,
  User,
  Clock,
  CreditCard,
  ArrowRight,
  Plus,
  Minus,
  Pencil,
  FileText,
  Package,
  Layers,
  Tags,
  DollarSign,
  AlertTriangle,
  Wrench,
  Globe,
} from 'lucide-react';
import { useLocale } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';

import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import type { ChangeSet, FieldChange, ItemChange } from '@/lib/services/order-audit.service';
import { preferenceChangeCodes, type PreferenceChange } from '@/lib/utils/order-preference-snapshot';
import { preferenceChangeCount } from '@/lib/utils/order-preference-snapshot';
import type { PieceChange } from '@/lib/utils/order-piece-snapshot';
import { pieceChangeCount } from '@/lib/utils/order-piece-snapshot';

import { CmxStatusBadge } from '@ui/feedback';
// ─── Types ────────────────────────────────────────────────────────────────────

/** Represents one immutable audit entry captured for a legacy order edit. */
export interface OrderEditHistoryEntry {
  id: string;
  orderId: string;
  orderNo: string | null;
  editNumber: number;
  editedBy: string;
  editedByName: string | null;
  editedAt: string;
  ipAddress: string | null;
  changeSummary: string;
  changes: ChangeSet;
  paymentAdjusted: boolean;
  paymentAdjustmentAmount: number | null;
  paymentAdjustmentType: string | null;
}

/** Provides localized copy used throughout the edit-history surface. */
export interface EditHistoryTranslations {
  emptyEditHistory: string;
  editHistoryTitle: string;
  editNo: string;
  editedBy: string;
  editedAt: string;
  changeSummary: string;
  fieldChanges: string;
  itemChanges: string;
  preferenceChanges: string;
  preferenceAdded: string;
  preferenceRemoved: string;
  preferenceModified: string;
  extraPrice: string;
  preferenceCode: string;
  preferenceKind: string;
  preferenceContent: string;
  preferenceLevel: string;
  pieceChanges: string;
  pieceAdded: string;
  pieceRemoved: string;
  pieceModified: string;
  pieceColor: string;
  pieceBrand: string;
  pieceRack: string;
  packingPref: string;
  pricingChanges: string;
  paymentAdjustment: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  itemAdded: string;
  itemRemoved: string;
  itemModified: string;
  oldSubtotal: string;
  newSubtotal: string;
  oldTotal: string;
  newTotal: string;
  difference: string;
  noChangesRecorded: string;
  charge: string;
  refund: string;
  ipAddress: string;
  viewDetails: string;
  hideDetails: string;
  qty: string;
  price: string;
  totalPrice: string;
  notes: string;
  stain: string;
  damage: string;
  stainNotes: string;
  damageNotes: string;
  yes: string;
  no: string;
  editStatusTitle: string;
  committedAt: string;
  committedBy: string;
  editStateVersion: string;
  editAccessStatus: string;
  editBlockReasonCode: string;
  editBlockReasonText: string;
  editBlockedAt: string;
  editBlockedBy: string;
  editBlockUntil: string;
}

/**
 * Narrow, serializable projection of the persisted order-level edit controls.
 *
 * Keeping this separate from timeline rows makes the current edit eligibility
 * visible even before an order has accumulated legacy audit entries.
 */
export interface OrderEditStatusValues {
  committedAt: string | null;
  committedBy: string | null;
  editStateVersion: number | null;
  editAccessStatus: string | null;
  editBlockReasonCode: string | null;
  editBlockReasonText: string | null;
  editBlockedAt: string | null;
  editBlockedBy: string | null;
  editBlockUntil: string | null;
}

interface OrdersEditHistoryTabRprtProps {
  entries: OrderEditHistoryEntry[];
  currencyCode?: string;
  translations: EditHistoryTranslations;
  editStatus: OrderEditStatusValues;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVal(val: unknown, isDate?: boolean, fmtDate?: (v: string) => string | null): string {
  if (val == null) return '—';
  if (isDate) {
    // Civil dates as stored; instants in the screen zone; never the device zone.
    return fmtDate ? (fmtDate(String(val)) ?? '—') : '—';
  }
  if (typeof val === 'boolean') return val ? '✓' : '✗';
  return String(val);
}

/**
 * Produces a safe display projection from the existing order-detail payload.
 *
 * @param order Order record already resolved inside the authenticated tenant boundary.
 * @returns Only the persisted order edit-control fields required by the status panel.
 */
export function toOrderEditStatusValues(order: Record<string, unknown>): OrderEditStatusValues {
  const toNullableString = (value: unknown): string | null => {
    if (value instanceof Date) return value.toISOString();
    return typeof value === 'string' ? value : null;
  };

  return {
    committedAt: toNullableString(order.committed_at),
    committedBy: toNullableString(order.committed_by),
    editStateVersion: typeof order.edit_state_version === 'number' ? order.edit_state_version : null,
    editAccessStatus: toNullableString(order.edit_access_status),
    editBlockReasonCode: toNullableString(order.edit_block_reason_code),
    editBlockReasonText: toNullableString(order.edit_block_reason_text),
    editBlockedAt: toNullableString(order.edit_blocked_at),
    editBlockedBy: toNullableString(order.edit_blocked_by),
    editBlockUntil: toNullableString(order.edit_block_until),
  };
}

/** Formats persisted timestamps using the active UI locale while preserving malformed legacy values. */
function formatEditStatusTimestamp(value: string | null, fmtInstant: (v: string) => string | null): string {
  if (!value) return '—';
  return fmtInstant(value) ?? '—';
}

/** Renders the current persisted edit-control values independently of audit-history availability. */
function OrderEditStatusSection({
  status,
  t,
  locale,
  isRTL,
}: {
  status: OrderEditStatusValues;
  t: EditHistoryTranslations;
  locale: string;
  isRTL: boolean;
}) {
  const fmtInstant = useInstantFormatter();
  const rows = [
    { label: t.committedAt, value: formatEditStatusTimestamp(status.committedAt, fmtInstant) },
    { label: t.committedBy, value: formatVal(status.committedBy) },
    { label: t.editStateVersion, value: formatVal(status.editStateVersion) },
    { label: t.editAccessStatus, value: formatVal(status.editAccessStatus) },
    { label: t.editBlockReasonCode, value: formatVal(status.editBlockReasonCode) },
    { label: t.editBlockReasonText, value: formatVal(status.editBlockReasonText) },
    { label: t.editBlockedAt, value: formatEditStatusTimestamp(status.editBlockedAt, fmtInstant) },
    { label: t.editBlockedBy, value: formatVal(status.editBlockedBy) },
    { label: t.editBlockUntil, value: formatEditStatusTimestamp(status.editBlockUntil, fmtInstant) },
  ];

  return (
    <CmxCard className="mb-6">
      <CmxCardHeader className="pb-3">
        <CmxCardTitle className="text-start">{t.editStatusTitle}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((row) => (
            <div key={row.label} className="rounded-md border border-border bg-muted/20 px-3 py-2.5">
              <dt className="text-xs font-medium text-muted-foreground text-start">
                {row.label}
              </dt>
              <dd className="mt-1 break-words font-mono text-sm text-foreground text-start">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </CmxCardContent>
    </CmxCard>
  );
}

const DATE_FIELDS = new Set(['readyByAt']);
const BOOL_FIELDS = new Set(['express', 'isQuickDrop']);

// ─── Field Changes Table ───────────────────────────────────────────────────────

function FieldChangesSection({
  fields, t, isRTL,
}: { fields: FieldChange[]; t: EditHistoryTranslations; isRTL: boolean }) {
  const fmtDateValue = useDateValueFormatter();
  if (!fields.length) return null;
  return (
    <div>
      <SectionHeader icon={<Pencil className="w-3.5 h-3.5" />} label={t.fieldChanges} count={fields.length} color="blue" />
      <div className="overflow-x-auto rounded-lg border border-border mt-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/80 border-b border-border">
              <th className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide text-start">{t.fieldName}</th>
              <th className="px-3 py-2 text-xs font-semibold text-danger-text uppercase tracking-wide text-start">{t.oldValue}</th>
              <th className="w-6" />
              <th className="px-3 py-2 text-xs font-semibold text-success-text uppercase tracking-wide text-start">{t.newValue}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((fc, idx) => (
              <tr key={idx} className="border-b border-border last:border-0 hover:bg-muted/60 transition-colors">
                <td className="px-3 py-2.5 font-medium text-foreground text-xs text-start">
                  {fc.displayName ?? fc.field}
                </td>
                <td className="px-3 py-2.5 text-danger-text text-start">
                  <span className="bg-danger-bg rounded px-1.5 py-0.5 line-through text-xs font-mono">
                    {formatVal(fc.oldValue, DATE_FIELDS.has(fc.field), fmtDateValue)}
                  </span>
                </td>
                <td className="px-1 py-2.5 text-center">
                  <ArrowRight className="w-3 h-3 text-muted-foreground mx-auto" />
                </td>
                <td className="px-3 py-2.5 text-success-text text-start">
                  <span className="bg-success-bg rounded px-1.5 py-0.5 font-semibold text-xs font-mono">
                    {formatVal(fc.newValue, DATE_FIELDS.has(fc.field), fmtDateValue)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Item sub-detail rows ──────────────────────────────────────────────────────

function ItemSubDetail({
  item, fmtMoney, t, isRTL,
}: { item: ItemChange; fmtMoney: (n: number) => string; t: EditHistoryTranslations; isRTL: boolean }) {
  const rows: Array<{ label: string; old: unknown; new: unknown }> = [];

  if (item.changeType === 'modified') {
    if (item.oldQuantity !== item.newQuantity)
      rows.push({ label: t.qty, old: item.oldQuantity, new: item.newQuantity });
    if (item.oldPrice !== item.newPrice)
      rows.push({ label: t.price, old: item.oldPrice != null ? fmtMoney(Number(item.oldPrice)) : null, new: item.newPrice != null ? fmtMoney(Number(item.newPrice)) : null });
    if ((item as any).oldTotalPrice !== (item as any).newTotalPrice)
      rows.push({ label: t.totalPrice, old: (item as any).oldTotalPrice != null ? fmtMoney(Number((item as any).oldTotalPrice)) : null, new: (item as any).newTotalPrice != null ? fmtMoney(Number((item as any).newTotalPrice)) : null });
    if ((item as any).oldNotes !== (item as any).newNotes)
      rows.push({ label: t.notes, old: (item as any).oldNotes, new: (item as any).newNotes });
    if ((item as any).oldHasStain !== (item as any).newHasStain)
      rows.push({ label: t.stain, old: (item as any).oldHasStain, new: (item as any).newHasStain });
    if ((item as any).oldHasDamage !== (item as any).newHasDamage)
      rows.push({ label: t.damage, old: (item as any).oldHasDamage, new: (item as any).newHasDamage });
    if ((item as any).oldStainNotes !== (item as any).newStainNotes)
      rows.push({ label: t.stainNotes, old: (item as any).oldStainNotes, new: (item as any).newStainNotes });
    if ((item as any).oldDamageNotes !== (item as any).newDamageNotes)
      rows.push({ label: t.damageNotes, old: (item as any).oldDamageNotes, new: (item as any).newDamageNotes });
  } else if (item.changeType === 'added') {
    if (item.newQuantity != null) rows.push({ label: t.qty, old: null, new: item.newQuantity });
    if (item.newPrice != null) rows.push({ label: t.price, old: null, new: fmtMoney(Number(item.newPrice)) });
    if ((item as any).newTotalPrice != null) rows.push({ label: t.totalPrice, old: null, new: fmtMoney(Number((item as any).newTotalPrice)) });
  } else {
    if (item.oldQuantity != null) rows.push({ label: t.qty, old: item.oldQuantity, new: null });
    if (item.oldPrice != null) rows.push({ label: t.price, old: fmtMoney(Number(item.oldPrice)), new: null });
  }

  if (!rows.length) return null;

  return (
    <div className="mt-1.5 ms-8 space-y-0.5">
      {rows.map(({ label, old: oldV, new: newV }, i) => (
        <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium text-muted-foreground w-20 flex-shrink-0">{label}</span>
          {item.changeType === 'modified' ? (
            <>
              <span className="text-danger-text line-through font-mono">{formatVal(oldV, false)}</span>
              <ArrowRight className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
              <span className="text-success-text font-semibold font-mono">{formatVal(newV, false)}</span>
            </>
          ) : item.changeType === 'added' ? (
            <span className="text-success-text font-semibold font-mono">{formatVal(newV, false)}</span>
          ) : (
            <span className="text-danger-text line-through font-mono">{formatVal(oldV, false)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Item Changes Section ──────────────────────────────────────────────────────

function ItemChangesSection({
  items, fmtMoney, t, isRTL,
}: { items: ChangeSet['items']; fmtMoney: (n: number) => string; t: EditHistoryTranslations; isRTL: boolean }) {
  const all: Array<{ item: ItemChange; type: 'added' | 'removed' | 'modified' }> = [
    ...items.added.map((i) => ({ item: i, type: 'added' as const })),
    ...items.removed.map((i) => ({ item: i, type: 'removed' as const })),
    ...items.modified.map((i) => ({ item: i, type: 'modified' as const })),
  ];
  if (!all.length) return null;

  const total = all.length;

  return (
    <div>
      <SectionHeader icon={<Package className="w-3.5 h-3.5" />} label={t.itemChanges} count={total} color="purple" />
      <div className="mt-2 space-y-2">
        {all.map(({ item, type }, idx) => (
          <div
            key={idx}
            className={`rounded-lg border ${
              type === 'added'    ? 'bg-success-bg/60 border-success-border'
              : type === 'removed' ? 'bg-danger-bg/60 border-danger-border'
              : 'bg-warning-bg/60 border-warning-border'
            } px-3 py-2`}
          >
            <div className="flex items-center gap-2">
              {type === 'added'    ? <Plus className="w-3.5 h-3.5 text-success-text flex-shrink-0" />
              : type === 'removed' ? <Minus className="w-3.5 h-3.5 text-danger-text flex-shrink-0" />
              : <Pencil className="w-3.5 h-3.5 text-warning-text flex-shrink-0" />}
              <span className={`text-xs font-bold uppercase tracking-wide flex-shrink-0 ${
                type === 'added' ? 'text-success-text' : type === 'removed' ? 'text-danger-text' : 'text-warning-text'
              }`}>
                {type === 'added' ? t.itemAdded : type === 'removed' ? t.itemRemoved : t.itemModified}
              </span>
              <span className="font-semibold text-foreground text-sm">{item.productName}</span>
            </div>
            <ItemSubDetail item={item} fmtMoney={fmtMoney} t={t} isRTL={isRTL} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PreferenceChangesSection({
  preferences, fmtMoney, t, isRTL,
}: {
  preferences: ChangeSet['preferences'] | undefined;
  fmtMoney: (n: number) => string;
  t: EditHistoryTranslations;
  isRTL: boolean;
}) {
  const all: PreferenceChange[] = [
    ...(preferences?.added ?? []),
    ...(preferences?.removed ?? []),
    ...(preferences?.modified ?? []),
  ];
  if (!all.length) return null;

  return (
    <div>
      <SectionHeader icon={<Tags className="w-3.5 h-3.5" />} label={t.preferenceChanges} count={all.length} color="purple" />
      <div className="mt-2 space-y-2">
        {all.map((pref, idx) => {
          const { oldCode, newCode } = preferenceChangeCodes(pref);
          return (
          <div
            key={`${pref.changeType}-${newCode ?? oldCode}-${idx}`}
            className={`rounded-lg border ${
              pref.changeType === 'added'    ? 'bg-success-bg/60 border-success-border'
              : pref.changeType === 'removed' ? 'bg-danger-bg/60 border-danger-border'
              : 'bg-warning-bg/60 border-warning-border'
            } px-3 py-2`}
          >
            <div className="flex items-center gap-2">
              {pref.changeType === 'added'    ? <Plus className="w-3.5 h-3.5 text-success-text flex-shrink-0" />
              : pref.changeType === 'removed' ? <Minus className="w-3.5 h-3.5 text-danger-text flex-shrink-0" />
              : <Pencil className="w-3.5 h-3.5 text-warning-text flex-shrink-0" />}
              <span className={`text-xs font-bold uppercase tracking-wide flex-shrink-0 ${
                pref.changeType === 'added' ? 'text-success-text' : pref.changeType === 'removed' ? 'text-danger-text' : 'text-warning-text'
              }`}>
                {pref.changeType === 'added' ? t.preferenceAdded : pref.changeType === 'removed' ? t.preferenceRemoved : t.preferenceModified}
              </span>
              <span className="font-semibold text-foreground text-sm uppercase tracking-wide">
                {pref.prefsLevel}
              </span>
              {pref.productName ? (
                <span className="text-xs text-muted-foreground">
                  {pref.pieceSeq != null ? `${pref.productName} #${pref.pieceSeq}` : pref.productName}
                </span>
              ) : null}
            </div>
            <div className="mt-1.5 ms-8 space-y-0.5 text-xs text-muted-foreground">
              {([
                { label: t.preferenceLevel, old: pref.prefsLevel, next: pref.prefsLevel },
                { label: t.preferenceKind, old: pref.oldPreferenceSysKind, next: pref.newPreferenceSysKind },
                { label: t.preferenceCode, old: oldCode, next: newCode },
                { label: t.preferenceContent, old: pref.oldPreferenceContent, next: pref.newPreferenceContent },
                {
                  label: t.extraPrice,
                  old: pref.oldExtraPrice != null ? fmtMoney(Number(pref.oldExtraPrice)) : null,
                  next: pref.newExtraPrice != null ? fmtMoney(Number(pref.newExtraPrice)) : null,
                },
              ] as Array<{ label: string; old: unknown; next: unknown }>).map((row, rowIdx) => (
                <div key={rowIdx} className="flex items-center gap-2">
                  <span className="font-medium text-muted-foreground w-28 flex-shrink-0">{row.label}</span>
                  {pref.changeType === 'modified' ? (
                    <>
                      <span className="text-danger-text line-through font-mono">{formatVal(row.old)}</span>
                      <ArrowRight className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-success-text font-semibold font-mono">{formatVal(row.next)}</span>
                    </>
                  ) : pref.changeType === 'added' ? (
                    <span className="text-success-text font-semibold font-mono">{formatVal(row.next)}</span>
                  ) : (
                    <span className="text-danger-text line-through font-mono">{formatVal(row.old)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

function PieceChangesSection({
  pieces, t, isRTL,
}: {
  pieces: ChangeSet['pieces'] | undefined;
  t: EditHistoryTranslations;
  isRTL: boolean;
}) {
  const all: PieceChange[] = [
    ...(pieces?.added ?? []),
    ...(pieces?.removed ?? []),
    ...(pieces?.modified ?? []),
  ];
  if (!all.length) return null;

  const rowsFor = (piece: PieceChange): Array<{ label: string; old: unknown; next: unknown }> => {
    const rows: Array<{ label: string; old: unknown; next: unknown }> = [];
    if (piece.oldColorCodes !== undefined || piece.newColorCodes !== undefined)
      rows.push({ label: t.pieceColor, old: piece.oldColorCodes, next: piece.newColorCodes });
    if (piece.oldBrand !== undefined || piece.newBrand !== undefined)
      rows.push({ label: t.pieceBrand, old: piece.oldBrand, next: piece.newBrand });
    if (piece.oldHasStain !== undefined || piece.newHasStain !== undefined)
      rows.push({ label: t.stain, old: piece.oldHasStain, next: piece.newHasStain });
    if (piece.oldHasDamage !== undefined || piece.newHasDamage !== undefined)
      rows.push({ label: t.damage, old: piece.oldHasDamage, next: piece.newHasDamage });
    if (piece.oldNotes !== undefined || piece.newNotes !== undefined)
      rows.push({ label: t.notes, old: piece.oldNotes, next: piece.newNotes });
    if (piece.oldRackLocation !== undefined || piece.newRackLocation !== undefined)
      rows.push({ label: t.pieceRack, old: piece.oldRackLocation, next: piece.newRackLocation });
    if (piece.oldPackingPrefCode !== undefined || piece.newPackingPrefCode !== undefined)
      rows.push({ label: t.packingPref, old: piece.oldPackingPrefCode, next: piece.newPackingPrefCode });
    return rows;
  };

  return (
    <div>
      <SectionHeader icon={<Layers className="w-3.5 h-3.5" />} label={t.pieceChanges} count={all.length} color="blue" />
      <div className="mt-2 space-y-2">
        {all.map((piece, idx) => (
          <div
            key={`${piece.changeType}-${piece.productName}-${piece.pieceSeq}-${idx}`}
            className={`rounded-lg border ${
              piece.changeType === 'added'    ? 'bg-success-bg/60 border-success-border'
              : piece.changeType === 'removed' ? 'bg-danger-bg/60 border-danger-border'
              : 'bg-warning-bg/60 border-warning-border'
            } px-3 py-2`}
          >
            <div className="flex items-center gap-2">
              {piece.changeType === 'added'    ? <Plus className="w-3.5 h-3.5 text-success-text flex-shrink-0" />
              : piece.changeType === 'removed' ? <Minus className="w-3.5 h-3.5 text-danger-text flex-shrink-0" />
              : <Pencil className="w-3.5 h-3.5 text-warning-text flex-shrink-0" />}
              <span className={`text-xs font-bold uppercase tracking-wide flex-shrink-0 ${
                piece.changeType === 'added' ? 'text-success-text' : piece.changeType === 'removed' ? 'text-danger-text' : 'text-warning-text'
              }`}>
                {piece.changeType === 'added' ? t.pieceAdded : piece.changeType === 'removed' ? t.pieceRemoved : t.pieceModified}
              </span>
              <span className="font-semibold text-foreground text-sm">
                {piece.productName ?? t.itemChanges} #{piece.pieceSeq}
              </span>
            </div>
            <div className="mt-1.5 ms-8 space-y-0.5">
              {rowsFor(piece).map((row, rowIdx) => (
                <div key={rowIdx} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-muted-foreground w-20 flex-shrink-0">{row.label}</span>
                  {piece.changeType === 'modified' ? (
                    <>
                      <span className="text-danger-text line-through font-mono">{formatVal(row.old)}</span>
                      <ArrowRight className="w-2.5 h-2.5 text-muted-foreground flex-shrink-0" />
                      <span className="text-success-text font-semibold font-mono">{formatVal(row.next)}</span>
                    </>
                  ) : piece.changeType === 'added' ? (
                    <span className="text-success-text font-semibold font-mono">{formatVal(row.next)}</span>
                  ) : (
                    <span className="text-danger-text line-through font-mono">{formatVal(row.old)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pricing Changes Section ───────────────────────────────────────────────────

function PricingChangesSection({
  pricing, fmtMoney, t, isRTL,
}: { pricing: ChangeSet['pricing']; fmtMoney: (n: number) => string; t: EditHistoryTranslations; isRTL: boolean }) {
  if (!pricing) return null;
  const diff = pricing.difference;
  const isIncrease = diff >= 0;

  return (
    <div>
      <SectionHeader icon={<DollarSign className="w-3.5 h-3.5" />} label={t.pricingChanges} color="orange" />
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([
          { label: t.oldSubtotal, value: pricing.oldSubtotal, cls: 'text-danger-text line-through', bg: 'bg-danger-bg border-danger-border' },
          { label: t.newSubtotal, value: pricing.newSubtotal, cls: 'text-success-text font-bold',  bg: 'bg-success-bg border-success-border' },
          { label: t.oldTotal,    value: pricing.oldTotal,    cls: 'text-danger-text line-through', bg: 'bg-danger-bg border-danger-border' },
          { label: t.newTotal,    value: pricing.newTotal,    cls: 'text-success-text font-bold',  bg: 'bg-success-bg border-success-border' },
        ] as Array<{ label: string; value: number; cls: string; bg: string }>).map(({ label, value, cls, bg }) => (
          <div key={label} className={`rounded-lg border px-3 py-2 ${bg}`}>
            <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
            <p className={`text-sm font-mono ${cls}`}>{fmtMoney(Number(value))}</p>
          </div>
        ))}
      </div>
      <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        isIncrease ? 'bg-warning-bg text-warning-text' : 'bg-success-bg text-success-text'
      }`}>
        {isIncrease ? <AlertTriangle className="w-3 h-3" /> : <ArrowRight className="w-3 h-3 rotate-180" />}
        {t.difference}: {isIncrease ? '+' : ''}{fmtMoney(Number(diff))} ({pricing.percentageChange.toFixed(1)}%)
      </div>
    </div>
  );
}

// ─── Section Header Helper ─────────────────────────────────────────────────────

function SectionHeader({ icon, label, count, color }: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  color: 'blue' | 'purple' | 'orange' | 'gray';
}) {
  const colorMap = {
    blue:   'text-info-text bg-info-bg border-info-border',
    purple: 'text-info-text bg-info-bg border-info-border',
    orange: 'text-warning-text bg-warning-bg border-warning-border',
    gray:   'text-muted-foreground bg-muted border-border',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border text-xs font-semibold ${colorMap[color]}`}>
      {icon}
      {label}
      {count != null && (
        <span className={`ms-0.5 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold ${
          color === 'blue' ? 'bg-info-bg text-info-text'
          : color === 'purple' ? 'bg-info-bg text-info-text'
          : color === 'orange' ? 'bg-warning-bg text-warning-text'
          : 'bg-muted text-foreground'
        }`}>{count}</span>
      )}
    </div>
  );
}

// ─── Change pills (shown in collapsed header) ──────────────────────────────────

function ChangePills({ entry, t }: { entry: OrderEditHistoryEntry; t: EditHistoryTranslations }) {
  const fieldCount = entry.changes?.fields?.length ?? 0;
  const addedCount = entry.changes?.items?.added?.length ?? 0;
  const removedCount = entry.changes?.items?.removed?.length ?? 0;
  const modifiedCount = entry.changes?.items?.modified?.length ?? 0;
  const prefCount = preferenceChangeCount(entry.changes?.preferences);
  const pieceCount = pieceChangeCount(entry.changes?.pieces);
  const hasPricing = !!entry.changes?.pricing;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {fieldCount > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-info-bg text-info-text text-[10px] font-semibold px-2 py-0.5">
          <Pencil className="w-2.5 h-2.5" />{fieldCount}
        </span>
      )}
      {addedCount > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-success-bg text-success-text text-[10px] font-semibold px-2 py-0.5">
          <Plus className="w-2.5 h-2.5" />{addedCount}
        </span>
      )}
      {removedCount > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-danger-bg text-danger-text text-[10px] font-semibold px-2 py-0.5">
          <Minus className="w-2.5 h-2.5" />{removedCount}
        </span>
      )}
      {modifiedCount > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-warning-bg text-warning-text text-[10px] font-semibold px-2 py-0.5">
          <Wrench className="w-2.5 h-2.5" />{modifiedCount}
        </span>
      )}
      {pieceCount > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-info-bg text-info-text text-[10px] font-semibold px-2 py-0.5">
          <Layers className="w-2.5 h-2.5" />{pieceCount}
        </span>
      )}
      {prefCount > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-info-bg text-info-text text-[10px] font-semibold px-2 py-0.5">
          <Tags className="w-2.5 h-2.5" />{prefCount}
        </span>
      )}
      {hasPricing && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-warning-bg text-warning-text text-[10px] font-semibold px-2 py-0.5">
          <DollarSign className="w-2.5 h-2.5" />
        </span>
      )}
    </div>
  );
}

// ─── Single Edit Entry Row ─────────────────────────────────────────────────────

function EditEntryRow({
  entry, fmtMoney, t, isRTL, isLast,
}: {
  entry: OrderEditHistoryEntry;
  fmtMoney: (n: number) => string;
  t: EditHistoryTranslations;
  isRTL: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const hasFieldChanges   = (entry.changes?.fields?.length ?? 0) > 0;
  const hasItemChanges    = (entry.changes?.items?.added?.length ?? 0)
                          + (entry.changes?.items?.removed?.length ?? 0)
                          + (entry.changes?.items?.modified?.length ?? 0) > 0;
  const hasPricingChanges = !!entry.changes?.pricing;
  const hasPrefChanges    = preferenceChangeCount(entry.changes?.preferences) > 0;
  const hasPieceChanges   = pieceChangeCount(entry.changes?.pieces) > 0;
  const hasAnyChanges     = hasFieldChanges || hasItemChanges || hasPricingChanges || hasPrefChanges || hasPieceChanges;

  return (
    <div className="relative flex gap-3">
      {/* Timeline line + dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold shadow-sm ring-2 ring-ring flex-shrink-0 z-10">
          {entry.editNumber}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-muted mt-1" />}
      </div>

      {/* Card */}
      <div className="flex-1 mb-4 min-w-0">
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {/* Header */}
          <button
            onClick={() => hasAnyChanges && setExpanded((v) => !v)}
            className={`w-full text-start p-4 hover:bg-muted/70 transition-colors ${!hasAnyChanges ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 text-start">
                {/* Top row: editor + payment badge */}
                <div className="flex items-center flex-wrap gap-2 mb-1">
                  <span className="font-semibold text-foreground text-sm">
                    {entry.editedByName ?? entry.editedBy.slice(0, 12)}
                  </span>
                  {entry.paymentAdjusted && (
                    <CmxStatusBadge size="sm"
                      tone="neutral" appearance="outline"
                      className={`text-xs ${entry.paymentAdjustmentType === 'REFUND' ? 'border-success text-success-text bg-success-bg' : 'border-warning text-warning-text bg-warning-bg'}`}
                    >
                      <CreditCard className="w-3 h-3 me-1" />
                      {entry.paymentAdjustmentType === 'REFUND' ? t.refund : t.charge}
                      {entry.paymentAdjustmentAmount != null && (
                        <span className="ms-1 font-mono">{fmtMoney(Math.abs(entry.paymentAdjustmentAmount))}</span>
                      )}
                    </CmxStatusBadge>
                  )}
                </div>

                {/* Summary line */}
                <p className="text-sm text-muted-foreground leading-snug mb-2">{entry.changeSummary}</p>

                {/* Change pills */}
                {hasAnyChanges && <ChangePills entry={entry} t={t} />}

                {/* Meta row */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <CmxInstant value={entry.editedAt} />
                  </span>
                  <span className="flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span className="font-mono">{entry.editedBy.slice(0, 8)}…</span>
                  </span>
                  {entry.ipAddress && (
                    <span className="flex items-center gap-1">
                      <Globe className="w-3 h-3" />
                      <span className="font-mono">{entry.ipAddress}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Expand toggle */}
              {hasAnyChanges && (
                <div className="flex-shrink-0 flex items-center gap-1 text-xs text-primary-text px-2 py-1 rounded-md hover:bg-info-bg transition-colors">
                  {expanded
                    ? <><ChevronDown className="w-4 h-4" /><span className="hidden sm:inline">{t.hideDetails}</span></>
                    : <><ChevronRight className="w-4 h-4" /><span className="hidden sm:inline">{t.viewDetails}</span></>
                  }
                </div>
              )}
            </div>
          </button>

          {/* Expanded details */}
          {expanded && hasAnyChanges && (
            <div className="border-t border-border bg-muted/40 px-4 py-4 space-y-4">
              {hasFieldChanges   && <FieldChangesSection   fields={entry.changes.fields}         t={t} isRTL={isRTL} />}
              {hasItemChanges    && <ItemChangesSection    items={entry.changes.items}  fmtMoney={fmtMoney} t={t} isRTL={isRTL} />}
              {hasPieceChanges   && <PieceChangesSection   pieces={entry.changes.pieces} t={t} isRTL={isRTL} />}
              {hasPrefChanges    && <PreferenceChangesSection preferences={entry.changes.preferences} fmtMoney={fmtMoney} t={t} isRTL={isRTL} />}
              {hasPricingChanges && <PricingChangesSection pricing={entry.changes.pricing} fmtMoney={fmtMoney} t={t} isRTL={isRTL} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

/**
 *
 * @param root0
 * @param root0.entries
 * @param root0.currencyCode
 * @param root0.translations
 */
export function OrdersEditHistoryTabRprt({
  entries,
  currencyCode,
  translations: t,
  editStatus,
}: OrdersEditHistoryTabRprtProps) {
  const isRTL = useRTL();
  const locale = useLocale();
  const { currencyCode: tenantCurrency, decimalPlaces } = useTenantCurrency();
  const moneyLocale = locale === 'ar' ? 'ar' : 'en';
  const effectiveCurrency = (currencyCode?.trim() || tenantCurrency || '') as string;
  const fmtMoney = (n: number) =>
    formatMoneyAmountWithCode(n, {
      currencyCode: effectiveCurrency,
      decimalPlaces,
      locale: moneyLocale,
    });

  if (!entries || entries.length === 0) {
    return (
      <div>
        <OrderEditStatusSection status={editStatus} t={t} locale={locale} isRTL={isRTL} />
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <History className="w-7 h-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">{t.emptyEditHistory}</p>
        </div>
      </div>
    );
  }

  // Stats bar
  const totalFields  = entries.reduce((s, e) => s + (e.changes?.fields?.length ?? 0), 0);
  const totalAdded   = entries.reduce((s, e) => s + (e.changes?.items?.added?.length ?? 0), 0);
  const totalRemoved = entries.reduce((s, e) => s + (e.changes?.items?.removed?.length ?? 0), 0);
  const totalMod     = entries.reduce((s, e) => s + (e.changes?.items?.modified?.length ?? 0), 0);

  return (
    <div>
      <OrderEditStatusSection status={editStatus} t={t} locale={locale} isRTL={isRTL} />
      {/* Stats bar */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary-text" />
          <span className="text-sm font-semibold text-foreground">{t.editHistoryTitle}</span>
          <CmxStatusBadge size="sm" tone="neutral" className="text-xs font-bold">{entries.length}</CmxStatusBadge>
        </div>
        <div className="flex items-center gap-2 border-s border-border ps-3 flex-wrap">
          {totalFields  > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-info-text bg-info-bg rounded-full px-2 py-0.5 font-medium"><Pencil className="w-3 h-3" />{totalFields} field{totalFields > 1 ? 's' : ''}</span>}
          {totalAdded   > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-success-text bg-success-bg rounded-full px-2 py-0.5 font-medium"><Plus className="w-3 h-3" />{totalAdded} added</span>}
          {totalRemoved > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-danger-text bg-danger-bg rounded-full px-2 py-0.5 font-medium"><Minus className="w-3 h-3" />{totalRemoved} removed</span>}
          {totalMod     > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-warning-text bg-warning-bg rounded-full px-2 py-0.5 font-medium"><Wrench className="w-3 h-3" />{totalMod} modified</span>}
        </div>
      </div>

      {/* Timeline */}
      <div>
        {entries.map((entry, idx) => (
          <EditEntryRow
            key={entry.id}
            entry={entry}
            fmtMoney={fmtMoney}
            t={t}
            isRTL={isRTL}
            isLast={idx === entries.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

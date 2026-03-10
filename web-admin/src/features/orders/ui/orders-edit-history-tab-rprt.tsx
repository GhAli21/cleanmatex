'use client';

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
  DollarSign,
  AlertTriangle,
  Wrench,
  Globe,
} from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { Badge } from '@ui/primitives/badge';
import type { ChangeSet, FieldChange, ItemChange } from '@/lib/services/order-audit.service';

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface EditHistoryTranslations {
  emptyEditHistory: string;
  editHistoryTitle: string;
  editNo: string;
  editedBy: string;
  editedAt: string;
  changeSummary: string;
  fieldChanges: string;
  itemChanges: string;
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
}

interface OrdersEditHistoryTabRprtProps {
  entries: OrderEditHistoryEntry[];
  currencyCode?: string;
  translations: EditHistoryTranslations;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVal(val: unknown, isDate?: boolean): string {
  if (val == null) return '—';
  if (isDate) {
    try { return new Date(val as string).toLocaleString(); } catch { return String(val); }
  }
  if (typeof val === 'boolean') return val ? '✓' : '✗';
  return String(val);
}

const DATE_FIELDS = new Set(['readyByAt']);
const BOOL_FIELDS = new Set(['express', 'isQuickDrop']);

// ─── Field Changes Table ───────────────────────────────────────────────────────

function FieldChangesSection({
  fields, t, isRTL,
}: { fields: FieldChange[]; t: EditHistoryTranslations; isRTL: boolean }) {
  if (!fields.length) return null;
  return (
    <div>
      <SectionHeader icon={<Pencil className="w-3.5 h-3.5" />} label={t.fieldChanges} count={fields.length} color="blue" />
      <div className="overflow-x-auto rounded-lg border border-gray-100 mt-2">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50/80 border-b border-gray-100">
              <th className={`px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide ${isRTL ? 'text-right' : 'text-left'}`}>{t.fieldName}</th>
              <th className={`px-3 py-2 text-xs font-semibold text-red-400 uppercase tracking-wide ${isRTL ? 'text-right' : 'text-left'}`}>{t.oldValue}</th>
              <th className="w-6" />
              <th className={`px-3 py-2 text-xs font-semibold text-green-600 uppercase tracking-wide ${isRTL ? 'text-right' : 'text-left'}`}>{t.newValue}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((fc, idx) => (
              <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors">
                <td className={`px-3 py-2.5 font-medium text-gray-700 text-xs ${isRTL ? 'text-right' : 'text-left'}`}>
                  {fc.displayName ?? fc.field}
                </td>
                <td className={`px-3 py-2.5 text-red-500 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <span className="bg-red-50 rounded px-1.5 py-0.5 line-through text-xs font-mono">
                    {formatVal(fc.oldValue, DATE_FIELDS.has(fc.field))}
                  </span>
                </td>
                <td className="px-1 py-2.5 text-center">
                  <ArrowRight className="w-3 h-3 text-gray-300 mx-auto" />
                </td>
                <td className={`px-3 py-2.5 text-green-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <span className="bg-green-50 rounded px-1.5 py-0.5 font-semibold text-xs font-mono">
                    {formatVal(fc.newValue, DATE_FIELDS.has(fc.field))}
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
  item, currencyCode, t, isRTL,
}: { item: ItemChange; currencyCode: string; t: EditHistoryTranslations; isRTL: boolean }) {
  const rows: Array<{ label: string; old: unknown; new: unknown }> = [];

  if (item.changeType === 'modified') {
    if (item.oldQuantity !== item.newQuantity)
      rows.push({ label: t.qty, old: item.oldQuantity, new: item.newQuantity });
    if (item.oldPrice !== item.newPrice)
      rows.push({ label: t.price, old: item.oldPrice != null ? `${Number(item.oldPrice).toFixed(3)} ${currencyCode}` : null, new: item.newPrice != null ? `${Number(item.newPrice).toFixed(3)} ${currencyCode}` : null });
    if ((item as any).oldTotalPrice !== (item as any).newTotalPrice)
      rows.push({ label: t.totalPrice, old: (item as any).oldTotalPrice != null ? `${Number((item as any).oldTotalPrice).toFixed(3)} ${currencyCode}` : null, new: (item as any).newTotalPrice != null ? `${Number((item as any).newTotalPrice).toFixed(3)} ${currencyCode}` : null });
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
    if (item.newPrice != null) rows.push({ label: t.price, old: null, new: `${Number(item.newPrice).toFixed(3)} ${currencyCode}` });
    if ((item as any).newTotalPrice != null) rows.push({ label: t.totalPrice, old: null, new: `${Number((item as any).newTotalPrice).toFixed(3)} ${currencyCode}` });
  } else {
    if (item.oldQuantity != null) rows.push({ label: t.qty, old: item.oldQuantity, new: null });
    if (item.oldPrice != null) rows.push({ label: t.price, old: `${Number(item.oldPrice).toFixed(3)} ${currencyCode}`, new: null });
  }

  if (!rows.length) return null;

  return (
    <div className={`mt-1.5 ml-8 space-y-0.5 ${isRTL ? 'mr-8 ml-0' : ''}`}>
      {rows.map(({ label, old: oldV, new: newV }, i) => (
        <div key={i} className={`flex items-center gap-2 text-xs text-gray-500 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <span className="font-medium text-gray-400 w-20 flex-shrink-0">{label}</span>
          {item.changeType === 'modified' ? (
            <>
              <span className="text-red-400 line-through font-mono">{formatVal(oldV, false)}</span>
              <ArrowRight className="w-2.5 h-2.5 text-gray-300 flex-shrink-0" />
              <span className="text-green-600 font-semibold font-mono">{formatVal(newV, false)}</span>
            </>
          ) : item.changeType === 'added' ? (
            <span className="text-green-600 font-semibold font-mono">{formatVal(newV, false)}</span>
          ) : (
            <span className="text-red-400 line-through font-mono">{formatVal(oldV, false)}</span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Item Changes Section ──────────────────────────────────────────────────────

function ItemChangesSection({
  items, currencyCode, t, isRTL,
}: { items: ChangeSet['items']; currencyCode: string; t: EditHistoryTranslations; isRTL: boolean }) {
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
              type === 'added'    ? 'bg-green-50/60 border-green-200'
              : type === 'removed' ? 'bg-red-50/60 border-red-200'
              : 'bg-amber-50/60 border-amber-200'
            } px-3 py-2`}
          >
            <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              {type === 'added'    ? <Plus className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
              : type === 'removed' ? <Minus className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
              : <Pencil className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
              <span className={`text-xs font-bold uppercase tracking-wide flex-shrink-0 ${
                type === 'added' ? 'text-green-700' : type === 'removed' ? 'text-red-600' : 'text-amber-700'
              }`}>
                {type === 'added' ? t.itemAdded : type === 'removed' ? t.itemRemoved : t.itemModified}
              </span>
              <span className="font-semibold text-gray-800 text-sm">{item.productName}</span>
            </div>
            <ItemSubDetail item={item} currencyCode={currencyCode} t={t} isRTL={isRTL} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Pricing Changes Section ───────────────────────────────────────────────────

function PricingChangesSection({
  pricing, currencyCode, t, isRTL,
}: { pricing: ChangeSet['pricing']; currencyCode: string; t: EditHistoryTranslations; isRTL: boolean }) {
  if (!pricing) return null;
  const diff = pricing.difference;
  const isIncrease = diff >= 0;

  return (
    <div>
      <SectionHeader icon={<DollarSign className="w-3.5 h-3.5" />} label={t.pricingChanges} color="orange" />
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {([
          { label: t.oldSubtotal, value: pricing.oldSubtotal, cls: 'text-red-500 line-through', bg: 'bg-red-50 border-red-100' },
          { label: t.newSubtotal, value: pricing.newSubtotal, cls: 'text-green-700 font-bold',  bg: 'bg-green-50 border-green-100' },
          { label: t.oldTotal,    value: pricing.oldTotal,    cls: 'text-red-500 line-through', bg: 'bg-red-50 border-red-100' },
          { label: t.newTotal,    value: pricing.newTotal,    cls: 'text-green-700 font-bold',  bg: 'bg-green-50 border-green-100' },
        ] as Array<{ label: string; value: number; cls: string; bg: string }>).map(({ label, value, cls, bg }) => (
          <div key={label} className={`rounded-lg border px-3 py-2 ${bg}`}>
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className={`text-sm font-mono ${cls}`}>{Number(value).toFixed(3)} {currencyCode}</p>
          </div>
        ))}
      </div>
      <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        isIncrease ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
      }`}>
        {isIncrease ? <AlertTriangle className="w-3 h-3" /> : <ArrowRight className="w-3 h-3 rotate-180" />}
        {t.difference}: {isIncrease ? '+' : ''}{Number(diff).toFixed(3)} {currencyCode} ({pricing.percentageChange.toFixed(1)}%)
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
    blue:   'text-blue-600 bg-blue-50 border-blue-100',
    purple: 'text-purple-600 bg-purple-50 border-purple-100',
    orange: 'text-orange-600 bg-orange-50 border-orange-100',
    gray:   'text-gray-600 bg-gray-50 border-gray-100',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 border text-xs font-semibold ${colorMap[color]}`}>
      {icon}
      {label}
      {count != null && (
        <span className={`ml-0.5 rounded-full w-4 h-4 flex items-center justify-center text-[10px] font-bold ${
          color === 'blue' ? 'bg-blue-200 text-blue-800'
          : color === 'purple' ? 'bg-purple-200 text-purple-800'
          : color === 'orange' ? 'bg-orange-200 text-orange-800'
          : 'bg-gray-200 text-gray-700'
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
  const hasPricing = !!entry.changes?.pricing;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {fieldCount > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold px-2 py-0.5">
          <Pencil className="w-2.5 h-2.5" />{fieldCount}
        </span>
      )}
      {addedCount > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-green-100 text-green-700 text-[10px] font-semibold px-2 py-0.5">
          <Plus className="w-2.5 h-2.5" />{addedCount}
        </span>
      )}
      {removedCount > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-red-100 text-red-600 text-[10px] font-semibold px-2 py-0.5">
          <Minus className="w-2.5 h-2.5" />{removedCount}
        </span>
      )}
      {modifiedCount > 0 && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-semibold px-2 py-0.5">
          <Wrench className="w-2.5 h-2.5" />{modifiedCount}
        </span>
      )}
      {hasPricing && (
        <span className="inline-flex items-center gap-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-semibold px-2 py-0.5">
          <DollarSign className="w-2.5 h-2.5" />
        </span>
      )}
    </div>
  );
}

// ─── Single Edit Entry Row ─────────────────────────────────────────────────────

function EditEntryRow({
  entry, currencyCode, t, isRTL, isLast,
}: {
  entry: OrderEditHistoryEntry;
  currencyCode: string;
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
  const hasAnyChanges     = hasFieldChanges || hasItemChanges || hasPricingChanges;

  return (
    <div className={`relative flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
      {/* Timeline line + dot */}
      <div className={`flex flex-col items-center flex-shrink-0 ${isRTL ? 'items-center' : ''}`}>
        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-sm ring-2 ring-blue-100 flex-shrink-0 z-10">
          {entry.editNumber}
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
      </div>

      {/* Card */}
      <div className="flex-1 mb-4 min-w-0">
        <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          {/* Header */}
          <button
            onClick={() => hasAnyChanges && setExpanded((v) => !v)}
            className={`w-full text-left p-4 hover:bg-gray-50/70 transition-colors ${!hasAnyChanges ? 'cursor-default' : 'cursor-pointer'}`}
          >
            <div className={`flex items-start justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                {/* Top row: editor + payment badge */}
                <div className={`flex items-center flex-wrap gap-2 mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="font-semibold text-gray-900 text-sm">
                    {entry.editedByName ?? entry.editedBy.slice(0, 12)}
                  </span>
                  {entry.paymentAdjusted && (
                    <Badge
                      variant="outline"
                      className={`text-xs ${entry.paymentAdjustmentType === 'REFUND' ? 'border-green-400 text-green-700 bg-green-50' : 'border-orange-400 text-orange-700 bg-orange-50'}`}
                    >
                      <CreditCard className="w-3 h-3 mr-1" />
                      {entry.paymentAdjustmentType === 'REFUND' ? t.refund : t.charge}
                      {entry.paymentAdjustmentAmount != null && (
                        <span className="ml-1 font-mono">{Math.abs(entry.paymentAdjustmentAmount).toFixed(3)} {currencyCode}</span>
                      )}
                    </Badge>
                  )}
                </div>

                {/* Summary line */}
                <p className="text-sm text-gray-600 leading-snug mb-2">{entry.changeSummary}</p>

                {/* Change pills */}
                {hasAnyChanges && <ChangePills entry={entry} t={t} />}

                {/* Meta row */}
                <div className={`flex items-center gap-3 text-xs text-gray-400 mt-2 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(entry.editedAt).toLocaleString()}
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
                <div className={`flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}>
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
            <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-4 space-y-4">
              {hasFieldChanges   && <FieldChangesSection   fields={entry.changes.fields}         t={t} isRTL={isRTL} />}
              {hasItemChanges    && <ItemChangesSection    items={entry.changes.items}  currencyCode={currencyCode} t={t} isRTL={isRTL} />}
              {hasPricingChanges && <PricingChangesSection pricing={entry.changes.pricing} currencyCode={currencyCode} t={t} isRTL={isRTL} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function OrdersEditHistoryTabRprt({
  entries,
  currencyCode = 'OMR',
  translations: t,
}: OrdersEditHistoryTabRprtProps) {
  const isRTL = useRTL();

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <History className="w-7 h-7 text-gray-300" />
        </div>
        <p className="text-sm text-gray-400">{t.emptyEditHistory}</p>
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
      {/* Stats bar */}
      <div className={`flex items-center gap-3 mb-6 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-semibold text-gray-700">{t.editHistoryTitle}</span>
          <Badge variant="secondary" className="text-xs font-bold">{entries.length}</Badge>
        </div>
        <div className={`flex items-center gap-2 border-l border-gray-200 pl-3 flex-wrap ${isRTL ? 'border-l-0 border-r pl-0 pr-3' : ''}`}>
          {totalFields  > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-blue-600 bg-blue-50 rounded-full px-2 py-0.5 font-medium"><Pencil className="w-3 h-3" />{totalFields} field{totalFields > 1 ? 's' : ''}</span>}
          {totalAdded   > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-green-700 bg-green-50 rounded-full px-2 py-0.5 font-medium"><Plus className="w-3 h-3" />{totalAdded} added</span>}
          {totalRemoved > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-red-600 bg-red-50 rounded-full px-2 py-0.5 font-medium"><Minus className="w-3 h-3" />{totalRemoved} removed</span>}
          {totalMod     > 0 && <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 rounded-full px-2 py-0.5 font-medium"><Wrench className="w-3 h-3" />{totalMod} modified</span>}
        </div>
      </div>

      {/* Timeline */}
      <div>
        {entries.map((entry, idx) => (
          <EditEntryRow
            key={entry.id}
            entry={entry}
            currencyCode={currencyCode}
            t={t}
            isRTL={isRTL}
            isLast={idx === entries.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

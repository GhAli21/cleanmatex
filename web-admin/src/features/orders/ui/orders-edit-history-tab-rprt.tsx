'use client';

import { useState } from 'react';
import { History, ChevronDown, ChevronRight, User, Clock, CreditCard, ArrowRight } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { Badge } from '@ui/primitives/badge';
import { CmxCopyableCell } from '@ui/data-display/cmx-copyable-cell';
import type { ChangeSet, FieldChange, ItemChange } from '@/lib/services/order-audit.service';

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

interface OrdersEditHistoryTabRprtProps {
  entries: OrderEditHistoryEntry[];
  currencyCode?: string;
  translations: {
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
  };
}

function FieldChangesTable({
  fields,
  t,
  isRTL,
}: {
  fields: FieldChange[];
  t: OrdersEditHistoryTabRprtProps['translations'];
  isRTL: boolean;
}) {
  if (!fields.length) return null;
  return (
    <div className="mt-3">
      <h5 className={`text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
        {t.fieldChanges}
      </h5>
      <div className="overflow-x-auto rounded-md border border-gray-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className={`px-3 py-2 text-xs font-medium text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>{t.fieldName}</th>
              <th className={`px-3 py-2 text-xs font-medium text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>{t.oldValue}</th>
              <th className="px-2 py-2 text-gray-300">
                <ArrowRight className="w-3 h-3 mx-auto" />
              </th>
              <th className={`px-3 py-2 text-xs font-medium text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>{t.newValue}</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((fc, idx) => (
              <tr key={idx} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                <td className={`px-3 py-2 font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                  {fc.displayName ?? fc.field}
                </td>
                <td className={`px-3 py-2 text-red-600 line-through ${isRTL ? 'text-right' : 'text-left'}`}>
                  {fc.oldValue != null ? String(fc.oldValue) : '—'}
                </td>
                <td className="px-2 py-2 text-gray-300 text-center">
                  <ArrowRight className="w-3 h-3 mx-auto" />
                </td>
                <td className={`px-3 py-2 text-green-700 font-medium ${isRTL ? 'text-right' : 'text-left'}`}>
                  {fc.newValue != null ? String(fc.newValue) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ItemChangesSection({
  items,
  t,
  isRTL,
}: {
  items: ChangeSet['items'];
  t: OrdersEditHistoryTabRprtProps['translations'];
  isRTL: boolean;
}) {
  const all: Array<{ item: ItemChange; type: 'added' | 'removed' | 'modified' }> = [
    ...items.added.map((i) => ({ item: i, type: 'added' as const })),
    ...items.removed.map((i) => ({ item: i, type: 'removed' as const })),
    ...items.modified.map((i) => ({ item: i, type: 'modified' as const })),
  ];

  if (!all.length) return null;

  const getBadge = (type: 'added' | 'removed' | 'modified') => {
    if (type === 'added') return <Badge variant="default" className="bg-green-100 text-green-800 text-xs">{t.itemAdded}</Badge>;
    if (type === 'removed') return <Badge variant="destructive" className="text-xs">{t.itemRemoved}</Badge>;
    return <Badge variant="secondary" className="text-xs">{t.itemModified}</Badge>;
  };

  return (
    <div className="mt-3">
      <h5 className={`text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
        {t.itemChanges}
      </h5>
      <div className="space-y-1.5">
        {all.map(({ item, type }, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm border ${
              type === 'added'
                ? 'bg-green-50 border-green-100'
                : type === 'removed'
                ? 'bg-red-50 border-red-100'
                : 'bg-amber-50 border-amber-100'
            } ${isRTL ? 'flex-row-reverse' : ''}`}
          >
            {getBadge(type)}
            <span className="font-medium text-gray-800">{item.productName}</span>
            {item.oldQuantity != null && item.newQuantity != null && (
              <span className="text-gray-500 text-xs">
                {item.oldQuantity} → {item.newQuantity}
              </span>
            )}
            {item.oldPrice != null && item.newPrice != null && (
              <span className="text-gray-500 text-xs">
                {item.oldPrice} → {item.newPrice}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PricingChanges({
  pricing,
  t,
  currencyCode,
  isRTL,
}: {
  pricing: ChangeSet['pricing'];
  t: OrdersEditHistoryTabRprtProps['translations'];
  currencyCode: string;
  isRTL: boolean;
}) {
  if (!pricing) return null;
  const diff = pricing.difference;
  return (
    <div className="mt-3">
      <h5 className={`text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
        {t.pricingChanges}
      </h5>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: t.oldSubtotal, value: pricing.oldSubtotal, cls: 'text-red-600 line-through' },
          { label: t.newSubtotal, value: pricing.newSubtotal, cls: 'text-green-700 font-semibold' },
          { label: t.oldTotal, value: pricing.oldTotal, cls: 'text-red-600 line-through' },
          { label: t.newTotal, value: pricing.newTotal, cls: 'text-green-700 font-semibold' },
        ].map(({ label, value, cls }) => (
          <div key={label} className="rounded-md bg-gray-50 border border-gray-100 px-3 py-2">
            <p className="text-xs text-gray-400 mb-0.5">{label}</p>
            <p className={`text-sm ${cls}`}>
              {Number(value).toFixed(3)} {currencyCode}
            </p>
          </div>
        ))}
      </div>
      <p className={`mt-2 text-xs ${diff >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
        {t.difference}: {diff >= 0 ? '+' : ''}{Number(diff).toFixed(3)} {currencyCode} ({pricing.percentageChange.toFixed(1)}%)
      </p>
    </div>
  );
}

function EditEntryRow({
  entry,
  currencyCode,
  t,
  isRTL,
}: {
  entry: OrderEditHistoryEntry;
  currencyCode: string;
  t: OrdersEditHistoryTabRprtProps['translations'];
  isRTL: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const hasFieldChanges = entry.changes?.fields?.length > 0;
  const hasItemChanges =
    (entry.changes?.items?.added?.length ?? 0) +
      (entry.changes?.items?.removed?.length ?? 0) +
      (entry.changes?.items?.modified?.length ?? 0) >
    0;
  const hasPricingChanges = !!entry.changes?.pricing;
  const hasAnyChanges = hasFieldChanges || hasItemChanges || hasPricingChanges;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Row header */}
      <div
        className={`flex items-start gap-3 p-4 bg-white hover:bg-gray-50/70 transition-colors ${isRTL ? 'flex-row-reverse' : ''}`}
      >
        {/* Edit number badge */}
        <div className="flex-shrink-0 w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
          <span className="text-xs font-bold text-blue-700">#{entry.editNumber}</span>
        </div>

        {/* Main info */}
        <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
          <div className={`flex items-center flex-wrap gap-2 mb-1 ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
            <span className="font-medium text-gray-900 text-sm">
              {entry.editedByName ?? entry.editedBy.slice(0, 8)}
            </span>
            {entry.paymentAdjusted && (
              <Badge
                variant="outline"
                className={`text-xs ${entry.paymentAdjustmentType === 'REFUND' ? 'border-green-400 text-green-700' : 'border-orange-400 text-orange-700'}`}
              >
                <CreditCard className="w-3 h-3 mr-1" />
                {entry.paymentAdjustmentType === 'REFUND' ? t.refund : t.charge}
                {entry.paymentAdjustmentAmount != null && (
                  <span className="ml-1">
                    {Math.abs(entry.paymentAdjustmentAmount).toFixed(3)} {currencyCode}
                  </span>
                )}
              </Badge>
            )}
          </div>
          <p className={`text-sm text-gray-600 mb-1.5 ${isRTL ? 'text-right' : 'text-left'}`}>
            {entry.changeSummary}
          </p>
          <div className={`flex items-center gap-3 text-xs text-gray-400 flex-wrap ${isRTL ? 'flex-row-reverse justify-end' : ''}`}>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {new Date(entry.editedAt).toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              <span className="font-mono">{entry.editedBy.slice(0, 8)}…</span>
            </span>
            {entry.ipAddress && (
              <span className="font-mono">{entry.ipAddress}</span>
            )}
          </div>
        </div>

        {/* Expand toggle */}
        {hasAnyChanges && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="flex-shrink-0 flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
          >
            {expanded ? (
              <>
                {t.hideDetails}
                <ChevronDown className="w-3.5 h-3.5" />
              </>
            ) : (
              <>
                {t.viewDetails}
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Expanded detail panel */}
      {expanded && hasAnyChanges && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3">
          {hasFieldChanges && (
            <FieldChangesTable fields={entry.changes.fields} t={t} isRTL={isRTL} />
          )}
          {hasItemChanges && (
            <ItemChangesSection items={entry.changes.items} t={t} isRTL={isRTL} />
          )}
          {hasPricingChanges && (
            <PricingChanges pricing={entry.changes.pricing} t={t} currencyCode={currencyCode} isRTL={isRTL} />
          )}
        </div>
      )}
    </div>
  );
}

export function OrdersEditHistoryTabRprt({
  entries,
  currencyCode = 'OMR',
  translations: t,
}: OrdersEditHistoryTabRprtProps) {
  const isRTL = useRTL();

  if (!entries || entries.length === 0) {
    return (
      <div className={`flex flex-col items-center justify-center py-16 text-gray-400 ${isRTL ? 'text-right' : 'text-left'}`}>
        <History className="w-12 h-12 mb-3 text-gray-200" />
        <p className="text-sm">{t.emptyEditHistory}</p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary bar */}
      <div className={`flex items-center gap-2 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <History className="w-4 h-4 text-blue-500" />
        <span className="text-sm font-medium text-gray-700">{t.editHistoryTitle}</span>
        <Badge variant="secondary" className="text-xs">{entries.length}</Badge>
      </div>

      <div className="space-y-3">
        {entries.map((entry) => (
          <EditEntryRow
            key={entry.id}
            entry={entry}
            currencyCode={currencyCode}
            t={t}
            isRTL={isRTL}
          />
        ))}
      </div>
    </div>
  );
}

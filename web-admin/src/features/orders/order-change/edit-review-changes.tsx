'use client';

import type { ReactNode } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ORDER_CHANGE_OPERATION_CODES } from '@/lib/constants/order-change';
import type { EditReviewOperation } from './edit-review-view';

// Keep persistence identities and display metadata out of the operator-facing value comparison.
const HIDDEN_IN_SUMMARY = new Set([
  'id', 'orderId', 'orderItemId', 'orderItemPieceId', 'orderPreferenceId', 'productId', 'preferenceId',
  'targetKind', 'targetId', 'clientRef', 'recStatus', 'preferenceKind', 'preference_sys_kind',
  'branch_id', 'product_id', 'preference_id', 'order_item_id', 'order_item_piece_id', 'order_item_srno',
  'barcode', 'piece_code', 'items', 'productName', 'productName2', 'product_name', 'product_name2',
  'rec_status', 'currencyCode', 'currency_code', 'field',
]);
const MONEY_KEYS = new Set(['pricePerUnit', 'totalPrice', 'priceOverride', 'preferenceCharge', 'extraPrice', 'totalAmount', 'taxAmount', 'commercialDelta', 'price_per_unit', 'total_price', 'price_override', 'service_pref_charge', 'extra_price', 'total_amount', 'total_tax_amount', 'commercial_delta', 'express_charge_amount']);
const KIND_KEYS: Record<string, string> = {
  service_prefs: 'service', packing_prefs: 'packing', condition_stain: 'stain', condition_damag: 'damage',
  condition_special: 'condition', condition_pattern: 'condition', condition_material: 'condition', color: 'color', note: 'note',
};

/** Narrows nested price snapshots without assuming a successful Preview payload. */
function isItemList(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every((item) => item != null && typeof item === 'object');
}

/** Compact operation snapshots keep names, values, and their policy gate together. */
export function EditReviewChanges({ operations, currencyCode, timezone, renderWarning }: {
  operations: readonly EditReviewOperation[];
  currencyCode?: string | null;
  timezone?: string | null;
  renderWarning?: (seq: number) => ReactNode;
}) {
  const t = useTranslations('orders.edit');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const labels: Record<string, string> = {
    serviceSpeed: t('workspace.serviceSpeed'), readyBy: t('workspace.readyBy'), priority: tCommon('priority'),
    totalAmount: t('workspace.audit.total'), taxAmount: t('workspace.audit.tax'), commercialDelta: t('workspace.audit.changeAmount'),
    internalNotes: t('workspace.audit.internalNotes'), notes: t('workspace.audit.notes'), customerNotes: t('workspace.audit.customerNotes'),
    customerName: t('workspace.audit.customerName'), customerMobile: t('workspace.audit.mobile'), customerEmail: t('workspace.audit.email'),
    quantity: t('workspace.audit.quantity'), pricePerUnit: t('workspace.audit.unitPrice'), totalPrice: t('workspace.audit.lineTotal'),
    priceOverride: t('review.fields.priceOverride'), preferenceCharge: t('review.fields.preferenceCharge'),
    serviceCategoryCode: t('review.fields.service'), preferenceCode: t('workspace.audit.preferenceCode'),
    preferenceContent: t('workspace.audit.preferenceText'), level: t('workspace.audit.level'), extraPrice: t('workspace.audit.extraPrice'),
    pieceSeq: t('review.fields.pieceNumber'), pieceStatus: t('workspace.audit.status'), pieceStage: t('review.fields.stage'), scanState: t('review.fields.scanState'),
    brand: t('workspace.audit.brand'), value: t('review.fields.value'), overrideReason: t('workspace.reason'), isDefaultCustomer: t('review.fields.defaultCustomer'),
  };
  const aliases: Record<string, string> = {
    service_speed: 'serviceSpeed', ready_by: 'readyBy', total_amount: 'totalAmount', total_tax_amount: 'taxAmount',
    internal_notes: 'internalNotes', customer_notes: 'customerNotes', customer_name: 'customerName', customer_mobile_number: 'customerMobile', customer_email: 'customerEmail',
    price_per_unit: 'pricePerUnit', total_price: 'totalPrice', price_override: 'priceOverride', service_pref_charge: 'preferenceCharge',
    service_category_code: 'serviceCategoryCode', preference_code: 'preferenceCode', preference_content: 'preferenceContent', prefs_level: 'level', extra_price: 'extraPrice',
    piece_seq: 'pieceSeq', piece_status: 'pieceStatus', piece_stage: 'pieceStage', scan_state: 'scanState',
  };
  const textOf = (key: string, value: unknown): string => {
    if (value == null || value === '') return t('review.none');
    if (typeof value === 'boolean') return value ? tCommon('yes') : tCommon('no');
    if (key === 'serviceSpeed' || key === 'service_speed') {
      if (value === 'STANDARD') return t('workspace.standard');
      if (value === 'EXPRESS') return t('workspace.express');
    }
    if (MONEY_KEYS.has(key) && currencyCode && Number.isFinite(Number(value))) {
      // Four fraction digits preserve the database money scale without rewriting snapshot values.
      return new Intl.NumberFormat(locale, { style: 'currency', currency: currencyCode, maximumFractionDigits: 4 }).format(Number(value));
    }
    if ((key === 'readyBy' || key === 'ready_by') && typeof value === 'string') {
      const date = new Date(value);
      if (!Number.isNaN(date.getTime()) && timezone) {
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: timezone }).format(date);
      }
    }
    if (typeof value === 'number') return new Intl.NumberFormat(locale).format(value);
    // Nested objects and identifiers never become a JSON dump in the operator's review.
    return typeof value === 'string' ? value : t('review.none');
  };
  const comparison = (key: string, before: unknown, after: unknown) => (
    <>{t('workspace.audit.before')}: <bdi>{textOf(key, before)}</bdi>{' → '}{t('workspace.audit.after')}: <bdi>{textOf(key, after)}</bdi></>
  );
  return (
    <ul className="space-y-2">
      {operations.map((operation) => {
        const effect = operation.effect ?? (operation.after.recStatus === 0 || operation.after.rec_status === 0 ? 'remove' : Object.keys(operation.before).length === 0 ? 'add' : 'change');
        const snapshot = effect === 'remove' ? operation.before : operation.after;
        const keys = (effect === 'change' ? operation.changedKeys ?? Object.keys({ ...operation.before, ...operation.after }).filter((key) => JSON.stringify(operation.before[key] ?? null) !== JSON.stringify(operation.after[key] ?? null)) : Object.keys(snapshot))
          .filter((key) => !HIDDEN_IN_SUMMARY.has(key) && labels[aliases[key] ?? key] && (effect === 'change' || snapshot[key] != null));
        const code = ORDER_CHANGE_OPERATION_CODES.find((candidate) => candidate === operation.code);
        const name = code ? t(`policyInfo.operations.${code}`) : t('policyInfo.operations.CHANGE_UNLISTED');
        const fallbackTarget = operation.code.includes('PIECE') ? t('review.newPiece') : operation.code.includes('ITEM') ? t('review.newItem') : operation.code.includes('PREFERENCE') ? t('workspace.audit.preferenceCode') : null;
        const target = (locale.startsWith('ar') ? operation.targetLabel2 || operation.targetLabel : operation.targetLabel) || fallbackTarget;
        const kind = KIND_KEYS[operation.preferenceKind ?? ''];
        const beforeItems = isItemList(operation.before.items) ? operation.before.items : [];
        const afterItems = isItemList(operation.after.items) ? operation.after.items : [];
        // The shared border token keeps each change and its policy warning visually grouped.
        return (
          <li key={operation.seq} className="space-y-1 rounded border border-[rgb(var(--cmx-border-rgb,226_232_240))] px-3 py-2 text-sm">
            <p className="font-medium">{name}{target ? <> · <bdi>{target}</bdi></> : null}{kind ? <> · {t(`review.kind.${kind}`)}</> : null}</p>
            {effect !== 'change' ? <p className="text-xs">{effect === 'add' ? t('review.willAdd') : t('review.willRemove')}</p> : null}
            {keys.map((key) => (
              <p key={key} className="break-words text-xs leading-5">
                {labels[aliases[key] ?? key]}{': '}
                {effect === 'change' ? comparison(key, operation.before[key], operation.after[key]) : <bdi>{textOf(key, snapshot[key])}</bdi>}
              </p>
            ))}
            {afterItems.map((item, index) => {
              const itemId = item.orderItemId ?? item.id;
              const previous = beforeItems.find((row) => (row.orderItemId ?? row.id) === itemId);
              const beforePrice = previous?.pricePerUnit ?? previous?.price_per_unit;
              const afterPrice = item.pricePerUnit ?? item.price_per_unit;
              if (beforePrice === afterPrice) return null;
              const itemLabel = operation.itemLabels?.find((row) => row.orderItemId === itemId);
              const label = (locale.startsWith('ar') ? itemLabel?.label2 || itemLabel?.label : itemLabel?.label) || t('workspace.audit.product');
              return <p key={index} className="break-words text-xs leading-5"><bdi>{label}</bdi>{' · '}{t('workspace.audit.unitPrice')}{': '}{comparison('pricePerUnit', beforePrice, afterPrice)}</p>;
            })}
            {renderWarning?.(operation.seq)}
          </li>
        );
      })}
    </ul>
  );
}

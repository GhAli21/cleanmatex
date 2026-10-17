'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import type { EditReviewOperation } from './edit-review-view';

const HIDDEN_IN_SUMMARY = new Set([
  'id', 'branch_id', 'product_id', 'preference_id', 'order_item_id', 'order_item_piece_id',
  'order_item_srno', 'barcode', 'piece_code', 'items',
]);

function sameValue(left: unknown, right: unknown): boolean {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

function isItemList(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every((item) => item != null && typeof item === 'object');
}

/**
 * Review rows for one operation.
 * The summary shows only what changes. The stored row stays one step away.
 */
export function EditReviewChanges({ operations }: { operations: readonly EditReviewOperation[] }) {
  const t = useTranslations('orders.edit');
  const tCommon = useTranslations('common');
  const [openSeq, setOpenSeq] = useState<number | null>(null);
  const labels: Record<string, string> = {
    service_speed: t('workspace.serviceSpeed'),
    ready_by: t('workspace.readyBy'),
    priority: tCommon('priority'),
    currency_code: tCommon('currency'),
    total_amount: t('workspace.audit.total'),
    total_tax_amount: t('workspace.audit.tax'),
    commercial_delta: t('workspace.audit.changeAmount'),
    express_charge_amount: t('workspace.express'),
    internal_notes: t('workspace.audit.internalNotes'),
    customer_notes: t('workspace.audit.customerNotes'),
    customer_name: t('workspace.audit.customerName'),
    customer_mobile_number: t('workspace.audit.mobile'),
    customer_email: t('workspace.audit.email'),
    product_name: t('workspace.audit.product'),
    product_name2: t('workspace.audit.product'),
    quantity: t('workspace.audit.quantity'),
    price_per_unit: t('workspace.audit.unitPrice'),
    total_price: t('workspace.audit.lineTotal'),
    preference_sys_kind: t('workspace.audit.preferenceKind'),
    preference_code: t('workspace.audit.preferenceCode'),
    preference_content: t('workspace.audit.preferenceText'),
    preference_category: t('workspace.audit.category'),
    prefs_level: t('workspace.audit.level'),
    extra_price: t('workspace.audit.extraPrice'),
    prefs_source: t('workspace.audit.source'),
    notes: t('workspace.audit.notes'),
    color: t('workspace.audit.color'),
    brand: t('workspace.audit.brand'),
    status: t('workspace.audit.status'),
    current_status: t('workspace.audit.status'),
    payment_status: t('workspace.audit.status'),
  };
  const operationName = (code: string) => {
    const names: Record<string, string> = {
      ADD_ITEM: t('policyInfo.operations.ADD_ITEM'),
      REMOVE_ITEM: t('policyInfo.operations.REMOVE_ITEM'),
      CHANGE_ITEM_QUANTITY: t('policyInfo.operations.CHANGE_ITEM_QUANTITY'),
      ADD_PIECE: t('policyInfo.operations.ADD_PIECE'),
      REMOVE_PIECE: t('policyInfo.operations.REMOVE_PIECE'),
      ADD_PREFERENCE: t('policyInfo.operations.ADD_PREFERENCE'),
      CHANGE_PREFERENCE: t('policyInfo.operations.CHANGE_PREFERENCE'),
      REMOVE_PREFERENCE: t('policyInfo.operations.REMOVE_PREFERENCE'),
      CHANGE_PRIORITY: t('policyInfo.operations.CHANGE_PRIORITY'),
      CHANGE_SERVICE_SPEED: t('policyInfo.operations.CHANGE_SERVICE_SPEED'),
      CHANGE_READY_BY: t('policyInfo.operations.CHANGE_READY_BY'),
      CHANGE_ORDER_NOTES: t('policyInfo.operations.CHANGE_ORDER_NOTES'),
      CHANGE_CUSTOMER_SNAPSHOT: t('policyInfo.operations.CHANGE_CUSTOMER_SNAPSHOT'),
      CHANGE_UNLISTED: t('policyInfo.operations.CHANGE_UNLISTED'),
    };
    return names[code] ?? code;
  };
  const textOf = (key: string, value: unknown): string => {
    if (value == null || value === '') return tCommon('auditCard.notAvailable');
    if (typeof value === 'boolean') return value ? tCommon('yes') : tCommon('no');
    if (key === 'service_speed' && value === 'STANDARD') return t('workspace.standard');
    if (key === 'service_speed' && value === 'EXPRESS') return t('workspace.express');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };
  const changedKeys = (operation: EditReviewOperation) => {
    const keys = new Set([...Object.keys(operation.before), ...Object.keys(operation.after)]);
    return [...keys].filter((key) => !HIDDEN_IN_SUMMARY.has(key) && !sameValue(operation.before[key], operation.after[key]));
  };
  return (
    <ul className="space-y-2">
      {operations.map((operation) => {
        const removed = operation.after.rec_status === 0 && Object.keys(operation.before).length > 0;
        const added = Object.keys(operation.before).length === 0 && Object.keys(operation.after).length > 0;
        const keys = added
          ? Object.keys(operation.after).filter((key) => !HIDDEN_IN_SUMMARY.has(key) && key !== 'rec_status' && operation.after[key] != null && operation.after[key] !== '')
          : changedKeys(operation).filter((key) => key !== 'rec_status');
        const beforeItems = isItemList(operation.before.items) ? operation.before.items : [];
        const afterItems = isItemList(operation.after.items) ? operation.after.items : [];
        const open = openSeq === operation.seq;
        const storedKeys = [...new Set([...Object.keys(operation.before), ...Object.keys(operation.after)])]
          .filter((key) => key !== 'items' && (operation.before[key] != null || operation.after[key] != null));
        return (
          <li key={operation.seq} className="rounded border border-gray-200 px-3 py-2 text-sm">
            <p className="font-medium">{operationName(operation.code)}</p>
            {removed ? <p className="mt-1 text-xs text-gray-600">{t('workspace.audit.removed')}</p> : null}
            {added ? <p className="mt-1 text-xs text-gray-600">{t('workspace.audit.added')}</p> : null}
            {keys.length > 0 ? (
              <div className="mt-2 space-y-2">
                <div className="hidden grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 text-xs text-gray-500 sm:grid">
                  <span />
                  <span>{t('workspace.audit.before')}</span>
                  <span>{t('workspace.audit.after')}</span>
                </div>
                {keys.map((key) => (
                  <div key={key} className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-2">
                    <span className="text-xs text-gray-500">{labels[key] ?? key}</span>
                    <span className="break-words">{added ? null : textOf(key, operation.before[key])}</span>
                    <span className="break-words font-medium">{textOf(key, operation.after[key])}</span>
                  </div>
                ))}
              </div>
            ) : null}
            {afterItems.length > 0 ? (
              <div className="mt-3 space-y-1">
                <p className="text-xs text-gray-500">{t('workspace.audit.itemPrices')}</p>
                {afterItems.map((item) => {
                  const previous = beforeItems.find((row) => row.id === item.id);
                  const name = typeof item.product_name === 'string' && item.product_name ? item.product_name : t('workspace.audit.product');
                  return (
                    <p key={String(item.id)} className="break-words text-xs">
                      {name}
                      {' · '}
                      {textOf('price_per_unit', previous?.price_per_unit)}
                      {' → '}
                      {textOf('price_per_unit', item.price_per_unit)}
                    </p>
                  );
                })}
              </div>
            ) : null}
            {storedKeys.length > 0 ? (
              <div className="mt-2">
                <CmxButton type="button" variant="ghost" onClick={() => setOpenSeq(open ? null : operation.seq)}>
                  {open ? t('workspace.audit.hideStored') : t('workspace.audit.showStored')}
                </CmxButton>
                {open ? (
                  <dl className="mt-2 space-y-1">
                    {storedKeys.map((key) => (
                      <div key={key} className="grid grid-cols-1 gap-1 text-xs sm:grid-cols-3">
                        <dt className="text-gray-500">{labels[key] ?? key}</dt>
                        <dd className="break-words">{textOf(key, operation.before[key])}</dd>
                        <dd className="break-words">{textOf(key, operation.after[key])}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

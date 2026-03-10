/**
 * Order Customer Details Section
 * Tab 3: Show and edit customer snapshot for the current order.
 * Edits apply to order only, not to customer master (org_customers_mst).
 */

'use client';

import { useCallback, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useNewOrderStateWithDispatch } from '../hooks/use-new-order-state';
import { CmxInput, CmxTextarea } from '@ui/primitives';
import type { CustomerSnapshotOverride } from '../model/new-order-types';

export function OrderCustomerDetailsSection() {
  const { state, setCustomerSnapshotOverride, setCustomerNotes } = useNewOrderStateWithDispatch();
  const isRTL = useRTL();
  const t = useTranslations('newOrder.customerDetails');
  const tCommon = useTranslations('common');

  const name = useMemo(
    () =>
      state.customerSnapshotOverride?.name ??
      state.customerNameSnapshot ??
      state.customerName ??
      state.customer?.name ??
      state.customer?.displayName ??
      '',
    [
      state.customerSnapshotOverride?.name,
      state.customerNameSnapshot,
      state.customerName,
      state.customer?.name,
      state.customer?.displayName,
    ]
  );

  const phone = useMemo(
    () =>
      state.customerSnapshotOverride?.phone ??
      state.customerMobile ??
      state.customer?.phone ??
      '',
    [
      state.customerSnapshotOverride?.phone,
      state.customerMobile,
      state.customer?.phone,
    ]
  );

  const email = useMemo(
    () =>
      state.customerSnapshotOverride?.email ??
      state.customerEmail ??
      state.customer?.email ??
      '',
    [
      state.customerSnapshotOverride?.email,
      state.customerEmail,
      state.customer?.email,
    ]
  );

  const handleNameChange = useCallback(
    (value: string) => {
      const current = state.customerSnapshotOverride ?? {};
      setCustomerSnapshotOverride({
        ...current,
        name: value || undefined,
      });
    },
    [state.customerSnapshotOverride, setCustomerSnapshotOverride]
  );

  const handlePhoneChange = useCallback(
    (value: string) => {
      const current = state.customerSnapshotOverride ?? {};
      setCustomerSnapshotOverride({
        ...current,
        phone: value || undefined,
      });
    },
    [state.customerSnapshotOverride, setCustomerSnapshotOverride]
  );

  const handleEmailChange = useCallback(
    (value: string) => {
      const current = state.customerSnapshotOverride ?? {};
      setCustomerSnapshotOverride({
        ...current,
        email: value || undefined,
      });
    },
    [state.customerSnapshotOverride, setCustomerSnapshotOverride]
  );

  return (
    <div
      className={`space-y-6 ${isRTL ? 'text-right' : 'text-left'}`}
      role="region"
      aria-label={t('title') || 'Customer details'}
    >
      <p className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
        {t('orderOnlyNote') || 'Changes apply to this order only, not to customer profile.'}
      </p>

      <div className="space-y-4">
        <div>
          <label htmlFor="order-customer-name" className="block text-sm font-medium text-gray-700 mb-1">
            {tCommon('name') || 'Name'}
          </label>
          <CmxInput
            id="order-customer-name"
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            dir={isRTL ? 'rtl' : 'ltr'}
            className="w-full"
            placeholder={tCommon('name') || 'Name'}
            aria-label={tCommon('name') || 'Name'}
          />
        </div>

        <div>
          <label htmlFor="order-customer-phone" className="block text-sm font-medium text-gray-700 mb-1">
            {tCommon('phone') || 'Phone'}
          </label>
          <CmxInput
            id="order-customer-phone"
            type="tel"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            dir="ltr"
            className="w-full"
            placeholder={tCommon('phone') || 'Phone'}
            aria-label={tCommon('phone') || 'Phone'}
          />
        </div>

        <div>
          <label htmlFor="order-customer-email" className="block text-sm font-medium text-gray-700 mb-1">
            {tCommon('email') || 'Email'}
          </label>
          <CmxInput
            id="order-customer-email"
            type="email"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            dir="ltr"
            className="w-full"
            placeholder={tCommon('email') || 'Email'}
            aria-label={tCommon('email') || 'Email'}
          />
        </div>

        <div>
          <label htmlFor="order-customer-notes" className="block text-sm font-medium text-gray-700 mb-1">
            {t('customerNotes') || 'Customer notes'}
          </label>
          <CmxTextarea
            id="order-customer-notes"
            value={state.customerNotes ?? ''}
            onChange={(e) => setCustomerNotes(e.target.value)}
            dir={isRTL ? 'rtl' : 'ltr'}
            className="w-full min-h-[80px]"
            placeholder={t('customerNotesPlaceholder') || 'Notes from the customer...'}
            aria-label={t('customerNotes') || 'Customer notes'}
          />
        </div>
      </div>
    </div>
  );
}

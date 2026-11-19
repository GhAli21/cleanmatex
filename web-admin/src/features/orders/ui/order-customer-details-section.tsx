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
import { useOrderWorkspaceSessionOptional } from '../order-change/order-workspace-session';
import { CmxInput, CmxTextarea, Label } from '@ui/primitives';
import { EditControlNotice } from '../order-change/edit-control-notice';
import type { CustomerSnapshotOverride } from '../model/new-order-types';

/**
 *
 */
export function OrderCustomerDetailsSection() {
  const { state, setCustomerSnapshotOverride, setCustomerNotes } = useNewOrderStateWithDispatch();
  const identityLocked = useOrderWorkspaceSessionOptional() != null;
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
      className="space-y-6 text-start"
      role="region"
      aria-label={t('title') || 'Customer details'}
    >
      <p className="text-sm text-warning-text bg-warning-bg border border-warning-border rounded-lg px-4 py-2">
        {t('orderOnlyNote') || 'Changes apply to this order only, not to customer profile.'}
      </p>
      <EditControlNotice identity />

      <div className="space-y-4">
        <div>
          <Label htmlFor="order-customer-name" className="block mb-1">
            {tCommon('name') || 'Name'}
          </Label>
          <CmxInput
            id="order-customer-name"
            type="text"
            value={name}
            readOnly={identityLocked}
            onChange={(e) => handleNameChange(e.target.value)}
            dir={isRTL ? 'rtl' : 'ltr'}
            className="w-full"
            placeholder={tCommon('name') || 'Name'}
            aria-label={tCommon('name') || 'Name'}
          />
        </div>

        <div>
          <Label htmlFor="order-customer-phone" className="block mb-1">
            {tCommon('phone') || 'Phone'}
          </Label>
          <CmxInput
            id="order-customer-phone"
            type="tel"
            value={phone}
            readOnly={identityLocked}
            onChange={(e) => handlePhoneChange(e.target.value)}
            dir="ltr"
            className="w-full"
            placeholder={tCommon('phone') || 'Phone'}
            aria-label={tCommon('phone') || 'Phone'}
          />
        </div>

        <div>
          <Label htmlFor="order-customer-email" className="block mb-1">
            {tCommon('email') || 'Email'}
          </Label>
          <CmxInput
            id="order-customer-email"
            type="email"
            value={email}
            readOnly={identityLocked}
            onChange={(e) => handleEmailChange(e.target.value)}
            dir="ltr"
            className="w-full"
            placeholder={tCommon('email') || 'Email'}
            aria-label={tCommon('email') || 'Email'}
          />
        </div>

        <div>
          <Label htmlFor="order-customer-notes" className="block mb-1">
            {t('customerNotes') || 'Customer notes'}
          </Label>
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

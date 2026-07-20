'use client';

/**
 * Stored-Value Tender Fields (B3)
 *
 * Reusable tender step for the 3 governed DIRECT_TENDER funding entry
 * points: gift-card sale (marketing), wallet top-up, and customer-advance
 * receipt (both customers). Renders a payment-method picker, a cash-tendered
 * field when the method is CASH, and — when the method requires a drawer —
 * the same cash-drawer session picker the order payment modals use
 * (`useCashDrawer`, genuinely generic, no order coupling).
 *
 * Reports its resolved tender state to the parent via `onTenderChange`; the
 * parent's submit handler passes it straight through to the *_WithTender
 * server action, which calls `fundStoredValue()`. This component does not
 * itself call any server action — funding-amount validation, currency
 * resolution, and the payment-status gate all happen server-side in
 * stored-value-funding.service.ts.
 */

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Banknote, Plus, RefreshCw, Loader2 } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { useCashDrawer } from '@features/orders/hooks/use-cash-drawer';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import { CmxButton, CmxInput, Label, CmxSkeleton } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxSelectDropdown, CmxSelectDropdownContent, CmxSelectDropdownItem, CmxSelectDropdownTrigger, CmxSelectDropdownValue } from '@ui/forms';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { CmxMoneyField } from '@ui/primitives';

interface FundingMethodOption {
  id: string;
  payment_method_code: string;
  display_name: string;
  display_name2?: string | null;
  requires_cash_drawer: boolean;
  supports_change_return: boolean;
}

export interface StoredValueTenderResult {
  paymentMethodId: string;
  paymentMethodCode: string;
  cashTendered?: number;
  cashDrawerSessionId?: string;
}

export interface StoredValueTenderFieldsProps {
  amount: number;
  currencyCode: string;
  branchId?: string;
  tenantOrgId: string;
  userId?: string;
  /** Called with the resolved tender, or null while the tender is not yet valid/complete. */
  onTenderChange: (tender: StoredValueTenderResult | null) => void;
}

/**
 *
 * @param root0
 * @param root0.amount
 * @param root0.currencyCode
 * @param root0.branchId
 * @param root0.tenantOrgId
 * @param root0.userId
 * @param root0.onTenderChange
 */
export function StoredValueTenderFields({
  amount,
  currencyCode,
  branchId,
  tenantOrgId,
  userId,
  onTenderChange,
}: StoredValueTenderFieldsProps) {
  const tPayment = useTranslations('newOrder.payment');
  const tFunding = useTranslations('customers.storedValue.funding');
  const isRTL = useRTL();
  const { token: csrfToken } = useCSRFToken();

  const [methods, setMethods] = useState<FundingMethodOption[]>([]);
  const [methodsLoading, setMethodsLoading] = useState(false);
  const [selectedMethodId, setSelectedMethodId] = useState('');
  const [cashTendered, setCashTendered] = useState<number | undefined>(undefined);

  const selectedMethod = methods.find((m) => m.id === selectedMethodId);
  const isCash = selectedMethod?.payment_method_code === PAYMENT_METHODS.CASH;
  const cashDrawerRequired = !!selectedMethod?.requires_cash_drawer;

  const cashDrawer = useCashDrawer({
    open: true,
    tenantOrgId,
    branchId,
    userId,
    isRTL,
    csrfToken,
    t: tPayment,
    cashDrawerRequired,
  });
  const {
    cashDrawersLoading,
    cashDrawersFetching,
    refetchCashDrawers,
    selectedCashDrawerSessionId,
    setSelectedCashDrawerSessionId,
    cashDrawerDialogOpen,
    setCashDrawerDialogOpen,
    cashDrawerToOpenId,
    setCashDrawerToOpenId,
    openingBalanceValue,
    setOpeningBalanceValue,
    openingDrawerSession,
    cashDrawerRequestError,
    setCashDrawerRequestError,
    cashDrawerSessionChoices,
    selectedCashDrawerChoice,
    canOpenNewCashDrawerSession,
    cashDrawerBlockingMessage,
    getDrawerDisplayName,
    persistPreferredCashDrawerId,
    cashDrawers,
    handleOpenCashDrawerDialog,
    handleCreateCashDrawerSession,
  } = cashDrawer;

  // Fetch REAL_PAYMENT / POS-eligible methods — reuses the same route the
  // order payment modals use (checkout-options already filters to
  // payment_nature=REAL_PAYMENT && allowed_in_pos, exactly what funding needs).
  useEffect(() => {
    setMethodsLoading(true);
    const params = new URLSearchParams();
    params.set('amount', String(amount));
    if (branchId) params.set('branchId', branchId);
    fetch(`/api/v1/orders/checkout-options?${params.toString()}`, {
      headers: { ...getCSRFHeader(csrfToken) },
    })
      .then(async (res) => {
        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? 'Failed to load methods');
        const list = (json.data?.paymentMethods ?? []) as FundingMethodOption[];
        setMethods(list);
        if (list[0]) setSelectedMethodId(list[0].id);
      })
      .catch(() => setMethods([]))
      .finally(() => setMethodsLoading(false));
    // amount intentionally omitted — method eligibility doesn't change with the
    // funding amount and re-fetching on every keystroke would just add jitter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, csrfToken]);

  const reportTender = useCallback(
    (methodId: string, tendered: number | undefined, drawerSessionId: string) => {
      const method = methods.find((m) => m.id === methodId);
      if (!method || amount <= 0) {
        onTenderChange(null);
        return;
      }
      const cash = method.payment_method_code === PAYMENT_METHODS.CASH;
      if (cash && (tendered ?? amount) < amount) {
        onTenderChange(null);
        return;
      }
      if (method.requires_cash_drawer && !drawerSessionId) {
        onTenderChange(null);
        return;
      }
      onTenderChange({
        paymentMethodId: method.id,
        paymentMethodCode: method.payment_method_code,
        cashTendered: cash ? (tendered ?? amount) : undefined,
        cashDrawerSessionId: method.requires_cash_drawer ? drawerSessionId : undefined,
      });
    },
    [amount, methods, onTenderChange]
  );

  useEffect(() => {
    reportTender(selectedMethodId, cashTendered, selectedCashDrawerSessionId);
  }, [selectedMethodId, cashTendered, selectedCashDrawerSessionId, reportTender]);

  const changeDue = isCash ? Math.max(0, (cashTendered ?? amount) - amount) : 0;

  if (methodsLoading) {
    return (
      <div className="space-y-2">
        <CmxSkeleton className="h-10 w-full" />
        <CmxSkeleton className="h-10 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        <div className="space-y-2">
          <Label>{tFunding('paymentMethod')} *</Label>
          <CmxSelectDropdown value={selectedMethodId} onValueChange={setSelectedMethodId}>
            <CmxSelectDropdownTrigger className="w-full" aria-required="true">
              <CmxSelectDropdownValue
                displayValue={
                  selectedMethod
                    ? (isRTL && selectedMethod.display_name2
                        ? selectedMethod.display_name2
                        : selectedMethod.display_name)
                    : undefined
                }
                placeholder={tFunding('paymentMethod')}
              />
            </CmxSelectDropdownTrigger>
            <CmxSelectDropdownContent>
              {methods.map((method) => (
                <CmxSelectDropdownItem key={method.id} value={method.id}>
                  {isRTL && method.display_name2 ? method.display_name2 : method.display_name}
                </CmxSelectDropdownItem>
              ))}
            </CmxSelectDropdownContent>
          </CmxSelectDropdown>
          {methods.length === 0 && (
            <p className="text-xs text-destructive" role="alert">
              {tFunding('noMethodsAvailable')}
            </p>
          )}
        </div>

        {isCash ? (
          <div className="space-y-2">
            <Label htmlFor="sv-tender-cash">{tFunding('cashTendered')}</Label>
            <CmxMoneyField
              value={cashTendered ?? amount}
              decimalPlaces={3}
              min={amount}
              showZero
              onValueChange={(value) => setCashTendered(value ?? undefined)}
            />
            {changeDue > 0.001 ? (
              <div
                role="status"
                aria-live="polite"
                className={`flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm ${isRTL ? 'flex-row-reverse' : ''}`}
              >
                <span className="text-emerald-700">{tFunding('changeDue')}</span>
                <span className="font-semibold tabular-nums text-emerald-800">
                  {changeDue.toFixed(3)} {currencyCode}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {cashDrawerRequired ? (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className={`flex items-center justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <Label className="m-0 flex items-center gap-1.5">
                <Banknote className="h-4 w-4 text-cyan-700" />
                {tPayment('cashDrawer.title')}
              </Label>
              <Badge variant="secondary" className="text-xs">
                {selectedCashDrawerChoice ? tPayment('cashDrawer.boundBadge') : tPayment('cashDrawer.pendingBadge')}
              </Badge>
            </div>

            {cashDrawersLoading ? (
              <CmxSkeleton className="h-16 w-full" />
            ) : (
              <>
                {cashDrawerSessionChoices.length > 1 ? (
                  <CmxSelectDropdown
                    value={selectedCashDrawerSessionId}
                    onValueChange={(value) => {
                      setSelectedCashDrawerSessionId(value);
                      const selectedChoice = cashDrawerSessionChoices.find(({ session }) => session.id === value);
                      persistPreferredCashDrawerId(selectedChoice?.drawer.id);
                      setCashDrawerRequestError(null);
                    }}
                    emptyLabel={tPayment('cashDrawer.selectPlaceholder')}
                  >
                    <CmxSelectDropdownTrigger className="w-full" dir={isRTL ? 'rtl' : 'ltr'}>
                      <CmxSelectDropdownValue
                        displayValue={
                          selectedCashDrawerChoice
                            ? `${getDrawerDisplayName(selectedCashDrawerChoice.drawer)} • ${selectedCashDrawerChoice.session.session_no}`
                            : tPayment('cashDrawer.selectPlaceholder')
                        }
                        placeholder={tPayment('cashDrawer.selectPlaceholder')}
                      />
                    </CmxSelectDropdownTrigger>
                    <CmxSelectDropdownContent>
                      {cashDrawerSessionChoices.map(({ drawer, session }) => (
                        <CmxSelectDropdownItem key={session.id} value={session.id}>
                          {`${getDrawerDisplayName(drawer)} • ${session.session_no}`}
                        </CmxSelectDropdownItem>
                      ))}
                    </CmxSelectDropdownContent>
                  </CmxSelectDropdown>
                ) : selectedCashDrawerChoice ? (
                  <div className={`rounded-lg border border-cyan-200 bg-cyan-50/70 px-3 py-2 text-xs text-slate-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <span className="font-medium text-slate-900">{getDrawerDisplayName(selectedCashDrawerChoice.drawer)}</span>
                    {` • ${selectedCashDrawerChoice.session.session_no}`}
                  </div>
                ) : null}

                {cashDrawerBlockingMessage ? (
                  <div role="alert" aria-live="polite" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {cashDrawerBlockingMessage}
                  </div>
                ) : null}

                <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <CmxButton type="button" variant="outline" size="sm" onClick={() => void refetchCashDrawers()} disabled={cashDrawersFetching} className="rounded-lg">
                    {cashDrawersFetching ? <Loader2 className="me-1 h-4 w-4 animate-spin" /> : <RefreshCw className="me-1 h-4 w-4" />}
                    {tPayment('cashDrawer.refresh')}
                  </CmxButton>
                  <CmxButton type="button" variant="outline" size="sm" onClick={handleOpenCashDrawerDialog} disabled={!canOpenNewCashDrawerSession} className="rounded-lg">
                    <Plus className="me-1 h-4 w-4" />
                    {tPayment('cashDrawer.openSession')}
                  </CmxButton>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>

      <CmxDialog open={cashDrawerDialogOpen} onOpenChange={setCashDrawerDialogOpen}>
        <CmxDialogContent className="max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>{tPayment('cashDrawer.dialogTitle')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">{tPayment('cashDrawer.dialogDescription')}</p>
            {cashDrawerRequestError ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {cashDrawerRequestError}
              </div>
            ) : null}
            <div className="space-y-2">
              <Label>{tPayment('cashDrawer.drawerLabel')}</Label>
              <CmxSelectDropdown
                value={cashDrawerToOpenId}
                onValueChange={(value) => {
                  setCashDrawerToOpenId(value);
                  setCashDrawerRequestError(null);
                }}
                emptyLabel={tPayment('cashDrawer.drawerPlaceholder')}
              >
                <CmxSelectDropdownTrigger className="w-full" dir={isRTL ? 'rtl' : 'ltr'}>
                  <CmxSelectDropdownValue
                    displayValue={(() => {
                      const selectedDrawer = cashDrawers.find((drawer) => drawer.id === cashDrawerToOpenId);
                      return selectedDrawer ? getDrawerDisplayName(selectedDrawer) : tPayment('cashDrawer.drawerPlaceholder');
                    })()}
                    placeholder={tPayment('cashDrawer.drawerPlaceholder')}
                  />
                </CmxSelectDropdownTrigger>
                <CmxSelectDropdownContent>
                  {cashDrawers
                    .filter((drawer) => !drawer.currentSession)
                    .map((drawer) => (
                      <CmxSelectDropdownItem key={drawer.id} value={drawer.id}>
                        {getDrawerDisplayName(drawer)}
                      </CmxSelectDropdownItem>
                    ))}
                </CmxSelectDropdownContent>
              </CmxSelectDropdown>
            </div>
            <div className="space-y-2">
              <Label>{tPayment('cashDrawer.openingBalanceLabel')}</Label>
              <CmxMoneyField
                value={openingBalanceValue}
                decimalPlaces={3}
                showZero
                aria-label={tPayment('cashDrawer.openingBalanceLabel')}
                onValueChange={(value) => {
                  setOpeningBalanceValue(value ?? 0);
                  setCashDrawerRequestError(null);
                }}
              />
            </div>
          </div>
          <CmxDialogFooter className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <CmxButton type="button" variant="outline" onClick={() => setCashDrawerDialogOpen(false)}>
              {tPayment('cancel')}
            </CmxButton>
            <CmxButton
              type="button"
              disabled={openingDrawerSession || !cashDrawerToOpenId}
              onClick={() => void handleCreateCashDrawerSession()}
            >
              {tPayment('cashDrawer.openSession')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </>
  );
}

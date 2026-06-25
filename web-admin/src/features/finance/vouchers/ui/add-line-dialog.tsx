'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxMoneyField } from '@ui/primitives';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { parseMoneyDraft } from '@/lib/money/money-draft';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import {
  LINE_ROLE,
  LINE_TYPE,
  LINE_ROLE_REQUIREMENTS,
  VOUCHER_DIRECTION,
} from '@/lib/constants/voucher';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import type {
  CreateVoucherLineInput,
  LineRole,
  LineType,
  VoucherDirection,
} from '@/lib/types/voucher';

// ── Role meta ──────────────────────────────────────────────────────────────────

const ROLE_LINE_TYPE: Record<LineRole, LineType> = {
  [LINE_ROLE.ORDER_PAYMENT]:            LINE_TYPE.RECEIPT,
  [LINE_ROLE.INVOICE_PAYMENT]:          LINE_TYPE.RECEIPT,
  [LINE_ROLE.STATEMENT_PAYMENT]:        LINE_TYPE.RECEIPT,
  [LINE_ROLE.STATEMENT_CREDIT_APPLICATION]: LINE_TYPE.ADJUSTMENT,
  [LINE_ROLE.WALLET_TOPUP]:             LINE_TYPE.RECEIPT,
  [LINE_ROLE.GIFT_CARD_SALE]:           LINE_TYPE.RECEIPT,
  [LINE_ROLE.CUSTOMER_CREDIT_RECEIPT]:  LINE_TYPE.RECEIPT,
  [LINE_ROLE.CUSTOMER_CREDIT_ISSUE]:    LINE_TYPE.RECEIPT,
  [LINE_ROLE.CUSTOMER_ADVANCE_RECEIPT]: LINE_TYPE.RECEIPT,
  [LINE_ROLE.SUPPLIER_PAYMENT]:         LINE_TYPE.PAYMENT,
  [LINE_ROLE.EXPENSE_PAYMENT]:          LINE_TYPE.EXPENSE,
  [LINE_ROLE.SHOP_RENT_PAYMENT]:        LINE_TYPE.EXPENSE,
  [LINE_ROLE.UTILITY_PAYMENT]:          LINE_TYPE.EXPENSE,
  [LINE_ROLE.EMPLOYEE_ADVANCE_PAYMENT]: LINE_TYPE.ADVANCE,
  [LINE_ROLE.PETTY_CASH_ISSUE]:         LINE_TYPE.PAYMENT,
  [LINE_ROLE.CUSTOMER_REFUND]:          LINE_TYPE.REFUND,
  [LINE_ROLE.ORDER_REFUND]:             LINE_TYPE.REFUND,
  [LINE_ROLE.INVOICE_REFUND]:           LINE_TYPE.REFUND,
  [LINE_ROLE.PETTY_CASH_RETURN]:        LINE_TYPE.ADVANCE,
  [LINE_ROLE.WALLET_REFUND]:            LINE_TYPE.REFUND,
  [LINE_ROLE.GIFT_CARD_REFUND]:         LINE_TYPE.REFUND,
  [LINE_ROLE.INTERNAL_TRANSFER]:        LINE_TYPE.TRANSFER,
  [LINE_ROLE.ORDER_CREDIT_APPLICATION]: LINE_TYPE.ADJUSTMENT,
};

const ROLE_DIRECTION: Record<LineRole, VoucherDirection> = {
  [LINE_ROLE.ORDER_PAYMENT]:            VOUCHER_DIRECTION.IN,
  [LINE_ROLE.INVOICE_PAYMENT]:          VOUCHER_DIRECTION.IN,
  [LINE_ROLE.STATEMENT_PAYMENT]:        VOUCHER_DIRECTION.IN,
  [LINE_ROLE.STATEMENT_CREDIT_APPLICATION]: VOUCHER_DIRECTION.NEUTRAL,
  [LINE_ROLE.WALLET_TOPUP]:             VOUCHER_DIRECTION.IN,
  [LINE_ROLE.GIFT_CARD_SALE]:           VOUCHER_DIRECTION.IN,
  [LINE_ROLE.CUSTOMER_CREDIT_RECEIPT]:  VOUCHER_DIRECTION.IN,
  [LINE_ROLE.CUSTOMER_CREDIT_ISSUE]:    VOUCHER_DIRECTION.IN,
  [LINE_ROLE.CUSTOMER_ADVANCE_RECEIPT]: VOUCHER_DIRECTION.IN,
  [LINE_ROLE.SUPPLIER_PAYMENT]:         VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.EXPENSE_PAYMENT]:          VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.SHOP_RENT_PAYMENT]:        VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.UTILITY_PAYMENT]:          VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.EMPLOYEE_ADVANCE_PAYMENT]: VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.PETTY_CASH_ISSUE]:         VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.CUSTOMER_REFUND]:          VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.ORDER_REFUND]:             VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.INVOICE_REFUND]:           VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.PETTY_CASH_RETURN]:        VOUCHER_DIRECTION.IN,
  [LINE_ROLE.WALLET_REFUND]:            VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.GIFT_CARD_REFUND]:         VOUCHER_DIRECTION.OUT,
  [LINE_ROLE.INTERNAL_TRANSFER]:        VOUCHER_DIRECTION.NEUTRAL,
  [LINE_ROLE.ORDER_CREDIT_APPLICATION]: VOUCHER_DIRECTION.NEUTRAL,
};

const ROLE_GROUPS = [
  {
    groupKey: 'receipts',
    roles: [
      LINE_ROLE.ORDER_PAYMENT,
      LINE_ROLE.INVOICE_PAYMENT,
      LINE_ROLE.CUSTOMER_ADVANCE_RECEIPT,
      LINE_ROLE.CUSTOMER_CREDIT_RECEIPT,
      LINE_ROLE.WALLET_TOPUP,
      LINE_ROLE.GIFT_CARD_SALE,
      LINE_ROLE.ORDER_CREDIT_APPLICATION,
    ],
  },
  {
    groupKey: 'payments',
    roles: [
      LINE_ROLE.SUPPLIER_PAYMENT,
      LINE_ROLE.EXPENSE_PAYMENT,
      LINE_ROLE.SHOP_RENT_PAYMENT,
      LINE_ROLE.UTILITY_PAYMENT,
      LINE_ROLE.EMPLOYEE_ADVANCE_PAYMENT,
      LINE_ROLE.PETTY_CASH_ISSUE,
    ],
  },
  {
    groupKey: 'refunds',
    roles: [
      LINE_ROLE.CUSTOMER_REFUND,
      LINE_ROLE.ORDER_REFUND,
      LINE_ROLE.INVOICE_REFUND,
      LINE_ROLE.WALLET_REFUND,
      LINE_ROLE.GIFT_CARD_REFUND,
      LINE_ROLE.PETTY_CASH_RETURN,
    ],
  },
  {
    groupKey: 'transfers',
    roles: [LINE_ROLE.INTERNAL_TRANSFER],
  },
] as const;

const COMMON_PAYMENT_METHODS = [
  PAYMENT_METHODS.CASH,
  PAYMENT_METHODS.CARD,
  PAYMENT_METHODS.BANK_TRANSFER,
  PAYMENT_METHODS.CHECK,
  PAYMENT_METHODS.MOBILE_PAYMENT,
] as const;

// ── Field visibility helpers ───────────────────────────────────────────────────

function needsOrderId(role: string)           { return LINE_ROLE_REQUIREMENTS[role]?.requiredFields.includes('order_id'); }
function needsCustomerId(role: string)        { return LINE_ROLE_REQUIREMENTS[role]?.requiredFields.includes('customer_id'); }
function needsPartyName(role: string)         { return LINE_ROLE_REQUIREMENTS[role]?.requiredFields.includes('party_name'); }
function needsExpenseCategory(role: string)   { return LINE_ROLE_REQUIREMENTS[role]?.requiredFields.includes('expense_category_code'); }
function needsEmployeeId(role: string)        { return LINE_ROLE_REQUIREMENTS[role]?.requiredFields.includes('employee_id'); }

// ── Types ─────────────────────────────────────────────────────────────────────

interface AddLineDialogProps {
  open: boolean;
  onClose: () => void;
  onAdd: (input: CreateVoucherLineInput) => Promise<void>;
  isPending: boolean;
  allowedRoles?: LineRole[];
}

interface LineFormState {
  line_role: string;
  amount: string;
  payment_method_code: string;
  order_id: string;
  customer_id: string;
  employee_id: string;
  party_name: string;
  expense_category_code: string;
  bank_reference: string;
  check_number: string;
  check_bank: string;
  check_date: string;
  tendered_amount: string;
  card_brand_code: string;
  card_last4: string;
  auth_code: string;
  description: string;
  notes: string;
}

const EMPTY_FORM: LineFormState = {
  line_role: '',
  amount: '',
  payment_method_code: '',
  order_id: '',
  customer_id: '',
  employee_id: '',
  party_name: '',
  expense_category_code: '',
  bank_reference: '',
  check_number: '',
  check_bank: '',
  check_date: '',
  tendered_amount: '',
  card_brand_code: '',
  card_last4: '',
  auth_code: '',
  description: '',
  notes: '',
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Dialog used to append validated transaction lines to a draft voucher.
 *
 * Why:
 * Role-driven line templates keep voucher wiring predictable and reduce the
 * chance of mixing target types, directions, or payment metadata incorrectly.
 *
 * @param root0 dialog props wrapper
 * @param root0.open whether the dialog is open
 * @param root0.onClose close handler for dismissing the dialog
 * @param root0.onAdd async callback that persists the new voucher line
 * @param root0.isPending whether a line mutation is currently in flight
 * @param root0.allowedRoles optional role allow-list for narrowed flows
 * @returns voucher line entry dialog
 */
export function AddLineDialog({ open, onClose, onAdd, isPending, allowedRoles }: AddLineDialogProps) {
  const t = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const { decimalPlaces } = useTenantCurrency();
  const [form, setForm] = useState<LineFormState>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  const set = (field: keyof LineFormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  function handleRoleChange(role: string) {
    setForm((prev) => ({
      ...prev,
      line_role: role,
      // auto-clear role-specific fields when role changes
      order_id: '',
      customer_id: '',
      employee_id: '',
      party_name: '',
      expense_category_code: '',
    }));
  }

  function validate(): string | null {
    if (!form.line_role) return t('validation.lineRoleRequired');
    const amt = parseMoneyDraft(form.amount);
    if (amt <= 0) return t('validation.amountPositive');
    if (needsOrderId(form.line_role) && !form.order_id.trim()) return t('validation.orderIdRequired');
    if (needsCustomerId(form.line_role) && !form.customer_id.trim()) return t('validation.customerIdRequired');
    if (needsPartyName(form.line_role) && !form.party_name.trim()) return t('validation.partyNameRequired');
    if (needsExpenseCategory(form.line_role) && !form.expense_category_code.trim()) return t('validation.expenseCategoryRequired');
    if (needsEmployeeId(form.line_role) && !form.employee_id.trim()) return t('validation.employeeIdRequired');
    if (form.payment_method_code === PAYMENT_METHODS.BANK_TRANSFER && !form.bank_reference.trim()) return t('validation.bankReferenceRequired');
    if (form.payment_method_code === PAYMENT_METHODS.CHECK) {
      if (!form.check_number.trim() || !form.check_bank.trim() || !form.check_date.trim()) return t('validation.checkFieldsRequired');
    }
    return null;
  }

  async function handleSubmit() {
    setError(null);
    const err = validate();
    if (err) { setError(err); return; }

    const amt = parseMoneyDraft(form.amount);
    const selectedRole = form.line_role as LineRole;
    const input: CreateVoucherLineInput = {
      line_type:              ROLE_LINE_TYPE[selectedRole] ?? LINE_TYPE.PAYMENT,
      line_role:              selectedRole,
      direction:              ROLE_DIRECTION[selectedRole] ?? VOUCHER_DIRECTION.NEUTRAL,
      amount:                 amt,
      payment_method_code:    form.payment_method_code || undefined,
      order_id:               form.order_id.trim()               || undefined,
      customer_id:            form.customer_id.trim()             || undefined,
      employee_id:            form.employee_id.trim()             || undefined,
      party_name:             form.party_name.trim()              || undefined,
      expense_category_code:  form.expense_category_code.trim()   || undefined,
      bank_reference:         form.bank_reference.trim()          || undefined,
      check_number:           form.check_number.trim()            || undefined,
      check_bank:             form.check_bank.trim()              || undefined,
      check_date:             form.check_date.trim()              || undefined,
      tendered_amount:        form.tendered_amount ? parseMoneyDraft(form.tendered_amount) : undefined,
      card_brand_code:        form.card_brand_code.trim()         || undefined,
      card_last4:             form.card_last4.trim()              || undefined,
      auth_code:              form.auth_code.trim()               || undefined,
      description:            form.description.trim()             || undefined,
      notes:                  form.notes.trim()                   || undefined,
    };

    await onAdd(input);
    setForm(EMPTY_FORM);
    setError(null);
  }

  function handleClose() {
    setForm(EMPTY_FORM);
    setError(null);
    onClose();
  }

  const filteredGroups = ROLE_GROUPS.map((g) => ({
    ...g,
    roles: allowedRoles
      ? g.roles.filter((r) => (allowedRoles as string[]).includes(r))
      : g.roles,
  })).filter((g) => g.roles.length > 0);

  const pm = form.payment_method_code;
  const showBankRef   = pm === PAYMENT_METHODS.BANK_TRANSFER;
  const showCheck     = pm === PAYMENT_METHODS.CHECK;
  const showCash      = pm === PAYMENT_METHODS.CASH;
  const showCard      = pm === PAYMENT_METHODS.CARD;

  return (
    <CmxDialog open={open} onOpenChange={(o) => { if (!o) handleClose(); }}>
      <CmxDialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('addLineTitle')}</CmxDialogTitle>
        </CmxDialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* ── Line Role ── */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">
              {t('lineRole')} <span className="text-red-500">*</span>
            </label>
            {filteredGroups.map((group) => (
              <div key={group.groupKey} className="mb-3">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  {t(`lineRoleGroups.${group.groupKey}`)}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {group.roles.map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => handleRoleChange(role)}
                      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                        form.line_role === role
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {t(`lineRoleLabels.${role}`)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {form.line_role && (
            <>
              {/* ── Amount ── */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('amount')} <span className="text-red-500">*</span>
                </label>
                <CmxMoneyField
                  value={parseMoneyDraft(form.amount) || null}
                  draftValue={form.amount}
                  decimalPlaces={decimalPlaces}
                  min={0}
                  onValueChange={(_, d) => set('amount', d)}
                  placeholder="0.00"
                />
              </div>

              {/* ── Payment Method ── */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('paymentMethod')} <span className="text-xs text-gray-400">({tCommon('optional')})</span>
                </label>
                <select
                  value={form.payment_method_code}
                  onChange={(e) => set('payment_method_code', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">—</option>
                  {COMMON_PAYMENT_METHODS.map((pm) => (
                    <option key={pm} value={pm}>{pm}</option>
                  ))}
                </select>
              </div>

              {/* ── Cash: tendered amount ── */}
              {showCash && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('tenderedAmount')} <span className="text-xs text-gray-400">({tCommon('optional')})</span>
                  </label>
                  <CmxMoneyField
                    value={parseMoneyDraft(form.tendered_amount) || null}
                    draftValue={form.tendered_amount}
                    decimalPlaces={decimalPlaces}
                    min={0}
                    onValueChange={(_, d) => set('tendered_amount', d)}
                    placeholder="0.00"
                  />
                </div>
              )}

              {/* ── Card fields ── */}
              {showCard && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{t('cardBrand')}</label>
                    <input
                      type="text"
                      value={form.card_brand_code}
                      onChange={(e) => set('card_brand_code', e.target.value)}
                      placeholder="VISA"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{t('cardLast4')}</label>
                    <input
                      type="text"
                      maxLength={4}
                      value={form.card_last4}
                      onChange={(e) => set('card_last4', e.target.value)}
                      placeholder="1234"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">{t('authCode')}</label>
                    <input
                      type="text"
                      value={form.auth_code}
                      onChange={(e) => set('auth_code', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* ── Bank transfer ── */}
              {showBankRef && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('bankReference')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.bank_reference}
                    onChange={(e) => set('bank_reference', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* ── Check fields ── */}
              {showCheck && (
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t('checkNumber')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.check_number}
                      onChange={(e) => set('check_number', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t('checkBank')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.check_bank}
                      onChange={(e) => set('check_bank', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      {t('checkDate')} <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={form.check_date}
                      onChange={(e) => set('check_date', e.target.value)}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              {/* ── Role-required contextual fields ── */}
              {needsOrderId(form.line_role) && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('orderId')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.order_id}
                    onChange={(e) => set('order_id', e.target.value)}
                    placeholder="UUID"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {needsCustomerId(form.line_role) && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('customerId')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.customer_id}
                    onChange={(e) => set('customer_id', e.target.value)}
                    placeholder="UUID"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {needsPartyName(form.line_role) && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('party')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.party_name}
                    onChange={(e) => set('party_name', e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {needsExpenseCategory(form.line_role) && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('expenseCategory')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.expense_category_code}
                    onChange={(e) => set('expense_category_code', e.target.value)}
                    placeholder="e.g. RENT, UTILITIES"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {needsEmployeeId(form.line_role) && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    {t('employeeId')} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.employee_id}
                    onChange={(e) => set('employee_id', e.target.value)}
                    placeholder="UUID"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* ── Description & Notes ── */}
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('description')} <span className="text-xs text-gray-400">({tCommon('optional')})</span>
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </>
          )}
        </div>

        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={handleClose} disabled={isPending}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton onClick={handleSubmit} disabled={isPending || !form.line_role}>
            {isPending ? tCommon('loading') : t('actions.addLine')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}

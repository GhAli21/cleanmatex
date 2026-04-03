import { getLocale, getTranslations } from 'next-intl/server';
import {
  Alert,
  AlertDescription,
  CmxButton,
  CmxCard,
  CmxCardContent,
  CmxCardDescription,
  CmxCardHeader,
  CmxCardTitle,
  CmxInput,
  CmxSelect,
  CmxTextarea,
} from '@ui/primitives';
import { FEATURE_FLAG_KEYS } from '@/lib/constants/feature-flags';
import { ErpLiteExpensesService } from '@/lib/services/erp-lite-expenses.service';
import { formatErpLiteMoney } from '@features/erp-lite/lib/display-format';
import { getErpLiteDisplayConfig } from '@features/erp-lite/server/get-erp-lite-display-config';
import { ErpLiteExpensesTable } from '@features/erp-lite/ui/erp-lite-expenses-table';
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard';
import { currentTenantCan } from '@/lib/services/feature-flags.service';
import type { ErpLiteExpensesDashboardSnapshot } from '@/lib/types/erp-lite-expenses';
import {
  approveErpLiteApprovalAction,
  createErpLiteCashTxnAction,
  createErpLiteApprovalRequestAction,
  createErpLiteCashReconciliationAction,
  createErpLiteCashReconciliationExceptionAction,
  createErpLiteCashboxAction,
  createErpLiteExpenseAction,
  closeErpLiteCashReconciliationAction,
  lockErpLiteCashReconciliationAction,
  rejectErpLiteApprovalAction,
} from '@/app/actions/erp-lite/expenses-actions';

type SearchParamsValue = string | string[] | undefined;

function getSingleParam(value: SearchParamsValue): string | null {
  return typeof value === 'string' ? value : null;
}

export default async function ErpLiteExpensesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, SearchParamsValue>>;
}) {
  const t = await getTranslations('erpLite.expenses');
  const tCommon = await getTranslations('erpLite.common');
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en';
  const displayConfig = await getErpLiteDisplayConfig();
  const params = searchParams ? await searchParams : {};
  const notice = getSingleParam(params.notice);
  const error = getSingleParam(params.error);
  const isEnabled = await currentTenantCan(FEATURE_FLAG_KEYS.ERP_LITE_EXPENSES_ENABLED);

  if (!isEnabled) {
    return (
      <ErpLitePageGuard
        feature={FEATURE_FLAG_KEYS.ERP_LITE_EXPENSES_ENABLED}
        permissions={['erp_lite_expenses:view']}
      >
        {null}
      </ErpLitePageGuard>
    );
  }

  let loadError: string | null = null;
  let snapshot: ErpLiteExpensesDashboardSnapshot = {
    expense_list: [],
    cashbox_list: [],
    cash_txn_list: [],
    approval_list: [],
    cash_recon_list: [],
    branch_options: [],
    cashbox_account_options: [],
    cashbox_options: [],
    expense_options: [],
    cash_txn_options: [],
  };

  try {
    snapshot = await ErpLiteExpensesService.getDashboardSnapshot(locale);
  } catch (loadFailure) {
    loadError =
      loadFailure instanceof Error
        ? loadFailure.message
        : tCommon('loadError');
  }

  return (
    <ErpLitePageGuard
      feature={FEATURE_FLAG_KEYS.ERP_LITE_EXPENSES_ENABLED}
      permissions={['erp_lite_expenses:view']}
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium uppercase tracking-[0.12em] text-muted-foreground">
            {t('eyebrow')}
          </p>
          <h1 className="text-2xl font-semibold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        {notice ? (
          <Alert>
            <AlertDescription>{t(`notices.${notice}`)}</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-3">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.expense.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.expense.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteExpenseAction} className="space-y-3">
                <CmxInput
                  name="expense_date"
                  type="date"
                  label={t('forms.expense.fields.expenseDate')}
                  required
                />
                <CmxInput
                  name="currency_code"
                  label={t('forms.expense.fields.currencyCode')}
                  placeholder="OMR"
                  required
                />
                <CmxSelect
                  name="branch_id"
                  label={t('forms.expense.fields.branch')}
                  placeholder={t('forms.placeholders.optionalSelect')}
                  defaultValue=""
                  options={snapshot.branch_options.map((item) => ({
                    value: item.id,
                    label: item.label,
                  }))}
                />
                <CmxSelect
                  name="settlement_code"
                  label={t('forms.expense.fields.settlement')}
                  defaultValue="CASH"
                  options={[
                    { value: 'CASH', label: t('settlement.cash') },
                    { value: 'BANK', label: t('settlement.bank') },
                  ]}
                />
                <CmxInput
                  name="subtotal_amount"
                  type="number"
                  step="0.0001"
                  min="0"
                  label={t('forms.expense.fields.subtotal')}
                  required
                />
                <CmxInput
                  name="tax_amount"
                  type="number"
                  step="0.0001"
                  min="0"
                  label={t('forms.expense.fields.tax')}
                />
                <CmxInput
                  name="payee_name"
                  label={t('forms.expense.fields.payee')}
                />
                <CmxTextarea
                  name="description"
                  label={t('forms.expense.fields.description')}
                />
                <CmxButton type="submit" className="w-full">
                  {t('forms.expense.submit')}
                </CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.cashbox.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.cashbox.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteCashboxAction} className="space-y-3">
                <CmxInput
                  name="cashbox_code"
                  label={t('forms.cashbox.fields.code')}
                  helpText={t('forms.cashbox.help.code')}
                />
                <CmxInput
                  name="name"
                  label={t('forms.cashbox.fields.name')}
                  required
                />
                <CmxInput
                  name="name2"
                  label={t('forms.cashbox.fields.name2')}
                />
                <CmxSelect
                  name="branch_id"
                  label={t('forms.cashbox.fields.branch')}
                  placeholder={t('forms.placeholders.optionalSelect')}
                  defaultValue=""
                  options={snapshot.branch_options.map((item) => ({
                    value: item.id,
                    label: item.label,
                  }))}
                />
                <CmxSelect
                  name="account_id"
                  label={t('forms.cashbox.fields.account')}
                  defaultValue=""
                  placeholder={t('forms.placeholders.selectAccount')}
                  options={snapshot.cashbox_account_options.map((item) => ({
                    value: item.id,
                    label: item.label,
                  }))}
                  required
                />
                <CmxInput
                  name="currency_code"
                  label={t('forms.cashbox.fields.currencyCode')}
                  placeholder="OMR"
                  required
                />
                <CmxInput
                  name="opening_balance"
                  type="number"
                  step="0.0001"
                  min="0"
                  label={t('forms.cashbox.fields.openingBalance')}
                />
                <CmxButton type="submit" className="w-full">
                  {t('forms.cashbox.submit')}
                </CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.cashTxn.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.cashTxn.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteCashTxnAction} className="space-y-3">
                <CmxSelect
                  name="cashbox_id"
                  label={t('forms.cashTxn.fields.cashbox')}
                  defaultValue=""
                  placeholder={t('forms.placeholders.selectCashbox')}
                  options={snapshot.cashbox_options.map((item) => ({
                    value: item.id,
                    label: item.label,
                  }))}
                  required
                />
                <CmxSelect
                  name="txn_type_code"
                  label={t('forms.cashTxn.fields.type')}
                  defaultValue="TOPUP"
                  options={[
                    { value: 'TOPUP', label: t('txnType.topup') },
                    { value: 'SPEND', label: t('txnType.spend') },
                  ]}
                />
                <CmxInput
                  name="txn_date"
                  type="date"
                  label={t('forms.cashTxn.fields.txnDate')}
                  required
                />
                <CmxInput
                  name="currency_code"
                  label={t('forms.cashTxn.fields.currencyCode')}
                  placeholder="OMR"
                  required
                />
                <CmxInput
                  name="amount_total"
                  type="number"
                  step="0.0001"
                  min="0"
                  label={t('forms.cashTxn.fields.amount')}
                  required
                />
                <CmxTextarea
                  name="description"
                  label={t('forms.cashTxn.fields.description')}
                />
                <CmxButton type="submit" className="w-full">
                  {t('forms.cashTxn.submit')}
                </CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-3">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.approval.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.approval.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteApprovalRequestAction} className="space-y-3">
                <CmxSelect
                  name="source_doc_type"
                  label={t('forms.approval.fields.docType')}
                  defaultValue="EXPENSE"
                  options={[
                    { value: 'EXPENSE', label: t('forms.approval.docTypes.expense') },
                    { value: 'CASH_TXN', label: t('forms.approval.docTypes.cashTxn') },
                  ]}
                />
                <CmxSelect
                  name="source_doc_id"
                  label={t('forms.approval.fields.document')}
                  defaultValue=""
                  options={[
                    ...snapshot.expense_options.map((item) => ({ value: item.id, label: `${t('forms.approval.docTypes.expense')}: ${item.label}` })),
                    ...snapshot.cash_txn_options.map((item) => ({ value: item.id, label: `${t('forms.approval.docTypes.cashTxn')}: ${item.label}` })),
                  ]}
                  required
                />
                <CmxTextarea
                  name="action_note"
                  label={t('forms.approval.fields.note')}
                />
                <CmxButton type="submit" className="w-full">
                  {t('forms.approval.submit')}
                </CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.cashRecon.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.cashRecon.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteCashReconciliationAction} className="space-y-3">
                <CmxSelect
                  name="cashbox_id"
                  label={t('forms.cashRecon.fields.cashbox')}
                  defaultValue=""
                  options={snapshot.cashbox_options.map((item) => ({
                    value: item.id,
                    label: item.label,
                  }))}
                  required
                />
                <CmxInput
                  name="recon_date"
                  type="date"
                  label={t('forms.cashRecon.fields.reconDate')}
                  required
                />
                <CmxInput
                  name="counted_balance"
                  type="number"
                  step="0.0001"
                  label={t('forms.cashRecon.fields.countedBalance')}
                  required
                />
                <CmxTextarea
                  name="note"
                  label={t('forms.cashRecon.fields.note')}
                />
                <CmxButton type="submit" className="w-full">
                  {t('forms.cashRecon.submit')}
                </CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('forms.cashReconException.title')}</CmxCardTitle>
              <CmxCardDescription>{t('forms.cashReconException.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <form action={createErpLiteCashReconciliationExceptionAction} className="space-y-3">
                <CmxSelect
                  name="cash_recon_id"
                  label={t('forms.cashReconException.fields.reconciliation')}
                  defaultValue=""
                  options={snapshot.cash_recon_list.map((item) => ({
                    value: item.id,
                    label: `${item.recon_no} · ${item.cashbox_name}`,
                  }))}
                  required
                />
                <CmxInput
                  name="reason_code"
                  label={t('forms.cashReconException.fields.reasonCode')}
                  placeholder="SHORTAGE"
                  required
                />
                <CmxInput
                  name="amount"
                  type="number"
                  step="0.0001"
                  label={t('forms.cashReconException.fields.amount')}
                  required
                />
                <CmxTextarea
                  name="note"
                  label={t('forms.cashReconException.fields.note')}
                />
                <CmxButton type="submit" className="w-full">
                  {t('forms.cashReconException.submit')}
                </CmxButton>
              </form>
            </CmxCardContent>
          </CmxCard>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.expenses.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.expenses.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <ErpLiteExpensesTable items={snapshot.expense_list} displayConfig={displayConfig} />
            </CmxCardContent>
          </CmxCard>

          <div className="space-y-4">
            <CmxCard>
              <CmxCardHeader>
                <CmxCardTitle>{t('lists.approvals.title')}</CmxCardTitle>
                <CmxCardDescription>{t('lists.approvals.subtitle')}</CmxCardDescription>
              </CmxCardHeader>
              <CmxCardContent className="space-y-3">
                {snapshot.approval_list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('lists.approvals.empty')}</p>
                ) : (
                  snapshot.approval_list.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border p-3">
                      <div className="font-medium">{item.source_doc_no}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {t(`forms.approval.docTypes.${item.source_doc_type === 'EXPENSE' ? 'expense' : 'cashTxn'}`)} · {item.status_code}
                      </div>
                      {item.action_note ? (
                        <div className="mt-2 text-xs text-muted-foreground">{item.action_note}</div>
                      ) : null}
                      {item.status_code === 'PENDING' ? (
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <form action={approveErpLiteApprovalAction}>
                            <input type="hidden" name="approval_id" value={item.id} />
                            <CmxButton type="submit" variant="outline" className="w-full">
                              {t('lists.approvals.approve')}
                            </CmxButton>
                          </form>
                          <form action={rejectErpLiteApprovalAction}>
                            <input type="hidden" name="approval_id" value={item.id} />
                            <CmxButton type="submit" variant="outline" className="w-full">
                              {t('lists.approvals.reject')}
                            </CmxButton>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </CmxCardContent>
            </CmxCard>

            <CmxCard>
              <CmxCardHeader>
                <CmxCardTitle>{t('lists.cashboxes.title')}</CmxCardTitle>
                <CmxCardDescription>{t('lists.cashboxes.subtitle')}</CmxCardDescription>
              </CmxCardHeader>
              <CmxCardContent className="space-y-3">
                {snapshot.cashbox_list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('lists.cashboxes.empty')}</p>
                ) : (
                  snapshot.cashbox_list.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border p-3">
                      <div className="font-medium">{item.cashbox_code} · {item.cashbox_name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {item.account_code} · {item.account_name}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {item.branch_name ?? '—'}
                      </div>
                      <div className="mt-3 text-sm font-semibold">
                        {t('lists.cashboxes.currentBalance')}:
                        <span className="ml-2">
                          {formatErpLiteMoney(item.current_balance, { ...displayConfig, currencyCode: item.currency_code || displayConfig.currencyCode })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </CmxCardContent>
            </CmxCard>

            <CmxCard>
              <CmxCardHeader>
                <CmxCardTitle>{t('lists.cashRecons.title')}</CmxCardTitle>
                <CmxCardDescription>{t('lists.cashRecons.subtitle')}</CmxCardDescription>
              </CmxCardHeader>
              <CmxCardContent className="space-y-3">
                {snapshot.cash_recon_list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('lists.cashRecons.empty')}</p>
                ) : (
                  snapshot.cash_recon_list.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border p-3">
                      <div className="font-medium">{item.recon_no} · {item.cashbox_name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.recon_date}</div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {t('lists.cashRecons.expected')}: {formatErpLiteMoney(item.expected_balance, displayConfig)} ·
                        {' '}
                        {t('lists.cashRecons.counted')}: {formatErpLiteMoney(item.counted_balance, displayConfig)}
                      </div>
                      <div className="mt-3 text-sm font-semibold">
                        {t('lists.cashRecons.variance')}: {formatErpLiteMoney(item.variance_amount, displayConfig)} · {item.status_code}
                      </div>
                      {item.status_code === 'OPEN' ? (
                        <form action={closeErpLiteCashReconciliationAction} className="mt-3">
                          <input type="hidden" name="cash_recon_id" value={item.id} />
                          <CmxButton type="submit" variant="outline" className="w-full">
                            {t('lists.cashRecons.close')}
                          </CmxButton>
                        </form>
                      ) : null}
                      {item.status_code === 'CLOSED' ? (
                        <form action={lockErpLiteCashReconciliationAction} className="mt-3">
                          <input type="hidden" name="cash_recon_id" value={item.id} />
                          <CmxButton type="submit" variant="outline" className="w-full">
                            {t('lists.cashRecons.lock')}
                          </CmxButton>
                        </form>
                      ) : null}
                    </div>
                  ))
                )}
              </CmxCardContent>
            </CmxCard>

            <CmxCard>
              <CmxCardHeader>
                <CmxCardTitle>{t('lists.cashTxns.title')}</CmxCardTitle>
                <CmxCardDescription>{t('lists.cashTxns.subtitle')}</CmxCardDescription>
              </CmxCardHeader>
              <CmxCardContent className="space-y-3">
                {snapshot.cash_txn_list.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('lists.cashTxns.empty')}</p>
                ) : (
                  snapshot.cash_txn_list.map((item) => (
                    <div key={item.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{item.txn_no}</div>
                          <div className="text-xs text-muted-foreground">
                            {item.cashbox_name} · {item.txn_date}
                          </div>
                        </div>
                        <div className="text-right text-sm font-semibold">
                          {formatErpLiteMoney(item.amount_total, { ...displayConfig, currencyCode: item.currency_code || displayConfig.currencyCode })}
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {t(`txnType.${item.txn_type_code.toLowerCase()}`)}
                        {item.branch_name ? ` · ${item.branch_name}` : ''}
                      </div>
                      {item.description ? (
                        <div className="mt-2 text-sm text-muted-foreground">{item.description}</div>
                      ) : null}
                    </div>
                  ))
                )}
              </CmxCardContent>
            </CmxCard>
          </div>
        </div>
      </div>
    </ErpLitePageGuard>
  );
}

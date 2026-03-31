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
import { ErpLitePageGuard } from '@features/erp-lite/ui/erp-lite-page-guard';
import {
  createErpLiteCashTxnAction,
  createErpLiteCashboxAction,
  createErpLiteExpenseAction,
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
  const locale = (await getLocale()) === 'ar' ? 'ar' : 'en';
  const params = searchParams ? await searchParams : {};
  const notice = getSingleParam(params.notice);
  const error = getSingleParam(params.error);
  const snapshot = await ErpLiteExpensesService.getDashboardSnapshot(locale);

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

        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <CmxCard>
            <CmxCardHeader>
              <CmxCardTitle>{t('lists.expenses.title')}</CmxCardTitle>
              <CmxCardDescription>{t('lists.expenses.subtitle')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-3 py-2 text-left">{t('lists.expenses.columns.no')}</th>
                      <th className="px-3 py-2 text-left">{t('lists.expenses.columns.date')}</th>
                      <th className="px-3 py-2 text-left">{t('lists.expenses.columns.payee')}</th>
                      <th className="px-3 py-2 text-left">{t('lists.expenses.columns.branch')}</th>
                      <th className="px-3 py-2 text-left">{t('lists.expenses.columns.settlement')}</th>
                      <th className="px-3 py-2 text-right">{t('lists.expenses.columns.amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.expense_list.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                          {t('lists.expenses.empty')}
                        </td>
                      </tr>
                    ) : (
                      snapshot.expense_list.map((item) => (
                        <tr key={item.id} className="border-t border-border">
                          <td className="px-3 py-2 font-medium">{item.expense_no}</td>
                          <td className="px-3 py-2">{item.expense_date}</td>
                          <td className="px-3 py-2">{item.payee_name ?? '—'}</td>
                          <td className="px-3 py-2">{item.branch_name ?? '—'}</td>
                          <td className="px-3 py-2">{t(`settlement.${item.settlement_code.toLowerCase()}`)}</td>
                          <td className="px-3 py-2 text-right">
                            {item.total_amount.toFixed(4)} {item.currency_code}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CmxCardContent>
          </CmxCard>

          <div className="space-y-4">
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
                          {item.current_balance.toFixed(4)} {item.currency_code}
                        </span>
                      </div>
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
                          {item.amount_total.toFixed(4)} {item.currency_code}
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

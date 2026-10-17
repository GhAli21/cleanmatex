'use client';

import { useState, type ReactNode } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, History } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { getOrderChangeHistoryAction, type OrderChangeHistoryErrorCode } from '@/app/actions/orders/get-order-change-history';
import { ORDER_CHANGE_OPERATION_CODES } from '@/lib/constants/order-change';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { useRTL } from '@/lib/hooks/useRTL';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import type {
  OrderChangeHistoryDetailItem,
  OrderChangeHistoryPage,
  OrderChangeHistoryRemovalView,
  OrderChangeHistoryValueField,
} from '@/lib/services/order-change/order-change-history-view';
import { CmxSummaryMessage } from '@ui/feedback';
import { CmxEmptyState } from '@ui/data-display';
import { CmxButton } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxCard, CmxCardContent, CmxCardHeader } from '@ui/primitives/cmx-card';

const OPERATION_CODES = new Set<string>(ORDER_CHANGE_OPERATION_CODES);
const OUTCOMES = new Set(['NONE', 'OUTSTANDING_OPTIONAL', 'OUTSTANDING_REQUIRED', 'OVERPAYMENT']);
const TARGETS = new Set(['ORDER', 'ITEM', 'PIECE', 'PREFERENCE']);
const MONEY_KEYS = new Set(['totalAmount', 'taxAmount', 'extraPrice', 'price', 'pricePerUnit', 'amount', 'commercialDelta']);
const KNOWN_FIELDS = new Set([
  'totalAmount',
  'taxAmount',
  'quantity',
  'notes',
  'preferenceContent',
  'preferenceCode',
  'preferenceId',
  'productId',
  'clientRef',
  'field',
  'value',
  'targetKind',
  'targetId',
]);

interface OrdersChangeHistoryTabRprtProps {
  orderId: string;
  initial: OrderChangeHistoryPage;
  initialError: OrderChangeHistoryErrorCode | null;
}

function outcomeVariant(outcome: string): 'success' | 'warning' | 'info' | 'outline' {
  if (outcome === 'NONE') return 'success';
  if (outcome === 'OUTSTANDING_OPTIONAL') return 'info';
  if (outcome === 'OUTSTANDING_REQUIRED' || outcome === 'OVERPAYMENT') return 'warning';
  return 'outline';
}

/**
 * Order Change history for the order details page.
 * Shows each applied Change, its operations, and the items, pieces, and
 * preferences removed by that Change.
 */
export function OrdersChangeHistoryTabRprt({
  orderId,
  initial,
  initialError,
}: OrdersChangeHistoryTabRprtProps) {
  const t = useTranslations('orders.detail.changeHistory');
  const locale = useLocale();
  const isRTL = useRTL();
  const { decimalPlaces, currencyCode: tenantCurrency } = useTenantCurrency();
  const [items, setItems] = useState(initial.items);
  const [nextCursor, setNextCursor] = useState(initial.nextCursor);
  const [totalCount, setTotalCount] = useState(initial.totalCount);
  const [openId, setOpenId] = useState<string | null>(initial.items[0]?.id ?? null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorCode, setErrorCode] = useState<OrderChangeHistoryErrorCode | null>(initialError);
  const moneyLocale = locale === 'ar' ? 'ar' : 'en';
  const CollapsedIcon = isRTL ? ChevronLeft : ChevronRight;

  const formatWhen = (iso: string | null) => {
    if (!iso) return t('notRecorded');
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return new Intl.DateTimeFormat(moneyLocale, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  };

  const formatMoney = (amount: string, currencyCode: string) =>
    formatMoneyAmountWithCode(amount, {
      currencyCode: currencyCode || tenantCurrency,
      decimalPlaces,
      locale: moneyLocale,
    });

  const formatDelta = (amount: string, currencyCode: string) => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value === 0) return { text: formatMoney('0', currencyCode), tone: t('deltaNone') };
    const formatted = formatMoney(amount, currencyCode);
    if (value > 0) return { text: formatted.startsWith('-') ? formatted : `+${formatted}`, tone: t('deltaIncrease') };
    return { text: formatted, tone: t('deltaDecrease') };
  };

  const fieldName = (key: string) => (KNOWN_FIELDS.has(key) ? t(`fields.${key}`) : key.replace(/_/g, ' '));

  const fieldValue = (field: OrderChangeHistoryValueField, currencyCode: string) => {
    if (MONEY_KEYS.has(field.key) && Number.isFinite(Number(field.value))) return formatMoney(field.value, currencyCode);
    return field.value;
  };

  const pickLabel = (label: string | null, label2: string | null) => {
    if (locale === 'ar' && label2) return label2;
    return label || label2 || t('notRecorded');
  };

  const operationName = (code: string) => (OPERATION_CODES.has(code) ? t(`operations.${code}`) : code);
  const outcomeName = (code: string) => (OUTCOMES.has(code) ? t(`outcomes.${code}`) : code);
  const targetName = (code: string) => (TARGETS.has(code) ? t(`targets.${code}`) : code);

  const errorText = errorCode === 'FORBIDDEN'
    ? t('forbidden')
    : errorCode
      ? t('loadFailed')
      : null;

  async function loadMore() {
    if (nextCursor == null || loadingMore) return;
    setLoadingMore(true);
    const result = await getOrderChangeHistoryAction(orderId, nextCursor);
    if (result.success === false) {
      setErrorCode(result.error);
    } else {
      setItems((current) => [...current, ...result.data.items]);
      setNextCursor(result.data.nextCursor);
      setTotalCount(result.data.totalCount);
      setErrorCode(null);
    }
    setLoadingMore(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t('title')}</h2>
          <p className="max-w-3xl text-sm text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">{t('description')}</p>
        </div>
        <Badge variant="outline">{t('totalCount', { count: totalCount })}</Badge>
      </div>

      {errorText ? <CmxSummaryMessage type="error" title={errorText} items={[]} /> : null}

      {items.length === 0 ? (
        <CmxEmptyState icon={<History className="mx-auto h-8 w-8" aria-hidden />} title={t('emptyTitle')} description={t('emptyDescription')} />
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
            {t('shownOf', { shown: items.length, total: totalCount })}
          </p>
          {items.map((item) => (
            <ChangeCard
              key={item.id}
              item={item}
              open={openId === item.id}
              collapsedIcon={<CollapsedIcon className="h-4 w-4" aria-hidden />}
              onToggle={() => setOpenId(openId === item.id ? null : item.id)}
              formatWhen={formatWhen}
              formatDelta={formatDelta}
              fieldName={fieldName}
              fieldValue={fieldValue}
              pickLabel={pickLabel}
              operationName={operationName}
              outcomeName={outcomeName}
              targetName={targetName}
              labels={{
                viewDetails: t('viewDetails'),
                hideDetails: t('hideDetails'),
                changeNo: t('changeNo'),
                appliedAt: t('appliedAt'),
                actor: t('actor'),
                unknownActor: t('unknownActor'),
                reason: t('reason'),
                noReason: t('noReason'),
                source: t('source'),
                legacySource: t('legacySource'),
                editSource: t('editSource'),
                revision: t('revision'),
                workflowVersion: t('workflowVersion'),
                outcome: t('outcome'),
                delta: t('delta'),
                financialBefore: t('financialBefore'),
                financialAfter: t('financialAfter'),
                operationsTitle: t('operationsTitle'),
                noOperations: t('noOperations'),
                before: t('before'),
                after: t('after'),
                notRecorded: t('notRecorded'),
                removals: t('removals'),
                removedItems: t('removedItems'),
                removedPieces: t('removedPieces'),
                removedPreferences: t('removedPreferences'),
                noRemovals: t('noRemovals'),
                context: t('context'),
                target: t('target'),
                sequence: t('sequence'),
                quantity: t('quantity'),
                code: t('code'),
                level: t('level'),
                extraPrice: t('extraPrice'),
                deletedAt: t('deletedAt'),
                reference: t('reference'),
                parent: t('parent'),
                auditSummary: t('auditSummary'),
              }}
              formatMoney={formatMoney}
            />
          ))}
          {nextCursor != null ? (
            <div className="flex justify-center">
              <CmxButton type="button" variant="outline" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? t('loadingMore') : t('loadMore')}
              </CmxButton>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

interface ChangeCardProps {
  item: OrderChangeHistoryDetailItem;
  open: boolean;
  collapsedIcon: ReactNode;
  onToggle: () => void;
  formatWhen: (iso: string | null) => string;
  formatDelta: (amount: string, currencyCode: string) => { text: string; tone: string };
  formatMoney: (amount: string, currencyCode: string) => string;
  fieldName: (key: string) => string;
  fieldValue: (field: OrderChangeHistoryValueField, currencyCode: string) => string;
  pickLabel: (label: string | null, label2: string | null) => string;
  operationName: (code: string) => string;
  outcomeName: (code: string) => string;
  targetName: (code: string) => string;
  labels: Record<string, string>;
}

function ChangeCard({
  item,
  open,
  collapsedIcon,
  onToggle,
  formatWhen,
  formatDelta,
  formatMoney,
  fieldName,
  fieldValue,
  pickLabel,
  operationName,
  outcomeName,
  targetName,
  labels,
}: ChangeCardProps) {
  const delta = formatDelta(item.commercialDelta, item.currencyCode);
  const itemRemovals = item.removals.filter((row) => row.kind === 'ITEM');
  const pieceRemovals = item.removals.filter((row) => row.kind === 'PIECE');
  const preferenceRemovals = item.removals.filter((row) => row.kind === 'PREFERENCE');

  return (
    <CmxCard>
      <CmxCardHeader className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CmxButton
            type="button"
            variant="ghost"
            className="h-auto justify-start gap-2 px-1"
            aria-expanded={open}
            onClick={onToggle}
          >
            {open ? <ChevronDown className="h-4 w-4" aria-hidden /> : collapsedIcon}
            <span className="text-base font-semibold">
              {labels.changeNo} #{item.changeNo}
            </span>
            <span className="text-sm font-normal text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
              {open ? labels.hideDetails : labels.viewDetails}
            </span>
          </CmxButton>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={outcomeVariant(item.financialOutcome)}>{outcomeName(item.financialOutcome)}</Badge>
            <Badge variant="outline">{item.legacy ? labels.legacySource : labels.editSource}</Badge>
            <span className="text-sm font-semibold tabular-nums">
              {delta.text}
              <span className="ms-1 font-normal text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">{delta.tone}</span>
            </span>
          </div>
        </div>
        <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
          {labels.appliedAt}: {formatWhen(item.appliedAt)}
          <span className="mx-2">·</span>
          {labels.actor}: {item.actorName ?? labels.unknownActor}
          <span className="mx-2">·</span>
          {labels.operationsTitle}: {item.operations.length}
        </p>
      </CmxCardHeader>
      {open ? (
        <CmxCardContent className="space-y-5">
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Fact label={labels.reason} value={item.reason ?? labels.noReason} />
            <Fact label={labels.source} value={item.sourceContext} />
            <Fact label={labels.revision} value={`${item.revisionBefore} → ${item.revisionAfter}`} />
            <Fact label={labels.workflowVersion} value={String(item.workflowVersionExpected)} />
            <Fact label={labels.outcome} value={outcomeName(item.financialOutcome)} />
            <Fact label={labels.delta} value={`${delta.text} (${delta.tone})`} />
          </dl>

          <div className="grid gap-3 md:grid-cols-2">
            <ValueList title={labels.financialBefore} fields={item.financialBefore} currencyCode={item.currencyCode} fieldName={fieldName} fieldValue={fieldValue} empty={labels.notRecorded} />
            <ValueList title={labels.financialAfter} fields={item.financialAfter} currencyCode={item.currencyCode} fieldName={fieldName} fieldValue={fieldValue} empty={labels.notRecorded} />
          </div>

          <section className="space-y-2">
            <h3 className="text-sm font-semibold">{labels.operationsTitle}</h3>
            {item.operations.length === 0 ? (
              <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">{labels.noOperations}</p>
            ) : (
              <ol className="space-y-3">
                {item.operations.map((operation) => (
                  <li key={`${item.id}-${operation.seq}`} className="rounded-lg border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{labels.sequence} {operation.seq}</Badge>
                      <span className="font-medium">{operationName(operation.code)}</span>
                      <span className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
                        {labels.target}: {targetName(operation.targetType)}
                        {operation.targetLabel || operation.targetLabel2
                          ? ` · ${pickLabel(operation.targetLabel, operation.targetLabel2)}`
                          : ''}
                      </span>
                    </div>
                    {operation.auditSummary ? (
                      <p className="mt-2 text-sm">{labels.auditSummary}: {operation.auditSummary}</p>
                    ) : null}
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <ValueList title={labels.before} fields={operation.before} currencyCode={item.currencyCode} fieldName={fieldName} fieldValue={fieldValue} empty={labels.notRecorded} />
                      <ValueList title={labels.after} fields={operation.after} currencyCode={item.currencyCode} fieldName={fieldName} fieldValue={fieldValue} empty={labels.notRecorded} />
                    </div>
                    <p className="mt-2 break-all text-xs text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
                      {labels.reference}: {operation.orderItemId ?? operation.orderItemPieceId ?? operation.orderPreferenceId ?? operation.clientRef ?? labels.notRecorded}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{labels.removals}</h3>
            {item.removals.length === 0 ? (
              <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">{labels.noRemovals}</p>
            ) : (
              <div className="space-y-3">
                <RemovalGroup title={labels.removedItems} rows={itemRemovals} labels={labels} formatWhen={formatWhen} formatMoney={formatMoney} currencyCode={item.currencyCode} pickLabel={pickLabel} />
                <RemovalGroup title={labels.removedPieces} rows={pieceRemovals} labels={labels} formatWhen={formatWhen} formatMoney={formatMoney} currencyCode={item.currencyCode} pickLabel={pickLabel} />
                <RemovalGroup title={labels.removedPreferences} rows={preferenceRemovals} labels={labels} formatWhen={formatWhen} formatMoney={formatMoney} currencyCode={item.currencyCode} pickLabel={pickLabel} />
              </div>
            )}
          </section>

          {item.context.length > 0 ? (
            <ValueList title={labels.context} fields={item.context} currencyCode={item.currencyCode} fieldName={fieldName} fieldValue={fieldValue} empty={labels.notRecorded} />
          ) : null}
        </CmxCardContent>
      ) : null}
    </CmxCard>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

function ValueList({
  title,
  fields,
  currencyCode,
  fieldName,
  fieldValue,
  empty,
}: {
  title: string;
  fields: OrderChangeHistoryValueField[];
  currencyCode: string;
  fieldName: (key: string) => string;
  fieldValue: (field: OrderChangeHistoryValueField, currencyCode: string) => string;
  empty: string;
}) {
  return (
    <div className="rounded-lg bg-[rgb(var(--cmx-muted-rgb,248_250_252))] p-3">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide">{title}</h4>
      {fields.length === 0 ? (
        <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">{empty}</p>
      ) : (
        <dl className="space-y-1">
          {fields.map((field) => (
            <div key={field.key} className="flex items-start justify-between gap-3 text-sm">
              <dt className="text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">{fieldName(field.key)}</dt>
              <dd className="break-all text-end font-medium tabular-nums">{fieldValue(field, currencyCode)}</dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function RemovalGroup({
  title,
  rows,
  labels,
  formatWhen,
  formatMoney,
  currencyCode,
  pickLabel,
}: {
  title: string;
  rows: OrderChangeHistoryRemovalView[];
  labels: Record<string, string>;
  formatWhen: (iso: string | null) => string;
  formatMoney: (amount: string, currencyCode: string) => string;
  currencyCode: string;
  pickLabel: (label: string | null, label2: string | null) => string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] p-3 text-sm">
            <p className="font-medium">{pickLabel(row.label, row.label2)}</p>
            <p className="mt-1 text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
              {[
                row.quantity ? `${labels.quantity}: ${row.quantity}` : null,
                row.code ? `${labels.code}: ${row.code}` : null,
                row.level ? `${labels.level}: ${row.level}` : null,
                row.extraPrice ? `${labels.extraPrice}: ${formatMoney(row.extraPrice, currencyCode)}` : null,
                row.parentLabel || row.parentLabel2 ? `${labels.parent}: ${pickLabel(row.parentLabel, row.parentLabel2)}` : null,
                row.deletedAt ? `${labels.deletedAt}: ${formatWhen(row.deletedAt)}` : null,
              ].filter((part): part is string => part != null).join(' · ')}
            </p>
            <p className="mt-1 break-all text-xs text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
              {labels.reference}: {row.id}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

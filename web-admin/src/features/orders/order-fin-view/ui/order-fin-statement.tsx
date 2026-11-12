'use client';

/**
 * The statement body (P5-04, DESIGN §2.1–2.3): value builds up to the Total,
 * settlement brings it down to the Balance, records and control follow. One
 * row per visible section, in the resolved order and mode. Renders what the
 * view says — no arithmetic: the closing rows are the header's own figures.
 *
 * Line rules (§6.6): only `additive` money lines use the amount column;
 * included parts, informational amounts, points and was → now go in the text.
 * Lines not counted (voided, failed, reversed, pending) are shown, muted or
 * struck, with a "not counted" chip.
 */
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';

import { ORDER_FIN_SECTION_GROUP } from '@/lib/constants/order-fin-view';
import type {
  OrderFinGroupKey,
  OrderFinLine,
  OrderFinSectionKey,
  OrderFinSectionPayload,
  OrderFinancialView,
  ResolvedOrderFinDisplayConfig,
} from '@/lib/types/order-fin-view';
import { CmxButton } from '@ui/primitives';
import { CmxStatusBadge } from '@ui/feedback';
import { CmxStatement, CmxStatementGroup, CmxStatementLine, CmxStatementLineList, CmxStatementRow } from '@ui/data-display';
import { useFinMoney } from './order-fin-money';
import { lineLabel, sectionTitle, type Translator } from './order-fin-labels';

const NOT_COUNTED_STATES = ['pending', 'failed', 'voided', 'reversed'] as const;

export interface OrderFinStatementProps {
  view: OrderFinancialView;
  resolved: ResolvedOrderFinDisplayConfig;
  /** Retries a section that failed to load (refetches the view). */
  onRetry?: () => void;
}

function formatDate(iso: string | undefined, locale: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString(locale === 'ar' ? 'ar' : 'en', { dateStyle: 'medium', timeStyle: 'short' });
}

/**
 * @param props - the view, the resolved config and an optional retry
 */
export function OrderFinStatement({ view, resolved, onRetry }: OrderFinStatementProps) {
  const t = useTranslations() as unknown as Translator;
  const locale = useLocale();
  const money = useFinMoney(view);
  const print = resolved.layout === 'print';
  const showEmpty = resolved.showEmptySections || resolved.preset === 'full' || resolved.preset === 'audit';
  const cap = print || resolved.preset === 'audit' ? 0 : (resolved.lineCap ?? 0);

  const visible = resolved.sectionOrder.filter((key) => {
    const section = view.sections[key];
    if (!section) return false;
    if (section.status === 'forbidden' && resolved.forbiddenSectionBehavior === 'hide') return false;
    return section.status !== 'empty' || showEmpty;
  });
  const expandableKeys = visible.filter((k) => resolved.sections[k] === 'expandable' || resolved.sections[k] === 'expanded');
  const [open, setOpen] = useState<Partial<Record<OrderFinSectionKey, boolean>>>(() =>
    Object.fromEntries(expandableKeys.map((k) => [k, print || resolved.sections[k] === 'expanded'])));
  const setAll = (value: boolean) => setOpen(Object.fromEntries(expandableKeys.map((k) => [k, value])));

  const line = (key: OrderFinSectionKey, l: OrderFinLine) => {
    const label = lineLabel(l, key, t, locale);
    const meta = [formatDate(l.meta?.dateIso, locale), l.meta?.ref].filter(Boolean).join(' · ') || undefined;
    const notCounted = (NOT_COUNTED_STATES as readonly string[]).includes(l.state);
    const chip = notCounted ? <CmxStatusBadge size="sm" variant={l.state === 'pending' ? 'warning' : 'default'} label={t(`orders.finView.lineStates.${l.state}`)} /> : undefined;
    let note: React.ReactNode;
    if (l.unit === 'points') note = t('orders.finView.lines.points', { points: l.amount ?? 0 });
    else if (l.role !== 'additive' && l.amount != null) note = money(l.amount, { size: 'sm', tone: 'muted' });
    if (l.taxParts?.length) {
      // The line's tax by code, from the tax record; text only, never summed.
      note = (
        <span className="inline-flex flex-wrap items-center gap-x-2">
          {l.taxParts.map((p) => (
            <span key={`${p.taxCode}-${p.ratePercent ?? ''}`} className="inline-flex items-center gap-1">
              {t('orders.finView.lines.taxPart', { code: p.taxCode, rate: p.ratePercent == null ? '' : `${p.ratePercent}%` })}
              {money(p.amount, { size: 'sm', tone: 'muted' })}
            </span>
          ))}
        </span>
      );
    }
    if (l.previousAmount != null) {
      note = (
        <span className="inline-flex items-center gap-1">
          {money(l.previousAmount, { size: 'sm', tone: 'muted', struck: true })}
          <span aria-hidden="true">{locale === 'ar' ? '←' : '→'}</span>
          {money(l.amount, { size: 'sm' })}
        </span>
      );
    }
    return (
      <CmxStatementLine
        key={l.id}
        label={label}
        meta={meta}
        chip={chip}
        note={note}
        struck={l.state === 'voided' || l.state === 'failed' || l.state === 'reversed'}
        muted={l.state === 'pending'}
        amount={l.role === 'additive' && l.unit === 'money' ? money(l.amount, { sign: l.sign, struck: notCounted, tone: notCounted ? 'muted' : 'default' }) : undefined}
      />
    );
  };

  const chips = (section: OrderFinSectionPayload) => {
    const counts = section.counts ?? {};
    const parts = NOT_COUNTED_STATES.filter((s) => (counts[s] ?? 0) > 0);
    return parts.length ? <>{parts.map((s) => <CmxStatusBadge key={s} size="sm" variant="outline" label={t(`orders.finView.chips.${s}`, { count: counts[s] })} />)}</> : undefined;
  };

  const row = (key: OrderFinSectionKey) => {
    const section = view.sections[key]!;
    const mode = resolved.sections[key];
    if (mode === 'hidden') return null;
    const total = section.totals[0];
    const amount = total ? money(total.amount, { sign: total.role === 'additive' ? total.sign : 'neutral', tone: total.role === 'included' ? 'muted' : 'default' }) : undefined;
    let status: React.ReactNode;
    if (section.status === 'error') {
      status = (
        <div className="flex items-center gap-2 text-sm text-[rgb(var(--cmx-muted-foreground-rgb))]" role="alert">
          {t('orders.finView.states.loadFailed')}
          {onRetry && <CmxButton size="xs" variant="outline" onClick={onRetry}>{t('orders.finView.states.retry')}</CmxButton>}
        </div>
      );
    } else if (section.status === 'empty' || (section.lines && section.lines.length === 0)) {
      status = <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb))]">{t('orders.finView.states.none')}</p>;
    } else if (section.status === 'forbidden') {
      status = <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb))]">{t('orders.finView.states.forbidden')}</p>;
    }
    const lines = section.lines && section.lines.length > 0 ? (
      <>
        <CmxStatementLineList cap={cap} showAllLabel={(n) => t('orders.finView.actions.showAll', { count: n })} showLessLabel={t('orders.finView.actions.showLess')}>
          {section.lines.map((l) => line(key, l))}
        </CmxStatementLineList>
        {section.partial && <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb))]">{t('orders.finView.banners.partialTimeline')}</p>}
      </>
    ) : null;
    const marker = section.warningCodes?.length
      ? <CmxStatusBadge size="sm" variant="warning" label={t('orders.finView.warnings.count', { count: section.warningCodes.length })} />
      : undefined;
    return (
      <CmxStatementRow
        key={key}
        title={sectionTitle(key, view, t)}
        count={section.lines?.length || undefined}
        chips={chips(section)}
        marker={marker}
        amount={amount}
        mode={print && mode !== 'total' ? 'detail' : mode}
        open={open[key]}
        onOpenChange={(v) => setOpen((o) => ({ ...o, [key]: v }))}
        status={mode === 'total' ? undefined : status}
      >
        {mode === 'total' ? undefined : lines}
      </CmxStatementRow>
    );
  };

  const groups = resolved.groupOrder
    .map((g) => ({ group: g, keys: visible.filter((k) => ORDER_FIN_SECTION_GROUP[k] === g) }))
    .filter((g) => g.keys.length > 0);
  const footer = (group: OrderFinGroupKey) => {
    const m = view.header.metrics;
    if (group === 'value') return { label: t('orders.finView.metrics.total'), amount: money(m.total, { size: 'md' }), emphasis: true };
    if (group === 'settlement' && view.header.balanceState) {
      return { label: t(`orders.finView.balanceStates.${view.header.balanceState}`), amount: money(m.balance), emphasis: true };
    }
    return undefined;
  };

  // A header-only view (every section hidden) has no statement at all.
  if (visible.length === 0) return null;

  return (
    <CmxStatement print={print} draft={view.sourceKind === 'draft'} density={resolved.density} aria-label={t('orders.finView.title')}>
      {!print && expandableKeys.length > 1 && (
        <div className="flex justify-end gap-2">
          <CmxButton size="xs" variant="ghost" onClick={() => setAll(true)}>{t('orders.finView.actions.expandAll')}</CmxButton>
          <CmxButton size="xs" variant="ghost" onClick={() => setAll(false)}>{t('orders.finView.actions.collapseAll')}</CmxButton>
        </div>
      )}
      <div className={resolved.columns === 2 || (resolved.columns === 'auto' && resolved.density !== 'compact' && !print) ? 'grid gap-4 lg:grid-cols-2' : 'flex flex-col gap-4'}>
        {groups.filter((g) => g.group === 'value' || g.group === 'settlement').map(({ group, keys }) => (
          <CmxStatementGroup key={group} title={t(`orders.finView.groups.${group}`)} footer={footer(group)}>
            {keys.map(row)}
          </CmxStatementGroup>
        ))}
      </div>
      {groups.filter((g) => g.group === 'records' || g.group === 'control').map(({ group, keys }) => (
        <CmxStatementGroup key={group} title={t(`orders.finView.groups.${group}`)}>
          {keys.map(row)}
        </CmxStatementGroup>
      ))}
    </CmxStatement>
  );
}

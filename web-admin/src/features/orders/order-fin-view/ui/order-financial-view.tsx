'use client';

/**
 * OrderFinancialView (P5-05, P5-09, P5-10): one component for every money
 * view of an order — a saved order (fetched), a pre-built view (server page or
 * public projection), an unsaved order in the payment modal (draft) and the
 * Order Edit live quote (edit). It renders what the read model says and never
 * computes money. No permission logic (D10): the host decides first.
 */
import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';

import { ORDER_STATUSES } from '@/lib/constants/order-types';
import type {
  OrderFinDraftInput,
  OrderFinPreset,
  OrderFinancialDisplayConfig,
  OrderFinancialView as OrderFinancialViewModel,
} from '@/lib/types/order-fin-view';
import { cn } from '@/lib/utils';
import { CmxSummaryMessage, CmxStatusBadge } from '@ui/feedback';
import { CmxButton, CmxSkeleton, CmxTabs, CmxTabsList, CmxTabsTrigger } from '@ui/primitives';
import { CmxCollapsibleSection } from '@ui/data-display';
import { OrderFinApiError, type OrderFinViewRequest } from '../api/order-fin-view-api';
import { resolveOrderFinDisplayConfig } from '../config/resolve-display-config';
import { mapDraftToSourceSet } from '../draft/map-draft-to-source-set';
import type { OrderEditQuoteState } from '../hooks/use-order-edit-financial-quote';
import { useOrderFinancialView } from '../hooks/use-order-financial-view';
import { assembleOrderFinancialView } from '../vwbuilders/assemble';
import { OrderFinHeader } from './order-fin-header';
import { warningText, type Translator } from './order-fin-labels';
import { OrderFinStatement } from './order-fin-statement';

/** Where the figures come from (PLAN §6, `OrderFinSource`). */
export type OrderFinSource =
  | { kind: 'order'; orderId: string }
  | { kind: 'data'; view: OrderFinancialViewModel }
  | { kind: 'draft'; draft: OrderFinDraftInput }
  | { kind: 'edit'; orderId: string; quote: OrderEditQuoteState };

export interface OrderFinancialViewProps {
  source: OrderFinSource;
  config?: OrderFinancialDisplayConfig;
  className?: string;
}

const STORAGE_PREFIX = 'cmx.orderFinView.preset:';
const HEALTHY = new Set(['CURRENT', 'LOCKED']);

function readStoredPreset(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storePreset(key: string, preset: string): void {
  try {
    window.localStorage.setItem(key, preset);
  } catch {
    // Private mode or blocked storage: the switch still works for this visit.
  }
}

/**
 * @param props - source, display config and class name
 * @example <OrderFinancialView source={{ kind: 'order', orderId }} config={{ preset: 'detailed', presetSwitcher: ['detailed', 'full'] }} />
 */
export function OrderFinancialView({ source, config = {}, className }: OrderFinancialViewProps) {
  const t = useTranslations() as unknown as Translator;
  const locale = useLocale();
  const pathname = usePathname();
  const switcher = config.presetSwitcher ?? [];
  const storageKey = `${STORAGE_PREFIX}${pathname ?? ''}`;

  // `?fin=` wins, then this viewer's last choice on this route, then the caller's preset (D9).
  const [chosen, setChosen] = useState<OrderFinPreset | null>(() => {
    const allowed = (p: string | null): p is OrderFinPreset => p != null && (switcher as string[]).includes(p);
    // Read once on mount from the address bar (no Suspense boundary needed, unlike useSearchParams).
    const fromUrl = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('fin');
    if (allowed(fromUrl)) return fromUrl;
    const stored = typeof window === 'undefined' ? null : readStoredPreset(storageKey);
    return allowed(stored) ? stored : null;
  });
  const preset = chosen ?? config.preset;
  const sourceKind = source.kind === 'draft' ? 'draft' : source.kind === 'edit' ? 'edit' : 'saved';
  const resolved = useMemo(() => resolveOrderFinDisplayConfig({ ...config, preset }, sourceKind), [config, preset, sourceKind]);
  const [draftAt] = useState(() => new Date().toISOString());

  const fetchedId = source.kind === 'order' ? source.orderId : source.kind === 'edit' && !source.quote.view ? source.orderId : null;

  const draftView = useMemo(
    () => (source.kind === 'draft' ? assembleOrderFinancialView(mapDraftToSourceSet(source.draft), resolved, draftAt) : null),
    [source, resolved, draftAt],
  );

  const switchTo = (next: string) => {
    setChosen(next as OrderFinPreset);
    storePreset(storageKey, next);
  };

  // Only a saved order is fetched, so `data` and `draft` views need no staff session (public pages).
  if (fetchedId) {
    return (
      <SavedOrderView orderId={fetchedId} request={{ preset: resolved.preset, sections: config.sections }} badge={resolved.header.layout === 'badge'} className={className}>
        {(view, refetch) => renderBody(view, refetch)}
      </SavedOrderView>
    );
  }
  const direct = source.kind === 'data' ? source.view : source.kind === 'draft' ? draftView : source.kind === 'edit' ? source.quote.view : null;
  return direct ? renderBody(direct) : null;

  function renderBody(view: OrderFinancialViewModel, onRetry?: () => void) {
  // A snapshot that was never written: no figures at all, never zeros (PR-09).
  if (view.header.balanceState == null && view.sourceKind === 'saved') {
    return <p className={cn('rounded-lg border border-[rgb(var(--cmx-border-rgb))] p-4 text-sm', className)}>{t('orders.finView.banners.unavailable')}</p>;
  }

  if (resolved.header.layout === 'badge') {
    return <span className={className}><OrderFinHeader view={view} header={resolved.header} /></span>;
  }

  const edit = source.kind === 'edit' ? source.quote : null;
  const warnings = resolved.showWarnings ? view.warnings : [];

  return (
    <div className={cn('flex flex-col gap-4', resolved.layout === 'card' && 'rounded-xl border border-[rgb(var(--cmx-border-rgb))] bg-[rgb(var(--cmx-card-rgb))] p-4', resolved.layout === 'sheet' && 'gap-3', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className={cn('min-w-0 flex-1 motion-safe:transition-opacity', edit?.status === 'pending' && 'opacity-60')}>
          {view.sourceKind === 'draft' && <CmxStatusBadge className="mb-2" size="sm" variant="info" label={t('orders.finView.draftBadge')} />}
          {resolved.header.visible && <OrderFinHeader view={view} header={resolved.header} density={resolved.density} />}
        </div>
        {switcher.length > 1 && resolved.layout !== 'print' && (
          <CmxTabs value={resolved.preset} onValueChange={switchTo} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            <CmxTabsList aria-label={t('orders.finView.presets.switcher')}>
              {switcher.map((p) => <CmxTabsTrigger key={p} value={p}>{t(`orders.finView.presets.${p}`)}</CmxTabsTrigger>)}
            </CmxTabsList>
          </CmxTabs>
        )}
      </div>

      {edit && (edit.status === 'pending' || edit.status === 'error') && (
        <div className="flex flex-wrap items-center gap-2 text-sm" aria-live="polite">
          {edit.status === 'pending' && <CmxStatusBadge size="sm" variant="processing" label={t('orders.finView.edit.updating')} />}
          {edit.status === 'error' && edit.error && (
            <>
              <span role="alert">{t(edit.error.code === 'QUOTE_REJECTED' ? 'orders.finView.edit.quoteFailed' : `orders.finView.errors.${edit.error.code}`)}</span>
              <CmxButton size="xs" variant="outline" onClick={edit.retry}>{t('orders.finView.edit.tryAgain')}</CmxButton>
            </>
          )}
        </div>
      )}

      {view.orderStatus === ORDER_STATUSES.CANCELLED && (
        <CmxSummaryMessage type="info" title={t('orders.finView.banners.cancelled')} items={[]} />
      )}
      {view.sourceKind === 'saved' && view.snapshotStatus && !HEALTHY.has(view.snapshotStatus) && (
        <CmxSummaryMessage type="warning" title={t('orders.finView.banners.recalculating')} items={[]} />
      )}
      {!view.currencyKnown && <CmxStatusBadge size="sm" variant="warning" label={t('orders.finView.banners.currencyUnknown')} />}

      {warnings.length > 0 && (
        <CmxCollapsibleSection
          className="rounded-lg border border-[rgb(var(--cmx-warning-border-rgb))] bg-[rgb(var(--cmx-warning-bg-rgb))]"
          title={<span className="font-medium">{t('orders.finView.warnings.count', { count: warnings.length })}</span>}
        >
          <ul className="list-disc ps-4 text-sm">
            {warnings.map((w, i) => <li key={`${w.code}-${i}`}>{warningText(w, t)}</li>)}
          </ul>
        </CmxCollapsibleSection>
      )}

      <OrderFinStatement view={view} resolved={resolved} onRetry={onRetry} />
    </div>
  );
  }
}

/** Fetches one saved order (staff session) and hands the view to `children`; loading and error states live here. */
function SavedOrderView({ orderId, request, badge, className, children }: {
  orderId: string;
  request: OrderFinViewRequest;
  badge: boolean;
  className?: string;
  children: (view: OrderFinancialViewModel, refetch: () => void) => React.ReactNode;
}) {
  const t = useTranslations() as unknown as Translator;
  const query = useOrderFinancialView(orderId, request);
  const refetch = () => void query.refetch();
  if (query.data) return <>{children(query.data, refetch)}</>;
  if (query.isError) {
    const code = query.error instanceof OrderFinApiError ? query.error.code : 'INTERNAL_ERROR';
    return (
      <div role="alert" className={cn('flex flex-wrap items-center gap-3 rounded-lg border border-[rgb(var(--cmx-border-rgb))] p-4 text-sm', className)}>
        <span>{t(`orders.finView.errors.${code}`)}</span>
        <CmxButton size="sm" variant="outline" onClick={refetch}>{t('orders.finView.states.retry')}</CmxButton>
      </div>
    );
  }
  return (
    <div className={cn('flex flex-col gap-3', className)} aria-busy="true" aria-label={t('orders.finView.states.loading')}>
      <CmxSkeleton className="h-16 w-full" />
      {!badge && Array.from({ length: 5 }, (_, i) => <CmxSkeleton key={i} className="h-9 w-full" />)}
    </div>
  );
}

'use client';

/**
 * Gift Cards List Screen
 *
 * Displays paginated gift cards with search, status/issue-type filters,
 * and per-row lifecycle actions (Activate, Suspend, Void).
 * All statuses match GIFT_CARD_STATUS uppercase constants (migration 0257).
 */

import { useState, useCallback, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { PlusCircle, Search, Settings2, ShoppingCart } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxDataTable } from '@ui/data-display';
import { CmxConfirmDialog } from '@ui/feedback';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogDescription,
} from '@ui/overlays';
import { useGiftCards } from '../hooks/use-gift-cards';
import type { GiftCard } from '@/lib/types/payment';
import {
  GIFT_CARD_STATUS,
  type GiftCardStatus,
  type GiftCardIssueType,
} from '@/lib/constants/gift-card';
import { GiftCardIssueDialog } from './gift-card-issue-dialog';
import { GiftCardDetailDialog } from './gift-card-detail-dialog';
import { GiftCardSellDialog } from './gift-card-sell-dialog';
import {
  activateGiftCardAction,
  suspendGiftCardAction,
  voidGiftCardAction,
} from '@/app/actions/marketing/gift-card-actions';

/** Maps new uppercase statuses to badge variant + Tailwind colour class */
const STATUS_STYLE: Record<
  GiftCardStatus,
  { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }
> = {
  [GIFT_CARD_STATUS.ACTIVE]:             { variant: 'default',     className: 'bg-green-100 text-green-800 border-green-200' },
  [GIFT_CARD_STATUS.PARTIALLY_REDEEMED]: { variant: 'outline',     className: 'bg-amber-100 text-amber-800 border-amber-200' },
  [GIFT_CARD_STATUS.GENERATED]:          { variant: 'outline',     className: 'bg-blue-100 text-blue-800 border-blue-200' },
  [GIFT_CARD_STATUS.DRAFT]:              { variant: 'secondary',   className: 'bg-slate-100 text-slate-700 border-slate-200' },
  [GIFT_CARD_STATUS.FULLY_REDEEMED]:     { variant: 'secondary',   className: 'bg-gray-100 text-gray-600 border-gray-200' },
  [GIFT_CARD_STATUS.EXPIRED]:            { variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-200' },
  [GIFT_CARD_STATUS.VOIDED]:             { variant: 'destructive', className: 'bg-red-100 text-red-800 border-red-200' },
  [GIFT_CARD_STATUS.SUSPENDED]:          { variant: 'outline',     className: 'bg-orange-100 text-orange-800 border-orange-200' },
};

/** Maps issue type to badge colour class */
const ISSUE_TYPE_CLASS: Record<GiftCardIssueType, string> = {
  SOLD:        'bg-blue-100 text-blue-800 border-blue-200',
  PROMOTIONAL: 'bg-purple-100 text-purple-800 border-purple-200',
  CORPORATE:   'bg-orange-100 text-orange-800 border-orange-200',
  GOODWILL:    'bg-green-100 text-green-800 border-green-200',
  MIGRATION:   'bg-slate-100 text-slate-700 border-slate-200',
  REPLACEMENT: 'bg-slate-100 text-slate-700 border-slate-200',
};

const FILTERABLE_STATUSES: GiftCardStatus[] = [
  GIFT_CARD_STATUS.ACTIVE,
  GIFT_CARD_STATUS.GENERATED,
  GIFT_CARD_STATUS.PARTIALLY_REDEEMED,
  GIFT_CARD_STATUS.SUSPENDED,
  GIFT_CARD_STATUS.EXPIRED,
  GIFT_CARD_STATUS.VOIDED,
];

const FILTERABLE_ISSUE_TYPES: GiftCardIssueType[] = [
  'SOLD', 'PROMOTIONAL', 'CORPORATE', 'GOODWILL', 'MIGRATION', 'REPLACEMENT',
];

/**
 *
 */
export function GiftCardListScreen() {
  const t = useTranslations('marketing.giftCards');
  const tCommon = useTranslations('common');

  const [search, setSearch]               = useState('');
  const [status, setStatus]               = useState<GiftCardStatus | undefined>(undefined);
  const [issueTypeFilter, setIssueTypeFilter] = useState<GiftCardIssueType | undefined>(undefined);
  const [page, setPage]                   = useState(1);

  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [showSellDialog,  setShowSellDialog]  = useState(false);
  const [selectedCard,    setSelectedCard]    = useState<GiftCard | null>(null);

  /** Card staged for a suspend/void action that needs a confirm dialog */
  const [pendingSuspend, setPendingSuspend] = useState<GiftCard | null>(null);
  const [pendingVoid,    setPendingVoid]    = useState<GiftCard | null>(null);

  const [isPending, startTransition] = useTransition();

  const { giftCards, total, isLoading, refetch } = useGiftCards({ search, status, page });

  // -------------------------------------------------------------------------
  // Row-action helpers
  // -------------------------------------------------------------------------

  const handleActivate = useCallback(
    (id: string) => {
      startTransition(async () => {
        await activateGiftCardAction(id);
        refetch();
      });
    },
    [refetch]
  );

  const handleSuspendConfirm = useCallback(() => {
    if (!pendingSuspend) return;
    const id = pendingSuspend.id;
    setPendingSuspend(null);
    startTransition(async () => {
      await suspendGiftCardAction(id, 'Suspended via admin UI');
      refetch();
    });
  }, [pendingSuspend, refetch]);

  const handleVoidConfirm = useCallback(() => {
    if (!pendingVoid) return;
    const id = pendingVoid.id;
    setPendingVoid(null);
    startTransition(async () => {
      await voidGiftCardAction(id, 'Voided via admin UI');
      refetch();
    });
  }, [pendingVoid, refetch]);

  // Filter by issueType is applied client-side because the hook doesn't accept
  // issueType yet — avoids touching the backend action for a V1 filter.
  const displayCards = issueTypeFilter
    ? giftCards.filter((c) => c.issue_type === issueTypeFilter)
    : giftCards;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <div className="flex gap-2">
          <CmxButton
            variant="outline"
            size="sm"
            onClick={() => setShowIssueDialog(true)}
            className="inline-flex items-center gap-2"
          >
            <PlusCircle className="h-4 w-4" />
            {t('actions.issueCard')}
          </CmxButton>
          <CmxButton
            variant="primary"
            size="sm"
            onClick={() => setShowSellDialog(true)}
            className="inline-flex items-center gap-2"
          >
            <ShoppingCart className="h-4 w-4" />
            {t('actions.sellCard')}
          </CmxButton>
        </div>
      </div>

      {/* Search + Status filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <CmxInput
            className="ps-8"
            placeholder={tCommon('search')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        {FILTERABLE_STATUSES.map((s) => (
          <CmxButton
            key={s}
            variant={status === s ? 'primary' : 'outline'}
            size="sm"
            onClick={() => { setStatus((prev) => prev === s ? undefined : s); setPage(1); }}
          >
            {t(`statuses.${s}`)}
          </CmxButton>
        ))}
      </div>

      {/* Issue type filter */}
      <div className="flex gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground self-center">{t('fields.issueType')}:</span>
        {FILTERABLE_ISSUE_TYPES.map((it) => (
          <CmxButton
            key={it}
            variant={issueTypeFilter === it ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setIssueTypeFilter((prev) => prev === it ? undefined : it)}
          >
            {t(`issueTypes.${it}`)}
          </CmxButton>
        ))}
      </div>

      {/* Table */}
      <CmxDataTable
        isLoading={isLoading || isPending}
        columns={[
          {
            key: 'gift_card_code',
            header: t('fields.giftCardCode'),
            render: (row: GiftCard) => (
              <span className="font-mono" dir="ltr">{row.gift_card_code}</span>
            ),
          },
          {
            key: 'card_name',
            header: t('fields.cardName'),
            render: (row: GiftCard) => row.card_name,
          },
          {
            key: 'issue_type',
            header: t('fields.issueType'),
            render: (row: GiftCard) => (
              <Badge
                variant="outline"
                className={ISSUE_TYPE_CLASS[row.issue_type] ?? ''}
              >
                {t(`issueTypes.${row.issue_type}`)}
              </Badge>
            ),
          },
          {
            key: 'original_amount',
            header: t('fields.originalAmount'),
            render: (row: GiftCard) => `${row.original_amount.toFixed(3)} ${row.currency_code}`,
          },
          {
            key: 'available_amount',
            header: t('fields.availableBalance'),
            render: (row: GiftCard) => `${row.available_amount.toFixed(3)} ${row.currency_code}`,
          },
          {
            key: 'expiry_date',
            header: t('fields.expiryDate'),
            render: (row: GiftCard) =>
              row.expiry_date ? new Date(row.expiry_date).toLocaleDateString() : '—',
          },
          {
            key: 'issued_to_customer',
            header: t('fields.issuedToCustomer'),
            render: (row: GiftCard) => row.issued_to_customer_name ?? '—',
          },
          {
            key: 'status',
            header: tCommon('status'),
            render: (row: GiftCard) => {
              const style = STATUS_STYLE[row.status] ?? { variant: 'outline' as const, className: '' };
              return (
                <Badge variant={style.variant} className={style.className}>
                  {t(`statuses.${row.status}`)}
                </Badge>
              );
            },
          },
          {
            key: 'actions',
            header: tCommon('actions'),
            render: (row: GiftCard) => (
              <div className="flex gap-1">
                {/* Detail */}
                <CmxButton
                  variant="ghost"
                  size="xs"
                  title={t('detail')}
                  onClick={() => setSelectedCard(row)}
                >
                  <Settings2 className="h-4 w-4" />
                </CmxButton>

                {/* Activate — only for GENERATED */}
                {row.status === GIFT_CARD_STATUS.GENERATED && (
                  <CmxConfirmDialog
                    title={t('confirmations.activateTitle')}
                    description={t('confirmations.activateMessage', {
                      code: row.gift_card_code,
                      amount: row.original_amount.toFixed(3),
                      currency: row.currency_code,
                    })}
                    confirmLabel={t('actions.activate')}
                    cancelLabel={tCommon('cancel')}
                    onConfirm={() => handleActivate(row.id)}
                    trigger={
                      <CmxButton variant="ghost" size="sm" title={t('actions.activate')}>
                        {t('actions.activate')}
                      </CmxButton>
                    }
                  />
                )}

                {/* Suspend — ACTIVE or PARTIALLY_REDEEMED */}
                {(row.status === GIFT_CARD_STATUS.ACTIVE ||
                  row.status === GIFT_CARD_STATUS.PARTIALLY_REDEEMED) && (
                  <CmxButton
                    variant="ghost"
                    size="sm"
                    title={t('actions.suspend')}
                    onClick={() => setPendingSuspend(row)}
                  >
                    {t('actions.suspend')}
                  </CmxButton>
                )}

                {/* Void — not already VOIDED or EXPIRED */}
                {row.status !== GIFT_CARD_STATUS.VOIDED &&
                  row.status !== GIFT_CARD_STATUS.EXPIRED && (
                  <CmxButton
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    title={t('actions.voidCard')}
                    onClick={() => setPendingVoid(row)}
                  >
                    {t('actions.voidCard')}
                  </CmxButton>
                )}
              </div>
            ),
          },
        ]}
        data={displayCards}
        totalCount={total}
        currentPage={page}
        pageSize={25}
        onPageChange={setPage}
      />

      {/* Suspend confirmation dialog */}
      {pendingSuspend && (
        <CmxDialog open onOpenChange={(o) => !o && setPendingSuspend(null)}>
          <CmxDialogContent className="max-w-sm">
            <CmxDialogHeader>
              <CmxDialogTitle>{t('confirmations.suspendTitle')}</CmxDialogTitle>
              <CmxDialogDescription>
                {t('confirmations.suspendMessage', {
                  code:     pendingSuspend.gift_card_code,
                  amount:   pendingSuspend.available_amount.toFixed(3),
                  currency: pendingSuspend.currency_code,
                })}
              </CmxDialogDescription>
            </CmxDialogHeader>
            <CmxDialogFooter>
              <CmxButton variant="outline" onClick={() => setPendingSuspend(null)}>
                {tCommon('cancel')}
              </CmxButton>
              <CmxButton onClick={handleSuspendConfirm} disabled={isPending}>
                {t('actions.suspend')}
              </CmxButton>
            </CmxDialogFooter>
          </CmxDialogContent>
        </CmxDialog>
      )}

      {/* Void confirmation dialog */}
      {pendingVoid && (
        <CmxDialog open onOpenChange={(o) => !o && setPendingVoid(null)}>
          <CmxDialogContent className="max-w-sm">
            <CmxDialogHeader>
              <CmxDialogTitle>{t('confirmations.voidTitle')}</CmxDialogTitle>
              <CmxDialogDescription>
                {t('confirmations.voidMessage', {
                  code:     pendingVoid.gift_card_code,
                  amount:   pendingVoid.available_amount.toFixed(3),
                  currency: pendingVoid.currency_code,
                })}
              </CmxDialogDescription>
            </CmxDialogHeader>
            <CmxDialogFooter>
              <CmxButton variant="outline" onClick={() => setPendingVoid(null)}>
                {tCommon('cancel')}
              </CmxButton>
              <CmxButton variant="destructive" onClick={handleVoidConfirm} disabled={isPending}>
                {t('actions.voidCard')}
              </CmxButton>
            </CmxDialogFooter>
          </CmxDialogContent>
        </CmxDialog>
      )}

      {/* Issue dialog (GENERATED status) */}
      <GiftCardIssueDialog
        open={showIssueDialog}
        onClose={() => setShowIssueDialog(false)}
        onSuccess={() => { setShowIssueDialog(false); refetch(); }}
      />

      {/* Sell dialog (SOLD + auto-activate) */}
      <GiftCardSellDialog
        open={showSellDialog}
        onOpenChange={setShowSellDialog}
        onSuccess={() => { setShowSellDialog(false); refetch(); }}
      />

      {/* Detail dialog */}
      {selectedCard && (
        <GiftCardDetailDialog
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onSuccess={() => { setSelectedCard(null); refetch(); }}
        />
      )}
    </div>
  );
}

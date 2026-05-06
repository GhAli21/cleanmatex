'use client';

/**
 * Gift Cards List Screen
 *
 * Displays paginated gift cards with search, status filter, and row actions.
 */

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { PlusCircle, Search, XCircle, Settings2 } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxInput } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxDataTable } from '@ui/data-display';
import { useGiftCards } from '../hooks/use-gift-cards';
import type { GiftCard, GiftCardStatus } from '@/lib/types/payment';
import { GiftCardIssueDialog } from './gift-card-issue-dialog';
import { GiftCardDetailDialog } from './gift-card-detail-dialog';

const STATUS_BADGE: Record<GiftCardStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  active: 'default',
  used: 'secondary',
  expired: 'secondary',
  cancelled: 'destructive',
  suspended: 'outline',
};

export function GiftCardListScreen() {
  const t = useTranslations('marketing.giftCards');
  const tCommon = useTranslations('common');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<GiftCardStatus | undefined>(undefined);
  const [page, setPage] = useState(1);

  const [showIssueDialog, setShowIssueDialog] = useState(false);
  const [selectedCard, setSelectedCard] = useState<GiftCard | null>(null);

  const { giftCards, total, isLoading, refetch } = useGiftCards({ search, status, page });

  const handleCancel = useCallback(
    async (id: string) => {
      const reason = window.prompt(t('cancel'));
      if (!reason) return;
      const { cancelGiftCard } = await import('@/app/actions/marketing/gift-card-actions');
      await cancelGiftCard(id, reason);
      refetch();
    },
    [refetch, t]
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xl font-semibold">{t('title')}</h2>
        <CmxButton
          variant="default"
          size="sm"
          onClick={() => setShowIssueDialog(true)}
          icon={<PlusCircle className="h-4 w-4" />}
        >
          {t('issue')}
        </CmxButton>
      </div>

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
        {(['active', 'used', 'expired', 'cancelled'] as GiftCardStatus[]).map((s) => (
          <CmxButton
            key={s}
            variant={status === s ? 'default' : 'outline'}
            size="sm"
            onClick={() => { setStatus((prev) => prev === s ? undefined : s); setPage(1); }}
          >
            {t(`status.${s}`)}
          </CmxButton>
        ))}
      </div>

      <CmxDataTable
        isLoading={isLoading}
        columns={[
          {
            key: 'card_number',
            header: t('fields.cardNumber'),
            render: (row: GiftCard) => <span className="font-mono">{row.card_number}</span>,
          },
          { key: 'card_name', header: t('fields.cardName'), render: (row: GiftCard) => row.card_name },
          {
            key: 'current_balance',
            header: t('fields.balance'),
            render: (row: GiftCard) => row.current_balance.toFixed(3),
          },
          {
            key: 'status',
            header: tCommon('status'),
            render: (row: GiftCard) => (
              <Badge variant={STATUS_BADGE[row.status]}>
                {t(`status.${row.status}`)}
              </Badge>
            ),
          },
          {
            key: 'expiry_date',
            header: t('fields.expiryDate'),
            render: (row: GiftCard) =>
              row.expiry_date ? new Date(row.expiry_date).toLocaleDateString() : '—',
          },
          {
            key: 'actions',
            header: tCommon('actions'),
            render: (row: GiftCard) => (
              <div className="flex gap-1">
                <CmxButton
                  variant="ghost"
                  size="icon"
                  title={t('detail')}
                  onClick={() => setSelectedCard(row)}
                >
                  <Settings2 className="h-4 w-4" />
                </CmxButton>
                {row.status === 'active' && (
                  <CmxButton
                    variant="ghost"
                    size="icon"
                    title={t('cancel')}
                    onClick={() => handleCancel(row.id)}
                  >
                    <XCircle className="h-4 w-4" />
                  </CmxButton>
                )}
              </div>
            ),
          },
        ]}
        data={giftCards}
        totalCount={total}
        currentPage={page}
        pageSize={25}
        onPageChange={setPage}
      />

      <GiftCardIssueDialog
        open={showIssueDialog}
        onClose={() => setShowIssueDialog(false)}
        onSuccess={() => { setShowIssueDialog(false); refetch(); }}
      />

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

/**
 * Piece History Component
 * Displays audit trail for piece status changes
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxCard } from '@ui/primitives';
import { CmxButton } from '@ui/primitives';
import { Clock, User } from 'lucide-react';
import { formatDateTime } from '@/lib/utils/rtl';

/**
 *
 */
export interface PieceHistoryEntry {
  id: string;
  action: string;
  fromValue: string | null;
  toValue: string | null;
  doneBy: string;
  doneAt: string | Date;
  notes?: string;
}

/**
 *
 */
export interface PieceHistoryProps {
  pieceId: string;
  tenantId: string;
}

/**
 *
 * @param root0
 * @param root0.pieceId
 * @param root0.tenantId
 */
export function PieceHistory({ pieceId, tenantId: _tenantId }: PieceHistoryProps) {
  const t = useTranslations('orders.pieces');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const [history, setHistory] = React.useState<PieceHistoryEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadHistory = React.useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/v1/orders/pieces/${encodeURIComponent(pieceId)}/history`, {
        credentials: 'include',
        cache: 'no-store',
      });
      const json = (await res.json()) as {
        success?: boolean;
        history?: PieceHistoryEntry[];
        error?: string;
      };
      if (!res.ok || !json.success) {
        setError(json.error || t('errors.loadFailed'));
        setHistory([]);
        return;
      }
      setHistory(Array.isArray(json.history) ? json.history : []);
    } catch {
      setError(t('errors.loadFailed'));
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [pieceId, t]);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  if (loading) {
    return <div className="text-sm text-gray-500">{tCommon('loading')}</div>;
  }

  if (error) {
    return (
      <div className={`space-y-2 ${isRTL ? 'text-right' : 'text-left'}`}>
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
        <CmxButton type="button" variant="outline" size="sm" onClick={() => void loadHistory()}>
          {t('errors.retry')}
        </CmxButton>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
        {t('noHistory')}
      </div>
    );
  }

  return (
    <ul className="space-y-2 list-none p-0 m-0" aria-label={t('historyTitle')}>
      {history.map((entry) => {
        const at =
          typeof entry.doneAt === 'string' ? new Date(entry.doneAt) : entry.doneAt;
        return (
          <li key={entry.id}>
            <CmxCard className="p-3">
              <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-start gap-3`}>
                <div className="flex-shrink-0">
                  <Clock className="h-4 w-4 text-gray-400" aria-hidden />
                </div>
                <div className={`flex-1 min-w-0 ${isRTL ? 'text-right' : 'text-left'}`}>
                  <div className="text-sm font-medium text-gray-900 break-words">
                    {entry.action}
                    {entry.fromValue != null &&
                      entry.toValue != null &&
                      entry.fromValue !== entry.toValue && (
                        <span className="text-gray-500">
                          {' '}
                          : {entry.fromValue} → {entry.toValue}
                        </span>
                      )}
                  </div>
                  <div
                    className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center gap-2 mt-1 text-xs text-gray-500 flex-wrap`}
                  >
                    <User className="h-3 w-3 flex-shrink-0" aria-hidden />
                    <span className="break-all">{entry.doneBy}</span>
                    <span aria-hidden>•</span>
                    <time dateTime={at.toISOString()}>{formatDateTime(at)}</time>
                  </div>
                  {entry.notes && (
                    <div className="mt-1 text-xs text-gray-600 break-words">{entry.notes}</div>
                  )}
                </div>
              </div>
            </CmxCard>
          </li>
        );
      })}
    </ul>
  );
}

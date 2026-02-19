/**
 * Piece History Component
 * Displays audit trail for piece status changes
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxCard } from '@ui/primitives';
import { Clock, User } from 'lucide-react';
import { formatDateTime } from '@/lib/utils/rtl';

export interface PieceHistoryEntry {
  id: string;
  action: string;
  fromValue: string | null;
  toValue: string | null;
  doneBy: string;
  doneAt: Date;
  notes?: string;
}

export interface PieceHistoryProps {
  pieceId: string;
  tenantId: string;
}

export function PieceHistory({ pieceId, tenantId }: PieceHistoryProps) {
  const t = useTranslations('orders.pieces');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const [history, setHistory] = React.useState<PieceHistoryEntry[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    loadHistory();
  }, [pieceId]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      // TODO: Implement history API endpoint when piece_history table is created
      // const response = await fetch(`/api/v1/orders/.../pieces/${pieceId}/history`);
      // const data = await response.json();
      // setHistory(data.history || []);
      setHistory([]); // Placeholder until history table is implemented
    } catch (error) {
      console.error('Failed to load piece history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-500">{tCommon('loading')}</div>;
  }

  if (history.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}>
        {t('noHistory') || 'No history available'}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {history.map((entry) => (
        <CmxCard key={entry.id} className="p-3">
          <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-start gap-3`}>
            <div className="flex-shrink-0">
              <Clock className="h-4 w-4 text-gray-400" />
            </div>
            <div className={`flex-1 ${isRTL ? 'text-right' : 'text-left'}`}>
              <div className="text-sm font-medium text-gray-900">
                {entry.action}
                {entry.fromValue && entry.toValue && (
                  <span className="text-gray-500">
                    {' '}: {entry.fromValue} → {entry.toValue}
                  </span>
                )}
              </div>
              <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center gap-2 mt-1 text-xs text-gray-500`}>
                <User className="h-3 w-3" />
                <span>{entry.doneBy}</span>
                <span>•</span>
                <span>{formatDateTime(entry.doneAt)}</span>
              </div>
              {entry.notes && (
                <div className="mt-1 text-xs text-gray-600">{entry.notes}</div>
              )}
            </div>
          </div>
        </CmxCard>
      ))}
    </div>
  );
}


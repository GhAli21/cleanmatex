/**
 * Amount Mismatch Dialog
 * Shown when server-calculated totals differ from client-reported totals.
 * User must refresh or retry to proceed with correct amounts.
 */

'use client';

import { useTranslations } from 'next-intl';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import type { AmountMismatchDifferences } from '@/lib/types/payment';

interface AmountMismatchDialogProps {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  message?: string;
  differences?: AmountMismatchDifferences;
}


export function AmountMismatchDialog({
  open,
  onClose,
  onRefresh,
  message,
  differences = {},
}: AmountMismatchDialogProps) {
  const t = useTranslations('amountMismatch');
  const isRTL = useRTL();

  if (!open) return null;

  const entries = Object.entries(differences).filter(
    (entry): entry is [string, { client: number; server: number }] =>
      entry[1] != null && typeof entry[1] === 'object' && 'client' in entry[1] && 'server' in entry[1]
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <header className={`flex items-center gap-3 p-4 border-b border-gray-200 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <AlertCircle className="w-8 h-8 text-amber-500 flex-shrink-0" />
          <h2 className={`flex-1 font-bold text-lg text-gray-900 ${isRTL ? 'text-right' : 'text-left'}`}>
            {t('title')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"
            aria-label={t('cancel')}
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-4 space-y-4">
          <p className={`text-gray-600 text-sm ${isRTL ? 'text-right' : 'text-left'}`}>
            {message ?? t('message')}
          </p>

          {entries.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className={`py-2 px-3 font-semibold text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('field')}
                    </th>
                    <th className={`py-2 px-3 font-semibold text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('yourValue')}
                    </th>
                    <th className={`py-2 px-3 font-semibold text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                      {t('serverValue')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(([field, { client, server }]) => (
                    <tr key={field} className="border-b border-gray-100 last:border-b-0">
                      <td className={`py-2 px-3 text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {t(`fields.${field}` as any) || field}
                      </td>
                      <td className={`py-2 px-3 text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {client.toFixed(3)}
                      </td>
                      <td className={`py-2 px-3 text-gray-600 ${isRTL ? 'text-right' : 'text-left'}`}>
                        {server.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className={`flex gap-2 pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button
              type="button"
              onClick={onRefresh}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              {t('refreshPage')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 hover:bg-gray-50 rounded-lg font-medium"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

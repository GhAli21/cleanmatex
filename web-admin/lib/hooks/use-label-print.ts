'use client';

/**
 * useLabelPrint - fetch label data for an order and print the order label or piece tags (HFC P4, T4.4).
 *
 * Data: GET /api/v1/orders/{id}/label-data (tenant-scoped, settings resolved per branch).
 * Printing: CmxLabelRenderer in a hidden iframe with @page sized from the label config (orderLabelSize / pieceTagSize).
 * Errors are shown as a toast in the user's language; the hook never throws.
 */
import { createElement, useCallback, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from '@/lib/hooks/useLocale';
import { showError } from '@ui/feedback';
import { CmxLabelRenderer, labelPageCss, type CmxLabelTexts, type LabelTemplate } from '@ui/print';
import type { LabelDataResult } from '@/lib/services/labels/label-types';
import { printReactInIframe } from '@/lib/utils/print/print-react-in-iframe';

export type LabelPieceSelection = 'all' | string[];

export async function fetchLabelData(orderId: string, pieces: 'none' | LabelPieceSelection): Promise<LabelDataResult> {
  const q = pieces === 'none' || pieces === 'all' ? pieces : pieces.join(',');
  const res = await fetch(`/api/v1/orders/${encodeURIComponent(orderId)}/label-data?pieces=${encodeURIComponent(q)}`, {
    cache: 'no-store',
    credentials: 'include',
  });
  const body = (await res.json().catch(() => null)) as {
    success?: boolean;
    data?: LabelDataResult;
  } | null;
  if (!res.ok || !body?.success || !body.data) throw new Error(`label-data ${res.status}`);
  return body.data;
}

export function useLabelPrint() {
  const t = useTranslations('labels');
  const locale = useLocale() === 'ar' ? 'ar' : 'en';
  const [printing, setPrinting] = useState<LabelTemplate | null>(null);

  const texts = useMemo<CmxLabelTexts>(
    () => ({
      order: t('template.order'),
      readyBy: t('template.readyBy'),
      tbd: t('template.tbd'),
      items: t('template.items'),
      pieces: t('template.pieces'),
      customer: t('template.customer'),
      tag: t('template.tag'),
      orderBarcode: t('template.orderBarcode'),
      pieceBarcode: t('template.pieceBarcode'),
      staffQr: t('template.staffQr'),
      pieceOf: (seq, total) => t('template.pieceOf', { seq, total }),
      formatDate: (iso) =>
        new Date(iso).toLocaleString(locale === 'ar' ? 'ar-OM' : 'en-GB', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
    }),
    [t, locale],
  );

  const run = useCallback(
    async (template: LabelTemplate, orderId: string, pieces: 'none' | LabelPieceSelection) => {
      setPrinting(template);
      try {
        let data: LabelDataResult;
        try {
          data = await fetchLabelData(orderId, pieces);
        } catch {
          showError(t('errors.loadFailed'));
          return false;
        }
        if (template === 'piece-tag' && data.pieces.length === 0) {
          showError(t('errors.noPieces'));
          return false;
        }
        const size = template === 'order-label' ? data.settings.orderLabelSize : data.settings.pieceTagSize;
        try {
          await printReactInIframe(
            createElement(CmxLabelRenderer, {
              template,
              order: data.order,
              pieces: data.pieces,
              settings: data.settings,
              texts,
              locale,
            }),
            {
              css: labelPageCss(template, size),
              dir: locale === 'ar' ? 'rtl' : 'ltr',
              lang: locale,
              title: data.order.orderNo,
            },
          );
        } catch {
          showError(t('errors.printFailed'));
          return false;
        }
        return true;
      } finally {
        setPrinting(null);
      }
    },
    [t, texts, locale],
  );

  const printOrderLabel = useCallback((orderId: string) => run('order-label', orderId, 'none'), [run]);
  const printPieceTags = useCallback(
    (orderId: string, pieces: LabelPieceSelection = 'all') => run('piece-tag', orderId, pieces),
    [run],
  );

  return { printOrderLabel, printPieceTags, printing };
}

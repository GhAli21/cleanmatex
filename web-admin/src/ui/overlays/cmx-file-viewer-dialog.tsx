/**
 * CmxFileViewerDialog — full-size viewer: images with zoom, PDF in the browser viewer, audio and
 * video players, and download for everything else (never rendered inline). Arrow keys move
 * between files (mirrored in RTL); +/- zoom images.
 * @module ui/overlays
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxButton } from '@ui/primitives/cmx-button';
import type { CmxFileItem } from '@ui/data-display/cmx-file-gallery';
import { CmxDialog, CmxDialogContent, CmxDialogDescription, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from './cmx-dialog';

export interface CmxFileViewerDialogProps {
  items: CmxFileItem[];
  /** Index of the shown file; null = closed. */
  index: number | null;
  onIndexChange: (index: number | null) => void;
}

/**
 * Adds Supabase Storage's `download` parameter so the browser saves the file under its own name
 * (cross-origin links ignore the `download` attribute).
 */
function downloadUrl(item: CmxFileItem): string {
  return `${item.url}${item.url.includes('?') ? '&' : '?'}download=${encodeURIComponent(item.name)}`;
}

/**
 * Viewer dialog over a list of files.
 * @param props see CmxFileViewerDialogProps
 */
export function CmxFileViewerDialog({ items, index, onIndexChange }: CmxFileViewerDialogProps) {
  const t = useTranslations('common.files');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const [zoom, setZoom] = React.useState(1);
  const item = index === null ? null : items[index] ?? null;

  const go = React.useCallback(
    (step: number) => {
      if (index === null || items.length < 2) return;
      setZoom(1);
      onIndexChange((index + step + items.length) % items.length);
    },
    [index, items.length, onIndexChange],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    // In RTL the "next" file is on the left.
    if (e.key === 'ArrowRight') go(isRTL ? -1 : 1);
    else if (e.key === 'ArrowLeft') go(isRTL ? 1 : -1);
    else if (item?.previewMode === 'IMAGE' && (e.key === '+' || e.key === '=')) setZoom((z) => Math.min(4, z * 1.5));
    else if (item?.previewMode === 'IMAGE' && e.key === '-') setZoom((z) => Math.max(1, z / 1.5));
  };

  return (
    <CmxDialog open={item !== null} onOpenChange={(open) => !open && (setZoom(1), onIndexChange(null))}>
      <CmxDialogContent className="max-w-5xl" bodyPadding="compact" onKeyDown={onKeyDown}>
        {item && (
          <>
            <CmxDialogHeader>
              <CmxDialogTitle className="truncate">{item.name}</CmxDialogTitle>
              <CmxDialogDescription>
                {[item.label, items.length > 1 ? t('position', { current: (index ?? 0) + 1, total: items.length }) : null].filter(Boolean).join(' · ')}
              </CmxDialogDescription>
            </CmxDialogHeader>

            <div className="flex max-h-[70vh] min-h-[40vh] items-center justify-center overflow-auto rounded-[var(--cmx-radius-md,0.375rem)] bg-muted">
              {item.previewMode === 'IMAGE' && (
                <img
                  src={item.url}
                  alt={item.name}
                  style={{ transform: `scale(${zoom})` }}
                  className="max-h-[70vh] max-w-full origin-center object-contain transition-transform"
                  onClick={() => setZoom((z) => (z > 1 ? 1 : 2))}
                />
              )}
              {item.previewMode === 'PDF' && <iframe src={item.url} title={item.name} className="h-[70vh] w-full border-0" />}
              {item.previewMode === 'VIDEO' && <video src={item.url} controls className="max-h-[70vh] max-w-full" />}
              {item.previewMode === 'AUDIO' && <audio src={item.url} controls className="w-full max-w-md" />}
              {item.previewMode === 'DOWNLOAD' && <p className="p-6 text-center text-sm">{t('noPreview')}</p>}
            </div>
            {item.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-start">{item.notes}</p>}

            <CmxDialogFooter>
              {items.length > 1 && (
                <>
                  <CmxButton variant="outline" size="icon" onClick={() => go(-1)} aria-label={tCommon('previous')}>
                    {isRTL ? <ChevronRight className="h-4 w-4" aria-hidden /> : <ChevronLeft className="h-4 w-4" aria-hidden />}
                  </CmxButton>
                  <CmxButton variant="outline" size="icon" onClick={() => go(1)} aria-label={tCommon('next')}>
                    {isRTL ? <ChevronLeft className="h-4 w-4" aria-hidden /> : <ChevronRight className="h-4 w-4" aria-hidden />}
                  </CmxButton>
                </>
              )}
              {item.previewMode === 'IMAGE' && (
                <>
                  <CmxButton variant="outline" size="icon" onClick={() => setZoom((z) => Math.max(1, z / 1.5))} disabled={zoom <= 1} aria-label={t('zoomOut')}>
                    <ZoomOut className="h-4 w-4" aria-hidden />
                  </CmxButton>
                  <CmxButton variant="outline" size="icon" onClick={() => setZoom((z) => Math.min(4, z * 1.5))} disabled={zoom >= 4} aria-label={t('zoomIn')}>
                    <ZoomIn className="h-4 w-4" aria-hidden />
                  </CmxButton>
                </>
              )}
              <CmxButton asChild variant="secondary">
                <a href={downloadUrl(item)} rel="noopener noreferrer">
                  <Download className="h-4 w-4" aria-hidden />
                  {tCommon('download')}
                </a>
              </CmxButton>
              <CmxButton onClick={() => onIndexChange(null)}>{tCommon('close')}</CmxButton>
            </CmxDialogFooter>
          </>
        )}
      </CmxDialogContent>
    </CmxDialog>
  );
}

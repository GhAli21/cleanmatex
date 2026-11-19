/**
 * CmxFileGallery — grid of files with thumbnails (images) or type icons (others), lazy-loaded,
 * with open / edit / delete actions. Presentational: the caller supplies URLs and handles actions.
 * @module ui/data-display
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { FileText, FileVideo, File as FileIcon, Pencil, Trash2, Music } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxSkeleton } from '@ui/primitives/cmx-skeleton';

/** How a file is shown: mirrors `sys_file_preview_mode_cd`. */
export type CmxFilePreviewMode = 'IMAGE' | 'PDF' | 'AUDIO' | 'VIDEO' | 'DOWNLOAD';

/** One file as the gallery and viewer show it. */
export interface CmxFileItem {
  id: string;
  name: string;
  mimeType: string;
  /** Full file URL (signed or public). */
  url: string;
  /** Small preview for grids; falls back to `url` for images. */
  thumbUrl?: string | null;
  previewMode: CmxFilePreviewMode;
  /** Short label shown on the tile (e.g. the purpose). */
  label?: string;
  /** Where the file came from, under the label (e.g. "Preparation · Order details"). */
  meta?: string;
  /** User note, shown under the label. */
  notes?: string | null;
  sizeBytes?: number;
  /** Proof of a completed record: shown without edit/delete. */
  locked?: boolean;
}

export interface CmxFileGalleryProps {
  items: CmxFileItem[];
  loading?: boolean;
  /** Opens the viewer at this item. */
  onOpen?: (index: number) => void;
  onEdit?: (item: CmxFileItem) => void;
  onDelete?: (item: CmxFileItem) => void;
  /** Hides edit/delete. */
  readOnly?: boolean;
  /** Shown when there are no files. */
  emptyLabel?: string;
  className?: string;
}

/** Human file size (B, KB, MB) for tile captions. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function TypeIcon({ mode }: { mode: CmxFilePreviewMode }) {
  const Icon = mode === 'PDF' ? FileText : mode === 'VIDEO' ? FileVideo : mode === 'AUDIO' ? Music : FileIcon;
  return <Icon className="h-10 w-10 text-muted-foreground" aria-hidden />;
}

/**
 * Responsive file grid.
 * @param props see CmxFileGalleryProps
 */
export function CmxFileGallery({ items, loading, onOpen, onEdit, onDelete, readOnly, emptyLabel, className }: CmxFileGalleryProps) {
  const t = useTranslations('common.files');
  const grid = cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', className);

  if (loading) {
    return (
      <div className={grid} role="status" aria-label={t('loadingFiles')}>
        {Array.from({ length: 4 }, (_, i) => (
          <CmxSkeleton key={i} className="aspect-square w-full" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel ?? t('noFiles')}</p>;
  }

  return (
    <ul className={grid}>
      {items.map((item, index) => {
        const thumb = item.thumbUrl ?? (item.previewMode === 'IMAGE' ? item.url : null);
        return (
          <li
            key={item.id}
            className="group relative overflow-hidden rounded-[var(--cmx-radius-md,0.375rem)] border border-border bg-[rgb(var(--cmx-card-bg-rgb,255_255_255))]"
          >
            <button
              type="button"
              onClick={() => onOpen?.(index)}
              className="flex aspect-square w-full items-center justify-center bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              aria-label={t('openFile', { name: item.name })}
            >
              {thumb ? (
                <img src={thumb} alt={item.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : (
                <TypeIcon mode={item.previewMode} />
              )}
            </button>
            <div className="space-y-0.5 p-2 text-start">
              {item.label && <p className="truncate text-xs font-medium text-foreground">{item.label}</p>}
              {item.meta && (
                <p className="truncate text-[11px] text-muted-foreground" title={item.meta}>
                  {item.meta}
                </p>
              )}
              <p className="truncate text-xs text-muted-foreground" title={item.notes ?? item.name}>
                {item.notes || item.name}
              </p>
            </div>
            {!readOnly && !item.locked && (onEdit || onDelete) && (
              <div className="absolute end-1 top-1 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                {onEdit && (
                  <CmxButton size="icon" variant="secondary" className="h-7 w-7" onClick={() => onEdit(item)} aria-label={t('editFile', { name: item.name })}>
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </CmxButton>
                )}
                {onDelete && (
                  <CmxButton size="icon" variant="destructive" className="h-7 w-7" onClick={() => onDelete(item)} aria-label={t('deleteFile', { name: item.name })}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </CmxButton>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

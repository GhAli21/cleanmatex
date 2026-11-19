/**
 * CmxFileGallery — grid of files with thumbnails (images) or type icons (others), lazy-loaded,
 * with open / edit / delete actions. Presentational: the caller supplies URLs and handles actions.
 * @module ui/data-display
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { FileText, FileVideo, File as FileIcon, ImageIcon, Lock, Pencil, Trash2, Music } from 'lucide-react';
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
  return <Icon className="h-9 w-9 text-muted-foreground" aria-hidden />;
}

/** Upper-case extension for the type badge on non-image tiles ("report.pdf" → "PDF"). */
function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1, dot + 6).toUpperCase() : '';
}

/** Round, glass-like action button over a tile image. */
const ACTION = 'h-7 w-7 rounded-full shadow-sm';

/**
 * Responsive file grid. Each tile is a card: the image (or a type icon) with the file type as a
 * chip over it, then the note as the main text, the source line and the file name with its size.
 * @param props see CmxFileGalleryProps
 */
export function CmxFileGallery({ items, loading, onOpen, onEdit, onDelete, readOnly, emptyLabel, className }: CmxFileGalleryProps) {
  const t = useTranslations('common.files');
  const grid = cn('grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4', className);

  if (loading) {
    return (
      <div className={grid} role="status" aria-label={t('loadingFiles')}>
        {Array.from({ length: 4 }, (_, i) => (
          <CmxSkeleton key={i} className="h-48 w-full rounded-xl" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-8 text-center">
        <ImageIcon className="h-8 w-8 text-muted-foreground/60" aria-hidden />
        <p className="text-sm text-muted-foreground">{emptyLabel ?? t('noFiles')}</p>
      </div>
    );
  }

  return (
    <ul className={grid}>
      {items.map((item, index) => {
        const thumb = item.thumbUrl ?? (item.previewMode === 'IMAGE' ? item.url : null);
        const ext = extensionOf(item.name);
        const canAct = !readOnly && !item.locked && (onEdit || onDelete);
        return (
          <li
            key={item.id}
            className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-[rgb(var(--cmx-card-bg-rgb,255_255_255))] shadow-sm transition-shadow hover:shadow-md focus-within:shadow-md"
          >
            <div className="relative">
              <button
                type="button"
                onClick={() => onOpen?.(index)}
                className="relative block aspect-[4/3] w-full overflow-hidden bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                aria-label={t('openFile', { name: item.name })}
              >
                {thumb ? (
                  <img
                    src={thumb}
                    alt={item.name}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <span className="flex h-full w-full flex-col items-center justify-center gap-1.5">
                    <TypeIcon mode={item.previewMode} />
                    {ext && (
                      <span className="rounded-md bg-background px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted-foreground">{ext}</span>
                    )}
                  </span>
                )}
              </button>
              {item.label && (
                <span className="pointer-events-none absolute bottom-2 start-2 max-w-[calc(100%-1rem)] truncate rounded-full bg-foreground/70 px-2 py-0.5 text-[11px] font-medium text-background backdrop-blur-sm">
                  {item.label}
                </span>
              )}
              {item.locked && (
                <span
                  className="pointer-events-none absolute start-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground/70 text-background backdrop-blur-sm"
                  title={t('locked')}
                >
                  <Lock className="h-3 w-3" aria-hidden />
                  <span className="sr-only">{t('locked')}</span>
                </span>
              )}
              {canAct && (
                <div className="absolute end-2 top-2 flex gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                  {onEdit && (
                    <CmxButton size="icon" variant="secondary" className={ACTION} onClick={() => onEdit(item)} aria-label={t('editFile', { name: item.name })}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </CmxButton>
                  )}
                  {onDelete && (
                    <CmxButton size="icon" variant="destructive" className={ACTION} onClick={() => onDelete(item)} aria-label={t('deleteFile', { name: item.name })}>
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </CmxButton>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-2.5 text-start">
              {item.notes && (
                <p className="line-clamp-2 text-sm leading-snug text-foreground" title={item.notes}>
                  {item.notes}
                </p>
              )}
              {item.meta && (
                <p className="truncate text-[11px] text-muted-foreground" title={item.meta}>
                  {item.meta}
                </p>
              )}
              <p className="mt-auto flex items-center gap-1 pt-0.5 text-[11px] text-muted-foreground/80">
                <span className="truncate" title={item.name}>{item.name}</span>
                {item.sizeBytes ? <span className="shrink-0">· {formatFileSize(item.sizeBytes)}</span> : null}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

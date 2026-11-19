/**
 * Photos of one order piece or item (File Util ORDER_FILE, ref ORDER_PIECE or ORDER_ITEM): `PiecePhotosControl` puts a
 * small "Photos (n)" button under a piece (or under an item when the tenant does not track pieces) and opens a dialog to add / view / edit them. Counts for
 * all pieces of an order come from one shared list request (same cache entry as the order's
 * Files panel), however many pieces show the button.
 */

'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Camera } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { FileAttachments } from '@features/file-util';
import { fetchFiles } from '@features/file-util/api/file-util-api';
import { useAuth } from '@/lib/auth/auth-context';
import { useHasPermission } from '@/lib/hooks/use-has-permission';
import { FILE_CATEGORIES, FILE_REF_TYPES, type FileSourceCode } from '@/lib/constants/file-util';

/** Sub-records that can carry their own photos on the pieces screens. */
export type PhotoRefType = typeof FILE_REF_TYPES.ORDER_PIECE | typeof FILE_REF_TYPES.ORDER_ITEM;

/** Signed links live 5 minutes; match the Files widget. */
const FILES_STALE_MS = 4 * 60 * 1000;

/**
 * Number of READY photos per piece (or item) of an order, from one list call.
 * @param orderId order whose files to count
 * @param enabled false skips the request (no order, or no read permission)
 * @param refType which sub-record to count (default ORDER_PIECE)
 * @returns sub-record id → file count
 */
export function usePiecePhotoCounts(
  orderId: string | undefined,
  enabled: boolean,
  refType: PhotoRefType = FILE_REF_TYPES.ORDER_PIECE,
): Map<string, number> {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.tenant_id;
  // Same key as useFileAttachments for the whole order, so both share one request and one refresh.
  const files = useQuery({
    queryKey: ['file-util', 'files', tenantId, FILE_CATEGORIES.ORDER_FILE, orderId, null, null],
    queryFn: ({ signal }) => fetchFiles(FILE_CATEGORIES.ORDER_FILE, [orderId as string], undefined, signal),
    enabled: enabled && !!tenantId && !!orderId,
    staleTime: FILES_STALE_MS,
  });
  return useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of files.data ?? []) {
      if (f.refTypeCode === refType && f.refId) counts.set(f.refId, (counts.get(f.refId) ?? 0) + 1);
    }
    return counts;
  }, [files.data, refType]);
}


export interface PiecePhotosButtonProps {
  count: number;
  pieceLabel: string;
  onClick: () => void;
}

/**
 * Compact "Photos (n)" button shown under a piece card.
 * @param props count, accessible piece label, click handler
 */
export function PiecePhotosButton({ count, pieceLabel, onClick }: PiecePhotosButtonProps) {
  const t = useTranslations('fileUtil');
  return (
    <CmxButton
      type="button"
      size="sm"
      variant="ghost"
      className="h-8 gap-1.5 px-2 text-xs"
      onClick={onClick}
      aria-label={t('piecePhotosFor', { piece: pieceLabel, count })}
    >
      <Camera className="h-3.5 w-3.5" aria-hidden />
      {count > 0 ? t('piecePhotosCount', { count }) : t('piecePhotosAdd')}
    </CmxButton>
  );
}

export interface PiecePhotosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  /** Piece id, or item id when refType is ORDER_ITEM. */
  refId: string;
  /** Default ORDER_PIECE. */
  refType?: PhotoRefType;
  /** Piece code or item name shown in the title. */
  label: string;
  /** Screen the photos are taken on (e.g. FILE_SOURCES.ORDER_PROCESSING). */
  source: FileSourceCode;
}

/**
 * Photos of one piece or item; upload needs orders:update or orders:transition (server rule).
 * @param props dialog state, order, piece, source screen
 */
export function PiecePhotosDialog({
  open, onOpenChange, orderId, refId, refType = FILE_REF_TYPES.ORDER_PIECE, label, source,
}: PiecePhotosDialogProps) {
  const t = useTranslations('fileUtil');
  const canUpdate = useHasPermission('orders', 'update');
  const canTransition = useHasPermission('orders', 'transition');
  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent className="max-w-3xl">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('piecePhotosTitle', { piece: label })}</CmxDialogTitle>
        </CmxDialogHeader>
        {open && (
          <FileAttachments
            category={FILE_CATEGORIES.ORDER_FILE}
            entityId={orderId}
            source={source}
            refType={refType}
            refId={refId}
            title={t('title')}
            readOnly={!(canUpdate || canTransition)}
          />
        )}
      </CmxDialogContent>
    </CmxDialog>
  );
}

export interface PiecePhotosControlProps {
  orderId: string;
  /** Piece id, or item id when refType is ORDER_ITEM. */
  refId: string;
  /** Default ORDER_PIECE; ORDER_ITEM for item photos when pieces are not tracked. */
  refType?: PhotoRefType;
  /** Piece code or item name, for the button label and dialog title. */
  label: string;
  /** Screen the photos are taken on (e.g. FILE_SOURCES.ORDER_PROCESSING). */
  source: FileSourceCode;
}

/**
 * Button with the photo count under one piece or item, plus its photo dialog. Renders nothing for users
 * without orders:read (FILE_CATEGORY_ACCESS.ORDER_FILE.read).
 * @param props order, piece, label, source screen
 */
export function PiecePhotosControl({
  orderId, refId, refType = FILE_REF_TYPES.ORDER_PIECE, label, source,
}: PiecePhotosControlProps) {
  const canRead = useHasPermission('orders', 'read');
  const counts = usePiecePhotoCounts(orderId, canRead, refType);
  const [open, setOpen] = useState(false);
  if (!canRead) return null;
  return (
    <div className="flex justify-end pt-1">
      <PiecePhotosButton count={counts.get(refId) ?? 0} pieceLabel={label} onClick={() => setOpen(true)} />
      {open && (
        <PiecePhotosDialog
          open
          onOpenChange={setOpen}
          orderId={orderId}
          refId={refId}
          refType={refType}
          label={label}
          source={source}
        />
      )}
    </div>
  );
}

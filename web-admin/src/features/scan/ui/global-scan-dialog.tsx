'use client';

/**
 * GlobalScanDialog - "find by scan" for any order number, line code, piece code, staff QR or tag (HFC P3b, T3.10).
 * Calls POST /api/v1/scan/resolve, shows what was found and opens the order (with `?piece=` for a piece).
 * Pieces that are still live can get a tag linked from here.
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogDescription,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { CmxScanInput, type CmxScanStatus } from '@ui/forms';
import { CmxCodeChip } from '@ui/data-display';
import type { ScanResult } from '@/lib/services/scan-resolve/scan-resolve.service';
import { resolveScan, scanResultHref, type ApiErrorBody } from '../api/scan-api';
import { LinkTagDialog } from './link-tag-dialog';

const KNOWN_ERRORS = ['SCAN_NOT_FOUND', 'SCAN_AMBIGUOUS', 'SCAN_UNSUPPORTED_PAYLOAD', 'SCAN_INVALID', 'VALIDATION_ERROR'];

export interface GlobalScanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** A code read by the page-wide scanner before the dialog opened; it is looked up at once. */
  initialCode?: string | null;
}

export function GlobalScanDialog({ open, onOpenChange, initialCode }: GlobalScanDialogProps) {
  // The body mounts per open (and per page-wide scan), so its state starts fresh without reset effects.
  if (!open) return null;
  return <GlobalScanBody key={initialCode ?? ''} onOpenChange={onOpenChange} initialCode={initialCode ?? null} />;
}

function GlobalScanBody({
  onOpenChange,
  initialCode,
}: {
  onOpenChange: (open: boolean) => void;
  initialCode: string | null;
}) {
  const t = useTranslations('scan');
  const tCodes = useTranslations('codes');
  const router = useRouter();
  const [result, setResult] = React.useState<ScanResult | null>(null);
  const [status, setStatus] = React.useState<CmxScanStatus | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [linkOpen, setLinkOpen] = React.useState(false);

  const errorText = React.useCallback(
    (httpStatus: number, body: ApiErrorBody): string => {
      if (httpStatus === 429) return t('errors.rateLimited');
      if (body.code && KNOWN_ERRORS.includes(body.code)) return t(`errors.${body.code}`);
      return t('errors.failed');
    },
    [t],
  );

  const lookUp = React.useCallback(
    async (raw: string) => {
      setBusy(true);
      setStatus({ tone: 'info', message: t('dialog.searching') });
      try {
        const outcome = await resolveScan(raw);
        if (outcome.ok === false) {
          setResult(null);
          setStatus({ tone: 'error', message: errorText(outcome.status, outcome.body) });
          return;
        }
        setResult(outcome.data);
        setStatus({ tone: 'success', message: t('result.found', { code: outcome.data.code }) });
      } catch {
        setResult(null);
        setStatus({ tone: 'error', message: t('errors.failed') });
      } finally {
        setBusy(false);
      }
    },
    [errorText, t],
  );

  const lookUpRef = React.useRef(lookUp);
  React.useEffect(() => {
    lookUpRef.current = lookUp;
  }, [lookUp]);

  // Looks up the page-wide scan once on mount, not when translations change.
  React.useEffect(() => {
    if (initialCode) void lookUpRef.current(initialCode);
  }, [initialCode]);

  const openResult = () => {
    if (!result) return;
    onOpenChange(false);
    router.push(scanResultHref(result));
  };

  const piece = result?.piece;
  const canLinkTag = Boolean(piece && !piece.removed);

  return (
    <>
      <CmxDialog open={!linkOpen} onOpenChange={onOpenChange}>
        <CmxDialogContent className="text-start" data-testid="global-scan-dialog">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('dialog.title')}</CmxDialogTitle>
            <CmxDialogDescription>{t('dialog.description')}</CmxDialogDescription>
          </CmxDialogHeader>
          <div className="space-y-4">
            <CmxScanInput
              label={t('dialog.inputLabel')}
              placeholder={t('dialog.placeholder')}
              submitLabel={t('dialog.submit')}
              emptyMessage={t('dialog.empty')}
              status={status}
              busy={busy}
              onScan={lookUp}
              autoFocus
              dedupeMs={0}
            />
            {result ? (
              <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 rounded-md border border-gray-200 p-3 text-sm">
                <dt className="text-gray-600">{tCodes('orderNo')}</dt>
                <dd className="flex flex-wrap items-center gap-2">
                  <CmxCodeChip code={result.order.orderNo} kind="order" />
                  {result.order.parentOrderNo ? (
                    <span className="text-xs text-gray-500">
                      {tCodes('partOf', { orderNo: result.order.parentOrderNo })}
                    </span>
                  ) : null}
                </dd>
                {result.order.status ? (
                  <>
                    <dt className="text-gray-600">{t('result.status')}</dt>
                    <dd>{result.order.status}</dd>
                  </>
                ) : null}
                {result.item?.srno ? (
                  <>
                    <dt className="text-gray-600">{tCodes('lineCode')}</dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      <CmxCodeChip code={result.item.srno} kind="item" />
                      {result.item.name ? <span>{result.item.name}</span> : null}
                    </dd>
                  </>
                ) : null}
                {piece?.pieceCode ? (
                  <>
                    <dt className="text-gray-600">{tCodes('pieceCode')}</dt>
                    <dd>
                      <CmxCodeChip code={piece.pieceCode} kind="piece" />
                    </dd>
                  </>
                ) : null}
                {piece ? (
                  <>
                    <dt className="text-gray-600">{tCodes('tag')}</dt>
                    <dd className="flex flex-wrap items-center gap-2">
                      {piece.externalTag ? <CmxCodeChip code={piece.externalTag} kind="tag" /> : <span>—</span>}
                      {result.matchedBy === 'EXTERNAL_TAG' ? (
                        <span className="text-xs text-gray-500">{t('result.matchedByTag')}</span>
                      ) : null}
                    </dd>
                  </>
                ) : null}
                {piece?.removed ? (
                  <p className="col-span-2 text-sm text-amber-700" role="note">
                    {t('result.removed')}
                  </p>
                ) : null}
              </dl>
            ) : null}
          </div>
          <CmxDialogFooter>
            {canLinkTag ? (
              <CmxButton type="button" variant="outline" className="min-h-11" onClick={() => setLinkOpen(true)}>
                {piece?.externalTag ? t('dialog.changeTag') : t('dialog.linkTag')}
              </CmxButton>
            ) : null}
            {result ? (
              <CmxButton type="button" className="min-h-11" onClick={openResult}>
                {piece ? t('dialog.openPiece') : t('dialog.openOrder')}
              </CmxButton>
            ) : null}
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
      {piece ? (
        <LinkTagDialog
          open={linkOpen}
          onOpenChange={setLinkOpen}
          pieceId={piece.id}
          pieceCode={piece.pieceCode}
          currentTag={piece.externalTag}
          onSaved={(saved) =>
            setResult((prev) =>
              prev?.piece ? { ...prev, piece: { ...prev.piece, externalTag: saved.externalTag } } : prev,
            )
          }
        />
      ) : null}
    </>
  );
}

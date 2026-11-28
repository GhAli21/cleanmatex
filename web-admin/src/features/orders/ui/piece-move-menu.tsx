/**
 * Moving a piece between lines of one product (Cart Line Grouping P3,
 * docs/features/Order_Cart_Line_Grouping/DESIGN.md §5). One menu for the cart line header, the cart's
 * piece rows and the piece lists of steps 2–4; the rules live in the model, reducer and state hook.
 */

'use client';

import { useRef } from 'react';
import { useTranslations } from 'next-intl';
import { ArrowRightLeft } from 'lucide-react';
import { CmxButton, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@ui/primitives';
import { cmxMessage } from '@ui/feedback';
import { cn } from '@/lib/utils';
import { useBilingual } from '@/lib/utils/bilingual';
import { packingPreferencePriceMap } from '@/lib/utils/order-packing-charges';
import { useNewOrderStateWithDispatch } from '../hooks/use-new-order-state';
import { usePreferenceCatalog } from '../hooks/use-preference-catalog';
import { isMovableLine, pieceMoveTargets, productLineNumber } from '../model/cart-line-grouping';
import type { LineKey, OrderItem } from '../model/new-order-types';

interface PieceMoveMenuProps {
  lineKey: LineKey;
  /** The piece to move; omitted on a line header, which moves the line's last piece. */
  pieceId?: string;
  /** The piece's number, for the button's accessible name. */
  pieceNumber?: number;
  /** Runs after a move with the receiving line and the piece's new id (e.g. to expand that line). */
  onMoved?: (lineKey: LineKey, pieceId?: string) => void;
}

/** Message keys explaining which line price rules a move leaves behind or takes on (rule: no silent price change). */
const LINE_RULES: { has: (line: OrderItem) => boolean; leaves: string; takes: string }[] = [
  { has: (line) => line.priceOverride != null, leaves: 'leavesPrice', takes: 'takesPrice' },
  { has: (line) => Boolean(line.lineDiscount), leaves: 'leavesDiscount', takes: 'takesDiscount' },
  { has: (line) => line.serviceSpeed != null, leaves: 'leavesSpeed', takes: 'takesSpeed' },
];

/** The trigger a moved piece (or its new line's header) can be focused by. */
const focusKey = (lineKey: LineKey, pieceId?: string) => pieceId ?? `line:${lineKey}`;

/**
 * A row menu with "Move to a new line" and "Move to line N". Renders nothing when the line can't move pieces.
 * @param props the line, optionally the piece, and a callback after a move
 * @returns the menu, or null
 */
export function PieceMoveMenu({ lineKey, pieceId, pieceNumber, onMoved }: PieceMoveMenuProps) {
  const t = useTranslations('newOrder.lines');
  const getBilingual = useBilingual();
  const { state, pieceMoveBlock, movePiece } = useNewOrderStateWithDispatch();
  const { packingPrefs } = usePreferenceCatalog(state.branchId);
  const moved = useRef(false);

  const line = state.items.find((item) => item.lineKey === lineKey);
  if (!line || !isMovableLine(line)) return null;
  const targets = pieceMoveTargets(state.items, lineKey);
  // The only piece of a line has nowhere new to go: its line is already its own.
  const canStartLine = line.quantity >= 2;
  if (!canStartLine && targets.length === 0) return null;

  const lineNumber = productLineNumber(state.items, lineKey);
  const baseName = getBilingual(line.productName, line.productName2) || '—';
  const name = lineNumber ? `${baseName} · ${t('lineNumber', { number: lineNumber })}` : baseName;
  const label = pieceNumber != null
    ? t('movePieceFor', { piece: pieceNumber, item: name })
    : t('moveOneShareFor', { item: name });

  const move = (toLineKey?: LineKey) => {
    const result = movePiece(lineKey, { pieceId, toLineKey, packingPriceByCode: packingPreferencePriceMap(packingPrefs) });
    if (result.status !== 'OK') {
      cmxMessage.warning(t(result.status === 'SAVED_PIECE' ? 'savedPieceCannotMove' : 'moveBlocked'));
      return;
    }
    cmxMessage.success(t('movedToLine', { number: result.lineNumber }));
    moved.current = true;
    onMoved?.(result.lineKey, result.pieceId);
    // Focus follows the piece to its new row (or its new line's header); that row renders first.
    const key = focusKey(result.lineKey, pieceId ? result.pieceId : undefined);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-piece-move="${key}"]`)?.focus());
  };

  const leaving = LINE_RULES.filter((rule) => rule.has(line)).map((rule) => t(rule.leaves, { number: lineNumber ?? 1 }));

  const option = (text: string, notes: string[], toLineKey?: LineKey) => {
    const block = pieceMoveBlock(lineKey, pieceId, toLineKey);
    const shown = block ? [t(block === 'SAVED_PIECE' ? 'savedPieceCannotMove' : 'moveBlocked')] : notes;
    return (
      <DropdownMenuItem
        key={toLineKey ?? 'new'}
        // aria-disabled, not disabled: a disabled item is skipped by the keyboard and its reason never read.
        // Choosing it moves nothing and repeats the reason.
        aria-disabled={block != null || undefined}
        onSelect={() => move(toLineKey)}
        className={cn('flex-col items-start gap-0.5 text-start pointer-coarse:min-h-11', block != null && 'opacity-60')}
      >
        <span>{text}</span>
        {shown.map((note) => <span key={note} className="max-w-64 text-xs text-muted-foreground">{note}</span>)}
      </DropdownMenuItem>
    );
  };

  return (
    // Not modal: the focus trap would pull focus back while the menu closes.
    <DropdownMenu modal={false} onOpenChange={(open) => { if (open) moved.current = false; }}>
      <DropdownMenuTrigger asChild>
        <CmxButton
          type="button"
          variant="ghost"
          size="xs"
          className="h-auto shrink-0 p-0.5 text-muted-foreground hover:text-primary-text pointer-coarse:min-h-11 pointer-coarse:min-w-11"
          title={label}
          aria-label={label}
          data-piece-move={focusKey(lineKey, pieceId)}
          // Piece rows are clickable; opening the menu must not also select the row.
          onClick={(event) => event.stopPropagation()}
        >
          <ArrowRightLeft className="h-3 w-3" />
        </CmxButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        onClick={(event) => event.stopPropagation()}
        // After a move, focus must not return to this trigger.
        onCloseAutoFocus={(event) => { if (moved.current) event.preventDefault(); }}
      >
        {canStartLine
          ? option(
            pieceId ? t('moveToNewLine') : t('moveOneShare'),
            [...leaving, ...(state.isEditMode && line.persistedItemId ? [t('newLineTodaysPrice')] : [])],
          )
          : null}
        {targets.map((target) => {
          const number = productLineNumber(state.items, target.lineKey) ?? 1;
          const taking = LINE_RULES.filter((rule) => rule.has(target)).map((rule) => t(rule.takes, { number }));
          return option(t('moveToLine', { number }), [...leaving, ...taking], target.lineKey);
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * At item commercial level a piece has no speed, price or discount of its own; this says how to get one (§5.5).
 * @param props the line
 * @returns the hint, or null when the line has no piece that could move to a new line
 */
export function PieceMoveHint({ lineKey }: { lineKey: LineKey }) {
  const t = useTranslations('newOrder.lines');
  const { state } = useNewOrderStateWithDispatch();
  const line = state.items.find((item) => item.lineKey === lineKey);
  if (!line || !isMovableLine(line) || line.quantity < 2) return null;
  return <div className="border-t border-border pt-1 text-muted-foreground">{t('itemLevelHint')}</div>;
}

/**
 * Order Edit: a line started from a saved line is priced today, not at the agreed price (§4.4).
 * @param props the source line
 * @returns the note, or null outside Order Edit or for an unsaved line
 */
export function NewLinePriceNote({ lineKey }: { lineKey: LineKey }) {
  const t = useTranslations('newOrder.lines');
  const { state } = useNewOrderStateWithDispatch();
  const line = state.items.find((item) => item.lineKey === lineKey);
  if (!state.isEditMode || !line?.persistedItemId) return null;
  return <span className="block px-1 text-xs text-muted-foreground">{t('newLineTodaysPrice')}</span>;
}

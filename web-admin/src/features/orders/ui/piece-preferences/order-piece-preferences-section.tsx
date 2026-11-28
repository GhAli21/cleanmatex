/**
 * "Edit Items Preferences" wizard tab — vertical list of PiecePreferenceCard (no table).
 */

'use client';

import { useMemo, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { cmxMessage } from '@ui/feedback';
import { useNewOrderStateWithDispatch } from '@/src/features/orders/hooks/use-new-order-state';
import { useOrderWorkspaceSessionOptional } from '@/src/features/orders/order-change/order-workspace-session';
import type { PackingPreference, PreferenceKind, ServicePreference } from '@/lib/types/service-preferences';
import type { OrderItem } from '@/src/features/orders/model/new-order-types';
import { PieceMoveMenu } from '../piece-move-menu';
import { productLineNumber } from '@/src/features/orders/model/cart-line-grouping';
import { generatePiecesForItem } from '@/lib/utils/piece-helpers';
import { useNewOrderPiecePreferences } from '@/src/features/orders/hooks/use-new-order-piece-preferences';
import { useBilingual } from '@/lib/utils/bilingual';
import { PiecePreferenceCard } from './piece-preference-card';
import { EditControlNotice } from '@/src/features/orders/order-change/edit-control-notice';
import { useEditControlGroup } from '@/src/features/orders/order-change/use-edit-control-capability';

interface ConditionCatalog {
  stains: ServicePreference[];
  damages: ServicePreference[];
  colors: ServicePreference[];
}

/**
 *
 */
export interface OrderPiecePreferencesSectionProps {
  preferenceKinds: PreferenceKind[];
  prefsByKind: Map<string, ServicePreference[]>;
  packingPrefs: PackingPreference[];
  servicePrefsFallback: ServicePreference[];
  conditionCatalog: ConditionCatalog;
  kindsLoading: boolean;
  currencyCode: string;
  enforcePrefCompatibility?: boolean;
  /** Item to scroll to and highlight (product id or persisted item id), e.g. from the cart pencil. */
  focusItemId?: string | null;
  /** Called once the focus request has been applied, so the parent can clear it. */
  onFocusItemHandled?: () => void;
}

/** How long the focused item keeps its highlight ring. */
const FOCUS_HIGHLIGHT_MS = 2000;

/**
 *
 * @param root0
 * @param root0.preferenceKinds
 * @param root0.prefsByKind
 * @param root0.packingPrefs
 * @param root0.servicePrefsFallback
 * @param root0.conditionCatalog
 * @param root0.kindsLoading
 * @param root0.currencyCode
 * @param root0.enforcePrefCompatibility
 * @param root0.focusItemId
 * @param root0.onFocusItemHandled
 */
export function OrderPiecePreferencesSection({
  preferenceKinds,
  prefsByKind,
  packingPrefs,
  servicePrefsFallback,
  conditionCatalog,
  kindsLoading,
  currencyCode,
  enforcePrefCompatibility = false,
  focusItemId,
  onFocusItemHandled,
}: OrderPiecePreferencesSectionProps) {
  const t = useTranslations('newOrder.piecePreferences');
  const tLines = useTranslations('newOrder.lines');
  const { state, updateItemPieces } = useNewOrderStateWithDispatch();
  const editSession = useOrderWorkspaceSessionOptional();
  const {
    pieceToSelectedPreferences,
    removePreference,
    copySinglePreference,
    copyAllPreferences,
    updatePieceFields,
  } = useNewOrderPiecePreferences(packingPrefs);
  const getBilingual = useBilingual();
  const preferenceCapability = useEditControlGroup(['ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE']);

  useEffect(() => {
    if (editSession) return;
    for (const item of state.items) {
      if (item.quantity <= 0) continue;
      const ok = item.pieces && item.pieces.length === item.quantity;
      if (!ok) {
        updateItemPieces(item.lineKey, generatePiecesForItem(item.lineKey, item.quantity));
      }
    }
  }, [editSession, state.items, updateItemPieces]);

  const itemGroups = useMemo(() => {
    return state.items.map((item: OrderItem) => {
      const pieces =
        item.pieces && item.pieces.length > 0
          ? item.pieces
          : Array.from({ length: item.quantity }, (_, i) => ({
              id: `temp-${item.lineKey}-${i + 1}`,
              itemId: item.lineKey,
              pieceSeq: i + 1,
            }));
      const cat = state.categories.find((c) => c.service_category_code === item.serviceCategoryCode);
      const categoryLabel =
        cat != null ? (getBilingual(cat.ctg_name, cat.ctg_name2 ?? null) || undefined) : undefined;
      return { item, pieces, categoryLabel };
    });
  }, [state.items, state.categories, getBilingual]);

  // Focus request (cart pencil): scroll the item into view and briefly highlight it.
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [highlightedLineKey, setHighlightedLineKey] = useState<string | null>(null);
  const focusLineKey = useMemo(() => {
    if (!focusItemId) return null;
    const match = state.items.find(
      (i) => i.lineKey === focusItemId,
    );
    return match?.lineKey ?? null;
  }, [focusItemId, state.items]);

  // Parent passes an inline callback; keep it in a ref so re-renders don't restart the timer.
  const onFocusItemHandledRef = useRef(onFocusItemHandled);
  useEffect(() => {
    onFocusItemHandledRef.current = onFocusItemHandled;
  }, [onFocusItemHandled]);

  useEffect(() => {
    if (!focusItemId) return;
    const scrollTimer = setTimeout(() => {
      if (focusLineKey) {
        itemRefs.current.get(focusLineKey)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setHighlightedLineKey(focusLineKey);
      }
      onFocusItemHandledRef.current?.();
    }, 100);
    return () => clearTimeout(scrollTimer);
  }, [focusItemId, focusLineKey]);

  useEffect(() => {
    if (!highlightedLineKey) return;
    const clearTimer = setTimeout(() => setHighlightedLineKey(null), FOCUS_HIGHLIGHT_MS);
    return () => clearTimeout(clearTimer);
  }, [highlightedLineKey]);

  return (
    <section aria-label={t('sectionTitle')} className="space-y-3">
      <h2 className="text-base font-semibold text-foreground">{t('sectionTitle')}</h2>
      <EditControlNotice codes={['ADD_PREFERENCE', 'CHANGE_PREFERENCE', 'REMOVE_PREFERENCE']} />
      <p className="text-sm text-muted-foreground">{t('sectionHint')}</p>

      <div className={`space-y-3 ${preferenceCapability.interactive ? '' : 'pointer-events-none opacity-60'}`}>
        {itemGroups.map(({ item, pieces, categoryLabel }) => {
          const lineNo = productLineNumber(state.items, item.lineKey);
          const title = `${getBilingual(item.productName, item.productName2) || '—'}${lineNo ? ` · ${tLines('lineNumber', { number: lineNo })}` : ''}`;
          const siblingIds = pieces.map((p) => p.id);
          return (
            <div
              key={item.lineKey}
              ref={(el) => {
                if (el) itemRefs.current.set(item.lineKey, el);
                else itemRefs.current.delete(item.lineKey);
              }}
              className={`space-y-3 scroll-mt-4 rounded-lg transition-shadow duration-300 ${
                highlightedLineKey === item.lineKey ? 'ring-2 ring-ring ring-offset-2' : ''
              }`}
            >
              <div className="text-sm font-medium text-foreground">{title}</div>
              {pieces.map((piece) => (
                <PiecePreferenceCard
                  key={piece.id}
                  categoryLabel={categoryLabel}
                  itemTitle={title}
                  piece={piece}
                  preferences={pieceToSelectedPreferences(piece)}
                  preferenceKinds={preferenceKinds}
                  prefsByKind={prefsByKind}
                  packingPrefs={packingPrefs}
                  servicePrefsFallback={servicePrefsFallback}
                  conditionCatalog={conditionCatalog}
                  currencyCode={currencyCode}
                  kindsLoading={kindsLoading}
                  enforcePrefCompatibility={enforcePrefCompatibility}
                  siblingPieceIds={siblingIds}
                  copyAllTooltip={t('copyAllTooltip')}
                  headerAction={<PieceMoveMenu lineKey={item.lineKey} pieceId={piece.id} pieceNumber={piece.pieceSeq} />}
                  onRemovePreference={removePreference}
                  onCopyPreferenceToPieces={(uiId, targets) => {
                    copySinglePreference(uiId, targets);
                    cmxMessage.success(t('copiedPreference'));
                  }}
                  onCopyAllToPieces={(targets) => {
                    copyAllPreferences(piece.id, targets);
                    cmxMessage.success(t('copiedAll'));
                  }}
                  updatePieceFields={updatePieceFields}
                />
              ))}
            </div>
          );
        })}
      </div>
    </section>
  );
}

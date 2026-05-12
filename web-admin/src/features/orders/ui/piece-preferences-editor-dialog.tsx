/**
 * Modal editor for piece-level service prefs, packing, and conditions (preparation / workflow screens).
 * Persists via existing order APIs; refetch pieces + price preview from parent `onSaved`.
 */

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogDescription,
} from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { ServicePreferenceSelector } from './preferences/ServicePreferenceSelector';
import { PackingPreferenceSelector } from './preferences/PackingPreferenceSelector';
import { StainConditionToggles } from './stain-condition-toggles';
import { usePreferenceCatalog } from '../hooks/use-preference-catalog';
import { useMessage } from '@ui/feedback';
import type { OrderItemPiece } from '@/types/order';
import type { OrderItemServicePref } from '../model/new-order-types';
import type { OrderPieceServicePref } from '@/lib/types/service-preferences';
import { PREFERENCE_SOURCES, type ServicePreferenceCode } from '@/lib/constants/service-preferences';
import type { ServicePreference } from '@/lib/types/service-preferences';

export interface PiecePreferencesEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderItemId: string;
  piece: OrderItemPiece;
  branchId?: string | null;
  onSaved: () => void | Promise<void>;
}

function piecePrefsToSelectorFormat(piece: OrderItemPiece): OrderItemServicePref[] {
  const raw = piece.service_prefs ?? [];
  return raw.map((p) => ({
    preference_code: p.preference_code,
    source: p.source ?? PREFERENCE_SOURCES.MANUAL,
    extra_price: Number(p.extra_price ?? 0),
  }));
}

function extraPriceForCode(code: string, catalog: ServicePreference[]): number {
  const row = catalog.find((c) => c.code === code);
  return Number(row?.default_extra_price ?? 0);
}

export function PiecePreferencesEditorDialog({
  open,
  onOpenChange,
  orderId,
  orderItemId,
  piece,
  branchId,
  onSaved,
}: PiecePreferencesEditorDialogProps) {
  const t = useTranslations('orders.pieces');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const { showErrorFrom, showSuccess } = useMessage();
  const { servicePrefs: catalogService, packingPrefs } = usePreferenceCatalog(branchId ?? null);

  const [busy, setBusy] = useState(false);
  const [serverServiceRows, setServerServiceRows] = useState<OrderPieceServicePref[]>([]);
  const [selectedServicePrefs, setSelectedServicePrefs] = useState<OrderItemServicePref[]>([]);
  const [selectedConditions, setSelectedConditions] = useState<string[]>([]);
  const [packingCode, setPackingCode] = useState<string | undefined>(undefined);
  const [packingCfId, setPackingCfId] = useState<string | null | undefined>(undefined);

  const loadServerServicePrefs = useCallback(async () => {
    const res = await fetch(
      `/api/v1/orders/${orderId}/items/${orderItemId}/pieces/${piece.id}/service-prefs`,
      { credentials: 'include' }
    );
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || t('errors.loadFailed'));
    }
    const rows = (json.data ?? []) as OrderPieceServicePref[];
    setServerServiceRows(rows);
    setSelectedServicePrefs(
      rows.length > 0
        ? rows.map((r) => ({
            preference_code: r.preference_code,
            source: r.source ?? PREFERENCE_SOURCES.MANUAL,
            extra_price: Number(r.extra_price ?? 0),
          }))
        : piecePrefsToSelectorFormat(piece)
    );
  }, [orderId, orderItemId, piece, t]);

  useEffect(() => {
    if (!open) return;
    setSelectedConditions([...(piece.conditions ?? [])]);
    setPackingCode(piece.packing_pref_code ?? undefined);
    const packRow = packingPrefs.find((p) => p.code === piece.packing_pref_code);
    setPackingCfId(packRow?.packing_cf_id ?? null);
    void loadServerServicePrefs().catch((e) => {
      setSelectedServicePrefs(piecePrefsToSelectorFormat(piece));
      setServerServiceRows([]);
      showErrorFrom(e, { fallback: t('errors.loadFailed') });
    });
  }, [open, piece.id, piece.conditions, piece.packing_pref_code, piece.service_prefs, loadServerServicePrefs, showErrorFrom, t, packingPrefs]);

  const handleConditionToggle = (code: string) => {
    setSelectedConditions((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const syncServicePrefs = async () => {
    const selectedCodes = new Set(selectedServicePrefs.map((p) => p.preference_code));
    const serverByCode = new Map(serverServiceRows.map((r) => [r.preference_code, r]));

    for (const row of serverServiceRows) {
      if (!selectedCodes.has(row.preference_code) && row.id) {
        const res = await fetch(
          `/api/v1/orders/${orderId}/items/${orderItemId}/pieces/${piece.id}/service-prefs?prefId=${encodeURIComponent(row.id)}`,
          { method: 'DELETE', credentials: 'include' }
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || t('errors.updateFailed'));
        }
      }
    }

    for (const sel of selectedServicePrefs) {
      const prefCode = sel.preference_code as ServicePreferenceCode;
      if (serverByCode.has(prefCode)) continue;
      const body = {
        preference_code: prefCode,
        source: PREFERENCE_SOURCES.MANUAL,
        extra_price: extraPriceForCode(prefCode, catalogService),
        branch_id: branchId ?? null,
      };
      const res = await fetch(
        `/api/v1/orders/${orderId}/items/${orderItemId}/pieces/${piece.id}/service-prefs`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          typeof json.error === 'string' ? json.error : t('errors.updateFailed')
        );
      }
    }
  };

  const handleSave = async () => {
    setBusy(true);
    try {
      await syncServicePrefs();

      const packingChanged = (piece.packing_pref_code ?? '') !== (packingCode ?? '');
      if (packingChanged) {
        const res = await fetch(
          `/api/v1/orders/${orderId}/items/${orderItemId}/pieces/${piece.id}`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              packing_pref_code: packingCode ?? null,
              packing_pref_cf_id: packingCfId ?? null,
            }),
          }
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || t('errors.updateFailed'));
        }
      }

      const condA = [...(piece.conditions ?? [])].sort().join(',');
      const condB = [...selectedConditions].sort().join(',');
      if (condA !== condB) {
        const res = await fetch(
          `/api/v1/orders/${orderId}/items/${orderItemId}/pieces/${piece.id}/conditions`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ conditionCodes: selectedConditions }),
          }
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || t('errors.updateFailed'));
        }
      }

      showSuccess(t('preferencesSaved'));
      await onSaved();
      onOpenChange(false);
    } catch (e) {
      showErrorFrom(e, { fallback: t('preferencesSaveFailed') });
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = (next: boolean) => {
    if (!next && busy) return;
    onOpenChange(next);
  };

  return (
    <CmxDialog open={open} onOpenChange={handleDismiss}>
      <CmxDialogContent className={`max-w-lg max-h-[85vh] overflow-y-auto ${isRTL ? 'text-right' : 'text-left'}`}>
        <CmxDialogHeader>
          <CmxDialogTitle>
            {t('preferencesDialogTitle', { seq: piece.piece_seq })}
          </CmxDialogTitle>
          <CmxDialogDescription>
            {t('preferencesDialogHint')}
          </CmxDialogDescription>
        </CmxDialogHeader>

        <div className="space-y-6 py-2">
          <div>
            <ServicePreferenceSelector
              selectedPrefs={selectedServicePrefs}
              availablePrefs={catalogService}
              onChange={(prefs) => setSelectedServicePrefs(prefs)}
              disabled={busy}
              maxPrefs={8}
              enforceCompatibility={false}
            />
          </div>

          <PackingPreferenceSelector
            value={packingCode}
            availablePrefs={packingPrefs}
            onChange={(code, cf) => {
              setPackingCode(code);
              setPackingCfId(cf ?? null);
            }}
            disabled={busy}
          />

          <div>
            <p className={`text-sm font-semibold text-gray-800 mb-2 ${isRTL ? 'text-right' : 'text-left'}`}>
              {t('conditionsSection')}
            </p>
            <StainConditionToggles
              selectedConditions={selectedConditions}
              onConditionToggle={handleConditionToggle}
              disabled={busy}
            />
          </div>
        </div>

        <CmxDialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
          <CmxButton variant="outline" onClick={() => handleDismiss(false)} disabled={busy}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton variant="primary" onClick={() => void handleSave()} disabled={busy}>
            {t('savePreferences')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}

/**
 * Processing piece preferences dialog — New Order visual, Processing rules.
 * Delete only when ORDER_PROCESSING + created_by=me + not confirmed.
 */

'use client';

import * as React from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ListChecks, Loader2, MessageSquarePlus, Trash2, X } from 'lucide-react';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import { CmxButton, CmxCheckbox, CmxInput, CmxSpinner } from '@ui/primitives';
import { CmxConfirmDialog, cmxMessage } from '@ui/feedback';
import { getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { useBilingual } from '@/lib/utils/bilingual';
import { usePreferenceCatalog } from '@/src/features/orders/hooks/use-preference-catalog';
import { PieceKindPickerDialog } from '@/src/features/orders/ui/piece-preferences/piece-kind-picker-dialog';
import {
  kindChipAccentStyle,
  kindToolbarInactiveSurface,
  parseKindBgHex,
} from '@/src/features/orders/ui/piece-preferences/piece-pref-kind-styles';
import { resolveColorPrefHex, buildColorHexByCode } from '@/src/features/orders/ui/piece-preferences/piece-preference-readonly-chips';
import {
  buildPrefNameByCode,
  labelForPrefCode,
  labelForPrefKind,
} from '@/src/features/orders/ui/piece-preferences/pref-display-labels';
import { PREFERENCE_MAIN_TYPES } from '@/lib/types/service-preferences';
import type { PreferenceKind } from '@/lib/types/service-preferences';
import type { OrderItemServicePref } from '@/src/features/orders/model/new-order-types';
import type { ProcessingPiecePrefRow } from '@/lib/services/order-piece-processing-preference.service';
import { cn } from '@/lib/utils';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';

export interface ProcessingPiecePrefsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  itemId: string;
  pieceId: string;
  tenantId: string;
  title: string;
}

function prefsUrl(orderId: string, itemId: string, pieceId: string) {
  return `/api/v1/orders/${orderId}/items/${itemId}/pieces/${pieceId}/preferences`;
}

/**
 * Piece preferences editor for Processing (rules-aware).
 */
export function ProcessingPiecePrefsDialog({
  open,
  onOpenChange,
  orderId,
  itemId,
  pieceId,
  title,
}: ProcessingPiecePrefsDialogProps) {
  const t = useTranslations('processing.simpleModal.prefsDialog');
  const getBilingual = useBilingual();
  const queryClient = useQueryClient();
  const { formatMoneyWithCode } = useTenantCurrency();

  const {
    preferenceKinds,
    packingPrefs,
    servicePrefs,
    conditionCatalog,
    prefsByKind,
  } = usePreferenceCatalog(undefined, false, false);

  const colorHexByCode = React.useMemo(
    () => buildColorHexByCode(conditionCatalog.colors),
    [conditionCatalog.colors]
  );

  const nameByCode = React.useMemo(
    () =>
      buildPrefNameByCode(
        {
          servicePrefs,
          packingPrefs,
          stains: conditionCatalog.stains,
          damages: conditionCatalog.damages,
          colors: conditionCatalog.colors,
        },
        getBilingual
      ),
    [servicePrefs, packingPrefs, conditionCatalog, getBilingual]
  );

  const SOURCE_I18N_KEYS = React.useMemo(
    () =>
      new Set([
        'ORDER_CREATE',
        'ORDER_EDIT',
        'ORDER_PREPARE',
        'ORDER_PROCESSING',
        'ORDER_UPDATE',
        'manual',
      ]),
    []
  );

  const sourceLabel = React.useCallback(
    (source: string) => {
      if (!SOURCE_I18N_KEYS.has(source)) return source;
      return t(`sources.${source}` as 'sources.ORDER_CREATE');
    },
    [SOURCE_I18N_KEYS, t]
  );

  const pickerConditionCatalog = React.useMemo(
    () => ({
      stains: conditionCatalog.stains.map((p) => ({
        code: p.code,
        name: p.name,
        name2: p.name2,
      })),
      damages: conditionCatalog.damages.map((p) => ({
        code: p.code,
        name: p.name,
        name2: p.name2,
      })),
    }),
    [conditionCatalog.stains, conditionCatalog.damages]
  );

  const [pickerKind, setPickerKind] = React.useState<PreferenceKind | null>(null);
  const [noteDraftByPref, setNoteDraftByPref] = React.useState<Record<string, string>>(
    {}
  );
  const [expandedNotes, setExpandedNotes] = React.useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = React.useState<ProcessingPiecePrefRow | null>(
    null
  );

  const queryKey = ['processing-piece-prefs', orderId, pieceId] as const;

  const { data: prefs = [], isLoading, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<ProcessingPiecePrefRow[]> => {
      const res = await fetch(prefsUrl(orderId, itemId, pieceId), {
        credentials: 'include',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to load preferences');
      }
      return json.data as ProcessingPiecePrefRow[];
    },
    enabled: open && !!orderId && !!pieceId,
  });

  const invalidateRelated = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['order-pieces', orderId] });
    await queryClient.invalidateQueries({ queryKey: ['order-processing', orderId] });
    await queryClient.invalidateQueries({ queryKey });
  }, [orderId, queryClient, queryKey]);

  const addMutation = useMutation({
    mutationFn: async (body: {
      preference_sys_kind: string;
      preference_code: string;
      extra_price?: number;
      preference_id?: string | null;
      preference_content?: string | null;
    }) => {
      const res = await fetch(prefsUrl(orderId, itemId, pieceId), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...getCSRFHeader() },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          typeof json.error === 'string' ? json.error : 'Failed to add preference'
        );
      }
      return json;
    },
    onSuccess: async (json) => {
      cmxMessage.success(t('addSuccess'));
      if (json.financial?.outstanding_amount != null) {
        cmxMessage.info(
          t('financialUpdated', {
            amount: String(json.financial.outstanding_amount),
          })
        );
      }
      await invalidateRelated();
    },
    onError: (err: Error) => {
      cmxMessage.error(err.message || t('addFailed'));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (prefId: string) => {
      const res = await fetch(
        `${prefsUrl(orderId, itemId, pieceId)}/${prefId}`,
        {
          method: 'DELETE',
          credentials: 'include',
          headers: { ...getCSRFHeader() },
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          typeof json.error === 'string' ? json.error : t('deleteFailed')
        );
      }
      return json;
    },
    onSuccess: async () => {
      cmxMessage.success(t('deleteSuccess'));
      setDeleteTarget(null);
      await invalidateRelated();
    },
    onError: (err: Error) => {
      cmxMessage.error(err.message || t('deleteFailed'));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async ({
      prefId,
      processing_confirmed,
    }: {
      prefId: string;
      processing_confirmed: boolean;
    }) => {
      const res = await fetch(
        `${prefsUrl(orderId, itemId, pieceId)}/${prefId}`,
        {
          method: 'PATCH',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...getCSRFHeader() },
          body: JSON.stringify({ processing_confirmed }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          typeof json.error === 'string' ? json.error : t('confirmFailed')
        );
      }
      return json;
    },
    onSuccess: async () => {
      await refetch();
    },
    onError: (err: Error) => {
      cmxMessage.error(err.message || t('confirmFailed'));
    },
  });

  const noteMutation = useMutation({
    mutationFn: async ({ prefId, note_text }: { prefId: string; note_text: string }) => {
      const res = await fetch(
        `${prefsUrl(orderId, itemId, pieceId)}/${prefId}/notes`,
        {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json', ...getCSRFHeader() },
          body: JSON.stringify({ note_text }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(
          typeof json.error === 'string' ? json.error : t('noteFailed')
        );
      }
      return json;
    },
    onSuccess: async (_json, vars) => {
      cmxMessage.success(t('noteSuccess'));
      setNoteDraftByPref((prev) => ({ ...prev, [vars.prefId]: '' }));
      await refetch();
    },
    onError: (err: Error) => {
      cmxMessage.error(err.message || t('noteFailed'));
    },
  });

  const kindsForToolbar = React.useMemo(
    () =>
      (preferenceKinds || []).filter(
        (k) =>
          k.main_type_code === PREFERENCE_MAIN_TYPES.PREFERENCES ||
          k.main_type_code === PREFERENCE_MAIN_TYPES.CONDITIONS ||
          k.main_type_code === PREFERENCE_MAIN_TYPES.NOTES ||
          k.kind_code === 'note'
      ),
    [preferenceKinds]
  );

  const grouped = React.useMemo(() => {
    const map = new Map<string, ProcessingPiecePrefRow[]>();
    for (const row of prefs) {
      const key = row.preference_sys_kind || 'other';
      const list = map.get(key) ?? [];
      list.push(row);
      map.set(key, list);
    }
    return map;
  }, [prefs]);

  const selectedConditionCodes = React.useMemo(() => {
    return prefs
      .filter((p) =>
        ['condition_stain', 'condition_damag', 'condition_special'].includes(
          p.preference_sys_kind || ''
        )
      )
      .map((p) => p.preference_code.toLowerCase());
  }, [prefs]);

  const selectedColorCodes = React.useMemo(
    () => prefs.filter((p) => p.preference_sys_kind === 'color').map((p) => p.preference_code),
    [prefs]
  );

  const pieceServicePrefs: OrderItemServicePref[] = React.useMemo(
    () =>
      prefs
        .filter((p) => p.preference_sys_kind === 'service_prefs')
        .map((p) => ({
          preference_code: p.preference_code as OrderItemServicePref['preference_code'],
          source: 'manual' as const,
          extra_price: p.extra_price,
        })),
    [prefs]
  );

  const packingPrefCode =
    prefs.find((p) => p.preference_sys_kind === 'packing_prefs')?.preference_code ||
    undefined;

  const handleServicePrefsChange = (next: OrderItemServicePref[]) => {
    const existing = new Set(pieceServicePrefs.map((p) => p.preference_code));
    for (const p of next) {
      if (!existing.has(p.preference_code)) {
        const catalog = servicePrefs.find((c) => c.code === p.preference_code);
        addMutation.mutate({
          preference_sys_kind: 'service_prefs',
          preference_code: p.preference_code,
          extra_price: Number(p.extra_price ?? catalog?.default_extra_price ?? 0),
          preference_id: catalog?.preference_cf_id ?? null,
        });
      }
    }
  };

  const handleConditionToggle = (code: string) => {
    const catalogCode = code.toUpperCase();
    const existing = prefs.find(
      (p) =>
        ['condition_stain', 'condition_damag', 'condition_special'].includes(
          p.preference_sys_kind || ''
        ) &&
        (p.preference_code.toLowerCase() === code.toLowerCase() ||
          p.preference_code === catalogCode)
    );
    if (existing) {
      if (existing.can_delete) {
        setDeleteTarget(existing);
      } else {
        cmxMessage.info(t('cannotDeleteHint'));
      }
      return;
    }
    addMutation.mutate({
      preference_sys_kind: 'condition_stain',
      preference_code: code,
      extra_price: 0,
    });
  };

  const handleColorsChange = (codes: string[], cfIds: (string | null)[]) => {
    const existing = new Set(selectedColorCodes.map((c) => c.toUpperCase()));
    codes.forEach((code, i) => {
      if (!existing.has(code.toUpperCase())) {
        addMutation.mutate({
          preference_sys_kind: 'color',
          preference_code: code,
          extra_price: 0,
          preference_id: cfIds[i] ?? null,
        });
      }
    });
  };

  const handlePackingChange = (code: string | undefined, packingCfId?: string | null) => {
    if (!code) return;
    addMutation.mutate({
      preference_sys_kind: 'packing_prefs',
      preference_code: code,
      preference_id: packingCfId ?? null,
    });
    setPickerKind(null);
  };

  const labelForPref = (row: ProcessingPiecePrefRow) => {
    if (row.preference_sys_kind === 'note') {
      return row.preference_content || row.preference_code;
    }
    return labelForPrefCode(row.preference_code, nameByCode);
  };

  return (
    <>
      <CmxDialog open={open} onOpenChange={onOpenChange}>
        <CmxDialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
          <CmxDialogHeader className="shrink-0 border-b px-4 py-3">
            <CmxDialogTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{title}</span>
            </CmxDialogTitle>
            <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
          </CmxDialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3">
            {/* Kind toolbar */}
            <div
              className="flex flex-wrap gap-1.5"
              role="toolbar"
              aria-label={t('kindToolbarAria')}
            >
              {kindsForToolbar.map((kind) => {
                const label = getBilingual(kind.name, kind.name2 ?? null) || kind.kind_code;
                const hex = parseKindBgHex(kind.kind_bg_color);
                const accent = hex ? kindChipAccentStyle(hex) : undefined;
                const inactive = hex
                  ? kindToolbarInactiveSurface(hex)
                  : undefined;
                return (
                  <CmxButton
                    key={kind.kind_code}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 rounded-full px-3 text-xs"
                    style={{ ...inactive, ...accent }}
                    onClick={() => {
                      if (
                        kind.main_type_code === PREFERENCE_MAIN_TYPES.NOTES ||
                        kind.kind_code === 'note'
                      ) {
                        const text = window.prompt(t('notePrompt'));
                        if (text?.trim()) {
                          addMutation.mutate({
                            preference_sys_kind: 'note',
                            preference_code: text.trim(),
                            preference_content: text.trim(),
                            extra_price: 0,
                          });
                        }
                        return;
                      }
                      setPickerKind(kind);
                    }}
                  >
                    {label}
                  </CmxButton>
                );
              })}
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <CmxSpinner className="h-5 w-5" />
                {t('loading')}
              </div>
            ) : prefs.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                {t('empty')}
              </p>
            ) : (
              <div className="space-y-4">
                {Array.from(grouped.entries()).map(([kind, rows]) => (
                  <section key={kind} className="space-y-2">
                    <h3 className="text-xs font-semibold tracking-wide text-muted-foreground">
                      {labelForPrefKind(kind, preferenceKinds, getBilingual)}
                    </h3>
                    <ul className="space-y-2">
                      {rows.map((row) => {
                        const colorHex =
                          row.preference_sys_kind === 'color'
                            ? resolveColorPrefHex(row.preference_code, colorHexByCode)
                            : null;
                        const kindHex = colorHex;
                        const accent = kindHex
                          ? kindChipAccentStyle(kindHex)
                          : kindChipAccentStyle(
                              kind === 'service_prefs'
                                ? '#3B82F6'
                                : kind === 'packing_prefs'
                                  ? '#10B981'
                                  : kind.startsWith('condition')
                                    ? '#F97316'
                                    : '#94A3B8'
                            );
                        const price =
                          row.extra_price > 0.0001
                            ? `+${formatMoneyWithCode(row.extra_price)}`
                            : '';
                        const notesOpen = expandedNotes === row.id;

                        return (
                          <li
                            key={row.id}
                            className="rounded-xl border border-border/80 bg-card p-2.5 shadow-sm"
                            style={accent}
                          >
                            <div className="flex flex-wrap items-start gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="truncate text-sm font-medium">
                                    {labelForPref(row)}
                                  </span>
                                  {price ? (
                                    <span className="text-xs font-semibold text-emerald-700">
                                      {price}
                                    </span>
                                  ) : null}
                                  <span
                                    className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                    title={row.prefs_source}
                                  >
                                    {sourceLabel(row.prefs_source)}
                                  </span>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <CmxCheckbox
                                  size="sm"
                                  checked={row.processing_confirmed === true}
                                  onChange={(e) => {
                                    confirmMutation.mutate({
                                      prefId: row.id,
                                      processing_confirmed: e.target.checked,
                                    });
                                  }}
                                  aria-label={t('confirmLabel')}
                                  label={t('confirmShort')}
                                />
                                <CmxButton
                                  type="button"
                                  variant="ghost"
                                  size="xs"
                                  className="h-8 w-8 p-0"
                                  aria-label={t('addNote')}
                                  onClick={() =>
                                    setExpandedNotes(notesOpen ? null : row.id)
                                  }
                                >
                                  <MessageSquarePlus className="h-4 w-4" />
                                </CmxButton>
                                {row.can_delete ? (
                                  <CmxButton
                                    type="button"
                                    variant="ghost"
                                    size="xs"
                                    className="h-8 w-8 p-0 text-destructive"
                                    aria-label={t('delete')}
                                    onClick={() => setDeleteTarget(row)}
                                    disabled={deleteMutation.isPending}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </CmxButton>
                                ) : (
                                  <span
                                    className="max-w-[7rem] text-[10px] leading-tight text-muted-foreground"
                                    title={
                                      row.processing_confirmed
                                        ? t('deleteBlockedConfirmed')
                                        : row.prefs_source !== 'ORDER_PROCESSING'
                                          ? t('deleteBlockedSource')
                                          : t('deleteBlockedOwner')
                                    }
                                  >
                                    {row.processing_confirmed
                                      ? t('unconfirmFirst')
                                      : null}
                                  </span>
                                )}
                              </div>
                            </div>

                            {row.notes_followup?.length ? (
                              <ul className="mt-2 space-y-1 border-t border-border/50 pt-2">
                                {row.notes_followup.map((n) => (
                                  <li
                                    key={`${row.id}-${n.note_seq}`}
                                    className="text-xs text-muted-foreground"
                                  >
                                    <span className="font-medium text-foreground">
                                      #{n.note_seq}
                                    </span>{' '}
                                    <span className="opacity-70">[{n.note_source}]</span>{' '}
                                    {n.note_text}
                                  </li>
                                ))}
                              </ul>
                            ) : null}

                            {notesOpen ? (
                              <div className="mt-2 flex gap-2 border-t border-border/50 pt-2">
                                <CmxInput
                                  value={noteDraftByPref[row.id] ?? ''}
                                  onChange={(e) =>
                                    setNoteDraftByPref((prev) => ({
                                      ...prev,
                                      [row.id]: e.target.value,
                                    }))
                                  }
                                  placeholder={t('notePlaceholder')}
                                  aria-label={t('addNote')}
                                  className="h-8 flex-1 text-sm"
                                />
                                <CmxButton
                                  type="button"
                                  size="sm"
                                  disabled={
                                    noteMutation.isPending ||
                                    !(noteDraftByPref[row.id] || '').trim()
                                  }
                                  onClick={() =>
                                    noteMutation.mutate({
                                      prefId: row.id,
                                      note_text: noteDraftByPref[row.id] || '',
                                    })
                                  }
                                >
                                  {noteMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    t('saveNote')
                                  )}
                                </CmxButton>
                              </div>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </div>

          <CmxDialogFooter className="shrink-0 border-t px-4 py-3">
            <CmxButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
              <X className="me-1 h-4 w-4" />
              {t('close')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <PieceKindPickerDialog
        open={pickerKind != null}
        onOpenChange={(v) => {
          if (!v) setPickerKind(null);
        }}
        kind={pickerKind}
        packingPrefCode={packingPrefCode}
        pieceServicePrefs={pieceServicePrefs}
        selectedConditionCodes={selectedConditionCodes}
        selectedColorCodes={selectedColorCodes}
        onColorsChange={handleColorsChange}
        conditionCatalog={pickerConditionCatalog}
        packingPrefs={packingPrefs}
        prefsForKind={
          pickerKind ? prefsByKind.get(pickerKind.kind_code) || servicePrefs : servicePrefs
        }
        servicePrefsFallback={servicePrefs}
        onPackingChange={handlePackingChange}
        onServicePrefsChange={handleServicePrefsChange}
        onConditionToggle={handleConditionToggle}
      />

      <CmxConfirmDialog
        open={deleteTarget != null}
        onCancel={() => setDeleteTarget(null)}
        title={t('deleteConfirmTitle')}
        description={t('deleteConfirmDesc', {
          label: deleteTarget ? labelForPref(deleteTarget) : '',
        })}
        confirmLabel={t('delete')}
        cancelLabel={t('cancel')}
        onConfirm={() => {
          if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
        }}
      />
    </>
  );
}

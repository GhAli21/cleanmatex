'use client';

/**
 * Shared "audit" affordance for Cmx list/grid components (CmxDataTable,
 * CmxDataGrid): a per-row action that opens CmxAuditInfoCard with the row's
 * created/updated metadata, resolving created_by/updated_by actor ids to
 * display names via /api/v1/audit/actors. Extracted so both components stay
 * behaviorally identical instead of drifting apart from copy-pasted logic.
 *
 * @module ui/data-display
 */

import { type ColumnDef } from '@tanstack/react-table';
import { useCallback, useMemo, useRef, useState, useTransition, type ReactNode } from 'react';
import { UserRound } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '../primitives/cmx-button';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '../overlays/cmx-dialog';
import { CmxAuditInfoCard } from './cmx-audit-info-card';
import type { AuditActor, AuditExtraRow } from './cmx-audit-info-card';

export const CMX_AUDIT_COL_ID = '__cmx_audit_action';

const AUDIT_KEYS = [
  'created_at', 'createdAt',
  'created_by', 'createdBy',
  'updated_at', 'updatedAt',
  'updated_by', 'updatedBy',
  'created_info', 'createdInfo',
  'updated_info', 'updatedInfo',
  'rec_status', 'recStatus',
  'rec_order', 'recOrder',
  'rec_notes', 'recNotes',
] as const;

/** Shared config shape for the audit column/dialog on any Cmx list surface. */
export interface CmxAuditConfig<TData> {
  /**
   * `auto` enables the action when row objects expose known audit keys.
   * `true` forces the column on and uses either `getRecord` or the raw row.
   */
  enabled?: boolean | 'auto';
  /** Override row-to-record mapping when audit values live under nested fields. */
  getRecord?: (row: TData) => Record<string, unknown> | null;
  /** Optional dialog title per row (for example "Voucher Audit"). */
  getTitle?: (row: TData) => string | undefined;
  /** Optional row gate when some rows should not expose audit metadata. */
  isEnabled?: (row: TData) => boolean;
  /** Override the button label shown in the audit action column. */
  actionLabel?: string;
  /** Override the column header label for the audit action. */
  columnHeader?: ReactNode;
  /**
   * Per-row domain-specific rows appended to the audit dialog below the
   * standard created/updated fields (for example order lifecycle timestamps
   * that aren't part of the generic audit column set).
   */
  getExtras?: (row: TData) => AuditExtraRow[];
}

interface AuditDialogState<TData> {
  row: TData;
  record: Record<string, unknown>;
  title?: string;
  extras: AuditExtraRow[];
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasAuditFields(record: Record<string, unknown> | null): boolean {
  if (!record) return false;
  return AUDIT_KEYS.some((key) => Object.prototype.hasOwnProperty.call(record, key));
}

function getDefaultAuditRecord<TData>(row: TData): Record<string, unknown> | null {
  return isRecordLike(row) ? row : null;
}

function isAuditActorObject(value: unknown): value is Exclude<AuditActor, string> {
  return typeof value === 'object' && value !== null;
}

function normalizeActorValue(value: unknown): AuditActor | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  if (!isAuditActorObject(value)) return null;

  const actor = value as Record<string, unknown>;
  return {
    id: typeof actor.id === 'string' ? actor.id : null,
    label: typeof actor.label === 'string' ? actor.label : null,
    displayName:
      typeof actor.displayName === 'string'
        ? actor.displayName
        : typeof actor.display_name === 'string'
          ? actor.display_name
          : null,
    email: typeof actor.email === 'string' ? actor.email : null,
    phone: typeof actor.phone === 'string' ? actor.phone : null,
  };
}

function collectAuditActorIds(record: Record<string, unknown>): string[] {
  const candidates = [record.created_by, record.createdBy, record.updated_by, record.updatedBy];
  return candidates.flatMap((candidate) => {
    const actor = normalizeActorValue(candidate);
    if (actor == null) return [];
    if (typeof actor === 'string') return [actor];
    return actor.id && !actor.displayName && !actor.label && !actor.email ? [actor.id] : [];
  });
}

function withResolvedActorDetails(
  record: Record<string, unknown>,
  actorsById: Map<string, { displayName: string | null; email: string | null; phone: string | null }>,
): Record<string, unknown> {
  const nextRecord = { ...record };

  for (const key of ['created_by', 'createdBy', 'updated_by', 'updatedBy'] as const) {
    const actor = normalizeActorValue(nextRecord[key]);
    if (actor == null) continue;

    if (typeof actor === 'string') {
      const resolvedActor = actorsById.get(actor);
      if (!resolvedActor) continue;
      nextRecord[key] = {
        id: actor,
        displayName: resolvedActor.displayName,
        email: resolvedActor.email,
        phone: resolvedActor.phone,
      } satisfies Exclude<AuditActor, string>;
      continue;
    }

    if (!actor.id || actor.displayName || actor.label || actor.email) continue;
    const resolvedActor = actorsById.get(actor.id);
    if (!resolvedActor) continue;

    nextRecord[key] = {
      ...actor,
      displayName: actor.displayName ?? resolvedActor.displayName,
      email: actor.email ?? resolvedActor.email,
      phone: actor.phone ?? resolvedActor.phone,
    } satisfies Exclude<AuditActor, string>;
  }

  return nextRecord;
}

export interface UseCmxAuditColumnResult<TData> {
  /** Append to the grid/table's column list when non-null; null means no row in `data` qualifies. */
  auditColumn: ColumnDef<TData, unknown> | null;
  /** Render once, anywhere in the host component's JSX tree. */
  auditDialog: ReactNode;
}

/**
 * Builds the shared audit column + dialog for a Cmx list surface.
 * @param options.auditConfig Same shape/semantics on CmxDataTable and CmxDataGrid.
 * @param options.data Current page/row data, used to decide whether any row qualifies.
 */
export function useCmxAuditColumn<TData>(options: {
  auditConfig?: boolean | CmxAuditConfig<TData>;
  data: TData[];
}): UseCmxAuditColumnResult<TData> {
  const { auditConfig, data } = options;
  const tCommon = useTranslations('common');
  const [auditDialogState, setAuditDialogState] = useState<AuditDialogState<TData> | null>(null);
  const [, startAuditActorsTransition] = useTransition();
  const auditLookupRequestRef = useRef(0);

  const resolvedAuditConfig = useMemo<CmxAuditConfig<TData> | null>(() => {
    if (auditConfig === false || auditConfig === undefined) return null;
    if (auditConfig === true) return { enabled: true };
    return { enabled: 'auto', ...auditConfig };
  }, [auditConfig]);

  const resolveAuditRecord = useCallback((row: TData): Record<string, unknown> | null => {
    const record = resolvedAuditConfig?.getRecord?.(row) ?? getDefaultAuditRecord(row);
    return isRecordLike(record) ? record : null;
  }, [resolvedAuditConfig]);

  const resolveAuditTitle = useCallback((row: TData): string | undefined => {
    return resolvedAuditConfig?.getTitle?.(row);
  }, [resolvedAuditConfig]);

  const canShowAuditForRow = useCallback((row: TData): boolean => {
    if (!resolvedAuditConfig) return false;
    if (resolvedAuditConfig.isEnabled && !resolvedAuditConfig.isEnabled(row)) return false;
    const record = resolveAuditRecord(row);
    if (resolvedAuditConfig.enabled === true) return record !== null;
    return hasAuditFields(record);
  }, [resolveAuditRecord, resolvedAuditConfig]);

  const handleAuditOpen = useCallback((row: TData) => {
    const record = resolveAuditRecord(row);
    if (!record) return;

    const title = resolveAuditTitle(row);
    const extras = resolvedAuditConfig?.getExtras?.(row) ?? [];
    setAuditDialogState({ row, record, title, extras });

    const actorIds = collectAuditActorIds(record);
    if (actorIds.length === 0) return;

    const requestId = auditLookupRequestRef.current + 1;
    auditLookupRequestRef.current = requestId;

    startAuditActorsTransition(async () => {
      try {
        const params = new URLSearchParams();
        actorIds.forEach((actorId) => params.append('id', actorId));

        const response = await fetch(`/api/v1/audit/actors?${params.toString()}`);
        if (!response.ok) return;

        const payload = (await response.json()) as {
          success?: boolean;
          data?: Array<{ id: string; displayName: string | null; email: string | null; phone: string | null }>;
        };
        if (!payload.success || !payload.data || auditLookupRequestRef.current !== requestId) return;

        const actorsById = new Map(
          payload.data
            .filter((actor) => typeof actor.id === 'string')
            .map((actor) => [actor.id, { displayName: actor.displayName ?? null, email: actor.email ?? null, phone: actor.phone ?? null }]),
        );
        for (const actorId of actorIds) {
          if (!actorsById.has(actorId)) {
            actorsById.set(actorId, { displayName: tCommon('auditCard.missingActor'), email: null, phone: null });
          }
        }
        if (actorsById.size === 0) return;

        setAuditDialogState((previous) => {
          if (!previous || previous.row !== row) return previous;
          return { ...previous, record: withResolvedActorDetails(previous.record, actorsById) };
        });
      } catch {
        // Audit actor name resolution is progressive enhancement only.
      }
    });
  }, [resolveAuditRecord, resolveAuditTitle, resolvedAuditConfig, tCommon]);

  const showAuditColumn = useMemo(
    () => !!resolvedAuditConfig && data.some((row) => canShowAuditForRow(row)),
    [canShowAuditForRow, data, resolvedAuditConfig],
  );

  const auditColumn = useMemo<ColumnDef<TData, unknown> | null>(() => {
    if (!showAuditColumn) return null;
    const auditHeaderLabel = resolvedAuditConfig?.columnHeader ?? tCommon('auditCard.actionLabel');

    return {
      id: CMX_AUDIT_COL_ID,
      enableSorting: false,
      enableColumnFilter: false,
      header: () => (
        <span className="inline-flex w-full items-center justify-center text-[11px] font-semibold uppercase tracking-[0.04em] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
          {auditHeaderLabel}
        </span>
      ),
      cell: ({ row }) => {
        const originalRow = row.original;
        if (!canShowAuditForRow(originalRow)) return null;
        const actionLabel = resolvedAuditConfig?.actionLabel ?? tCommon('auditCard.actionLabel');
        return (
          <div className="flex justify-center">
            <CmxButton
              type="button"
              variant="ghost"
              size="sm"
              title={actionLabel}
              aria-label={actionLabel}
              className="h-10 w-10 rounded-full border border-[rgb(var(--cmx-primary-rgb,37_99_235)/0.18)] bg-[rgb(var(--cmx-primary-rgb,37_99_235)/0.12)] px-0 text-[rgb(var(--cmx-primary-rgb,37_99_235))] shadow-sm transition-colors hover:bg-[rgb(var(--cmx-primary-rgb,37_99_235)/0.18)] hover:text-[rgb(var(--cmx-primary-rgb,37_99_235))]"
              onClick={() => handleAuditOpen(originalRow)}
            >
              <UserRound className="h-5 w-5" aria-hidden />
            </CmxButton>
          </div>
        );
      },
    };
  }, [canShowAuditForRow, handleAuditOpen, resolvedAuditConfig, showAuditColumn, tCommon]);

  const auditDialog = auditDialogState ? (
    <CmxDialog
      open
      onOpenChange={(open) => {
        if (!open) {
          auditLookupRequestRef.current += 1;
          setAuditDialogState(null);
        }
      }}
    >
      <CmxDialogContent className="max-w-2xl">
        <CmxDialogHeader>
          <CmxDialogTitle>{auditDialogState.title ?? tCommon('auditCard.actionLabel')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="py-4">
          <CmxAuditInfoCard
            title={tCommon('auditCard.title')}
            record={auditDialogState.record}
            extras={auditDialogState.extras}
            defaultExpanded
            collapsibleExtras={false}
            className="shadow-none"
          />
        </div>
        <CmxDialogFooter>
          <CmxButton
            variant="outline"
            onClick={() => {
              auditLookupRequestRef.current += 1;
              setAuditDialogState(null);
            }}
          >
            {tCommon('close')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  ) : null;

  return { auditColumn, auditDialog };
}

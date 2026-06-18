'use client'

/**
 * Reusable audit metadata card for detail screens and dialogs.
 *
 * Keeps audit information visually secondary while giving feature screens one
 * shared place to render row metadata consistently across EN/AR layouts.
 */

import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { CmxButton } from '@ui/primitives/cmx-button'
import {
  CmxCard,
  CmxCardContent,
  CmxCardHeader,
  CmxCardTitle,
} from '@ui/primitives/cmx-card'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/utils/rtl'

/**
 * Actor data accepts either a stored string value or a richer object when the
 * host already resolved display metadata.
 */
export type AuditActor =
  | string
  | {
      id?: string | null
      displayName?: string | null
      email?: string | null
      label?: string | null
    }

/**
 * Extra rows let feature screens extend the base audit card without forking
 * the layout for domain-specific metadata.
 */
export interface AuditExtraRow {
  key: string
  label: string
  value: ReactNode | Date | null | undefined
  hideWhenEmpty?: boolean
  defaultVisible?: boolean
}

/**
 * Props keep the component strongly typed for common audit fields while still
 * allowing raw-record adoption in screens that already hold DB-shaped objects.
 */
export interface CmxAuditInfoCardProps {
  title?: string
  record?: Record<string, unknown>
  createdAt?: string | Date | null
  createdBy?: AuditActor | null
  updatedAt?: string | Date | null
  updatedBy?: AuditActor | null
  createdInfo?: ReactNode | null
  updatedInfo?: ReactNode | null
  recStatus?: ReactNode | null
  recOrder?: ReactNode | null
  recNotes?: ReactNode | null
  extras?: AuditExtraRow[]
  defaultExpanded?: boolean
  collapsibleExtras?: boolean
  className?: string
}

type AuditRowKind = 'datetime' | 'actor' | 'generic'

interface NormalizedField<T> {
  present: boolean
  value: T
}

interface NormalizedAuditRecord {
  createdAt: NormalizedField<string | Date | null>
  createdBy: NormalizedField<AuditActor | null>
  updatedAt: NormalizedField<string | Date | null>
  updatedBy: NormalizedField<AuditActor | null>
  createdInfo: NormalizedField<ReactNode | null>
  updatedInfo: NormalizedField<ReactNode | null>
  recStatus: NormalizedField<ReactNode | null>
  recOrder: NormalizedField<ReactNode | null>
  recNotes: NormalizedField<ReactNode | null>
}

interface RenderableAuditRow {
  key: string
  label: string
  value: ReactNode | Date | null | undefined
  kind: AuditRowKind
  hideWhenEmpty: boolean
  defaultVisible: boolean
  present: boolean
}

function hasOwn(record: Record<string, unknown> | undefined, key: string): boolean {
  return !!record && Object.prototype.hasOwnProperty.call(record, key)
}

function readKnownField<T>(
  record: Record<string, unknown> | undefined,
  keys: string[],
): NormalizedField<T | null> {
  if (!record) {
    return { present: false, value: null }
  }

  for (const key of keys) {
    if (hasOwn(record, key)) {
      return { present: true, value: (record[key] as T | null) ?? null }
    }
  }

  return { present: false, value: null }
}

function normalizeActor(value: unknown): AuditActor | null {
  if (value == null) {
    return null
  }

  if (typeof value === 'string') {
    return value
  }

  if (typeof value !== 'object') {
    return String(value)
  }

  const actor = value as Record<string, unknown>

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
  }
}

function normalizeAuditRecord(record?: Record<string, unknown>): NormalizedAuditRecord {
  const createdBy = readKnownField<unknown>(record, ['createdBy', 'created_by'])
  const updatedBy = readKnownField<unknown>(record, ['updatedBy', 'updated_by'])

  return {
    createdAt: readKnownField<string | Date>(record, ['createdAt', 'created_at']),
    createdBy: {
      present: createdBy.present,
      value: normalizeActor(createdBy.value),
    },
    updatedAt: readKnownField<string | Date>(record, ['updatedAt', 'updated_at']),
    updatedBy: {
      present: updatedBy.present,
      value: normalizeActor(updatedBy.value),
    },
    createdInfo: readKnownField<ReactNode>(record, ['createdInfo', 'created_info']),
    updatedInfo: readKnownField<ReactNode>(record, ['updatedInfo', 'updated_info']),
    recStatus: readKnownField<ReactNode>(record, ['recStatus', 'rec_status']),
    recOrder: readKnownField<ReactNode>(record, ['recOrder', 'rec_order']),
    recNotes: readKnownField<ReactNode>(record, ['recNotes', 'rec_notes']),
  }
}

function isValueEmpty(value: ReactNode | Date | null | undefined): boolean {
  if (value instanceof Date) {
    return false
  }

  if (value == null || value === false) {
    return true
  }

  if (typeof value === 'string') {
    return value.trim().length === 0
  }

  return false
}

function resolveActorLabel(actor: AuditActor | null | undefined): string | null {
  if (actor == null) {
    return null
  }

  if (typeof actor === 'string') {
    return actor.trim() || null
  }

  return actor.label?.trim() || actor.displayName?.trim() || actor.email?.trim() || actor.id?.trim() || null
}

function renderRowValue(
  value: ReactNode | Date | null | undefined,
  kind: AuditRowKind,
  locale: 'en' | 'ar',
  notAvailableLabel: string,
): ReactNode {
  if (kind === 'actor') {
    return resolveActorLabel(value as AuditActor | null | undefined) ?? notAvailableLabel
  }

  if (kind === 'datetime') {
    if (value instanceof Date || typeof value === 'string') {
      if (!value) {
        return notAvailableLabel
      }

      return formatDateTime(value, locale)
    }

    return notAvailableLabel
  }

  if (value instanceof Date) {
    return formatDateTime(value, locale)
  }

  return isValueEmpty(value) ? notAvailableLabel : value
}

function buildRow(
  key: string,
  label: string,
  kind: AuditRowKind,
  explicitValue: ReactNode | Date | null | undefined,
  explicitPresent: boolean,
  normalizedField: NormalizedField<ReactNode | AuditActor | string | Date | null>,
  options: Pick<RenderableAuditRow, 'hideWhenEmpty' | 'defaultVisible'>,
): RenderableAuditRow {
  return {
    key,
    label,
    kind,
    hideWhenEmpty: options.hideWhenEmpty,
    defaultVisible: options.defaultVisible,
    present: explicitPresent || normalizedField.present,
    value: explicitPresent ? explicitValue : normalizedField.value,
  }
}

function shouldRenderRow(row: RenderableAuditRow): boolean {
  if (!row.present) {
    return false
  }

  if (row.hideWhenEmpty && isValueEmpty(row.value)) {
    return false
  }

  return true
}

function AuditInfoRow({
  label,
  value,
}: {
  label: string
  value: ReactNode
}) {
  return (
    <div className="rounded-lg border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-secondary-bg-rgb,248_250_252))] px-3 py-2.5">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-[rgb(var(--cmx-foreground-rgb,15_23_42))] break-words">
        {value}
      </dd>
    </div>
  )
}

/**
 * Provides a single audit metadata presentation for row-level detail surfaces
 * so pages can reuse the same UX instead of hand-rolling audit grids.
 *
 * @example
 * <CmxAuditInfoCard createdAt="2026-06-18T10:00:00.000Z" createdBy="user_123" />
 */
export function CmxAuditInfoCard(props: CmxAuditInfoCardProps) {
  const locale = useLocale() === 'ar' ? 'ar' : 'en'
  const tCommon = useTranslations('common')
  const [isExpanded, setIsExpanded] = useState(props.defaultExpanded ?? false)

  const normalized = normalizeAuditRecord(props.record)
  const notAvailableLabel = tCommon('auditCard.notAvailable')
  const title = props.title ?? tCommon('auditCard.title')
  const collapsibleExtras = props.collapsibleExtras ?? true

  const coreRows = [
    buildRow(
      'createdAt',
      tCommon('auditCard.createdAt'),
      'datetime',
      props.createdAt,
      props.createdAt !== undefined,
      normalized.createdAt,
      { hideWhenEmpty: false, defaultVisible: true },
    ),
    buildRow(
      'createdBy',
      tCommon('auditCard.createdBy'),
      'actor',
      props.createdBy,
      props.createdBy !== undefined,
      normalized.createdBy,
      { hideWhenEmpty: false, defaultVisible: true },
    ),
    buildRow(
      'updatedAt',
      tCommon('auditCard.updatedAt'),
      'datetime',
      props.updatedAt,
      props.updatedAt !== undefined,
      normalized.updatedAt,
      { hideWhenEmpty: false, defaultVisible: true },
    ),
    buildRow(
      'updatedBy',
      tCommon('auditCard.updatedBy'),
      'actor',
      props.updatedBy,
      props.updatedBy !== undefined,
      normalized.updatedBy,
      { hideWhenEmpty: false, defaultVisible: true },
    ),
  ].filter(shouldRenderRow)

  const optionalRows = [
    buildRow(
      'createdInfo',
      tCommon('auditCard.createdInfo'),
      'generic',
      props.createdInfo,
      props.createdInfo !== undefined,
      normalized.createdInfo,
      { hideWhenEmpty: true, defaultVisible: false },
    ),
    buildRow(
      'updatedInfo',
      tCommon('auditCard.updatedInfo'),
      'generic',
      props.updatedInfo,
      props.updatedInfo !== undefined,
      normalized.updatedInfo,
      { hideWhenEmpty: true, defaultVisible: false },
    ),
    buildRow(
      'recStatus',
      tCommon('auditCard.recordStatus'),
      'generic',
      props.recStatus,
      props.recStatus !== undefined,
      normalized.recStatus,
      { hideWhenEmpty: true, defaultVisible: false },
    ),
    buildRow(
      'recOrder',
      tCommon('auditCard.recordOrder'),
      'generic',
      props.recOrder,
      props.recOrder !== undefined,
      normalized.recOrder,
      { hideWhenEmpty: true, defaultVisible: false },
    ),
    buildRow(
      'recNotes',
      tCommon('auditCard.recordNotes'),
      'generic',
      props.recNotes,
      props.recNotes !== undefined,
      normalized.recNotes,
      { hideWhenEmpty: true, defaultVisible: false },
    ),
    ...(props.extras ?? []).map<RenderableAuditRow>((row) => ({
      key: row.key,
      label: row.label,
      value: row.value,
      kind: 'generic',
      hideWhenEmpty: row.hideWhenEmpty ?? false,
      defaultVisible: row.defaultVisible ?? false,
      present: true,
    })),
  ].filter(shouldRenderRow)

  const alwaysVisibleOptionalRows = optionalRows.filter((row) => row.defaultVisible)
  const collapsibleRows = optionalRows.filter((row) => !row.defaultVisible)
  const hasCollapsibleRows = collapsibleRows.length > 0

  const visibleRows = [
    ...coreRows,
    ...alwaysVisibleOptionalRows,
    ...(collapsibleExtras && !isExpanded ? [] : collapsibleRows),
  ]

  if (visibleRows.length === 0 && !hasCollapsibleRows) {
    return null
  }

  return (
    <CmxCard className={cn('border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]', props.className)}>
      <CmxCardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CmxCardTitle className="text-sm font-semibold">{title}</CmxCardTitle>
        {collapsibleExtras && hasCollapsibleRows && (
          <CmxButton
            type="button"
            variant="ghost"
            size="sm"
            aria-expanded={isExpanded}
            onClick={() => setIsExpanded((previous) => !previous)}
            className="shrink-0 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]"
          >
            {isExpanded ? tCommon('auditCard.showLess') : tCommon('auditCard.showMore')}
            {isExpanded ? (
              <ChevronUp className="ms-1 h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="ms-1 h-3.5 w-3.5" />
            )}
          </CmxButton>
        )}
      </CmxCardHeader>
      <CmxCardContent>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {visibleRows.map((row) => (
            <AuditInfoRow
              key={row.key}
              label={row.label}
              value={renderRowValue(row.value, row.kind, locale, notAvailableLabel)}
            />
          ))}
        </dl>
      </CmxCardContent>
    </CmxCard>
  )
}

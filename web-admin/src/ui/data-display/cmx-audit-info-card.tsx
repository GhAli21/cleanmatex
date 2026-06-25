'use client'

/**
 * Reusable audit metadata card for detail screens and dialogs.
 *
 * Keeps audit information visually secondary while giving feature screens one
 * shared place to render row metadata consistently across EN/AR layouts.
 */

import { Fragment, useState, type ReactNode } from 'react'
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
      phone?: string | null
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

/**
 * Row values may carry an AuditActor for actor-kind rows; renderRowValue
 * resolves the actor at render time (other kinds carry ReactNode/Date).
 */
type AuditRowValue = ReactNode | Date | AuditActor | null | undefined

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
  value: AuditRowValue
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
    phone: typeof actor.phone === 'string' ? actor.phone : null,
  }
}

function normalizeActorFromRecord(
  record: Record<string, unknown> | undefined,
  actorKeys: string[],
  labelKeys: string[],
  displayNameKeys: string[],
  emailKeys: string[],
  phoneKeys: string[],
): NormalizedField<AuditActor | null> {
  const actorField = readKnownField<unknown>(record, actorKeys)

  if (!actorField.present) {
    return { present: false, value: null }
  }

  const normalizedActor = normalizeActor(actorField.value)
  const labelField = readKnownField<string>(record, labelKeys)
  const displayNameField = readKnownField<string>(record, displayNameKeys)
  const emailField = readKnownField<string>(record, emailKeys)
  const phoneField = readKnownField<string>(record, phoneKeys)

  if (normalizedActor == null || typeof normalizedActor === 'string') {
    const fallbackId: string | null =
      typeof normalizedActor === 'string' ? normalizedActor : null

    return {
      present: true,
      value: {
        id: fallbackId,
        label: labelField.value,
        displayName: displayNameField.value,
        email: emailField.value,
        phone: phoneField.value,
      },
    }
  }

  return {
    present: true,
    value: {
      id: normalizedActor.id,
      label: normalizedActor.label ?? labelField.value,
      displayName: normalizedActor.displayName ?? displayNameField.value,
      email: normalizedActor.email ?? emailField.value,
      phone: normalizedActor.phone ?? phoneField.value,
    },
  }
}

function normalizeAuditRecord(record?: Record<string, unknown>): NormalizedAuditRecord {
  const createdBy = normalizeActorFromRecord(
    record,
    ['createdBy', 'created_by'],
    ['createdByLabel', 'created_by_label'],
    ['createdByName', 'created_by_name', 'createdByDisplayName', 'created_by_display_name'],
    ['createdByEmail', 'created_by_email'],
    ['createdByPhone', 'created_by_phone'],
  )
  const updatedBy = normalizeActorFromRecord(
    record,
    ['updatedBy', 'updated_by'],
    ['updatedByLabel', 'updated_by_label'],
    ['updatedByName', 'updated_by_name', 'updatedByDisplayName', 'updated_by_display_name'],
    ['updatedByEmail', 'updated_by_email'],
    ['updatedByPhone', 'updated_by_phone'],
  )

  return {
    createdAt: readKnownField<string | Date>(record, ['createdAt', 'created_at']),
    createdBy,
    updatedAt: readKnownField<string | Date>(record, ['updatedAt', 'updated_at']),
    updatedBy,
    createdInfo: readKnownField<ReactNode>(record, ['createdInfo', 'created_info']),
    updatedInfo: readKnownField<ReactNode>(record, ['updatedInfo', 'updated_info']),
    recStatus: readKnownField<ReactNode>(record, ['recStatus', 'rec_status']),
    recOrder: readKnownField<ReactNode>(record, ['recOrder', 'rec_order']),
    recNotes: readKnownField<ReactNode>(record, ['recNotes', 'rec_notes']),
  }
}

function isValueEmpty(value: AuditRowValue): boolean {
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

function resolveActorMeta(actor: AuditActor | null | undefined): {
  primary: string | null
  secondary: string | null
  tertiary: string | null
} {
  if (actor == null) {
    return { primary: null, secondary: null, tertiary: null }
  }

  if (typeof actor === 'string') {
    const raw = actor.trim() || null
    return { primary: raw, secondary: null, tertiary: null }
  }

  const primary = resolveActorLabel(actor)
  const email = actor.email?.trim() || null
  const phone = actor.phone?.trim() || null
  const id = actor.id?.trim() || null

  if (!primary) {
    return { primary: null, secondary: null, tertiary: null }
  }

  const contactParts = [email, phone].filter((part) => !!part && part !== primary)
  const secondary = contactParts.length > 0 ? contactParts.join(' • ') : null
  const tertiary = id && id !== primary && id !== secondary ? id : null

  return { primary, secondary, tertiary }
}

function renderRowValue(
  value: AuditRowValue,
  kind: AuditRowKind,
  locale: 'en' | 'ar',
  notAvailableLabel: string,
): ReactNode {
  if (kind === 'actor') {
    const actorMeta = resolveActorMeta(value as AuditActor | null | undefined)

    if (!actorMeta.primary) {
      return notAvailableLabel
    }

    return (
      <Fragment>
        <span className="block">{actorMeta.primary}</span>
        {actorMeta.secondary ? (
          <span className="mt-1 block text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {actorMeta.secondary}
          </span>
        ) : null}
        {actorMeta.tertiary ? (
          <span className="mt-1 block text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {actorMeta.tertiary}
          </span>
        ) : null}
      </Fragment>
    )
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

  // Non-actor kinds never hold an AuditActor at runtime (actor kind returns above).
  return isValueEmpty(value) ? notAvailableLabel : (value as ReactNode)
}

function buildRow(
  key: string,
  label: string,
  kind: AuditRowKind,
  explicitValue: AuditRowValue,
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
 * @param props
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

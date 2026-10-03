import type { CashDrawerCatalogsV2, DispositionDecisionInput } from '@features/cash-drawers/api/cash-drawer-api'

/**
 * Pure rules for the closing-cash disposition form, shared by the close wizard and the supervisor
 * force-close dialog so the two can never disagree on what a valid disposition is. No I/O, no UI.
 */

export interface DispositionFormRow {
  dispositionCode: string
  destDrawerId: string
  keptAmount: string
  dispositionNotes: string
}

export const EMPTY_DISPOSITION_ROW: DispositionFormRow = {
  dispositionCode: '',
  destDrawerId: '',
  keptAmount: '',
  dispositionNotes: '',
}

export type DispositionCatalogEntry = CashDrawerCatalogsV2['dispositions'][number]

/** Keys under `billing.cashDrawers.wizard.*` that explain why a disposition form is not submittable. */
export type DispositionValidationError =
  | 'dispositionRequired'
  | 'destinationRequired'
  | 'dispositionNotesRequired'
  | 'keptAmountRequired'

export interface DispositionPayloadResult {
  payload: DispositionDecisionInput[]
  error: DispositionValidationError | null
}

/**
 * Validates one disposition row per currency against the catalog and builds the API payload.
 * The first failing rule wins (the form shows one inline message at a time).
 *
 * @param currencyCodes currencies that need a disposition (one row each)
 * @param rows the form state keyed by currency
 * @param catalog selectable dispositions with their rules (`cashMoveMode`, notes, kept amount)
 * @returns the payload, or the first validation error (payload then holds the rows built so far)
 * @example
 * const { payload, error } = buildDispositionPayload(['OMR'], rows, catalogs.dispositions)
 */
export function buildDispositionPayload(
  currencyCodes: readonly string[],
  rows: Record<string, DispositionFormRow>,
  catalog: readonly DispositionCatalogEntry[]
): DispositionPayloadResult {
  const payload: DispositionDecisionInput[] = []

  for (const currencyCode of currencyCodes) {
    const row = rows[currencyCode]
    if (!row?.dispositionCode) return { payload, error: 'dispositionRequired' }

    const disposition = catalog.find((d) => d.code === row.dispositionCode)
    if (disposition && disposition.cashMoveMode !== 'NONE' && !row.destDrawerId) {
      return { payload, error: 'destinationRequired' }
    }
    if (disposition?.requiresNotes && !row.dispositionNotes.trim()) {
      return { payload, error: 'dispositionNotesRequired' }
    }
    if (disposition?.requiresKeptAmount) {
      const kept = Number(row.keptAmount)
      if (row.keptAmount.trim() === '' || !Number.isFinite(kept) || kept < 0) {
        return { payload, error: 'keptAmountRequired' }
      }
    }

    payload.push({
      currencyCode,
      dispositionCode: row.dispositionCode,
      dispositionNotes: row.dispositionNotes.trim() || undefined,
      destDrawerId: row.destDrawerId || undefined,
      keptAmount: disposition?.requiresKeptAmount ? Number(row.keptAmount) : undefined,
    })
  }

  return { payload, error: null }
}

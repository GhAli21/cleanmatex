/**
 * Utility functions for CmxEditableDataTable
 * @module ui/data-display
 */

import { z } from 'zod'
import type {
  RowState,
  TableChanges,
  SchemaValidator,
  CellValidator,
  AsyncRowValidator,
} from './cmx-editable-datatable.types'

/**
 * Layer 1: Schema-level validation (Zod)
 * Validates structure and base constraints
 */
export function validateWithSchema<TData extends Record<string, any>>(
  schema: SchemaValidator<TData>,
  row: TData
): Record<string, string> | null {
  const result = schema.safeParse(row)
  if (result.success) return null

  const errors: Record<string, string> = {}
  result.error.issues.forEach((err) => {
    const path = err.path.join('.')
    errors[path] = err.message
  })
  return errors
}

/**
 * Layer 2: Cell-level validation
 * Runs per-column custom logic that may depend on other fields
 */
export async function validateCell<TData extends Record<string, any>>(
  columnId: string,
  value: any,
  row: TData,
  cellValidator?: CellValidator<TData>
): Promise<string | null> {
  if (!cellValidator) return null
  return await cellValidator(value, row, columnId)
}

/**
 * Layer 3: Async/Server validation
 * Handles backend checks: uniqueness, business rules, tenant context
 */
export async function validateRowAsync<TData extends Record<string, any>>(
  row: TData,
  isNew: boolean,
  asyncValidator?: AsyncRowValidator<TData>
): Promise<Record<string, string> | null> {
  if (!asyncValidator) return null
  return await asyncValidator(row, isNew)
}

/**
 * Orchestrates three-layer validation
 * Runs all validation layers and combines errors
 */
export async function validateRow<TData extends Record<string, any>>(
  row: TData,
  isNew: boolean,
  schema?: SchemaValidator<TData>,
  cellValidators?: Record<string, CellValidator<TData>>,
  asyncValidator?: AsyncRowValidator<TData>
): Promise<Record<string, string> | null> {
  const errors: Record<string, string> = {}

  // Layer 1: Schema validation
  if (schema) {
    const schemaErrors = validateWithSchema(schema, row)
    if (schemaErrors) Object.assign(errors, schemaErrors)
  }

  // Layer 2: Cell-level validators (run for all editable cells)
  if (cellValidators) {
    for (const [columnId, validator] of Object.entries(cellValidators)) {
      const value = row[columnId]
      const cellError = await validateCell(columnId, value, row, validator)
      if (cellError) {
        errors[columnId] = cellError
      }
    }
  }

  // Layer 3: Async/Server validation
  if (asyncValidator) {
    const asyncErrors = await validateRowAsync(row, isNew, asyncValidator)
    if (asyncErrors) Object.assign(errors, asyncErrors)
  }

  return Object.keys(errors).length > 0 ? errors : null
}

/**
 * Check if two objects are deeply equal (for dirty state detection)
 */
export function isEqual<TData extends Record<string, any>>(
  a: TData,
  b: TData
): boolean {
  if (a === b) return true
  if (!a || !b) return false

  const keysA = Object.keys(a)
  const keysB = Object.keys(b)

  if (keysA.length !== keysB.length) return false

  for (const key of keysA) {
    if (a[key] !== b[key]) {
      // Handle nested objects
      if (
        typeof a[key] === 'object' &&
        typeof b[key] === 'object' &&
        a[key] !== null &&
        b[key] !== null
      ) {
        if (!isEqual(a[key], b[key])) return false
      } else {
        return false
      }
    }
  }

  return true
}

/**
 * Get row ID from row data
 */
export function getRowId<TData extends Record<string, any>>(
  row: TData,
  getRowIdFn?: (row: TData) => string | number
): string | number {
  if (getRowIdFn) return getRowIdFn(row)
  // Default: try 'id' field
  if ('id' in row && row.id != null) return row.id as string | number
  // Fallback: generate temporary ID for new rows
  return `temp-${Date.now()}-${Math.random()}`
}

/**
 * Track changes in table
 */
export function trackChanges<TData extends Record<string, any>>(
  rowsState: Map<string | number, RowState<TData>>,
  getRowIdFn?: (row: TData) => string | number
): TableChanges<TData> {
  const changes: TableChanges<TData> = {
    new: [],
    modified: [],
    deleted: [],
  }

  Array.from(rowsState.entries()).forEach(([rowId, rowState]) => {
    if (rowState.state === 'deleted') {
      changes.deleted.push({
        id: rowId,
        data: rowState.original,
      })
    } else if (rowState.isNew) {
      changes.new.push(rowState.current)
    } else if (rowState.isDirty && !isEqual(rowState.original, rowState.current)) {
      changes.modified.push({
        original: rowState.original,
        updated: rowState.current,
      })
    }
  })

  return changes
}

/**
 * Check if there are any pending changes
 */
export function hasPendingChanges<TData extends Record<string, any>>(
  rowsState: Map<string | number, RowState<TData>>
): boolean {
  return Array.from(rowsState.values()).some((rowState) => {
    return (
      rowState.isNew ||
      (rowState.isDirty && !isEqual(rowState.original, rowState.current)) ||
      rowState.state === 'deleted'
    )
  })
}

/**
 * Create initial row state
 */
export function createRowState<TData extends Record<string, any>>(
  row: TData,
  isNew = false
): RowState<TData> {
  return {
    original: isNew ? ({} as TData) : { ...row },
    current: { ...row },
    state: 'idle',
    isNew,
    isDirty: false,
  }
}

/**
 * Update row state
 */
export function updateRowState<TData extends Record<string, any>>(
  currentState: RowState<TData>,
  updates: Partial<RowState<TData>>
): RowState<TData> {
  return {
    ...currentState,
    ...updates,
    // Recalculate isDirty if current or original changed
    isDirty:
      updates.current !== undefined || updates.original !== undefined
        ? !isEqual(
            updates.current ?? currentState.current,
            updates.original ?? currentState.original
          )
        : currentState.isDirty,
  }
}

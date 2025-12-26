/**
 * Validation hooks for CmxEditableDataTable
 * @module ui/data-display
 */

import { useCallback } from 'react'
import type {
  SchemaValidator,
  CellValidator,
  AsyncRowValidator,
} from './cmx-editable-datatable.types'
import { validateRow, validateCell } from './cmx-editable-datatable.utils'

/**
 * Hook for row-level validation (orchestrates all three layers)
 */
export function useRowValidation<TData extends Record<string, any>>(
  schema?: SchemaValidator<TData>,
  cellValidators?: Record<string, CellValidator<TData>>,
  asyncValidator?: AsyncRowValidator<TData>
) {
  const validate = useCallback(
    async (row: TData, isNew: boolean): Promise<Record<string, string> | null> => {
      return await validateRow(row, isNew, schema, cellValidators, asyncValidator)
    },
    [schema, cellValidators, asyncValidator]
  )

  return { validate }
}

/**
 * Hook for cell-level validation (Layer 2)
 */
export function useCellValidation<TData extends Record<string, any>>(
  cellValidators?: Record<string, CellValidator<TData>>
) {
  const validateCellValue = useCallback(
    async (
      columnId: string,
      value: any,
      row: TData
    ): Promise<string | null> => {
      if (!cellValidators || !cellValidators[columnId]) return null
      return await validateCell(columnId, value, row, cellValidators[columnId])
    },
    [cellValidators]
  )

  return { validateCellValue }
}

/**
 * Hook for async/server validation (Layer 3)
 */
export function useAsyncValidation<TData extends Record<string, any>>(
  asyncValidator?: AsyncRowValidator<TData>
) {
  const validateAsync = useCallback(
    async (
      row: TData,
      isNew: boolean
    ): Promise<Record<string, string> | null> => {
      if (!asyncValidator) return null
      return await asyncValidator(row, isNew)
    },
    [asyncValidator]
  )

  return { validateAsync }
}

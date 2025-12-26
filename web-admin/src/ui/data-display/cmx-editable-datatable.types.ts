/**
 * Type definitions for CmxEditableDataTable
 * @module ui/data-display
 */

import { ColumnDef } from '@tanstack/react-table'
import { z } from 'zod'
import { ReactNode } from 'react'

// Row state types
export type RowStateType = 'idle' | 'editing' | 'saving' | 'error' | 'deleted'

export interface RowState<TData extends Record<string, any>> {
  original: TData
  current: TData
  state: RowStateType
  errors?: Record<string, string> // Field-level errors
  rowError?: string // Row-level error
  isNew?: boolean
  isDirty?: boolean
}

// Change tracking
export interface TableChanges<TData extends Record<string, any>> {
  new: TData[]
  modified: Array<{ original: TData; updated: TData }>
  deleted: Array<{ id: string | number; data: TData }>
}

export interface BulkSaveResult<TData extends Record<string, any>> {
  success: TData[]
  failed: Array<{ row: TData; error: string }>
}

// Error handling
export interface TableError {
  type: 'save' | 'delete' | 'bulk_save' | 'validation'
  message: string
  rowId?: string | number
  field?: string
  originalError?: Error
}

export interface ErrorContext<TData extends Record<string, any>> {
  operation: 'create' | 'update' | 'delete' | 'bulk_save'
  row?: TData
  changes?: TableChanges<TData>
}

// Validation types (Three-Layer System)
// Layer 1: Schema-level (Zod) - structure & base rules
export type SchemaValidator<TData> = z.ZodSchema<TData>

// Layer 2: Cell-level callbacks - custom per-column logic
export type CellValidator<TData> = (
  value: any,
  row: TData,
  columnId: string
) => string | null | Promise<string | null>

// Layer 3: Async/Server validation - backend checks
export type AsyncRowValidator<TData> = (
  row: TData,
  isNew: boolean
) => Promise<Record<string, string> | null>

// Column definition extension
export interface EditableColumnDef<TData extends Record<string, any>>
  extends Omit<ColumnDef<TData>, 'cell'> {
  editable?: boolean
  renderEditCell?: (props: {
    value: any
    row: TData
    rowId: string | number
    onChange: (value: any) => void
    onBlur?: () => void
    error?: string
  }) => ReactNode
  // Optional: column-specific validator (Layer 2)
  validate?: (
    value: any,
    row: TData
  ) => string | null | Promise<string | null>
  // Allow cell override
  cell?: ColumnDef<TData>['cell']
}

// Main component props
export interface CmxEditableDataTableProps<
  TData extends Record<string, any> = Record<string, any>
> {
  // Data
  data: TData[]
  columns: EditableColumnDef<TData>[]
  getRowId?: (row: TData) => string | number

  // CRUD Operations
  onSave?: (row: TData, originalRow?: TData) => Promise<TData>
  onBulkSave?: (
    changes: TableChanges<TData>
  ) => Promise<BulkSaveResult<TData>>
  onDelete?: (rowId: string | number) => Promise<void>
  onSoftRemove?: (rowId: string | number) => Promise<void>

  // Three-Layer Validation System
  // Layer 1: Schema-level (Zod) - structure & base rules
  validationSchema?: SchemaValidator<TData>

  // Layer 2: Cell-level callbacks - custom per-column logic
  cellValidators?: Record<string, CellValidator<TData>>

  // Layer 3: Async/Server validation - backend checks
  asyncRowValidator?: AsyncRowValidator<TData>

  // Error Handling
  onError?: (error: TableError, context: ErrorContext<TData>) => void

  // UI Configuration
  enableInlineAdd?: boolean
  enableBulkSave?: boolean
  enableSoftDelete?: boolean
  showActionsColumn?: boolean
  newRowPosition?: 'top' | 'bottom'

  // Standard table props
  loading?: boolean
  page?: number
  pageSize?: number
  total?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
}

/**
 * CmxEditableDataTable - Editable data table with inline editing, insertion, deletion
 * @module ui/data-display
 */

'use client'

import { useState, useMemo, useCallback } from 'react'
import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import { CmxSpinner } from '../primitives/cmx-spinner'
import { CmxButton } from '../primitives/cmx-button'
import { CmxConfirmDialog } from '../feedback/cmx-confirm-dialog'
import { showErrorToast, showSuccessToast } from '../components/cmx-toast'
import { Edit2, Save, X, Trash2, Plus, RotateCcw } from 'lucide-react'
import type {
  CmxEditableDataTableProps,
  EditableColumnDef,
  RowState,
  TableError,
  ErrorContext,
} from './cmx-editable-datatable.types'
import {
  getRowId as getRowIdUtil,
  trackChanges,
  hasPendingChanges,
  createRowState,
  updateRowState,
  isEqual,
  validateRow,
} from './cmx-editable-datatable.utils'
import { useRowValidation } from './cmx-editable-datatable.hooks'
import { cn } from '@/lib/utils'

export function CmxEditableDataTable<
  TData extends Record<string, any> = Record<string, any>
>({
  data,
  columns,
  getRowId,
  onSave,
  onBulkSave,
  onDelete,
  onSoftRemove,
  validationSchema,
  cellValidators,
  asyncRowValidator,
  onError,
  enableInlineAdd = false,
  enableBulkSave = false,
  enableSoftDelete = false,
  showActionsColumn = true,
  newRowPosition = 'top',
  loading = false,
  page = 0,
  pageSize = 10,
  total,
  onPageChange,
  onPageSizeChange,
}: CmxEditableDataTableProps<TData>) {
  // State management
  const [rowsState, setRowsState] = useState<
    Map<string | number, RowState<TData>>
  >(new Map())
  const [editingRowId, setEditingRowId] = useState<string | number | null>(null)

  // Initialize rows state from data
  useMemo(() => {
    const newRowsState = new Map<string | number, RowState<TData>>()
    data.forEach((row) => {
      const id = getRowIdUtil(row, getRowId)
      if (!rowsState.has(id)) {
        newRowsState.set(id, createRowState(row, false))
      } else {
        // Preserve existing state but update current/original if data changed
        const existing = rowsState.get(id)!
        newRowsState.set(id, {
          ...existing,
          original: { ...row },
          current: existing.state === 'editing' ? existing.current : { ...row },
        })
      }
    })
    setRowsState(newRowsState)
  }, [data, getRowId])

  // Validation hook
  const { validate } = useRowValidation(
    validationSchema,
    cellValidators,
    asyncRowValidator
  )

  // Get current data (merged with row states)
  const currentData = useMemo(() => {
    return data.map((row) => {
      const id = getRowIdUtil(row, getRowId)
      const state = rowsState.get(id)
      if (state && state.state !== 'deleted') {
        return state.current
      }
      return row
    })
  }, [data, rowsState, getRowId])

  // Handle cell value change
  const handleCellChange = useCallback(
    (rowId: string | number, columnId: string, value: any) => {
      setRowsState((prev) => {
        const state = prev.get(rowId)
        if (!state) return prev

        const newState = updateRowState(state, {
          current: {
            ...state.current,
            [columnId]: value,
          },
        })

        const updated = new Map(prev)
        updated.set(rowId, newState)
        return updated
      })
    },
    []
  )

  // Handle cell blur (validate cell)
  const handleCellBlur = useCallback(
    async (rowId: string | number, columnId: string) => {
      const state = rowsState.get(rowId)
      if (!state || !cellValidators?.[columnId]) return

      const cellError = await cellValidators[columnId](
        state.current[columnId],
        state.current,
        columnId
      )

      if (cellError) {
        setRowsState((prev) => {
          const state = prev.get(rowId)
          if (!state) return prev

          const updated = new Map(prev)
          updated.set(rowId, {
            ...state,
            errors: {
              ...state.errors,
              [columnId]: cellError,
            },
          })
          return updated
        })
      }
    },
    [rowsState, cellValidators]
  )

  // Start editing a row
  const startEditing = useCallback((rowId: string | number) => {
    setEditingRowId(rowId)
    setRowsState((prev) => {
      const state = prev.get(rowId)
      if (!state) return prev

      const updated = new Map(prev)
      updated.set(rowId, {
        ...state,
        state: 'editing',
      })
      return updated
    })
  }, [])

  // Cancel editing
  const cancelEditing = useCallback(
    (rowId: string | number) => {
      setEditingRowId(null)
      setRowsState((prev) => {
        const state = prev.get(rowId)
        if (!state) return prev

        const updated = new Map(prev)
        updated.set(rowId, {
          ...state,
          state: 'idle',
          current: { ...state.original },
          errors: undefined,
          isDirty: false,
        })
        return updated
      })
    },
    []
  )

  // Save a row
  const handleSave = useCallback(
    async (rowId: string | number) => {
      const state = rowsState.get(rowId)
      if (!state || !onSave) return

      // Validate before save
      const errors = await validate(state.current, !!state.isNew)
      if (errors) {
        setRowsState((prev) => {
          const updated = new Map(prev)
          const currentState = prev.get(rowId)
          if (currentState) {
            updated.set(rowId, {
              ...currentState,
              state: 'error',
              errors,
            })
          }
          return updated
        })

        const error: TableError = {
          type: 'validation',
          message: 'Validation failed',
          rowId,
        }
        onError?.(error, {
          operation: state.isNew ? 'create' : 'update',
          row: state.current,
        })
        return
      }

      // Set saving state
      setRowsState((prev) => {
        const updated = new Map(prev)
        const currentState = prev.get(rowId)
        if (currentState) {
          updated.set(rowId, {
            ...currentState,
            state: 'saving',
          })
        }
        return updated
      })

      try {
        const savedRow = await onSave(
          state.current,
          state.isNew ? undefined : state.original
        )

        // Update state with saved row
        setRowsState((prev) => {
          const updated = new Map(prev)
          updated.set(rowId, {
            original: { ...savedRow },
            current: { ...savedRow },
            state: 'idle',
            isNew: false,
            isDirty: false,
            errors: undefined,
          })
          return updated
        })

        setEditingRowId(null)
        showSuccessToast('Row saved successfully')
      } catch (error) {
        const tableError: TableError = {
          type: 'save',
          message: error instanceof Error ? error.message : 'Failed to save row',
          rowId,
          originalError: error instanceof Error ? error : undefined,
        }

        setRowsState((prev) => {
          const updated = new Map(prev)
          const currentState = prev.get(rowId)
          if (currentState) {
            updated.set(rowId, {
              ...currentState,
              state: 'error',
              rowError: tableError.message,
            })
          }
          return updated
        })

        onError?.(tableError, {
          operation: state.isNew ? 'create' : 'update',
          row: state.current,
        })
        showErrorToast(tableError.message)
      }
    },
    [rowsState, onSave, validate, onError]
  )

  // Delete a row
  const handleDelete = useCallback(
    async (rowId: string | number) => {
      if (!onDelete) return

      try {
        await onDelete(rowId)
        setRowsState((prev) => {
          const updated = new Map(prev)
          updated.delete(rowId)
          return updated
        })
        showSuccessToast('Row deleted successfully')
      } catch (error) {
        const tableError: TableError = {
          type: 'delete',
          message:
            error instanceof Error ? error.message : 'Failed to delete row',
          rowId,
          originalError: error instanceof Error ? error : undefined,
        }
        onError?.(tableError, {
          operation: 'delete',
        })
        showErrorToast(tableError.message)
      }
    },
    [onDelete, onError]
  )

  // Soft remove a row
  const handleSoftRemove = useCallback(
    async (rowId: string | number) => {
      if (!onSoftRemove) return

      try {
        await onSoftRemove(rowId)
        setRowsState((prev) => {
          const updated = new Map(prev)
          const state = prev.get(rowId)
          if (state) {
            updated.set(rowId, {
              ...state,
              state: 'deleted',
            })
          }
          return updated
        })
        showSuccessToast('Row removed successfully')
      } catch (error) {
        const tableError: TableError = {
          type: 'delete',
          message:
            error instanceof Error ? error.message : 'Failed to remove row',
          rowId,
          originalError: error instanceof Error ? error : undefined,
        }
        onError?.(tableError, {
          operation: 'delete',
        })
        showErrorToast(tableError.message)
      }
    },
    [onSoftRemove, onError]
  )

  // Add new row
  const handleAddRow = useCallback(() => {
    const tempId = `new-${Date.now()}-${Math.random()}`
    const newRow = {} as TData

    setRowsState((prev) => {
      const updated = new Map(prev)
      updated.set(tempId, createRowState(newRow, true))
      return updated
    })

    setEditingRowId(tempId)
    startEditing(tempId)
  }, [startEditing])

  // Bulk save
  const handleBulkSave = useCallback(async () => {
    if (!onBulkSave) return

    const changes = trackChanges(rowsState, getRowId)
    if (changes.new.length === 0 && changes.modified.length === 0) {
      return
    }

    try {
      const result = await onBulkSave(changes)

      // Update successful rows
      result.success.forEach((savedRow) => {
        const id = getRowIdUtil(savedRow, getRowId)
        setRowsState((prev) => {
          const updated = new Map(prev)
          updated.set(id, {
            original: { ...savedRow },
            current: { ...savedRow },
            state: 'idle',
            isNew: false,
            isDirty: false,
            errors: undefined,
          })
          return updated
        })
      })

      // Mark failed rows
      result.failed.forEach(({ row, error }) => {
        const id = getRowIdUtil(row, getRowId)
        setRowsState((prev) => {
          const updated = new Map(prev)
          const state = prev.get(id)
          if (state) {
            updated.set(id, {
              ...state,
              state: 'error',
              rowError: error,
            })
          }
          return updated
        })
      })

      setEditingRowId(null)
      showSuccessToast(
        `Saved ${result.success.length} row(s)${result.failed.length > 0 ? `, ${result.failed.length} failed` : ''}`
      )
    } catch (error) {
      const tableError: TableError = {
        type: 'bulk_save',
        message:
          error instanceof Error ? error.message : 'Failed to save changes',
        originalError: error instanceof Error ? error : undefined,
      }
      onError?.(tableError, {
        operation: 'bulk_save',
        changes,
      })
      showErrorToast(tableError.message)
    }
  }, [rowsState, onBulkSave, getRowId, onError])

  // Build columns with editable cells and actions
  const tableColumns = useMemo(() => {
    const cols: ColumnDef<TData>[] = (columns.map((col) => {
      const editableCol = col as EditableColumnDef<TData>
      const isEditable = editableCol.editable !== false && editableCol.editable

      return {
        ...col,
        cell: (info: any) => {
          const row = info.row.original
          const rowId = getRowIdUtil(row, getRowId)
          const state = rowsState.get(rowId)
          const isEditing = editingRowId === rowId && state?.state === 'editing'
          const cellValue = state?.current?.[info.column.id] ?? row[info.column.id]
          const cellError = state?.errors?.[info.column.id]

          if (isEditing && isEditable && editableCol.renderEditCell) {
            return editableCol.renderEditCell({
              value: cellValue,
              row: state?.current ?? row,
              rowId,
              onChange: (value) => handleCellChange(rowId, info.column.id, value),
              onBlur: () => handleCellBlur(rowId, info.column.id),
              error: cellError,
            })
          }

          // Default cell renderer
          if (editableCol.cell && typeof editableCol.cell === 'function') {
            return editableCol.cell(info)
          }
          return cellValue
        },
      } as ColumnDef<TData>
    }) as any) as ColumnDef<TData>[]

    // Add actions column
    if (showActionsColumn) {
      cols.push({
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const row = info.row.original
          const rowId = getRowIdUtil(row, getRowId)
          const state = rowsState.get(rowId)
          const isEditing = editingRowId === rowId && state?.state === 'editing'
          const isSaving = state?.state === 'saving'
          const isDeleted = state?.state === 'deleted'

          if (isDeleted) {
            return (
              <div className="flex items-center gap-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
                Deleted
              </div>
            )
          }

          return (
            <div className="flex items-center gap-1">
              {isEditing ? (
                <>
                  <CmxButton
                    size="xs"
                    variant="primary"
                    loading={isSaving}
                    onClick={() => handleSave(rowId)}
                    title="Save"
                  >
                    <Save className="h-3 w-3" />
                  </CmxButton>
                  <CmxButton
                    size="xs"
                    variant="ghost"
                    onClick={() => cancelEditing(rowId)}
                    disabled={isSaving}
                    title="Cancel"
                  >
                    <X className="h-3 w-3" />
                  </CmxButton>
                </>
              ) : (
                <>
                  <CmxButton
                    size="xs"
                    variant="ghost"
                    onClick={() => startEditing(rowId)}
                    title="Edit"
                  >
                    <Edit2 className="h-3 w-3" />
                  </CmxButton>
                  {onDelete && (
                    <CmxConfirmDialog
                      title="Delete Row"
                      description="Are you sure you want to delete this row? This action cannot be undone."
                      onConfirm={() => handleDelete(rowId)}
                      trigger={
                        <CmxButton size="xs" variant="ghost" title="Delete">
                          <Trash2 className="h-3 w-3 text-[rgb(var(--cmx-destructive-rgb,220_38_38))]" />
                        </CmxButton>
                      }
                    />
                  )}
                  {enableSoftDelete && onSoftRemove && (
                    <CmxConfirmDialog
                      title="Remove Row"
                      description="This will soft-delete the row. It can be restored later."
                      onConfirm={() => handleSoftRemove(rowId)}
                      trigger={
                        <CmxButton size="xs" variant="ghost" title="Soft Remove">
                          <RotateCcw className="h-3 w-3" />
                        </CmxButton>
                      }
                    />
                  )}
                </>
              )}
            </div>
          )
        },
      } as ColumnDef<TData>)
    }

    return cols as ColumnDef<TData>[]
  }, [
    columns,
    rowsState,
    editingRowId,
    showActionsColumn,
    getRowId,
    handleCellChange,
    handleCellBlur,
    handleSave,
    cancelEditing,
    startEditing,
    handleDelete,
    handleSoftRemove,
    enableSoftDelete,
    onDelete,
    onSoftRemove,
  ])

  // Filter out deleted rows
  const visibleData = useMemo(() => {
    return currentData.filter((row) => {
      const id = getRowIdUtil(row, getRowId)
      const state = rowsState.get(id)
      return state?.state !== 'deleted'
    })
  }, [currentData, rowsState, getRowId])

  // TanStack Table setup
  const table = useReactTable({
    data: visibleData,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: total !== undefined,
    pageCount: total !== undefined ? Math.ceil(total / pageSize) : undefined,
    state: {
      pagination: { pageIndex: page, pageSize },
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex: page, pageSize })
          : updater
      onPageChange?.(next.pageIndex)
      onPageSizeChange?.(next.pageSize)
    },
  })

  const pendingChangesCount = useMemo(() => {
    return trackChanges(rowsState, getRowId)
  }, [rowsState, getRowId])

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enableInlineAdd && (
            <CmxButton size="sm" variant="primary" onClick={handleAddRow}>
              <Plus className="h-4 w-4 mr-1" />
              Add Row
            </CmxButton>
          )}
          {enableBulkSave &&
            onBulkSave &&
            hasPendingChanges(rowsState) && (
              <CmxButton
                size="sm"
                variant="secondary"
                onClick={handleBulkSave}
              >
                Save All (
                {pendingChangesCount.new.length +
                  pendingChangesCount.modified.length}
                )
              </CmxButton>
            )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]">
        <table className="min-w-full text-sm">
          <thead className="bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))] text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-3 py-2 text-left font-medium">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={tableColumns.length}
                  className="px-3 py-8 text-center text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]"
                >
                  <CmxSpinner />
                </td>
              </tr>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const rowData = row.original
                const rowId = getRowIdUtil(rowData, getRowId)
                const state = rowsState.get(rowId)
                const isNew = state?.isNew
                const isDirty = state?.isDirty
                const hasErrors = state?.errors && Object.keys(state.errors).length > 0
                const rowError = state?.rowError

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-t border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] hover:bg-[rgb(var(--cmx-table-row-hover-bg-rgb,248_250_252))]',
                      isNew && 'bg-blue-50/50',
                      isDirty && 'bg-yellow-50/50',
                      hasErrors && 'bg-red-50/50',
                      rowError && 'bg-red-50/50'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-3 py-2">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                )
              })
            ) : (
              <tr>
                <td
                  colSpan={tableColumns.length}
                  className="px-3 py-8 text-center text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]"
                >
                  No data to display.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Error display */}
      {Array.from(rowsState.entries()).map(([rowId, state]) => {
        if (state.rowError) {
          return (
            <div
              key={rowId}
              className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700"
            >
              Row {rowId}: {state.rowError}
            </div>
          )
        }
        return null
      })}
    </div>
  )
}

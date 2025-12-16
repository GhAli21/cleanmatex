"use client"

import * as React from "react"
import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  ChevronDown,
  Search,
  X,
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
  Download,
  AlertCircle,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Filter,
  GripVertical,
  LayoutGrid,
  Table2,
} from "lucide-react"

import { Button } from "./button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { Input } from "./input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./table"
import { CmxSpinner } from "./cmx-spinner"
import { CmxEmptyState } from "../data-display/cmx-empty-state"
import { Badge } from "./badge"
import { Tooltip } from "./tooltip"
import { cn } from "@/lib/utils"

// Custom debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value)

  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

// Alignment detection utility
function detectAlignment(
  value: unknown,
  columnId: string,
  columnAlignment: "auto" | "left" | "right" | "center",
  columnMeta?: { alignment?: "left" | "right" | "center" }
): "left" | "right" | "center" {
  // Column meta override takes precedence
  if (columnMeta?.alignment) {
    return columnMeta.alignment
  }

  // Explicit alignment prop
  if (columnAlignment !== "auto") {
    return columnAlignment
  }

  // Auto-detect based on data type
  if (columnId === "actions" || columnId === "select") {
    return "center"
  }

  if (typeof value === "number") {
    return "right"
  }

  if (value instanceof Date || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value))) {
    return "left"
  }

  return "left"
}

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  searchKey?: string
  searchPlaceholder?: string
  // Phase 1: Core UX Improvements
  loading?: boolean
  error?: Error | string | null
  onRetry?: () => void
  emptyStateTitle?: string
  emptyStateDescription?: string
  emptyStateAction?: React.ReactNode
  onSearchChange?: (value: string) => void
  // Phase 3: Bulk Actions & Selection
  enableRowSelection?: boolean
  onSelectionChange?: (selectedRows: TData[]) => void
  bulkActions?: React.ReactNode
  // Phase 5: Advanced Features
  defaultColumnVisibility?: VisibilityState
  onColumnVisibilityChange?: (visibility: VisibilityState) => void
  onExport?: (format: "csv" | "excel") => void
  skeletonRows?: number
  translations?: Record<string, string>
  // Phase 1: Visual Clarity
  enableZebraStriping?: boolean
  columnAlignment?: "auto" | "left" | "right" | "center"
  rowHeight?: "compact" | "normal" | "comfortable"
  statusColors?: Record<string, string>
  // Phase 2: Usability
  enableColumnFilters?: boolean
  enableColumnResizing?: boolean
  defaultColumnSizes?: Record<string, number>
  paginationMode?: "pages" | "infinite"
  onLoadMore?: () => Promise<void>
  rowActions?: (row: TData) => React.ReactNode
  // Phase 3: Information Architecture
  columnTooltips?: Record<string, string>
  cellTooltips?: (row: TData, columnId: string) => string | undefined
  summaryView?: boolean
  summaryColumns?: ColumnDef<TData, TValue>[]
  cellErrorRenderer?: (error: Error, row: TData, columnId: string) => React.ReactNode
  validateCell?: (value: unknown, row: TData, columnId: string) => Error | null
  viewMode?: "table" | "card" | "both"
  columnLabels?: Record<string, string>
  headerDescriptions?: Record<string, string>
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = "Search...",
  loading = false,
  error = null,
  onRetry,
  emptyStateTitle = "No results found",
  emptyStateDescription,
  emptyStateAction,
  onSearchChange,
  enableRowSelection = true,
  onSelectionChange,
  bulkActions,
  defaultColumnVisibility,
  onColumnVisibilityChange,
  onExport,
  skeletonRows = 5,
  translations,
  // Phase 1: Visual Clarity
  enableZebraStriping = false,
  columnAlignment = "auto",
  rowHeight = "normal",
  statusColors,
  // Phase 2: Usability
  enableColumnFilters = false,
  enableColumnResizing = false,
  defaultColumnSizes,
  paginationMode = "pages",
  onLoadMore,
  rowActions,
  // Phase 3: Information Architecture
  columnTooltips,
  cellTooltips,
  summaryView = false,
  summaryColumns,
  cellErrorRenderer,
  validateCell,
  viewMode = "table",
  columnLabels,
  headerDescriptions,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>(
    []
  )
  const [columnVisibility, setColumnVisibility] =
    React.useState<VisibilityState>(defaultColumnVisibility || {})
  const [rowSelection, setRowSelection] = React.useState({})
  const [searchValue, setSearchValue] = React.useState("")
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)
  const [currentViewMode, setCurrentViewMode] = React.useState<"table" | "card">(
    viewMode === "both" ? "table" : viewMode
  )
  const loadMoreRef = React.useRef<HTMLDivElement>(null)

  // Debounce search value
  const debouncedSearchValue = useDebounce(searchValue, 300)

  // Column resizing state
  const [columnSizing, setColumnSizing] = React.useState<Record<string, number>>(
    defaultColumnSizes || {}
  )

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: enableRowSelection,
    enableColumnResizing: enableColumnResizing,
    columnResizeMode: "onChange",
    onColumnSizingChange: setColumnSizing,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      columnSizing,
    },
  })

  // Update column visibility when prop changes
  React.useEffect(() => {
    if (defaultColumnVisibility) {
      setColumnVisibility(defaultColumnVisibility)
    }
  }, [defaultColumnVisibility])

  // Notify parent of column visibility changes
  React.useEffect(() => {
    if (onColumnVisibilityChange) {
      onColumnVisibilityChange(columnVisibility)
    }
  }, [columnVisibility, onColumnVisibilityChange])

  // Update search filter when debounced value changes
  React.useEffect(() => {
    if (searchKey) {
      const column = table.getColumn(searchKey)
      if (column) {
        column.setFilterValue(debouncedSearchValue || undefined)
      }
    }
    if (onSearchChange) {
      onSearchChange(debouncedSearchValue)
    }
  }, [debouncedSearchValue, searchKey, onSearchChange, table])

  // Notify parent of selection changes
  React.useEffect(() => {
    if (onSelectionChange) {
      const selectedRows = table
        .getFilteredSelectedRowModel()
        .rows.map((row) => row.original)
      onSelectionChange(selectedRows)
    }
  }, [rowSelection, onSelectionChange, table])

  // Infinite scroll observer
  React.useEffect(() => {
    if (paginationMode !== "infinite" || !onLoadMore || !loadMoreRef.current) {
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isLoadingMore && table.getCanNextPage()) {
          setIsLoadingMore(true)
          onLoadMore()
            .then(() => {
              setIsLoadingMore(false)
            })
            .catch(() => {
              setIsLoadingMore(false)
            })
        }
      },
      { threshold: 0.1 }
    )

    observer.observe(loadMoreRef.current)

    return () => {
      observer.disconnect()
    }
  }, [paginationMode, onLoadMore, isLoadingMore, table])

  const selectedRowCount = Object.keys(rowSelection).length
  const filteredRowCount = table.getFilteredRowModel().rows.length
  const searchColumn = searchKey ? table.getColumn(searchKey) : null
  const currentSearchValue =
    (searchColumn?.getFilterValue() as string) ?? searchValue

  const handleSearchChange = (value: string) => {
    setSearchValue(value)
  }

  const handleClearSearch = () => {
    setSearchValue("")
    if (searchColumn) {
      searchColumn.setFilterValue(undefined)
    }
  }

  const handleExport = (format: "csv" | "excel") => {
    if (onExport) {
      onExport(format)
    } else {
      // Default CSV export
      const rows = table.getFilteredRowModel().rows
      const headers = columns
        .filter((col) => col.id !== "actions" && col.id !== "select")
        .map((col) => (typeof col.header === "string" ? col.header : col.id || ""))
        .join(",")

      const csvRows = rows.map((row) => {
        return columns
          .filter((col) => col.id !== "actions" && col.id !== "select")
          .map((col) => {
            const value = row.getValue(col.id || "")
            return typeof value === "string" ? `"${value.replace(/"/g, '""')}"` : value
          })
          .join(",")
      })

      const csv = [headers, ...csvRows].join("\n")
      const blob = new Blob([csv], { type: "text/csv" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `export-${new Date().toISOString().split("T")[0]}.csv`
      a.click()
      URL.revokeObjectURL(url)
    }
  }

  const t = (key: string, fallback: string): string => {
    return translations?.[key] || fallback
  }

  // Get pagination info
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const totalRows = filteredRowCount
  const startRow = pageIndex * pageSize + 1
  const endRow = Math.min((pageIndex + 1) * pageSize, totalRows)

  return (
    <div className="space-y-4" role="region" aria-label="Data table">
      {/* Toolbar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center space-x-2">
          {searchKey && (
            <div className="relative w-full max-w-sm">
              <Search
                className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                placeholder={searchPlaceholder}
                value={searchValue}
                onChange={(event) => handleSearchChange(event.target.value)}
                className="pl-8 pr-8"
                aria-label={t("searchLabel", "Search table")}
                aria-describedby="search-description"
              />
              <span id="search-description" className="sr-only">
                {t(
                  "searchDescription",
                  "Search and filter table rows. Results update as you type."
                )}
              </span>
              {currentSearchValue && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 h-7 w-7"
                  onClick={handleClearSearch}
                  aria-label={t("clearSearch", "Clear search")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
          {currentSearchValue && (
            <div className="hidden text-sm text-muted-foreground sm:block">
              {t("searchResults", `${filteredRowCount} result${filteredRowCount !== 1 ? "s" : ""}`)}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {viewMode === "both" && (
            <div className="flex items-center border rounded-md">
              <Button
                variant={currentViewMode === "table" ? "default" : "ghost"}
                size="sm"
                className="rounded-r-none"
                onClick={() => setCurrentViewMode("table")}
                aria-label={t("tableView", "Table view")}
              >
                <Table2 className="h-4 w-4" />
              </Button>
              <Button
                variant={currentViewMode === "card" ? "default" : "ghost"}
                size="sm"
                className="rounded-l-none"
                onClick={() => setCurrentViewMode("card")}
                aria-label={t("cardView", "Card view")}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          )}
          {enableColumnFilters && (
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              {t("filters", "Filters")}
              {columnFilters.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {columnFilters.length}
                </Badge>
              )}
            </Button>
          )}
          {onExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  {t("export", "Export")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  {t("exportCsv", "Export as CSV")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("excel")}>
                  {t("exportExcel", "Export as Excel")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="ml-auto">
                {t("columns", "Columns")} <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
              <DropdownMenuLabel>{t("toggleColumns", "Toggle columns")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) =>
                        column.toggleVisibility(!!value)
                      }
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  )
                })}
              {defaultColumnVisibility && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      table.getAllColumns().forEach((column) => {
                        if (column.getCanHide()) {
                          column.toggleVisibility(true)
                        }
                      })
                    }}
                  >
                    {t("showAllColumns", "Show all")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      if (defaultColumnVisibility) {
                        Object.keys(defaultColumnVisibility).forEach((key) => {
                          const column = table.getColumn(key)
                          if (column) {
                            column.toggleVisibility(
                              defaultColumnVisibility[key] ?? true
                            )
                          }
                        })
                      }
                    }}
                  >
                    {t("resetColumns", "Reset to default")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {enableRowSelection && selectedRowCount > 0 && (
        <div
          className="flex items-center justify-between rounded-md border bg-muted/50 px-4 py-2"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <Badge variant="secondary">
              {t("selectedCount", `${selectedRowCount} selected`)}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {t(
                "selectedInfo",
                `${selectedRowCount} of ${filteredRowCount} row${filteredRowCount !== 1 ? "s" : ""} selected`
              )}
            </span>
          </div>
          {bulkActions && <div className="flex items-center gap-2">{bulkActions}</div>}
        </div>
      )}

      {/* Table */}
      <div className="relative rounded-md border shadow-sm">
        {loading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-background/80 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-2">
              <CmxSpinner size="lg" />
              <p className="text-sm text-muted-foreground">
                {t("loading", "Loading...")}
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
            <h3 className="mb-2 text-lg font-semibold">
              {t("errorTitle", "Something went wrong")}
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {typeof error === "string" ? error : error?.message || t("errorMessage", "An error occurred while loading data.")}
            </p>
            {onRetry && (
              <Button onClick={onRetry} variant="outline">
                <RefreshCw className="mr-2 h-4 w-4" />
                {t("retry", "Retry")}
              </Button>
            )}
          </div>
        )}

        {!loading && !error && (
          <>
            {currentViewMode === "card" && viewMode !== "table" ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {table.getRowModel().rows.map((row) => {
                  const rowData = row.original
                  return (
                    <div
                      key={row.id}
                      className="rounded-lg border bg-card p-4 shadow-sm hover:shadow-md transition-shadow"
                    >
                      {columns
                        .filter((col) => col.id !== "actions" && col.id !== "select")
                        .slice(0, 3)
                        .map((column) => {
                          const columnId = column.id || ""
                          const value = row.getValue(columnId)
                          const label =
                            columnLabels?.[columnId] ||
                            (typeof column.header === "string"
                              ? column.header
                              : columnId)

                          return (
                            <div key={columnId} className="mb-3 last:mb-0">
                              <div className="text-xs font-medium text-muted-foreground mb-1">
                                {label}
                              </div>
                              <div className="text-sm">
                                {flexRender(column.cell, {
                                  ...row.getContext(),
                                  getValue: () => value,
                                })}
                              </div>
                            </div>
                          )
                        })}
                      {rowActions && (
                        <div className="mt-4 pt-4 border-t">
                          {rowActions(rowData)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
              <TableHeader className="sticky top-0 z-10 bg-muted/50 backdrop-blur-sm shadow-sm">
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => {
                      const isSorted = header.column.getIsSorted()
                      const canSort = header.column.getCanSort()
                      const columnId = header.column.id
                      const tooltip = columnTooltips?.[columnId] || headerDescriptions?.[columnId]
                      const label = columnLabels?.[columnId] || columnId
                      const headerContent = header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())

                      const headerElement = (
                        <div className="flex items-center gap-2">
                          {typeof headerContent === "string" ? (
                            <span>{headerContent || label}</span>
                          ) : (
                            headerContent
                          )}
                          {canSort && (
                            <div className="flex flex-col">
                              <ArrowUp
                                className={cn(
                                  "h-3 w-3 transition-colors",
                                  isSorted === "asc"
                                    ? "text-primary"
                                    : "text-muted-foreground/30"
                                )}
                              />
                              <ArrowDown
                                className={cn(
                                  "h-3 w-3 -mt-1 transition-colors",
                                  isSorted === "desc"
                                    ? "text-primary"
                                    : "text-muted-foreground/30"
                                )}
                              />
                            </div>
                          )}
                        </div>
                      )

                      return (
                        <TableHead
                          key={header.id}
                          rowHeight={rowHeight}
                          style={{
                            width: enableColumnResizing
                              ? header.getSize()
                              : undefined,
                            position: "relative",
                          }}
                          aria-sort={
                            isSorted === "asc"
                              ? "ascending"
                              : isSorted === "desc"
                                ? "descending"
                                : "none"
                          }
                          className={cn(
                            canSort && "cursor-pointer hover:bg-muted/70",
                            enableColumnResizing && "select-none"
                          )}
                          onClick={() => canSort && header.column.toggleSorting()}
                        >
                          {tooltip ? (
                            <Tooltip content={tooltip} side="top">
                              {headerElement}
                            </Tooltip>
                          ) : (
                            headerElement
                          )}
                          {enableColumnResizing && header.column.getCanResize() && (
                            <div
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              className={cn(
                                "absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none select-none bg-border opacity-0 hover:opacity-100 transition-opacity",
                                header.column.getIsResizing() && "opacity-100 bg-primary"
                              )}
                            >
                              <GripVertical className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                        </TableHead>
                      )
                    })}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {loading && skeletonRows > 0 ? (
                  // Skeleton loading rows
                  Array.from({ length: skeletonRows }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      {columns.map((_, colIndex) => (
                        <TableCell key={`skeleton-${index}-${colIndex}`}>
                          <div className="h-4 w-full animate-pulse rounded bg-muted" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : table.getRowModel().rows?.length ? (
                  table.getRowModel().rows.map((row, rowIndex) => {
                    const rowData = row.original
                    let rowError: Error | null = null

                    return (
                      <TableRow
                        key={row.id}
                        data-state={row.getIsSelected() && "selected"}
                        className="transition-colors hover:bg-muted/50"
                        enableZebraStriping={enableZebraStriping}
                        index={rowIndex}
                      >
                        {row.getVisibleCells().map((cell) => {
                          const columnId = cell.column.id
                          const cellValue = cell.getValue()
                          const cellTooltip = cellTooltips?.(rowData, columnId)

                          // Validate cell if validator provided
                          if (validateCell && !rowError) {
                            const error = validateCell(cellValue, rowData, columnId)
                            if (error) {
                              rowError = error
                            }
                          }

                          // Detect alignment
                          const alignment = detectAlignment(
                            cellValue,
                            columnId,
                            columnAlignment,
                            cell.column.columnDef.meta as { alignment?: "left" | "right" | "center" } | undefined
                          )

                          // Render cell content
                          const cellContent = flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )

                          // Handle errors
                          const hasError = rowError && cellErrorRenderer
                          const errorContent = hasError
                            ? cellErrorRenderer(rowError, rowData, columnId)
                            : null

                          const finalContent = errorContent || cellContent

                          return (
                            <TableCell
                              key={cell.id}
                              rowHeight={rowHeight}
                              alignment={alignment}
                              style={{
                                width: enableColumnResizing
                                  ? cell.column.getSize()
                                  : undefined,
                              }}
                              className={cn(
                                hasError && "border-l-2 border-l-destructive"
                              )}
                            >
                              {cellTooltip ? (
                                <Tooltip content={cellTooltip} side="top">
                                  <div className="w-full">{finalContent}</div>
                                </Tooltip>
                              ) : (
                                finalContent
                              )}
                            </TableCell>
                          )
                        })}
                        {rowActions && (
                          <TableCell
                            rowHeight={rowHeight}
                            alignment="center"
                            className="w-[100px]"
                          >
                            {rowActions(rowData)}
                          </TableCell>
                        )}
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell
                      colSpan={columns.length}
                      className="h-24 p-0"
                    >
                      <CmxEmptyState
                        title={emptyStateTitle}
                        description={emptyStateDescription}
                        action={emptyStateAction}
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {paginationMode === "infinite" && (
              <div ref={loadMoreRef} className="flex justify-center py-4">
                {isLoadingMore && (
                  <div className="flex items-center gap-2">
                    <CmxSpinner size="sm" />
                    <span className="text-sm text-muted-foreground">
                      {t("loadingMore", "Loading more...")}
                    </span>
                  </div>
                )}
              </div>
            )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Pagination */}
      {!loading && !error && paginationMode === "pages" && (
        <div
          className="flex flex-col gap-4 px-2 sm:flex-row sm:items-center sm:justify-between"
          role="navigation"
          aria-label={t("pagination", "Table pagination")}
        >
          <div
            className="flex-1 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            {enableRowSelection && selectedRowCount > 0 ? (
              <span>
                {t(
                  "selectionInfo",
                  `${selectedRowCount} of ${filteredRowCount} row${filteredRowCount !== 1 ? "s" : ""} selected`
                )}
              </span>
            ) : (
              <span>
                {totalRows > 0
                  ? t(
                      "paginationInfo",
                      `Showing ${startRow}-${endRow} of ${totalRows}`
                    )
                  : t("noRows", "No rows")}
              </span>
            )}
          </div>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-6 lg:space-x-8">
            <div className="flex items-center space-x-2">
              <p className="text-sm font-medium">
                {t("rowsPerPage", "Rows per page")}
              </p>
              <select
                className="h-8 w-[70px] rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                value={table.getState().pagination.pageSize}
                onChange={(e) => {
                  table.setPageSize(Number(e.target.value))
                }}
                aria-label={t("rowsPerPageLabel", "Rows per page")}
              >
                {[10, 20, 30, 40, 50].map((pageSize) => (
                  <option key={pageSize} value={pageSize}>
                    {pageSize}
                  </option>
                ))}
              </select>
            </div>
            <div
              className="flex w-[100px] items-center justify-center text-sm font-medium"
              role="status"
              aria-live="polite"
            >
              {t("pageInfo", `Page ${pageIndex + 1} of ${table.getPageCount()}`)}
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                aria-label={t("firstPage", "Go to first page")}
              >
                <span className="sr-only">{t("firstPage", "Go to first page")}</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label={t("previousPage", "Go to previous page")}
              >
                <span className="sr-only">{t("previousPage", "Go to previous page")}</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label={t("nextPage", "Go to next page")}
              >
                <span className="sr-only">{t("nextPage", "Go to next page")}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                className="h-8 w-8 p-0"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
                aria-label={t("lastPage", "Go to last page")}
              >
                <span className="sr-only">{t("lastPage", "Go to last page")}</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

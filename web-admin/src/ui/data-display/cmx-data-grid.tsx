'use client';

/**
 * CmxDataGrid — professional client-side data grid (TanStack Table v8 + Cmx primitives).
 *
 * Features: two-row header (sort + debounced filters), optional global search, column visibility,
 * optional row selection + bulk actions, pagination, CSV export, skeleton/empty states, responsive column meta,
 * optional sticky leading column, horizontal scroll fade hints, per-filter clear controls,
 * optional hover-reveal copy (`meta.isCopyable`), density toolbar, column visibility persistence, server-mode flags.
 * Scroll viewport supports horizontal and vertical overflow (see `tableWrapperClassName`).
 *
 * Server-driven pagination/filtering can be layered by pre-filtering `data` and controlling `data`/`pagination`
 * from the parent; native `manualPagination` wiring is left for a follow-up when needed.
 *
 * @module ui/data-display
 */

import * as React from 'react';
import {
  type Column,
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type RowSelectionState,
  type SortingState,
  type Table,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Copy,
  Download,
  Rows,
  Search,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@ui/primitives/button';
import { Input } from '@ui/primitives/input';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@ui/primitives/dropdown-menu';
import { useMessage } from '@ui/feedback';
import { cn } from '@/lib/utils';

const FILTER_DEBOUNCE_MS = 300;
const GLOBAL_SEARCH_DEBOUNCE_MS = 300;

/**
 * Tracks whether horizontal overflow exists on each inline edge; RTL uses signed `scrollLeft` per HTML spec.
 */
function useScrollOverflowHints(
  scrollRef: React.RefObject<HTMLElement | null>,
  dir: 'ltr' | 'rtl'
): { fadeInlineStart: boolean; fadeInlineEnd: boolean } {
  const [fadeInlineStart, setFadeInlineStart] = React.useState(false);
  const [fadeInlineEnd, setFadeInlineEnd] = React.useState(false);

  const update = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    if (max <= 2) {
      setFadeInlineStart(false);
      setFadeInlineEnd(false);
      return;
    }
    const sl = el.scrollLeft;
    const eps = 3;
    if (dir !== 'rtl') {
      setFadeInlineStart(sl > eps);
      setFadeInlineEnd(sl < max - eps);
    } else {
      setFadeInlineStart(sl < -eps);
      setFadeInlineEnd(sl > -max + eps);
    }
  }, [dir, scrollRef]);

  React.useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [update, scrollRef]);

  return { fadeInlineStart, fadeInlineEnd };
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);
  React.useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

/** Case-insensitive substring match on stringified cell value. */
const cmxIncludesStringFilter: FilterFn<unknown> = (row, columnId, filterValue) => {
  const q = String(filterValue ?? '').trim().toLowerCase();
  if (!q) return true;
  const raw = row.getValue(columnId);
  if (raw == null || raw === '') return false;
  return String(raw).toLowerCase().includes(q);
};
cmxIncludesStringFilter.autoRemove = (v) => !v || String(v).trim() === '';

export type CmxDataGridColumnMeta = {
  disableFilter?: boolean;
  /** Hide column below breakpoint (`md` = hidden until `md`, i.e. `hidden md:table-cell`). */
  hideBelow?: 'sm' | 'md' | 'lg';
  /** Show a copy icon on cell hover; copies accessor value via `row.getValue(columnId)`. */
  isCopyable?: boolean;
};

/** Row vertical rhythm for power users vs readability. */
export type CmxDataGridDensity = 'compact' | 'standard' | 'comfortable';

function hideBelowClass(hideBelow?: 'sm' | 'md' | 'lg'): string {
  if (!hideBelow) return '';
  if (hideBelow === 'sm') return 'hidden sm:table-cell';
  if (hideBelow === 'md') return 'hidden md:table-cell';
  return 'hidden lg:table-cell';
}

export type CmxDataGridLabels = {
  resetFilters: string;
  rowsPerPage: string;
  /** Placeholders: {from} {to} {total} */
  showing: string;
  /** Placeholders: {current} {totalPages} */
  page: string;
  firstPage: string;
  previousPage: string;
  nextPage: string;
  lastPage: string;
  goToPage: string;
  go: string;
  filterPlaceholder: string;
  empty: string;
  columnsMenu: string;
  toggleColumns: string;
  globalSearchPlaceholder: string;
  clearFilters: string;
  exportCsv: string;
  selectedCount: string;
  selectAll: string;
  selectRow: string;
  /** Shown next to per-column filter clear (icon button). */
  clearColumnFilter: string;
  /** Hint under empty state when filters removed all rows but raw data exists. */
  emptyFilteredHint: string;
  /** Toolbar control for row density. */
  density: string;
  densityCompact: string;
  densityStandard: string;
  densityComfortable: string;
  /** Accessible label for the per-cell copy control. */
  copyToClipboard: string;
};

const DEFAULT_LABELS: CmxDataGridLabels = {
  resetFilters: 'Reset filters',
  rowsPerPage: 'Rows per page',
  showing: '{from}–{to} of {total}',
  page: 'Page {current} of {totalPages}',
  firstPage: 'First page',
  previousPage: 'Previous page',
  nextPage: 'Next page',
  lastPage: 'Last page',
  goToPage: 'Go to page',
  go: 'Go',
  filterPlaceholder: 'Filter…',
  empty: 'No rows to display',
  columnsMenu: 'Columns',
  toggleColumns: 'Toggle visible columns',
  globalSearchPlaceholder: 'Search all columns…',
  clearFilters: 'Clear filters',
  exportCsv: 'Export CSV',
  selectedCount: '{count} selected',
  selectAll: 'Select all rows on page',
  selectRow: 'Select row',
  clearColumnFilter: 'Clear column filter',
  emptyFilteredHint: 'Try checking your spelling or loosening your filters.',
  density: 'Density',
  densityCompact: 'Compact',
  densityStandard: 'Standard',
  densityComfortable: 'Comfortable',
  copyToClipboard: 'Copy to clipboard',
};

function fillPlaceholders(template: string, vars: Record<string, string | number>): string {
  let s = template;
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{${k}}`).join(String(v));
  }
  return s;
}

function mergeLabels(partial?: Partial<CmxDataGridLabels>): CmxDataGridLabels {
  return { ...DEFAULT_LABELS, ...partial };
}

function densityHeaderClass(d: CmxDataGridDensity): string {
  if (d === 'compact') return 'px-1.5 py-1';
  if (d === 'comfortable') return 'px-3 py-2.5';
  return 'px-2 py-2';
}

function densityFilterRowClass(d: CmxDataGridDensity): string {
  if (d === 'compact') return 'px-1.5 py-0.5';
  if (d === 'comfortable') return 'px-3 py-2';
  return 'px-2 py-1.5';
}

function densityCellClass(d: CmxDataGridDensity): string {
  if (d === 'compact') return 'px-1.5 py-1';
  if (d === 'comfortable') return 'px-3 py-2.5';
  return 'px-2 py-2';
}

function densityFilterInputClass(d: CmxDataGridDensity): string {
  if (d === 'compact') return 'h-7 text-[11px]';
  if (d === 'comfortable') return 'h-9 text-sm';
  return 'h-8 text-xs';
}

/**
 * Wraps cell content with a hover-revealed copy control so row-level clicks stay unambiguous (`stopPropagation`).
 */
function GridCopyableShell({
  copyText,
  copyButtonLabel,
  children,
}: {
  copyText: string;
  copyButtonLabel: string;
  children: React.ReactNode;
}) {
  const tCommon = useTranslations('common');
  const { showSuccess } = useMessage();
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    },
    []
  );

  const handleCopy = React.useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!copyText) return;
      try {
        await navigator.clipboard.writeText(copyText);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        setCopied(true);
        showSuccess(tCommon('copied'));
        timeoutRef.current = setTimeout(() => setCopied(false), 2000);
      } catch {
        /* clipboard API may be denied */
      }
    },
    [copyText, showSuccess, tCommon]
  );

  const canCopy = copyText.length > 0;

  return (
    <div className="group/copycell flex min-w-0 items-start gap-0.5">
      <div className="min-w-0 flex-1 overflow-hidden">{children}</div>
      {canCopy ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            'h-7 w-7 shrink-0 opacity-0 transition-opacity group-hover/copycell:opacity-100',
            'text-muted-foreground hover:text-foreground'
          )}
          aria-label={copyButtonLabel}
          title={copyButtonLabel}
          onClick={handleCopy}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
        </Button>
      ) : null}
    </div>
  );
}

function hasStringAccessor<T>(col: ColumnDef<T, unknown>): col is ColumnDef<T, unknown> & { accessorKey: string } {
  return 'accessorKey' in col && typeof (col as { accessorKey?: unknown }).accessorKey === 'string';
}

function withDefaultFilterAndSort<T>(columns: ColumnDef<T, unknown>[]): ColumnDef<T, unknown>[] {
  return columns.map((col) => {
    if (col.id === 'select') return { ...col, enableColumnFilter: false, enableSorting: false, enableHiding: false };
    if (col.meta && (col.meta as CmxDataGridColumnMeta).disableFilter === true) {
      return col;
    }
    if (hasStringAccessor(col)) {
      return {
        ...col,
        enableColumnFilter: col.enableColumnFilter !== false,
        filterFn: col.filterFn ?? 'cmxIncludesString',
        enableSorting: col.enableSorting !== false,
      };
    }
    if ((col.meta as { filterable?: boolean } | undefined)?.filterable === true) {
      return {
        ...col,
        enableColumnFilter: true,
        filterFn: col.filterFn ?? 'cmxIncludesString',
        enableSorting: col.enableSorting !== false,
      };
    }
    return col;
  });
}

function DebouncedColumnFilter<TData>({
  column,
  placeholder,
  debounceMs = FILTER_DEBOUNCE_MS,
  clearLabel,
  dir = 'ltr',
  inputClassName,
}: {
  column: Column<TData, unknown>;
  placeholder: string;
  debounceMs?: number;
  clearLabel: string;
  dir?: 'ltr' | 'rtl';
  inputClassName?: string;
}) {
  const filterValue = column.getFilterValue();
  const [value, setValue] = React.useState(() => String(filterValue ?? ''));
  React.useEffect(() => {
    setValue(String(column.getFilterValue() ?? ''));
  }, [column, filterValue]);
  const debounced = useDebounce(value, debounceMs);
  React.useEffect(() => {
    const trimmed = debounced.trim();
    column.setFilterValue(trimmed === '' ? undefined : trimmed);
  }, [debounced, column]);
  const hasValue = value.length > 0;
  return (
    <div className="relative">
      <Input
        className={cn(inputClassName, hasValue ? (dir === 'rtl' ? 'pl-8' : 'pr-8') : undefined)}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={`${String(column.id)} filter`}
      />
      {hasValue ? (
        <button
          type="button"
          className={cn(
            'absolute top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground',
            dir === 'rtl' ? 'left-1' : 'right-1'
          )}
          onClick={() => {
            setValue('');
            column.setFilterValue(undefined);
          }}
          aria-label={clearLabel}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function buildCsvFromTable<TData>(table: Table<TData>): string {
  const cols = table.getVisibleLeafColumns().filter((c) => c.id !== 'select');
  const header = cols.map((c) => String(c.columnDef.header ?? c.id)).join(',');
  const lines = table.getFilteredRowModel().rows.map((row) =>
    cols
      .map((c) => {
        const val = row.getValue(c.id);
        const s = val == null ? '' : String(val).replace(/"/g, '""');
        return `"${s}"`;
      })
      .join(',')
  );
  return [header, ...lines].join('\n');
}

export interface CmxDataGridProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  getRowId?: (originalRow: TData, index: number) => string;
  initialPageSize?: number;
  pageSizeOptions?: number[];
  /** Merges over English defaults */
  labels?: Partial<CmxDataGridLabels>;
  className?: string;
  /**
   * Classes for the scroll viewport around `<table>`. Should include a `max-h-*` when the grid sits in a
   * flex layout so vertical scrolling activates; horizontal scroll appears when the table is wider than the viewport.
   * If omitted, defaults to `max-h-[min(52vh,28rem)] min-w-0`.
   */
  tableWrapperClassName?: string;
  /** When true, reset also clears sort state */
  resetClearsSort?: boolean;
  dir?: 'ltr' | 'rtl';
  enableZebra?: boolean;
  isLoading?: boolean;
  /** Skeleton row count while `isLoading` (defaults to 5 when loading). */
  skeletonRowCount?: number;
  /** Per-column filter inputs debounce delay (default 300ms). */
  filterDebounceMs?: number;
  /** Show search across all cell values (client-side substring). */
  enableGlobalSearch?: boolean;
  /** Show “Columns” menu to toggle visibility for hideable columns. */
  enableColumnVisibility?: boolean;
  initialColumnVisibility?: VisibilityState;
  /** Checkbox column + row selection model */
  enableRowSelection?: boolean;
  /** Shown when at least one row is selected */
  bulkActions?: React.ReactNode;
  /** Built-in CSV download of filtered rows; file basename without extension */
  enableExportCsv?: boolean;
  exportFileName?: string;
  /** Custom CSV export using current table state */
  onExportCsv?: (csv: string, table: Table<TData>) => void;
  /** Pin the first visible column to the inline-start edge while scrolling horizontally (solid background). */
  enableStickyFirstColumn?: boolean;
  /** Fade gradients on inline-start/end when horizontal overflow remains (offers a scroll affordance). */
  enableScrollEdgeHints?: boolean;
  /** Persist `columnVisibility` under this key (merged with `initialColumnVisibility` on first load). */
  columnVisibilityStorageKey?: string;
  /** Toolbar control for compact / standard / comfortable row padding. */
  enableDensityToggle?: boolean;
  /** Initial density when `enableDensityToggle` is true. */
  defaultDensity?: CmxDataGridDensity;
  /** Controlled density (disables internal density state when set). */
  density?: CmxDataGridDensity;
  /** Notified when internal density changes (only when `enableDensityToggle` and `density` prop unset). */
  onDensityChange?: (density: CmxDataGridDensity) => void;
  /** Server / controlled table: omit client row models as needed (parent supplies sliced data). */
  manualPagination?: boolean;
  /** Required with `manualPagination` for correct pager (TanStack). */
  pageCount?: number;
  manualSorting?: boolean;
  manualFiltering?: boolean;
  /** Optional total for footer when client row model does not reflect full filtered set. */
  totalFilteredCount?: number;
}

/**
 * Client-side grid: sticky two-row header, debounced filters, optional global search & column visibility,
 * pagination, selection, export, skeleton/empty UX.
 * @param props - Grid configuration
 * @returns Grid UI
 */
export function CmxDataGrid<TData>(props: CmxDataGridProps<TData>) {
  const {
    data,
    columns: columnsProp,
    getRowId,
    initialPageSize = 10,
    pageSizeOptions = [10, 25, 50, 100],
    labels: labelsProp,
    className,
    tableWrapperClassName,
    resetClearsSort = false,
    dir = 'ltr',
    enableZebra = false,
    isLoading = false,
    skeletonRowCount = 5,
    filterDebounceMs = FILTER_DEBOUNCE_MS,
    enableGlobalSearch = false,
    enableColumnVisibility = true,
    initialColumnVisibility,
    enableRowSelection = false,
    bulkActions,
    enableExportCsv = false,
    exportFileName = 'export',
    onExportCsv,
    enableStickyFirstColumn = false,
    enableScrollEdgeHints = true,
    columnVisibilityStorageKey,
    enableDensityToggle = false,
    defaultDensity = 'standard',
    density: densityControlled,
    onDensityChange,
    manualPagination = false,
    pageCount: pageCountProp,
    manualSorting = false,
    manualFiltering = false,
    totalFilteredCount,
  } = props;

  const [densityInternal, setDensityInternal] = React.useState<CmxDataGridDensity>(defaultDensity);
  const density = densityControlled ?? densityInternal;

  const setDensity = React.useCallback(
    (next: CmxDataGridDensity) => {
      if (densityControlled === undefined) {
        setDensityInternal(next);
      }
      onDensityChange?.(next);
    },
    [densityControlled, onDensityChange]
  );

  React.useEffect(() => {
    if (densityControlled === undefined) setDensityInternal(defaultDensity);
  }, [defaultDensity, densityControlled]);

  const scrollRef = React.useRef<HTMLDivElement>(null);
  const { fadeInlineStart, fadeInlineEnd } = useScrollOverflowHints(scrollRef, dir);

  const labels = mergeLabels(labelsProp);
  const PageFirstIcon = dir === 'rtl' ? ChevronsRight : ChevronsLeft;
  const PagePrevIcon = dir === 'rtl' ? ChevronRight : ChevronLeft;
  const PageNextIcon = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const PageLastIcon = dir === 'rtl' ? ChevronsLeft : ChevronsRight;
  const [globalFilterInput, setGlobalFilterInput] = React.useState('');
  const debouncedGlobalSearch = useDebounce(globalFilterInput, GLOBAL_SEARCH_DEBOUNCE_MS);

  const dataAfterGlobalSearch = React.useMemo(() => {
    if (!enableGlobalSearch) return data;
    const q = debouncedGlobalSearch.trim().toLowerCase();
    if (!q) return data;
    return data.filter((row) =>
      Object.values(row as Record<string, unknown>).some(
        (v) => v != null && String(v).toLowerCase().includes(q)
      )
    );
  }, [data, debouncedGlobalSearch, enableGlobalSearch]);

  const selectColumn = React.useMemo((): ColumnDef<TData, unknown> | null => {
    if (!enableRowSelection) return null;
    return {
      id: 'select',
      size: 40,
      minSize: 36,
      maxSize: 48,
      header: ({ table }) => (
        <input
          type="checkbox"
          className="h-4 w-4 cursor-pointer rounded border border-input accent-[rgb(var(--cmx-primary-rgb,59_130_246))]"
          checked={table.getIsAllPageRowsSelected()}
          ref={(el) => {
            if (el) el.indeterminate = table.getIsSomePageRowsSelected();
          }}
          onChange={table.getToggleAllPageRowsSelectedHandler()}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={labels.selectAll}
        />
      ),
      cell: ({ row }) => (
        <input
          type="checkbox"
          className="h-4 w-4 cursor-pointer rounded border border-input accent-[rgb(var(--cmx-primary-rgb,59_130_246))]"
          checked={row.getIsSelected()}
          disabled={!row.getCanSelect()}
          onChange={row.getToggleSelectedHandler()}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={labels.selectRow}
        />
      ),
      enableSorting: false,
      enableColumnFilter: false,
      enableHiding: false,
    };
  }, [enableRowSelection, labels.selectAll, labels.selectRow]);

  const columns = React.useMemo(() => {
    const base = withDefaultFilterAndSort(columnsProp);
    return selectColumn ? [selectColumn, ...base] : base;
  }, [columnsProp, selectColumn]);

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>(() => {
    const base = initialColumnVisibility ?? {};
    if (typeof window === 'undefined' || !columnVisibilityStorageKey) return base;
    try {
      const raw = localStorage.getItem(columnVisibilityStorageKey);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as VisibilityState;
      if (parsed && typeof parsed === 'object') return { ...base, ...parsed };
    } catch {
      /* ignore malformed storage */
    }
    return base;
  });
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState({
    pageIndex: 0,
    pageSize: initialPageSize,
  });
  const [goToInput, setGoToInput] = React.useState('1');

  React.useEffect(() => {
    if (!columnVisibilityStorageKey || typeof window === 'undefined') return;
    const tmr = window.setTimeout(() => {
      try {
        localStorage.setItem(columnVisibilityStorageKey, JSON.stringify(columnVisibility));
      } catch {
        /* quota / private mode */
      }
    }, 200);
    return () => window.clearTimeout(tmr);
  }, [columnVisibility, columnVisibilityStorageKey]);

  const table = useReactTable({
    data: dataAfterGlobalSearch,
    columns,
    getRowId,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      pagination,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
    getFilteredRowModel: manualFiltering ? undefined : getFilteredRowModel(),
    getPaginationRowModel: manualPagination ? undefined : getPaginationRowModel(),
    filterFns: { cmxIncludesString: cmxIncludesStringFilter },
    enableSortingRemoval: true,
    sortDescFirst: false,
    ...(enableRowSelection ? { enableRowSelection: true as const } : {}),
    ...(manualPagination
      ? {
          manualPagination: true as const,
          pageCount:
            pageCountProp ??
            Math.max(1, Math.ceil(dataAfterGlobalSearch.length / Math.max(pagination.pageSize, 1))),
        }
      : {}),
    ...(manualSorting ? { manualSorting: true as const } : {}),
    ...(manualFiltering ? { manualFiltering: true as const } : {}),
  });

  const pageIndex = table.getState().pagination.pageIndex;
  const pageSize = table.getState().pagination.pageSize;
  const totalFiltered = totalFilteredCount ?? table.getFilteredRowModel().rows.length;
  const pageCount = Math.max(1, table.getPageCount());
  const currentPage = Math.min(pageIndex + 1, pageCount);
  const pageRows = table.getRowModel().rows;
  const from = totalFiltered === 0 ? 0 : pageIndex * pageSize + 1;
  const to = totalFiltered === 0 ? 0 : pageIndex * pageSize + pageRows.length;
  const selectedCount = Object.keys(rowSelection).length;
  const hasActiveFilters =
    columnFilters.length > 0 ||
    (enableGlobalSearch && globalFilterInput.trim().length > 0) ||
    sorting.length > 0;

  React.useEffect(() => {
    setGoToInput(String(currentPage));
  }, [currentPage]);

  const resetFilters = React.useCallback(() => {
    setColumnFilters([]);
    setGlobalFilterInput('');
    setRowSelection({});
    if (resetClearsSort) setSorting([]);
    if (initialColumnVisibility) setColumnVisibility(initialColumnVisibility);
    else setColumnVisibility({});
    setPagination((p) => ({ ...p, pageIndex: 0 }));
  }, [initialColumnVisibility, resetClearsSort]);

  const applyGoToPage = React.useCallback(() => {
    const n = Number.parseInt(goToInput, 10);
    if (!Number.isFinite(n)) return;
    const clamped = Math.min(Math.max(1, n), pageCount);
    table.setPageIndex(clamped - 1);
    setGoToInput(String(clamped));
  }, [goToInput, pageCount, table]);

  const handleExport = React.useCallback(() => {
    const csv = buildCsvFromTable(table);
    if (onExportCsv) {
      onExportCsv(csv, table);
      return;
    }
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exportFileName}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [exportFileName, onExportCsv, table]);

  const headerGroup = table.getHeaderGroups()[0];
  const colCount = headerGroup?.headers.length ?? columns.length;
  const showEmptyClear = !isLoading && totalFiltered === 0 && data.length > 0;

  const wrapperHasMaxHeight =
    typeof tableWrapperClassName === 'string' && /\bmax-h-/.test(tableWrapperClassName);

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-col gap-3', className)} dir={dir}>
      <div className={cn('flex flex-wrap items-center gap-2', enableGlobalSearch || enableRowSelection ? 'justify-between' : 'justify-end')}>
        <div className={cn('flex min-w-0 flex-1 flex-wrap items-center gap-2', dir === 'rtl' && 'flex-row-reverse')}>
          {enableGlobalSearch && (
            <div className="relative w-full min-w-[12rem] max-w-sm flex-1">
              <Search
                className={cn(
                  'pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground',
                  dir === 'rtl' ? 'right-2.5' : 'left-2.5'
                )}
                aria-hidden
              />
              <Input
                className={cn('h-9', dir === 'rtl' ? 'pr-9' : 'pl-9')}
                value={globalFilterInput}
                onChange={(e) => setGlobalFilterInput(e.target.value)}
                placeholder={labels.globalSearchPlaceholder}
                aria-label={labels.globalSearchPlaceholder}
              />
            </div>
          )}
          {enableRowSelection && selectedCount > 0 && (
            <div className="flex items-center gap-2 text-xs font-medium text-foreground">
              <span>{fillPlaceholders(labels.selectedCount, { count: selectedCount })}</span>
              {bulkActions}
            </div>
          )}
        </div>
        <div className={cn('flex flex-wrap items-center gap-2', dir === 'rtl' && 'flex-row-reverse')}>
          {enableDensityToggle && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="text-xs gap-1">
                  <Rows className="h-3.5 w-3.5" aria-hidden />
                  {labels.density}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>{labels.density}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={density}
                  onValueChange={(v) => setDensity(v as CmxDataGridDensity)}
                >
                  <DropdownMenuRadioItem value="compact">{labels.densityCompact}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="standard">{labels.densityStandard}</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="comfortable">{labels.densityComfortable}</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {(enableExportCsv || onExportCsv) && (
            <Button type="button" variant="outline" size="sm" className="text-xs gap-1" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" />
              {labels.exportCsv}
            </Button>
          )}
          {enableColumnVisibility && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="text-xs gap-1">
                  {labels.columnsMenu}
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel>{labels.toggleColumns}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {table
                  .getAllColumns()
                  .filter((c) => c.getCanHide())
                  .map((column) => (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(v) => column.toggleVisibility(!!v)}
                    >
                      {typeof column.columnDef.header === 'string'
                        ? column.columnDef.header
                        : column.id}
                    </DropdownMenuCheckboxItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button type="button" variant="outline" size="sm" onClick={resetFilters} className="text-xs">
            {labels.resetFilters}
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className={cn(
          'relative min-h-0 w-full min-w-0 max-w-full',
          'overflow-x-auto overflow-y-auto overscroll-x-contain overscroll-y-contain [-webkit-overflow-scrolling:touch]',
          !wrapperHasMaxHeight && 'max-h-[min(52vh,28rem)] min-w-0',
          'rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-white [scrollbar-gutter:stable]',
          tableWrapperClassName
        )}
        role="region"
        aria-label="Data grid"
      >
        {enableScrollEdgeHints ? (
          <>
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-y-0 z-[19] w-6 bg-gradient-to-r from-white via-white/80 to-transparent transition-opacity duration-200',
                dir === 'rtl' ? 'right-0' : 'left-0'
              )}
              style={{ opacity: fadeInlineStart ? 1 : 0 }}
            />
            <div
              aria-hidden
              className={cn(
                'pointer-events-none absolute inset-y-0 z-[19] w-6 bg-gradient-to-l from-white via-white/80 to-transparent transition-opacity duration-200',
                dir === 'rtl' ? 'left-0' : 'right-0'
              )}
              style={{ opacity: fadeInlineEnd ? 1 : 0 }}
            />
          </>
        ) : null}
        <table className="min-w-[72rem] w-full border-collapse text-sm">
          <thead className="sticky top-0 z-20 bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))] shadow-sm">
            {headerGroup ? (
              <>
                <tr className="border-b border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]">
                  {headerGroup.headers.map((header, colIndex) => {
                    const canSort = header.column.getCanSort();
                    const sorted = header.column.getIsSorted();
                    const label = flexRender(header.column.columnDef.header, header.getContext());
                    const meta = header.column.columnDef.meta as CmxDataGridColumnMeta | undefined;
                    const rb = hideBelowClass(meta?.hideBelow);
                    const stickyFirst = enableStickyFirstColumn && colIndex === 0;
                    return (
                      <th
                        key={header.id}
                        className={cn(
                          densityHeaderClass(density),
                          'text-left align-bottom text-xs font-semibold text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]',
                          dir === 'rtl' && 'text-right',
                          canSort && 'cursor-pointer select-none hover:bg-black/[0.03]',
                          rb,
                          stickyFirst &&
                            'sticky start-0 z-40 border-e border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))]'
                        )}
                        aria-sort={
                          sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
                        }
                        onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                        onKeyDown={
                          canSort
                            ? (e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  header.column.getToggleSortingHandler()?.(e);
                                }
                              }
                            : undefined
                        }
                        tabIndex={canSort ? 0 : undefined}
                        role={canSort ? 'button' : undefined}
                      >
                        <span className="inline-flex items-center gap-1.5">
                          <span className="leading-tight">{label}</span>
                          {canSort ? (
                            <span className="inline-flex shrink-0 items-center" aria-hidden>
                              {!sorted ? (
                                <ChevronsUpDown className="h-3.5 w-3.5 text-muted-foreground/70" />
                              ) : sorted === 'asc' ? (
                                <ArrowUp className="h-3.5 w-3.5 text-[rgb(var(--cmx-primary-rgb,59_130_246))]" />
                              ) : (
                                <ArrowDown className="h-3.5 w-3.5 text-[rgb(var(--cmx-primary-rgb,59_130_246))]" />
                              )}
                            </span>
                          ) : null}
                        </span>
                      </th>
                    );
                  })}
                </tr>
                <tr className="border-b border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))]">
                  {headerGroup.headers.map((header, colIndex) => {
                    const col = header.column;
                    const canFilter = col.getCanFilter();
                    const meta = header.column.columnDef.meta as CmxDataGridColumnMeta | undefined;
                    const rb = hideBelowClass(meta?.hideBelow);
                    const stickyFirst = enableStickyFirstColumn && colIndex === 0;
                    return (
                      <th
                        key={`${header.id}-filter`}
                        className={cn(
                          densityFilterRowClass(density),
                          'align-top',
                          rb,
                          stickyFirst &&
                            'sticky start-0 z-40 border-e border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))]'
                        )}
                      >
                        {canFilter ? (
                          <DebouncedColumnFilter
                            column={col}
                            placeholder={labels.filterPlaceholder}
                            debounceMs={filterDebounceMs}
                            clearLabel={labels.clearColumnFilter}
                            dir={dir}
                            inputClassName={densityFilterInputClass(density)}
                          />
                        ) : (
                          <span
                            className={cn(
                              'block',
                              density === 'compact' ? 'h-7' : density === 'comfortable' ? 'h-9' : 'h-8'
                            )}
                            aria-hidden
                          />
                        )}
                      </th>
                    );
                  })}
                </tr>
              </>
            ) : null}
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: skeletonRowCount }).map((_, i) => (
                <tr key={`sk-${i}`} className="border-t border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]">
                  <td colSpan={colCount || 1} className={cn(densityCellClass(density))}>
                    <div className="flex items-center gap-2">
                      <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
                      <div className="h-4 w-16 animate-pulse rounded bg-muted" />
                    </div>
                  </td>
                </tr>
              ))
            ) : pageRows.length === 0 ? (
              <tr>
                <td colSpan={colCount || 1} className="px-3 py-10 text-center text-sm">
                  <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                    <p className="text-muted-foreground">{labels.empty}</p>
                    {showEmptyClear ? (
                      <p className="text-center text-xs leading-relaxed text-muted-foreground/90">
                        {labels.emptyFilteredHint}
                      </p>
                    ) : null}
                    {showEmptyClear && hasActiveFilters ? (
                      <Button type="button" variant="default" size="default" className="min-w-[10rem]" onClick={resetFilters}>
                        {labels.clearFilters}
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ) : (
              pageRows.map((row, rowIndex) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-t border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]',
                    'hover:bg-[rgb(var(--cmx-table-row-hover-bg-rgb,248_250_252))]',
                    enableZebra && rowIndex % 2 === 1 && 'bg-muted/40'
                  )}
                >
                  {row.getVisibleCells().map((cell, cellIndex) => {
                    const meta = cell.column.columnDef.meta as CmxDataGridColumnMeta | undefined;
                    const rb = hideBelowClass(meta?.hideBelow);
                    const stickyFirst = enableStickyFirstColumn && cellIndex === 0;
                    const stickyBg =
                      enableZebra && rowIndex % 2 === 1 ? 'bg-muted/40' : 'bg-white';
                    const cellInner = flexRender(cell.column.columnDef.cell, cell.getContext());
                    const copyRaw = row.getValue(cell.column.id);
                    const copyText = copyRaw == null ? '' : String(copyRaw);
                    const wrapped =
                      meta?.isCopyable === true ? (
                        <GridCopyableShell copyText={copyText} copyButtonLabel={labels.copyToClipboard}>
                          {cellInner}
                        </GridCopyableShell>
                      ) : (
                        cellInner
                      );
                    return (
                      <td
                        key={cell.id}
                        className={cn(
                          densityCellClass(density),
                          'align-top text-foreground',
                          dir === 'rtl' ? 'text-right' : 'text-left',
                          rb,
                          stickyFirst &&
                            cn(
                              'sticky start-0 z-20 border-e border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]',
                              stickyBg
                            )
                        )}
                      >
                        {wrapped}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!isLoading && (
        <div
          className={cn(
            'flex flex-col gap-3 rounded-lg border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))] px-3 py-3 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between'
          )}
        >
          <span className="tabular-nums">
            {fillPlaceholders(labels.showing, { from, to, total: totalFiltered })}
          </span>
          <div className={cn('flex flex-wrap items-center gap-3', dir === 'rtl' && 'flex-row-reverse')}>
            <label className="inline-flex items-center gap-2">
              <span className="whitespace-nowrap font-medium text-foreground">{labels.rowsPerPage}</span>
              <select
                className="h-8 rounded-md border border-input bg-background px-2 text-foreground"
                value={pageSize}
                onChange={(e) => {
                  const next = Number(e.target.value);
                  table.setPageSize(next);
                  table.setPageIndex(0);
                }}
                aria-label={labels.rowsPerPage}
              >
                {pageSizeOptions.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <span className="tabular-nums font-medium text-foreground">
              {fillPlaceholders(labels.page, { current: currentPage, totalPages: pageCount })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
                aria-label={labels.firstPage}
                title={labels.firstPage}
              >
                <PageFirstIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
                aria-label={labels.previousPage}
                title={labels.previousPage}
              >
                <PagePrevIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
                aria-label={labels.nextPage}
                title={labels.nextPage}
              >
                <PageNextIcon className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => table.setPageIndex(pageCount - 1)}
                disabled={!table.getCanNextPage()}
                aria-label={labels.lastPage}
                title={labels.lastPage}
              >
                <PageLastIcon className="h-4 w-4" />
              </Button>
            </div>
            <div className={cn('flex items-center gap-2', dir === 'rtl' && 'flex-row-reverse')}>
              <span className="whitespace-nowrap font-medium text-foreground">{labels.goToPage}</span>
              <Input
                className="h-8 w-14 px-2 text-center text-xs tabular-nums"
                inputMode="numeric"
                value={goToInput}
                onChange={(e) => setGoToInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applyGoToPage();
                }}
                aria-label={labels.goToPage}
              />
              <Button type="button" variant="secondary" size="sm" className="h-8" onClick={applyGoToPage}>
                {labels.go}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Shared table paging settings for every web-admin table (CmxDataTable, CmxDataGrid, CmxPagination, DataTable).
 * Change the default or the choices here once; all tables follow.
 * @module ui/data-display
 */

/** Rows-per-page choices offered by every table. */
export const CMX_PAGE_SIZE_OPTIONS: readonly number[] = [5, 10, 20, 30, 50, 100]

/** Default rows per page for every table. */
export const CMX_DEFAULT_PAGE_SIZE = 5

/**
 * Page-size choices that always contain the current size, so a screen using e.g. 15 or 25 never shows a blank select.
 * @param options - Base choices (defaults to CMX_PAGE_SIZE_OPTIONS)
 * @param current - Current page size
 * @returns Sorted choices including `current`
 */
export function cmxPageSizeChoices(options: readonly number[], current: number): number[] {
  return options.includes(current) ? [...options] : [...options, current].sort((a, b) => a - b)
}

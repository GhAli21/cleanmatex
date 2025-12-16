import * as React from "react"

import { cn } from "@/lib/utils"

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
))
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-muted/50 font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement> & {
    enableZebraStriping?: boolean
    index?: number
  }
>(({ className, enableZebraStriping = false, index, ...props }, ref) => {
  const zebraClass = enableZebraStriping && index !== undefined && index % 2 === 1
    ? "bg-muted/30"
    : ""

  return (
    <tr
      ref={ref}
      className={cn(
        "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
        zebraClass,
        className
      )}
      {...props}
    />
  )
})
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement> & {
    rowHeight?: "compact" | "normal" | "comfortable"
  }
>(({ className, rowHeight = "normal", ...props }, ref) => {
  const heightClass = {
    compact: "h-10",
    normal: "h-12",
    comfortable: "h-14",
  }[rowHeight]

  return (
    <th
      ref={ref}
      className={cn(
        heightClass,
        "px-4 text-left align-middle font-semibold text-foreground bg-muted/50 border-b",
        "[&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
})
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement> & {
    rowHeight?: "compact" | "normal" | "comfortable"
    alignment?: "left" | "right" | "center"
  }
>(({ className, rowHeight = "normal", alignment = "left", ...props }, ref) => {
  const paddingClass = {
    compact: "px-3 py-2",
    normal: "px-4 py-3",
    comfortable: "px-4 py-4",
  }[rowHeight]

  const alignmentClass = {
    left: "text-left",
    right: "text-right",
    center: "text-center",
  }[alignment]

  return (
    <td
      ref={ref}
      className={cn(
        paddingClass,
        alignmentClass,
        "align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className
      )}
      {...props}
    />
  )
})
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-muted-foreground", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}

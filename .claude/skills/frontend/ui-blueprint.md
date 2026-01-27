# UI Layer Blueprint (`src/ui/`)

Project **UI abstraction layer** on top of:
- Tailwind
- shadcn/ui
- Radix primitives
- Lucide React
- Sonner
- Recharts
- TanStack Table

All feature code should use **Cmx* components**, not raw third-party primitives.

## Folder Structure

```
src/ui/
  foundations/    # tokens, theme, CSS vars
  primitives/     # CmxButton, CmxInput, CmxCard
  forms/          # CmxForm, CmxFormField, CmxFormSection
  data-display/   # CmxDataTable, CmxKpiCard, CmxEmptyState
  navigation/     # CmxAppShell, sidebar, breadcrumbs
  layouts/        # major layout shells
  patterns/       # CRUD shells, list-with-filters, wizards
  charts/         # Recharts wrappers
  feedback/       # toast, inline error/success, confirm dialog
  overlays/       # modals, side panels
  index.ts        # barrel export
```

## Component Examples

### CmxButton

```tsx
// src/ui/primitives/cmx-button.tsx
"use client";

import * as React from "react";
import { Button, type ButtonProps } from "@/src/ui/button";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CmxButtonProps extends ButtonProps {
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const CmxButton: React.FC<CmxButtonProps> = ({
  loading,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  ...props
}) => {
  return (
    <Button
      className={cn("gap-2", className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {!loading && leftIcon}
      <span>{children}</span>
      {!loading && rightIcon}
    </Button>
  );
};
```

### CmxForm

```tsx
// src/ui/forms/cmx-form.tsx
"use client";

import * as React from "react";
import { Form as ShadcnForm, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/src/ui/form";
import type { UseFormReturn, FieldValues, Path } from "react-hook-form";

interface CmxFormProps<TFieldValues extends FieldValues> {
  form: UseFormReturn<TFieldValues>;
  onSubmit: (values: TFieldValues) => Promise<void> | void;
  className?: string;
  children: React.ReactNode;
}

export function CmxForm<TFieldValues extends FieldValues>({
  form,
  onSubmit,
  className,
  children,
}: CmxFormProps<TFieldValues>) {
  return (
    <ShadcnForm {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className={className ?? "space-y-6"}>
        {children}
      </form>
    </ShadcnForm>
  );
}
```

**Usage:**
```tsx
<CmxForm form={form} onSubmit={onSubmit}>
  <CmxFormField form={form} name="name" label="Name">
    {({ field }) => <CmxInput {...field} />}
  </CmxFormField>
</CmxForm>
```

### CmxDataTable

```tsx
// src/ui/data-display/cmx-data-table.tsx
"use client";

import * as React from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/ui/table";

export interface CmxDataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
}

export function CmxDataTable<TData>({ columns, data }: CmxDataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
```

## Global Message Utility (cmxMessage)

Unified message utility with multiple display methods.

### React Hook (Recommended)

```tsx
import { useMessage } from "@ui/feedback";
import { useTranslations } from "next-intl";

export function MyComponent() {
  const { showSuccess, showError, handlePromise } = useMessage();
  const t = useTranslations();

  const handleSave = async () => {
    await handlePromise(saveData(), {
      loading: t("messages.saving"),
      success: t("messages.saveSuccess"),
      error: t("errors.saveFailed"),
    });
  };

  return <button onClick={handleSave}>Save</button>;
}
```

### Display Methods

```tsx
// Toast (default)
cmxMessage.success("Saved!", { method: "toast" });

// Alert
cmxMessage.error("Critical!", { method: "alert" });

// Console (debugging)
cmxMessage.info("Debug info", { method: "console" });
```

### Advanced Options

```tsx
cmxMessage.success("Order created", {
  description: "Order #12345 has been created",
  duration: 5000,
  action: {
    label: "View Order",
    onClick: () => router.push("/orders/12345"),
  },
});
```

## Rule

**Feature code must:**
- Import from `@ui/*` (Cmx* components)
- Not import raw shadcn, Recharts, Sonner, or TanStack primitives directly (except inside Cmx* wrappers)

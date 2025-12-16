# Project UI Layer Blueprint (`src/ui/`)

This defines the Project **UI abstraction layer** on top of:

- Tailwind
- shadcn/ui
- Radix primitives
- Lucide React
- Sonner
- Recharts
- TanStack Table

All feature code should use these **Cmx* components**, not raw third-party primitives.

---

## 1. Folder Structure

```txt
components/
  ui/
    cmx-button.tsx
    cmx-input.tsx
    cmx-form.tsx
    cmx-data-table.tsx
    cmx-chart.tsx
    cmx-toast.tsx
    index.ts
```

Optional extensions later:

```txt
    cmx-card.tsx
    cmx-modal.tsx
    cmx-date-picker.tsx
    cmx-select.tsx
    cmx-badge.tsx
```

---

## 2. `CmxButton`

```tsx
// src/ui/cmx-button.tsx
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

---

## 3. `CmxInput`

```tsx
// src/ui/cmx-input.tsx
"use client";

import * as React from "react";
import { Input, type InputProps } from "@/src/ui/input";
import { cn } from "@/lib/utils";

export interface CmxInputProps extends InputProps {}

export const CmxInput = React.forwardRef<HTMLInputElement, CmxInputProps>(
  ({ className, ...props }, ref) => {
    return <Input ref={ref} className={cn("text-sm", className)} {...props} />;
  }
);

CmxInput.displayName = "CmxInput";
```

---

## 4. `CmxForm` (+ `CmxFormField`)

```tsx
// src/ui/cmx-form.tsx
"use client";

import * as React from "react";
import {
  Form as ShadcnForm,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/src/ui/form";
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
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={className ?? "space-y-6"}
      >
        {children}
      </form>
    </ShadcnForm>
  );
}

interface CmxFormFieldProps<TFieldValues extends FieldValues> {
  name: Path<TFieldValues>;
  label?: React.ReactNode;
  description?: React.ReactNode;
  children: (ctx: { field: any }) => React.ReactNode;
  form: UseFormReturn<TFieldValues>;
}

export function CmxFormField<TFieldValues extends FieldValues>({
  name,
  label,
  description,
  children,
  form,
}: CmxFormFieldProps<TFieldValues>) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>{children({ field })}</FormControl>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
```

Usage:

```tsx
<CmxForm form={form} onSubmit={onSubmit}>
  <CmxFormField form={form} name="name" label="Name">
    {({ field }) => <CmxInput {...field} />}
  </CmxFormField>
</CmxForm>
```

---

## 5. `CmxDataTable`

```tsx
// src/ui/cmx-data-table.tsx
"use client";

import * as React from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/ui/table";

export interface CmxDataTableProps<TData> {
  columns: ColumnDef<TData, any>[];
  data: TData[];
}

export function CmxDataTable<TData>({
  columns,
  data,
}: CmxDataTableProps<TData>) {
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
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
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

---

## 6. `CmxChart`

```tsx
// src/ui/cmx-chart.tsx
"use client";

import * as React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface CmxChartProps {
  data: any[];
  xKey: string;
  yKey: string;
}

export const CmxChart: React.FC<CmxChartProps> = ({ data, xKey, yKey }) => {
  if (!data || data.length === 0) {
    return <div className="text-sm text-muted-foreground">No data</div>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <XAxis dataKey={xKey} />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke="currentColor"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
```

---

## 7. Global Message Utility (`cmxMessage`)

Unified message utility with multiple display methods (Toast, Alert, Console, Inline), full i18n support, RTL awareness, and promise handling.

### Core Utility

```tsx
// src/ui/feedback/cmx-message.ts
import { MessageType, DisplayMethod, MessageOptions } from "./types";

export const cmxMessage = {
  success: (message: string, options?: MessageOptions) => MessageResult,
  error: (message: string, options?: MessageOptions) => MessageResult,
  warning: (message: string, options?: MessageOptions) => MessageResult,
  info: (message: string, options?: MessageOptions) => MessageResult,
  loading: (message: string, options?: MessageOptions) => MessageResult,
  promise: <T,>(
    promise: Promise<T>,
    messages: PromiseMessages,
    options?: MessageOptions
  ) => Promise<T>,
};
```

### React Hook (Recommended)

```tsx
// src/ui/feedback/useMessage.ts
"use client";

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

// Inline (for components)
const message = cmxMessage.success("Saved!", { method: "inline" });
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
  cancel: {
    label: "Dismiss",
    onClick: () => {},
  },
});
```

### Legacy API (Deprecated)

```tsx
// ❌ Deprecated - Use cmxMessage instead
import { showSuccessToast } from "@ui/feedback";
showSuccessToast("Saved!");

// ✅ New - Recommended
import { useMessage } from "@ui/feedback";
const { showSuccess } = useMessage();
showSuccess("Saved!");
```

---

## 8. Barrel Export

```ts
// src/ui/index.ts
export * from "./cmx-button";
export * from "./cmx-input";
export * from "./cmx-form";
export * from "./cmx-data-table";
export * from "./cmx-chart";
export * from "./cmx-toast";
```

---

## 9. Rule

**Feature code must:**

- Import from `@/src/ui` (Cmx\* components),
- Not import raw shadcn, Recharts, Sonner, or TanStack primitives directly (except inside these Cmx\* wrappers).

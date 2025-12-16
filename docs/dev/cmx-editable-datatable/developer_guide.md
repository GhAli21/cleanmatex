# CmxEditableDataTable - Developer Guide

## Overview

`CmxEditableDataTable` is a reusable component for creating editable data tables with inline editing, insertion, deletion, and soft-removal capabilities. It uses a three-layer validation system and supports bulk operations.

## Installation

The component is already available in the codebase at:

```
src/ui/data-display/cmx-editable-datatable.tsx
```

Import it using:

```typescript
import { CmxEditableDataTable } from "@ui/data-display";
```

## Basic Usage

```tsx
import { CmxEditableDataTable } from "@ui/data-display";
import type { EditableColumnDef } from "@ui/data-display";

interface Product {
  id: string;
  code: string;
  name: string;
  price: number;
  is_active: boolean;
}

const columns: EditableColumnDef<Product>[] = [
  {
    accessorKey: "code",
    header: "Code",
    editable: true,
    renderEditCell: ({ value, onChange, error }) => (
      <CmxInput
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={error ? "border-red-500" : ""}
      />
    ),
  },
  {
    accessorKey: "name",
    header: "Name",
    editable: true,
    renderEditCell: ({ value, onChange }) => (
      <CmxInput value={value} onChange={(e) => onChange(e.target.value)} />
    ),
  },
  // ... more columns
];

function ProductTable() {
  const [products, setProducts] = useState<Product[]>([]);

  return (
    <CmxEditableDataTable
      data={products}
      columns={columns}
      getRowId={(row) => row.id}
      onSave={async (row, original) => {
        // Save to backend
        const saved = await saveProduct(row);
        setProducts(products.map((p) => (p.id === saved.id ? saved : p)));
        return saved;
      }}
      enableInlineAdd
      enableBulkSave
    />
  );
}
```

## Three-Layer Validation System

### Layer 1: Schema-Level Validation (Zod)

Validates structure and base constraints (required fields, string length, numeric ranges, enums).

```tsx
import { z } from 'zod'

const schema = z.object({
  code: z.string().min(1, 'Code required').max(50, 'Code too long'),
  name: z.string().min(1, 'Name required'),
  price: z.number().min(0, 'Price must be >= 0'),
  is_active: z.boolean()
})

<CmxEditableDataTable
  validationSchema={schema}
  // ... other props
/>
```

### Layer 2: Cell-Level Validation (Callbacks)

Per-column custom logic that may depend on other fields.

```tsx
const cellValidators = {
  price: async (value: number, row: Product) => {
    // Custom: price must be > 0 only if is_active = true
    if (row.is_active && value <= 0) {
      return 'Active products must have price > 0'
    }
    return null
  },
  code: async (value: string, row: Product) => {
    // Format validation
    if (!/^[A-Z0-9_]+$/.test(value)) {
      return 'Code must be uppercase alphanumeric with underscores'
    }
    return null
  }
}

<CmxEditableDataTable
  cellValidators={cellValidators}
  // ... other props
/>
```

### Layer 3: Async/Server Validation

Backend checks for uniqueness, business rules, tenant context.

```tsx
const asyncRowValidator = async (row: Product, isNew: boolean) => {
  // Check uniqueness (requires backend)
  const exists = await checkCodeExists(row.code, row.id);
  if (exists) {
    return { code: "Code already exists" };
  }

  // Business rule: tenant-specific validation
  if (row.price > 10000 && !hasPremiumPlan(row.tenant_id)) {
    return { price: "Premium plan required for prices > 10000" };
  }

  return null;
};

<CmxEditableDataTable
  asyncRowValidator={asyncRowValidator}
  // ... other props
/>;
```

### Complete Validation Example

```tsx
<CmxEditableDataTable
  validationSchema={schema} // Layer 1
  cellValidators={cellValidators} // Layer 2
  asyncRowValidator={asyncRowValidator} // Layer 3
  // ... other props
/>
```

## CRUD Operations

### Save (Create/Update)

```tsx
onSave={async (row, original) => {
  // row: current row data
  // original: original row data (undefined for new rows)

  if (original) {
    // Update existing
    return await updateProduct(row)
  } else {
    // Create new
    return await createProduct(row)
  }
}}
```

### Delete

```tsx
onDelete={async (rowId) => {
  await deleteProduct(rowId)
  // Component will remove row from UI
}}
```

### Soft Remove

```tsx
onSoftRemove={async (rowId) => {
  // Data layer handles rec_status, is_active
  await softRemoveProduct(rowId) // Sets rec_status=0
  // Component marks row as deleted
}}
```

### Bulk Save

```tsx
onBulkSave={async (changes) => {
  // changes.new: new rows
  // changes.modified: modified rows [{ original, updated }]
  // changes.deleted: deleted rows [{ id, data }]

  const result = await bulkSaveProducts(changes)

  return {
    success: result.saved, // Array of saved rows
    failed: result.errors.map(err => ({
      row: err.row,
      error: err.message
    }))
  }
}}
```

## Column Definition

### Basic Column

```tsx
{
  accessorKey: 'name',
  header: 'Name',
  editable: false // Default: false
}
```

### Editable Column

```tsx
{
  accessorKey: 'price',
  header: 'Price',
  editable: true,
  renderEditCell: ({ value, onChange, error }) => (
    <CmxInput
      type="number"
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className={error ? 'border-red-500' : ''}
    />
  )
}
```

### Column with Custom Validator

```tsx
{
  accessorKey: 'code',
  header: 'Code',
  editable: true,
  validate: async (value, row) => {
    if (value.length < 3) {
      return 'Code must be at least 3 characters'
    }
    return null
  },
  renderEditCell: ({ value, onChange, error }) => (
    <CmxInput
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={error ? 'border-red-500' : ''}
    />
  )
}
```

## Error Handling

### Error Callback

```tsx
onError={(error, context) => {
  // error.type: 'save' | 'delete' | 'bulk_save' | 'validation'
  // error.message: error message
  // error.rowId: affected row ID
  // context.operation: 'create' | 'update' | 'delete' | 'bulk_save'
  // context.row: row data (if applicable)

  console.error('Table error:', error, context)
  // Custom error handling
}}
```

### Error States

- **Validation errors**: Shown inline at cell/row level, prevent save
- **Save errors**: Shown inline, row stays in editing state, allows retry
- **Delete errors**: Toast notification, row restored, allows retry
- **Bulk save errors**: Summary shown, failed rows marked, allows partial retry

## Configuration Options

```tsx
<CmxEditableDataTable
  // Data
  data={data}
  columns={columns}
  getRowId={(row) => row.id} // Optional: defaults to row.id
  // CRUD
  onSave={onSave}
  onBulkSave={onBulkSave} // Optional
  onDelete={onDelete} // Optional
  onSoftRemove={onSoftRemove} // Optional
  // Validation
  validationSchema={schema} // Optional
  cellValidators={cellValidators} // Optional
  asyncRowValidator={asyncRowValidator} // Optional
  // Error handling
  onError={onError} // Optional
  // UI Configuration
  enableInlineAdd={true} // Default: false
  enableBulkSave={true} // Default: false
  enableSoftDelete={true} // Default: false
  showActionsColumn={true} // Default: true
  newRowPosition="top" // 'top' | 'bottom', Default: 'top'
  // Standard table props
  loading={false}
  page={0}
  pageSize={10}
  total={100} // Optional: for server-side pagination
  onPageChange={(page) => {}}
  onPageSizeChange={(size) => {}}
/>
```

## Data Layer Integration

The component is agnostic to database structure. Handle DB conventions in your data layer:

```tsx
async function saveProduct(row: Product): Promise<Product> {
  // Handle audit fields
  const data = {
    ...row,
    updated_at: new Date().toISOString(),
    updated_by: getCurrentUserId(),
    // rec_status, is_active handled by data layer
  };

  const saved = await supabase.from("products").upsert(data).select().single();

  return saved.data;
}
```

## Best Practices

1. **Always provide getRowId** for stable row identification
2. **Use Layer 1 (Zod) for structure validation** - it's the most maintainable
3. **Use Layer 2 for field-dependent logic** - when validation depends on other fields
4. **Use Layer 3 for server checks** - uniqueness, business rules, tenant context
5. **Handle errors gracefully** - provide user feedback and retry options
6. **Keep renderEditCell simple** - use Cmx components for consistency
7. **Separate data layer concerns** - component doesn't know about DB conventions

## TypeScript Types

All types are exported from `@ui/data-display`:

```typescript
import type {
  CmxEditableDataTableProps,
  EditableColumnDef,
  TableChanges,
  BulkSaveResult,
  TableError,
  ErrorContext,
} from "@ui/data-display";
```

## Examples

See `user_guide.md` for complete usage examples.

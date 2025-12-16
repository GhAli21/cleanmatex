# CmxEditableDataTable - User Guide

## Overview

`CmxEditableDataTable` provides a spreadsheet-like editing experience directly in your data tables. You can edit, add, delete, and manage records without leaving the table view.

## Features

- ✅ **Inline Editing**: Click any editable cell to edit directly
- ✅ **Add New Rows**: Insert new records inline
- ✅ **Delete Records**: Hard delete or soft remove records
- ✅ **Bulk Operations**: Save multiple changes at once
- ✅ **Validation**: Real-time validation with clear error messages
- ✅ **Visual Feedback**: See which rows are new, modified, or have errors

## Basic Operations

### Editing a Cell

1. Click on any editable cell (cells with a pencil icon in the Actions column)
2. The cell becomes an input field
3. Make your changes
4. Click the **Save** button (✓) in the Actions column
5. Or click **Cancel** (✗) to discard changes

### Adding a New Row

1. Click the **"Add Row"** button at the top of the table
2. A new empty row appears at the top
3. Fill in the required fields
4. Click **Save** to create the record

### Deleting a Row

1. Click the **Delete** button (trash icon) in the Actions column
2. Confirm the deletion in the dialog
3. The row is removed immediately

### Soft Removing a Row

1. Click the **Soft Remove** button (rotate icon) in the Actions column
2. Confirm the removal
3. The row is marked as deleted but can be restored later

### Saving Multiple Changes

1. Make changes to multiple rows
2. Click the **"Save All"** button at the top
3. All pending changes are saved at once
4. A summary shows how many rows were saved successfully

## Visual Indicators

### Row Colors

- **Blue background**: New row (not yet saved)
- **Yellow background**: Modified row (has unsaved changes)
- **Red background**: Row with validation errors

### Action Buttons

- **Edit** (pencil icon): Start editing a row
- **Save** (checkmark icon): Save changes to a row
- **Cancel** (X icon): Cancel editing and discard changes
- **Delete** (trash icon): Permanently delete a row
- **Soft Remove** (rotate icon): Soft delete a row (can be restored)

## Validation

### Field-Level Errors

If a field has a validation error:

- The input field shows a red border
- An error message appears below the field
- The row cannot be saved until the error is fixed

### Row-Level Errors

If a row has validation errors:

- The entire row has a red background
- Error messages appear for each invalid field
- The row cannot be saved until all errors are resolved

### Common Validation Rules

- **Required fields**: Must have a value
- **String length**: Must be within specified min/max length
- **Numeric ranges**: Must be within specified min/max values
- **Format validation**: Must match specified pattern (e.g., email, code format)
- **Uniqueness**: Must be unique (checked on server)
- **Business rules**: Custom rules based on other fields or tenant context

## Error Handling

### Save Errors

If saving fails:

- An error message appears in the row
- The row stays in editing mode
- You can fix the issue and try again

### Delete Errors

If deletion fails:

- A toast notification appears
- The row is restored
- You can try again

### Bulk Save Errors

If bulk save has failures:

- A summary shows successful and failed saves
- Failed rows are marked with errors
- You can fix errors and save again

## Tips

1. **Save frequently**: Don't wait too long before saving changes
2. **Check validation**: Fix validation errors before saving
3. **Use bulk save**: When making many changes, use "Save All" for efficiency
4. **Cancel unwanted changes**: Use Cancel to discard changes you don't want to keep
5. **Soft delete when possible**: Use soft remove if you might need to restore the record later

## Keyboard Shortcuts

Currently, keyboard shortcuts are not implemented. This is a future enhancement.

## Troubleshooting

### Can't edit a cell

- Make sure the column is marked as editable
- Check if the row is in editing mode (click Edit button first)

### Can't save a row

- Check for validation errors (red fields)
- Make sure all required fields are filled
- Check for server-side validation errors

### Changes are lost

- Make sure to click Save before navigating away
- Use "Save All" to save multiple changes at once
- Don't refresh the page without saving

### Row disappeared

- Check if it was deleted (hard delete)
- Check if it was soft removed (can be restored)
- Check the current page/filter settings

## Examples

### Simple Editable Table

```tsx
<CmxEditableDataTable
  data={products}
  columns={columns}
  onSave={async (row) => await saveProduct(row)}
  enableInlineAdd
/>
```

### With Validation

```tsx
<CmxEditableDataTable
  data={products}
  columns={columns}
  validationSchema={productSchema}
  cellValidators={cellValidators}
  asyncRowValidator={asyncRowValidator}
  onSave={async (row) => await saveProduct(row)}
  enableInlineAdd
/>
```

### With Bulk Save

```tsx
<CmxEditableDataTable
  data={products}
  columns={columns}
  onSave={async (row) => await saveProduct(row)}
  onBulkSave={async (changes) => await bulkSaveProducts(changes)}
  enableInlineAdd
  enableBulkSave
/>
```

### With Soft Delete

```tsx
<CmxEditableDataTable
  data={products}
  columns={columns}
  onSave={async (row) => await saveProduct(row)}
  onSoftRemove={async (id) => await softRemoveProduct(id)}
  enableInlineAdd
  enableSoftDelete
/>
```

## Support

For technical questions or issues, refer to the Developer Guide or contact the development team.

---
name: Customer Addresses CRUD Tab - Best Practices Review
overview: "Review and update the customer addresses CRUD plan to align with project best practices: RTL support, error handling patterns, loading states, i18n usage, component structure, and state management consistency."
todos: []
isProject: false
---

# Customer Addresses CRUD Plan - Best Practices Review

## Issues Found & Recommendations

### ✅ What's Good

1. **Multi-tenancy**: Correctly notes that all queries already enforce `tenant_org_id` - no changes needed
2. **Type safety**: Correctly identifies need to extend `CustomerWithTenantData` with `addresses?: CustomerAddress[]`
3. **API usage**: Correctly identifies existing APIs and no need for new routes
4. **Component extraction**: Suggests extracting to component file (matches `CustomerOrdersSection` pattern)

### ⚠️ Issues to Fix

#### 1. **RTL Support Not Explicitly Specified**

**Issue**: Plan mentions RTL but doesn't specify implementation details.

**Fix**: Add explicit requirements:

- Import and use `useRTL()` hook: `const isRTL = useRTL()`
- Use Tailwind RTL classes for spacing: `ml-4 rtl:ml-0 rtl:mr-4`
- Set `dir` attribute on text inputs: `dir={isRTL ? 'rtl' : 'ltr'}`
- Use conditional flex direction: `flex ${isRTL ? 'flex-row-reverse' : ''}`
- Reference `AddressFormModal` as example (already implements RTL correctly)

#### 2. **Error Handling Pattern Not Specified**

**Issue**: Plan doesn't specify how to handle errors (inline state vs cmxMessage).

**Fix**: Align with existing page pattern:

- Use local state for errors: `const [error, setError] = useState<string | null>(null)`
- Display errors inline (similar to `advanceError` in the page)
- OR: Use toast/notification system if one exists (check if `cmxMessage` or toast utilities are available)
- Show loading states during API calls: `const [loading, setLoading] = useState(false)`

#### 3. **Loading States Missing**

**Issue**: Plan doesn't mention loading indicators during create/update/delete operations.

**Fix**: Add requirements:

- Show loading state on buttons during API calls
- Disable buttons/form during loading
- Show spinner or "Saving..." text (like `AddressFormModal` already does)

#### 4. **i18n Usage Not Detailed**

**Issue**: Plan mentions checking keys but doesn't specify hook usage.

**Fix**: Add explicit requirements:

- Use `const t = useTranslations('customers')` for address-specific keys
- Use `const tCommon = useTranslations('common')` for common actions (save, cancel, delete, confirm)
- Ensure all UI strings use translation keys (no hardcoded English)
- Add missing keys to both `en.json` and `ar.json`

#### 5. **State Management Refetch Strategy**

**Issue**: Plan suggests Option A (refetch customer) but doesn't specify implementation.

**Fix**: Clarify implementation:

- Create a callback function in parent: `const handleAddressesChange = async () => { const data = await getCustomerById(customerId); setCustomer(data); }`
- Pass callback to AddressesTab: `onAddressesChange={handleAddressesChange}`
- Call callback after successful create/update/delete/set-default
- OR: Use `router.refresh()` if Next.js router refresh is preferred (matches advance payment pattern)

#### 6. **Delete Confirmation Not Specified**

**Issue**: Plan mentions confirmation dialog but doesn't specify implementation.

**Fix**: Specify approach:

- Use browser `confirm()` for simplicity (matches existing patterns) OR
- Create custom confirmation modal component
- Use i18n key: `tCommon('confirmDelete')` or `t('deleteAddressConfirm')`

#### 7. **Address Type Default Location**

**Issue**: Plan mentions defaulting to 'home' but doesn't specify where.

**Fix**: Specify in `AddressFormModal` submit handler:

```typescript
const addressData: CreateAddressRequest = {
  addressType: "home", // Default if not provided
  label: formData.label,
  // ... rest
};
```

#### 8. **Component File Location**

**Issue**: Plan suggests `components/` folder, but frontend skill says "NEVER create components/".

**Fix**: Clarify exception:

- Page-specific components (like `CustomerOrdersSection`) ARE allowed in `app/dashboard/customers/[id]/components/`
- This is an exception to the general rule (which applies to reusable components)
- Keep AddressesTab in same location: `app/dashboard/customers/[id]/components/customer-addresses-section.tsx`

#### 9. **Property Name Mismatches**

**Issue**: Plan identifies `street_address` vs `street` but should be more explicit.

**Fix**: Add explicit mapping:

- Display: Use `address.street` (not `street_address`)
- Display: Use `address.isDefault` (not `is_default`)
- Display: Use `address.deliveryNotes` (not `delivery_notes`)
- Display: Use `address.building`, `address.area`, `address.city`, `address.label`
- Ensure all properties match `CustomerAddress` type exactly

#### 10. **Missing: Optimistic Updates Consideration**

**Issue**: Plan doesn't mention whether to use optimistic updates or wait for refetch.

**Fix**: Specify approach:

- **Recommended**: Wait for API success, then refetch (safer, matches existing patterns)
- Avoid optimistic updates unless there's a performance issue (keeps code simpler)

## Updated Implementation Checklist

### Phase 1: Types & Data Flow

- Extend `CustomerWithTenantData` with `addresses?: CustomerAddress[]` in `lib/types/customer.ts`
- Update `getCustomerById` return type if needed
- Pass `customer.addresses ?? []` to AddressesTab in page.tsx

### Phase 2: AddressesTab Component

- Extract to `components/customer-addresses-section.tsx`
- Type prop: `addresses: CustomerAddress[]` (not `any[]`)
- Add `useRTL()` hook and apply RTL classes
- Add `useTranslations('customers')` and `useTranslations('common')`
- Fix display properties: use `address.street`, `address.isDefault`, etc.
- Add state: `showModal`, `editingAddress`, `loading`, `error`
- Wire "Add Address" / "Add First Address" buttons to open modal
- Wire "Edit" button to open modal with address
- Wire "Delete" button with confirmation
- Wire "Set as default" button/link
- Add loading indicators on buttons during API calls
- Display error messages inline (or via toast if available)
- Add `onAddressesChange` callback prop

### Phase 3: Modal Integration

- Render `AddressFormModal` when `showModal` is true
- Pass `customerId`, `address: editingAddress`, `onClose`, `onSuccess`
- On success: close modal, call `onAddressesChange()`
- Ensure `addressType: 'home'` is set in create payload

### Phase 4: API Calls & Refetch

- Implement `handleAddressesChange` callback in parent page
- Call `getCustomerById(customerId)` and `setCustomer(data)`
- Call callback after successful create/update/delete/set-default
- Handle errors and show user-friendly messages

### Phase 5: i18n

- Search existing keys in `messages/en.json` and `messages/ar.json`
- Reuse `common.*` keys (save, cancel, delete, confirm)
- Add missing keys: `deleteAddressConfirm`, `setAsDefault`, `defaultAddress`, etc.
- Ensure all UI strings use translation keys

### Phase 6: Testing & Polish

- Test RTL layout (switch to Arabic)
- Test all CRUD operations
- Test error handling (network errors, validation errors)
- Test loading states
- Verify tenant isolation (addresses only show for correct tenant)
- Run `npm run build` and fix any TypeScript errors

## Best Practices Alignment Summary

| Practice            | Status | Notes                                         |
| ------------------- | ------ | --------------------------------------------- |
| Multi-tenancy       | ✅     | Already enforced in service layer             |
| Type safety         | ✅     | Plan correctly identifies type fixes          |
| RTL support         | ⚠️     | Needs explicit implementation details         |
| i18n                | ⚠️     | Needs explicit hook usage and key strategy    |
| Error handling      | ⚠️     | Needs pattern specification (inline vs toast) |
| Loading states      | ⚠️     | Missing from plan                             |
| Component structure | ✅     | Matches existing pattern                      |
| State management    | ⚠️     | Needs explicit callback implementation        |
| API usage           | ✅     | Correctly identifies existing APIs            |

## Recommendation

**Update the plan** to include:

1. Explicit RTL implementation requirements
2. Error handling pattern (inline state matching page pattern)
3. Loading state requirements
4. Explicit i18n hook usage
5. Detailed callback implementation for refetch
6. Delete confirmation implementation approach
7. Address type default location specification

The plan is **fundamentally sound** but needs these details added for complete alignment with project best practices.

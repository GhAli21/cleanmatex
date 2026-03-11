version: v1.0.0
last_updated: 2025-01-20
author: Development Team

# Language Switching - Batch Component Update Plan

## Current Progress: ~35% Complete

### ✅ Completed Components

#### Layout (100%)
- TopBar.tsx
- Sidebar.tsx  
- LanguageSwitcher.tsx

#### Dashboard (100%)
- All 9 dashboard widgets

#### Orders (90%)
- OrderTable.tsx
- OrderFiltersBar.tsx
- OrderStatsCards.tsx
- Orders page

#### Customers (60%)
- Customer page header
- CustomerTable.tsx (in progress)

---

## Batch Update Strategy

### Batch 1: Complete Customer Components (High Priority)
**Estimated Time: 2 hours**
- [x] CustomerTable.tsx (90% done)
- [ ] CustomerFiltersBar.tsx
- [ ] CustomerStatsCards.tsx
- [ ] CustomerCreateModal.tsx
- [ ] CustomerDetailPage.tsx

### Batch 2: Order Creation Flow (High Priority)
**Estimated Time: 4 hours**
- [ ] New Order Page
- [ ] CustomerPickerModal.tsx
- [ ] PaymentModal.tsx
- [ ] DescribeItemModal.tsx
- [ ] ReadyDatePickerModal.tsx
- [ ] OrderSummaryPanel.tsx

### Batch 3: Customer Modals (Medium Priority)
**Estimated Time: 2 hours**
- [ ] AddressFormModal.tsx
- [ ] OTPVerificationModal.tsx
- [ ] UpgradeProfileModal.tsx
- [ ] ConfirmationDialog.tsx

### Batch 4: Form Components (High Priority)
**Estimated Time: 3 hours**
- [ ] All form inputs
- [ ] Form labels
- [ ] Form placeholders
- [ ] Error messages
- [ ] Validation messages

### Batch 5: Remaining Tables (Medium Priority)
**Estimated Time: 2 hours**
- [ ] ProcessingTable.tsx
- [ ] UserTable.tsx
- [ ] ServiceCatalogTable.tsx

### Batch 6: Modal Components (Medium Priority)
**Estimated Time: 2 hours**
- [ ] All remaining modals
- [ ] Dialog components

### Batch 7: Settings & Other Pages (Low Priority)
**Estimated Time: 3 hours**
- [ ] Settings pages
- [ ] Reports components
- [ ] Utility components

---

## Update Pattern Template

For each component:

```typescript
// 1. Add imports
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { useLocale } from '@/lib/hooks/useRTL'

// 2. Add hooks
const t = useTranslations('moduleName')
const isRTL = useRTL()
const locale = useLocale()

// 3. Replace hardcoded strings
{t('key')}

// 4. Add RTL classes
className={`${isRTL ? 'text-right' : 'text-left'} ${isRTL ? 'ml-2' : 'mr-2'}`}

// 5. Update date formatting
.toLocaleDateString(locale === 'ar' ? 'ar-OM' : 'en-US', {...})
```

---

## Translation Keys to Add

### Common Keys Needed
- Loading states
- Empty states
- Error messages
- Success messages
- Button labels
- Form labels
- Placeholders
- Validation messages

### Component-Specific Keys
- Modal titles
- Dialog messages
- Table headers
- Filter labels
- Sort options

---

## RTL Considerations

### CSS Classes Pattern
```typescript
// Text alignment
className={isRTL ? 'text-right' : 'text-left'}

// Margins
className={isRTL ? 'ml-2' : 'mr-2'}

// Flex direction
className={isRTL ? 'flex-row-reverse' : ''}

// Or use Tailwind RTL variants
className="text-left rtl:text-right mr-2 rtl:mr-0 rtl:ml-2"
```

### Components That Need Special RTL Attention
- Forms (inputs, selects, checkboxes)
- Modals (positioning, button order)
- Tables (text alignment, pagination)
- Date pickers
- Dropdowns
- Tooltips

---

## Progress Tracking

- **Total Components**: ~100
- **Completed**: ~35
- **Remaining**: ~65
- **Completion**: ~35%

---

## Next Actions

1. Complete CustomerTable.tsx pagination RTL
2. Update CustomerFiltersBar.tsx
3. Update CustomerStatsCards.tsx
4. Continue with Batch 2 (Order Creation Flow)


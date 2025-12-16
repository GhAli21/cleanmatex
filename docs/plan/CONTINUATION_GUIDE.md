# Language Switching Implementation - Continuation Guide

**Current Status**: ~45% Complete (35 components done, ~65 remaining)  
**Last Updated**: 2025-01-20

## ✅ What's Been Completed

### Fully Completed Areas (100%)
- Layout Components (TopBar, Sidebar, LanguageSwitcher)
- Dashboard Widgets (all 9 widgets)
- Order Components (Table, Filters, Stats, Page)
- Customer Components (Table, Filters, Stats, Page Header)
- Infrastructure (CSS, translation keys, hooks)

## 📋 Remaining Work Strategy

### Priority 1: High-Impact Components (Next Steps)

1. **Customer Modals** (4 components - Quick wins)
   - CustomerCreateModal.tsx
   - AddressFormModal.tsx
   - OTPVerificationModal.tsx
   - UpgradeProfileModal.tsx

2. **Order Creation Flow** (14 components - Critical user path)
   - New Order Page
   - All modals (CustomerPicker, Payment, DescribeItem, ReadyDate)
   - All UI components (Tabs, Grid, Cards, Lists)
   - OrderSummaryPanel

3. **Processing Components** (11 components - Important workflow)
   - ProcessingTable, Page, Modals
   - Stats, Filters, Headers
   - Detail pages

### Priority 2: Medium Impact

4. Order Detail Components (~10)
5. Customer Detail Components (~4)
6. Other Workflow Pages (~15)

### Priority 3: Lower Impact

7. Catalog Components (~8)
8. Settings & Users (~15)
9. Reports & Other (~5)

## 🔧 Update Pattern for Remaining Components

Each component needs:

1. **Add Imports**:
```typescript
import { useTranslations } from 'next-intl'
import { useRTL } from '@/lib/hooks/useRTL'
import { useLocale } from '@/lib/hooks/useRTL'
```

2. **Add Hooks**:
```typescript
const t = useTranslations('moduleName')
const isRTL = useRTL()
const locale = useLocale()
```

3. **Replace Hardcoded Strings**:
- All user-facing text → `t('key')`
- Error messages → translation keys
- Button labels → translation keys
- Form labels/placeholders → translation keys

4. **Add RTL Support**:
- Text alignment: `className={isRTL ? 'text-right' : 'text-left'}`
- Margins: `className={isRTL ? 'ml-2' : 'mr-2'}`
- Flex direction: `className={isRTL ? 'flex-row-reverse' : ''}`
- Or use Tailwind RTL variants: `rtl:text-right rtl:ml-2`

5. **Update Date/Number Formatting**:
- Use locale-aware formatting
- `toLocaleDateString(locale === 'ar' ? 'ar-OM' : 'en-US', {...})`

## 📝 Translation Keys Needed

Add missing keys to `messages/en.json` and `messages/ar.json`:

### Common Patterns:
- Modal titles
- Form labels
- Placeholders
- Error messages
- Button labels
- Table headers
- Filter labels
- Status messages

### Component-Specific:
- Each component may need specific keys
- Check existing translation files first
- Follow existing key structure

## ✅ Quality Checklist for Each Component

- [ ] All hardcoded English text replaced with translations
- [ ] RTL layout support added
- [ ] Icons positioned correctly for RTL
- [ ] Form inputs have RTL text direction
- [ ] Error messages translated
- [ ] Loading states translated
- [ ] Empty states translated
- [ ] Date/number formatting is locale-aware
- [ ] Modal/dialog positioning works in RTL
- [ ] Dropdown menus work in RTL

## 🎯 Estimated Remaining Work

- **High Priority**: ~29 components (4+14+11)
- **Medium Priority**: ~29 components
- **Lower Priority**: ~28 components
- **Total**: ~86 components remaining

**Estimated Time**: 20-30 hours of focused development work

## 📚 Reference Documents

- `docs/plan/Language_Switching_Progress_Summary.md` - Detailed progress
- `docs/plan/FINAL_STATUS_AND_REMAINING_WORK.md` - Complete list
- `docs/plan/Language_Switching_Batch_Update_Plan.md` - Batch strategy
- `docs/plan/COMPLETED_COMPONENTS_LIST.md` - Completed items

---

**Note**: Continue systematically, completing one area before moving to the next for best results.


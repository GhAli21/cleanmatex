version: v1.0.0
last_updated: 2025-01-20
author: Development Team

# Language Switching Fix Plan - Complete App Coverage

**Document Type**: Implementation Plan  
**Feature**: Language Switching & Arabic/RTL Support  
**Priority**: High  
**Status**: Planning  
**Target Completion**: TBD

---

## Executive Summary

This document outlines a comprehensive plan to fix language switching functionality across the entire CleanMateX web-admin application. The plan addresses current issues with Arabic text display, RTL layout, translation coverage, and ensures seamless language switching without page reloads.

### Current Issues Identified

1. **Arabic Text Truncation**: Arabic text is being cut off due to improper CSS handling
2. **Inconsistent Translation Usage**: Some components still use hardcoded English text
3. **RTL Layout Issues**: Incomplete RTL support causing layout misalignments
4. **Language Switching UX**: Custom event-based switching may not update all components
5. **Font Rendering**: Arabic font not properly applied in all contexts

---

## Current State Analysis

### ✅ What's Working

1. **Translation Infrastructure**
   - ✅ `next-intl` configured and working
   - ✅ Translation files exist (`messages/en.json`, `messages/ar.json`)
   - ✅ 400+ translation keys available
   - ✅ Language switcher component exists

2. **Locale Management**
   - ✅ Client-side locale utilities (`locale.client.ts`)
   - ✅ Server-side locale utilities (`locale.server.ts`)
   - ✅ Locale persistence in localStorage and cookies
   - ✅ HTML `dir` and `lang` attributes update

3. **RTL Utilities**
   - ✅ RTL hooks (`useRTL.ts`)
   - ✅ Direction-aware CSS classes
   - ✅ Locale-aware formatting functions

### ❌ What's Broken

1. **Arabic Text Display**
   - ❌ Text truncation cutting off Arabic characters
   - ❌ Improper word-wrapping for Arabic text
   - ❌ Line-height issues causing text overflow
   - ❌ Font not consistently applied

2. **Translation Coverage**
   - ❌ Hardcoded English strings in some components
   - ❌ Missing translation keys for some UI elements
   - ❌ Database content (name/name2) not always displayed correctly

3. **RTL Layout**
   - ❌ Some components not respecting RTL direction
   - ❌ Icons not properly flipped for RTL
   - ❌ Dropdowns and modals positioning incorrectly in RTL

4. **Language Switching**
   - ❌ Components not re-rendering after language switch
   - ❌ Some state not updating with locale changes
   - ❌ Server components not aware of client-side locale changes

---

## Implementation Plan

### Phase 1: Fix Arabic Text Rendering (Priority: Critical)

**Objective**: Fix all Arabic text truncation and display issues

#### Task 1.1: CSS Fixes for Arabic Text

**Status**: ✅ Started (partially complete)

**Files to Update**:
- `web-admin/app/globals.css`

**Actions**:
- ✅ Added Arabic font rendering improvements
- ✅ Added word-wrapping fixes
- ✅ Added line-height improvements
- ✅ Fixed truncate class behavior for RTL

**Remaining Work**:
- [ ] Test Arabic text in all components
- [ ] Fix specific truncation issues in components
- [ ] Ensure proper font loading

**Estimated Time**: 2 hours

#### Task 1.2: Component-Level Text Fixes

**Components to Fix**:
1. `components/layout/LanguageSwitcher.tsx` - ✅ Fixed
2. `components/layout/TopBar.tsx` - Needs review
3. `components/layout/Sidebar.tsx` - Needs review
4. All components using `truncate` class

**Actions**:
- Replace `truncate` with RTL-aware text handling
- Add proper min-width constraints for Arabic text
- Ensure text containers allow proper wrapping

**Estimated Time**: 4 hours

---

### Phase 2: Complete Translation Coverage (Priority: High)

**Objective**: Ensure all user-facing text uses translation keys

#### Task 2.1: Audit All Components for Hardcoded Text

**Components to Audit**:
- `components/layout/` - All layout components
- `app/dashboard/**/components/` - All feature components
- `app/dashboard/**/page.tsx` - All page components

**Actions**:
1. Search for hardcoded English strings
2. Identify missing translation keys
3. Create translation keys for missing text
4. Update components to use translations

**Estimated Time**: 8 hours

#### Task 2.2: Update Translation Files

**Files to Update**:
- `messages/en.json`
- `messages/ar.json`

**Actions**:
- Add missing translation keys
- Ensure all keys have both English and Arabic translations
- Organize keys by feature/module

**Translation Key Structure**:
```json
{
  "common": { ... },
  "navigation": { ... },
  "dashboard": { ... },
  "orders": { ... },
  "customers": { ... },
  "layout": {
    "languageSwitcher": {
      "english": "English",
      "arabic": "العربية",
      "switchLanguage": "Switch Language"
    },
    "topBar": {
      "search": "Search...",
      "notifications": "Notifications",
      "noNotifications": "No new notifications"
    }
  }
}
```

**Estimated Time**: 6 hours

#### Task 2.3: Update Components to Use Translations

**Priority Components**:
1. Layout components (TopBar, Sidebar, Footer)
2. Navigation components
3. Form labels and placeholders
4. Error messages
5. Success messages
6. Button labels

**Pattern to Follow**:
```typescript
import { useTranslations } from 'next-intl';

export function MyComponent() {
  const t = useTranslations('moduleName');
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <button>{t('actions.save')}</button>
    </div>
  );
}
```

**Estimated Time**: 12 hours

---

### Phase 3: Fix RTL Layout Issues (Priority: High)

**Objective**: Ensure all components properly support RTL layout

#### Task 3.1: Fix Layout Components

**Components to Fix**:
1. `components/layout/Sidebar.tsx`
   - Ensure menu items align correctly
   - Fix expand/collapse icons
   - Ensure proper RTL spacing

2. `components/layout/TopBar.tsx`
   - Fix search bar positioning
   - Fix dropdown positioning
   - Ensure proper icon alignment

3. `components/layout/LanguageSwitcher.tsx`
   - ✅ Already improved
   - Verify dropdown positioning

**Actions**:
- Use RTL-aware CSS classes
- Test all dropdowns and modals
- Fix icon directions

**Estimated Time**: 6 hours

#### Task 3.2: Fix Form Components

**Components to Review**:
- All form inputs
- All dropdowns
- All modals
- All data tables

**Actions**:
- Ensure labels align correctly in RTL
- Fix input field directions
- Fix validation message alignment
- Ensure date pickers work in RTL

**Estimated Time**: 8 hours

#### Task 3.3: Fix Data Display Components

**Components to Review**:
- Tables
- Cards
- Lists
- Statistics widgets

**Actions**:
- Ensure proper text alignment
- Fix number formatting for RTL
- Ensure charts/graphs display correctly

**Estimated Time**: 6 hours

---

### Phase 4: Improve Language Switching Mechanism (Priority: Medium)

**Objective**: Ensure all components update when language changes

#### Task 4.1: Review Language Switching Implementation

**Current Implementation**:
- Uses custom events (`localeChange`)
- Updates HTML attributes
- Updates NextIntlClientProvider

**Issues**:
- Some components may not re-render
- Server components not aware of changes
- Potential race conditions

**Actions**:
1. Review AppProviders implementation
2. Ensure all client components use `useLocale()` hook
3. Add proper re-rendering triggers
4. Test language switching in all scenarios

**Files to Review**:
- `components/providers/AppProviders.tsx`
- `lib/utils/locale.client.ts`
- `lib/hooks/useRTL.ts`

**Estimated Time**: 4 hours

#### Task 4.2: Add Locale Context

**Actions**:
- Create a locale context provider
- Ensure all components can access current locale
- Add locale change listeners where needed

**Estimated Time**: 3 hours

---

### Phase 5: Database Content Display (Priority: Medium)

**Objective**: Ensure bilingual database fields display correctly

#### Task 5.1: Create Helper Functions

**Actions**:
- Create utility to get bilingual field based on locale
- Use `name` for English, `name2` for Arabic
- Handle null/empty values gracefully

**Example**:
```typescript
export function getBilingualField<T extends { name?: string; name2?: string }>(
  item: T,
  locale: Locale
): string {
  if (locale === 'ar' && item.name2) {
    return item.name2;
  }
  return item.name || item.name2 || '';
}
```

**Estimated Time**: 2 hours

#### Task 5.2: Update All Data Display Components

**Components to Update**:
- Product cards
- Customer lists
- Order items
- Service categories
- All places showing database content

**Actions**:
- Use helper function to get correct field
- Ensure fallback logic works
- Test with both languages

**Estimated Time**: 6 hours

---

### Phase 6: Testing & Validation (Priority: High)

**Objective**: Ensure all fixes work correctly

#### Task 6.1: Manual Testing Checklist

**Test Scenarios**:
1. ✅ Switch language from English to Arabic
2. ✅ Switch language from Arabic to English
3. ✅ Verify all text translates correctly
4. ✅ Verify RTL layout applies correctly
5. ✅ Verify Arabic text doesn't truncate
6. ✅ Verify all dropdowns position correctly
7. ✅ Verify forms work in both languages
8. ✅ Verify database content displays correctly
9. ✅ Verify navigation works in both languages
10. ✅ Verify modals and dialogs work correctly

**Components to Test**:
- [ ] Dashboard page
- [ ] Orders module (list, detail, new)
- [ ] Customers module (list, detail, create)
- [ ] Settings pages
- [ ] All modals and dialogs
- [ ] All forms
- [ ] All tables
- [ ] Navigation menu
- [ ] Top bar
- [ ] Language switcher

**Estimated Time**: 8 hours

#### Task 6.2: Automated Testing

**Actions**:
- Create E2E tests for language switching
- Test RTL layout with Playwright
- Test translation loading
- Test locale persistence

**Estimated Time**: 6 hours

---

## Technical Implementation Details

### CSS Changes for Arabic Text

**File**: `web-admin/app/globals.css`

Key changes:
```css
/* Arabic text rendering improvements */
[dir="rtl"] * {
  word-wrap: break-word;
  overflow-wrap: break-word;
  hyphens: auto;
}

/* Better line height for Arabic */
[dir="rtl"] p,
[dir="rtl"] span,
[dir="rtl"] div {
  line-height: 1.8;
  letter-spacing: 0;
}

/* Fix truncate for Arabic */
[dir="rtl"] .truncate {
  overflow: visible;
  text-overflow: clip;
  white-space: normal;
  word-wrap: break-word;
}
```

### Translation Key Structure

**Organize by Feature**:
```
messages/
├── en.json
│   ├── common
│   ├── navigation
│   ├── dashboard
│   ├── orders
│   ├── customers
│   ├── layout
│   └── ...
└── ar.json
    └── (same structure)
```

### RTL-Aware Component Pattern

```typescript
'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';

export function MyComponent() {
  const t = useTranslations('moduleName');
  const isRTL = useRTL();
  
  return (
    <div className={`flex ${isRTL ? 'flex-row-reverse' : 'flex-row'}`}>
      <span className={isRTL ? 'text-right' : 'text-left'}>
        {t('label')}
      </span>
    </div>
  );
}
```

---

## File Inventory

### Files to Create/Update

#### CSS Files
- ✅ `web-admin/app/globals.css` - Updated with Arabic fixes

#### Component Files (Priority Order)
1. `components/layout/TopBar.tsx` - Add translations, fix RTL
2. `components/layout/Sidebar.tsx` - Add translations, fix RTL
3. `components/layout/LanguageSwitcher.tsx` - ✅ Improved
4. All dashboard page components
5. All form components
6. All modal components

#### Translation Files
- `messages/en.json` - Add missing keys
- `messages/ar.json` - Add missing keys

#### Utility Files
- `lib/utils/bilingual.ts` - Create helper for bilingual fields
- `lib/hooks/useLocale.ts` - Improve locale hook

---

## Testing Checklist

### Visual Testing

- [ ] Switch to Arabic - verify all text changes
- [ ] Verify RTL layout is applied
- [ ] Check Arabic text doesn't truncate
- [ ] Verify dropdowns position correctly
- [ ] Check forms align properly
- [ ] Verify icons face correct direction
- [ ] Check navigation menu position
- [ ] Verify modals center correctly

### Functional Testing

- [ ] Language preference persists after refresh
- [ ] All components update when language changes
- [ ] Forms submit correctly in both languages
- [ ] Database content displays in correct language
- [ ] Date/time formats correctly
- [ ] Currency formats correctly
- [ ] Numbers format correctly

### Browser Testing

- [ ] Chrome (latest)
- [ ] Firefox (latest)
- [ ] Safari (latest)
- [ ] Edge (latest)

### Device Testing

- [ ] Desktop (1920x1080)
- [ ] Laptop (1366x768)
- [ ] Tablet (768x1024)
- [ ] Mobile (375x667)

---

## Timeline Estimate

| Phase | Tasks | Estimated Hours | Priority |
|-------|-------|----------------|----------|
| Phase 1 | Arabic Text Fixes | 6 hours | Critical |
| Phase 2 | Translation Coverage | 26 hours | High |
| Phase 3 | RTL Layout Fixes | 20 hours | High |
| Phase 4 | Language Switching | 7 hours | Medium |
| Phase 5 | Database Content | 8 hours | Medium |
| Phase 6 | Testing & Validation | 14 hours | High |
| **Total** | | **81 hours** | |

**Estimated Timeline**: 2-3 weeks (assuming 40 hours/week)

---

## Success Criteria

### Must Have (MVP)

1. ✅ Arabic text displays correctly without truncation
2. ✅ All layout components support RTL
3. ✅ Language switching works without page reload
4. ✅ All user-facing text uses translation keys
5. ✅ Basic RTL layout works correctly

### Should Have

1. Database content displays in correct language
2. All forms work correctly in RTL
3. All modals/dialogs position correctly
4. Date/time/currency formatting is locale-aware

### Nice to Have

1. Smooth transitions when switching languages
2. Language preference synced across tabs
3. Browser language detection
4. Accessibility improvements for RTL

---

## Risk Assessment

### High Risk

1. **Breaking Existing Functionality**
   - Risk: Changes to CSS/layout might break existing components
   - Mitigation: Test thoroughly, use feature flags if needed

2. **Performance Impact**
   - Risk: Loading all translations might slow down initial load
   - Mitigation: Use code splitting, lazy load translations

### Medium Risk

1. **Translation Quality**
   - Risk: Machine translations might not be accurate
   - Mitigation: Review all Arabic translations, use native speakers

2. **Browser Compatibility**
   - Risk: RTL support varies by browser
   - Mitigation: Test in all major browsers

---

## Dependencies

### Internal Dependencies

- Translation files must be updated before components
- CSS fixes should be done before component updates
- RTL utilities must be available

### External Dependencies

- `next-intl` package (already installed)
- Noto Sans Arabic font (already configured)
- Tailwind CSS RTL support (already available)

---

## Next Steps

1. **Immediate** (This Week):
   - ✅ Complete CSS fixes for Arabic text
   - Start auditing components for hardcoded text
   - Update translation files with missing keys

2. **Short Term** (Next Week):
   - Update layout components with translations
   - Fix RTL layout issues
   - Test language switching functionality

3. **Medium Term** (Following Weeks):
   - Complete translation coverage
   - Fix all RTL layout issues
   - Comprehensive testing

---

## References

### Related Documents

- `.claude/docs/i18n.md` - i18n guidelines
- `.cursor/rules/i18n.mdc` - i18n rules
- `docs/plan/PRD_023_Bilingual_Support_Implementation_Plan.md` - Original bilingual plan
- `docs/features/007_admin_dashboard/PHASE_11_I18N_RTL_STATUS.md` - Previous status

### External Resources

- [next-intl Documentation](https://next-intl-docs.vercel.app/)
- [RTL Styling Guide](https://rtlstyling.com/)
- [Noto Sans Arabic Font](https://fonts.google.com/noto/specimen/Noto+Sans+Arabic)

---

## Changelog

### [v1.0.0] - 2025-01-20

**Added**:
- Initial comprehensive plan for language switching fixes
- Phase-by-phase implementation approach
- Testing checklist and success criteria
- Timeline estimates

**Status**: Planning Phase

---

**Document End**


# CleanMateX UI/UX Rules

These rules apply to every web-admin page, screen, component, dialog, form, table, and report.

## 1. Quick enforcement checklist

Every screen must have:

- loading state for async data,
- empty state for lists/tables,
- error state with user-safe message,
- success/error feedback for mutations,
- mobile-first responsive layout,
- Arabic RTL support,
- i18n for all user-facing text,
- token-based styling,
- permission-aware actions,
- accessible keyboard/focus behavior.

## 2. Layout principles

- Use dashboard-first layout for admin flows.
- Use clear page title, description, breadcrumbs where relevant.
- Keep primary action visible and predictable.
- Group filters, batch actions, and export actions consistently.
- Use progressive disclosure for complex configuration screens.
- Keep destructive actions visually separated.

## 3. Responsive breakpoints

Test at minimum:

- `320px` mobile narrow,
- `768px` tablet,
- `1024px` laptop,
- `1440px` desktop.

Rules:

- mobile-first layout,
- tables must not break narrow screens,
- action bars should wrap or collapse into menus,
- dialogs should fit mobile height,
- no horizontal page overflow except intentional table scroll containers.

## 4. RTL rules

For Arabic:

- layout direction must switch correctly,
- text alignment must be direction-aware,
- icons with direction meaning must flip,
- breadcrumbs must remain readable,
- table columns must not become visually confusing,
- forms must keep labels and validation messages aligned.

Examples:

```tsx
<div className="text-left rtl:text-right" />
<ChevronRight className="rtl:rotate-180" />
<div className="ms-4" />
```

## 5. Visual hierarchy

- One clear primary action per main screen section.
- Secondary actions should not compete with primary actions.
- Use typography scale consistently.
- Use semantic badge/status components for statuses.
- Do not use color alone to communicate status.
- Pair critical status with icon or text.

## 6. Forms

Forms must:

- use clear labels,
- show required fields consistently,
- validate inline,
- prevent duplicate submit,
- show loading state,
- preserve user input on validation error,
- warn before closing dirty forms when data loss is possible.

Do not use placeholder as the only label.

## 7. Tables and filters

Tables must:

- use server-side pagination,
- show total rows,
- preserve filters when paging where expected,
- have clear empty state,
- support keyboard-accessible actions,
- avoid overcrowded columns,
- provide column priority/collapse strategy on mobile.

Filters must:

- have reset action,
- show active filter state,
- avoid hidden filters that affect results without visibility.

## 8. Feedback states

Async action flow:

1. User starts action.
2. Control enters loading/disabled state.
3. Result is shown through `cmxMessage` or inline feedback.
4. UI refreshes or invalidates relevant data.
5. User can recover from failure.

Never leave the user guessing if an action happened.

## 9. Empty states

Good empty state answers:

- What is empty?
- Why does it matter?
- What can the user do next?
- Is the next action blocked by permission or feature plan?

Bad:

```txt
No data
```

Better:

```txt
No orders found for the selected filters. Clear filters or create a new order if you have permission.
```

## 10. Error states

Errors must be:

- clear,
- user-safe,
- actionable where possible,
- localized,
- not raw backend exceptions.

For permission errors, explain the missing permission or feature plan in friendly business language.

## 11. Accessibility

Minimum standard: WCAG 2.1 AA.

Required:

- semantic HTML,
- keyboard navigation,
- visible focus states,
- proper labels,
- screen-reader-safe dialog titles,
- no color-only status,
- sufficient contrast,
- reduced-motion respect where animations exist.

## 12. Theme and branding

Use Cmx tokens and CSS variables only.

Do not hardcode:

- hex colors,
- raw brand blues/greens/reds,
- one-off shadows,
- one-off border radii,
- duplicated status styles.

Support:

- dark mode,
- accent themes,
- radius themes,
- density modes.

## 13. Microinteractions

Use subtle interactions only:

- hover state,
- focus state,
- pressed state,
- loading spinner/skeleton,
- short transition for overlays.

Avoid heavy animations in operational POS/workflow screens where speed matters.

## 14. CleanMateX operational UX priorities

For laundry operations, speed and accuracy beat decoration.

Prioritize:

- fast order intake,
- clear customer identity,
- clear payment status,
- clear workflow status,
- scan/QA exception visibility,
- no accidental destructive actions,
- minimal clicks for counter staff,
- readable Arabic and English layouts.

## 15. Documentation expectation

Reusable Cmx components should have usage examples and accessibility notes in the project docs or Storybook if Storybook exists.

When adding a new pattern, document:

- when to use,
- props,
- examples,
- accessibility notes,
- RTL behavior,
- loading/error/empty behavior.

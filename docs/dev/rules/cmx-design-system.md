# Rule: the Cmx design system (web-admin)

**Applies to:** every screen, page, dialog, form, table, report, print view, chart and shared component in `web-admin`. That covers new code and every file you touch.

**Authority:**
- This file is the single source for how web-admin UI looks and behaves.
- Component APIs are in `.claude/skills/frontend/ui-blueprint.md`.
- Why the tokens and themes work the way they do is in `docs/features/UI_Design_System_Enhace/THEMING_ARCHITECTURE_DESIGN.md` and `PR-07_FEATURE_REFERENCE.md`.
- If another doc says something different about colour, direction, tokens, dark mode or components, this file wins. Fix the other doc.

**Related rules:**
- `cmx-shared-components.md`: reuse and extend shared components.
- `cmx-message.md`: user feedback.
- `no-silent-money-mutation.md` and `order-fin-rules.md`: money fields and order money.

**Review:** run the `/cmx-ui-design-review` skill on any changed UI before you call it done. The same skill is in `.claude/skills/`, `.codex/skills/`, `.agents/skills/` (Antigravity) and `.cursor/skills/`, with the command `.cursor/commands/cmx-ui-design-review.md`. Keep the four copies identical when you change it.

---

## 1. The hard rules

1. **Cmx components only.** Build every screen from `src/ui/`, imported through `@ui/*`. Feature code never uses a raw `<button>`, `<input>`, `<select>`, `<textarea>`, `<label>` or `<table>`. It never imports Radix, shadcn, `sonner` or another UI kit directly.
2. **Theme tokens only, for every colour.**
   - No Tailwind palette classes (`bg-gray-100`, `text-blue-600`, `bg-white`, …).
   - No hex values, `rgb()` literals or arbitrary colour classes (`bg-[#fff]`).
   - No inline `style` colours.
3. **No `dark:` classes.** Dark mode comes from the person's choice (`<html data-mode>`), and the tokens switch by themselves. Tailwind's `dark:` follows only the device.
4. **Logical direction only.** Use `ms-/me-/ps-/pe-/start-/end-/text-start/text-end/rounded-s/border-s`. Never `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right`. Never `isRTL ? … : …` for layout classes, because logical classes already mirror.
5. **Every word a person sees comes from `messages/en/**` and `messages/ar/**`**, through `next-intl`. That includes `aria-label`, `title`, `placeholder` and `alt`.
6. **Feedback goes through `cmxMessage` / `useMessage()`** from `@ui/feedback`. Confirmations use `CmxConfirmDialog`. Never `alert()`, `window.confirm()` or the legacy toast helpers.
7. **Every async view has its states:**
   - loading (a skeleton);
   - empty (`CmxEmptyState`);
   - error (a safe, translated message);
   - success feedback after a change.
8. **Accessible by default:**
   - text contrast of at least 4.5:1 in light and dark;
   - a visible focus ring;
   - everything works from the keyboard;
   - every control and dialog has a name;
   - never colour alone (add an icon or text);
   - touch targets of 44px on touch screens.
9. **Paper is always light.** Every print or paper-preview root carries `data-mode="LIGHT"`.
10. **Shared defaults are imported, never copied.** Examples: the page size (`CMX_DEFAULT_PAGE_SIZE`), the z-index scale and the status tones.
11. **Missing capability → extend the shared component.** Keep the change backward compatible, and add a test and a story. Never build a feature-local copy.
12. **`src/ui` never imports feature code.** Pass feature parts in as props or children.

---

## 2. Colour tokens

Tokens are defined in `src/ui/foundations/tokens.css`, which is generated from `lib/theme/brand-palette.ts`. They are exposed as Tailwind colours in `app/globals.css`. The Organization theme replaces the brand values on the server, so a token class follows the Organization's colours. A literal colour never does.

| Need | Class | Note |
|---|---|---|
| Page background / text | `bg-background` / `text-foreground` | |
| Card, panel, dialog surface | `bg-card` / `text-card-foreground` | `bg-white` → `bg-card` |
| Popover / menu surface | `bg-popover` / `text-popover-foreground` | |
| Quiet area, table stripe, hover row | `bg-muted`, `bg-surface-muted` | |
| Secondary text, hints, captions | `text-muted-foreground` | |
| Lines, dividers, input borders | `border-border`, `border-input`, `divide-border` | |
| Main action fill (follows the brand) | `bg-primary` + `text-primary-foreground`, hover `bg-primary-hover` | Never white text on the brand colour. Use `primary-foreground`. |
| Brand colour used as text or a link on a surface | `text-primary-text` | `text-primary` on white is too faint |
| Light brand tint | `bg-primary-bg` | |
| Second brand colour | `bg-brand-secondary` + `text-brand-secondary-foreground` | |
| Status tint (badge, banner, row) | `bg-{t}-bg` + `text-{t}-text` + `border-{t}-border` | `t` = `success`, `warning`, `danger`, `info` |
| Status solid fill | `bg-success`, `bg-warning` (with `text-warning-foreground`, near-black), `bg-destructive` (with `text-destructive-foreground`), `bg-info` | White on amber fails contrast |
| White text or lines on any other saturated fill | `text-on-solid`, `border-on-solid/N` | Always white |
| Focus ring | `ring-ring` (and `focus-visible:`) | |
| Overlay backdrop, photo shade | `bg-black/50` | Black is the only raw colour allowed |

Colour meaning is fixed:
- **success** = done, paid, posted.
- **warning** = needs attention.
- **danger / destructive** = error, overdue, delete.
- **info** = neutral information.
- **primary / brand** = the main action.

Never use a status tone for decoration, or a decorative colour for a status.

**Badges:** `CmxStatusBadge` with one of 6 tones (`neutral info success warning danger brand`) and one of 3 appearances (`soft outline solid`). Order statuses map through `orderStatusTone()`. Do not write status colours by hand.

**CSS outside Tailwind** (Recharts, third-party widgets, `globals.css`): use `rgb(var(--cmx-<name>-rgb))` or `rgb(var(--cmx-<name>-rgb) / 0.5)`.

**Data colours** are a colour the user picked or a garment colour from the database. They are not theme colours, and they may be rendered as data with an ignore comment (§12). Example: `style={{ backgroundColor: garment.hex }}`.

---

## 3. Theme, dark mode and paper

- The server resolves one theme per request: the HQ theme, then the Organization's overrides (if the plan allows them), then the user's preferences. The result is written as `<html data-mode data-density data-font-scale data-font>` plus the theme CSS. There is no client-side theme switching, and no flash of the wrong colours.
- `data-mode` is `LIGHT`, `DARK` or `SYSTEM` (`SYSTEM` follows the device). Nothing in feature code reads or branches on the mode. If you need a CSS difference that no token covers, write a `[data-mode=DARK] …` rule in `globals.css`. Never use `dark:`.
- Logos: render both images with `cmx-logo-light` / `cmx-logo-dark` when a dark logo exists. CSS shows the right one.
- **Paper:**
  - Print and paper-preview roots get `data-mode="LIGHT"`. Guard: `paper-light.test.ts`.
  - The `@media print` block forces light values.
  - Never put `bg-card` or brand fills inside an always-light print area expecting them to be dark.
- **Density and font scale** come from the person's preferences. Do not hard-code a compact or large variant for one screen. Use the Cmx size props.

---

## 4. Direction (Arabic RTL)

- English is the design and Arabic is its mirror. Logical classes do the mirroring. Do not add `rtl:flex-row-reverse` or `rtl:space-x-reverse`: they put rows back in English order.
- Icons that point a direction (chevrons, arrows, "back", "next") get `rtl:rotate-180`. Icons without a direction (search, check, trash) are not flipped.
- Flips that cannot be logical (`rotate-*`, `scale-x-*`, `translate-x-*`) use `rtl:` / `ltr:`.
- **Off-canvas panels:** slide under a max-breakpoint, for example `max-lg:ltr:-translate-x-full max-lg:rtl:translate-x-full`. Never `ltr:` plus `lg:translate-x-0`: Tailwind emits `ltr:`/`rtl:` after breakpoints, so the panel stays hidden. Guard: `off-canvas-direction.test.ts`.
- `useRTL()` / `isRTL` is only for things that are not about layout: locale strings, the chart axis order, a library option that takes `'rtl'`.
- These stay left-to-right inside Arabic text: codes, phone numbers, IBANs, e-mails and URLs. Use `dir="ltr"` or `<bdi>`, or `CmxCodeChip` for codes. Money and numbers use `<bdi className="tabular-nums">` or `CmxMoneyText`.
- Radix-based components follow the page direction. Do not pass `dir` by hand unless you deliberately force a direction.

---

## 5. Size, spacing, shape and layers

| Thing | Use | Not |
|---|---|---|
| Spacing | Tailwind scale (`p-4`, `gap-2`, `space-y-3`) | `p-[13px]` |
| Corner radius | `rounded-sm/md/lg` (the theme's radius preset) | `rounded-[10px]` |
| Shadow | `shadow-sm/md/lg` | `shadow-[…rgba…]` |
| Layers | Tailwind `z-0…z-50` inside a page. Above the page, the Cmx overlay's own layer (`zIndex` scale in `src/ui/foundations/zindex.ts`) | `z-[9999]`, `zIndex: 2000` in a feature |
| Type size | `text-xs … text-4xl` (`typography.ts`) | `text-[13px]` |
| Font family | inherited (`--font-sans`, `--font-arabic`, `--font-mono` for codes) | a `font-family` in a screen |
| Numbers in columns | `tabular-nums` | |
| Touch (POS, tablets) | 44px targets on touch screens: `size="lg"`, or add `pointer-coarse:min-h-11` (as `CmxCodeChip` and the POS summary panel do). `CmxButton` `md` is 40px. | `xs`/`sm` buttons as the main touch actions |

Layout is mobile first. It must not cause a horizontal page scroll at 320px; a table may scroll inside its own container. Check 320, 768, 1024 and 1440 px.

---

## 6. Which component

Search `src/ui/` first. The table lists the usual answers.

| Need | Component (`@ui/…`) |
|---|---|
| Button, icon button | `CmxButton` (`variant`: primary, secondary, ghost, outline, destructive; `size`: xs, sm, md, lg, icon). Icon-only buttons need `aria-label`. |
| Text, number, textarea | `CmxInput`, `CmxTextarea` |
| Money input / display | `CmxMoneyField` / `CmxMoneyFieldController`, `CmxMoneyText`. Order money uses `OrderFinancialView` (`order-fin-rules.md`). |
| Select | `CmxSelectDropdown` (Radix, portalled, keyboard and RTL), or `CmxSelect` for a simple native list. Values from a table use the LOV/picker (`CmxListOfValuesDialog`). |
| Checkbox, radio, switch | `CmxCheckbox`, `CmxCheckboxGroup`, `CmxRadioGroup`, `CmxSwitch` |
| Label + help + error around a field | `CmxFormField` (React Hook Form) or `CmxFieldShell`. A bare label uses `Label` from `@ui/primitives`. |
| Form layout | `CmxForm`, `CmxFormSection`, `CmxFormActions`, `CmxFormStatusBanner`, `CmxFormSkeleton` |
| List / report table | `CmxDataTable` (server-side paging, `CmxPagination`, `cmx-table-defaults.ts`), or `CmxDataGrid` |
| Editable grid | `CmxEditableDataTable` |
| Page frame (title, actions, KPIs, filters) | `CmxCrudPageShell` |
| Card | `CmxCard` + `CmxCardHeader/Title/Content/Footer`, `CmxCardWithHeader` |
| KPI | `CmxKpiStatCard` |
| Status | `CmxStatusBadge` |
| Banner / summary of problems | `CmxSummaryMessage` |
| Dialog, confirm | `CmxDialog` (focus trap, Escape, name), `CmxConfirmDialog` |
| Toast / message | `cmxMessage`, `useMessage()` |
| Tabs, steps, wizard | `CmxTabs` / `CmxTabsPanel`, `CmxProgressSteps`, `CmxWizard` |
| Empty, loading | `CmxEmptyState`, `CmxSkeleton` / `CmxSkeletonTable`, `CmxSpinner` |
| Codes (order, item, piece, tag) | `CmxCodeChip` (left to right, copy) |
| Files and photos | `@features/file-util` widgets (`/file-util-wire`) |
| Charts | `@ui/charts`, with token colours (§11) |

If nothing fits: compose Cmx parts in the feature folder. If it will be reused, create `src/ui/<group>/cmx-<name>.tsx` (§12 below and `/storybook`).

---

## 7. Page structure and states

- A dashboard page composes a feature screen (`app/` is routing only). A list or workspace screen uses `CmxCrudPageShell`: a title and subtitle, one primary action, then filters, then content.
- Each section has one primary action. Destructive actions are separate from it and confirm first.
- **States, every time data loads:**
  - loading → a skeleton in the content's shape (no full-page spinner on a page that is already open);
  - empty → `CmxEmptyState` with a next step;
  - error → a translated message and a retry when it makes sense;
  - forbidden → the action is hidden or disabled with a reason.
- Mutations and form submit locking:
  - separate `isLoading` (initial data/session fetch → skeleton or neutral disabled state), `isSubmitting` (user submit in flight), and `isRedirecting` (navigation after a successful submit);
  - while `isSubmitting` or `isRedirecting`, lock the entire form (`CmxForm` wraps children in `<fieldset disabled>` and drops duplicate submits via a synchronous ref), show a loading indicator on the active submit control, and block modal close/cancel actions;
  - re-enable controls only after a non-redirecting response or error — never unlock in `finally` before a `window.location.assign` / route transition completes;
  - pair UI submit locking with backend idempotency protection for critical operations (orders, payments, refunds, postings);
  - the result goes through `cmxMessage`;
  - form errors sit under the field;
  - no silent money changes.

---

## 8. Accessibility

- Contrast is at least 4.5:1 for text and 3:1 for large text and UI lines, in light and dark. Seeded themes are guarded by `seeded-theme-contrast.test.ts`, and the tokens are built for it. Custom fills you introduce must be checked too.
- Focus is visible (`focus-visible:ring-2 ring-ring`). Never `outline-none` without a replacement.
- Keyboard:
  - Tab order follows the screen.
  - Escape closes the top layer only.
  - Focus returns to the opener when a dialog closes.
  - Shortcuts do nothing while a dialog is open (see the POS shortcuts in `PR-07_FEATURE_REFERENCE.md`).
- Names:
  - icon-only buttons have `aria-label`;
  - dialogs have a title;
  - inputs have a label;
  - decorative icons have `aria-hidden`.
- Status is never colour alone: pair it with text or an icon. Use `role="status"` / `aria-live` for updates that appear without a page change.
- Use semantic elements inside Cmx compositions (`nav`, `main`, headings in order).

---

## 9. Numbers, money, codes, dates

- Format with `Intl` / `next-intl` and the Organization's currency and precision. Never build money strings by hand.
- Columns of numbers use `tabular-nums` and line up at the end.
- Codes are DB-generated human codes, shown with `CmxCodeChip` or `dir="ltr"`. Never show UUIDs as business IDs.
- Dates use the locale formatters, never a hard-coded `dd/MM/yyyy`.

---

## 10. Text and feedback

- No English literals in JSX or in string props. Generic words reuse `common.*`. Check the glossary (`docs/dev/i18n_docs/GLOSSARY.md`) first. Placeholders and plurals use ICU. Load `/i18n`.
- Example placeholders:
  - people and business examples are translated ("John Doe");
  - format examples stay as they are (`PROD-00001`).
- Operational feedback goes through `cmxMessage` with an already-translated string (`cmx-message.md`). Field errors stay under the field. Persistent banners use `CmxSummaryMessage`.

---

## 11. Charts, icons, images

- **Charts:**
  - Axis, grid, tooltip and legend read tokens (`globals.css`).
  - Series colours come from tokens: `rgb(var(--cmx-primary-rgb))`, the status tokens, `--cmx-brand-secondary-rgb`.
  - A hex series palette inside a widget is debt (§14).
  - Values are tabular, and the axis order follows the direction.
- **Icons:** `lucide-react` for UI icons; MDI class names only for catalog icons stored in the database. Size icons with `size-4` / `size-5`; their colour comes from `currentColor`.
- **Images:** give every image `alt` (translated) or `alt=""` when it is decorative. Logos follow §3.

---

## 12. Changing `src/ui`

- **New shared component:**
  - `src/ui/<group>/cmx-<name>.tsx`, exported as `Cmx<Name>` from the group `index.ts`;
  - tokens and logical classes only (ESLint enforces this in `src/ui`);
  - EN/AR through props or `next-intl`;
  - RTL;
  - keyboard and focus;
  - a story (`/storybook`) and a test in `__tests__/ui/<group>/`;
  - an import snippet in `web-admin/.clauderc` → `ui_components`.
- **Extending one:**
  - add optional props only;
  - no renames;
  - no behaviour change for existing callers;
  - run `npx tsc --noEmit` for its callers;
  - update its story and test.
- **Never:**
  - a feature import inside `src/ui`;
  - a copy of a Cmx component in a feature to restyle it.

**Exceptions with a reason.** When a rule truly does not apply (a native file input, a garment colour from the DB), mark the line:

```tsx
{/* cmx-ds-ignore UI001: hidden native file input behind CmxFileDropZone */}
// cmx-ds-ignore UI003: garment colour stored in the database
```

- The marker goes on the line itself or on the line above, with the rule ID and a reason.
- A marker without a reason does not count.
- For ESLint rules, use `// eslint-disable-next-line no-restricted-syntax -- <reason>` the same way.

---

## 13. How to check

Run from `web-admin`, in this order:

| Check | Command | Covers |
|---|---|---|
| Design checks for changed files | `npm run check:ui` (or `node scripts/ui/check-design-system.js <files or folders>`) | UI001 raw form/table elements · UI002 legacy feedback · UI003 hex colours · UI004 `dark:` · UI005 page-level arbitrary z-index · UI006 arbitrary colour classes · UI007 hardcoded page size · UI008 English JSX text (warning) |
| Lint | `npx eslint <files> --quiet`, then `npx eslint . --quiet` | Raw palette and physical-direction classes (errors in `src/ui`, `src/features`, `app`, `lib`); banned imports (`@ui/compat`, `@/components/ui`, locale JSON); `src/ui` → feature imports; React hook rules |
| Guard tests | `npx jest __tests__/ui __tests__/lib/theme __tests__/scripts/check-design-system.test.ts __tests__/scripts/codemod-classes.test.ts` | `no-raw-classes`, `globals-css` (no direction hacks or old aliases), `tokens-css`, `status-tokens`, `paper-light`, `off-canvas-direction`, `seeded-theme-contrast`, dialog focus trap / name |
| i18n | `npm run check:i18n` | EN/AR key parity |
| Types | `NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit` | Callers of a changed shared component |
| Build | `npm run build` (first make sure no other `next build` is running) | Everything together |
| Eyes | Open the screen in EN and AR, light and dark, at 320 px and desktop. Print preview if it prints. | What the tools cannot see: contrast on custom fills, mirroring, focus order, states |

`npm run check:ui -- --all` reports the whole app (the debt report). Without arguments, it checks the files that are changed or untracked in git.

---

## 14. How to fix

| Finding | Fix |
|---|---|
| Palette class (`bg-gray-50`, `text-blue-600`, `bg-white`) | `node scripts/ui/codemod-classes.js <file> --write`. It applies the colour rulings (PR-05 ruling 15). By hand: neutral tint → `bg-muted`, neutral text → `text-muted-foreground`/`text-foreground`, accent solid → `bg-primary`, accent text → `text-primary-text`, status → `{t}-bg/-text/-border`, `bg-white` → `bg-card`, `text-white` → `text-primary-foreground` (on primary) or `text-on-solid` |
| Physical class (`ml-2`, `text-left`, `rounded-l`) | Same codemod (ruling 16), or by hand: `ms-2`, `text-start`, `rounded-s` |
| `isRTL ? 'a' : 'b'` for layout | Keep the English branch, made logical. Add `rtl:rotate-180` for direction icons |
| `rtl:flex-row-reverse`, `rtl:space-x-reverse` | Delete them. Logical layout mirrors already |
| `dark:` class | Delete it; the token switches. If no token covers the case, add a `[data-mode=DARK]` rule in `globals.css` |
| Hex / `rgb()` / `bg-[#…]` | A token class. Outside Tailwind: `rgb(var(--cmx-…-rgb))`. A real data colour → ignore comment with a reason |
| Raw `<button>`/`<input>`/`<select>`/`<textarea>`/`<label>` | The Cmx component from §6. If the Cmx one lacks a prop, extend it (§12) |
| Raw `<table>` on a screen | `CmxDataTable` with server paging. Print layouts may keep `<table>` |
| `alert`, `window.confirm`, `showSuccessToast` | `cmxMessage.*` with a translated string; `CmxConfirmDialog` for confirms |
| `z-[9999]` | Use the Cmx overlay (it layers itself), or `z-50` and below inside the page |
| `useState(20)` page size | `useState(CMX_DEFAULT_PAGE_SIZE)`, options from `CMX_PAGE_SIZE_OPTIONS` |
| English text in JSX | A key in `messages/en` + `messages/ar` (`/i18n`) |
| White text on amber / brand | `text-warning-foreground` / `text-primary-foreground` |
| Print preview dark in dark mode | `data-mode="LIGHT"` on the preview root |
| Sidebar or panel gone on desktop | The off-canvas pattern in §4 |

After a fix, run §13 again for that file.

---

## 15. Known debt (baseline 2026-11-19, `npm run check:ui -- --all`)

There are 1,633 files and 670 errors in old code. `src/ui` has 0 errors.

| Rule | Count | Note |
|---|---|---|
| UI001 raw form/table elements | 552 lines | mostly `<label>` and screen `<table>` |
| UI002 legacy feedback | 20 | |
| UI003 hex colours | 88 | mostly chart palettes in dashboard and report widgets, plus garment colours (data, needs an ignore comment) |
| UI005 page-level z-index | 9 | |
| UI007 page size | 1 | |
| UI008 English JSX text (warning) | 294 | covered by `docs/features/UI_Design_System_Enhace/PLAN_I18N_SWEEP.md` |

**Rule for debt:**
- New code adds none.
- A file you touch is fixed for the lines you change.
- Fixing a whole touched file is welcome when it is small and safe.

There is no shared chart series palette yet. Until one exists in `src/ui/charts`, use token variables for new charts.

---

## 16. Done means

- [ ] `npm run check:ui` shows 0 errors on the changed files. Warnings are fixed or have a reason.
- [ ] ESLint 0, guard tests green, `check:i18n` green, typecheck 0, build green.
- [ ] Checked in EN and AR, light and dark, mobile and desktop; print preview if the screen prints.
- [ ] States: loading, empty, error and success.
- [ ] Keyboard and focus work; names and contrast are OK.
- [ ] Any new or extended shared component has its story, test and `.clauderc` snippet.
- [ ] `/cmx-ui-design-review` run, and its Critical and Important findings fixed.

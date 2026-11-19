# PR-05: Workspace shell, colour and direction class migration: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans (inline, the owner's choice for this program). Load `/frontend` and `/i18n` before any code; `/order-fin` (read-only display) before the orders batch.

**Status:** APPROVED 2026-11-19 with an owner amendment: "act as expert and decide all": the codemod itself decides every case, the 2,373 "by hand" classes and all 1,290 `isRTL` ternaries, so nothing is left for a person. The decision rules are ruling 15 (colours) and ruling 16 (direction). Rulings 1 and 5 are replaced by those two where they say "reported" or "by hand".
**Goal:** feature and app screens use theme tokens and logical (RTL-safe) classes only; the global `[dir="rtl"]` hacks and the old CSS aliases are gone; the lint rules are at `error`.
**Spec:** `PR-05-pageshell-rtl-codemod.md` (reviewed 2026-11-16). Where it disagrees with the code, this plan's rulings decide.
**Tech:** Next.js 16, React 19, Tailwind v4, next-intl, Jest. Script: `web-admin/scripts/ui/codemod-classes.js` (from PR-02).

## Progress

| Task | State | Date | Notes |
|---|---|---|---|
| 1 Codemod v2: collapse `isRTL` ternaries + decide every colour (rulings 15–16) | **Done** | 2026-11-19 | `scripts/ui/codemod-classes.js` v2 decides every case; dry run on `src`, `app`, `lib`: **0 left for a person** (was 2,373 + 1,290 ternaries). Tests `__tests__/scripts/codemod-classes.test.ts`: 25 new cases red first, now **76/76** green. Rules added during the run, each with a failing test first: hover equal to its base gets one step stronger (38 files had invisible link hovers); Tailwind v3 `bg-opacity-*` folds into the colour and a full-screen gray backdrop becomes `bg-black/N` (17 backdrops were solid gray); `text-gray-700` → `foreground` (labels kept their weight); `className={'x'}` / no-`${}` templates → `className="x"`; `border-l-<colour>` keeps its logical side; `isRTL()` call form; `undefined`/`null` branches; reverse helpers (`space-y-reverse`, `[direction:rtl]`); `rtl:`/`ltr:` simplifier (twin merge, zeroed or default sides, default `text-start`); a removed `isRTL && '…'` argument leaves the call list; `align` removal only on `CmxCopyableCell`; `textAlign` only as the CSS property. The run is idempotent (a second pass changes 0 files). |
| 2 Remove the overrides that mirror twice | **Done** | 2026-11-19 | All `[dir="rtl"]` flip rules **(a) and (b)** deleted together, because no physical class is left anywhere (ruling 3's condition was met in the same session). The old `:root` aliases are deleted and their few users read the tokens. Typography (c) now lives in `@layer base` without the forcing of `text-align`/`direction` on inputs and buttons, and without `line-height` beating `leading-*` (those were bugs: money fields with `dir="ltr"` were forced RTL, `text-center` on buttons was ignored). New token `--color-on-solid` (always white). Sidebar: `dir="ltr"` and its inline `left/right` style removed; it is fully logical now (`start-0 border-e`, closed state `ltr:-translate-x-full rtl:translate-x-full`). Layout padding is `lg:ps-16/64`. Radix: two copies of `@radix-ui/react-direction` (1.1.1 and 1.2.0) make an app-wide `DirectionProvider` unreliable, so `DropdownMenu` and `CmxTabs` take the page dir by default (`CmxSelectDropdown` already did); caller `dir` wins. Tests: `__tests__/ui/foundations/globals-css.test.ts` (4, written after the change, so not seen failing), `__tests__/ui/primitives/radix-dir-default.test.tsx` (2). |
| 3 Workspace shell and 3 reference screens | **Done** | 2026-11-19 | `CmxCrudPageShell` rewritten: `breadcrumb`, `title` (h1, `.cmx-type-page-title`), `subtitle`, `actions`, `kpis`, `filters` (framed), `children`; no hooks, so server pages use it. `CmxListWithFilters` (0 callers) deleted. Test `__tests__/ui/patterns/cmx-crud-page-shell.test.tsx` (3) and story. Screens moved: orders list (error panel → `CmxSummaryMessage`), GL inquiry (the "ERP-Lite" eyebrow is the breadcrumb slot), customers list (actions → `CmxButton` with `loading`). Their filter bars (`OrderFiltersBar`, `GlFilterBar`, `CustomerFiltersBar`) lost their own frame, since each has one caller and the shell frames the slot; `CustomerStatsCards` lost its `mb-6`. No breadcrumb component exists in `src/ui`, and none was built (not needed by the 3 screens). |
| 4–12 Batches A–I (every folder) | **Done** | 2026-11-19 | Owner amendment: all folders in one pass with the decided rules (PR-04 was already committed in `c6bc73bb`, so ruling 9 was met). 517 feature/page files + 53 `src/ui` files + 3 `lib` files. Hand fixes found by review: `CmxCopyableCell` `align={isRTL ? 'right' : 'left'}` mirrored twice (27 places + one multi-line), and the same pattern through a `textAlign` variable in `voucher-line-table`, `voucher-linked-effects-panel`, `ar-invoice-detail-tabs` (props removed; default is `text-start`); `lib/utils/rtl.ts` `getDirClass`/`getTextAlign`/`getFlexDir` deleted (0 callers, mirrored twice); `catalog.unitItem` key replaces a hardcoded AR/EN label; 12 components lost a dead `isRTL` prop (`CmxCountPicker`, `CmxChangeDueRow`, `PaymentCapabilityDialog`, `PaymentModeSuggestion`, `PaymentSubmitGuard`, `CashChangeRoundingNote`, `PaymentDockedSummaryBar`, `OrderValueBreakdownPanel`, `PayExtraIntentToggle`, `PaymentQuickTenderChips`, `SettlementNowBreakdown`, `PayExtraTopStrip`) and their callers' unused `useRTL()`; stories use a `dir="rtl"` decorator instead. **`Alert` → `CmxSummaryMessage`:** `CmxSummaryMessage` extended (optional `title`/`items`, `message`, `children`, div attributes, `dismissLabel`; colours from the locked status tones), test `__tests__/ui/feedback/cmx-summary-message.test.tsx` (4); 90 tags in 49 files migrated by a one-off script; `Alert`/`AlertDescription` and `src/ui/primitives/alert.tsx` deleted; new users import `@ui/feedback/cmx-summary-message` directly (13 test files mock the barrel). `allsettings` page error uses `settings.loadError`. Other sessions' files were not touched (5 API routes, `lib/services/*`, `lib/validations/new-order-payment-schemas.ts`). |
| 13 Final cleanup, lint to `error`, review, docs | **In progress** | 2026-11-19 | Done: ESLint class rules are `error` for `src/features/**`, `app/**`, `lib/**` (guardrails test red first, 5/5); the legacy `Alert` import rule is gone with `Alert`; guard `no-raw-classes.test.ts` covers `src/ui`, `src/features`, `app`, `lib` (3 tests); full `npx eslint . --quiet`: 0 errors; typecheck: 0 errors in this program's files (one error in `lib/validations/new-order-payment-schemas.ts`, another session's uncommitted edit); jest `__tests__/{ui,scripts,features,lib,notifications}` + `src/features`: 220 suites pass, the 7 known suites fail (3 `cmx-dialog-*`, 3 `orders/payment/*`, `order-financial-view.ui`); `check:i18n` passes. Fresh read-only review (Review Focus 1–5) done 2026-11-19; its findings, each checked against the code: (1) delivery manifest header title and eyebrow were white/muted on `bg-foreground` (unreadable in dark mode) → `text-background`, `text-background/70`; (2) white text or icons on solid amber (about 3.2:1 light, 1.7:1 dark) → new token `--color-warning-foreground` (near-black) and a codemod rule (`text-white` on a yellow/amber/orange 400+ fill), 6 places + the customer stats icons fixed; (3) `DropdownMenuSubTrigger` chevron now `rtl:rotate-180`; (4) 20 files had hand-written `rtl:flex-row-reverse` / `rtl:space-x-reverse` from before PR-05, which put rows back in English order in Arabic → codemod rule drops them, plus 4 `dir === 'rtl' && 'flex-row-reverse'` in `CmxDataGrid` (its root already sets `dir`); (5) language switcher rows each take their own language direction (`dir="ltr"` / `dir="rtl"`) instead of a hard-coded reverse; (6) print in forced dark mode keeps brand and status tints, which was already the case before PR-05, so it is handed to PR-07 task 6. Codemod tests 82/82 with the new rules red first. The review found no broken code from the codemod, no physical classes left, and the `CmxSummaryMessage` and `CmxCrudPageShell` changes clean. Build: passed (`npm run build`, Next 16 webpack, 2026-11-19). Left: owner visual QA (EN/AR, light/dark) and commit. |

After every task, update this table, the `STATUS.md` PR-05 row and `RESUME_CONTINUATION.md`.

## Checked against the code (2026-11-19)

- **Size.** A dry run of the codemod over `src/features/*` and `app/*` gives **8,194 classes it can map** and **2,373 it reports for a human**, in 449 files. Largest folders: orders 2,254 + 1,361, `app/dashboard/orders` 269 + 143, customers 450 + 284, `app/dashboard/settings` 496 + 36, users 397 + 61, dashboard 298 + 41, `jhtestui` 304 + 35. (PR-02's starting count, 5,974 palette and 1,796 direction warnings, counted string literals, not classes.)
- **`isRTL` ternaries: 1,290** (plus 91 `isRtl`), and 1,286 have two string literals. The common shapes:
  - 520 `isRTL ? 'text-right' : 'text-left'`
  - 349 `isRTL ? 'flex-row-reverse' : ''`
  - 46 `'text-left' : 'text-right'`
  - 31 + 9 margin swaps (`ml-N` / `mr-N`)
  - 22 + 16 + 7 + 7 combinations with `flex-row-reverse`
  - 7 border swaps and 5 rounded swaps
  - Not class ternaries (they stay): `'rtl' : 'ltr'` (79), `'ar' : 'en'` (8), arrows `'←' : '→'` (11), `rotate-N` (10).
- **`app/globals.css` has three kinds of `[dir="rtl"]` rules:**
  - (a) **Physical-class flips:** `.text-left/.text-right`, `ml/mr/pl/pr` sizes 1–6, 8 and `auto`, `rounded-l/r/tl/tr/bl/br`, `border-l/r(-2,-4)`, `left-4/right-4`. In Arabic these make a physical class behave like its logical twin, so converting a class to its logical twin renders the same.
  - (b) **Rules that mirror a second time:**
    - `.flex-row` → `row-reverse`
    - `.justify-start` ↔ `flex-end`
    - `.items-start` ↔ `flex-end`, which aligns on the vertical axis in a row, so this is wrong in every case.
    - `aside.fixed` side and border, with a hard-coded `rgb(229 231 235)` that also breaks dark mode.
  - (c) **Arabic typography:** font, line height, `line-clamp`, button and link text rendering. These are not direction hacks.
- **The rules are unlayered and Tailwind v4 utilities are in `@layer utilities`, so the global rules win.** For example, `isRTL ? 'text-right' : 'text-left'` in Arabic gives `text-right`, which the override turns into `text-align: left`. These 520 cells are therefore probably left-aligned in Arabic today. Collapsing them to `text-start` aligns them right, which is a visible change.
- **Old aliases in `globals.css` `:root`:** `--background`, `--foreground`, `--muted`, `--muted-foreground`, `--border`, `--ring`, `--input-bg`, `--input-text`, `--input-placeholder` and `--focus-ring`. Their users are checked in Task 13. There are 62 inline `rgb(var(--cmx-…-rgb))` uses in `src/features` and `app`. These are real tokens, not aliases.
- **Page shell:**
  - `CmxCrudPageShell` (20 lines, list/detail switch) and `CmxListWithFilters` both have **0 callers**.
  - `CmxListWithFilters` uses `[rgb(var(--cmx-…,148_163_184))]` arbitrary values with hex fallbacks.
  - Reference screens: `app/dashboard/orders/page.tsx` + `OrdersSimpleTable`, `app/dashboard/erp-lite/gl/page.tsx` + `GlInquiryTable` (it still imports `Alert`), and one customers list.
- **Sidebar:** `app/dashboard/layout.tsx:80` swaps `lg:pr-64` and `lg:pl-64` through `isRTL`.
- **Radix direction:** there is no `DirectionProvider`. PR-02 left 4 `DropdownMenu` uses LTR-ordered in Arabic for this package.
- **Uncommitted work:** PR-04 (orders files) and the option-B build fix belong to this program but are not committed yet. Other sessions currently have only docs and inventory JSON uncommitted.

## Rulings (planning)

1. **The codemod collapses ternaries; people don't.** Task 1 teaches `codemod-classes.js` to rewrite `isRTL ? R : L` (and `isRtl`) when both branches are string literals and R is L mirrored, possibly plus `flex-row-reverse`, `space-x-reverse` or `divide-x-reverse`. The result is L converted to logical classes. Inside a template literal, `${…}` is replaced inline; elsewhere it becomes a quoted literal. Any other shape is reported, not rewritten. It also reports a `useRTL`/`isRTL` that is now unused. Cost if wrong: a bad rule rewrites ~1,000 places, so the test covers every shape listed above, plus "leave `'rtl' : 'ltr'` alone".
2. **The double-mirroring rules (b) go first, in one change (Task 2).** Every converted folder assumes the browser's own `dir="rtl"` behaviour; while (b) exists, logical code renders wrong in Arabic. Deleting (b) changes Arabic layout on every screen that uses `flex-row`, `justify-start/end` or `items-start/end`, mostly for the better. The product is pre-launch with demo tenants only, so one global change with an owner Arabic check of the main screens is cheaper than per-folder workarounds. Cost if wrong: some Arabic toolbars swap sides until their folder's batch fixes the hand-made ternary behind them.
3. **The physical flips (a) go last (Task 13)**, when the guard finds no physical class in `src` and `app`. Until then, folders that have not been migrated still render correctly in Arabic.
4. **The typography rules (c) stay.** The spec's "~100 rules" includes them, but they are not direction hacks. Arabic text needs them.
5. **Colours: the codemod maps the neutrals; a person maps the meaning.**
   - The codemod's existing mapping is used unchanged.
   - Colours it reports (a status colour used as meaning, `text-white` on a non-primary background, `dark:` classes, `rtl:`/`ltr:` variants) are fixed by hand. Meaning becomes `success` / `warning` / `danger` / `info` / `primary`; decoration becomes `muted` / `primary`.
   - Chart series colours stay as they are, or move to chart tokens if one exists. No new chart tokens are added in this package.
   - Cost if wrong: a red that meant "brand" becomes `danger`. Review Focus 3 checks this.
6. **One task per batch of folders, and each batch is green before the next.** Per batch:
   - codemod dry run, read the "by hand" lines, then `--write`;
   - hand fixes;
   - `Alert` → `CmxSummaryMessage`;
   - hex literals and inline colour styles → tokens;
   - typecheck, ESLint on the batch folders (0 warnings from the two class rules), the batch's jest suites and `check:i18n` if keys changed.
   - `npm run build` runs once per batch, not once per folder as the spec says, because a build takes several minutes and another session may be building. Cost: a build break is found one batch later; typecheck catches most of them earlier.
7. **Each migrated folder gets lint `error` straight away.** `eslint.config.mjs` keeps a list of migrated globs that use `error` instead of `warn`, so a folder cannot regress while the rest of the program runs. Task 13 turns the whole of `src/features` and `app` to `error` and removes the list.
8. **Arabic and dark checks are the owner's.** This session has no browser. Each batch adds its screens to `QA_TEST_GUIDE.md` → PR-05: EN/AR, and light/dark by setting `data-mode` by hand. The progress row says "owner visual check pending". Dark mode stays hidden from users until Task 13 (spec).
9. **Orders wait for the PR-04 commit.** The spec says orders run after PR-04 has merged, and PR-04 is still uncommitted. Mixing the two diffs would make PR-04 impossible to review. If PR-04 is not committed when Batch G ends, Batch I runs first.
10. **Other sessions' files are skipped.** Before each batch, `git status` the batch folders. A file another session has changed is left out and noted in the row, then done at the end of the batch or in Task 13.
11. **Workspace shell: one component, the other is deleted.** `CmxCrudPageShell` becomes the frame:
    - `title`, `subtitle?`, `actions?` (primary CTA), `kpis?`, `filters?`, `children` (the table);
    - it uses `.cmx-type-page-title` and tokens only.

    `CmxListWithFilters` (0 callers, raw fallbacks) is deleted. The breadcrumb is not added if the dashboard top bar already shows one; that is checked at the start of the task. Three screens move onto it: orders list, GL inquiry and the customers list.
12. **Radix gets the direction once.** A `DirectionProvider` (from the installed `@radix-ui/react-direction`, if present; else `dir` on each Cmx Radix wrapper) goes into the app providers in Task 2. This closes PR-02's 4 LTR-ordered menus. It is checked before adding, and no new dependency is added.
13. **`jhtestui` is kept**, migrated in Batch I like any folder (spec).
14. **Money is display only.** In finance and orders only classes change. No calculation, field or prop changes (`/order-fin`, no silent money mutation).

15. **Colour decision rules (owner amendment; the codemod applies them, nobody decides by hand).** Families:
    - **neutral:** gray, slate, zinc, neutral, stone.
    - **accent:** blue, sky, cyan, indigo, violet, purple, fuchsia, pink, teal. A light tint means information (`info-*`); a solid fill means an action (`primary`), so it follows the Organization brand.
    - **status:** green, emerald and lime → `success`; red and rose → `danger`; yellow, amber and orange → `warning`.

    Shade bands are: tint (≤200), mid (300–400) and solid (≥500).

    | Kind | neutral | accent | status (t) |
    |---|---|---|---|
    | `bg` | tint `muted` · mid `border` · 500–600 `muted-foreground` · ≥700 `foreground` | tint `info-bg` · mid `info-border` · solid `primary` | tint `t-bg` · mid `t-border` · solid `success` / `warning` / `destructive` |
    | `text` | ≤300 `muted-foreground` (`background` on a dark fill) · 400–700 `muted-foreground` · ≥800 `foreground` | ≤200 on a solid fill `primary-foreground/80`, else `info-text` · ≥300 `primary-text` (`info-text` on an info tint) | ≤200 on a solid fill `on-solid/80`, else `t-text` · ≥300 `t-text` |
    | `border`, `divide`, `outline` | ≤300 `border` · 400–600 `muted-foreground` · ≥700 `foreground` | ≤300 `info-border` · else `primary` (`ring` under `focus`) | ≤300 `t-border` · else the solid |
    | `ring` | ≤300 `border` · else `ring` | `ring` | the solid |
    | `from`, `via`, `to` | like `bg` | like `bg` | like `bg` |
    | `fill`, `stroke` | like `border` | tint `info-bg` · else `primary` | tint `t-bg` · else the solid |

    Hover and active states:
    - Hover on a solid becomes `primary-hover` (accent) or the solid at `/90`.
    - Hover on a neutral of 200 or more becomes `border`, so a `bg-gray-100 hover:bg-gray-200` row keeps a visible hover.
    - Hover on a status or accent tint of 100 or more becomes `t-border/50` or stronger.

    White and black:
    - `text-white` becomes `primary-foreground` on a primary fill, `destructive-foreground` on a red fill, `background` on a dark neutral fill, and the new token **`on-solid`** (always white) everywhere else (spinners and badges on solid fills).
    - `bg-white` becomes `card`; with opacity, `card/N` when it is frosted (≥60 or `backdrop-blur`) and `on-solid/N` otherwise.
    - `border-white` becomes `card`, or `on-solid/N` with opacity.
    - Black stays (overlays and photo shades), except `text-black` → `foreground`.

    Other cases:
    - `dark:` palette classes are deleted, because the tokens already switch in dark mode.
    - Arbitrary `[rgb(var(--cmx-X-rgb, …))]` classes become the token class when one exists.
16. **Direction decision rules (owner amendment).** The English branch is the design, and Arabic is its mirror:
    - **Collapse.** `isRTL ? R : L` (and `isRtl`, `!isRTL` swapped) with two string literals, where every class that differs is about direction or alignment, becomes `L`, which the token pass then makes logical:
      - classes found only in `R` are dropped;
      - an icon or transform flip that cannot be made logical (`rotate-*`, `scale-x-*`, `translate-x-*`) becomes `rtl:X`, or `ltr:X` when it is only in `L`.
    - **Left alone.** A ternary whose difference is not about direction is not touched: `'rtl' : 'ltr'`, locale codes, arrows, and `!isRTL ? 'uppercase tracking-…' : ''`, since Arabic has no capitals.
    - **`isRTL && 'X'`** keeps only the flips as `rtl:X`; otherwise it becomes `false`, or nothing inside `${…}`, which also fixes `${isRTL && …}` printing "false" into the class list.
    - **Variants.** `rtl:X` becomes the side-swapped logical class under `rtl:`, `ltr:X` becomes the logical class under `ltr:`. A variant class that repeats a base class, or sets an unset side to 0, is dropped.
    - **Physical values.** `align={isRTL ? 'right' : 'left'}` on `CmxCopyableCell` is removed: that prop already maps to `text-end` / `text-start`, so the ternary mirrored twice. `textAlign` written as `isRTL ? 'right' : 'left'` becomes `'start'`.
    - **Clean-up.** A `const isRTL = useRTL()` (or `locale === 'ar'`) left unused is removed, and so are a `useRTL`/`useLocale` import and a `locale` left unused.

## Review Focus

1. **Arabic after Task 2:** toolbars, dialog footers (`justify-end`), table headers and the sidebar sit on the mirrored side of English, nothing is mirrored twice, and the sidebar border follows the theme in dark mode.
2. **Ternary collapse:** each collapsed shape renders in Arabic as the mirror of English. `'rtl' : 'ltr'`, locale codes, arrows and rotations are untouched.
3. **Colour meaning:** status colours map to the right tone (an error is `danger`, a paid or posted state is `success`). No decorative colour became a status tone, or the other way round.
4. **Contrast in dark mode:** `text-white` and `text-primary-foreground` only on solid tone or primary backgrounds; no light-only `bg-card` inside an always-light print area.
5. **Money screens:** classes changed only; totals, signs and alignment of numbers (`tabular-nums`, `<bdi>`) are kept.

---

### Task 1: Codemod v2: collapse `isRTL` ternaries

**Files:** `web-admin/scripts/ui/codemod-classes.js`, `web-admin/__tests__/scripts/codemod-classes.test.ts`.

- [ ] **Step 1: Failing tests.** For each shape in "Checked against the code", write input → expected output, both inside `${…}` and as a JSX expression:
  - `'text-right' : 'text-left'` → `text-start`
  - `'flex-row-reverse' : ''` → nothing
  - `'ml-2' : 'mr-2'` → `me-2`
  - `'flex-row-reverse justify-between' : 'justify-between'` → `justify-between`
  - `'border-r-4 border-l-0' : 'border-l-4 border-r-0'` → `border-s-4 border-e-0`
  - `'rtl' : 'ltr'` → unchanged
  - an unmatched shape → reported
  - `isRtl` → handled the same as `isRTL`
  - an unused `useRTL` → reported
- [ ] **Step 2:** Run them and see them fail.
- [ ] **Step 3: Implement.** Mirror L by swapping `l↔r`, `left↔right`, `s↔e`; strip the reverse helpers from R; compare as sets. Do not touch the existing token mapping.
- [ ] **Step 4:** Tests green. Dry run on `src/features` and `app`, and record how many ternaries collapse and how many are left.
- [ ] **Step 5:** Update progress, STATUS and RESUME.

### Task 2: Remove the overrides that mirror twice

**Files:** `web-admin/app/globals.css`, `web-admin/app/dashboard/layout.tsx`, the app providers file (found at task start), `QA_TEST_GUIDE.md`.

- [ ] **Step 1:** A guard test, `__tests__/ui/foundations/globals-css.test.ts`, asserts that `globals.css` has no `[dir="rtl"]` rule for `.flex-row`, `.justify-*`, `.items-*` or `aside.fixed`, and no raw `rgb(` colour outside `var(`. See it fail.
- [ ] **Step 2:** Delete those rules. In the layout, `lg:pl-64` / `lg:pr-64` becomes `lg:ps-64`; the sidebar's side and border come from logical classes and tokens in its own component, if it does not already have them.
- [ ] **Step 3:** Add the Radix direction provider (ruling 12).
- [ ] **Step 4:** Typecheck, ESLint, guard green, build. Add an owner Arabic check of the main screens to the QA guide.
- [ ] **Step 5:** Update progress, STATUS and RESUME.

### Task 3: Workspace shell and 3 reference screens

**Files:**
- `src/ui/patterns/cmx-crud-page-shell.tsx` (rewrite);
- delete `src/ui/patterns/cmx-list-with-filters.tsx`;
- `src/ui/patterns/index.ts`;
- a story and test for the shell;
- the orders list page, the GL page and the customers list page.

- [ ] **Step 1:** A failing test: the title renders as the page heading, actions render beside it, kpis and filters render only when given, and RTL uses logical classes (no physical class in the output).
- [ ] **Step 2:** Implement (ruling 11), with a story covering EN and AR.
- [ ] **Step 3:** Move the 3 screens onto the shell. GL's `Alert` becomes `CmxSummaryMessage`. Their classes are migrated in the same step.
- [ ] **Step 4:** Typecheck, ESLint, tests, build. Add QA guide entries for the 3 screens.
- [ ] **Step 5:** Update progress, STATUS and RESUME.

### Tasks 4–12: Batches

Every batch follows the same steps (ruling 6):

- [ ] `git status` the folders and note other sessions' files (ruling 10).
- [ ] Dry run the codemod; save the report in the scratchpad; `--write`.
- [ ] Fix the "by hand" lines; `Alert` → `CmxSummaryMessage`; hex and inline colours → tokens; remove `dark:` classes and `rtl:`/`ltr:` direction variants that the tokens and logical classes make unnecessary; remove the now-unused `useRTL`.
- [ ] Add the folders to the lint `error` list (ruling 7).
- [ ] Typecheck; ESLint on the folders (0 class warnings); the folders' jest suites; `check:i18n` if keys changed; `npm run build`.
- [ ] Add the batch's screens to `QA_TEST_GUIDE.md` → PR-05 (EN/AR, light/dark).
- [ ] Update progress, STATUS and RESUME.

Folders per batch, with dry-run counts (auto + hand):

| Task | Batch | Folders | Auto + hand |
|---|---|---|---|
| 4 | A settings | `app/dashboard/settings`, `src/features/settings`, `src/features/payment-config` | 672 + 43 |
| 5 | B customers | `src/features/customers`, `app/dashboard/customers` | 560 + 304 |
| 6 | C users, access, auth | `src/features/{users,access,tenant-admin,auth,auth-session,session-activity}`, `app/(auth)`, `app/register`, `app/dashboard/users` | 948 + 125 |
| 7 | D dashboard | `src/features/dashboard`, `app/dashboard/{components,help}`, `src/features/help`, `app/dashboard/layout.tsx`, `app/page.tsx` | 454 + 76 |
| 8 | E finance | `src/features/{finance,ar,erp-lite,billing,pos-sessions,cash-drawers,receipts}`, `app/dashboard/{internal_fin,erp-lite}` | 1,063 + 82 |
| 9 | F operations | `src/features/{workflow,assembly,delivery,drivers,pickup,scan,home-collection}`, `app/dashboard/{processing,ready,packing,qa,preparation,assembly,delivery}` | 600 + 89 |
| 10 | G the rest | `src/features/{catalog,inventory,b2b,reports,marketing,notifications}`, `app/dashboard/{catalog,inventory,b2b,reports}` | 1,053 + 114 |
| 11 | H orders | `src/features/orders`, `app/dashboard/orders`. Split into sub-rows by subfolder; the payment tests must stay green | 2,523 + 1,504 |
| 12 | I test areas | `app/dashboard/jhtestui`, `app/api-docs` | 321 + 36 |

### Task 13: Final cleanup, lint to `error`, review, docs

- [ ] **Step 1:** The guard test is extended to `src/features` and `app`: no raw palette class, no physical direction class, no `isRTL` class ternary. See it pass; any leftover is fixed.
- [ ] **Step 2:** Delete the physical-flip rules (a) and the old `:root` aliases (after moving their users to tokens). Keep the typography rules (c).
- [ ] **Step 3:** `eslint.config.mjs`: both class rules become `error` for `src/features/**` and `app/**`; remove the migrated-folders list.
- [ ] **Step 4:** Full ESLint (0 errors), typecheck, the known jest suites, `check:i18n`, build.
- [ ] **Step 5:** One fresh reviewer (read-only) against the Review Focus. Fix Critical and Important findings with a failing test first.
- [ ] **Step 6:** STATUS PR-05 result section, QA guide, RESUME. Note that PR-07 task 6 (dark mode for users) is unblocked.

## Not in this package

- `CmxDataGrid` English default labels (PR-02 follow-up): a separate small change.
- New chart tokens.
- `?limit=` paging on the orders list (PR-04 ruling 10).

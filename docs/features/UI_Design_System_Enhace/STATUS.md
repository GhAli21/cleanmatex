# UI Design System and Theming — Status

**Last update:** 2026-11-19
**Current document:** `THEMING_ARCHITECTURE_DESIGN.md` (approved by owner 2026-11-16). It wins over any PR file on conflict.
**Plans:** one per package, written just before that package starts. `PLAN_PR-01.md` is executed (see its Progress table and Rulings).
**Code written so far:** PR-01 and all of PR-02 (the owner committed through PR-02 Task 7; the rest is uncommitted). No migration written.
**Resume here:** `RESUME_CONTINUATION.md` (handoff for the next session or assistant).

## Packages

| Package | What | Depends on | State |
|---|---|---|---|
| PR-01 | Tokens, fonts, `cn()` merge, RTL and accessibility fixes in shared components | — | **Implemented 2026-11-16 (all 7 tasks), owner QA pending** |
| PR-02 | Badges, select, remove duplicate components, lint rules | PR-01 | **Implemented 2026-11-17 (all 10 tasks), owner QA pending** (`PLAN_PR-02.md`) |
| PR-07 | Theme tables, resolver, branding and appearance screens, HQ catalogs | PR-02 (dark mode also PR-05) | **In progress** (`PLAN_PR-07.md`, approved 2026-11-17). Tasks 1–4 done (0752–0754 applied); Tasks 1–5 done (migrations 0752, 0753, 0754, 0757 applied); Tasks 6–9 done (resolver; layout and login brand; public readers; branding screen with saved themes); Task 10 done (user appearance page); Tasks 1–11 done (migrations 0752, 0753, 0754, 0757, 0759 applied); Task 12 HQ plan approved 2026-11-18; **HQ A1 + A2 implemented 2026-11-19** (appearance catalogs in HQ Products & Items Config; `cleanmatexsaas/docs/features/UI_Theme_Catalogs/PLAN_PR-07-HQ.md`); Task 13 (verification, review, docs) done 2026-11-18; owner QA and commit left in both repos (HQ package B is separate). **Task 6 (dark mode): `PLAN_PR-07-T6.md` approved 2026-11-19 (ruling 6 = A). Tasks 1–5 and 7 done 2026-11-19 (print stays light, mode follows the person, Appearance choice, charts, paper previews, sweep); Task 6 (dark logo) blocked until File Util commits; Task 8 in progress** |
| PR-05 | Page shell; colour and direction class migration, folder by folder | PR-02 (orders after PR-04) | **Implemented 2026-11-19** (`PLAN_PR-05.md`, approved with the owner amendment "decide everything"). Codemod v2 decides every case (0 left for a person); 573 files migrated; global RTL hacks and old aliases deleted; `Alert` removed; lint rules at `error` everywhere; ESLint 0 errors, typecheck clean, jest only the 7 known failures. Fresh review done and its 5 real findings fixed; build: passed (`npm run build`, Next 16 webpack, 2026-11-19). Left: owner QA (`QA_TEST_GUIDE.md` → PR-05), commit |
| PR-04 | POS touch targets and keyboard shortcuts | PR-01 | **Implemented 2026-11-19 (all 5 tasks), owner QA pending**; build PASSED 2026-11-19 after the `next.config.ts` fix (option B), see the PR-04 result (`PLAN_PR-04.md`). Tasks 1–4: (orders list on `CmxPagination` with tabular numbers; customer picker on `CmxDialog`; summary panel: Cmx buttons and switch, touch size, logical layout; POS hotkeys `/ F2 F9 Ctrl+Enter ?` and a cheat sheet, all off while a dialog is open) |
| PR-03 | Zod validation at boundaries | — (independent track) | Not started |
| PR-06 | Server-component boundaries; cache only if measured | — (independent track) | Not started |

**Recommended order:** PR-01 → PR-02 → PR-07 tasks 1–5 → PR-04 → PR-05 → PR-07 task 6 (dark mode). PR-03 and PR-06 can run any time.

## Decisions (2026-11-16)

- Server-resolved CSS tokens; brand colours computed on the server, so theming needs no newer browser than the app already does.
- HQ publishes themes in `sys_ui_theme_cd`; `STANDARD` is the default and every Organization uses it until it chooses another.
- Organization themes in `org_tenant_ui_theme_dtl`; user preferences on `sys_users_mst`.
- UPPERCASE codes and values everywhere.
- Logo and brand colours move off `org_tenants_mst`; `brand_color_accent` is dropped.
- Splitting `payment-full-view.tsx` is removed from PR-04 and belongs to its own Order Fin package.

- Default table page size becomes 10 (was 5); tables keep their existing per-call size options.
- `app/dashboard/jhtestui` is kept and migrated last.
- `@radix-ui/react-select` approved for the Cmx select wrapper.

- `@mdi/font` stays: catalog icons are stored in the database as MDI class names.
- The colour function moves from PR-07 into PR-01, so the static `STANDARD` values and the per-Organization values come from one source.
- `STANDARD` buttons are aqua with dark text (white on aqua is not readable).

## PR-01 result (2026-11-16)

- Every `--cmx-*` variable the code uses is now defined, in `web-admin/src/ui/foundations/tokens.css`, generated from `web-admin/lib/theme/brand-palette.ts` (the same function PR-07 will run per Organization). Light, dark and system-dark blocks; density and font-scale blocks; print forces light.
- Arabic font self-hosted via `next/font`; no request to Google Fonts at runtime.
  - **Changed 2026-11-17:** the Vercel build failed inside `next/font/google` (`TypeError: Cannot read properties of null (reading '1')`): a font download from Google at build time came back in a form Next could not parse. The font is now committed (`web-admin/app/fonts/noto-sans-arabic-arabic-wght.woff2`, the arabic subset, variable weight 400–700, with its OFL licence) and loaded with `next/font/local`. The build no longer needs Google Fonts at all. Local `npm run build` with the local font passed (compiled, 338/338 pages, exit 0).
- Shared components: logical spacing, RTL chevrons and pagination arrows, translated pagination labels, confirm dialog with focus trap and Escape, wizard confirm without `window.confirm`, badge role removed, input ids from `useId`, default page size 10.
- Brand colour used as text now reads `--cmx-primary-text-rgb` (readable on white); focus rings read `--cmx-focus-ring-rgb`. Primary buttons have dark text on aqua.
- Final review by a fresh reviewer: 4 Important findings fixed (unreadable info banners, `text-primary` low contrast, Escape cancelling a running confirm, closed confirm unlocking page scroll); 5 Minor deferred, listed in `PLAN_PR-01.md` → Final review.
- Checks: brand-palette 61 tests, token guard 5, confirm dialog 8, input id 2 — all pass. ESLint clean on changed files, `check:i18n` passes, `npm run build` passes. Full jest: 9 suites fail, all judged unrelated (detail in `PLAN_PR-01.md` → Rulings).
- `cn()` now merges with `tailwind-merge`, so a `className` passed to a Cmx component overrides that component's conflicting default (for example `px-4` beats `px-2`). The owner repaired the npm install on 2026-11-16. Test `cn` 4/4; build passes.

- Owner QA steps: `QA_TEST_GUIDE.md` → PR-01.

## PR-02 result (2026-11-17)

- **One badge:** `CmxStatusBadge` with 6 locked tones (`neutral info success warning danger brand`). About 127 callers were moved. Order statuses map to 5 tones through `orderStatusTone()`. The legacy `Badge` is deleted.
- **Select:** `CmxSelectDropdown` is built on Radix Select. Its list is portalled above dialogs, and Escape closes only the list. The empty value works. It supports keyboard and RTL.
- **Removed duplicates:** legacy `Button`, `Card`, `Input`, `LoadingButton`, `FormInput`, `src/ui/components/` and `foundations/tokens.ts`. The top bar and permissions inspector moved out of feature imports. The top bar's dead search box is removed, and its user menu is a real menu.
- **Classes:** `src/ui` uses theme tokens and logical (RTL-safe) classes only. A guard test and ESLint (errors in `src/ui`, warnings in `src/features` and `app`) keep it that way. `scripts/ui/codemod-classes.js` is ready for PR-05. PR-05 starts from 5,974 colour warnings, 1,796 direction warnings and 50 `Alert` imports.
- **Pagination text** comes from `common.*` in both languages.
- **Final review by a fresh reviewer:** 4 Important findings fixed, each with a test that failed first: Arabic double-mirroring from the codemod, the top bar menu LTR in Arabic, brand badges without a tint, and a select pick clicking the row behind it. 3 Minor deferred. Details are in `PLAN_PR-02.md` → Final review.
- **Checks:**
  - jest (`ui lib scripts features/orders`): 143 suites pass. 7 fail, all on PR-01's known list.
  - Full ESLint shows 0 errors; `check:i18n` passes.
  - Build: passed after Task 7. Passed again after the review fixes (third attempt; the first two failed because another session deleted routes during the build).
- Owner QA steps: `QA_TEST_GUIDE.md` → PR-02.

## PR-04 result (2026-11-19)

- **Summary panel:** the steppers, customer buttons, ready-by buttons and Submit are now `CmxButton`; Submit follows the theme colour. Targets are 44px on touch screens only. Notes use `CmxSwitch`. The layout is logical, with no Arabic double flip. Numbers use `<bdi class="tabular-nums">`.
- **Shortcuts:** `/` search, F2 customer, F9 pay, Ctrl/⌘+Enter or Ctrl+S submit (Review in the workspace), Alt+1…5 tabs, `?` (or Arabic `؟`) shows the list. All of them go through the existing submit gate, and they are off while any dialog is open. There is one listener, plus a pure resolver.
- **Customer picker** is on `CmxDialog`. Escape now works with no results, skeleton rows show while it searches, and focus returns to the opener.
- **Orders list** pages with `CmxPagination` (no page-size box) and shows tabular numbers.
- **Final review (fresh reviewer):** 3 Important findings fixed, each with a test that failed first:
  - F9 or Ctrl+Enter could open payment with no ready-by; one rule (`readyByBlockReason`) now serves the button and the gate;
  - Ctrl+S under a dialog opened the browser's Save Page;
  - `?` failed on the Arabic layout.
  
  4 Minor findings are deferred (`PLAN_PR-04.md` row 5).
- **Checks:**
  - ESLint: 0 errors.
  - `check:i18n`: passes.
  - jest orders + ui: only the 7 known suites fail.
  - typecheck: the 4 known errors, plus `next.config.ts` from another session.
  - build: compiled, then the type-check gate failed on those same errors, because another session's uncommitted `next.config.ts` edit turned `ignoreBuildErrors` off. Rerun once that edit is settled.
  - **Build blocker FIXED 2026-11-19 (owner option B):** kept `ignoreBuildErrors: false`; fixed the 4 known type errors (`types/auth.ts` signIn returns `| undefined`; flat `CurrencyMinorUnitResult` + `rows ?? []` guard; `new Set<string>` in `api/navigation/route.ts`; `membership-lock-action.tsx` confirm returns void) and merged the two `experimental` blocks in `next.config.ts`. Typecheck: 0 errors. `npm run build`: PASSED.
- Owner QA: `QA_TEST_GUIDE.md` → PR-04. Shortcut reference: `PR-07_FEATURE_REFERENCE.md` → POS keyboard shortcuts.

## PR-05 result (2026-11-19)

- **One pass, every folder.** The owner asked for every decision to be made by rule, not left to a person. `scripts/ui/codemod-classes.js` v2 applies rulings 15 (colour) and 16 (direction) of `PLAN_PR-05.md` and leaves nothing to decide by hand; v1 reported 2,373 cases and 1,290 ternaries. It changed 517 feature and page files, 53 `src/ui` files and 3 `lib` files, and a second run changes nothing.
- **Real Arabic bugs fixed on the way:**
  - The global `[dir="rtl"]` rules were unlayered, so they beat Tailwind. `isRTL ? 'text-right' : 'text-left'` (520 places) therefore aligned left in Arabic.
  - `CmxCopyableCell` `align` ternaries mirrored twice (27 places + 3 files).
  - Inputs were forced to `direction: rtl`, overriding `dir="ltr"` on money fields.
  - `text-center` was ignored on buttons.
  - Every `p`/`div` got `line-height: 1.8`, which beat `leading-*`.
  - `${isRTL && …}` printed "false" into class lists.
  - Modal backdrops were solid gray, because `bg-opacity-*` does not exist in Tailwind v4.
  - The sidebar forced `dir="ltr"` and mirrored itself by hand.
- **Shared parts:**
  - `CmxCrudPageShell` is the workspace frame, used by orders, GL and customers.
  - `CmxListWithFilters` and `Alert` were deleted.
  - `CmxSummaryMessage` takes free content and uses the locked status tones.
  - `DropdownMenu` and `CmxTabs` follow the page direction.
  - The new token `on-solid` is for white text or lines on saturated fills.
- **Guards:**
  - ESLint class rules are errors in `src/ui`, `src/features`, `app` and `lib`.
  - `no-raw-classes.test.ts` covers the same folders.
  - `globals-css.test.ts` keeps the direction hacks and aliases out.
- **Fresh review (2026-11-19):** Fresh read-only review (Review Focus 1–5) done 2026-11-19; its findings, each checked against the code: (1) delivery manifest header title and eyebrow were white/muted on `bg-foreground` (unreadable in dark mode) → `text-background`, `text-background/70`; (2) white text or icons on solid amber (about 3.2:1 light, 1.7:1 dark) → new token `--color-warning-foreground` (near-black) and a codemod rule (`text-white` on a yellow/amber/orange 400+ fill), 6 places + the customer stats icons fixed; (3) `DropdownMenuSubTrigger` chevron now `rtl:rotate-180`; (4) 20 files had hand-written `rtl:flex-row-reverse` / `rtl:space-x-reverse` from before PR-05, which put rows back in English order in Arabic → codemod rule drops them, plus 4 `dir === 'rtl' && 'flex-row-reverse'` in `CmxDataGrid` (its root already sets `dir`); (5) language switcher rows each take their own language direction (`dir="ltr"` / `dir="rtl"`) instead of a hard-coded reverse; (6) print in forced dark mode keeps brand and status tints, which was already the case before PR-05, so it is handed to PR-07 task 6. Codemod tests 82/82 with the new rules red first. The review found no broken code from the codemod, no physical classes left, and the `CmxSummaryMessage` and `CmxCrudPageShell` changes clean. 
- **For PR-07 task 6 (dark mode for users):** the `@media print` block in `globals.css` resets only the neutral tokens with `:root, [data-mode]`. Brand tokens from `theme-style.ts` and the status `-bg`/`-text` tokens keep their dark values on paper when the screen is dark. Give print its own light values for those before dark mode is offered.
- **Not in this package:** about 20 hardcoded English strings found during the `Alert` move (for example "Error", "Verified", the register trial messages). That needs a separate i18n sweep. There is also no `src/ui` breadcrumb component yet.

## PR-07 tasks 1–11 result (2026-11-18, final review pending)

- **Themes from the database:** HQ catalogs (0752), Organization saved themes with one in use (0753), user appearance (0754), plan flags `custom_branding` / `white_label` (0757), old brand-colour columns dropped (0759). All applied by the owner.
- **One theme per request:** the server picks the theme once, before the page renders (HQ theme, then Organization overrides if the plan allows them, then user preferences), so there is no flash of the wrong colours. A plain `STANDARD` Organization gets no extra CSS.
- **Screens:**
  - Settings → Branding: logos plus saved themes (new, edit, use, delete), with a live preview and a notice when a colour is darkened to stay readable.
  - User menu → Appearance: density and text size, stored on the user.
- **Sign-in page** shows the last Organization's logo and colours from a validated cookie.
- **Public readers** (customer app, public order page) take their colour from the theme.
- **Checks:**
  - typecheck: only the 4 known errors;
  - full jest: 581/592, every failure pre-existing or known;
  - full ESLint: 0 errors;
  - `check:i18n`: passes;
  - build: passed.
- **Final review (2026-11-18), fresh reviewer:** 1 Critical and 2 Important findings, all fixed with a test that failed first:
  - after sign-in, sign-out or switching Organization the page kept the previous person's text size, density, colours and logo until a reload; these now do a full page load;
  - switching the theme while another person deleted the target could leave no theme in use; it now rolls back;
  - after a plan downgrade, any edit erased the stored colours and app name; they are now kept for an upgrade.
  - 7 Minor deferred (list in `PLAN_PR-07.md` row 13).
- Reference: `PR-07_FEATURE_REFERENCE.md`. Owner QA: `QA_TEST_GUIDE.md` → PR-07.

## Open

- PR-01 owner QA (`QA_TEST_GUIDE.md`) and commit.
- PR-02: owner QA (`QA_TEST_GUIDE.md` → PR-02, including the Storybook check) and commit.
- PR-07: owner QA (`QA_TEST_GUIDE.md` → PR-07 and PR-07 HQ) and commit in both repos.
- HQ A3 (owner follow-up 2026-11-19): corner sizes from a list and every refusal as a field message. Done (API + web, tests pass, HQ build passed 2026-11-19). Fonts outline plan written: `fonts_to_be_predefine.md` (later package, not started).
- PR-04: implementation (plan approved 2026-11-19), after A3 and the fonts plan.
- Pre-existing, not from this program: 2 type errors (`app/(auth)/login/page.tsx:162`, `src/features/users/ui/membership-lock-action.tsx:84`) and 9 failing jest suites (list in `PLAN_PR-01.md`).
- Font pairs to seed (licence and Arabic coverage check).
- Tailwind v4's exact minimum browser versions.
- Contrast check of the nine proposed theme colour pairs.

## PR file review (2026-11-16)

Checked against the code and corrected: wrong paths (`src/lib/utils.ts` → `lib/utils.ts`; `screens/` → `ui/`; tenant-guard script is `.mjs`), a result type that breaks under `strict: false`, a keyboard-shortcut clash with the existing payment shortcuts, a cache design that read feature flags from the database against the HQ-API rule, an artificial dependency chain, and PR-07's doc path, lowercase codes, inline script and SVG handling. Line numbers quoted inside the PR files were not all re-checked.

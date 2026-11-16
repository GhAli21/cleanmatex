# PR-01 Token Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Define every design token the app already references, so the shared components render from one source in light and dark, and fix the RTL and accessibility defects in shared components.

**Architecture:** One token stylesheet holds every `--cmx-*` variable (today they are referenced about 1,200 times and defined nowhere). Brand-dependent values are produced by one pure TypeScript function from two seed colours; the stylesheet holds that function's output for the `STANDARD` theme, and a test keeps the two in step. Tailwind's `@theme` maps the variables to semantic class names. No feature screen is rewritten.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4 (CSS `@theme`, no config file), Jest (jsdom), Storybook 10.

**Spec:** `docs/features/UI_Design_System_Enhace/THEMING_ARCHITECTURE_DESIGN.md` and `PR-01-tokens-rtl-a11y.md` in the same folder. The design document wins on conflict.

## Progress

Update this table and `STATUS.md` at the end of every task (the last step of each task says so). Tick each step's checkbox as it is done, not in a batch at the end.

| Task | State | Date | Notes (values adjusted, surprises, anything left open) |
|---|---|---|---|
| 1 `cn()` merge | **Blocked** | 2026-11-16 | `npm install tailwind-merge` crashes inside npm itself (`Cannot read properties of null (reading 'location')`; `npm ls` crashes the same way). The package could not be added, so `cn()` was left unchanged and the test was removed. Owner must repair the install tree (see Rulings), then this task is one small change. |
| 2 Brand palette function | Done | 2026-11-16 | 61 tests pass. Light `muted-foreground` lightness 0.55 → 0.52 to reach 4.5:1. Added: grey seeds do not tint neutrals. Fixed while testing: a black seed in dark mode never lightened. |
| 3 Token stylesheet and mapping | Done (build pending in Task 7) | 2026-11-16 | 4 guard tests pass. Every `--cmx-*` name used in code is defined; none had to be added beyond the plan's tables. `tokens.css` was generated from the palette function, not typed by hand. |
| 4 Fonts | Done (build pending in Task 7) | 2026-11-16 | `Noto_Sans_Arabic` via `next/font/google`. Two rules used the old font name, both updated. Fallback name kept for Storybook, which has no font variable. |
| 5 RTL and broken-value fixes | Done | 2026-11-16 | All listed files fixed. Three white-on-primary sites found and fixed (button, progress steps, GL pagination). Also: 51 uses of the brand colour as text moved to `primary-text`, 24 focus rings moved to `focus-ring` (41 files). |
| 6 Accessibility fixes | Done | 2026-11-16 | 7 new tests pass. `CmxDialog` gained an optional `stackAboveModals` prop so the confirm dialog keeps its place above other overlays. Wizard uses the confirm dialog. |
| 7 Page size, Storybook, verification, docs | Done | 2026-11-16 | Page size 10 and Storybook toolbars done. ESLint clean on changed files; `check:i18n` passes. Jest: 559 suites pass, 9 fail (all unrelated, see Rulings). `npm run build` passes (first run caught two stray lines left in `globals.css`; removed). Manual visual checks handed to the owner in `STATUS.md`. |

### Rulings made during execution

- **Tests live under `web-admin/__tests__/`**, not beside the source: jest only looks there. Paths used: `__tests__/lib/theme/`, `__tests__/ui/foundations/`, `__tests__/ui/feedback/`, `__tests__/ui/primitives/`.
- **Task 1 blocked by the npm install tree.** Not worked around: the dependency folders are closed to the assistant by a deny rule, and repairing an install is the owner's call. Cost while blocked: a `className` override on a Cmx component still depends on stylesheet order, as it does today.
- **No blanket touch rule.** The plan's `@media (pointer: coarse)` rule on every `button` and `input` was not added: it would also stretch switches, chips, tabs and icon buttons. Only the `--cmx-touch-min` token is defined; components adopt it in PR-04.
- **Brand colour as text uses `primary-text`.** Not in the plan, but required by its own contrast goal: aqua text on white is about 2.4:1. Cost if wrong: 51 text sites and 24 focus rings are a deeper aqua than the solid brand colour.
- **Pagination labels come from `common.*` inside the component**, so all three callers get translated labels without changes. New keys: `common.firstPage`, `common.lastPage`.
- **Wizard confirm keys:** `common.leave`, `common.stay`, `common.leaveWithoutSavingTitle`, `common.leaveWithoutSavingDescription`. No existing key covered this. `CmxWizard` has no caller in the app today.
- **Next.js bundled docs could not be read** (dependency folders are closed), so `next/font/google` is used as in earlier Next versions and proven by the build in Task 7.
- **Three existing dialog tests already fail to load** (`cmx-dialog-a11y-name`, `-focus-trap`, `-draggable`): jest cannot parse next-intl's ESM build and those tests do not mock it. Not caused by this package and not changed here.
- **Nine failing jest suites judged unrelated, by reading their failures, not by a baseline run** (other sessions have uncommitted work, so no stash). Six fail to load on next-intl's ESM build (the three dialog tests above and three `__tests__/features/orders/payment/*`); `order-financial-view.ui.test.tsx` fails on a missing `common.close` in its own fixture; `auth/request-permission-auth` and `security/api-route-auth-guard` test API routes this package did not touch.
- **Two type errors already exist** in code committed on 2026-11-14 (`app/(auth)/login/page.tsx` line 162, `src/features/users/ui/membership-lock-action.tsx` line 84). Not caused by this package and not changed here.

### Final review (2026-11-16, fresh reviewer)

No Critical findings. Four Important ones, all fixed:

- **Info banners unreadable:** `CmxSummaryMessage` info and three other sites used `primary-hover` as text, which is now lighter than the seed. They now use `primary-text`.
- **Tailwind `text-primary` was the solid aqua (about 2.4:1):** added `--color-primary-text` to `@theme` and moved 57 `text-primary` uses in 39 files to `text-primary-text`. A guard test in `tokens-css.test.ts` fails if either pattern comes back.
- **Escape or the header X cancelled a confirm that was still running:** the dialog now ignores close requests while loading. A new test was seen failing, then passing.
- **A closed confirm dialog unlocked the page behind an open modal:** `CmxDialog` now locks scroll only while open and restores the previous value. Two new tests were seen failing, then passing.

Deferred (Minor, not fixed here):

- The print block does not reset the secondary, hover and status-background tokens or `primary-text`. This only matters when printing in dark mode, which arrives in PR-07.
- White text on the dark-mode destructive red is about 2.8:1. Fix it in PR-07 task 6 (dark mode).
- Pagination still has English literals (`of`, `Rows per page:`, `No items`). `common.of` exists. Fix it in PR-02.
- `order-issues-list-dialog.tsx` shows white text on aqua. Fix it in PR-02 or PR-05.
- The `tokens.css` comment says the touch token is applied in `globals.css`; it is not yet.

States: Not started → In progress → Done (checks passed) → Blocked (say why).

## Global Constraints

- After every task: tick its steps, update the Progress table above, and update the PR-01 row and notes in `STATUS.md`. A task is not done until this is written.
- Work from `web-admin/`. Load the `/frontend` skill before editing any component and `/i18n` before adding keys.
- Variable format during the migration: `--cmx-<token>-rgb` holding a space-separated triplet (`10 182 216`). Existing code reads them as `rgb(var(--cmx-primary-rgb,14_165_233))`; do not change that format in this package. These variables are the source of truth until PR-05 removes the last reference.
- All `data-*` values are UPPERCASE: `LIGHT`, `DARK`, `SYSTEM`, `COMFORTABLE`, `COMPACT`, `SM`, `MD`, `LG`.
- No `light-dark()`, no relative colour syntax (`oklch(from …)`), no inline script. Theming must add no browser requirement.
- `STANDARD` seeds: primary `#0AB6D8`, secondary `#0E2A47`.
- Status colours (success, warning, danger, info) are never derived from the brand seeds.
- "Secondary" already means the neutral button style (`--cmx-secondary-bg-rgb`). The brand's second colour is named `brand-secondary` everywhere.
- Do not remove `@mdi/font`. Product, preference and stain icons are stored in the database as MDI class names and rendered through `isSafeMdiIconClass`.
- Shared components only (`src/ui/**`), `app/globals.css`, `app/layout.tsx`, `lib/utils.ts`, `lib/theme/**`. Two one-line fixes outside that list are named in Task 5.
- The assistant does not commit. Each task ends by running its checks; the owner commits.
- Every user-facing string uses an i18n key in both `messages/en` and `messages/ar`; search for an existing `common.*` key first.

## Review Focus

1. **A seed with mid luminance** (for example `#808080`): neither white nor a dark-navy foreground reaches 4.5:1. Expected: the function falls back to pure black or white and still reaches 4.5:1. Test in Task 2.
2. **A variable used in code but missing from the stylesheet**: it silently falls back to an old inline value. Expected: a test fails and names the variable. Test in Task 3.
3. **Dark values edited in one of the two dark blocks only** (`[data-mode=DARK]` and the `SYSTEM` media query must repeat the same values). Expected: a test fails. Test in Task 3.
4. **Arabic text that used to wrap now truncates** after the `[dir="rtl"] .truncate` override is removed. Expected: truncated cells show an ellipsis and keep the full text reachable (title or tooltip already present). Manual check in Task 7.
5. **`cn('px-2', condition && 'px-4')` callers that relied on both classes surviving**: with merging, the later one wins. Expected: later class wins everywhere; the full test suite and build show no regression. Test in Task 1, suite in Task 7.

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/utils.ts` (modify) | `cn()` gains conflict merging |
| `lib/theme/brand-palette.ts` (create) | Pure colour maths: seeds → all brand-dependent triplets for both modes; contrast helper |
| `lib/theme/__tests__/brand-palette.test.ts` (create) | Contrast and shape tests |
| `src/ui/foundations/tokens.css` (create) | Every `--cmx-*` variable, light and dark; density, radius, shadow, touch |
| `src/ui/foundations/__tests__/tokens-css.test.ts` (create) | Stylesheet matches the function for `STANDARD`; every used variable is defined; both dark blocks match |
| `app/globals.css` (modify) | Imports tokens; `@theme` mapping; typography classes; print rules; removes font `@import`, `light only`, `.truncate` override |
| `app/layout.tsx` (modify) | `next/font` for Arabic; `data-mode`, `data-density`, `data-font-scale` on `<html>` |
| `src/ui/**` components (modify) | RTL, accessibility and foreground fixes listed per task |
| `.storybook/preview.ts` (modify) | Mode and density toolbars |

---

### Task 1: `cn()` merges conflicting classes

**Files:**
- Modify: `lib/utils.ts`
- Test: `lib/__tests__/cn.test.ts` (create)
- Modify: `package.json` (add `tailwind-merge`)

**Interfaces:**
- Produces: `cn(...inputs): string` with an unchanged signature; conflicting Tailwind utilities resolve to the last one.

- [ ] **Step 1: Write the failing test**

```ts
import { cn } from '../utils'

test('later conflicting utility wins', () => {
  expect(cn('px-2 text-sm', 'px-4')).toBe('text-sm px-4')
})
test('keeps existing input shapes', () => {
  expect(cn('a', false, null, undefined, ['b', { c: true, d: false }])).toBe('a b c')
})
test('arbitrary-value colour classes conflict by property', () => {
  expect(cn('bg-[rgb(var(--cmx-primary-rgb))]', 'bg-[rgb(var(--cmx-destructive-rgb))]'))
    .toBe('bg-[rgb(var(--cmx-destructive-rgb))]')
})
```

- [ ] **Step 2: Run it and see it fail** — `npx jest lib/__tests__/cn.test.ts`. Expected: first and third tests fail.
- [ ] **Step 3: Install and wire** — `npm install tailwind-merge`. In `cn()`, keep the existing flattening loop and replace the final dedupe-and-join with `twMerge(classes.join(' '))`. Do not add `clsx`.
- [ ] **Step 4: Run it and see it pass** — same command. Expected: 3 passed.
- [ ] **Step 5: Typecheck** — `npm run typecheck`. Expected: no new errors.
- [ ] **Step 6: Record progress** — Progress table row 1 and `STATUS.md`.

---

### Task 2: Brand palette function

**Files:**
- Create: `lib/theme/brand-palette.ts`
- Test: `lib/theme/__tests__/brand-palette.test.ts`

**Interfaces:**
- Produces:

```ts
export type ThemeMode = 'LIGHT' | 'DARK'
/** Space-separated sRGB channels, e.g. "10 182 216". */
export type RgbTriplet = string
export const BRAND_TOKENS = [
  // brand
  'primary', 'primary-hover', 'primary-fg', 'primary-bg', 'primary-text',
  'brand-secondary', 'brand-secondary-hover', 'brand-secondary-fg', 'brand-secondary-text',
  'focus-ring',
  // neutrals, tinted toward the primary hue
  'background', 'surface', 'surface-muted', 'surface-elevated', 'card', 'card-bg', 'input-bg',
  'muted', 'secondary-bg', 'secondary-hover-bg', 'secondary-fg', 'ghost-hover-bg', 'field-hover',
  'table-header-bg', 'table-row-hover-bg', 'border', 'border-subtle',
  'foreground', 'text-primary', 'text-secondary', 'muted-foreground',
] as const
export type BrandToken = (typeof BRAND_TOKENS)[number]
export type BrandPalette = Record<ThemeMode, Record<BrandToken, RgbTriplet>>
export function computeBrandPalette(primaryHex: string, secondaryHex: string): BrandPalette
/** WCAG 2 contrast ratio, 1 to 21. */
export function contrastRatio(a: RgbTriplet, b: RgbTriplet): number
/** "--cmx-primary-rgb" for "primary". */
export function cssVarName(token: BrandToken): string
```

- Rules the body must follow:
  - Convert sRGB ↔ OKLCH in-house (Björn Ottosson's published matrices); no colour library. Round channels to integers and clamp to 0–255 after gamut mapping by reducing chroma.
  - `primary` and `brand-secondary` are the seeds unchanged.
  - `*-fg`: white if it reaches 4.5:1 on the solid colour, otherwise `14 23 38`, otherwise pure black or white, whichever is higher.
  - `*-hover`: lightness moved by 0.05 away from the foreground's lightness.
  - `*-text` and `focus-ring`: start at the seed and move lightness in steps of 0.02 (down in `LIGHT`, up in `DARK`) until contrast against `surface` is at least 4.5.
  - `primary-bg`: `LIGHT` L 0.96, `DARK` L 0.25; chroma `min(seed chroma, 0.04)`; seed hue.
  - Neutrals use the primary hue with fixed lightness and chroma per mode:

| Token | LIGHT L / C | DARK L / C |
|---|---|---|
| `background` | 0.985 / 0.004 | 0.135 / 0.012 |
| `surface`, `card`, `card-bg`, `input-bg` | 1 / 0 | 0.175 / 0.014 (`input-bg` 0.20 / 0.014) |
| `surface-elevated` | 1 / 0 | 0.215 / 0.016 |
| `surface-muted` | 0.962 / 0.006 | 0.20 / 0.014 |
| `muted` | 0.968 / 0.006 | 0.215 / 0.014 |
| `table-header-bg` | 0.975 / 0.005 | 0.20 / 0.014 |
| `table-row-hover-bg`, `field-hover` | 0.97 / 0.006 | 0.22 / 0.016 |
| `ghost-hover-bg`, `secondary-bg` | 0.955 / 0.008 | 0.25 / 0.016 |
| `secondary-hover-bg` | 0.925 / 0.010 | 0.30 / 0.018 |
| `border` | 0.895 / 0.009 | 0.30 / 0.018 |
| `border-subtle` | 0.925 / 0.007 | 0.26 / 0.016 |
| `foreground`, `text-primary`, `secondary-fg` | 0.21 / 0.02 | 0.95 / 0.005 |
| `text-secondary` | 0.37 / 0.02 | 0.85 / 0.010 |
| `muted-foreground` | 0.55 / 0.02 | 0.72 / 0.015 |

  If a value in this table fails a test below, adjust its lightness by the smallest step that passes and record the change in `STATUS.md`.
  - A string that is not `#RRGGBB` throws `Error('Invalid colour: <value>')`.

- [ ] **Step 1: Write the failing tests**

```ts
import { BRAND_TOKENS, computeBrandPalette, contrastRatio } from '../brand-palette'

const SEEDS: Array<[string, string]> = [
  ['#0AB6D8', '#0E2A47'], ['#2563EB', '#0F172A'], ['#059669', '#064E3B'], ['#0D9488', '#134E4A'],
  ['#7C3AED', '#1E1B4B'], ['#E11D48', '#4C0519'], ['#EA580C', '#7C2D12'], ['#B45309', '#451A03'],
  ['#475569', '#0F172A'], ['#18181B', '#52525B'],
  // hard cases
  ['#FACC15', '#0F172A'], ['#FFFFFF', '#000000'], ['#000000', '#FFFFFF'], ['#808080', '#808080'],
]
const MODES = ['LIGHT', 'DARK'] as const

test('contrastRatio matches WCAG endpoints', () => {
  expect(contrastRatio('255 255 255', '0 0 0')).toBeCloseTo(21, 1)
  expect(contrastRatio('10 182 216', '10 182 216')).toBeCloseTo(1, 5)
})

describe.each(SEEDS)('seeds %s / %s', (primary, secondary) => {
  const palette = computeBrandPalette(primary, secondary)
  test.each(MODES)('%s has every token as an integer triplet', (mode) => {
    for (const token of BRAND_TOKENS) expect(palette[mode][token]).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/)
  })
  test.each(MODES)('%s text on solids and surfaces reaches 4.5:1', (mode) => {
    const p = palette[mode]
    expect(contrastRatio(p['primary-fg'], p.primary)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(p['brand-secondary-fg'], p['brand-secondary'])).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(p['primary-text'], p.surface)).toBeGreaterThanOrEqual(4.5)
    expect(contrastRatio(p['brand-secondary-text'], p.surface)).toBeGreaterThanOrEqual(4.5)
    for (const bg of ['background', 'surface', 'surface-muted', 'muted', 'table-header-bg'] as const) {
      expect(contrastRatio(p.foreground, p[bg])).toBeGreaterThanOrEqual(7)
      expect(contrastRatio(p['muted-foreground'], p[bg])).toBeGreaterThanOrEqual(4.5)
    }
  })
})

test('seeds are kept unchanged as the solid colours', () => {
  const p = computeBrandPalette('#0AB6D8', '#0E2A47')
  expect(p.LIGHT.primary).toBe('10 182 216')
  expect(p.DARK['brand-secondary']).toBe('14 42 71')
})
test('rejects a malformed colour', () => {
  expect(() => computeBrandPalette('blue', '#000000')).toThrow('Invalid colour: blue')
})
```

- [ ] **Step 2: Run and see them fail** — `npx jest lib/theme`. Expected: module not found.
- [ ] **Step 3: Implement `lib/theme/brand-palette.ts`** to the interface and rules above. JSDoc on every export.
- [ ] **Step 4: Run and see them pass** — `npx jest lib/theme`. Expected: all pass.
- [ ] **Step 5: Typecheck** — `npm run typecheck`.
- [ ] **Step 6: Record progress** — Progress table row 2 and `STATUS.md`, listing every lightness value changed from the table above.

---

### Task 3: Token stylesheet, Tailwind mapping and `<html>` attributes

**Files:**
- Create: `src/ui/foundations/tokens.css`
- Test: `src/ui/foundations/__tests__/tokens-css.test.ts`
- Modify: `app/globals.css` (lines 1–62 and the `.truncate` rule near line 136)
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: `computeBrandPalette`, `BRAND_TOKENS`, `cssVarName` from Task 2.
- Produces: every `--cmx-*` variable; Tailwind colour names `background`, `foreground`, `surface`, `surface-muted`, `card`, `card-foreground`, `popover`, `popover-foreground`, `muted`, `muted-foreground`, `border`, `input`, `ring`, `primary`, `primary-foreground`, `primary-hover`, `secondary`, `secondary-foreground`, `accent`, `accent-foreground`, `destructive`, `destructive-foreground`, `success`, `warning`, `info`, `brand-secondary`, `brand-secondary-foreground`; classes `.cmx-type-page-title`, `.cmx-type-section-title`, `.cmx-type-kpi`, `.cmx-type-field-label`, `.cmx-type-field-helper`, `.cmx-type-field-error`.

- [ ] **Step 1: Write the failing tests**

```ts
import fs from 'node:fs'
import path from 'node:path'
import { BRAND_TOKENS, computeBrandPalette, cssVarName } from '@/lib/theme/brand-palette'

const css = fs.readFileSync(path.join(__dirname, '../tokens.css'), 'utf8')
/** Declarations inside the first block whose selector text contains `marker`. */
function block(marker: string): Record<string, string> { /* parse `--name: value;` pairs */ }

const standard = computeBrandPalette('#0AB6D8', '#0E2A47')

test('light block equals the STANDARD palette', () => {
  const light = block(':root')
  for (const t of BRAND_TOKENS) expect(light[cssVarName(t)]).toBe(standard.LIGHT[t])
})
test('dark block equals the STANDARD palette', () => {
  const dark = block('[data-mode=DARK]')
  for (const t of BRAND_TOKENS) expect(dark[cssVarName(t)]).toBe(standard.DARK[t])
})
test('SYSTEM media block repeats the dark block exactly', () => {
  expect(block('[data-mode=SYSTEM]')).toEqual(block('[data-mode=DARK]'))
})
test('every --cmx-* variable used in source is defined', () => {
  const used = new Set<string>() // walk src/, app/, lib/ for /--cmx-[a-z0-9-]+/g in .ts/.tsx/.css
  const defined = new Set(Object.keys(block(':root')))
  expect([...used].filter((name) => !defined.has(name))).toEqual([])
})
```

On a mismatch in the first two tests, the failure message is the fix: copy the expected values into the stylesheet.

- [ ] **Step 2: Run and see them fail** — `npx jest src/ui/foundations`. Expected: file not found.

- [ ] **Step 3: Create `src/ui/foundations/tokens.css`** with three blocks: `:root`, `[data-mode=DARK]`, and `@media (prefers-color-scheme: dark) { [data-mode=SYSTEM] { … } }`.
  - Brand and neutral tokens: the `STANDARD` values from Task 2 (run the test and copy the expected values).
  - `color-scheme`: `light` in `:root`, `dark` in both dark blocks.
  - Status tokens (same in every theme):

| Variable (`--cmx-…-rgb`) | LIGHT | DARK |
|---|---|---|
| `destructive`, `debit` | 220 38 38 | 248 113 113 |
| `destructive-hover` | 185 28 28 | 239 68 68 |
| `destructive-bg`, `error-bg` | 254 242 242 | 69 10 10 |
| `success`, `credit`, `success-dark` | 22 163 74 | 74 222 128 |
| `success-darker` | 21 128 61 | 134 239 172 |
| `success-bg` | 240 253 244 | 5 46 22 |
| `success-border` | 187 247 208 | 22 101 52 |
| `warning` | 217 119 6 | 251 191 36 |
| `warning-dark` | 161 98 7 | 252 211 77 |
| `warning-darker` | 146 64 14 | 253 230 138 |
| `warning-bg` | 254 252 232 | 66 32 6 |
| `warning-border` | 253 224 71 | 133 77 14 |
| `info` | 59 130 246 | 96 165 250 |
| `info-bg` | 239 246 255 | 23 37 84 |
| `info-border` | 191 219 254 | 30 64 175 |

  The DARK status values are provisional; they are confirmed when dark mode is switched on (PR-07 task 6).
  - Not colours, in `:root` only: `--cmx-radius-sm: 0.375rem`, `--cmx-radius-md: 0.5rem`, `--cmx-radius-lg: 0.75rem`, `--cmx-shadow-sm: 0 8px 24px rgba(15,23,42,0.06)`, `--cmx-shadow-lg: 0 28px 70px rgba(15,23,42,0.14)`, `--cmx-z-modal: 1050`, `--cmx-touch-min: 44px`.
  - Density: `--cmx-control-h`, `--cmx-row-h`, `--cmx-cell-px` set to `2.5rem`, `2.75rem`, `1rem` under `:root, [data-density=COMFORTABLE]` and `2rem`, `2rem`, `0.5rem` under `[data-density=COMPACT]`. Font scale: `html[data-font-scale=SM] { font-size: 93.75% }`, `MD` 100%, `LG` 112.5%.
  - If the fourth test lists a variable not covered here, add it with the value of its most common inline fallback and note it in `STATUS.md`.

- [ ] **Step 4: Edit `app/globals.css`**
  - Delete the Google Fonts `@import` (line 2), the `color-scheme: light only` rule, and the commented-out dark block.
  - After `@import "tailwindcss";` add `@import "../src/ui/foundations/tokens.css";`.
  - Re-point the ten existing variables to tokens (`--background: rgb(var(--cmx-background-rgb))`, `--foreground`, `--muted`, `--muted-foreground`, `--border`; `--ring`, `--focus-ring` → `focus-ring`; `--input-bg`, `--input-text` → `foreground`, `--input-placeholder` → `muted-foreground`).
  - In `@theme inline`, add `--color-<name>: rgb(var(--cmx-<token>-rgb))` for every name in this task's Produces list. Mapping where the name differs from the token: `card-foreground`, `popover-foreground`, `accent-foreground`, `secondary-foreground` → `foreground`; `popover` → `surface-elevated`; `input` → `border`; `ring` → `focus-ring`; `secondary` → `secondary-bg`; `accent` → `ghost-hover-bg`; `primary-foreground` → `primary-fg`; `destructive-foreground` → literal `255 255 255`; `brand-secondary-foreground` → `brand-secondary-fg`. Also `--radius-sm/md/lg: var(--cmx-radius-sm/md/lg)`.
  - Body `font-family: var(--font-sans)`.
  - Add the six `.cmx-type-*` classes in `@layer components`: page title `1.5rem/2rem 700`, section title `1rem/1.5rem 600`, KPI `1.875rem/2.25rem 700` with `font-variant-numeric: tabular-nums`, field label `0.875rem/1.25rem 500`, field helper `0.75rem/1rem` in `muted-foreground`, field error `0.75rem/1rem` in `destructive`. Titles and label use `foreground`.
  - Add `@media (pointer: coarse) { button, [role="button"], input, select, a[role="menuitem"] { min-height: var(--cmx-touch-min); } }`.
  - Add `@media print { :root, [data-mode] { … } }` that sets every neutral token to its LIGHT value with `background`, `surface`, `card`, `card-bg` at `255 255 255` and `foreground`, `text-primary` at `0 0 0`, and `color-scheme: light`.
  - Delete the `[dir="rtl"] .truncate` rule (the block starting "Fix text truncation for Arabic") and the "Better truncate behavior for RTL" rule that follows it, if it also targets `.truncate`. Leave the rest of the RTL override block for PR-05.

- [ ] **Step 5: Edit `app/layout.tsx`** — add `data-mode="LIGHT" data-density="COMFORTABLE" data-font-scale="MD"` to `<html>`. These are fixed values until PR-07 resolves them per user.

- [ ] **Step 6: Run and see the tests pass** — `npx jest src/ui/foundations`. Expected: 4 passed.
- [ ] **Step 7: Build** — `npm run build`. Expected: success. Then `npm run dev`, open `/dashboard`, confirm the page renders and primary buttons are aqua.
- [ ] **Step 8: Record progress** — Progress table row 3 and `STATUS.md`, listing any variable added beyond this plan's tables.

---

### Task 4: Fonts through `next/font`

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css` (the `[dir="rtl"] body` rule near line 106 and `@theme inline`)

**Interfaces:**
- Produces: CSS variable `--font-arabic` on `<html>`; `--font-sans` stays the system stack (the `STANDARD` font pair downloads nothing for Latin text).

- [ ] **Step 1:** In `app/layout.tsx`, load `Noto_Sans_Arabic` from `next/font/google` with `subsets: ['arabic']`, `weight: ['400', '500', '600', '700']`, `display: 'swap'`, `variable: '--font-arabic'`, and put its `variable` class on `<html>`.
- [ ] **Step 2:** In `app/globals.css`, change the `[dir="rtl"] body` font to `font-family: var(--font-arabic), var(--font-sans);`. Rename `--font-geist-sans` and `--font-geist-mono` to plain values of `--font-sans` and `--font-mono` (they are system stacks, not Geist).
- [ ] **Step 3: Verify** — `npm run build` succeeds (it needs network access to fetch the font once). In dev, switch to Arabic; in the browser network panel there is no request to `fonts.googleapis.com`, and Arabic text renders in Noto Sans Arabic.
- [ ] **Step 4: Record progress** — Progress table row 4 and `STATUS.md`.

---

### Task 5: RTL and broken-value fixes in shared components

**Files (modify):**
- `src/ui/primitives/cmx-input.tsx` — lines 93–94: `pl-10` → `ps-10`, `pr-10` → `pe-10`; line 116: `left-0 … pl-3` → `start-0 … ps-3`; line 156: `right-0 … pr-3` → `end-0 … pe-3`.
- `src/ui/forms/cmx-select-dropdown.tsx` — line 503: `pl-9 pr-3` → `ps-9 pe-3`; line 512: `left-2` → `start-2`.
- `src/ui/primitives/cmx-select.tsx` — convert any physical `pr-*`, `right-*`, `pl-*`, `left-*` to logical equivalents.
- `src/ui/primitives/cmx-button.tsx` — line 82: `mr-2` → `me-2`; primary and destructive variants: replace `text-white` with `text-[rgb(var(--cmx-primary-fg-rgb))]` on primary (destructive keeps white).
- `src/ui/navigation/cmx-sidebar.tsx` — line 516: remove the `isRTL ? 'rotate-180'` from `<ChevronDown>`; line 518: replace the ternary on `<ChevronRight>` with the class `rtl:rotate-180`.
- `src/ui/navigation/cmx-pagination.tsx` — lines 167–219: add `rtl:rotate-180` to the four chevron icons; give each icon-only button an `aria-label` from i18n (first, previous, next, last page).
- `src/ui/charts/cmx-line-chart.tsx` — lines 37 and 47: SVG `stroke` attributes cannot use Tailwind's underscore form; set `stroke="rgb(var(--cmx-border-subtle-rgb))"` and `stroke="rgb(var(--cmx-primary-rgb))"` with no fallback.
- `src/features/erp-lite/ui/gl-journal-detail-panel.tsx` — lines 189 and 196: the fallbacks are doubled (`239_68_68,239_68_68`); change to `text-[rgb(var(--cmx-debit-rgb))]` and `text-[rgb(var(--cmx-credit-rgb))]`.
- Any other `text-white` sitting on a primary background inside `src/ui` (search `cmx-primary-rgb` together with `text-white`) gets the same `primary-fg` replacement.

**Interfaces:**
- Consumes: `--cmx-primary-fg-rgb` from Task 3.
- Produces: i18n keys for the four pagination labels (reuse `common.*` keys if they exist).

- [ ] **Step 1:** Confirm each line number above by opening the file; the numbers were read on 2026-11-16.
- [ ] **Step 2:** Make the edits. Add the pagination keys to `messages/en` and `messages/ar` only if no existing key fits.
- [ ] **Step 3:** If a story exists for a changed component, check it in the Storybook `rtl` direction: icons sit on the correct side; the sidebar's down chevron points down in Arabic; pagination arrows point outward correctly.
- [ ] **Step 4:** `npx eslint src/ui --quiet`, `npm run typecheck`, `npm run check:i18n`. Expected: clean.
- [ ] **Step 5: Record progress** — Progress table row 5 and `STATUS.md`, listing any file whose line numbers had moved and any extra `text-white` site fixed.

---

### Task 6: Accessibility fixes in shared components

**Files (modify):**
- `src/ui/feedback/cmx-confirm-dialog.tsx`
- `src/ui/primitives/cmx-input.tsx` (line 76)
- `src/ui/feedback/cmx-status-badge.tsx` (line 108)
- `src/ui/patterns/cmx-wizard.tsx` (line 113)
- Test: `src/ui/feedback/__tests__/cmx-confirm-dialog.test.tsx` (create, or extend if one exists)

**Interfaces:**
- `CmxConfirmDialogProps` is unchanged. Every existing caller must keep working without edits.

- [ ] **Step 1: Write the failing tests**

```tsx
test('Escape cancels in controlled mode', async () => {
  const onCancel = jest.fn()
  render(<CmxConfirmDialog open title="Delete?" onConfirm={jest.fn()} onCancel={onCancel} />)
  await userEvent.keyboard('{Escape}')
  expect(onCancel).toHaveBeenCalledTimes(1)
})
test('focus starts inside the dialog', () => {
  render(<CmxConfirmDialog open title="Delete?" onConfirm={jest.fn()} />)
  expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement)
})
test('two inputs with the same label get different ids', () => {
  render(<><CmxInput label="Name" /><CmxInput label="Name" /></>)
  const [a, b] = screen.getAllByLabelText('Name')
  expect(a.id).not.toBe(b.id)
})
```

- [ ] **Step 2: Run and see them fail** — `npx jest src/ui/feedback src/ui/primitives`.
- [ ] **Step 3: `CmxConfirmDialog`** — render its content inside `CmxDialog` from `src/ui/overlays/cmx-dialog.tsx` (which already provides the portal, Escape handling and `role="dialog"`), replacing the hand-built `fixed inset-0` overlay. Keep trigger mode, controlled mode, `children`, and `confirmDisabled`. If `CmxDialog` does not move focus inside on open, add that to `CmxDialog` (backward compatible) rather than here.
- [ ] **Step 4: `CmxInput`** — line 76 becomes `const inputId = idProp ?? generatedId`.
- [ ] **Step 5: `CmxStatusBadge`** — remove `role="status"` at line 108 (a static badge is not a live region).
- [ ] **Step 6: `CmxWizard`** — replace `window.confirm('Are you sure you want to cancel? …')` at line 113 with `CmxConfirmDialog` in controlled mode, with title, description, confirm and cancel text from i18n keys (EN and AR).
- [ ] **Step 7: Run and see them pass**, then `npx eslint src/ui --quiet`, `npm run typecheck`, `npm run check:i18n`.
- [ ] **Step 8: Record progress** — Progress table row 6 and `STATUS.md`, noting whether `CmxDialog` itself had to change.

---

### Task 7: Default page size, Storybook toolbars, final verification, docs

**Files:**
- Modify: `src/ui/data-display/cmx-table-defaults.ts` (line 11)
- Modify: `.storybook/preview.ts`
- Modify: `docs/features/UI_Design_System_Enhace/STATUS.md`, `PR-01-tokens-rtl-a11y.md`

- [ ] **Step 1:** `CMX_DEFAULT_PAGE_SIZE = 10`. Nothing else: tables already accept their own size (`pageSize`, `initialPageSize`) and `pageSizeOptions`.
- [ ] **Step 2:** In `.storybook/preview.ts`, add two toolbar globals beside `direction`: `mode` (`LIGHT`, `DARK`; default `LIGHT`) and `density` (`COMFORTABLE`, `COMPACT`; default `COMFORTABLE`). The existing decorator also sets `document.documentElement.dataset.mode` and `.dataset.density`.
- [ ] **Step 3: Full checks** — `npx eslint . --quiet`, `npm run typecheck`, `npm test`, `npm run check:i18n`, `npm run build`. Expected: all clean. Any test that fails because two conflicting classes no longer both appear (Task 1) is reviewed case by case: fix the caller's intent, not the test's string.
- [ ] **Step 4: Manual checks** in dev, EN and AR:
  - Dashboard, orders list, new order, a settings page and the login page render; primary buttons are aqua with dark text.
  - In Storybook, switch `mode` to `DARK`: `CmxButton`, `CmxInput`, `CmxCard`, `CmxDataTable` are readable.
  - A long Arabic cell in a table truncates with an ellipsis instead of wrapping.
  - Print preview of any page is black on white.
  - Tables show 10 rows by default; a table inside a dialog still fits.
- [ ] **Step 5: Docs and final progress** — Progress table row 7. In `STATUS.md` set PR-01 to "Implemented, owner QA pending" with the date, carry over every note from the Progress table, and add the manual checks above as owner QA steps (page, what to click, what to expect) to `QA_TEST_GUIDE.md` (never to `STATUS.md`; owner, 2026-11-16). In `PR-01-tokens-rtl-a11y.md`, mark each task done or withdrawn. In `THEMING_ARCHITECTURE_DESIGN.md`, correct anything implementation proved different (token values, names).

---

## Not in this package

- Replacing raw palette classes in shared components and features (PR-02, PR-05).
- Reading the theme or user preferences from the database (PR-07).
- The remaining global RTL override rules (PR-05).
- Offering dark mode to users (PR-07 task 6).

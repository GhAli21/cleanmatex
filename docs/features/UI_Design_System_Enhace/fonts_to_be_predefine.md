# Predefined font pairs — plan (to implement later)

**State:** Plan only, written 2026-11-19 at the owner's request. Not approved and not started. Write a full `PLAN_FONTS.md` with tasks and tests from this outline, and get it approved, before any code.
**Belongs to:** UI Design System (`STATUS.md`). It depends on PR-07 (tables and resolver, done) and the HQ appearance catalogs (`cleanmatexsaas/docs/features/UI_Theme_Catalogs/PLAN_PR-07-HQ.md`, done).

## Why

`sys_ui_font_pair_cd` has one row, `STANDARD`: system fonts for English, Noto Sans Arabic for Arabic. The tenant app writes `<html data-font="<CODE>">`, but no CSS reads it yet, so choosing another pair changes nothing. HQ cannot create pairs (`allowCreate: false`), because a pair is only real once its font files ship with the tenant app.

## How fonts work today (checked 2026-11-19)

- `web-admin/app/layout.tsx` loads Noto Sans Arabic with `next/font/local` from `app/fonts/noto-sans-arabic-arabic-wght.woff2` (arabic subset, variable 400–700, OFL licence file beside it) as `--font-arabic`.
- `app/globals.css`: `--font-sans` is a system stack (no download). Arabic text uses `var(--font-arabic), var(--font-sans)`.
- No Google Fonts at build or run time. A Google download once failed the Vercel build, so this rule stays.

## Candidate fonts (licences to be re-verified from each font's own repository before adding)

| Code | English | Arabic | Notes |
|---|---|---|---|
| `STANDARD` (exists) | System stack | Noto Sans Arabic | Fastest; nothing extra to download |
| `PLEX` | IBM Plex Sans | IBM Plex Sans Arabic | One family, matched design; OFL |
| `CAIRO` | Cairo (Latin part) | Cairo | Very common in GCC apps; variable; OFL |
| `TAJAWAL` | Tajawal (Latin part) | Tajawal | Light, rounded; static weights only; OFL |
| `ALMARAI` | Almarai (Latin part) | Almarai | Highly readable on screens; static; OFL |
| `INTER_NOTO` | Inter | Noto Sans Arabic | Modern Latin with the current Arabic; OFL |
| `READEX` | Readex Pro | Readex Pro | Variable, covers both scripts; OFL |

Rules for any font:
- OFL or Apache 2.0 only. Commit the licence file next to the font.
- Full Arabic coverage, including Arabic-Indic digits and the punctuation the app prints (receipts, invoices).
- Weights 400, 500, 600 and 700 (variable if available).
- `woff2` only, subset to Latin + Arabic. Size budget: about 150 KB per pair.

## Steps (outline for the future plan)

1. **Choose and verify:** confirm licence and coverage for each candidate and pick the first set. The owner approves the list.
2. **Bundle:** add the `woff2` files under `web-admin/app/fonts/`, load each with `next/font/local` (`display: 'swap'`, one CSS variable per family, `preload: false` except for `STANDARD`). Load only the active pair's files on a page.
3. **CSS:** `html[data-font="<CODE>"] { --font-sans: …; --font-arabic: …; }` in `src/ui/foundations/tokens.css`, with a guard test that every seeded code has a rule.
4. **Seed:** a migration (latest number + 1 at write time) inserts the pairs into `sys_ui_font_pair_cd` (`code`, `name`, `name2`, `font_family_en`, `font_family_ar`, `rec_order`, audit fields), `is_default = false`. Write the file, then stop for the owner to apply it.
5. **Constants:** add the codes to `lib/constants/ui-theme.ts` if code needs them by value; keep the DB values exact.
6. **Test in the tenant app:**
   - each pair in EN and AR on the dashboard, New Order, the order list and dialogs;
   - print preview of a receipt and a tax invoice;
   - sign-in page;
   - a performance check: no layout shift on the font swap, and page weight within the budget;
   - jest: the data-font guard and the resolver picks the pair.
7. **HQ:** nothing to build. The new rows show in Products & Items Config → Appearance → Fonts, where HQ can rename them, set the default or deactivate them.
8. **Docs:** `PR-07_FEATURE_REFERENCE.md` (font section), `QA_TEST_GUIDE.md`, `STATUS.md`.
9. **Last step: a skill to manage fonts end to end.** Create `cleanmatex/.claude/skills/manage-ui-fonts/SKILL.md`. It covers:
   - **Define:** licence and coverage checklist; subset and convert to `woff2`.
   - **Add:** commit the files and the licence, `next/font/local` entry, `data-font` CSS, seed migration, constants, guard test, QA rows.
   - **Update:** replace a font file or change weights, keeping the code; update the licence file.
   - **Rename / set default / deactivate:** done in HQ; the skill points there and explains the tenant effect (live rows keep rendering).
   - **Remove:** only after no live `org_tenant_ui_theme_dtl` row uses the code (the HQ usage count shows this). Then deactivate; never delete a code that saved themes point to.
   - **Verification:** build, jest guard, EN/AR visual check, print check.

## Open questions for the owner (at plan time)

- Which pairs to ship first (recommend `PLEX`, `CAIRO`, `INTER_NOTO`).
- Should a pair be tied to plans (for example only PRO and above), or follow the existing `custom_branding` flag? Recommendation: follow `custom_branding`, which already gates the theme font choice.

# Changelog — Human-Friendly Codes

## 2026-11-06 (Asia/Muscat) — A-76..A-83 HQ doc-seq console redesign (no migration)

### Added
- **platform-api:** `GET doc-seq/stats`, `GET doc-seq/counters`, `GET doc-seq/counters/tenants` (read only, `hq_doc_seq:read`); `GET general-config/history`; `updatedByName` on `GET general-config`; `reset` filter + server sort on `GET doc-seq/types`.
- **platform-web:** Doc Seq hub with health + KPIs; Code Type detail page `/doc-seq-config/types/[code]` (overview, live preview, counters/tenants, checks); read-only **Code Counters** `/doc-seq-config/counters` (sidebar link); General Config change history.
- URL-synced filters, CSV export, breadcrumbs (`CmxBreadcrumbs`), skeletons, empty / error-with-retry / no-access states on every screen; EN/AR catalogs `docSeqConsole`, `docSeqChecks`.

### Changed
- Code Consistency is one issue list with severity, meaning and fix per check; KPI cards filter it.
- General Config edit: inline validation, review-changes step on every save, discard guard, Edit disabled with a reason when you lack `hq_general_config:manage`.

### Fixed
- `/doc-seq-config/types` and `/consistency` had no sidebar/top bar after A-75 (A-76).
- Type search with characters such as `.` or `/` broke the list (API 400).
- Page size 25 not offered by the table; sort headers not keyboard operable; `PREFIX_SHARED` rows missing from a type's checks; editor shown as a raw id.

### Proposed (not built)
- P-1 audited "move counter forward" endpoint; P-2 delete the now unused `doc-seq-type-dialog.tsx`.

## 2026-11-06 (Asia/Muscat) — A-75 HQ navigation / Doc Seq Config module

- **platform-web:** Doc Seq screens moved to `/doc-seq-config` (hub, `/types`, `/consistency`). Permanent redirects from `/system-codes/doc-seq-*`.
- Sidebar: new section label exactly `SaaS Backoffice Admin- HQ` (General Config + Doc Seq). **System Catalogs Codes** → `/system-codes`; Settlement + BVM added beside Payment Setup / Cash & POS. `/codes` kept as **Code Tables**.
- platform-api `/doc-seq` URLs unchanged. Decision A-75 in IMPLEMENTATION_PLAN §20.

All dates are 2026, Asia/Muscat. "Applied" means the user applied the migrations to local and remote databases.

## [Unreleased] — 2026-11-05 — P11 applied + deployed

### Added (FOLLOWUPS NOW batch, 2026-11-05 evening)
- Migrations **applied by user 2026-11-05** (local + remote): `0693` label_printing flag retire; `0695` legacy label settings delete; `0696` drop `org_orders_mst.qr_code`/`barcode`; `0697` credit_note.issued template → `{{credit_note_no}}`. Types + Prisma regenerated both repos. Next free: `0698`.
- `FINAL_QA_RUNBOOK.md`, `P10_BACKFILL_RUNBOOK.md`.
- HQ `platform-web` jest-axe: `__tests__/features/doc-seq-a11y.test.tsx` (3/3).

### Changed (FOLLOWUPS NOW batch)
- Removed store-credit LEGACY numbering (#6). Always ENGINE `''` insert.
- Deleted `barcode-generator` shim (#7). `order-number-generator` kept (order-service).
- Wired `credit_note.issued` emit from stored-value (#11; needs issuedBy; fire-and-forget).
- Synced platform inventory into web-admin data (#3).

### Applied / deployed (2026-11-05)
- `0690_hq_doc_seq_role_grants` applied by the user (local + remote). Types and `prisma.schema` regenerated for both repos. web-admin, HQ `platform-api` and HQ `platform-web` deployed. (`0691_speed_pricing_nav_audit.sql` was also applied with the folder through `0691`; it is **not** an HFC file.)

### Added (FOLLOWUPS #1, 2026-11-05)
- `0693_retire_label_printing_feature_flag.sql`: hard-delete `label_printing` plan mappings + org overrides + flag row (siblings kept). Safety test `hfc_f1_retire_label_printing_safety.test.sql`. Scratch `hfc_f1` PASS. Inventory rebuild ran (exact key gone from catalog extract). **Applied by user 2026-11-05** local+remote; types/Prisma regenerated.

### Added (FOLLOWUPS #9, 2026-11-05)
- HQ `platform-web`: `jest-axe@^10.0.0` + `@types/jest-axe@^3.5.9` as devDependencies (A-63 / A-25). No HQ jest-axe tests existed yet to un-skip.

### Added (P11, code landed earlier; now live)
- `0690_hq_doc_seq_role_grants`: A-54 grants — `hq_doc_seq:read` → TECH_ADMIN, SUPPORT; `hq_general_config:read|manage` → TECH_ADMIN; JSON copy synced; safety test `hfc_p11_role_grants_safety.test.sql` (A-71).
- web-admin `lib/notifications/credit-note-variables.ts`: `credit_note_no` (+ `invoice_number` alias, `amount`, `currency`) for `credit_note.issued`; WhatsApp key; EN/AR hint (A-74).

### Fixed (FOLLOWUPS #15, 2026-11-05)
- Customer-app `test/booking/customer_order_booking_screen_test.dart`: stale step-two expects updated to match per-piece UI (`Packing` l10n; `FilterChip.selected`). 2/2 pass.

### Docs (FOLLOWUPS #13, 2026-11-05)
- A-50..A-74 **reviewed + accepted** by Jehad Ali 2026-11-05 (expert recommendation). Plan §20 markers updated; A-50 LEGACY status wording corrected (kept until FOLLOWUPS #6 later); A-66/A-72 status lines refreshed. Compact assessment kept in `FOLLOWUPS_APPROVAL.md` as the record.

### Changed
- Mobile customer booking success message shows the order number left-to-right (`ltrCode`, A-73); ships with the next customer app release.
- HQ ADR-004 Status **Proposed → Accepted** (Jehad Ali, 2026-11-05): engine lives in the tenant DB; HQ reaches it only through `platform-api` (A-69).

### Removed
- Stray staging zip `C:\Users\JHNLP\p4v2code.zip` deleted (FOLLOWUPS #4, Jehad Ali OK Now; 87,089 bytes).
- `label_printing` from the web-admin flag catalog, `FEATURE_FLAG_KEYS` and `TenantFeatureFlags` (A-72). DB retirement migration `0693` **applied 2026-11-05** local+remote.

## [1.0.0] — 2026-10-31 — plan CLOSED; migrations all applied 2026-11-01, waiting for user deploy

### Applied (2026-11-01)
- `0687_fin_store_credit_note_scn`, `0688_hq_doc_seq_permissions`, `0689_ord_label_image_cols_deprecated` applied by the user (local + remote). Deploys, smoke test and QA are next.

### Added
- P1 (applied 2026-10-30): doc-seq engine — scopes/modules/sub-systems lookups, `sys_doc_seq_type_cd` config (51 doc types), `hq_general_config`, counters, `fn_doc_seq_next` / formatter, `vw_doc_seq_consistency`, code-tables registry (`0666`–`0672`).
- P2 (applied): order numbers from the engine (`0674`), transactional split numbering.
- P2.1 (applied): split family root `root_order_id` (`0677`), tenant hard-delete guard (`0678`).
- P2.2 (code): HQ tenant create starts in `creating`.
- P3 (applied): item serial barcode and human piece codes (`0682`, `0683`), external-tag rules.
- P3b (code): tenant-wide scan API and global scan dialog (`Ctrl+Shift+F`), `CmxCodeChip`, `CmxCodeSearchInput`, codes on every station screen.
- P4 (applied): label printing settings (`0685`), real CODE128 + QR (`bwip-js`), order label and piece tags, Settings → Labels & Tags.
- P5 (applied 2026-11-01): store credit notes `SCN-YYYY-NNNNNN` (`0687`).
- P6 (applied 2026-11-01): HQ permissions `hq_doc_seq:read`, `hq_general_config:read|manage` (`0688`); old image columns marked DEPRECATED (`0689`).
- P7 (code): HQ API `doc-seq-config`, `general-config`; HQ screens Code Types, Code Consistency, General Config; wizard prefill.
- P8 (code): mobile `human_codes.dart` + LTR display; notification sends `order_no`; rule text in both repos.
- P9: this documentation pack, `IMPLEMENTATION_REPORT.md`, HQ ADR-004.

### Changed
- Order, piece and credit-note codes are no longer shortened UUIDs anywhere on screen.
- `label_printing` feature flag no longer gates label printing (A-47).

### Deprecated (kept, removal needs approval)
- `org_orders_mst.qr_code`, `barcode` (comment only, `0689`).
- `lib/utils/barcode-generator.ts`, `lib/utils/order-number-generator.ts` shims; `STORE_CREDIT_NOTE_NUMBERING = 'LEGACY'` fallback (A-68).

### Fixed
- Status-transition notifications showed the order UUID instead of the order number (A-66).

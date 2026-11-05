# Changelog — Human-Friendly Codes

All dates are 2026, Asia/Muscat. "Applied" means the user applied the migrations to local and remote databases.

## [Unreleased] — 2026-11-01 — P11 follow-ups (code done, `0690` not applied)

### Added
- `0690_hq_doc_seq_role_grants` (not applied): A-54 grants — `hq_doc_seq:read` → TECH_ADMIN, SUPPORT; `hq_general_config:read|manage` → TECH_ADMIN; JSON copy synced; safety test `hfc_p11_role_grants_safety.test.sql` (A-71).
- web-admin `lib/notifications/credit-note-variables.ts`: `credit_note_no` (+ `invoice_number` alias, `amount`, `currency`) for `credit_note.issued`; WhatsApp key; EN/AR hint (A-74).

### Changed
- Mobile customer booking success message shows the order number left-to-right (`ltrCode`, A-73).

### Removed
- `label_printing` from the web-admin flag catalog, `FEATURE_FLAG_KEYS` and `TenantFeatureFlags` (A-72). The DB flag row stays (removal needs approval).

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

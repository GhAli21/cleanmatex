# Developer Guide — Human-Friendly Codes

Short guide for developers. Engine internals, SQL details and per-migration checks are in [`DEV_GUIDE_DOC_SEQ_ENGINE.md`](./DEV_GUIDE_DOC_SEQ_ENGINE.md). Diagrams: [`developer_guide_mermaid.md`](./developer_guide_mermaid.md).

## 1. Architecture in one paragraph
All migrations live in the tenant repo (`supabase/migrations`). The tenant DB holds the doc-seq engine: `sys_doc_seq_type_cd` (one row per doc type, level GENERAL or DOMAIN), `sys_doc_seq_counter_tr` (one row per tenant / type / period), `fn_doc_seq_next` (atomic `INSERT … ON CONFLICT DO UPDATE … RETURNING`, formats the code) and `vw_doc_seq_consistency`. GENERAL codes are assigned **in the database** by triggers or by `generate_order_number`; the app never builds a GENERAL code. DOMAIN codes keep their existing generators (registered in `DOMAIN_CODES_REGISTRY.md`). HQ (`cleanmatexsaas`) reads and edits configuration only through its `platform-api` (ADR-004).

## 2. Codes

| Code | Format | Set by |
|---|---|---|
| Order | `ORD-YYYYMMDD-NNNN` (tenant time zone, grows past 9999) | `generate_order_number` → `fn_doc_seq_next` (`0674`) |
| Sub-order | `<root order_no>-S<n>` | split, numbered under `root_order_id` (`0677`) |
| Item | `<order_no>-<line>` (`order_item_srno`) | DB trigger (`0682`) |
| Piece | `<order_item_srno>-<piece_seq>` (`piece_code`) | DB trigger (`0683`) |
| Store credit note | `SCN-YYYY-NNNNNN` | trigger `fn_doc_seq_assign_code` (`0687`) |
| External tag | trimmed, upper-case, `A-Z 0-9 - _ . /`, 1..64, never shaped like our codes | app validation + `0683` |

All codes are unique per tenant (`tenant_org_id, <code>` unique index) and immutable.

## 3. Where the code lives (tenant `web-admin`)
- Numbering: `lib/services/order-numbering/` (`order-number.service.ts`, `order-number-format.ts`); item serials `lib/services/order-item-code.service.ts`.
- Scan: `lib/services/scan-resolve/` (`scan-resolve.service.ts`, `cmx-code-payload.ts`), APIs `app/api/v1/scan/resolve`, `orders/lookup`, `orders/pieces/lookup`, `orders/pieces/[pieceId]/external-tag`; UI `src/features/scan/` (global dialog, link-tag dialog, `Ctrl+Shift+F`, behind `human_codes_scan_labels`).
- Validation: `lib/validations/code-format-schemas.ts` (zod v4; `orderNoFromCode`, tag rules).
- Labels: `lib/services/labels/`, `lib/utils/barcode/{code128,qr}.ts` (`bwip-js`), `src/ui/print/` (`CmxBarcode`, `CmxLabelRenderer`, `labelPageCss`), API `orders/[id]/label-data`, settings `settings/label-printing`.
- Credit notes: `lib/services/stored-value.service.ts`; fallback switch `lib/constants/doc-seq.ts` (`STORE_CREDIT_NOTE_NUMBERING`, kept, A-68).
- Display: `CmxCodeChip`, `CmxCodeSearchInput` (show codes left-to-right inside RTL with `<bdi dir="ltr">`).

## 4. HQ (`cleanmatexsaas`)
- `platform-api`: `src/modules/doc-seq-config/` (`hq_doc_seq:read`), `src/modules/general-config/` (`hq_general_config:read` / `:manage`, optimistic `version`, audit). Tenant create uses `creating` (P2.2).
- `platform-web`: `src/features/doc-seq/`, `src/features/general-config/`, pages `/system-codes/doc-seq-types`, `/system-codes/doc-seq-consistency`, `/settings/general-config`; `CmxCodeChip` copy in `src/ui/data-display`.
- Details: `DEV_GUIDE_DOC_SEQ_ENGINE.md` §23.

## 5. Mobile and notifications
- `cmx_mobile_apps/packages/mobile_core/lib/src/human_codes.dart` (1:1 Dart copy of the TS codec; `ltrCode` for display only).
- Notifications send `order_no` as `{{order_number}}` (`app/api/v1/orders/[id]/transition/route.ts`). Details §24.

## 6. Rules for new work
1. A new numbered table: add a `sys_doc_seq_type_cd` row and a trigger (checklist `DEV_GUIDE_DOC_SEQ_ENGINE.md` §7; busy tables §12).
2. Never build GENERAL codes in app code; never reset or delete counters (A-24, A-33).
3. Show codes with `CmxCodeChip` / `ltrCode`; never show a shortened UUID.
4. Scan input goes through `ScanResolveService` (or `/api/v1/scan/resolve`).
5. HQ never writes the tenant engine directly; add an HQ API endpoint (ADR-004).
6. Backfills of other tables follow plan §5.13 (one migration per table, separate approval).

## 7. Tests
See [`testing_guide_and_scenarios.md`](./testing_guide_and_scenarios.md) for the automated test inventory and how to run it.

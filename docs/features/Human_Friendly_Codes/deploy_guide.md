# Deploy Guide — Human-Friendly Codes

**The single source of the apply and deploy steps is [`DEV_GUIDE_DOC_SEQ_ENGINE.md`](./DEV_GUIDE_DOC_SEQ_ENGINE.md) §22 APPLY_RUNBOOK.** This page is a checklist that points there. The user applies migrations and runs Prisma / type generation; no tool or agent does it.

## Order (2026-10-31; updated 2026-11-01)
**Steps 1, 2 and 5 are DONE: `0687`–`0689` were applied by the user on 2026-11-01 (local + remote). Next: step 3, then 6–10.** Step 4 stays optional.

1. Pre-checks (read-only): DEV_GUIDE §20 (for `0687`) and §21 (for `0688`, `0689`).
2. Apply on the **local** DB: `0687_fin_store_credit_note_scn.sql` → `0688_hq_doc_seq_permissions.sql` → `0689_ord_label_image_cols_deprecated.sql`. `0688` and `0689` are safe to run twice; `0687` refuses a second run on purpose (`FIN_SCN_ALREADY_GENERAL`, nothing changes).
3. Safety tests on local (each rolls back): `supabase/tests/hfc_p5_scn_safety.test.sql`, `supabase/tests/hfc_p6_safety.test.sql`.
4. Types / Prisma (optional; no column changes).
5. Repeat 1–2 on **remote**.
6. Deploy web-admin (`0687` is applied, so it can go now) (P3b, P4 screens, P5 code, P8 notification fix).
7. Deploy HQ `platform-api` (P2.2, P7) (`0688` is applied), then `platform-web` (P7).
8. **P11 (new, not applied):** apply `0690_hq_doc_seq_role_grants.sql` local → run `supabase/tests/hfc_p11_role_grants_safety.test.sql` → apply remote; affected HQ users sign in again (DEV_GUIDE §22 step 6a, A-71). Deploy web-admin again for the P11 code (A-72, A-74).
9. Release the customer mobile app (P8 + P11 booking `ltrCode`, DEV_GUIDE §22 step 6b).
10. Smoke test (DEV_GUIDE §22 step 7), then QA S1–S20 ([`QA_TEST_GUIDE.md`](./QA_TEST_GUIDE.md)).

## Rollback
DEV_GUIDE §22 "Rollback": reverse order `0690` (DEV_GUIDE §22 step 6a rollback), `0689`, `0688` (§21), then `0687` (§20: set `STORE_CREDIT_NOTE_NUMBERING = 'LEGACY'` and deploy first).

## Environment variables / config
No new environment variable. Feature flag `human_codes_scan_labels` (from `0684`, default off) switches the scan dialog and the receipt barcode per tenant. Label printing is on for everyone (A-47); since P11 the `label_printing` key is no longer in web-admin code (A-72).

# SQL clock inventory

Sampled from the local catalog on 2026-11-25 after `0830` and `0831`.

## Closed in this pack

| Function | What changed |
|---|---|
| `fn_ops_zone` | New SQL door. Branch catalog zone, then organization catalog zone, otherwise null. |
| `fn_doc_seq_next_by_row` | A tenant number uses `fn_ops_zone` and raises `DOC_SEQ_TIMEZONE_NOT_CONFIGURED` when the zone is missing. SYS and HQ numbers still use `hq_general_config.timezone`. Issued numbers were not rewritten. |
| `fn_shc_speed_no_express` | A missing zone returns `TIMEZONE_NOT_CONFIGURED`. It no longer substitutes UTC. |

Live check: both local organizations resolve `Asia/Muscat`. Remote organizations resolve `Asia/Muscat`, `Asia/Qatar`, `Asia/Riyadh`, and `UTC`, matching `org_tenants_mst.timezone`. An unknown operation returns null.

## Still open

These public functions still mention `AT TIME ZONE` or a naive timestamp. Each one needs its own reading before a conversion. They were not changed.

- `cmx_ord_pref_append_notes_followup`
- `fn_doc_seq_format_row`
- `fn_doc_seq_period_key`
- `fn_fin_credit_note_expire_one`
- `fn_fin_credit_note_expiry_run`
- `fn_hq_audit_before_insert`
- `fn_hq_gen_cfg_validate`
- `fn_ntf_quota_reserve`
- `fn_ntf_short_retention_run`
- `fn_ntf_usage_reconcile`
- `fn_ntf_worker_claim_one`
- `fn_ops_job_restore`
- `fn_tenant_tz_validate`
- `fn_verify_hq_audit_integrity`
- `org_ord_append_notes_followup`

`fn_doc_seq_period_key` and `fn_doc_seq_format_row` receive the zone chosen by the caller. They are not a second lookup.

## Not converted

`0832` is applied on local and remote. It converts `org_users_mst.locked_until` and `last_failed_login_at` and changes `record_login_attempt` to return `timestamptz`. Later instant columns follow the same UTC-wall rule. Civil columns stay `date` or `time`.

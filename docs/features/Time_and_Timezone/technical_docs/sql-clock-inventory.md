# SQL clock inventory

Sampled from the local catalog on 2026-11-25 after `0830` and `0831`.

## Closed in this pack

| Function | What changed |
|---|---|
| `fn_ops_zone` | New SQL door. Branch catalog zone, then organization catalog zone, otherwise null. |
| `fn_doc_seq_next_by_row` | A tenant number uses `fn_ops_zone` and raises `DOC_SEQ_TIMEZONE_NOT_CONFIGURED` when the zone is missing. SYS and HQ numbers still use `hq_general_config.timezone`. Issued numbers were not rewritten. |
| `fn_shc_speed_no_express` | A missing zone returns `TIMEZONE_NOT_CONFIGURED`. It no longer substitutes UTC. |

Live check: both local organizations resolve `Asia/Muscat`. Remote organizations resolve `Asia/Muscat`, `Asia/Qatar`, `Asia/Riyadh`, and `UTC`, matching `org_tenants_mst.timezone`. An unknown operation returns null.

## Classified on 2026-11-26

| Function | Decision |
|---|---|
| `cmx_ord_pref_append_notes_followup` | Writes the note instant as UTC `Z` from a `timestamptz`. Already correct. |
| `org_ord_append_notes_followup` | Same JSON instant. Already correct. |
| `fn_doc_seq_format_row` | Converts the passed instant with the passed zone. Not a second lookup. |
| `fn_doc_seq_period_key` | Same. The caller chooses the zone. |
| `fn_fin_credit_note_expire_one` | `0840`. Due day is the organization civil day (`ledger`). A missing zone is not due. |
| `fn_fin_credit_note_expiry_run` | `0840`. Same rule, one zone read per note. |
| `fn_ntf_worker_claim_one` | `0840`. Returns `scheduled_at` as `timestamptz` and compares it with `now()`. |
| `fn_ntf_short_retention_run` | `0841`. Compares OTP and schedule instants with `now()`. |
| `fn_ntf_quota_reserve` | The reserved usage day is the UTC date. That is the platform quota day, not a shop day. |
| `fn_ntf_usage_reconcile` | Reads `hq_ntf_dispatch_log.dispatched_at` as a UTC wall. The column waits for the HQ reader list. |
| `fn_hq_audit_before_insert` | Canonical hash treats `created_at` as a UTC wall. The HQ column waits for the reader list. |
| `fn_verify_hq_audit_integrity` | Same hash. The HQ column waits for the reader list. |
| `fn_hq_gen_cfg_validate` | Checks that the saved HQ zone is a real IANA name. |
| `fn_tenant_tz_validate` | Checks that the saved organization zone is a real IANA name. |
| `fn_ops_job_restore` | Labels the restore instant as UTC `Z`. The stored value is `timestamptz`. |

`fn_doc_seq_period_key` and `fn_doc_seq_format_row` receive the zone chosen by the caller. They are not a second lookup.

## Not converted

`0832` is applied on local and remote. It converts `org_users_mst.locked_until` and `last_failed_login_at` and changes `record_login_attempt` to return `timestamptz`. Later instant columns follow the same UTC-wall rule. Civil columns stay `date` or `time`.

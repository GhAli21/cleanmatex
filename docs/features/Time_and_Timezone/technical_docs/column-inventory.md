# Column inventory

Source: `web-admin/prisma/schema.prisma` on 2026-11-24. Recount before the first conversion migration. Prisma `@db.Timestamp(6)` is `timestamp without time zone`.

## Already correct

977 columns are `@db.Timestamptz`. Do not touch them in this program.

`org_orders_mst.ready_by_at_new` is `timestamptz`. It is the Ready By instant.

`org_pos_sessions_mst.opened_at` is `timestamptz`. `business_date` is `date`. `business_timezone` is the snapshotted IANA name.

Some lock columns are already `timestamptz` (`attack_locked_until`, `verification_locked_until`, and a second `locked_until` around the billing models). Do not convert those again. The broken one is `org_users_mst.locked_until`.

## Class A — fix first (known wrong clock)

These are instants. The stored wall clock is not yet proven for the `USING` clause.

| Column | Table | Prisma |
|---|---|---|
| `ready_by` | `org_orders_mst` | `Timestamp(6)` |
| `locked_until` | `org_users_mst` | `Timestamp(6)` |
| `last_failed_login_at` | `org_users_mst` | `Timestamp(6)` |
| `scheduled_at` | `org_ntf_campaigns_mst` | `Timestamp(6)` |
| `scheduled_at` | `org_ntf_outbox_dtl` | `Timestamp(6)` |

Also treat `org_ntf_outbox_dtl.next_retry_at` as Class A. It is the same family as `scheduled_at`.

`ready_by` is not dropped in the Class A migration. Readers move to `ready_by_at_new`. The migration backfills only null twins after the wall clock is proven.

## Class B — other naive names (90 columns, 61 names)

Counts are how many tables use that column name. Confirm the table list from Prisma before writing SQL. Several names occur on both `org_*` and `sys_*` / `hq_*` tables. A `sys_*` conversion still lives in this repo's migrations. Name any HQ worker that reads it before apply.

| Count | Column | First tables seen |
|---|---|---|
| 6 | `approved_at` | `org_ff_overrides_cf`, `org_fin_gov_assign_mst`, `org_ntf_campaigns_mst`, `sys_fin_gov_pkg_mst` |
| 3 | `paid_at` | `org_invoice_mst`, `org_orders_mst`, `sys_bill_invoices_mst` |
| 3 | `delivered_at` | `org_orders_mst`, `org_rcpt_receipts_mst`, `org_ntf_outbox_dtl` |
| 3 | `resolved_at` | `sys_bill_dunning_mst`, `org_asm_exceptions_tr`, `org_fin_post_exc_tr` |
| 3 | `started_at` | `org_asm_tasks_mst`, `org_dlv_routes_mst`, `org_ntf_campaigns_mst` |
| 3 | `completed_at` | `org_asm_tasks_mst`, `org_dlv_routes_mst`, `org_ntf_campaigns_mst` |
| 3 | `closed_at` | `org_fin_bank_recon_mst`, `org_fin_cash_rec_mst`, `org_fin_period_mst` |
| 2 | `s_date` | `org_branches_mst`, `org_customers_mst` |
| 2 | `changed_at` | `org_order_status_history`, `sys_code_table_audit_log` |
| 2 | `expires_at` | `sys_otp_codes`, `org_ntf_inbox_mst` |
| 2 | `verified_at` | `sys_otp_codes`, `org_dlv_pod_tr` |
| 2 | `cancelled_at` | `org_pln_subscriptions_mst`, `org_ntf_campaigns_mst` |
| 2 | `qa_at` | `org_asm_tasks_mst`, `org_qa_decisions_tr` |
| 2 | `effective_from` | `org_ff_overrides_cf`, `sys_ntf_pricing_cf` |
| 2 | `sent_at` | `org_rcpt_receipts_mst`, `org_ntf_outbox_dtl` |
| 2 | `processed_at` | `hq_ntf_webhook_events`, `org_ntf_camp_targets_dtl` |
| 2 | `scheduled_at` | counted in Class A |
| 2 | `read_at` | `org_ntf_inbox_mst`, `org_ntf_outbox_dtl` |
| 2 | `published_at` | `sys_fin_gov_pkg_mst`, `sys_fin_tpl_pkg_mst` |
| 1 | `refreshed_at` | `sessions` |
| 1 | `handed_to_date` | `org_invoice_mst` |
| 1 | `received_at` | `org_orders_mst` |
| 1 | `ready_by` | Class A |
| 1 | `ready_at` | `org_orders_mst` |
| 1 | `prepared_at` | `org_orders_mst` |
| 1 | `ready_by_override` | `org_orders_mst` |
| 1 | `credit_limit_override_at` | `org_orders_mst` |
| 1 | `last_login_at` | `org_users_mst` |
| 1 | `activated_at` | `org_pln_subscriptions_mst` |
| 1 | `suspended_at` | `org_pln_subscriptions_mst` |
| 1 | `discount_applied_at` | `org_pln_subscriptions_mst` |
| 1 | `plan_change_scheduled_at` | `org_pln_subscriptions_mst` |
| 1 | `plan_changed_at` | `org_pln_subscriptions_mst` |
| 1 | `redeemed_at` | `sys_bill_discount_redemptions_tr` |
| 1 | `last_seeded_at` | `sys_code_tables_registry` |
| 1 | `scanned_at` | `org_asm_items_dtl` |
| 1 | `packed_at` | `org_asm_tasks_mst` |
| 1 | `scheduled_time` | `org_dlv_stops_dtl` |
| 1 | `estimated_arrival` | `org_dlv_stops_dtl` |
| 1 | `actual_time` | `org_dlv_stops_dtl` |
| 1 | `effective_until` | `org_ff_overrides_cf` |
| 1 | `generated_at` | `org_pck_packing_lists_mst` |
| 1 | `printed_at` | `org_pck_packing_lists_mst` |
| 1 | `last_step_at` | `org_order_item_pieces_dtl` |
| 1 | `dispatched_at` | `hq_ntf_dispatch_log` |
| 1 | `failed_at` | `hq_ntf_dispatch_log` |
| 1 | `imported_at` | `org_fin_bank_stmt_mst` |
| 1 | `action_at` | `org_fin_doc_appr_tr` |
| 1 | `posted_at` | `org_fin_journal_mst` |
| 1 | `applied_at` | `org_fin_tpl_apply_log` |
| 1 | `performed_at` | `org_ntf_audit_dtl` |
| 1 | `paused_at` | `org_ntf_campaigns_mst` |
| 1 | `logged_at` | `org_ntf_delivery_log_dtl` |
| 1 | `next_retry_at` | `org_ntf_outbox_dtl` |
| 1 | `last_verified_at` | `org_ntf_push_subs_dtl` |
| 1 | `consent_given_at` | `org_ntf_user_prefs_dtl` |
| 1 | `consent_withdrawn_at` | `org_ntf_user_prefs_dtl` |
| 1 | `effective_to` | `sys_ntf_pricing_cf` |

### Do not assume these are instants

Classify before choosing `timestamptz`:

- `s_date`, `handed_to_date` — the names say date. They may need `date`, not `timestamptz`.
- `effective_from`, `effective_until`, `effective_to` — may be civil dates.
- `scheduled_time`, `estimated_arrival`, `actual_time` on `org_dlv_stops_dtl` — may be local appointment times. If they are, store `timestamptz` only after converting with the stop's operations zone, or store civil time plus that zone.

`closed_at` on `org_fin_period_mst` is an instant (when the close action happened). The period's calendar bounds are civil dates and stay `date` if they already are.

## Class C — audit stamps

`created_at`: 200 columns. `updated_at`: 198 columns. All `@db.Timestamp`. Phase 5 only. Group by table prefix (`org_ord_`, `org_fin_`, `org_ntf_`, `sys_`, `hq_`). One migration per prefix after a sample of that prefix.

## Provenance sample

Run read-only. Do not update.

```sql
SHOW timezone;

SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'org_users_mst'
  AND column_name IN ('locked_until', 'last_failed_login_at');
```

Then pick a row whose real time is known from a log line that is already UTC, and write down whether the naive value equals that UTC wall or that Muscat wall. The migration comment repeats that sentence only after the sample. Until then, readers use a `timestamptz` twin or show no clock. They do not assume the naive value is a UTC wall clock.

`SHOW timezone` is evidence of the session that will fill new naive writes. It is not, by itself, proof of what an old row contains.

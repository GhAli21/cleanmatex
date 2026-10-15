# Runbook 13 — Master-key rotation and configuration drift

**Status:** Implemented (2026-10-15, migration 0621). **Owner:** platform operator holding `hq_ops:manage_secrets`. **Last verified against source:** 2026-10-15.

## When to use
- Scheduled rotation of `HQ_ENCRYPTION_MASTER_KEY`, or the key may have been exposed.
- A drift alert arrived (webhook, audit entry `ops_config.drift_detected`, or Setup Health `config.mismatch`).

## Rotate the master key
1. Generate: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Store it in your secret manager, not in chat or git.
2. Set on the HQ API host: `HQ_ENCRYPTION_MASTER_KEY` = **new**, `HQ_ENCRYPTION_MASTER_KEY_PREVIOUS` = **old**. Restart HQ API. Only HQ API holds the key (platform workers and the tenant app never decrypt).
3. HQ → Operations → Config → **Encryption keys** panel → **Re-encrypt**. Repeat until pending is 0. Covers the config registry, tenant provider settings (`org_ntf_channel_provider_cf`) and tenant private credentials (`org_ntf_prov_cred_mst`).
4. Setup Health `config.key_rotation` must read "previous key can now be removed". Remove `HQ_ENCRYPTION_MASTER_KEY_PREVIOUS`, restart.
5. If the check is **FAIL (unreadable)**: some values were sealed with a key that is not configured. Put that key back as `…_PREVIOUS`, re-run Re-encrypt, or re-enter the affected values.

Rollback: before step 4 the old key is still configured, so switching the two variables back is safe; re-run Re-encrypt to seal everything under the restored key. After step 4 the old key must come from your secret manager.

## Handle a drift alert
1. HQ → Config → press **Check now**; filter by status or read the audit entry for the key names.
2. For each key decide which side is right: edit the stored value (Config) or fix the host environment variable and redeploy.
3. The status clears at the next automatic check (`platform.ops.drift_check_minutes`, default 15).
4. Persistent false alarms: change the key's policy (for example `DB_OVERRIDES_ENV`) instead of silencing alerts; set the interval to `0` only as a last resort.

## Tuning
- `platform.ops.drift_check_minutes`: 0–1440 (0 disables; default 15).
- `platform.ops.alert_webhook_url`: https Slack-compatible incoming webhook (secret; empty disables outbound alerts).

## Evidence to keep
Audit entries `ops_config.reencrypt_run` (counts only) and history rows `REENCRYPT` per key. Neither contains a key or value.

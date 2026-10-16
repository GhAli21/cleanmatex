# Skipped on purpose

**Status:** decisions recorded 2026-10-16. Nothing here is forgotten or broken: each item was considered, and not building it now is a decision. Each entry says why, what it would take, the risk of building it carelessly, and when to revisit.
**Owner answers on 2026-10-16:** two items first listed here were reversed by the owner and are now built: **platform-wide per-organization pause** (migration 0631) and **back-fill of the three unmetered demo sends** (migration 0630). They are listed at the end for the record.
**Last verified against source:** 2026-10-16.

---

## 1. Rerouting of queued jobs to another provider

**What it is:** when a provider is paused or its circuit is open, messages that were already queued for it (SMS, WhatsApp and push jobs in Redis) are re-sent through a second provider instead of waiting.

**What happens today:** new commands can fail over to a second provider (failover rules, runbook 09). Jobs already queued are *held*: the worker re-delays them by one minute without using a retry attempt, and they are sent when the provider returns (or the operator resumes).

**Why it is skipped:**
- **Double-send risk.** A queued job may already have been handed to the provider when the circuit opened (the call is in flight, the answer lost). Re-routing it to a second provider sends the customer the same message twice. The queue has no way to know which jobs are "really not sent".
- **No real second provider exists yet** (R13 is kept open by the owner), so there is nothing to reroute to except sandbox connectors.
- **Different capabilities.** A WhatsApp template approved on one provider does not exist on another; an SMS sender ID registered with one carrier is not valid at another. A job built for provider A cannot be mechanically replayed on B.
- Holding is safe: nothing is lost, nothing is duplicated.

**What it would take:**
1. A real second provider per channel with its own approved templates or sender (see `NTF_Guide_To_Add_Second_Provider.md`).
2. A "re-queue as new command" operation that creates a *new* idempotency key, marks the old job as superseded in the dispatch log, and accepts the small double-send window explicitly (or checks the provider's own message status before re-queueing, which only some providers allow).
3. An operator button with a confirmation showing how many jobs will be moved.

**When to revisit:** after a real second provider is chosen and has run in production for a while, and only if an outage showed that "hold until the provider returns" was too slow for the business.

---

## 2. Export and replay endpoints

**What it is:** (a) export the dispatch log or an organization's notification history to a file; (b) replay an old command, sending it again.

**What happens today:** the dispatch log and delivery log are readable through the observability screens and read-only SQL; there is no export button and no replay.

**Why it is skipped:**
- **Replay is a double-send machine.** Sending the same message again to a real customer is almost never what an operator wants; when it is (a message was lost) the existing retry and reconciliation mechanisms already cover it with safeguards (idempotency keys, claim and lease, "retry only proven unsubmitted attempts").
- **Export moves personal data.** A file with recipients and message text leaves the database, the access log and the retention policy. It needs a decision on who may export, what is masked, how long the file lives and where it is stored.
- Neither was asked for by an operator or a customer; both create security obligations.

**What it would take:**
1. Export: a permission (`hq_notifications:export`), recipient masking by default (the dispatch log already stores only a recipient hash), a row limit, an audit entry per export, a time-limited download, and no message bodies unless explicitly requested and justified.
2. Replay: restricted to a single command at a time, only for commands in a proven-unsent state, with a new idempotency key linked to the original, a mandatory reason, an audit entry and the quota and consent checks run again (a customer who opted out since must not receive it).

**When to revisit:** when a customer or an auditor asks for a notification history export, or when support shows a recurring case that retry and reconciliation cannot solve.

---

## 3. Typed item and total template variables

**What it is:** template placeholders for order contents and money, for example the list of items, quantities, line prices and the invoice total in the order-created message (test-matrix rows 19 and 20).

**What happens today:** order notifications carry simple text variables (order number, ready time, customer name and the like). There are no list or money variables.

**Why it is skipped:**
- **Money and lists need a type system, not strings.** A total must come from the persisted invoice, in the right currency and rounding (CleanMateX rule: never rewrite or re-derive money in a presentation layer); a list of items needs bounds (zero, one, many, very long names) and a localized layout per channel (SMS has a length cost, WhatsApp templates have fixed variable slots).
- **WhatsApp templates are fixed.** An approved WhatsApp template has a fixed number of numbered variables; an item list of varying length does not fit without redesigning the template.
- The plan (section 16) specifies the typed-variable system; it is a feature on its own, not a fix.

**What it would take:**
1. The typed-variable registry from plan section 16: variable types (text, date, money, list) with a formatter per type and per locale.
2. A source for each type read from the persisted order and invoice (never recalculated), with currency from the order.
3. Limits for lists (maximum items, "and N more"), tested for zero, one and many items and long Arabic names.
4. Template validation: unknown variable, wrong type, dependency cycle (matrix row 18).
5. WhatsApp: a template redesign and re-approval per provider.

**When to revisit:** when the business asks for itemized or priced notifications; until then the order number plus a link to the order page is enough.

---

## Items first listed here and now built (owner decision 2026-10-16)

| Item | Decision | Where |
|---|---|---|
| Platform-wide per-organization pause | **Build** | Migration `0631_ntf_tenant_pause.sql`; HQ Operations screen section "Paused organizations"; runbook 08; QA scenarios T42–T45. Semantics: commands of a paused organization are refused for good (not held), because holding and replaying on resume is a spam burst. |
| Back-fill of the three unmetered demo sends | **Build** | Migration `0630_ntf_usage_backfill_unmetered_sends.sql` (idempotent, uses the dispatcher's own metering function). |

## Also not built (smaller, for completeness)

- **SMS length limit at send time and per-part billing:** the preview now shows parts, but sending is not blocked and parts are not metered separately: that is a billing-policy decision (does a 3-part SMS cost the organization 3 units?).
- **Real second providers:** kept for later by the owner; see `NTF_Guide_To_Add_Second_Provider.md`.
- **Tenant-timezone formatting for notification types other than `order.created`**, and working-day SLA calculation: no other notification type shows a date today.

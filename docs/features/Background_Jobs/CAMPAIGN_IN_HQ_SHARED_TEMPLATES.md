# Campaign templates set up in HQ for many Organizations

**Status:** deferred by the Owner (24 Nov 2026). Not planned or built. Pick it up only when the Owner asks.

**Related:** [STEP5_PLAN.md](STEP5_PLAN.md) item 4c (WhatsApp campaigns to customers), migration `0819_ntf_campaign_wa_template.sql`.

## The question

Can HQ set up one WhatsApp marketing template once and let every Organization it allows use it in their campaigns?

## How it works today (4c)

- A campaign picks a logical template of the event `campaign.send`.
- HQ sends it through `org_ntf_route_assign_cf`: one ACTIVE route per Organization, template and language (`template_code`, migration 0819). The route pins the provider account, sender and approved provider revision.
- HQ creates and activates each route by hand. Activation checks approval, account, sender and that the provider template is in Meta's MARKETING category.
- So ten Organizations × one template × two languages = twenty routes, made one by one.

## Options

### A. Bulk assign in HQ (recommended)

An HQ action: pick a MARKETING template, then pick the Organizations (a list, or everyone on a plan). HQ creates and activates their `campaign.send` routes in one go. The same action suspends them to take the template away.

- No migration. The send path, the tenant template list and the create-route check stay as they are.
- Every activation check keeps working, because each Organization still has a normal route.
- Small: one HQ endpoint plus one dialog.
- Limit: an Organization that joins later does not get the template until the action runs again.

### B. A platform rule

A new platform table says "template T is available to Organizations that match a rule" (a feature flag, a plan or a list). When an Organization has no route of its own, HQ falls back to that rule.

- New Organizations get the template automatically.
- Costs a migration and a second way of choosing what gets sent: the tenant template list, the create-route check, HQ route resolution and their tests all change.
- Suspending one Organization becomes an exception to the rule.

## Decide first: who sends

A platform template goes out from the platform's WhatsApp number, not the laundry's.

- **Consent:** the customer agreed to marketing from their laundry, but the message arrives from a CleanMateX number.
- **Shared risk:** marketing blocks and reports lower the number's quality rating. If order updates use the same number, one Organization's campaign can throttle order messages for every Organization.
- **Safer setups:** a separate platform sender used only for marketing, or marketing only through each Organization's own WhatsApp number (private routes already support this).

## Open questions for the Owner

1. Should Organizations that join later get the template automatically (B), or is running the assign action again acceptable (A)?
2. Should marketing go from the shared platform number, a separate platform marketing number, or each Organization's own number?

## Not checked

- What Meta's terms say about one WhatsApp number sending marketing for several businesses.

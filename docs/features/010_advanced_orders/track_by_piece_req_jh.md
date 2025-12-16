You need **piece-level records** under each order item. Then QA can reject exactly one piece without guessing with quantities.

# Data model

Create a child table for pieces (pieces):

```sql
-- 1) New table
create table org_order_item_pieces (
  id                uuid primary key default gen_random_uuid(),
  tenant_org_id     uuid not null,
  order_id          uuid not null,
  order_item_id     uuid not null,
  piece_seq          int  not null,            -- 1..quantity
  piece_code         text generated always as (order_id::text || '-' || order_item_id::text || '-' || piece_seq) stored,
  status            text default 'processing',-- intake|processing|qa|ready
  stage             text,
  is_rejected       boolean default false,
  issue_id          uuid,
  rack_location     text,
  last_step         text,                     -- sorting|pretreat|wash|dry|finish
  last_step_at      timestamptz,
  last_step_by      uuid,
  created_at        timestamptz default now(),
  unique (order_item_id, piece_seq)
);

-- 2) Optional fast aggregates on the item row
alter table org_order_items
  add column qty_ready int default 0,
  add column qty_rejected int default 0;

-- 3) Helper view for rollups if you prefer compute-on-read
create view v_order_item_piece_rollup as
select 
  order_item_id,
  count(*) as qty_total,
  count(*) filter (where status='ready' and is_rejected=false) as qty_ready,
  count(*) filter (where is_rejected) as qty_rejected
from org_order_item_pieces
group by order_item_id;
```

Why: your spec already supports **per-piece steps** and a **USE_TRACK_BY_PIECE** flag, so this table operationalizes that design for quantity>1 items (per-piece 5-step UI, item-level list when tracking is enabled)  . QA also already defines **accepted | rejected | accepted_with_immediate_solve** with rejected sending back `qa → processing` and logging `QA_DECISION` and issues, which we apply at the **piece** level now .

# Create pieces on intake

When you insert an order item with `quantity = Q` **and** the service category or tenant setting enables per-piece tracking, expand to pieces 1..Q.

```sql
-- Example trigger
create or replace function cmx_expand_pieces_on_insert()
returns trigger language plpgsql as $$
begin
  if new.quantity is null or new.quantity < 1 then
    raise exception 'quantity must be >=1';
  end if;

  if (select coalesce(USE_TRACK_BY_PIECE, false)
      from tenant_service_category_workflow_cf
      where tenant_org_id = new.tenant_org_id
        and service_category_id = new.service_category_id) then

    for i in 1..new.quantity loop
      insert into org_order_item_pieces(tenant_org_id, order_id, order_item_id, piece_seq, status)
      values (new.tenant_org_id, new.order_id, new.id, i, new.item_status);
    end loop;
  end if;

  return new;
end $$;

create trigger trg_expand_pieces
after insert on org_order_items
for each row execute function cmx_expand_pieces_on_insert();
```

The spec already toggles **per-item list mode** when `USE_TRACK_BY_PIECE=true` .

# QA: reject a single piece

API surface:

* `POST /v1/orders/:id/items/:itemId/pieces/:pieceSeq/reject`

  * body: `{ issue_code, text, photo_url }`
* `POST /v1/orders/:id/items/:itemId/pieces/:pieceSeq/accept`
* Existing generic: `POST /v1/orders/:id/transition` still used for order-level status when needed (e.g., push order back to processing if any piece is rejected) .

Transactional handler:

```sql
-- Pseudocode logic inside service/func
BEGIN;
-- 1) Create issue row
insert into org_order_item_issues(tenant_org_id, order_id, order_item_id, issue_code, issue_text, photo_url, created_by)
values (:t, :orderId, :itemId, :code, :text, :photo, :user)
returning id into :issueId;

-- 2) Flag the piece
update org_order_item_pieces
set is_rejected=true, status='processing', issue_id=:issueId
where order_item_id=:itemId and piece_seq=:pieceSeq;

-- 3) Aggregate up to item
update org_order_items i
set qty_rejected = (select count(*) from org_order_item_pieces u where u.order_item_id=i.id and u.is_rejected),
    item_is_rejected = true
where i.id=:itemId;

-- 4) Aggregate up to order + send back to processing
update org_orders_mst o
set is_rejected = true, current_status='processing', last_transition_at=now(), last_transition_by=:user
where o.id=:orderId;

-- 5) History
insert into org_order_history(tenant_org_id, order_id, action_type, from_value, to_value, payload, done_by)
values (:t, :orderId, 'QA_DECISION', 'qa', 'processing',
        jsonb_build_object('itemId', :itemId, 'pieceSeq', :pieceSeq, 'decision', 'rejected', 'issueId', :issueId),
        :user);
COMMIT;
```

This aligns with your QA rule set and history model for rejections and issue creation  .

# Advancing after rework

Processing staff work per piece using the existing **per-piece 5-step** UI. When a piece is completed, set `status='qa'` or directly `'ready'` after QA acceptance. When **all pieces** of every item are ready and no piece is rejected, auto-transition the order to `ready` (keeping the rack-location validation) . The global rule “if item rejected → order.is_rejected = true; do not auto-complete” still holds until all rejected pieces are resolved .

# UI spec changes

* **Processing screen:** show table of pieces for each item when tracking is on. Each row shows `piece_seq`, current step, done checkbox, split option, and scan input. This matches your per-piece mode and step dropdown .
* **QA screen:** in each item row, expand pieces with `Accepted | Rejected | Accept & Fix Now` radios, note, photo. On reject, call the piece-level endpoint, then optionally trigger the order-level transition to `processing` once the first rejection occurs, per your QA rule .

# Labels and scanning (optional but recommended)

Generate a **piece barcode** for piece tracking:

```
<order_no>-<itemIndex>-<pieceSeq>
```

Print both the item label and piece labels if `USE_TRACK_BY_PIECE=true`. This makes the 5-step and QA flows scan-driven, which your plan already anticipates with per-piece processing steps and rack checks .

# Guardrails

* Only **ROLE_QA** can issue accept/reject at QA; enforce on the piece endpoints and on the `qa → ready / qa → processing` transitions  .
* Always write `org_order_history` entries on piece decisions and transitions .
* Do not allow `ready` if rack location missing, unchanged by piece model .
* Auto-move to `ready` only when all pieces across all items are ready and none rejected, per your existing “auto transition when all done” rule .

# Minimal migration sequence

1. Deploy `org_order_item_pieces` and the trigger to expand pieces for new items.
2. Backfill existing open items: insert pieces 1..quantity for items under processing/qa.
3. Update Processing and QA screens to read **pieces** when `USE_TRACK_BY_PIECE=true`; otherwise keep item-level mode.
4. Add piece endpoints and wire the QA reject action.

This design lets “shirt × 3” become three **pieces** that you can accept or reject independently while staying aligned with your current workflow, QA rules, and history model.

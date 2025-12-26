**CleanMateX Workflow & New Order Implementation Plan**

**0. Objectives**

1.  Make workflow configurable per tenant and per service category.

2.  Make every action auditable.

3.  Make order master and order items always reflect the current state
    so screens can filter fast.

4.  Make New Order UI like the screenshot.

5.  Make it role-based (reception vs prep vs processing vs QA vs
    delivery).

6.  Keep split-orders, issues, and per-piece 5-step processing as
    first-class features.

------------------------------------------------------------------------

**1. Database Layer (Postgres/Supabase)**

**1.1 Workflow definition (global)**

create table sys_workflow_template_cd (

template_id uuid primary key default gen_random_uuid(),

template_code text not null unique, -- WF_STANDARD, WF_ASSEMBLY_QA ...

template_name text,

template_name2 text,

template_desc text,

is_active boolean default true,

rec_order int,

rec_status smallint default 1,

created_at timestamptz default now()

);

create table sys_workflow_template_stages (

id uuid primary key default gen_random_uuid(),

template_id uuid not null references workflow_template_cd(template_id),

stage_code text not null, -- intake, preparing, processing, assembly,
qa, ready, delivered

stage_name text,

stage_name2 text,

stage_type text, -- operational, qa, delivery

seq_no int not null,

is_terminal boolean default false,

is_active boolean default true,

created_at timestamptz default now(),

unique (template_id, stage_code)

);

create table sys_workflow_template_transitions (

id uuid primary key default gen_random_uuid(),

template_id uuid not null references workflow_template_cd(template_id),

from_stage_code text not null,

to_stage_code text not null,

requires_scan_ok boolean default false,

requires_invoice boolean default false,

requires_pod boolean default false,

allow_manual boolean default true,

auto_when_done boolean default false,

is_active boolean default true,

created_at timestamptz default now()

);

Seed 5 templates:

1.  WF_SIMPLE (intake → ready → delivered)

2.  WF_STANDARD (intake → processing → ready → delivered)

3.  WF_ASSEMBLY_QA (intake → processing → assembly → qa → ready →
    delivered)

4.  WF_PICKUP_DELIVERY (intake → processing → ready → out_for_delivery →
    delivered)

5.  WF_ISSUE_REPROCESS (intake → processing → ready → delivered →
    issue_to_solve → reprocess → ready → delivered)

------------------------------------------------------------------------

**1.2 Tenant-level workflow settings**

create table org_tenant_workflow_templates_cf (

id uuid primary key default gen_random_uuid(),

tenant_org_id uuid not null,

template_id uuid not null references workflow_template_cd(template_id),

is_default boolean default false,

allow_back_steps boolean default false,

extra_config jsonb,

is_active boolean default true,

created_at timestamptz default now()

);

create table org_tenant_workflow_settings_cf (

tenant_org_id uuid primary key,

use_preparation_screen boolean default false,

use_assembly_screen boolean default false,

use_qa_screen boolean default false,

track_individual_piece boolean default false,

orders_split_enabled boolean default false

);

**1.3 Per--service-category override**

create table org_tenant_service_category_workflow_cf (

id uuid primary key default gen_random_uuid(),

tenant_org_id uuid not null,

service_category_id uuid not null,

workflow_template_id uuid,

use_preparation_screen boolean,

use_assembly_screen boolean,

use_qa_screen boolean,

track_individual_piece boolean

);

------------------------------------------------------------------------

**1.4 Orders master and items extensions**

alter table org_orders_mst

add column workflow_template_id uuid,

add column current_status text default 'intake',

add column current_stage text,

add column parent_order_id uuid,

add column order_subtype text,

add column is_rejected boolean default false,

add column rejected_from_stage text,

add column issue_id uuid,

add column ready_by_at timestamptz,

add column ready_by_at_new timestamptz,

add column has_split boolean default false,

add column has_issue boolean default false,

add column last_transition_at timestamptz,

add column last_transition_by uuid,

add column is_order_quick_drop boolean default false,

add column quick_drop_quantity int;

alter table org_order_items_dtl

add column item_status text default 'intake',

add column item_stage text,

add column item_is_rejected boolean default false,

add column item_issue_id uuid, -- FK to org_order_item_issues

add column item_last_step text,

add column item_last_step_at timestamptz,

add column item_last_step_by uuid;

**1.5 Item issues + steps**

create table org_order_item_issues (

id uuid primary key default gen_random_uuid(),

tenant_org_id uuid not null,

order_id uuid not null,

order_item_id uuid not null,

issue_code text,

issue_text text,

photo_url text,

priority text,

created_by uuid,

created_at timestamptz default now(),

solved_at timestamptz,

solved_by uuid

);

create table org_order_item_processing_steps (

id uuid primary key default gen_random_uuid(),

tenant_org_id uuid not null,

order_id uuid not null,

order_item_id uuid not null,

step_code text not null, -- sorting, pretreatment, washing, drying,
finishing

step_seq int not null,

done_by uuid,

done_at timestamptz default now(),

notes text

);

**1.6 Canonical order history**

create table org_order_history (

id uuid primary key default gen_random_uuid(),

tenant_org_id uuid not null,

order_id uuid not null,

action_type text not null, -- ORDER_CREATED, STATUS_CHANGE,
FIELD_UPDATE, SPLIT, QA_DECISION, ITEM_STEP, ISSUE_CREATED, ISSUE_SOLVED

from_value text,

to_value text,

payload jsonb,

done_by uuid,

done_at timestamptz default now()

);

------------------------------------------------------------------------

**2. Transition function (DB or Service)**

Create a DB function (or NestJS service equivalent) that enforces
allowed transitions.

Signature:

cmx_order_transition(

p_tenant uuid,

p_order uuid,

p_from text,

p_to text,

p_user uuid,

p_payload jsonb

)

Steps inside:

1.  Resolve order's workflow_template_id.

2.  Check workflow_template_transitions for (template, from, to).

3.  Update org_orders_mst:

    - current_status = p_to

    - current_stage = p_to

    - last_transition_at = now()

    - last_transition_by = p_user

    - if p_to = 'ready' → validate rack_location is not null

4.  Optionally bulk-update items (if order-level)

5.  Insert into org_order_history with action_type='STATUS_CHANGE'

------------------------------------------------------------------------

**3. New Order logic (role-aware)**

**3.1 UI (like screenshot)**

- Tabs = service categories

- Grid = products by category

- Defect/damage row

- Right panel = customer picker, quick drop toggle, Express, notes,
  submit

- Bottom button = "Submit [date] [amount]"

**3.2 Before submit (frontend calls backend helper)**

Endpoint: POST /v1/orders/estimate-ready-by

- input: items, service_category_id, is_quick_drop, quick_drop_quantity

- output: ready_by_at: datetime

This fills the field for receptionist.

**3.3 On submit (backend)**

Pseudo:

if (body.is_order_quick_drop === true &&

(body.items.length === 0 || body.quick_drop_quantity >
body.items.length)) {

// case A: quick drop, missing items

status = 'preparing';

transition = { from: 'intake', to: 'preparing' };

} else {

// case B: normal

status = 'processing';

transition = { from: 'intake', to: 'processing' };

}

create order with current_status = status

create items (if any) with item_status = status (only for case B)

insert history { action_type: 'ORDER_CREATED', to_value: status }

return order_id, current_status, ready_by_at

Do **not** redirect to preparation. Another user may handle it.

**4. Screen behaviors**

**4.1 Preparation / Detailing screen**

Query:

select *

from org_orders_mst

where id = $id

and current_status = 'preparing'

and is_order_quick_drop = true;

User finishes item listing.

On submit:

- intake/preparing → processing

- master: current_status='processing', last_transition_at=now()

- items: item_status='processing'

- history: STATUS_CHANGE

- if SLA recalculated → fill ready_by_at_new

**4.2 Processing / Cleaning screen**

Two data sources:

1.  Order-level list:

select *

from org_orders_mst

where current_status = 'processing';

2.  Item-level list (if track_individual_piece=true):

select o.id as order_id, i.*

from org_orders_mst o

join org_order_items i on i.order_id = o.id

where o.tenant_org_id = $tenant

and i.item_status = 'processing';

UI elements:

- per-piece 5-step dropdown

- done checkbox

- split checkbox

- rack location on master

On submit:

- "done" → update item, insert history ITEM_STEP or ITEM_DONE

- "split" → create suborder, move items, set master.has_split=true,
  history SPLIT

- after all items ready → auto transition master to ready (but check
  rack_location not null)

**4.3 Assembly screen**

Shown if:

- tenant_workflow_settings_cf.use_assembly_screen = true

- OR service category override = true

- AND order.current_status = 'assembly'

Submit:

- if QA enabled → transition assembly → qa

- else → assembly → ready

- update master/items

- history

**4.4 QA screen**

UI:

- list of ready-for-QA items/orders

- radio: accepted / rejected / accepted_with_immediate_solve

- note box

- photo optional

Actions:

- accepted → qa → ready

- rejected → qa → processing, set is_rejected=true, create issue row if
  needed

- accepted_with_immediate_solve → qa → ready, add note

All write to history: QA_DECISION.

**4.5 Ready screen**

Query:

select *

from org_orders_mst

where current_status = 'ready';

Buttons:

- Deliver → ready → delivered

- Return to processing (if issue) → ready → processing, set
  has_issue=true

- Collect payment (if outstanding)

------------------------------------------------------------------------

**5. Role-based access**

Define roles:

- ROLE_RECEPTION

- ROLE_PREPARATION

- ROLE_PROCESSING

- ROLE_QA

- ROLE_DELIVERY

- ROLE_ADMIN

Map screens:

  --------------------------------------------
  **Screen**            **Roles allowed**
  --------------------- ----------------------
  New Order             RECEPTION, ADMIN

  Preparation           PREPARATION, ADMIN

  Processing/Cleaning   PROCESSING, ADMIN

  Assembly              PROCESSING, ADMIN

  QA                    QA, ADMIN

  Ready / Handover      RECEPTION, DELIVERY,
                        ADMIN

  Workflow templates    ADMIN
  --------------------------------------------

Backend must check role on every transition. Example rules:

- intake → preparing allowed for RECEPTION, PREPARATION

- preparing → processing allowed for PREPARATION

- processing → ready allowed for PROCESSING

- qa → ready allowed for QA

- ready → delivered allowed for RECEPTION, DELIVERY

------------------------------------------------------------------------

**6. APIs (NestJS style)**

1.  POST /v1/orders

    - create order (logic above)

    - returns order with current_status, ready_by_at

2.  GET /v1/orders/:id/state

    - returns: current_status, allowed_transitions, flags
      (preparation/assembly/qa), is_quick_drop

3.  POST /v1/orders/:id/transition

    - body: { to_status, reason?, payload? }

    - calls cmx_order_transition(...)

    - writes history

4.  POST /v1/orders/:id/items/:itemId/step

    - body: { step_code, notes }

    - inserts into org_order_item_processing_steps

    - updates item

    - inserts history

5.  POST /v1/orders/:id/split

    - body: { item_ids: [...], reason }

    - creates suborder

    - updates master.has_split

    - history: SPLIT

6.  POST /v1/orders/:id/issue

    - body: { issue_code, text, action }

    - create issue row

    - do transition if action=return_to_stage

    - history: ISSUE_CREATED

7.  GET /v1/orders/:id/history

    - returns timeline for UI

------------------------------------------------------------------------

**7. Frontend (Flutter / Next.js) tasks**

1.  **NewOrderScreen**

    - tabs by category

    - grid by product

    - defects row

    - summary panel

    - quick drop toggle

    - call /v1/orders on submit

2.  **OrdersListScreen**

    - filter by status

    - show badge for rejected / has_issue / has_split

3.  **OrderPreparationScreen**

    - show only quick-drop intake orders

    - item entry form

    - send to processing

4.  **OrderProcessingScreen**

    - table/list of orders or items

    - per item 5 steps

    - done/split

    - auto-move to ready when all ready

5.  **AssemblyScreen** (conditional)

6.  **QAScreen** (conditional)

7.  **ReadyScreen** with rack-location check

8.  **OrderHistoryWidget** to show timeline

------------------------------------------------------------------------

**8. Validation rules to enforce**

1.  ready_by_at must be set **before** saving new order.

2.  If current_status='ready' then rack_location is not null.

3.  If is_order_quick_drop=true and items not entered → status must stay
    in preparing.

4.  If item rejected → order.is_rejected = true.

5.  If any suborder not ready → main order must not auto-complete.

------------------------------------------------------------------------

**9. Testing checklist**

- Create normal order → status = processing → history has ORDER_CREATED.

- Create quick drop empty → status = preparing → history has
  ORDER_CREATED.

- Prepare order → status = processing → items = processing → history
  STATUS_CHANGE.

- Processing items, mark all done → master moves to ready → history
  STATUS_CHANGE.

- QA rejects one item → item_is_rejected = true, order.is_rejected =
  true, order back to processing.

- Split item → suborder created, parent.has_split = true, history SPLIT.

- Deliver order with missing rack_location → must fail.

------------------------------------------------------------------------

**10. Delivery order (driver) alignment**

Later, when using template WF_PICKUP_DELIVERY, add:

- status out_for_delivery

- transition ready → out_for_delivery (delivery role)

- transition out_for_delivery → delivered with POD

The same history table works.

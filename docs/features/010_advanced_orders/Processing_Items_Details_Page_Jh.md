plan to enhance processing page:
- when click edit button show processing details window:
Processing Detail Page:

**File**: `web-admin/app/dashboard/processing/[id]/page.tsx`
show it as a window not another route like this @docs/features/010_advanced_orders/Order_UI_Samples/Cleaning/Processing_on_click_edit_cleaning_window_02.JPG  ,  

Per-item controls:
- in this screen the user will see all pending/ready to process orders items details.
- if the record is rejected to solve an issue it should be with special color.

- 5-step dropdown (sorting, pretreatment, washing, drying, finishing): this is an optional list without any effect just informative. In-front of each piece a drop down list to implement follow these five steps sorting, pre-treatment Stains, washing, drying, and folding/ironingIn-front of each piece a drop down list to implement follow these five steps sorting, pre-treatment Stains, washing, drying, and folding/ironing
- Ready/Done checkbox: A checkbox In-front of each piece to specify its finished/cleaned/processed when they finish Processing/Cleaning he can click the check box
- Split checkbox: Another checkbox In-front of each piece to click if want to split-order to move it to new order(sub-order) automatically (that new order will contain the main order number and sub-type is split-suborder).
- Rack location input (for order)

Per- All Items down:
- Update Button to update all ready checked items to status ready in order items.
- if the user choose one or more items to be splited in new sub-order then split button should appear when pressed invoke creating new sup-order child contains all checked items in one order.

Actions:
- Record step: `/api/v1/orders/[id]/items/[itemId]/step`
- Mark done: `/api/v1/orders/[id]/items/[itemId]/complete`
- Split: `/api/v1/orders/[id]/split`
- Auto-transition to READY when all items done + rack_location set

you can see also @docs/features/010_advanced_orders/PRD-010_Advanced_Orders_Complete_Implementation_Plan_Cursor_Jh.md , @docs/features/010_advanced_orders/prd-010-advanced-orders-implementation-db7e1337.plan.md  


-------

Notes from me:
- this screen should show items in its pieces quantity:  a row for each piece, if item have quantity 3 then here will be 3 rows.
- Lets say this screen will show items then when user click on that row lets say a button named (Pieces) then a detail grid of rows total equal item quantity:
- in each piece row the check boxes and note field...so on

Answers To Your questions:

1. Processing Step Workflow
From the PRD, you mentioned a 5-step dropdown (sorting, pretreatment, washing, drying, finishing). Should:
- this is an optional list without any effect just informative.
- Users be able to select any step from the list freely.
- The step be recorded only when clicking "Update".

2. Split Order Behavior
When a user checks the "Split" checkbox for items: for each piece, if item have quantity 3 then here will be 3 rows:
- Should there be a confirmation dialog before creating the split order? Yes
- Yes have we must reason/notes field for why items are being split, should be implemented if not exist. 
- Yes the split should happen when clicking a "Split Order" button.

3. Ready/Done Checkbox Logic
- Can an item piece be marked as "Ready/Done" without completing all 5 processing steps? Yes this list just informative no effect.

4. Rejected Items Display
You mentioned rejected items should show in a special color. Should:
- Rejected items be editable in this modal? Yes
- There be a way to "un-reject" items from this screen? Yes
- They appear at the top/bottom of the list or mixed with other items? Top Or Put a filter bar put in it a checkbox for Show Rejected-On-Top

5. Modal Layout Preference
Looking at the screenshot reference, would you prefer:
- A table layout (like the screenshot shows) for the items list?
Yes, this screen should show items in its pieces quantity:  a row for each piece, if item have quantity 3 then here will be 3 rows, Lets say this screen will show items then when user click on that row lets say a button named (Pieces) then a detail grid of rows total equal item quantity, in each piece row the check boxes and note field...so on
- Maximum width for the modal (e.g., max-w-6xl, max-w-7xl)? about two-thirds the width of the viewport (excluding the navigation/sidebar on the left). Based on typical Tailwind modal usage for complex forms/data, max-w-5xl is a very strong candidate, with max-w-4xl also being plausible depending on the specific design system's scaling.
- Fixed height with scrollable content, fill the available vertical space and allow its content to scroll if necessary. with close/return button.

6. Update Button Behavior
When clicking "Update":
- Should it save ALL changes (steps, ready status, rack location) at once? Yes
- Should the modal close after successful update? No Show down a summary message for what happened and he can close by click close/return button.

7. Rack Location
- Is rack location required before marking the order as READY? No
- Should rack location be at the order level or per-item level? both per-item level and order-level, its a text field.
- Is there a predefined list of rack locations or free text input? free text input.

Please provide answers to these questions so I can create a precise implementation plan that matches your exact requirements.

---------------------
Check if this tenant setting 'USING_SPLIT_ORDER' is true
SELECT fn_is_setting_allowed('11111111-1111-1111-1111-111111111111','USING_SPLIT_ORDER');

Check if this tenant setting 'USE_REJECT_TO_SOLVE' is true to allow/show all reject feature things or not 
SELECT fn_is_setting_allowed('11111111-1111-1111-1111-111111111111','USE_REJECT_TO_SOLVE');

Check if this tenant setting 'USE_TRACK_BY_PIECE' is true

check in tenant setting for 'REJECT_ROW_COLOR'
SELECT fn_get_setting_value('11111111-1111-1111-1111-111111111111','REJECT_ROW_COLOR');

use fn_get_setting_value(
  p_tenant_org_id uuid,
  p_setting_code  text
)
fn_is_setting_allowed(
  p_tenant_org_id uuid,
  p_setting_code  text
)
-- Boolean example
SELECT fn_get_setting_value('11111111-2222-3333-4444-555555555555','USING_SPLIT_ORDER');
-- → {"value": true, "type": "BOOLEAN", "is_active": true, "source": "system"}

-- Text example
SELECT fn_get_setting_value('11111111-1111-1111-1111-111111111111','REJECT_ROW_COLOR');
-- → {"value": "#10B981", "type": "TEXT", "is_active": true, "source": "system"}

-- Shortcut boolean
SELECT fn_is_setting_allowed('11111111-2222-3333-4444-555555555555','USING_SPLIT_ORDER');
-- → true

------

Check if this tenant setting 'USING_SPLIT_ORDER' is true to allow/show all split feature things or not 
SELECT fn_is_setting_allowed(tenant_org_id,'USING_SPLIT_ORDER');

Check if this tenant setting 'USE_REJECT_TO_SOLVE' is true to allow/show all reject feature things or not 
SELECT fn_is_setting_allowed(tenant_org_id,'USE_REJECT_TO_SOLVE');

- Add ability for reject to allow user to reject piece/item, check box, note .. so on.

Check if this tenant setting 'USING_SPLIT_ORDER' is true to allow/show all split feature things or not 
SELECT fn_is_setting_allowed(tenant_org_id,'USING_SPLIT_ORDER');

Check if this tenant setting 'USE_TRACK_BY_PIECE' is true then allow per piece otherwise only per item 
SELECT fn_is_setting_allowed(tenant_org_id,'USE_TRACK_BY_PIECE');

in 8.3 Update Logic: also add column in org_order_items_dtl name it quantity_ready to update it with number of ready pieces

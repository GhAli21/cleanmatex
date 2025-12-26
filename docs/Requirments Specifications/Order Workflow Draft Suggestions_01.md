
#jhapp/cleanmatex/docs/

Draft Suggestion for customize the Order Workflow and STATUS_TRANSITIONS:

- Workflow setup/settings/configuration:
I want to setup default workflows and workflows depend on features buying or given with the plan.. so on.

If Use ASSEMBLY=false THEN
....
If Use QUALITY_CHECK=false THEN
....
if Use DELIVERY=false THEN
....
if Use INTAKE=false THEN
....
if Use intake and itemizing and sorting in one shot =true THEN
and so on...
- List Of Main Service Categories/Sections:
Dry Cleaning: Item will have different workflow, such as(include wash, drying, ironing,...so on).
Laundry: Item will have different workflow.
Pressed / Ironed: Item will have different workflow, such as start processing from Ironing not wash... so on.
Repairs: Item will have different workflow,
Alterations: Item will have different workflow,

If the Item in the Order has This service,
 the Order Status Workflow STATUS_TRANSITIONS and ORDER_STATUS should have different flow depending on/based on:
- main service category and tenant features limits for service types:
- IS USSING ASSEMBLY, true/false.
- IS USING QUALITY_CHECK, true/false.
- IS USING DELIVERY, true/false.



** Workflow & Status Management Types:= ** F:\jhapp\cleanmatex\web-admin\lib\types\workflow.ts
Utility Functions
Should Be from database from workflow configurations;



===================

Page-by-Page Transition Code:
0. Create New Order:
toStatus='processing' or 'intake'
current_status='processing'
current_stage='intake'

File: F:\jhapp\cleanmatex\web-admin\lib\services\order-service.ts 
static async createOrder: 71


---

1. Ready Page → Delivered
File: web-admin/app/dashboard/ready/[id]/page.tsx:59-82
const handleDeliver = async () => {

---

2. Processing Page → Ready 
pre status=''
toStatus: 'ready',
File: web-admin/app/dashboard/processing/[id]/page.tsx:113-145
const handleMarkReady = async () => {
Trigger: "Mark Order Ready" button (line 430)

---

3. Processing Table → Ready (Quick Action)
toStatus: 'ready',
File: web-admin/app/dashboard/processing/components/processing-table.tsx:385-430
const handleConfirm = async () => {
Trigger: "Mark Ready" quick action in table (line 326)


---

4. Assembly Page → QA
toStatus: 'qa',
File: web-admin/app/dashboard/assembly/[id]/page.tsx:63-87
const handleAssemble = async (
Trigger: "Complete Assembly" button (line 154)


---

5. QA Page → Ready (Accept)
toStatus: 'ready',
File: web-admin/app/dashboard/qa/[id]/page.tsx:63-86
const handleAccept = async () => {
Trigger: "Accept All Items" button (line 200)


---

6. QA Page → Processing (Reject)
toStatus: 'processing',
File: web-admin/app/dashboard/qa/[id]/page.tsx:88-125
const handleReject = async (itemId: 
await fetch(`/api/v1/orders/${params.id}/issue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderItemId: itemId,
          issueCode: 'other',
          issueText: reason,
          priority: 'high',
        }),
      });
Trigger: "✗ Reject" button per item (line 182)



---

7. Preparation Page → Sorting
Note: ⚠️ Uses direct Prisma update instead of WorkflowService - should be refactored

File: web-admin/app/api/v1/preparation/[id]/complete/route.ts:52-61
status: 'sorting'
// Complete preparation using domain logic
await completePreparation(tenantId, orderId, user.id, {

in F:\jhapp\cleanmatex\web-admin\lib\db\orders.ts
preparation_status: 'completed',
status: 'processing',

In await completePreparation(tenantId, orderId, user.id, {
await prisma.org_orders_mst.update({
      where: { id: orderId, tenant_org_id: tenantId },
      data: { status: 'sorting' },
    });

---

8. All Orders Page → Any Status
F:\jhapp\cleanmatex\web-admin\app\dashboard\orders\components\orders-simple-table.tsx
Wrong File: web-admin/app/dashboard/orders/components/order-actions.tsx:86-127
//toStatus: selectedStatus,
//const handleConfirmChange = async () => {
//Trigger: Status change buttons (lines 144-181)

Should be refactor to use API and pagination from API also


---
===============

- Workflow Service Implementation:
File: web-admin/lib/services/workflow-service.ts:28-113
static async changeStatus(



===============

Important Notes Or TODO:
- ready-by-calculator:
F:\jhapp\cleanmatex\web-admin\lib\utils\ready-by-calculator.ts
This Should be from Tenant/Branch settings :
const PRIORITY_MULTIPLIERS: Record<Priority, number> = {
  normal: 1.0,
  urgent: 0.7,
  express: 0.5,
};

This Should be from Tenant/Branch settings :
export const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  open: 9,
  close: 18,
  workingDays: [1, 2, 3, 4, 5, 6], // Mon-Sat
};

- Workflow & Status Management Types:
F:\jhapp\cleanmatex\web-admin\lib\types\workflow.ts
Utility Functions
Should Be from database from workflow configurations;

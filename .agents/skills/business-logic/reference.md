> Combined from `@.claude/docs/business_logic.md` and `@.claude/docs/04-business-logic.md` on 2025-10-17

# Business Logic & Workflows

## Order Lifecycle
DRAFT → INTAKE → PREPARATION → SORTING → WASHING → DRYING → FINISHING → ASSEMBLY → QA → PACKING → READY → OUT_FOR_DELIVERY → DELIVERED → CLOSED

## Workflow Customization
Driven by tenant features, service category, and explicit step rules. Store config in `org_workflow_settings_cf` with `workflow_steps` and `status_transitions` JSONB.

## Quality Gates
Gate to READY requires:
- All items assembled
- QA passed
- No unresolved issues


---

## 📄 CRITICAL BUSINESS LOGIC

### Order Workflow States

**Complete Order Lifecycle**:

```
DRAFT
  ↓
INTAKE          ← Customer creates order / Staff receives items
  ↓
PREPARATION     ← Items tagged, photographed, noted
  ↓
SORTING         ← Sorted by fabric type, color, service type
  ↓
WASHING         ← Main wash cycle
  ↓
DRYING          ← Drying process
  ↓
FINISHING       ← Ironing, pressing, folding
  ↓
ASSEMBLY        ← Items grouped back together per order
  ↓
QA              ← Quality check gate (CRITICAL)
  ↓
PACKING         ← Bagging, tagging, receipt attachment
  ↓
READY           ← Ready for pickup/delivery
  ↓
OUT_FOR_DELIVERY ← Driver en route
  ↓
DELIVERED       ← Customer received items
  ↓
CLOSED          ← Order archived, feedback collected
```

---

## Workflow Customization

**Workflows must be configurable based on**:

### 1. Tenant Features (from subscription plan)
```typescript
interface TenantFeatures {
  useIntake: boolean;
  useAssembly: boolean;
  useQualityCheck: boolean;
  useDelivery: boolean;
  useSorting: boolean;
}
```

### 2. Service Category
- **Dry Cleaning**: Full workflow (wash → dry → iron → QA)
- **Laundry**: Full workflow with different settings
- **Pressed/Ironed**: Start from FINISHING (skip wash/dry)
- **Repairs**: Custom workflow (intake → repair → QA → ready)
- **Alterations**: Custom workflow (intake → alteration → QA → ready)

### 3. Workflow Logic Implementation
```typescript
// Example logic
function getWorkflowForTenant(tenant: Tenant, serviceCategory: string): string[] {
  let workflow = DEFAULT_WORKFLOW;
  
  if (!tenant.useIntake) {
    workflow = workflow.filter(step => step !== 'INTAKE');
  }
  
  if (!tenant.useAssembly) {
    workflow = workflow.filter(step => step !== 'ASSEMBLY');
  }
  
  if (serviceCategory === 'PRESSED_IRONED') {
    workflow = workflow.slice(workflow.indexOf('FINISHING'));
  }
  
  return workflow;
}
```

---

## Database Implementation

```sql
-- Store workflow configuration
CREATE TABLE org_workflow_settings_cf (
  tenant_org_id UUID NOT NULL,
  service_category_code VARCHAR(30) NOT NULL,
  workflow_steps JSONB NOT NULL,
  -- Example: ["INTAKE", "PREPARATION", "WASHING", ...]
  status_transitions JSONB NOT NULL,
  -- Example: {"INTAKE": ["PREPARATION", "CANCELLED"], ...}
  is_active BOOLEAN DEFAULT true,
  PRIMARY KEY (tenant_org_id, service_category_code)
);
```

---

## Quality Gates (CRITICAL)

**Orders CANNOT progress to READY status without**:

1. ✅ **Assembly completeness check** - All items accounted for
2. ✅ **QA pass** - Quality inspection completed
3. ✅ **Customer instructions** - Special requests addressed

### Implementation
```typescript
async function canMoveToReady(orderId: string): Promise<{
  canMove: boolean;
  blockers: string[];
}> {
  const order = await getOrderWithItems(orderId);
  const blockers: string[] = [];
  
  // Check 1: All items assembled
  const unassembled = order.items.filter(item => 
    item.status !== 'ASSEMBLED' && item.status !== 'QA_PASSED'
  );
  if (unassembled.length > 0) {
    blockers.push(`${unassembled.length} items not assembled`);
  }
  
  // Check 2: QA completed
  const failedQA = order.items.filter(item => 
    item.qa_status === 'FAILED' || !item.qa_status
  );
  if (failedQA.length > 0) {
    blockers.push(`${failedQA.length} items failed QA`);
  }
  
  // Check 3: Pending issues
  const pendingIssues = order.items.filter(item => 
    item.issues?.length > 0 && !item.issues_resolved
  );
  if (pendingIssues.length > 0) {
    blockers.push(`${pendingIssues.length} items have unresolved issues`);
  }
  
  return {
    canMove: blockers.length === 0,
    blockers
  };
}
```

---

## Pricing Calculation

### Basic Pricing Structure
```typescript
interface PricingRule {
  tenant_org_id: string;
  service_type: string;      // 'wash_iron', 'dry_clean', 'iron_only'
  garment_type: string;      // 'shirt', 'suit', 'dress'
  base_price: number;
  express_multiplier: number; // 1.5 for express service
  bulk_discount?: {
    min_quantity: number;
    discount_percent: number;
  }[];
}

function calculateItemPrice(item: OrderItem, rules: PricingRule[]): number {
  const rule = rules.find(r => 
    r.service_type === item.service_type &&
    r.garment_type === item.garment_type
  );
  
  if (!rule) throw new Error('No pricing rule found');
  
  let price = rule.base_price;
  
  // Apply express charge
  if (item.is_express) {
    price *= rule.express_multiplier;
  }
  
  // Apply bulk discount
  if (rule.bulk_discount && item.quantity >= rule.bulk_discount[0].min_quantity) {
    const discount = rule.bulk_discount[0].discount_percent;
    price *= (1 - discount / 100);
  }
  
  return price * item.quantity;
}
```

---

## Customer Engagement Levels

### Progressive Customer Profiles

1. **Guest** - No registration, order by phone only
2. **Stub Profile** - Phone number only, basic tracking
3. **Full Profile** - Complete registration, app access, loyalty points

```typescript
enum CustomerLevel {
  GUEST = 'GUEST',           // Anonymous order
  STUB = 'STUB',             // Phone only
  REGISTERED = 'REGISTERED'  // Full profile
}

interface CustomerProgression {
  canUpgrade(from: CustomerLevel, to: CustomerLevel): boolean;
  upgradeIncentive(level: CustomerLevel): string;
  features(level: CustomerLevel): string[];
}
```

---

## Return to [Main Documentation](../CLAUDE.md)

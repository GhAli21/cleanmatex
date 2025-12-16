# PRD-010: Advanced Orders - Implementation Plan
# Educational Guide for Solo Developer

**Document Version**: 1.0  
**Last Updated**: November 1, 2025  
**Estimated Duration**: Week 11 (5 days)  
**Difficulty**: ⭐⭐⭐⭐ Advanced  
**Prerequisites**: PRD 001-009 completed

---

## 📚 **WHAT YOU'LL LEARN**

### Technical Skills
- ✅ Complex order relationships (parent-child)
- ✅ Database transactions (ACID principles)
- ✅ Workflow branching logic
- ✅ Order splitting algorithms
- ✅ Issue ticketing system
- ✅ SLA (Service Level Agreement) tracking
- ✅ Cascading updates

### Business Logic
- ✅ Order split & merge
- ✅ Pre-delivery vs Post-delivery issues
- ✅ Quick solve vs Re-process workflows
- ✅ Customer notification strategies
- ✅ Financial impact tracking

---

## 🎯 **BUSINESS GOAL**

Implement advanced order management features to handle:
1. **Split Orders**: Customer picks up partial order
2. **Issue Resolution**: Handle problems before/after delivery
3. **Quick Solve**: Fast fixes (credit, re-do single item)
4. **Re-process**: Send order back through workflow

**Example Scenarios:**

```
Scenario 1: Customer Picks Up Early
Customer: "I need 2 shirts now, rest can wait"
Action: Split order → Invoice partial → Release
Result: 2 orders (released + pending)

Scenario 2: Pre-Delivery Issue
Staff: "One shirt is damaged in processing"
Action: Create issue → Quick solve (re-do shirt) OR remove from order
Result: Customer notified, SLA adjusted

Scenario 3: Post-Delivery Issue
Customer: "My shirt came back with stain"
Action: Create issue → Re-process (bring back) OR Credit/Refund
Result: Issue tracked, satisfaction maintained
```

---

## 🗄️ **DAY 1: DATABASE SCHEMA (4-5 hours)**

### Understanding Order Hierarchy

```
Order Relationships:

Parent Order #1001
├─ Child Order #1001-A (Split 1)
└─ Child Order #1001-B (Split 2)

OR

Parent Order #2001 (Main)
└─ Re-process Order #2001-R1 (Issue resolution)
    └─ Re-process Order #2001-R2 (Second attempt)
```

### Step 1.1: Update Order Model

**File**: `apps/api/prisma/schema.prisma`

```prisma
model Order {
  id              String   @id @default(uuid())
  tenantId        String
  
  // Order identification
  orderNumber     String   // Main: "ORD-2024-001", Split: "ORD-2024-001-A"
  
  // 🔗 Parent-Child Relationship
  parentOrderId   String?  // Link to parent if this is split/reprocess
  childOrders     Order[]  @relation("OrderHierarchy")
  parentOrder     Order?   @relation("OrderHierarchy", fields: [parentOrderId], references: [id])
  
  // Order type
  orderType       OrderType @default(STANDARD)
  splitReason     String?   @db.Text // Why split?
  
  // ... existing fields (customer, status, pricing, etc.)
  
  // Financial tracking
  originalTotal   Decimal?  @db.Decimal(10, 2) // Parent order total
  
  // Split/merge tracking
  isSplit         Boolean   @default(false)
  splitCount      Int       @default(0)
  splitAt         DateTime?
  splitBy         String?
  
  // Relationships
  issues          Issue[]
  
  @@index([parentOrderId])
  @@index([tenantId, orderNumber])
  @@map("org_orders_mst")
}

// 🎫 Issue Tracking System
model Issue {
  id              String   @id @default(uuid())
  tenantId        String
  orderId         String
  
  // Issue identification
  issueNumber     String   // "ISS-2024-00123"
  title           String
  description     String   @db.Text
  description2    String?  @db.Text // Arabic
  
  // Classification
  issueType       IssueType
  category        IssueCategory
  severity        IssueSeverity @default(MEDIUM)
  phase           IssuePhase // PRE_DELIVERY, POST_DELIVERY
  
  // Assignment
  reportedBy      String   // User/Customer who reported
  assignedTo      String?  // Staff handling
  
  // Status tracking
  status          IssueStatus @default(OPEN)
  resolution      IssueResolution?
  
  // SLA tracking
  createdAt       DateTime @default(now())
  acknowledgedAt  DateTime?
  resolvedAt      DateTime?
  closedAt        DateTime?
  slaTarget       DateTime? // When should this be resolved?
  slaBreached     Boolean   @default(false)
  
  // Solution details
  solution        String?   @db.Text
  solution2       String?   @db.Text
  
  // Financial impact
  refundAmount    Decimal?  @db.Decimal(10, 2)
  creditIssued    Decimal?  @db.Decimal(10, 2)
  
  // Evidence
  photos          Json?     @db.JsonB // Array of photo URLs
  attachments     Json?     @db.JsonB // Other files
  
  // Customer communication
  customerNotified Boolean  @default(false)
  notificationSentAt DateTime?
  
  // Re-process tracking
  reprocessOrderId String?  // If created new order
  reprocessOrder   Order?   @relation("IssueReprocess", fields: [reprocessOrderId], references: [id])
  
  // Relations
  tenant          Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  order           Order    @relation(fields: [orderId], references: [id])
  history         IssueHistory[]
  
  @@unique([tenantId, issueNumber])
  @@index([orderId, status])
  @@index([assignedTo, status])
  @@map("org_issues")
}

// 📝 Issue History (Audit Trail)
model IssueHistory {
  id          String   @id @default(uuid())
  issueId     String
  
  action      IssueAction
  comment     String?  @db.Text
  
  // State change
  fromStatus  String?
  toStatus    String?
  
  // Who did it
  performedBy String
  performedAt DateTime @default(now())
  
  // Data changes (JSON diff)
  changes     Json?    @db.JsonB
  
  // Relations
  issue       Issue    @relation(fields: [issueId], references: [id], onDelete: Cascade)
  
  @@index([issueId])
  @@map("org_issue_history")
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ENUMS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

enum OrderType {
  STANDARD       // Normal order
  SPLIT          // Child of split order
  REPROCESS      // Re-processing after issue
  QUICK_DROP     // Quick drop (itemized later)
}

enum IssueType {
  QUALITY        // Quality problem (stain, damage)
  MISSING_ITEM   // Item missing
  WRONG_ITEM     // Wrong item delivered
  LATE_DELIVERY  // SLA breach
  CUSTOMER_COMPLAINT // General complaint
  DAMAGE         // Damaged item
  COLOR_BLEED    // Color bleeding
  SHRINKAGE      // Item shrank
  INCOMPLETE     // Incomplete service
  OTHER          // Other issues
}

enum IssueCategory {
  TECHNICAL      // Process/equipment issue
  OPERATIONAL    // Staff/workflow issue
  CUSTOMER       // Customer-caused (forgot item, etc.)
  EXTERNAL       // Third-party (driver, supplier)
}

enum IssueSeverity {
  LOW            // Minor inconvenience
  MEDIUM         // Standard issue
  HIGH           // Significant problem
  CRITICAL       // Urgent, blocking
}

enum IssuePhase {
  PRE_DELIVERY   // Before order delivered
  POST_DELIVERY  // After order delivered
}

enum IssueStatus {
  OPEN           // Just created
  ACKNOWLEDGED   // Staff aware
  IN_PROGRESS    // Being handled
  PENDING_CUSTOMER // Waiting for customer response
  RESOLVED       // Fixed, waiting confirmation
  CLOSED         // Fully closed
  CANCELLED      // Cancelled/invalid
}

enum IssueResolution {
  QUICK_SOLVE    // Fast fix (credit/single redo)
  REPROCESS      // Full re-process
  REFUND         // Money back
  CREDIT         // Store credit
  REPLACEMENT    // Replace item
  NO_ACTION      // No action needed
  CUSTOMER_ERROR // Customer's mistake
}

enum IssueAction {
  CREATED
  ASSIGNED
  STATUS_CHANGED
  COMMENTED
  RESOLVED
  CLOSED
  REOPENED
  CUSTOMER_NOTIFIED
}
```

---

### Step 1.2: Create Migration

```bash
cd apps/api
npx prisma migrate dev --name add_advanced_orders

# This will:
# - Add parentOrderId to orders
# - Create issues table
# - Create issue_history table
# - Add all enums
```

---

## 🚀 **DAY 2: ORDER SPLITTING LOGIC (5-6 hours)**

### Concept: Order Splitting

**What happens when order splits:**
1. Original order becomes "parent"
2. Two child orders created (A, B)
3. Items distributed between children
4. Each child has own workflow
5. Each child can be invoiced separately
6. Parent order marked as "split" (archived)

### Step 2.1: Split Service

**File**: `apps/api/src/orders/order-split.service.ts`

```typescript
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class OrderSplitService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Split order into multiple child orders
   * 
   * @param orderId - Parent order ID
   * @param splits - Array of item distributions
   * @param reason - Why splitting
   * 
   * Example:
   * splits = [
   *   { itemIds: ['item1', 'item2'], label: 'Early Pickup' },
   *   { itemIds: ['item3', 'item4'], label: 'Regular Pickup' }
   * ]
   */
  async splitOrder(
    orderId: string,
    splits: Array<{ itemIds: string[]; label?: string }>,
    reason: string,
    userId: string,
  ) {
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 1: Validate parent order
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    const parentOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: true,
        customer: true,
      },
    });

    if (!parentOrder) {
      throw new NotFoundException('Order not found');
    }

    if (parentOrder.isSplit) {
      throw new BadRequestException('Order already split');
    }

    if (parentOrder.status === 'DELIVERED' || parentOrder.status === 'CANCELLED') {
      throw new BadRequestException('Cannot split delivered or cancelled order');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 2: Validate items distribution
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    const allItemIds = parentOrder.items.map(item => item.id);
    const splitItemIds = splits.flatMap(s => s.itemIds);
    
    // Check: All items accounted for
    const missingItems = allItemIds.filter(id => !splitItemIds.includes(id));
    if (missingItems.length > 0) {
      throw new BadRequestException('All items must be assigned to a split');
    }
    
    // Check: No duplicate items
    const uniqueItems = new Set(splitItemIds);
    if (uniqueItems.size !== splitItemIds.length) {
      throw new BadRequestException('Items cannot appear in multiple splits');
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 3: Use database transaction (CRITICAL!)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    const childOrders = await this.prisma.$transaction(async (tx) => {
      // Mark parent as split
      await tx.order.update({
        where: { id: orderId },
        data: {
          isSplit: true,
          splitCount: splits.length,
          splitAt: new Date(),
          splitBy: userId,
          splitReason: reason,
          status: 'SPLIT', // New status: archived
        },
      });

      // Create child orders
      const children = [];
      
      for (let i = 0; i < splits.length; i++) {
        const split = splits[i];
        const splitLabel = split.label || `Split ${String.fromCharCode(65 + i)}`; // A, B, C...
        
        // Get items for this split
        const itemsForSplit = parentOrder.items.filter(item =>
          split.itemIds.includes(item.id),
        );
        
        // Calculate totals for this split
        const subtotal = itemsForSplit.reduce(
          (sum, item) => sum + Number(item.total),
          0,
        );
        const tax = subtotal * 0.05; // 5% VAT
        const total = subtotal + tax;
        
        // Generate child order number
        const childOrderNumber = `${parentOrder.orderNumber}-${String.fromCharCode(65 + i)}`;
        
        // Create child order
        const childOrder = await tx.order.create({
          data: {
            tenantId: parentOrder.tenantId,
            branchId: parentOrder.branchId,
            customerId: parentOrder.customerId,
            parentOrderId: parentOrder.id,
            orderNumber: childOrderNumber,
            orderType: 'SPLIT',
            splitReason: splitLabel,
            
            // Copy parent settings
            status: parentOrder.status === 'READY' ? 'READY' : 'IN_PROCESS',
            priority: parentOrder.priority,
            
            // Financial
            subtotal,
            tax,
            total,
            originalTotal: parentOrder.total, // Reference parent total
            paymentStatus: 'PENDING',
            
            // Dates (inherit from parent)
            readyBy: parentOrder.readyBy,
            
            // Metadata
            notes: `Split from order ${parentOrder.orderNumber}: ${splitLabel}`,
          },
        });
        
        // Move items to child order
        await tx.orderItem.updateMany({
          where: {
            id: { in: split.itemIds },
          },
          data: {
            orderId: childOrder.id,
          },
        });
        
        children.push(childOrder);
      }
      
      return children;
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // STEP 4: Emit events for notifications
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    this.eventEmitter.emit('order.split', {
      parentOrder,
      childOrders,
      reason,
    });

    return {
      parentOrder: {
        id: parentOrder.id,
        orderNumber: parentOrder.orderNumber,
        status: 'SPLIT',
      },
      childOrders: childOrders.map(child => ({
        id: child.id,
        orderNumber: child.orderNumber,
        total: child.total,
        itemCount: splits.find(s => child.id === child.id)?.itemIds.length || 0,
      })),
    };
  }

  /**
   * Merge split orders back (if before delivery)
   */
  async mergeSplitOrders(parentOrderId: string, userId: string) {
    const parentOrder = await this.prisma.order.findUnique({
      where: { id: parentOrderId },
      include: {
        childOrders: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!parentOrder) {
      throw new NotFoundException('Parent order not found');
    }

    if (!parentOrder.isSplit) {
      throw new BadRequestException('Order is not split');
    }

    // Check: Can only merge if no child is delivered
    const anyDelivered = parentOrder.childOrders.some(
      child => child.status === 'DELIVERED',
    );
    
    if (anyDelivered) {
      throw new BadRequestException('Cannot merge - one or more splits already delivered');
    }

    // Transaction: Merge back
    await this.prisma.$transaction(async (tx) => {
      // Move all items back to parent
      const allItemIds = parentOrder.childOrders.flatMap(child =>
        child.items.map(item => item.id),
      );
      
      await tx.orderItem.updateMany({
        where: { id: { in: allItemIds } },
        data: { orderId: parentOrderId },
      });
      
      // Restore parent order
      await tx.order.update({
        where: { id: parentOrderId },
        data: {
          isSplit: false,
          splitCount: 0,
          status: 'IN_PROCESS', // Reset to processing
        },
      });
      
      // Delete child orders
      await tx.order.deleteMany({
        where: { parentOrderId },
      });
    });

    this.eventEmitter.emit('order.merged', { parentOrderId });

    return { success: true, message: 'Orders merged successfully' };
  }
}
```

---

## 🎫 **DAY 3: ISSUE MANAGEMENT SYSTEM (6-7 hours)**

### Step 3.1: Issue Service

**File**: `apps/api/src/issues/issues.service.ts`

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class IssuesService {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * Create new issue
   */
  async createIssue(data: {
    orderId: string;
    title: string;
    description: string;
    description2?: string;
    issueType: string;
    category: string;
    severity?: string;
    phase: 'PRE_DELIVERY' | 'POST_DELIVERY';
    reportedBy: string;
    photos?: string[];
  }) {
    // Get order
    const order = await this.prisma.order.findUnique({
      where: { id: data.orderId },
      include: { customer: true },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Generate issue number
    const issueCount = await this.prisma.issue.count({
      where: { tenantId: order.tenantId },
    });
    const issueNumber = `ISS-${new Date().getFullYear()}-${String(issueCount + 1).padStart(5, '0')}`;

    // Calculate SLA target (24 hours for HIGH, 48 hours for others)
    const slaHours = data.severity === 'HIGH' || data.severity === 'CRITICAL' ? 24 : 48;
    const slaTarget = new Date();
    slaTarget.setHours(slaTarget.getHours() + slaHours);

    // Create issue
    const issue = await this.prisma.issue.create({
      data: {
        tenantId: order.tenantId,
        orderId: data.orderId,
        issueNumber,
        title: data.title,
        description: data.description,
        description2: data.description2,
        issueType: data.issueType as any,
        category: data.category as any,
        severity: (data.severity || 'MEDIUM') as any,
        phase: data.phase,
        reportedBy: data.reportedBy,
        status: 'OPEN',
        slaTarget,
        photos: data.photos,
      },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
      },
    });

    // Create history entry
    await this.createHistoryEntry(issue.id, {
      action: 'CREATED',
      performedBy: data.reportedBy,
      comment: 'Issue created',
    });

    // Emit event
    this.eventEmitter.emit('issue.created', issue);

    return issue;
  }

  /**
   * Assign issue to staff member
   */
  async assignIssue(issueId: string, assignedTo: string, assignedBy: string) {
    const issue = await this.prisma.issue.update({
      where: { id: issueId },
      data: {
        assignedTo,
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
      },
    });

    await this.createHistoryEntry(issueId, {
      action: 'ASSIGNED',
      performedBy: assignedBy,
      comment: `Assigned to ${assignedTo}`,
    });

    this.eventEmitter.emit('issue.assigned', issue);

    return issue;
  }

  /**
   * Update issue status
   */
  async updateIssueStatus(
    issueId: string,
    newStatus: string,
    userId: string,
    comment?: string,
  ) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
    });

    if (!issue) {
      throw new NotFoundException('Issue not found');
    }

    const updatedIssue = await this.prisma.issue.update({
      where: { id: issueId },
      data: {
        status: newStatus as any,
        ...(newStatus === 'RESOLVED' && { resolvedAt: new Date() }),
        ...(newStatus === 'CLOSED' && { closedAt: new Date() }),
      },
    });

    await this.createHistoryEntry(issueId, {
      action: 'STATUS_CHANGED',
      performedBy: userId,
      fromStatus: issue.status,
      toStatus: newStatus,
      comment,
    });

    return updatedIssue;
  }

  /**
   * Quick Solve: Fast resolution (credit, single item redo)
   */
  async quickSolve(
    issueId: string,
    solution: {
      type: 'CREDIT' | 'REFUND' | 'REDO_SINGLE_ITEM';
      amount?: number;
      itemIds?: string[];
      notes: string;
    },
    userId: string,
  ) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: { order: true },
    });

    if (!issue) {
      throw new NotFoundException('Issue not found');
    }

    // Apply solution
    let updatedData: any = {
      resolution: 'QUICK_SOLVE',
      solution: solution.notes,
      status: 'RESOLVED',
      resolvedAt: new Date(),
      resolvedBy: userId,
    };

    if (solution.type === 'CREDIT') {
      updatedData.creditIssued = solution.amount;
      
      // TODO: Actually issue credit to customer wallet
    } else if (solution.type === 'REFUND') {
      updatedData.refundAmount = solution.amount;
      
      // TODO: Process refund through payment gateway
    } else if (solution.type === 'REDO_SINGLE_ITEM') {
      // Mark items for re-processing
      await this.prisma.orderItem.updateMany({
        where: { id: { in: solution.itemIds || [] } },
        data: { status: 'REDO_REQUIRED' },
      });
    }

    const resolvedIssue = await this.prisma.issue.update({
      where: { id: issueId },
      data: updatedData,
    });

    await this.createHistoryEntry(issueId, {
      action: 'RESOLVED',
      performedBy: userId,
      comment: `Quick solve: ${solution.type}`,
    });

    this.eventEmitter.emit('issue.quickSolved', resolvedIssue);

    return resolvedIssue;
  }

  /**
   * Re-Process: Create new order for full re-processing
   */
  async reprocess(
    issueId: string,
    options: {
      itemIds?: string[]; // Specific items, or all if empty
      notes: string;
    },
    userId: string,
  ) {
    const issue = await this.prisma.issue.findUnique({
      where: { id: issueId },
      include: {
        order: {
          include: {
            items: true,
            customer: true,
          },
        },
      },
    });

    if (!issue) {
      throw new NotFoundException('Issue not found');
    }

    // Determine which items to reprocess
    const itemsToReprocess = options.itemIds
      ? issue.order.items.filter(item => options.itemIds!.includes(item.id))
      : issue.order.items;

    // Calculate new totals
    const subtotal = itemsToReprocess.reduce((sum, item) => sum + Number(item.total), 0);
    const tax = subtotal * 0.05;
    const total = subtotal + tax;

    // Create reprocess order
    const reprocessOrder = await this.prisma.order.create({
      data: {
        tenantId: issue.order.tenantId,
        branchId: issue.order.branchId,
        customerId: issue.order.customerId,
        parentOrderId: issue.order.id,
        orderNumber: `${issue.order.orderNumber}-R${Date.now().toString(36)}`,
        orderType: 'REPROCESS',
        status: 'IN_PROCESS',
        priority: 'HIGH', // Reprocess orders get high priority
        subtotal,
        tax,
        total,
        paymentStatus: 'WAIVED', // Usually free
        notes: `Reprocess for issue ${issue.issueNumber}: ${options.notes}`,
      },
    });

    // Create new order items
    for (const item of itemsToReprocess) {
      await this.prisma.orderItem.create({
        data: {
          orderId: reprocessOrder.id,
          tenantId: issue.order.tenantId,
          productId: item.productId,
          itemName: item.itemName,
          itemName2: item.itemName2,
          service: item.service,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          status: 'PENDING',
          notes: `Reprocess from order ${issue.order.orderNumber}`,
        },
      });
    }

    // Update issue
    await this.prisma.issue.update({
      where: { id: issueId },
      data: {
        resolution: 'REPROCESS',
        reprocessOrderId: reprocessOrder.id,
        status: 'RESOLVED',
        resolvedAt: new Date(),
        resolvedBy: userId,
        solution: options.notes,
      },
    });

    await this.createHistoryEntry(issueId, {
      action: 'RESOLVED',
      performedBy: userId,
      comment: `Created reprocess order ${reprocessOrder.orderNumber}`,
    });

    this.eventEmitter.emit('issue.reprocessed', {
      issue,
      reprocessOrder,
    });

    return {
      issue,
      reprocessOrder,
    };
  }

  /**
   * Notify customer about issue
   */
  async notifyCustomer(issueId: string, userId: string) {
    const issue = await this.prisma.issue.update({
      where: { id: issueId },
      data: {
        customerNotified: true,
        notificationSentAt: new Date(),
      },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
      },
    });

    await this.createHistoryEntry(issueId, {
      action: 'CUSTOMER_NOTIFIED',
      performedBy: userId,
      comment: 'Customer notified via WhatsApp/Email',
    });

    // TODO: Actually send notification via WhatsApp/Email
    this.eventEmitter.emit('issue.customerNotified', issue);

    return issue;
  }

  /**
   * Create history entry
   */
  private async createHistoryEntry(
    issueId: string,
    data: {
      action: string;
      performedBy: string;
      comment?: string;
      fromStatus?: string;
      toStatus?: string;
    },
  ) {
    return this.prisma.issueHistory.create({
      data: {
        issueId,
        action: data.action as any,
        comment: data.comment,
        fromStatus: data.fromStatus,
        toStatus: data.toStatus,
        performedBy: data.performedBy,
      },
    });
  }

  /**
   * Get issues dashboard
   */
  async getIssuesDashboard(tenantId: string, filters?: {
    status?: string;
    phase?: string;
    severity?: string;
    assignedTo?: string;
  }) {
    const issues = await this.prisma.issue.findMany({
      where: {
        tenantId,
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.phase && { phase: filters.phase as any }),
        ...(filters?.severity && { severity: filters.severity as any }),
        ...(filters?.assignedTo && { assignedTo: filters.assignedTo }),
      },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
        history: {
          orderBy: { performedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [
        { severity: 'desc' }, // Critical first
        { createdAt: 'asc' }, // FIFO
      ],
    });

    // Calculate SLA breaches
    const now = new Date();
    issues.forEach(issue => {
      if (issue.slaTarget && now > issue.slaTarget && issue.status !== 'CLOSED') {
        issue.slaBreached = true;
      }
    });

    // Metrics
    const metrics = {
      open: issues.filter(i => i.status === 'OPEN').length,
      inProgress: issues.filter(i => i.status === 'IN_PROGRESS').length,
      resolved: issues.filter(i => i.status === 'RESOLVED').length,
      slaBreached: issues.filter(i => i.slaBreached).length,
      byType: this.groupBy(issues, 'issueType'),
      bySeverity: this.groupBy(issues, 'severity'),
    };

    return {
      issues,
      metrics,
    };
  }

  private groupBy(array: any[], key: string) {
    return array.reduce((result, item) => {
      const value = item[key];
      result[value] = (result[value] || 0) + 1;
      return result;
    }, {});
  }
}
```

---

## 🎨 **DAY 4: FRONTEND INTERFACES (5-6 hours)**

### Step 4.1: Split Order Dialog

**File**: `apps/web/components/orders/SplitOrderDialog.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function SplitOrderDialog({ order, isOpen, onClose }) {
  const [splits, setSplits] = useState([
    { label: 'Split A', itemIds: [] },
    { label: 'Split B', itemIds: [] },
  ]);
  const [reason, setReason] = useState('');
  const queryClient = useQueryClient();

  const splitMutation = useMutation({
    mutationFn: () => api.post(`/orders/${order.id}/split`, {
      splits: splits.map(s => ({ itemIds: s.itemIds, label: s.label })),
      reason,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onClose();
    },
  });

  const toggleItem = (splitIndex: number, itemId: string) => {
    setSplits(prev => {
      const newSplits = [...prev];
      const currentSplit = newSplits[splitIndex];
      
      // Remove from all splits first
      newSplits.forEach(split => {
        split.itemIds = split.itemIds.filter(id => id !== itemId);
      });
      
      // Add to current split if not already there
      if (!currentSplit.itemIds.includes(itemId)) {
        currentSplit.itemIds.push(itemId);
      }
      
      return newSplits;
    });
  };

  const canSplit = splits.every(s => s.itemIds.length > 0) && reason.trim();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Split Order #{order.orderNumber}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Reason */}
          <div>
            <label className="font-medium">Reason for Split *</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Customer picking up partial order early..."
              rows={2}
              className="mt-2"
            />
          </div>

          {/* Split Groups */}
          <div className="grid grid-cols-2 gap-4">
            {splits.map((split, splitIndex) => (
              <div key={splitIndex} className="border rounded-lg p-4">
                <Input
                  value={split.label}
                  onChange={(e) => {
                    const newSplits = [...splits];
                    newSplits[splitIndex].label = e.target.value;
                    setSplits(newSplits);
                  }}
                  className="mb-3 font-medium"
                />
                
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <label
                      key={item.id}
                      className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer"
                    >
                      <Checkbox
                        checked={split.itemIds.includes(item.id)}
                        onCheckedChange={() => toggleItem(splitIndex, item.id)}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{item.itemName}</div>
                        <div className="text-sm text-muted-foreground">
                          {order.currency} {item.total}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="mt-3 pt-3 border-t">
                  <div className="flex justify-between">
                    <span>Items:</span>
                    <Badge>{split.itemIds.length}</Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => splitMutation.mutate()}
              disabled={!canSplit || splitMutation.isPending}
            >
              {splitMutation.isPending ? 'Splitting...' : 'Split Order'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

### Step 4.2: Create Issue Dialog

**File**: `apps/web/components/issues/CreateIssueDialog.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Form, FormField } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useMutation } from '@tanstack/react-query';
import { api } from '@/lib/api';

const issueSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(10),
  issueType: z.enum(['QUALITY', 'MISSING_ITEM', 'WRONG_ITEM', 'DAMAGE', 'LATE_DELIVERY']),
  category: z.enum(['TECHNICAL', 'OPERATIONAL', 'CUSTOMER', 'EXTERNAL']),
  severity: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  phase: z.enum(['PRE_DELIVERY', 'POST_DELIVERY']),
});

export function CreateIssueDialog({ order, isOpen, onClose }) {
  const form = useForm({
    resolver: zodResolver(issueSchema),
    defaultValues: {
      phase: order.status === 'DELIVERED' ? 'POST_DELIVERY' : 'PRE_DELIVERY',
      severity: 'MEDIUM',
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => api.post('/issues', {
      orderId: order.id,
      ...data,
    }),
    onSuccess: () => {
      onClose();
      form.reset();
    },
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(createMutation.mutate)}>
            {/* Form fields similar to previous examples */}
            <Button type="submit">Create Issue</Button>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

---

## 🧪 **DAY 5: TESTING (3-4 hours)**

### Test Scenarios

```
✅ Split Order Tests
├─ Split 5-item order into 2 splits
├─ Verify child orders created
├─ Verify items moved correctly
├─ Verify financials calculated
├─ Test merge back (before delivery)
└─ Test cannot merge after partial delivery

✅ Issue Management Tests
├─ Create pre-delivery issue
├─ Create post-delivery issue
├─ Quick solve with credit
├─ Reprocess with new order creation
├─ SLA breach tracking
├─ Customer notification
└─ Issue history audit trail
```

---

## ✅ **COMPLETION CHECKLIST**

- [x] Order splitting logic
- [x] Parent-child relationships
- [x] Issue tracking system
- [x] Quick solve workflow
- [x] Re-process workflow
- [x] SLA tracking
- [x] Audit trail
- [x] Frontend dialogs

---

**Congratulations!** 🎉 You've implemented advanced order management!

**Next**: [PRD-011: PDF Receipts Implementation →](./PRD_011_PDF_Receipts_Implementation.md)

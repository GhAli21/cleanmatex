# Orders Workflow - User Guide

## Overview

The Orders Workflow system guides orders through multiple stages from creation to delivery. This guide explains how to use each workflow screen and understand order statuses.

## Understanding Order Statuses

Orders progress through the following statuses:

1. **Draft** - Order is being created
2. **Intake** - Items received from customer
3. **Preparing** - Items being tagged and prepared
4. **Processing** - Items in processing queue
5. **Assembly** - Items being assembled (if enabled)
6. **QA** - Quality assurance check (if enabled)
7. **Packing** - Items being packed
8. **Ready** - Order ready for pickup/delivery
9. **Out for Delivery** - Order with driver
10. **Delivered** - Order delivered to customer
11. **Closed** - Order completed

## Using Each Workflow Screen

### Preparation Screen

**Purpose:** Tag and prepare items received from customers

**Actions:**
- View orders in "preparing" or "intake" status
- Complete preparation to move order to "processing"

**Steps:**
1. Navigate to Preparation screen
2. Select an order
3. Review items
4. Click "Complete Preparation"

### Processing Screen

**Purpose:** Process items through washing, drying, and finishing

**Actions:**
- View orders in "processing" status
- Track processing steps
- Complete processing to move to next stage

**Steps:**
1. Navigate to Processing screen
2. Select an order
3. Update processing steps
4. Click "Complete Processing"

### Assembly Screen

**Purpose:** Assemble items (if assembly workflow is enabled)

**Actions:**
- View orders in "assembly" status
- Scan pieces for assembly
- Complete assembly

**Requirements:**
- All pieces must be scanned before completion

### QA Screen

**Purpose:** Quality assurance check (if QA workflow is enabled)

**Actions:**
- View orders in "qa" status
- Approve or reject items
- Add inspection notes

**Options:**
- **Approve:** Move to next stage
- **Reject:** Return to processing for rework

### Packing Screen

**Purpose:** Pack items for delivery

**Actions:**
- View orders in "packing" status
- Complete packing to move to "ready"

### Ready Release Screen

**Purpose:** Release orders for pickup or delivery

**Actions:**
- View orders in "ready" status
- Confirm pickup or assign to driver
- Generate delivery route

**Options:**
- **Pickup:** Customer picks up order
- **Delivery:** Assign to driver

### Driver Delivery Screen

**Purpose:** Track delivery progress (if driver app is enabled)

**Actions:**
- View orders assigned to driver
- Update delivery status
- Capture proof of delivery

## Quality Gates

Before an order can move to "ready" status, it must pass quality gates:

- ✅ All items assembled (if assembly enabled)
- ✅ QA passed (if QA enabled)
- ✅ No unresolved blocking issues

If quality gates are not met, you'll see an error message explaining what needs to be fixed.

## Troubleshooting Common Issues

### Issue: Cannot complete transition

**Possible causes:**
- Order status doesn't match screen requirements
- Missing required permissions
- Quality gates not met
- Plan limit exceeded

**Solution:**
- Check order status
- Verify you have required permissions
- Complete quality gate requirements
- Contact administrator if plan limit exceeded

### Issue: Order stuck in status

**Solution:**
- Check for blocking issues
- Verify all required steps completed
- Contact support if issue persists

### Issue: Quality gate error

**Solution:**
- Review quality gate requirements
- Complete missing steps
- Resolve blocking issues

## FAQ

**Q: Can I skip stages?**
A: No, orders must progress through stages in order. Some stages may be skipped based on workflow configuration.

**Q: What happens if I reject an item in QA?**
A: The order returns to processing for rework.

**Q: Can I undo a transition?**
A: Contact your administrator. Transitions are logged for audit purposes.

**Q: How do I know if an order is overdue?**
A: Overdue orders are highlighted in the order list with a warning indicator.


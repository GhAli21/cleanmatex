# Changelog

All notable changes to the Basic Workflow & Status Transitions feature will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-30

### Added
- Complete 14-stage workflow system (DRAFT through CLOSED)
- Database migration 0013 with 3 new tables:
  - `org_order_status_history` - Complete audit trail
  - `org_workflow_settings_cf` - Configurable workflows
  - `org_workflow_rules` - Transition rules
- TypeScript type system in `lib/types/workflow.ts`:
  - OrderStatus type with 14 stages
  - STATUS_META with labels, colors, and icons
  - StatusHistoryEntry, WorkflowSettings, QualityGateRules
  - Utility functions (getStatusIndex, getAllowedTransitions, formatDuration)
- Backend service `lib/services/workflow-service.ts` with:
  - `changeStatus()` - Single status update with validation
  - `isTransitionAllowed()` - Check workflow rules
  - `getWorkflowForTenant()` - Get configured workflow
  - `canMoveToReady()` - Quality gate validation
  - `bulkChangeStatus()` - Bulk updates with transaction handling
  - `getStatusHistory()` - Fetch audit trail
  - `getOverdueOrders()` - SLA tracking
  - `getWorkflowStats()` - Dashboard statistics
- API Routes (6 endpoints):
  - `PATCH /api/orders/[orderId]/status` - Update single order status
  - `GET /api/orders/[orderId]/status` - Get allowed transitions
  - `POST /api/orders/bulk-status` - Bulk status update (max 100 orders)
  - `GET /api/orders/[orderId]/status-history` - Get complete audit trail
  - `GET /api/orders/overdue` - Get overdue orders
  - `GET /api/dashboard/workflow-stats` - Get workflow statistics
- Frontend Components:
  - `OrderStatusBadge` - Reusable status badge with colors, icons, bilingual labels
  - `OrderActions` (Updated) - Full status change UI with quality gate blocking
  - `OrderTimeline` (Enhanced) - Fetches and displays status history with user info
  - `BulkStatusUpdate` - New component for bulk order status updates
  - `OverdueOrdersWidget` - Dashboard widget showing overdue orders
  - `WorkflowStatsWidget` - Dashboard widget with donut chart and statistics
- Order table bulk selection with checkbox UI
- Quality gate enforcement:
  - Blocks progression to READY if items not assembled
  - Blocks if QA not passed
  - Blocks if unresolved issues exist
- SLA tracking with `ready_by` date field
- Multi-tenant isolation with RLS policies on all new tables
- Prisma schema updated and regenerated

### Security
- Row-Level Security (RLS) enabled on all 3 new tables
- Tenant isolation policies in place
- Service role policies for admin operations
- Composite foreign keys for tenant-scoped references
- JWT authentication required for all API endpoints
- Input validation on all endpoints

### Performance
- 9 indexes created for optimal query performance:
  - Status history: order_id, tenant_org_id, changed_at
  - Workflow settings: tenant_org_id, service_category_code
  - Workflow rules: tenant_org_id, transition pairs
- Single-query fetches with joins
- Pagination support ready for future
- Auto-refresh intervals: 30s (timeline), 2min (stats), 5min (overdue)

### Documentation
- Feature README with overview and navigation
- Complete API specifications
- Workflow rules documentation
- Quality gates documentation
- User guide with step-by-step instructions
- Testing scenarios for manual and automated tests
- Component documentation for all UI elements

## [Unreleased]

### Planned Features
- Real-time status updates via Supabase Realtime
- WhatsApp Business API integration for notifications (PRD-019)
- Advanced workflow rules (time-based, conditional)
- Workflow analytics dashboard
- Custom workflow builder UI
- Auto-transitions (e.g., PREPARATION → PROCESSING after timeout)
- Average time per stage calculation (needs historical data)

### Known Limitations
- No auto-transitions implemented yet
- Average time per stage not calculated
- No real-time WebSocket updates (using polling/refresh)
- No email/SMS notifications

---
name: Critical MVP Features Implementation Plan
overview: "Implement three critical MVP features: PRD-009 (Assembly & QA Workflow), PRD-006 (Digital Receipts), and PRD-013 (Delivery Management & POD). This plan builds on existing UI pages and workflow infrastructure while implementing the missing backend services and database tables."
todos: []
---

# Critical MVP Features Implementation Plan

## Overview

This plan implements three critical MVP features that are blocking production launch:

1. **PRD-009: Assembly & QA Workflow** - Quality gates before orders can be marked READY
2. **PRD-006: Digital Receipts** - WhatsApp and in-app receipt delivery
3. **PRD-013: Delivery Management & POD** - Route management and proof of delivery

**Current Status**: UI pages exist (basic), but backend services and database tables are missing.**Estimated Duration**: 8-10 weeks (2-3 developers)---

## Standards & Rules Compliance

**CRITICAL**: All implementation MUST follow these standards:

### Documentation Standards (`@.claude/docs/documentation_rules.md`)

**Required Documentation Structure** for each feature:

- `docs/features/{FeatureName}/README.md` - Overview
- `docs/features/{FeatureName}/development_plan.md` - Implementation plan
- `docs/features/{FeatureName}/progress_summary.md` - Progress tracking
- `docs/features/{FeatureName}/current_status.md` - Current state
- `docs/features/{FeatureName}/developer_guide.md` - Developer documentation
- `docs/features/{FeatureName}/developer_guide_mermaid.md` - Code flow diagrams
- `docs/features/{FeatureName}/user_guide.md` - User workflows
- `docs/features/{FeatureName}/user_guide_mermaid.md` - User flow diagrams
- `docs/features/{FeatureName}/testing_scenarios.md` - Test cases
- `docs/features/{FeatureName}/CHANGELOG.md` - Version history
- `docs/features/{FeatureName}/version.txt` - Current version
- `docs/features/{FeatureName}/technical_docs/` - Technical documentation

**Metadata Headers**: All markdown files must start with:

```yaml
version: v1.0.0
last_updated: YYYY-MM-DD
author: CleanMateX Team
```



### Implementation Rules (`@.claude/docs/prd-implementation_rules.md`)

**Code Style**:

- TypeScript strict mode only (no `any` types)
- Naming: `camelCase` (variables/functions), `PascalCase` (components/types), `UPPER_SNAKE_CASE` (constants)
- Max 500 lines per component (break into smaller components)
- 2-space indentation, max 100 characters per line
- Always use semicolons

**Error Handling** (`@.claude/docs/error-handling-rules.md`):

- Use custom error classes (`AppError`, `NotFoundError`, `ValidationError`)
- Standard error response format with `code`, `message`, `details`
- Frontend: Always use `cmxMessage` utility for user-facing messages
- Include context: `tenantId`, `userId`, `requestId` in errors

**Logging** (`@.claude/docs/logging-rules.md`):

- Always use centralized logger: `import { logger } from "@/lib/utils/logger"`
- Never use `console.log` directly
- Include required context: `tenantId`, `userId`, `requestId`
- Use appropriate log levels: DEBUG, INFO, WARN, ERROR, FATAL

**Git Commits**:

- Format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`
- Examples: `feat(assembly): add barcode scanning`, `fix(receipts): resolve WhatsApp delivery retry`

### Frontend Standards (`@.claude/docs/frontend_standards.md`)

**Folder Structure**:

- `app/` - Routing only (Next.js App Router)
- `src/ui/` - Global Cmx Design System components (prefix: `Cmx*`)
- `src/features/` - Feature modules (domain UI + logic)
- `lib/` - Shared infrastructure (API clients, hooks, utils)

**Component Patterns**:

- Functional components with hooks only
- Use `Cmx*` components from design system
- Use `CmxEditableDataTable` for editable tables
- Server-side pagination only (API-driven)
- Use `cmxMessage` for all user messages/errors/alerts

**Path Aliases**:

- `@ui/*` → `src/ui/*`
- `@features/*` → `src/features/*`
- `@lib/*` → `lib/*`

**State Management**:

- React Query (TanStack Query) for async data
- React Hook Form + Zod for forms & validation
- Zustand for global state (if needed)

### Backend Standards (`@.claude/docs/backend_standards.md`)

**Architecture**:

- NestJS modular structure: `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`, `entities/`
- Supabase as primary database (no Prisma)
- Typed Supabase client with generated `Database` types
- DTOs + ValidationPipe for all inputs/outputs
- Business logic in services, not controllers

**Data Access**:

- Repository pattern for Supabase queries
- Always filter by `tenant_org_id` in queries
- Use composite foreign keys for tenant isolation
- No direct SQL in controllers

**API Versioning**:

- All APIs versioned: `/api/v1/...`
- Breaking changes require new version
- Document version changes in CHANGELOG.md

### Database Conventions (`@.claude/docs/database_conventions.md`)

**Naming**:

- Feature prefixes: `org_asm_`, `org_rcpt_`, `org_dlv_`
- Suffixes: `_mst` (master), `_dtl` (detail), `_tr` (transactions), `_cd` (codes), `_cf` (config)
- Code tables: `sys_*_cd` for system-wide lookups

**Required Fields**:

- Standard audit fields: `created_at`, `created_by`, `updated_at`, `updated_by`, `rec_status`, `is_active`
- Bilingual fields: `name`, `name2` (Arabic)
- Composite foreign keys: `(tenant_org_id, ...)`

**RLS Policies**:

- Enable RLS on all tenant tables
- Create tenant isolation policies
- Test tenant isolation in unit tests

**Migration Sequence**:

- Start from last migration + 1 (currently: 0063, 0064, 0065)
- Follow naming: `{sequence}_{scope}_{feature}_{description}.sql`

---

## PRD-009: Assembly & QA Workflow

### Current State

- ✅ UI pages exist: `web-admin/app/dashboard/assembly/page.tsx` and `web-admin/app/dashboard/qa/page.tsx`
- ✅ Workflow service exists with quality gate checks
- ❌ No database tables for assembly/QA
- ❌ No backend services for assembly operations
- ❌ No per-piece scanning implementation

### Implementation Tasks

#### Phase 1: Database Foundation (Week 1)

**Migration**: `0063_org_asm_assembly_qa_system.sql`**Following Database Conventions** (`@.claude/docs/database_conventions.md`):

- Feature prefix: `org_asm_` for assembly-related tables
- Feature prefix: `org_qa_` for QA-related tables  
- Feature prefix: `org_pck_` for packing-related tables
- Suffixes: `_mst` (master), `_dtl` (detail), `_tr` (transactions), `_cd` (codes)
- All tables include standard audit fields (created_at, created_by, updated_at, updated_by, rec_status, is_active)
- Composite foreign keys for tenant isolation
- RLS policies for all tenant tables

Create tables:

- `org_asm_tasks_mst` - One task per order (master table)
- `org_asm_items_dtl` - Track each order item during assembly (detail table)
- `org_asm_exceptions_tr` - Missing/wrong/damaged items (transaction table)
- `org_asm_locations_mst` - Physical locations (bins, racks, shelves)
- `org_qa_decisions_tr` - QA pass/fail records (transaction table)
- `org_pck_packing_lists_mst` - Bilingual packing lists

**Code Tables** (system-wide lookups):

- `sys_asm_exception_type_cd` - Exception types (MISSING, WRONG_ITEM, DAMAGED, etc.)
- `sys_asm_location_type_cd` - Location types (BIN, RACK, SHELF, FLOOR, HANGING)
- `sys_qa_decision_type_cd` - QA decision types (PASS, FAIL, PENDING)
- `sys_pck_packaging_type_cd` - Packaging types (BOX, HANGER, BAG, ROLL, MIXED)

**Key Fields**:

- Assembly task: status, assigned_to, location_id, scanned_items, exception_items, total_items
- Assembly item: status (PENDING, SCANNED, EXCEPTION, RESOLVED), scanned_at, scanned_by, barcode
- Exception: type (from code table), severity (LOW, MEDIUM, HIGH, CRITICAL), status (OPEN, IN_PROGRESS, RESOLVED), photo_urls (JSONB)
- QA decision: decision (PASS, FAIL), qa_by, qa_at, qa_photo_url, qa_notes
- Location: code, name, name2 (Arabic), type, capacity, current_load

**RLS Policies**: 6 policies for multi-tenant isolation (one per tenant table)**Indexes**:

- Standard tenant indexes: `(tenant_org_id)`, `(tenant_org_id, rec_status)`, `(tenant_org_id, is_active)`
- Performance indexes: `(order_id)`, `(task_id)`, `(barcode)`, `(status)`, `(tenant_org_id, created_at DESC)`

#### Phase 2: Backend Services (Week 2-3)

**Service**: `web-admin/lib/services/assembly-service.ts`**Standards Compliance**:

- Use centralized logger: `import { logger } from "@/lib/utils/logger"`
- Custom error classes: `AssemblyTaskNotFoundError`, `InvalidScanError`, `ExceptionNotResolvedError`
- Always include `tenantId` in logs and errors
- TypeScript strict mode, no `any` types
- Max 500 lines per function (extract helpers if needed)

**Core Functions**:

1. `createAssemblyTask(orderId)` - Auto-create when order enters ASSEMBLY status
2. `startAssemblyTask(taskId, userId, locationId)` - Start assembly, assign location
3. `scanItem(taskId, barcode, userId)` - Per-piece scanning logic
4. `createException(taskId, data)` - Record missing/wrong/damaged items
5. `resolveException(exceptionId, resolution)` - Mark exception resolved
6. `performQA(taskId, decision, userId)` - QA pass/fail
7. `packOrder(taskId, packagingType, userId)` - Generate packing list, mark READY
8. `getAssemblyDashboard(tenantId)` - Dashboard data

**Integration Points**:

- Hook into `WorkflowService.changeStatus()` to auto-create assembly task
- Update `WorkflowService.canMoveToReady()` to check assembly completion + QA pass
- Use existing order service for order data

**API Routes**: `web-admin/app/api/v1/assembly/`

- `POST /tasks/:orderId` - Create task
- `POST /tasks/:taskId/start` - Start assembly
- `POST /tasks/:taskId/scan` - Scan item
- `POST /tasks/:taskId/exceptions` - Create exception
- `PATCH /exceptions/:id/resolve` - Resolve exception
- `POST /tasks/:taskId/qa` - QA decision
- `POST /tasks/:taskId/pack` - Pack order
- `GET /dashboard` - Dashboard data

#### Phase 3: Frontend Enhancement (Week 3-4)

**Enhance Existing Pages**:

1. **Assembly Page** (`web-admin/app/dashboard/assembly/page.tsx`):

- Add barcode scanner component
- Add item scanning interface
- Add exception handling dialog
- Add location selection
- Real-time progress tracking

2. **QA Page** (`web-admin/app/dashboard/qa/page.tsx`):

- Add QA decision interface (PASS/FAIL)
- Add photo upload on fail
- Add rework workflow
- Show assembly exceptions

**New Components** (following frontend standards):**Component Locations**:

- Feature-specific: `src/features/assembly/ui/`, `src/features/qa/ui/`, `src/features/packing/ui/`
- Reusable: `src/ui/` (if used across multiple features)

**Components**:

- `CmxAssemblyScanner` - Barcode scanner with camera support (`src/features/assembly/ui/`)
- `CmxItemVerification` - Expected vs scanned comparison (`src/features/assembly/ui/`)
- `CmxExceptionDialog` - Exception recording form (`src/features/assembly/ui/`)
- `CmxQADecision` - QA decision interface (`src/features/qa/ui/`)
- `CmxPackingList` - Packing list generator/viewer (`src/features/packing/ui/`)

**Component Standards**:

- Use `Cmx*` prefix for reusable components
- Use `cmxMessage` utility for all user messages/errors/alerts
- Server-side pagination for data tables (use `CmxEditableDataTable` if editable)
- Functional components with hooks only (no class components)
- Max 500 lines per component (extract helpers if needed)
- TypeScript strict mode, no `any` types

#### Phase 4: Testing & Integration (Week 4)

- Unit tests for assembly service
- Integration tests for API routes
- E2E tests for full workflow
- Update workflow service quality gates
- UAT with pilot customers

**Success Criteria**:

- Assembly mix-up rate < 0.5%
- 100% scan before READY
- QA pass rate > 95%
- All tests passing

---

## PRD-006: Digital Receipts

### Current State

- ✅ PRD document exists with detailed requirements
- ✅ Feature flags exist: `whatsapp_receipts`, `in_app_receipts`
- ❌ No receipt service
- ❌ No database tables
- ❌ No WhatsApp integration

### Implementation Tasks

#### Phase 1: Database Foundation (Week 5)

**Migration**: `0064_org_rcpt_receipts_system.sql`**Following Database Conventions** (`@.claude/docs/database_conventions.md`):

- Feature prefix: `org_rcpt_` for receipt-related tables
- Suffixes: `_mst` (master), `_cf` (configuration)
- All tables include standard audit fields
- Composite foreign keys for tenant isolation
- RLS policies for all tenant tables

Create tables:

- `org_rcpt_receipts_mst` - Receipt records with delivery status
- `org_rcpt_templates_cf` - Tenant-customizable templates (EN/AR)

**Code Tables** (system-wide lookups):

- `sys_rcpt_receipt_type_cd` - Receipt types (whatsapp_text, whatsapp_image, in_app, pdf, print)
- `sys_rcpt_delivery_channel_cd` - Delivery channels (whatsapp, sms, email, app)
- `sys_rcpt_delivery_status_cd` - Delivery statuses (pending, sent, delivered, failed)

**Key Fields**:

- Receipt: receipt_type (from code table), delivery_channel, delivery_status, sent_at, delivered_at, retry_count, content_text, content_html, qr_code (TEXT), metadata (JSONB), recipient_phone, recipient_email
- Template: template_type, language (en, ar), template_content (TEXT), is_active

**RLS Policies**: 2 policies (one per tenant table)**Indexes**:

- Standard tenant indexes: `(tenant_org_id)`, `(tenant_org_id, rec_status)`
- Performance indexes: `(order_id)`, `(delivery_status, created_at)`, `(tenant_org_id, created_at DESC)`

#### Phase 2: Receipt Service (Week 5-6)

**Service**: `web-admin/lib/services/receipt-service.ts`**Standards Compliance**:

- Use centralized logger: `import { logger } from "@/lib/utils/logger"`
- Custom error classes: `ReceiptGenerationError`, `WhatsAppDeliveryError`, `TemplateNotFoundError`
- Always include `tenantId`, `orderId` in logs
- TypeScript strict mode, no `any` types
- Error handling with retry logic (3 attempts with exponential backoff)

**Core Functions**:

1. `generateReceipt(orderId, type)` - Generate receipt content
2. `sendReceipt(orderId, channels)` - Send via WhatsApp/in-app
3. `resendReceipt(receiptId)` - Retry failed delivery
4. `getReceipts(orderId)` - Get all receipts for order
5. `generateQRCode(orderNumber)` - QR code for tracking

**Template Engine**:

- Load template from `org_rcpt_templates_cf`
- Replace placeholders: `{{orderNumber}}`, `{{customerName}}`, `{{items}}`, `{{total}}`, etc.
- Support bilingual templates (EN/AR)

**QR Code Generation**:

- Use `qrcode` library
- Content: Order tracking URL
- Format: PNG, 300x300px

#### Phase 3: WhatsApp Integration (Week 6)

**Service**: `web-admin/lib/integrations/whatsapp-client.ts`**Standards Compliance**:

- Use centralized logger for all WhatsApp API calls
- Custom error classes: `WhatsAppAPIError`, `WhatsAppRateLimitError`
- Retry logic with exponential backoff
- Never log sensitive data (tokens, phone numbers in full)
- Include `tenantId`, `orderId`, `messageId` in logs

**WhatsApp Business API Client**:

- Template message support
- Media upload (images)
- Delivery status webhook
- Retry logic (3 attempts with exponential backoff)

**Background Jobs**:

- Queue system (BullMQ) for receipt delivery
- Retry failed deliveries
- Track delivery status

**API Routes**: `web-admin/app/api/v1/receipts/`

- `POST /orders/:orderId/receipts` - Generate and send
- `GET /orders/:orderId/receipts` - Get receipts
- `POST /receipts/:id/resend` - Resend receipt
- `POST /webhooks/whatsapp` - Delivery status webhook

#### Phase 4: Frontend Components (Week 6-7)

**Receipt Preview**:

- Component: `CmxReceiptPreview`
- Location: Order detail page
- Actions: Send WhatsApp, View in-app, Download PDF (future)

**Receipt Delivery Status**:

- Widget: `CmxReceiptStatus`
- Status indicators: Delivered, Sent, Pending, Failed
- Resend button if failed

**In-App Receipt Viewer**:

- Page: `web-admin/app/dashboard/receipts/[orderId]/page.tsx`
- Bilingual display (EN/AR)
- QR code display
- Download/share functionality

**Order Tracking Page**:

- Public page: `web-admin/app/track/[orderNumber]/page.tsx`
- QR code scanner
- Order status display
- Receipt access

#### Phase 5: Testing & Integration (Week 7)

- Unit tests for receipt generation
- Integration tests for WhatsApp delivery
- Template rendering tests
- Multi-language tests (EN/AR)
- UAT with pilot customers

**Success Criteria**:

- 90%+ WhatsApp delivery success rate
- < 30s receipt generation time
- Bilingual receipts working
- QR codes scannable

---

## PRD-013: Delivery Management & POD

### Current State

- ✅ Plan document exists
- ✅ Workflow includes OUT_FOR_DELIVERY and DELIVERED statuses
- ❌ No delivery service
- ❌ No database tables
- ❌ No POD implementation

### Implementation Tasks

#### Phase 1: Database Foundation (Week 8)

**Migration**: `0065_org_dlv_delivery_management.sql`**Following Database Conventions** (`@.claude/docs/database_conventions.md`):

- Feature prefix: `org_dlv_` for delivery-related tables
- Suffixes: `_mst` (master), `_dtl` (detail), `_tr` (transactions)
- All tables include standard audit fields
- Composite foreign keys for tenant isolation
- RLS policies for all tenant tables

Create tables:

- `org_dlv_routes_mst` - Delivery routes (master table)
- `org_dlv_stops_dtl` - Stops within routes (one per order, detail table)
- `org_dlv_pod_tr` - Proof of delivery records (transaction table)
- `org_dlv_slots_mst` - Pickup/delivery time slots

**Code Tables** (system-wide lookups):

- `sys_dlv_route_status_cd` - Route statuses (planned, in_progress, completed, cancelled)
- `sys_dlv_stop_status_cd` - Stop statuses (pending, in_transit, delivered, failed, cancelled)
- `sys_dlv_pod_method_cd` - POD methods (OTP, SIGNATURE, PHOTO, MIXED)

**Key Fields**:

- Route: route_number (VARCHAR), driver_id (UUID), status (from code table), started_at, completed_at, total_stops, completed_stops
- Stop: order_id (UUID), sequence (INTEGER), address (TEXT), status (from code table), scheduled_time, actual_time, estimated_arrival, notes
- POD: stop_id (UUID), method (from code table), otp_code (VARCHAR, encrypted), signature_url (TEXT), photo_urls (JSONB array), verified_at, verified_by, metadata (JSONB)
- Slot: date (DATE), time_range_start (TIME), time_range_end (TIME), capacity (INTEGER), booked_count (INTEGER), slot_type (pickup, delivery)

**RLS Policies**: 4 policies (one per tenant table)**Indexes**:

- Standard tenant indexes: `(tenant_org_id)`, `(tenant_org_id, rec_status)`
- Performance indexes: `(route_id)`, `(order_id)`, `(driver_id)`, `(status)`, `(tenant_org_id, created_at DESC)`, `(scheduled_time)`

#### Phase 2: Delivery Service (Week 8-9)

**Service**: `web-admin/lib/services/delivery-service.ts`**Standards Compliance**:

- Use centralized logger: `import { logger } from "@/lib/utils/logger"`
- Custom error classes: `RouteNotFoundError`, `InvalidOTPError`, `PODCaptureError`
- Always include `tenantId`, `routeId`, `orderId` in logs
- TypeScript strict mode, no `any` types
- OTP encryption for security
- Error handling for failed deliveries

**Core Functions**:

1. `createRoute(orders, driverId)` - Create delivery route
2. `assignDriver(routeId, driverId)` - Assign driver to route
3. `generateOTP(orderId)` - Generate 4-digit OTP
4. `verifyOTP(orderId, otp)` - Verify OTP
5. `capturePOD(stopId, method, data)` - Record POD (OTP/signature/photo)
6. `markFailed(stopId, reason)` - Mark delivery failed
7. `getDriverRoutes(driverId)` - Get routes for driver
8. `updateLocation(stopId, lat, lng)` - Update GPS location

**OTP Generation**:

- 4-digit random code
- Valid for 30 minutes
- Sent to customer via WhatsApp/SMS
- Stored encrypted

**POD Methods**:

- OTP: Verify code matches
- Signature: Capture digital signature, upload to MinIO
- Photo: Capture delivery photo, upload to MinIO

**Integration Points**:

- Hook into `WorkflowService.changeStatus()` for OUT_FOR_DELIVERY → DELIVERED
- Use existing order service for order data
- Use existing customer service for addresses

**API Routes**: `web-admin/app/api/v1/delivery/`

- `POST /routes` - Create route
- `GET /routes/:id` - Get route
- `PATCH /routes/:id` - Update route
- `POST /routes/:id/assign` - Assign driver
- `POST /orders/:orderId/generate-otp` - Generate OTP
- `POST /orders/:orderId/verify-otp` - Verify OTP
- `POST /stops/:stopId/pod` - Capture POD
- `POST /stops/:stopId/fail` - Mark failed
- `GET /driver/:driverId/routes` - Driver routes
- `POST /stops/:stopId/location` - Update GPS

#### Phase 3: Frontend Components (Week 9-10)

**Route Management Page**:

- Page: `web-admin/app/dashboard/delivery/routes/page.tsx`
- Create route UI
- Assign driver interface
- Route optimization (basic)
- Route status tracking

**POD Capture Interface**:

- Component: `CmxPODCapture`
- OTP input field
- Signature canvas
- Photo capture (camera)
- Location: Order detail page or driver app

**Delivery Dashboard**:

- Page: `web-admin/app/dashboard/delivery/page.tsx`
- Active routes
- Pending deliveries
- Failed deliveries
- Driver assignments

**Update Order Detail Page**:

- Add delivery section
- Show route info
- Show POD status
- OTP generation button

#### Phase 4: Testing & Integration (Week 10)

- Unit tests for delivery service
- Integration tests for POD capture
- OTP verification tests
- E2E tests for delivery workflow
- UAT with pilot customers

**Success Criteria**:

- 95%+ OTP POD adoption
- < 10min average delivery time
- Zero delivery disputes
- All tests passing

---

## Dependencies & Integration Points

### Existing Infrastructure to Leverage

1. **Workflow Service** (`web-admin/lib/services/workflow-service.ts`):

- Hook into `changeStatus()` to auto-create assembly tasks
- Update `canMoveToReady()` to check assembly + QA completion
- Use for delivery status transitions

2. **Order Service** (`web-admin/lib/services/order-service.ts`):

- Use for order data retrieval
- Use for order updates

3. **Customer Service** (`web-admin/lib/services/customer-addresses.service.ts`):

- Use for delivery addresses
- Use for customer contact info

4. **Feature Flags** (`web-admin/lib/services/feature-flags.service.ts`):

- Check `whatsapp_receipts` before sending
- Check `in_app_receipts` for receipt viewing
- Check `driver_app` for delivery features

5. **MinIO Integration**:

- Use for photo storage (assembly exceptions, QA photos, POD photos, signatures)

### New Infrastructure Needed

1. **WhatsApp Business API**:

- Meta Business Account setup
- Phone Number ID and Access Token
- Webhook configuration

2. **Background Job Queue**:

- BullMQ for receipt delivery
- Retry logic for failed deliveries

3. **QR Code Library**:

- `qrcode` npm package

4. **Barcode Scanner**:

- `html5-qrcode` for camera scanning
- Or manual barcode input

---

## Implementation Sequence

### Week 1-4: PRD-009 (Assembly & QA)

- Week 1: Database migration + RLS policies
- Week 2: Backend services (assembly-service.ts)
- Week 3: Frontend enhancement + API routes
- Week 4: Testing + integration with workflow service

### Week 5-7: PRD-006 (Digital Receipts)

- Week 5: Database migration + receipt service
- Week 6: WhatsApp integration + background jobs
- Week 7: Frontend components + testing

### Week 8-10: PRD-013 (Delivery & POD)

- Week 8: Database migration + delivery service
- Week 9: Frontend components + API routes
- Week 10: Testing + integration + UAT

---

## Risk Mitigation

### Technical Risks

1. **WhatsApp API Approval Delays**:

- Mitigation: Start with sandbox/testing, parallel SMS fallback development

2. **Assembly Complexity**:

- Mitigation: Start with basic scanning, add exceptions incrementally

3. **Performance with Real-time Updates**:

- Mitigation: Use polling (5s intervals) initially, upgrade to WebSockets later

### Business Risks

1. **MVP Launch Delays**:

- Mitigation: Focus on critical path, defer nice-to-have features

2. **Customer Adoption**:

- Mitigation: UAT with pilot customers, iterate based on feedback

---

## Success Metrics

### PRD-009 (Assembly & QA)

- Assembly mix-up rate < 0.5%
- 100% scan before READY
- QA pass rate > 95%
- Assembly time < 3 minutes per order

### PRD-006 (Digital Receipts)

- 90%+ WhatsApp delivery success rate
- < 30s receipt generation time
- 80%+ digital receipt adoption
- Bilingual receipts working

### PRD-013 (Delivery & POD)

- 95%+ OTP POD adoption
- < 10min average delivery time
- < 5% failed deliveries
- Zero delivery disputes

---

## Next Steps

1. **Immediate (This Week)**:

- Review and approve this plan
- Set up WhatsApp Business API account
- Create database migration `0063_org_asm_assembly_qa_system.sql` following naming conventions

2. **Week 1**:

- Start PRD-009 database migration
- Begin assembly service implementation

3. **Week 5**:

- Start PRD-006 implementation
- Set up WhatsApp integration
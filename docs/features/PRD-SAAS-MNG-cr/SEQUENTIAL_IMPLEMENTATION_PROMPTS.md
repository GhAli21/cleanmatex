# CleanMateX HQ SaaS Platform Management - Sequential Implementation Prompts

**Purpose**: Copy-paste prompts in EXACT implementation order for smooth, tracked implementation  
**Usage**: Follow prompts sequentially from Step 1 onwards - each prompt builds on the previous  
**Last Updated**: 2025-01-XX

---

Usage:
1- Start with Step 1
2- Copy the prompt for the current step
3- Paste to your AI coding assistant
4- Complete all checklist items
5- Confirm completion before moving to the next step
6- Update progress tracking

- [ ] Update progress trackingv

---

## ⚠️ Important Usage Instructions

1. **Follow in Order**: Use prompts sequentially - don't skip steps
2. **Complete Before Moving**: Finish each step before moving to the next
3. **Update Status**: Mark checklist items as you complete them
4. **Ask Questions**: If unclear, ask before proceeding
5. **Review PRDs**: Always reference the specific PRD mentioned in each prompt

---

## Phase 1: Foundation (CRITICAL - Start Here)

### Step 1: Project Initialization & Setup

```
I'm starting implementation of CleanMateX HQ SaaS Platform Management system.

STEP 1: Project Initialization

Master Plan: docs/features/PRD-SAAS-MNG-cr/MASTER_IMPLEMENTATION_PLAN.md
PRD Reference: PRD-SAAS-MNG-0011 (Standalone Module Architecture)

Tasks:
1. Review the master plan architecture section (Section 2)
2. Review the project structure section (Section 4)
3. Create platform-web directory with Next.js 14+ (App Router)
4. Create platform-api directory with NestJS
5. Set up base package.json files with TypeScript
6. Configure TypeScript with strict mode
7. Create .gitignore files for both projects
8. Set up basic folder structure as per master plan

Requirements:
- platform-web: Next.js 14+ with App Router, TypeScript, Tailwind CSS
- platform-api: NestJS 10+, TypeScript, Express
- Both must be completely separate from web-admin
- TypeScript strict mode enabled
- Proper .gitignore configured

Please:
- Create the directory structure exactly as specified in master plan
- Set up package.json with appropriate scripts
- Configure TypeScript tsconfig.json with strict mode
- Create README.md files explaining each project
- Verify the setup is correct before proceeding

After completion, confirm:
- [ ] Both projects created
- [ ] TypeScript configured
- [ ] Folder structure matches master plan
- [ ] Update progress tracking
- [ ] Ready for Step 2

```

### Step 2: Environment Configuration

```
STEP 2: Environment Configuration

Master Plan: docs/features/PRD-SAAS-MNG-cr/MASTER_IMPLEMENTATION_PLAN.md
Section: Environment Setup (Section 5)

Tasks:
1. Review environment setup section in master plan
2. Create .env.example files for platform-web
3. Create .env.example files for platform-api
4. Set up Supabase local instance (or configure cloud project)
5. Configure Redis for BullMQ (if needed)
6. Create environment variable documentation

Required Environment Variables:

platform-web/.env.local:
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_API_URL

platform-api/.env:
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY (for bypassing RLS)
- DATABASE_URL
- REDIS_URL (if using workers)
- PORT
- NODE_ENV

Please:
- Create .env.example files with all required variables
- Add comments explaining each variable
- Create setup instructions
- Verify Supabase connection works
- Test environment configuration

After completion, confirm:
- [ ] .env.example files created
- [ ] Supabase configured
- [ ] Environment variables documented
- [ ] Connection tested
- [ ] Update progress tracking
- [ ] Ready for Step 3
```

### Step 3: Base Architecture Setup - platform-web

```
STEP 3: Base Architecture Setup - platform-web (Frontend)

PRD Reference: PRD-SAAS-MNG-0011 (Standalone Module Architecture)
Master Plan: Section 2 - Architecture Overview

Tasks:
1. Install required dependencies:
   - @supabase/supabase-js, @supabase/ssr
   - shadcn/ui components
   - react-hook-form, zod
   - @tanstack/react-table
   - next-intl (for i18n)
   - zustand (for state management)

2. Configure Next.js App Router structure:
   - app/(auth)/login/ - Login page route
   - app/(hq)/dashboard/ - HQ dashboard route
   - app/(hq)/layout.tsx - HQ layout wrapper
   - app/layout.tsx - Root layout

3. Set up Supabase client:
   - lib/supabase/client.ts - Client-side client
   - lib/supabase/server.ts - Server-side client
   - Configure with separate auth for HQ

4. Create base layout structure:
   - components/layout/Sidebar.tsx
   - components/layout/Header.tsx
   - components/layout/Breadcrumbs.tsx

5. Set up i18n (next-intl):
   - messages/en.json
   - messages/ar.json
   - Configure middleware

Please:
- Follow Next.js 14 App Router best practices
- Use TypeScript strict mode
- Create proper folder structure
- Set up routing correctly
- Configure i18n for EN/AR support
- Create placeholder components for now

After completion, confirm:
- [ ] Dependencies installed
- [ ] App Router structure created
- [ ] Supabase clients configured
- [ ] Base layout components created
- [ ] i18n configured
- [ ] Ready for Step 4
```

### Step 4: Base Architecture Setup - platform-api

```
STEP 4: Base Architecture Setup - platform-api (Backend)

PRD Reference: PRD-SAAS-MNG-0011 (Standalone Module Architecture)
Master Plan: Section 2 - Architecture Overview

Tasks:
1. Install required dependencies:
   - @nestjs/common, @nestjs/core, @nestjs/platform-express
   - @supabase/supabase-js
   - class-validator, class-transformer
   - @nestjs/swagger (for API docs)

2. Create base module structure:
   - src/common/guards/ - Auth guards
   - src/common/interceptors/ - Request interceptors
   - src/common/filters/ - Exception filters
   - src/common/decorators/ - Custom decorators
   - src/config/ - Configuration

3. Set up Supabase service:
   - src/database/supabase.service.ts
   - Use SERVICE_ROLE_KEY for bypassing RLS
   - Create database client singleton

4. Create base auth guard:
   - src/common/guards/hq-auth.guard.ts
   - Verify HQ user authentication
   - Extract user from JWT

5. Set up Swagger/OpenAPI:
   - Configure Swagger module
   - Set up API documentation endpoint

6. Create base exception filter:
   - Handle errors consistently
   - Return proper error format

Please:
- Follow NestJS best practices
- Use TypeScript strict mode
- Create proper module structure
- Set up dependency injection correctly
- Configure Swagger properly
- Use service role key for database access

After completion, confirm:
- [ ] Dependencies installed
- [ ] Module structure created
- [ ] Supabase service configured
- [ ] Auth guard created
- [ ] Swagger configured
- [ ] Exception handling set up
- [ ] Ready for Step 5
```

### Step 5: Authentication System - Database Schema

```
STEP 5: Authentication System - Database Schema

PRD Reference: PRD-SAAS-MNG-0005 (Authentication & User Management)
Master Plan: Section 6 - Implementation Phases, Phase 1

Tasks:
1. Review PRD-0005 database schema section
2. Create migration file: supabase/migrations/XXXX_hq_auth_tables.sql
3. Create tables:
   - hq_users (extends auth.users)
   - hq_roles
   - hq_audit_logs
4. Create indexes for performance
5. Add comments to tables
6. Test migration locally

Migration Requirements:
- hq_users table with proper foreign key to auth_users
- hq_roles table with permissions JSONB
- hq_audit_logs table with proper indexing
- All tables must have created_at, updated_at
- Proper constraints and indexes

Please:
- Follow existing migration naming pattern
- Make migration idempotent
- Add proper comments
- Test migration on local Supabase
- Verify tables created correctly
- Create rollback SQL if needed

After completion, confirm:
- [ ] Migration file created
- [ ] Tables created successfully
- [ ] Indexes added
- [ ] Migration tested
- [ ] Ready for Step 6
```

### Step 6: Authentication System - API Implementation

```
STEP 6: Authentication System - API Implementation

PRD Reference: PRD-SAAS-MNG-0005 (Authentication & User Management)
Previous Step: Step 5 (Database schema created)

Tasks:
1. Create NestJS module: src/modules/auth/
2. Create DTOs:
   - login.dto.ts
   - create-user.dto.ts
   - update-user.dto.ts
   - create-role.dto.ts
3. Create service: auth.service.ts
   - Implement login logic
   - Implement user CRUD
   - Implement role management
   - Implement audit logging
4. Create controller: auth.controller.ts
   - POST /api/hq/v1/auth/login
   - GET /api/hq/v1/users
   - POST /api/hq/v1/users
   - PATCH /api/hq/v1/users/:id
   - GET /api/hq/v1/roles
   - POST /api/hq/v1/roles
5. Add validation using class-validator
6. Add Swagger documentation

API Endpoints to Implement (from PRD):
- POST /api/hq/v1/auth/login
- GET /api/hq/v1/users
- POST /api/hq/v1/users
- PATCH /api/hq/v1/users/:id
- POST /api/hq/v1/users/:id/invite
- POST /api/hq/v1/users/:id/deactivate
- GET /api/hq/v1/roles
- POST /api/hq/v1/roles
- GET /api/hq/v1/users/:id/permissions

Please:
- Follow NestJS patterns exactly
- Use DTOs for all requests/responses
- Add proper validation
- Implement error handling
- Add audit logging for all operations
- Document with Swagger
- Return consistent response format

After completion, confirm:
- [ ] All API endpoints implemented
- [ ] Validation added
- [ ] Error handling implemented
- [ ] Audit logging added
- [ ] Swagger documentation complete
- [ ] Ready for Step 7
```

### Step 7: Authentication System - UI Implementation

```
STEP 7: Authentication System - UI Implementation

PRD Reference: PRD-SAAS-MNG-0005 (Authentication & User Management)
Previous Step: Step 6 (API implemented)

Tasks:
1. Create login page: app/(auth)/login/page.tsx
   - Login form with email/password
   - Error handling
   - Redirect to dashboard on success
   - Bilingual support (EN/AR)

2. Create user management page: app/(hq)/users/page.tsx
   - User list table
   - Search and filter
   - Create user button
   - Edit/delete actions

3. Create user form component:
   - components/users/UserForm.tsx
   - Create and edit modes
   - Validation with react-hook-form + zod
   - Bilingual fields

4. Create role management page: app/(hq)/roles/page.tsx
   - Role list
   - Create/edit role form
   - Permission matrix

5. Add navigation links:
   - Update sidebar with Users and Roles links
   - Add proper icons

6. Implement authentication check:
   - Middleware to protect HQ routes
   - Redirect to login if not authenticated

Please:
- Use Shadcn/ui components
- Follow UI framework patterns from PRD-0010
- Add proper loading states
- Add error states
- Implement proper form validation
- Add confirmation dialogs for delete
- Make it responsive
- Support EN/AR

After completion, confirm:
- [ ] Login page created and working
- [ ] User management page created
- [ ] Role management page created
- [ ] Forms validated properly
- [ ] Navigation updated
- [ ] Auth protection working
- [ ] Ready for Step 8
```

### Step 8: UI Framework Components - Base Components

```
STEP 8: UI Framework Components - Base Components

PRD Reference: PRD-SAAS-MNG-0010 (HQ Console UI Framework)
Previous Step: Step 7 (Auth UI complete)

Tasks:
1. Install and configure Shadcn/ui:
   - Run: npx shadcn-ui@latest init
   - Configure components.json
   - Set up Tailwind CSS properly

2. Create base data table component:
   - components/tables/DataTable.tsx
   - Features: sorting, filtering, pagination
   - Uses @tanstack/react-table
   - Reusable and configurable

3. Create form components:
   - components/forms/FormField.tsx
   - components/forms/FormSelect.tsx
   - components/forms/FormDatePicker.tsx
   - Support react-hook-form + zod

4. Create dashboard widgets:
   - components/widgets/KPICard.tsx
   - components/widgets/ChartWidget.tsx
   - components/widgets/TableWidget.tsx

5. Create search and filter components:
   - components/search/SearchBar.tsx
   - components/filters/FilterPanel.tsx
   - Support advanced filtering

6. Create export/import components:
   - components/export/ExportButton.tsx
   - components/import/ImportDialog.tsx

Please:
- Follow Shadcn/ui patterns
- Make all components reusable
- Add TypeScript types
- Ensure accessibility
- Add proper error states
- Add loading states
- Document component props

After completion, confirm:
- [ ] Shadcn/ui configured
- [ ] Data table component created
- [ ] Form components created
- [ ] Dashboard widgets created
- [ ] Search/filter components created
- [ ] Export/import components created
- [ ] Ready for Step 9
```

### Step 9: Tenant Management - Database Schema

```
STEP 9: Tenant Management - Database Schema

PRD Reference: PRD-SAAS-MNG-0001 (Tenant Lifecycle Management)
Previous Step: Step 8 (UI components ready)

Tasks:
1. Review PRD-0001 database schema section
2. Review existing org_tenants_mst table structure
3. Create migration if needed for:
   - hq_tenant_status_history table
   - Any additional indexes
4. Verify org_subscriptions_mst table exists
5. Verify org_branches_mst table exists
6. Verify org_service_category_cf table exists

Note: Most tenant tables already exist. Focus on:
- Creating hq_tenant_status_history for audit
- Adding any missing indexes
- Verifying table structures match PRD

Please:
- Review existing migrations first
- Only create new tables if needed
- Add proper indexes
- Test migration
- Document any changes

After completion, confirm:
- [ ] All required tables exist
- [ ] Audit table created
- [ ] Indexes added
- [ ] Migration tested
- [ ] Ready for Step 10
```

### Step 10: Tenant Management - API Implementation

```
STEP 10: Tenant Management - API Implementation

PRD Reference: PRD-SAAS-MNG-0001 (Tenant Lifecycle Management)
Previous Step: Step 9 (Database schema ready)

Tasks:
1. Create NestJS module: src/modules/tenants/
2. Create DTOs:
   - create-tenant.dto.ts
   - update-tenant.dto.ts
   - tenant-response.dto.ts
3. Create service: tenants.service.ts
   - Implement all CRUD operations
   - Implement tenant initialization
   - Implement status management
   - Implement search/filtering
   - Implement analytics
4. Create controller: tenants.controller.ts
   - Implement all endpoints from PRD
5. Add validation
6. Add audit logging
7. Add Swagger documentation

API Endpoints to Implement (from PRD):
- POST /api/hq/v1/tenants
- GET /api/hq/v1/tenants
- GET /api/hq/v1/tenants/:id
- PATCH /api/hq/v1/tenants/:id
- POST /api/hq/v1/tenants/:id/initialize
- POST /api/hq/v1/tenants/:id/suspend
- POST /api/hq/v1/tenants/:id/activate
- DELETE /api/hq/v1/tenants/:id
- GET /api/hq/v1/tenants/:id/analytics

Special Requirements:
- Tenant initialization must create subscription, branch, service categories
- Status changes must be logged in hq_tenant_status_history
- Search must support multiple fields
- Filtering must support status, plan, region, date range

Please:
- Follow PRD API specifications exactly
- Implement tenant initialization logic
- Add proper error handling
- Add audit logging for all operations
- Implement search and filtering properly
- Add pagination support
- Document with Swagger

After completion, confirm:
- [ ] All API endpoints implemented
- [ ] Tenant initialization working
- [ ] Status management working
- [ ] Search/filtering working
- [ ] Audit logging working
- [ ] Swagger documentation complete
- [ ] Ready for Step 11
```

### Step 11: Tenant Management - UI Implementation

```
STEP 11: Tenant Management - UI Implementation

PRD Reference: PRD-SAAS-MNG-0001 (Tenant Lifecycle Management)
Previous Step: Step 10 (API implemented)

Tasks:
1. Create tenant list page: app/(hq)/tenants/page.tsx
   - Use DataTable component
   - Columns: Name, Slug, Email, Status, Plan, Created Date, Actions
   - Search functionality
   - Filters: Status, Plan, Region, Date Range
   - Pagination

2. Create tenant detail page: app/(hq)/tenants/[id]/page.tsx
   - Basic Information section (editable)
   - Subscription Details section
   - Usage Statistics section
   - Status History Timeline
   - Settings & Configuration section

3. Create tenant form component:
   - components/tenants/TenantForm.tsx
   - Create and edit modes
   - Bilingual name fields
   - Validation

4. Create tenant actions:
   - components/tenants/TenantActions.tsx
   - Suspend/Activate buttons
   - Initialize button
   - Archive button
   - Confirmation dialogs

5. Add navigation:
   - Add Tenants link to sidebar
   - Add proper icon

6. Implement real-time updates:
   - Refresh data after actions
   - Show loading states
   - Show success/error messages

Please:
- Use DataTable component from Step 8
- Follow UI requirements from PRD
- Add proper error handling
- Add loading states
- Implement confirmation dialogs
- Make it responsive
- Support EN/AR
- Add proper TypeScript types

After completion, confirm:
- [ ] Tenant list page created
- [ ] Tenant detail page created
- [ ] Tenant form created
- [ ] Actions implemented
- [ ] Navigation updated
- [ ] All features working
- [ ] Ready for Step 12
```

### Step 12: Plans & Subscriptions - Database Schema

```
STEP 12: Plans & Subscriptions - Database Schema

PRD Reference: PRD-SAAS-MNG-0002 (Plans & Subscriptions Management)
Previous Step: Step 11 (Tenant UI complete)

Tasks:
1. Review PRD-0002 database schema section
2. Create migration file for plan tables:
   - sys_plan_subscriptions_types_cf
   - sys_plan_limits_cf
   - sys_features_code_cd
   - sys_plan_features_cf
   - sys_plan_limits_cf
3. Verify org_subscriptions_mst table exists
4. Create seed data migration:
   - Seed default plans: freemium, basic, pro, plus, enterprise
   - Seed feature codes
   - Seed plan-feature mappings
   - Seed plan limits

Plan Definitions to Seed:
- freemium: 20 orders, 2 users, 1 branch, $0
- basic: 100 orders, 5 users, 1 branch, $29/month
- pro: 1000 orders, 15 users, 3 branches, $79/month
- plus: 5000 orders, 50 users, 10 branches, $199/month
- enterprise: Unlimited, custom pricing

Please:
- Follow PRD schema exactly
- Create proper foreign keys
- Add indexes
- Seed all default plans
- Seed feature codes
- Create proper mappings
- Test migration

After completion, confirm:
- [ ] All tables created
- [ ] Default plans seeded
- [ ] Features seeded
- [ ] Mappings created
- [ ] Migration tested
- [ ] Ready for Step 13
```

### Step 13: Plans & Subscriptions - API Implementation

```
STEP 13: Plans & Subscriptions - API Implementation

PRD Reference: PRD-SAAS-MNG-0002 (Plans & Subscriptions Management)
Previous Step: Step 12 (Database schema and seeds ready)

Tasks:
1. Create NestJS module: src/modules/plans/
2. Create DTOs:
   - create-plan.dto.ts
   - update-plan.dto.ts
   - assign-subscription.dto.ts
   - update-subscription.dto.ts
3. Create service: plans.service.ts
   - Plan CRUD operations
   - Subscription assignment
   - Subscription updates
   - Usage tracking
   - Limit enforcement logic
4. Create controller: plans.controller.ts
   - Implement all endpoints from PRD
5. Create usage tracking service:
   - Track orders, users, branches usage
   - Check against limits
6. Add validation
7. Add audit logging
8. Add Swagger documentation

API Endpoints to Implement (from PRD):
- GET /api/hq/v1/plans
- POST /api/hq/v1/plans
- PATCH /api/hq/v1/plans/:code
- GET /api/hq/v1/tenants/:id/subscription
- POST /api/hq/v1/tenants/:id/subscription
- PATCH /api/hq/v1/tenants/:id/subscription
- POST /api/hq/v1/tenants/:id/subscription/approve
- POST /api/hq/v1/tenants/:id/subscription/activate
- POST /api/hq/v1/tenants/:id/subscription/stop
- GET /api/hq/v1/tenants/:id/usage

Special Requirements:
- Usage tracking must be real-time
- Limit enforcement must check before operations
- Subscription assignment must create org_subscriptions_mst record
- Trial period management

Please:
- Follow PRD API specifications exactly
- Implement usage tracking properly
- Add limit enforcement logic
- Handle trial periods
- Add proper error handling
- Add audit logging
- Document with Swagger

After completion, confirm:
- [ ] All API endpoints implemented
- [ ] Usage tracking working
- [ ] Limit enforcement working
- [ ] Subscription assignment working
- [ ] Audit logging working
- [ ] Swagger documentation complete
- [ ] Ready for Step 14
```

### Step 14: Plans & Subscriptions - UI Implementation

```
STEP 14: Plans & Subscriptions - UI Implementation

PRD Reference: PRD-SAAS-MNG-0002 (Plans & Subscriptions Management)
Previous Step: Step 13 (API implemented)

Tasks:
1. Create plans management page: app/(hq)/plans/page.tsx
   - Plan list with details
   - Plan cards view option
   - Create/edit plan form
   - Feature matrix comparison

2. Create subscription management page: app/(hq)/tenants/[id]/subscription/page.tsx
   - Current plan display
   - Usage vs limits visualization
   - Plan change interface
   - Billing information

3. Create plan form component:
   - components/plans/PlanForm.tsx
   - Plan details fields
   - Feature flags configuration
   - Limits configuration

4. Create usage dashboard component:
   - components/subscriptions/UsageDashboard.tsx
   - Visual usage bars
   - Percentage indicators
   - Alerts when approaching limits

5. Add navigation:
   - Add Plans link to sidebar
   - Add Subscription link in tenant detail

6. Implement plan assignment flow:
   - Select plan
   - Configure custom limits (if needed)
   - Assign subscription
   - Show confirmation

Please:
- Use components from UI framework
- Follow UI requirements from PRD
- Add proper visualizations
- Add error handling
- Add loading states
- Make it responsive
- Support EN/AR

After completion, confirm:
- [ ] Plans management page created
- [ ] Subscription management page created
- [ ] Usage dashboard created
- [ ] Plan assignment flow working
- [ ] Navigation updated
- [ ] All features working
- [ ] Phase 1 Complete - Ready for Phase 2
```

---

## Phase 2: Core Operations (Continue After Phase 1)

### Step 15: Workflow Engine Management - Review Existing Schema

```
STEP 15: Workflow Engine Management - Review Existing Schema

PRD Reference: PRD-SAAS-MNG-0003 (Workflow Engine Management)
Previous Step: Step 14 (Phase 1 complete)

Tasks:
1. Review PRD-0003 database schema section
2. Review existing workflow tables:
   - sys_workflow_template_cd
   - sys_workflow_template_stages
   - sys_workflow_template_transitions
   - org_tenant_workflow_templates_cf
3. Verify table structures match PRD requirements
4. Check existing data/seeds
5. Identify any missing columns or indexes
6. Create migration if changes needed

Please:
- Review existing migrations first
- Check if tables already exist
- Verify structure matches PRD
- Only create migration if changes needed
- Document findings

After completion, confirm:
- [ ] Existing schema reviewed
- [ ] Any needed migrations created
- [ ] Ready for Step 16
```

### Step 16: Workflow Engine Management - API Implementation

```
STEP 16: Workflow Engine Management - API Implementation

PRD Reference: PRD-SAAS-MNG-0003 (Workflow Engine Management)
Previous Step: Step 15 (Schema reviewed)

Tasks:
1. Create NestJS module: src/modules/workflows/
2. Create DTOs for:
   - Workflow templates
   - Stages
   - Transitions
   - Assignments
3. Create service: workflows.service.ts
   - Template CRUD
   - Stage management
   - Transition management
   - Template cloning
   - Assignment to tenants
4. Create controller: workflows.controller.ts
   - Implement all endpoints from PRD
5. Add validation
6. Add audit logging
7. Add Swagger documentation

API Endpoints to Implement (from PRD):
- GET /api/hq/v1/workflow-templates
- POST /api/hq/v1/workflow-templates
- GET /api/hq/v1/workflow-templates/:id
- PATCH /api/hq/v1/workflow-templates/:id
- POST /api/hq/v1/workflow-templates/:id/stages
- PATCH /api/hq/v1/workflow-templates/:id/stages/:stageId
- DELETE /api/hq/v1/workflow-templates/:id/stages/:stageId
- POST /api/hq/v1/workflow-templates/:id/transitions
- PATCH /api/hq/v1/workflow-templates/:id/transitions/:transitionId
- POST /api/hq/v1/workflow-templates/:id/clone
- POST /api/hq/v1/workflow-templates/:id/assign

Please:
- Follow PRD API specifications exactly
- Implement template cloning properly
- Handle stage sequence ordering
- Validate transitions
- Add proper error handling
- Add audit logging
- Document with Swagger

After completion, confirm:
- [ ] All API endpoints implemented
- [ ] Template management working
- [ ] Stage management working
- [ ] Transition management working
- [ ] Cloning working
- [ ] Assignment working
- [ ] Ready for Step 17
```

### Step 17: Workflow Engine Management - UI Implementation

```
STEP 17: Workflow Engine Management - UI Implementation

PRD Reference: PRD-SAAS-MNG-0003 (Workflow Engine Management)
Previous Step: Step 16 (API implemented)

Tasks:
1. Create workflow templates list page: app/(hq)/workflows/page.tsx
   - Template list table
   - Create template button
   - Edit/delete actions

2. Create workflow editor page: app/(hq)/workflows/[id]/edit/page.tsx
   - Visual canvas-based editor
   - Drag-and-drop stages
   - Transition connections
   - Properties panel
   - Stage sequence management

3. Create workflow components:
   - components/workflows/WorkflowCanvas.tsx
   - components/workflows/StageNode.tsx
   - components/workflows/TransitionArrow.tsx
   - components/workflows/PropertiesPanel.tsx

4. Create template form:
   - components/workflows/TemplateForm.tsx
   - Basic template info
   - Bilingual fields

5. Create stage form:
   - components/workflows/StageForm.tsx
   - Stage properties
   - Sequence ordering

6. Create transition form:
   - components/workflows/TransitionForm.tsx
   - Transition rules
   - Validation settings

7. Add navigation:
   - Add Workflows link to sidebar

Please:
- Create intuitive visual editor
- Use canvas library if needed (react-flow, etc.)
- Add proper validation
- Add error handling
- Make it responsive
- Support EN/AR

After completion, confirm:
- [ ] Workflow list page created
- [ ] Visual editor created
- [ ] Stage management working
- [ ] Transition management working
- [ ] All features working
- [ ] Ready for Step 18
```

### Step 18: Service Catalog Management - API Implementation

```
STEP 18: Service Catalog Management - API Implementation

PRD Reference: PRD-SAAS-MNG-0006 (Core Data Management - Service Catalog)
Previous Step: Step 17 (Workflows UI complete)

Tasks:
1. Review PRD-0006 database schema section
2. Review existing catalog tables:
   - sys_service_category_cd
   - sys_service_type_cd
   - sys_item_type_cd
   - sys_item_fabric_type_cd
   - sys_products_init_data_mst
   - sys_item_notes_ctg_cd, sys_item_notes_cd
   - sys_item_stain_type_cd
   - sys_preference_ctg_cd, sys_preference_options_cd

3. Create NestJS module: src/modules/catalog/
4. Create generic catalog service pattern:
   - Generic CRUD operations
   - Reusable for all catalog types
5. Create specific services:
   - service-categories.service.ts
   - service-types.service.ts
   - item-types.service.ts
   - (etc. for each catalog type)
6. Create controllers for each catalog type
7. Implement push to tenants functionality
8. Add validation
9. Add audit logging
10. Add Swagger documentation

API Pattern (Generic):
- GET /api/hq/v1/catalog/{catalog-type}
- POST /api/hq/v1/catalog/{catalog-type}
- PATCH /api/hq/v1/catalog/{catalog-type}/:code
- DELETE /api/hq/v1/catalog/{catalog-type}/:code
- POST /api/hq/v1/catalog/push/:tenantId

Please:
- Create reusable generic pattern
- Support bilingual fields (name/name2)
- Implement push to tenants
- Add proper validation
- Add audit logging
- Document with Swagger

After completion, confirm:
- [ ] All catalog APIs implemented
- [ ] Generic pattern working
- [ ] Push to tenants working
- [ ] Bilingual support working
- [ ] Ready for Step 19
```

### Step 19: Service Catalog Management - UI Implementation

```
STEP 19: Service Catalog Management - UI Implementation

PRD Reference: PRD-SAAS-MNG-0006 (Core Data Management - Service Catalog)
Previous Step: Step 18 (API implemented)

Tasks:
1. Create catalog dashboard: app/(hq)/catalog/page.tsx
   - Navigation to each catalog type
   - Quick stats
   - Recent changes

2. Create catalog list pages for each type:
   - app/(hq)/catalog/service-categories/page.tsx
   - app/(hq)/catalog/service-types/page.tsx
   - app/(hq)/catalog/item-types/page.tsx
   - (etc.)

3. Create catalog form component:
   - components/catalog/CatalogForm.tsx
   - Reusable for all catalog types
   - Bilingual input fields
   - Dynamic fields based on catalog type

4. Create push to tenants component:
   - components/catalog/PushToTenantsDialog.tsx
   - Tenant selection
   - Change preview
   - Push confirmation

5. Add navigation:
   - Add Catalog link to sidebar
   - Sub-menu for catalog types

Please:
- Use reusable components
- Support bilingual fields
- Add proper validation
- Add error handling
- Make it responsive
- Support EN/AR

After completion, confirm:
- [ ] Catalog dashboard created
- [ ] All catalog list pages created
- [ ] Catalog forms working
- [ ] Push to tenants working
- [ ] Navigation updated
- [ ] Ready for Step 20
```

### Step 20: System Codes Management - API Implementation

```
STEP 20: System Codes Management - API Implementation

PRD Reference: PRD-SAAS-MNG-0007 (Core Data Management - System Codes)
Previous Step: Step 19 (Catalog UI complete)

Tasks:
1. Review PRD-0007 database schema section
2. Review existing sys_*_cd tables:
   - sys_currency_cd
   - sys_color_cd
   - sys_icons_cd
   - sys_priority_cd
   - sys_product_unit_cd
   - sys_invoice_type_cd
   - sys_order_status_cd
   - sys_org_type_cd
   - sys_payment_method_cd
   - sys_payment_type_cd
   - sys_order_type_cd

3. Create NestJS module: src/modules/codes/
4. Create generic code service:
   - Generic CRUD for any sys_*_cd table
   - Code locking mechanism
   - Dependency validation
5. Create controller with dynamic routes:
   - GET /api/hq/v1/codes/:tableName
   - POST /api/hq/v1/codes/:tableName
   - PATCH /api/hq/v1/codes/:tableName/:code
   - DELETE /api/hq/v1/codes/:tableName/:code
   - POST /api/hq/v1/codes/:tableName/:code/lock
   - POST /api/hq/v1/codes/:tableName/:code/unlock
6. Add validation
7. Add code locking logic
8. Add dependency checking
9. Add audit logging
10. Add Swagger documentation

Please:
- Create truly generic service
- Support all sys_*_cd tables
- Implement code locking
- Check dependencies before deletion
- Add proper validation
- Add audit logging

After completion, confirm:
- [ ] Generic code API implemented
- [ ] Code locking working
- [ ] Dependency validation working
- [ ] All code tables supported
- [ ] Ready for Step 21
```

### Step 21: System Codes Management - UI Implementation

```
STEP 21: System Codes Management - UI Implementation

PRD Reference: PRD-SAAS-MNG-0007 (Core Data Management - System Codes)
Previous Step: Step 20 (API implemented)

Tasks:
1. Create codes dashboard: app/(hq)/codes/page.tsx
   - List of all code tables
   - Quick stats
   - Locked codes indicator

2. Create code table page: app/(hq)/codes/[tableName]/page.tsx
   - Dynamic route for any code table
   - Code list with table
   - Search and filter
   - Create/edit/delete actions

3. Create code form component:
   - components/codes/CodeForm.tsx
   - Reusable for all code types
   - Bilingual fields
   - Lock indicator

4. Create code locking UI:
   - Lock/unlock buttons
   - Lock status indicator
   - Confirmation for locked code changes

5. Add dependency warning:
   - Show dependencies before deletion
   - Prevent deletion if dependencies exist

6. Add navigation:
   - Add Codes link to sidebar

Please:
- Use generic approach
- Support all code tables
- Add code locking UI
- Show dependency warnings
- Add proper validation
- Make it responsive

After completion, confirm:
- [ ] Codes dashboard created
- [ ] Code table pages working
- [ ] Code locking UI working
- [ ] Dependency warnings working
- [ ] Navigation updated
- [ ] Ready for Step 22
```

### Step 22: Security & RLS Governance - Implementation

```
STEP 22: Security & RLS Governance - Implementation

PRD Reference: PRD-SAAS-MNG-0014 (Security, RLS & Governance)
Previous Step: Step 21 (Codes UI complete)

Tasks:
1. Review PRD-0014 requirements
2. Create security module: src/modules/security/
3. Create RLS policy management:
   - View existing policies
   - Test policies
   - Deploy policies
4. Create security audit logging:
   - Enhanced audit logging
   - Security event tracking
5. Create security dashboard:
   - Security overview
   - Policy status
   - Audit log viewer
   - Vulnerability reports
6. Implement access control management:
   - Policy definitions
   - Policy enforcement
7. Add security monitoring
8. Create security UI pages

Please:
- Follow PRD specifications
- Implement RLS policy management
- Add comprehensive audit logging
- Create security dashboard
- Add proper error handling

After completion, confirm:
- [ ] RLS policy management working
- [ ] Security audit logging working
- [ ] Security dashboard created
- [ ] Access control working
- [ ] Ready for Step 23
```

### Step 23: Observability & SLO Enforcement - Setup

```
STEP 23: Observability & SLO Enforcement - Setup

PRD Reference: PRD-SAAS-MNG-0013 (Observability & SLO Enforcement)
Previous Step: Step 22 (Security complete)

Tasks:
1. Review PRD-0013 requirements
2. Set up Sentry integration:
   - Install Sentry SDK
   - Configure error tracking
   - Set up alerts
3. Set up Prometheus metrics:
   - Install Prometheus client
   - Define custom metrics
   - Expose metrics endpoint
4. Set up Grafana dashboards:
   - Create dashboard configurations
   - Set up data sources
5. Implement SLI tracking:
   - Availability SLI
   - Latency SLI
   - Error rate SLI
6. Implement SLO enforcement:
   - Define SLO targets
   - Track SLO compliance
   - Alert on violations
7. Create observability dashboard UI

Please:
- Follow PRD specifications
- Set up all monitoring tools
- Implement SLI/SLO tracking
- Create dashboards
- Add alerting

After completion, confirm:
- [ ] Sentry configured
- [ ] Prometheus configured
- [ ] Grafana dashboards created
- [ ] SLI tracking working
- [ ] SLO enforcement working
- [ ] Observability dashboard created
- [ ] Phase 2 Complete - Ready for Phase 3
```

---

## Phase 3: Advanced Features (Continue After Phase 2)

### Step 24: Customer Data Management - Implementation

```
STEP 24: Customer Data Management - Implementation

PRD Reference: PRD-SAAS-MNG-0004 (Customer Data Management)
Previous Step: Step 23 (Phase 2 complete)

Tasks:
1. Review PRD-0004 requirements
2. Review existing customer tables:
   - sys_customers_mst (global)
   - org_customers_mst (tenant)
3. Create customer management module
4. Implement API endpoints:
   - Global customer management
   - Tenant customer management
   - Customer linking
   - Customer deduplication
   - Cross-tenant search
5. Create customer management UI:
   - Global customer list
   - Tenant customer list
   - Customer detail view
   - Linking interface
   - Merge interface
6. Implement search functionality
7. Add export/import

Please:
- Follow PRD specifications exactly
- Implement two-layer customer system
- Add proper privacy controls
- Add audit logging
- Create intuitive UI

After completion, confirm:
- [ ] All APIs implemented
- [ ] Customer management UI created
- [ ] Linking working
- [ ] Deduplication working
- [ ] Search working
- [ ] Ready for Step 25
```

### Step 25: Data Seeding & Initialization - Implementation

```
STEP 25: Data Seeding & Initialization - Implementation

PRD Reference: PRD-SAAS-MNG-0008 (Data Seeding & Initialization)
Previous Step: Step 24 (Customer management complete)

Tasks:
1. Review PRD-0008 requirements
2. Create seed version tracking table
3. Create seed management module
4. Implement seed execution API
5. Implement seed validation
6. Implement versioning system
7. Implement rollback functionality
8. Create seed management UI
9. Create seed execution interface

Please:
- Follow PRD specifications
- Implement versioning
- Add validation
- Add rollback capability
- Create management UI

After completion, confirm:
- [ ] Seed management working
- [ ] Versioning working
- [ ] Rollback working
- [ ] UI created
- [ ] Ready for Step 26
```

### Step 26: Platform Analytics & Monitoring - Implementation

```
STEP 26: Platform Analytics & Monitoring - Implementation

PRD Reference: PRD-SAAS-MNG-0009 (Platform Analytics & Monitoring)
Previous Step: Step 25 (Seeding complete)

Tasks:
1. Review PRD-0009 requirements
2. Create metrics aggregation tables
3. Implement analytics API:
   - Platform KPIs
   - Tenant analytics
   - Subscription analytics
4. Create analytics dashboard UI
5. Implement alert center
6. Create audit log viewer UI
7. Add report export functionality

Please:
- Follow PRD specifications
- Implement all analytics endpoints
- Create comprehensive dashboard
- Add alert management
- Add export functionality

After completion, confirm:
- [ ] Analytics APIs implemented
- [ ] Dashboard created
- [ ] Alert center working
- [ ] Audit log viewer created
- [ ] Export working
- [ ] Ready for Step 27
```

### Step 27: Automation & Worker Architecture - Setup

```
STEP 27: Automation & Worker Architecture - Setup

PRD Reference: PRD-SAAS-MNG-0012 (Automation & Worker Architecture)
Previous Step: Step 26 (Analytics complete)

Tasks:
1. Review PRD-0012 requirements
2. Set up Redis for BullMQ
3. Create platform-workers directory
4. Install BullMQ
5. Create worker processes:
   - Email worker
   - Report worker
   - Sync worker
6. Create scheduled jobs:
   - Subscription renewal checks
   - Trial expiration processing
   - Usage reset
7. Set up job monitoring (Bull Board)
8. Create job monitoring UI

Please:
- Follow PRD specifications
- Set up BullMQ properly
- Create worker processes
- Implement scheduled tasks
- Add monitoring

After completion, confirm:
- [ ] Workers set up
- [ ] Scheduled jobs working
- [ ] Job monitoring working
- [ ] UI created
- [ ] Ready for Step 28
```

### Step 28: Support & Impersonation - Implementation

```
STEP 28: Support & Impersonation - Implementation

PRD Reference: PRD-SAAS-MNG-0024 (Support & Impersonation)
Previous Step: Step 27 (Workers complete)

Tasks:
1. Review PRD-0024 requirements
2. Create impersonation system:
   - Impersonation API
   - Session management
   - Approval workflow
   - Audit logging
3. Create support ticket system:
   - Ticket management API
   - Ticket UI
4. Create support agent dashboard
5. Implement knowledge base
6. Add support metrics

Please:
- Follow PRD specifications
- Implement secure impersonation
- Add approval workflow
- Add comprehensive audit logging
- Create support tools

After completion, confirm:
- [ ] Impersonation working
- [ ] Ticket system working
- [ ] Support dashboard created
- [ ] Knowledge base created
- [ ] Ready for Step 29
```

### Step 29: Import/Export & Onboarding - Implementation

```
STEP 29: Import/Export & Onboarding - Implementation

PRD Reference: PRD-SAAS-MNG-0022 (Import / Export & Onboarding Tooling)
Previous Step: Step 28 (Support complete)

Tasks:
1. Review PRD-0022 requirements
2. Implement import functionality:
   - CSV import
   - JSON import
   - Excel import
   - Validation
   - Error handling
3. Implement export functionality:
   - CSV export
   - JSON export
   - Excel export
   - Scheduled exports
4. Create bulk onboarding tools
5. Create data migration tools
6. Create onboarding checklist system
7. Create import/export UI

Please:
- Follow PRD specifications
- Support all formats
- Add proper validation
- Add error handling
- Create intuitive UI

After completion, confirm:
- [ ] Import working
- [ ] Export working
- [ ] Bulk onboarding working
- [ ] Migration tools created
- [ ] UI created
- [ ] Phase 3 Complete - Ready for Phase 4
```

---

## Phase 4: Infrastructure & Scale (Continue After Phase 3)

### Step 30: CI/CD & Schema Control - Setup

```
STEP 30: CI/CD & Schema Control - Setup

PRD Reference: PRD-SAAS-MNG-0016 (CI/CD & Schema Control)
Previous Step: Step 29 (Phase 3 complete)

Tasks:
1. Review PRD-0016 requirements
2. Set up GitHub Actions (or GitLab CI):
   - Lint and format check
   - Unit tests
   - Integration tests
   - Build
   - E2E tests
3. Set up database migration system:
   - Migration testing
   - Migration approval workflow
4. Create schema versioning
5. Create schema diff tools
6. Set up staging environment
7. Configure production deployment

Please:
- Follow PRD specifications
- Set up complete CI/CD pipeline
- Add migration management
- Set up environments
- Add deployment automation

After completion, confirm:
- [ ] CI/CD pipeline working
- [ ] Migration system working
- [ ] Environments configured
- [ ] Deployment automated
- [ ] Ready for Step 31
```

### Step 31: Deployment & Ops - Configuration

```
STEP 31: Deployment & Ops - Configuration

PRD Reference: PRD-SAAS-MNG-0017 (Deployment & Ops)
Previous Step: Step 30 (CI/CD complete)

Tasks:
1. Review PRD-0017 requirements
2. Set up production infrastructure:
   - Vercel for platform-web
   - Railway/Render for platform-api
   - Supabase production project
3. Configure health checks
4. Set up graceful shutdown
5. Configure SSL/TLS
6. Set up CDN
7. Configure load balancing (if needed)
8. Create deployment runbooks
9. Set up monitoring

Please:
- Follow PRD specifications
- Set up production infrastructure
- Add health checks
- Configure properly
- Create documentation

After completion, confirm:
- [ ] Production infrastructure set up
- [ ] Health checks working
- [ ] SSL configured
- [ ] Monitoring set up
- [ ] Runbooks created
- [ ] Ready for Step 32
```

### Step 32: Backup, BCDR, and Tenant Restore - Implementation

```
STEP 32: Backup, BCDR, and Tenant Restore - Implementation

PRD Reference: PRD-SAAS-MNG-0021 (Backup, BCDR, and Tenant-Level Restore)
Previous Step: Step 31 (Deployment configured)

Tasks:
1. Review PRD-0021 requirements
2. Set up automated backups:
   - Daily backups
   - Point-in-time recovery
3. Implement tenant-level backup
4. Implement tenant-level restore
5. Create backup monitoring
6. Set up DR procedures
7. Create backup/restore UI
8. Test backup and restore

Please:
- Follow PRD specifications
- Set up automated backups
- Implement tenant-level operations
- Add monitoring
- Create UI
- Test thoroughly

After completion, confirm:
- [ ] Automated backups working
- [ ] Tenant backup working
- [ ] Tenant restore working
- [ ] Monitoring working
- [ ] UI created
- [ ] Ready for Step 33
```

### Step 33: Performance & Load Guardrails - Implementation

```
STEP 33: Performance & Load Guardrails - Implementation

PRD Reference: PRD-SAAS-MNG-0025 (Performance & Load Guardrails)
Previous Step: Step 32 (Backup complete)

Tasks:
1. Review PRD-0025 requirements
2. Set up performance monitoring
3. Implement load testing framework
4. Add resource monitoring
5. Implement query optimization
6. Add resource throttling
7. Set up auto-scaling
8. Create performance dashboard

Please:
- Follow PRD specifications
- Set up monitoring
- Implement load testing
- Add optimizations
- Set up auto-scaling

After completion, confirm:
- [ ] Performance monitoring working
- [ ] Load testing set up
- [ ] Resource monitoring working
- [ ] Auto-scaling configured
- [ ] Dashboard created
- [ ] Ready for Step 34
```

### Step 34: Data Residency & Multi-Region - Setup

```
STEP 34: Data Residency & Multi-Region - Setup

PRD Reference: PRD-SAAS-MNG-0020 (Data Residency & Multi-Region)
Previous Step: Step 33 (Performance complete)

Tasks:
1. Review PRD-0020 requirements
2. Set up GCC region infrastructure
3. Implement region selection
4. Set up regional databases
5. Implement data residency controls
6. Add compliance reporting
7. Create region management UI

Please:
- Follow PRD specifications
- Set up GCC region
- Implement region selection
- Add compliance controls
- Create UI

After completion, confirm:
- [ ] GCC region set up
- [ ] Region selection working
- [ ] Data residency controls working
- [ ] Compliance reporting working
- [ ] UI created
- [ ] Phase 4 Complete - Ready for Phase 5
```

---

## Phase 5: Advanced Capabilities (Continue After Phase 4)

### Step 35: AI/Automation Layer - Implementation

```
STEP 35: AI/Automation Layer - Implementation

PRD Reference: PRD-SAAS-MNG-0015 (AI / Automation Layer)
Previous Step: Step 34 (Phase 4 complete)

Tasks:
1. Review PRD-0015 requirements
2. Set up AI service integrations (OpenAI/Claude)
3. Implement AI-powered features:
   - Customer support chatbot
   - Anomaly detection
   - Predictive analytics
   - Smart alerting
4. Create AI dashboard
5. Add AI configuration UI

Please:
- Follow PRD specifications
- Set up AI services
- Implement features
- Add monitoring
- Create UI

After completion, confirm:
- [ ] AI services integrated
- [ ] Features implemented
- [ ] Dashboard created
- [ ] Ready for Step 36
```

### Step 36: Licensing & Entitlements - Implementation

```
STEP 36: Licensing & Entitlements - Implementation

PRD Reference: PRD-SAAS-MNG-0018 (Licensing & Entitlements)
Previous Step: Step 35 (AI complete)

Tasks:
1. Review PRD-0018 requirements
2. Create license tables
3. Implement license management API
4. Implement license validation
5. Add entitlement tracking
6. Create license management UI

Please:
- Follow PRD specifications
- Implement license system
- Add validation
- Create UI

After completion, confirm:
- [ ] License system working
- [ ] Validation working
- [ ] UI created
- [ ] Ready for Step 37
```

### Step 37: Tenant Customization Layer - Implementation

```
STEP 37: Tenant Customization Layer - Implementation

PRD Reference: PRD-SAAS-MNG-0019 (Tenant/Org Customization Layer)
Previous Step: Step 36 (Licensing complete)

Tasks:
1. Review PRD-0019 requirements
2. Create customization tables
3. Implement customization API
4. Create customization UI:
   - Branding management
   - Custom fields
   - Workflow customizations
   - Report templates
5. Add white-label support

Please:
- Follow PRD specifications
- Implement customization system
- Create comprehensive UI
- Add white-label features

After completion, confirm:
- [ ] Customization system working
- [ ] UI created
- [ ] White-label working
- [ ] Ready for Step 38
```

### Step 38: Developer & Integration Portal - Implementation

```
STEP 38: Developer & Integration Portal - Implementation

PRD Reference: PRD-SAAS-MNG-0023 (Developer & Integration Portal)
Previous Step: Step 37 (Customization complete)

Tasks:
1. Review PRD-0023 requirements
2. Implement API key management
3. Set up API documentation (Swagger)
4. Implement webhook management
5. Create integration testing tools
6. Add API usage analytics
7. Create developer portal UI

Please:
- Follow PRD specifications
- Set up API documentation
- Implement webhooks
- Add analytics
- Create portal UI

After completion, confirm:
- [ ] API key management working
- [ ] Documentation set up
- [ ] Webhooks working
- [ ] Analytics working
- [ ] Portal created
- [ ] Ready for Step 39
```

### Step 39: Reporting, Analytics & Billing - Implementation

```
STEP 39: Reporting, Analytics & Billing - Implementation

PRD Reference: PRD-SAAS-MNG-0027 (Reporting, Analytics, and Billing Insights)
Previous Step: Step 38 (Developer portal complete)

Tasks:
1. Review PRD-0027 requirements
2. Implement advanced analytics API
3. Create custom report builder
4. Implement report export
5. Add billing insights
6. Create analytics dashboard
7. Add scheduled reports

Please:
- Follow PRD specifications
- Implement analytics
- Create report builder
- Add export functionality
- Create comprehensive dashboard

After completion, confirm:
- [ ] Analytics implemented
- [ ] Report builder created
- [ ] Export working
- [ ] Dashboard created
- [ ] Phase 5 Complete - Ready for Phase 6
```

---

## Phase 6: Quality & Compliance (Final Phase)

### Step 40: Testing & QA Matrix - Comprehensive Testing

```
STEP 40: Testing & QA Matrix - Comprehensive Testing

PRD Reference: PRD-SAAS-MNG-0026 (Testing & QA Matrix)
Previous Step: Step 39 (Phase 5 complete)

Tasks:
1. Review PRD-0026 requirements
2. Review existing test coverage
3. Fill gaps in unit tests (target > 80%)
4. Add missing integration tests
5. Add E2E tests for critical paths
6. Set up performance testing
7. Set up security testing
8. Create QA dashboard
9. Set up test automation in CI

Please:
- Follow PRD testing strategy
- Achieve coverage targets
- Add all test types
- Set up automation
- Create dashboard

After completion, confirm:
- [ ] Unit test coverage > 80%
- [ ] Integration tests complete
- [ ] E2E tests complete
- [ ] Performance tests set up
- [ ] Security tests set up
- [ ] QA dashboard created
- [ ] Ready for Step 41
```

### Step 41: Compliance & Policy Management - Implementation

```
STEP 41: Compliance & Policy Management - Implementation

PRD Reference: PRD-SAAS-MNG-0028 (Compliance & Policy Management)
Previous Step: Step 40 (Testing complete)

Tasks:
1. Review PRD-0028 requirements
2. Implement GDPR compliance features:
   - Data subject rights
   - Right to be forgotten
   - Data portability
   - Consent management
3. Implement data retention policies
4. Create policy management system
5. Add compliance reporting
6. Create compliance dashboard
7. Add compliance checklists

Please:
- Follow PRD specifications
- Implement GDPR features
- Add policy management
- Create compliance tools
- Add reporting

After completion, confirm:
- [ ] GDPR features implemented
- [ ] Policy management working
- [ ] Compliance reporting working
- [ ] Dashboard created
- [ ] All PRDs Complete!
```

---

## Final Step: Project Completion Review

### Step 42: Final Review & Documentation

```
FINAL STEP: Project Completion Review

All PRDs: Complete implementation review

Tasks:
1. Review all 28 PRDs implementation status
2. Verify all checklist items completed
3. Review code quality across all modules
4. Verify test coverage meets targets
5. Review documentation completeness
6. Perform security audit
7. Performance review
8. Create final implementation report
9. Update master plan with completion status
10. Create user guides
11. Create developer guides
12. Create deployment guides

Please:
- Comprehensive review of all work
- Identify any gaps
- Verify quality standards
- Complete documentation
- Create final reports

After completion, confirm:
- [ ] All PRDs implemented
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Security reviewed
- [ ] Performance verified
- [ ] Guides created
- [ ] Project Complete!
```

---

## Usage Instructions

### How to Use These Prompts

1. **Start at Step 1**: Begin with project initialization
2. **Complete Each Step**: Don't skip steps - each builds on the previous
3. **Update Status**: Mark checklist items as you complete them
4. **Reference PRDs**: Always have the relevant PRD open while working
5. **Ask Questions**: If unclear about any step, ask before proceeding
6. **Track Progress**: Update the master plan with your progress

### Progress Tracking

After completing each step, update:
- PRD implementation checklist
- Master plan progress section
- Your project management tool

### When Stuck

If you encounter issues:
1. Review the PRD again
2. Check the master plan architecture section
3. Review existing code patterns
4. Use troubleshooting prompts from IMPLEMENTATION_PROMPTS.md
5. Ask for help with specific issue

### Quality Checklist (Apply to Each Step)

- [ ] Code follows TypeScript strict mode
- [ ] Follows master plan code standards
- [ ] Proper error handling
- [ ] Input validation added
- [ ] Audit logging where required
- [ ] Tests written
- [ ] Documentation updated
- [ ] PRD checklist items marked complete

---

## Quick Reference

**Total Steps**: 42 steps across 6 phases  
**Estimated Timeline**: 12-18 months  
**Critical Path**: Steps 1-14 (Phase 1) must be completed first

**Key Milestones**:
- Step 14: Phase 1 Complete (Foundation)
- Step 23: Phase 2 Complete (Core Operations)
- Step 29: Phase 3 Complete (Advanced Features)
- Step 34: Phase 4 Complete (Infrastructure)
- Step 39: Phase 5 Complete (Advanced Capabilities)
- Step 41: Phase 6 Complete (Quality & Compliance)
- Step 42: Project Complete

---

**Remember**: Follow prompts sequentially, complete each step fully, and maintain quality standards throughout!


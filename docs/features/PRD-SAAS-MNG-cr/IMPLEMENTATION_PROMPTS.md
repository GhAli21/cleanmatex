# CleanMateX HQ SaaS Platform Management - Implementation Prompts

**Purpose**: Copy-paste prompts for AI coding assistants to ensure smooth, tracked implementation  
**Usage**: Copy the relevant prompt and paste it when starting a new implementation task  
**Last Updated**: 2025-01-XX

---

## Table of Contents

1. [Initial Setup Prompts](#initial-setup-prompts)
2. [Phase 1 Prompts](#phase-1-prompts)
3. [Phase 2 Prompts](#phase-2-prompts)
4. [General Implementation Prompts](#general-implementation-prompts)
5. [Code Review Prompts](#code-review-prompts)
6. [Testing Prompts](#testing-prompts)
7. [Documentation Prompts](#documentation-prompts)
8. [Progress Tracking Prompts](#progress-tracking-prompts)
9. [Troubleshooting Prompts](#troubleshooting-prompts)

---

## Initial Setup Prompts

### Prompt 1: Project Initialization

```
I'm starting implementation of CleanMateX HQ SaaS Platform Management system. 
Please help me set up the initial project structure.

Context:
- Master Plan: docs/features/PRD-SAAS-MNG-cr/MASTER_IMPLEMENTATION_PLAN.md
- We need to create platform-web (Next.js) and platform-api (NestJS) as standalone applications
- Complete isolation from existing web-admin application
- Use TypeScript, strict mode enabled
- Follow the project structure defined in the master plan

Tasks:
1. Review the master plan and understand the architecture
2. Create platform-web Next.js project with App Router
3. Create platform-api NestJS project
4. Set up base configuration files
5. Configure environment variables structure
6. Set up basic folder structure as per master plan

Please:
- Ask clarifying questions if anything is unclear
- Follow TypeScript best practices
- Create proper .gitignore files
- Set up package.json with appropriate dependencies
- Provide step-by-step guidance
```

### Prompt 2: Environment Configuration

```
Help me set up the development environment for CleanMateX HQ Console.

Requirements:
- Supabase local instance (or cloud project)
- Separate authentication for HQ users
- Environment variables for platform-web and platform-api
- Redis for BullMQ (if needed)
- Development scripts

Please:
1. Review the environment setup section in MASTER_IMPLEMENTATION_PLAN.md
2. Create .env.example files for both applications
3. Provide setup instructions
4. Verify all required services are configured
5. Test the setup works correctly
```

---

## Phase 1 Prompts

### Prompt 3: Standalone Module Architecture (PRD-0011)

```
Implement PRD-SAAS-MNG-0011: Standalone Module Architecture

PRD Location: docs/features/PRD-SAAS-MNG-cr/PRD-SAAS-MNG-0011_Standalone_Module_Architecture.md
Master Plan: docs/features/PRD-SAAS-MNG-cr/MASTER_IMPLEMENTATION_PLAN.md

Requirements:
1. Create platform-web Next.js application with:
   - App Router structure
   - Separate authentication system
   - Base layout and navigation
   - Environment configuration
   
2. Create platform-api NestJS application with:
   - Module structure
   - Authentication guards
   - Database connection (Supabase service role)
   - Base API structure

3. Ensure complete isolation from web-admin:
   - No shared code
   - Separate routing
   - Independent authentication
   - Separate deployment configs

Please:
- Follow the PRD specifications exactly
- Implement all items in the PRD implementation checklist
- Use TypeScript strict mode
- Follow the code standards in the master plan
- Create proper error handling
- Add basic logging
- Provide implementation status updates
```

### Prompt 4: HQ Console UI Framework (PRD-0010)

```
Implement PRD-SAAS-MNG-0010: HQ Console UI Framework

PRD Location: docs/features/PRD-SAAS-MNG-cr/PRD-SAAS-MNG-0010_HQ_Console_UI_Framework.md
Dependencies: PRD-0011 must be completed first

Requirements:
1. Install and configure Shadcn/ui component library
2. Set up Tailwind CSS with proper configuration
3. Create base layout components:
   - Sidebar navigation
   - Top header with user menu
   - Breadcrumb navigation
   - Mobile responsive design
   
4. Create reusable components:
   - Data table with sorting/filtering/pagination
   - Form components with validation
   - Dashboard widgets
   - Search and filter components
   - Export/import UI components

5. Set up i18n (next-intl) for EN/AR support

Please:
- Follow the PRD specifications
- Use TypeScript for all components
- Ensure accessibility (WCAG 2.1 AA)
- Make components reusable and well-documented
- Add proper error boundaries
- Implement loading states
- Follow the design system guidelines
```

### Prompt 5: Authentication & User Management (PRD-0005)

```
Implement PRD-SAAS-MNG-0005: Authentication & User Management

PRD Location: docs/features/PRD-SAAS-MNG-cr/PRD-SAAS-MNG-0005_Auth_User_Management.md
Dependencies: PRD-0011, PRD-0010

Requirements:
1. Create HQ user tables (hq_users, hq_roles, hq_audit_logs)
2. Implement authentication API endpoints:
   - Login
   - Logout
   - User management CRUD
   - Role management
   - Permission checking
   
3. Create authentication UI:
   - Login page (separate from web-admin)
   - User management page
   - Role management page
   - Permission matrix

4. Implement audit logging for all user actions

Please:
- Follow the PRD database schema exactly
- Implement all API endpoints from the PRD
- Use Supabase Auth for authentication
- Add proper validation (Zod schemas)
- Implement role-based access control
- Add comprehensive error handling
- Create proper TypeScript types
- Write unit tests for critical functions
- Update implementation checklist as you go
```

### Prompt 6: Tenant Lifecycle Management (PRD-0001)

```
Implement PRD-SAAS-MNG-0001: Tenant Lifecycle Management

PRD Location: docs/features/PRD-SAAS-MNG-cr/PRD-SAAS-MNG-0001_Tenant_Lifecycle_Management.md
Dependencies: PRD-0011, PRD-0010, PRD-0005

Requirements:
1. Implement tenant management API:
   - Create tenant
   - List tenants with search/filtering
   - Get tenant details
   - Update tenant
   - Initialize tenant
   - Suspend/activate tenant
   - Archive tenant
   - Get tenant analytics

2. Create tenant management UI:
   - Tenant list page with table
   - Tenant detail page
   - Tenant creation form
   - Tenant edit form
   - Search and filter interface

3. Implement tenant initialization automation:
   - Create subscription
   - Create default branch
   - Enable service categories
   - Set default workflow templates

Please:
- Follow the PRD API endpoint specifications exactly
- Use existing org_tenants_mst table structure
- Implement proper validation
- Add audit logging for all operations
- Handle errors gracefully
- Implement proper loading states
- Add confirmation dialogs for destructive operations
- Create TypeScript types matching the PRD
- Write tests as specified in PRD
- Mark checklist items as complete
```

### Prompt 7: Plans & Subscriptions Management (PRD-0002)

```
Implement PRD-SAAS-MNG-0002: Plans & Subscriptions Management

PRD Location: docs/features/PRD-SAAS-MNG-cr/PRD-SAAS-MNG-0002_Plans_Subscriptions_Management.md
Dependencies: PRD-0001

Requirements:
1. Create plan definition tables:
   - sys_plan_subscriptions_types_cf
   - sys_plan_limits_cf
   - sys_features_code_cd
   - sys_plan_features_cf
   - sys_plan_limits_cf

2. Seed default plans:
   - freemium (free trial)
   - basic
   - pro
   - plus
   - enterprise

3. Implement plan management API:
   - CRUD operations for plans
   - Subscription assignment
   - Subscription updates
   - Usage tracking
   - Limit enforcement

4. Create plan management UI:
   - Plan list page
   - Plan detail/edit page
   - Subscription management interface
   - Usage dashboard

Please:
- Follow the PRD database schema exactly
- Seed plans with proper feature flags and limits
- Implement all API endpoints from PRD
- Add usage tracking functions
- Implement limit enforcement middleware
- Create proper UI components
- Add validation for all inputs
- Write comprehensive tests
- Update checklist as you progress
```

---

## Phase 2 Prompts

### Prompt 8: Workflow Engine Management (PRD-0003)

```
Implement PRD-SAAS-MNG-0003: Workflow Engine Management

PRD Location: docs/features/PRD-SAAS-MNG-cr/PRD-SAAS-MNG-0003_Workflow_Engine_Management.md
Dependencies: PRD-0001

Requirements:
1. Review existing workflow tables:
   - sys_workflow_template_cd
   - sys_workflow_template_stages
   - sys_workflow_template_transitions

2. Implement workflow template API:
   - CRUD operations
   - Stage management
   - Transition management
   - Template cloning
   - Template assignment

3. Create visual workflow editor UI:
   - Canvas-based interface
   - Drag-and-drop stages
   - Transition connections
   - Properties panel

Please:
- Review existing database schema first
- Follow PRD API specifications
- Create intuitive UI for workflow editing
- Add proper validation
- Implement versioning support
- Write tests
- Update checklist
```

### Prompt 9: Core Data Management - Service Catalog (PRD-0006)

```
Implement PRD-SAAS-MNG-0006: Core Data Management - Service Catalog

PRD Location: docs/features/PRD-SAAS-MNG-cr/PRD-SAAS-MNG-0006_Core_Data_Service_Catalog.md
Dependencies: PRD-0010

Requirements:
1. Implement catalog management APIs for:
   - sys_service_category_cd
   - sys_service_type_cd
   - sys_item_type_cd
   - sys_item_fabric_type_cd
   - sys_products_init_data_mst
   - sys_item_notes_ctg_cd, sys_item_notes_cd
   - sys_item_stain_type_cd
   - sys_preference_ctg_cd, sys_preference_options_cd

2. Create catalog management UI:
   - List views for each catalog type
   - Create/edit forms
   - Bilingual support (EN/AR)
   - Push to tenants functionality

Please:
- Review existing catalog tables first
- Implement generic catalog API pattern
- Add bilingual input fields
- Implement versioning
- Add push to tenants feature
- Write tests
- Follow PRD specifications exactly
```

---

## General Implementation Prompts

### Prompt 10: Starting a New PRD Implementation

```
I'm starting implementation of [PRD-NUMBER]: [PRD-NAME]

PRD Location: docs/features/PRD-SAAS-MNG-cr/PRD-SAAS-MNG-[NUMBER]_[NAME].md
Master Plan: docs/features/PRD-SAAS-MNG-cr/MASTER_IMPLEMENTATION_PLAN.md
Dependencies: [List dependencies]

Before starting:
1. Read and understand the PRD completely
2. Review the master plan for architecture guidelines
3. Check dependencies are completed
4. Review existing codebase for similar patterns

Implementation approach:
1. Start with database schema (if new tables needed)
2. Implement API endpoints
3. Create TypeScript types
4. Build UI components
5. Add validation and error handling
6. Write tests
7. Update documentation

Please:
- Follow the PRD implementation checklist
- Use TypeScript strict mode
- Follow code standards from master plan
- Add proper error handling
- Implement audit logging where required
- Create reusable components
- Write tests as specified
- Update checklist items as you complete them
- Ask questions if anything is unclear
- Provide progress updates regularly
```

### Prompt 11: Database Migration Creation

```
I need to create a database migration for [feature name].

Context:
- Using Supabase migrations
- Migration files in supabase/migrations/
- Follow existing migration naming pattern
- Must be idempotent

Requirements:
1. Create new tables: [list tables]
2. Add columns to existing tables: [list changes]
3. Create indexes: [list indexes]
4. Add RLS policies if needed: [list policies]
5. Seed initial data if needed: [list seed data]

Please:
- Review existing migrations for patterns
- Use proper SQL syntax
- Add comments explaining the migration
- Make it idempotent (use IF NOT EXISTS, etc.)
- Test the migration locally first
- Provide rollback SQL if needed
```

### Prompt 12: API Endpoint Implementation

```
I need to implement API endpoint: [METHOD] /api/hq/v1/[endpoint]

PRD Reference: [PRD-NUMBER] - [Feature Name]
Specification: [Copy API spec from PRD]

Requirements:
1. Create controller/route handler
2. Add request validation (Zod schema)
3. Implement business logic
4. Add error handling
5. Return proper response format
6. Add audit logging
7. Check permissions/authorization

Please:
- Follow NestJS patterns (or Next.js API route patterns)
- Use TypeScript types from PRD
- Add proper error handling
- Return consistent response format
- Add input validation
- Check user permissions
- Log operations for audit
- Write unit tests
- Document the endpoint
```

### Prompt 13: UI Component Creation

```
I need to create a UI component: [Component Name]

PRD Reference: [PRD-NUMBER] - [Feature Name]
Requirements: [Copy from PRD UI/UX section]

Component specifications:
- Purpose: [description]
- Props: [list props]
- Features: [list features]
- Styling: [requirements]
- Accessibility: [requirements]

Please:
- Use Shadcn/ui base components
- Follow Tailwind CSS patterns
- Add TypeScript types for props
- Make it reusable
- Add proper error states
- Add loading states
- Ensure accessibility (ARIA labels, keyboard navigation)
- Add proper error boundaries
- Write component tests
- Document props and usage
```

### Prompt 14: TypeScript Types Creation

```
I need to create TypeScript types for [feature name].

PRD Reference: [PRD-NUMBER]
Database Schema: [reference to PRD database section]
API Specifications: [reference to PRD API section]

Requirements:
1. Database entity types
2. API request/response types
3. UI component prop types
4. Form validation types (Zod schemas)

Please:
- Match database schema exactly
- Match API specifications exactly
- Use proper TypeScript conventions
- Export types from appropriate files
- Add JSDoc comments for complex types
- Create Zod schemas for validation
- Ensure type safety throughout
```

---

## Code Review Prompts

### Prompt 15: Code Review Request

```
Please review my implementation of [feature name] for PRD-[NUMBER].

Files changed:
- [list files]

PRD Reference: docs/features/PRD-SAAS-MNG-cr/PRD-SAAS-MNG-[NUMBER]_[NAME].md

Please check:
1. Does it match PRD requirements?
2. Does it follow master plan guidelines?
3. TypeScript best practices?
4. Error handling adequate?
5. Security considerations addressed?
6. Tests written and passing?
7. Documentation updated?
8. Performance considerations?
9. Accessibility requirements?
10. Code quality and maintainability?

Please provide:
- Specific feedback on issues found
- Suggestions for improvements
- Security concerns if any
- Performance optimizations if needed
- Missing test cases
```

### Prompt 16: Security Review

```
Please perform a security review of [feature/component].

PRD Reference: [PRD-NUMBER]
Files: [list files]

Focus areas:
1. Input validation
2. SQL injection prevention
3. XSS prevention
4. CSRF protection
5. Authentication/authorization
6. Sensitive data handling
7. Audit logging
8. Error message security
9. Rate limiting
10. Secrets management

Please identify:
- Security vulnerabilities
- Missing security measures
- Best practice violations
- Recommendations for fixes
```

---

## Testing Prompts

### Prompt 17: Unit Test Creation

```
I need unit tests for [component/function name].

File: [file path]
PRD Reference: [PRD-NUMBER]

Requirements:
- Test all public functions/methods
- Test edge cases
- Test error scenarios
- Mock external dependencies
- Achieve > 80% coverage

Please:
- Use Jest (or appropriate testing framework)
- Follow existing test patterns
- Write descriptive test names
- Add proper setup/teardown
- Mock external dependencies
- Test both success and failure cases
- Ensure tests are maintainable
```

### Prompt 18: Integration Test Creation

```
I need integration tests for API endpoint: [endpoint]

PRD Reference: [PRD-NUMBER]
Endpoint: [METHOD] /api/hq/v1/[endpoint]

Test scenarios:
1. [scenario 1]
2. [scenario 2]
3. [error scenario]

Please:
- Use Supertest (or appropriate tool)
- Test with real database (test database)
- Test authentication/authorization
- Test validation
- Test error handling
- Clean up test data
- Follow existing test patterns
```

### Prompt 19: E2E Test Creation

```
I need E2E test for user flow: [flow description]

PRD Reference: [PRD-NUMBER]
Flow: [describe the user flow]

Test steps:
1. [step 1]
2. [step 2]
3. [step 3]

Please:
- Use Playwright
- Follow existing E2E test patterns
- Test critical user paths
- Add proper waits
- Handle async operations
- Clean up test data
- Make tests reliable and maintainable
```

---

## Documentation Prompts

### Prompt 20: API Documentation

```
I need to document API endpoint: [endpoint]

PRD Reference: [PRD-NUMBER]
Endpoint: [METHOD] /api/hq/v1/[endpoint]

Please create:
1. OpenAPI/Swagger specification
2. Request/response examples
3. Error response examples
4. Authentication requirements
5. Rate limiting information
6. Usage examples

Please:
- Use Swagger annotations (if NestJS)
- Include all request/response types
- Document all error codes
- Add examples
- Keep it up to date
```

### Prompt 21: Component Documentation

```
I need to document UI component: [Component Name]

File: [file path]
PRD Reference: [PRD-NUMBER]

Please create:
1. Component description
2. Props documentation
3. Usage examples
4. Styling guidelines
5. Accessibility notes
6. Known limitations

Please:
- Use JSDoc comments
- Add Storybook stories if applicable
- Include code examples
- Document all props
- Add usage guidelines
```

---

## Progress Tracking Prompts

### Prompt 22: Implementation Status Update

```
Provide a status update for PRD-[NUMBER]: [PRD-NAME] implementation.

Current progress:
- Completed: [list completed items]
- In Progress: [list in-progress items]
- Blocked: [list blocked items]
- Not Started: [list not-started items]

PRD Checklist: [reference PRD implementation checklist]

Please:
1. Review the PRD checklist
2. Update status of each item
3. Identify any blockers
4. Estimate remaining work
5. Suggest next steps
6. Identify any deviations from PRD
```

### Prompt 23: Phase Completion Review

```
Review Phase [NUMBER] completion status.

Phase PRDs:
- [List PRDs in phase]

Master Plan: docs/features/PRD-SAAS-MNG-cr/MASTER_IMPLEMENTATION_PLAN.md

Please:
1. Check each PRD implementation status
2. Verify all checklist items completed
3. Identify any gaps
4. Review code quality
5. Check test coverage
6. Verify documentation
7. Assess readiness for next phase
8. Provide recommendations
```

---

## Troubleshooting Prompts

### Prompt 24: Debugging Issue

```
I'm experiencing an issue with [feature/component].

Error: [paste error message]
PRD Reference: [PRD-NUMBER]
Files involved: [list files]
Steps to reproduce: [describe steps]

Please help me:
1. Identify the root cause
2. Understand why it's happening
3. Provide a fix
4. Suggest prevention measures
5. Update tests if needed

Context:
- [any relevant context]
- [environment details]
- [recent changes]
```

### Prompt 25: Performance Issue

```
I'm experiencing performance issues with [feature/endpoint].

Issue: [describe performance problem]
PRD Reference: [PRD-NUMBER]
Endpoint/Component: [specify]

Metrics:
- Response time: [time]
- Throughput: [requests/sec]
- Error rate: [percentage]

Please:
1. Analyze the performance bottleneck
2. Review code for optimization opportunities
3. Check database queries
4. Review API calls
5. Suggest optimizations
6. Provide implementation guidance
```

---

## Best Practices Reminders

### Always Include in Prompts:

1. **PRD Reference**: Always reference the specific PRD
2. **Master Plan Reference**: Reference master plan for architecture
3. **Dependencies**: List what must be completed first
4. **Checklist**: Reference PRD implementation checklist
5. **Code Standards**: Remind to follow master plan standards
6. **Testing**: Always mention testing requirements
7. **Documentation**: Remind to update documentation

### Prompt Structure:

```
Context:
- What you're implementing
- PRD reference
- Dependencies

Requirements:
- Specific requirements
- API specifications
- UI requirements

Please:
- Specific actions needed
- Standards to follow
- Deliverables expected
```

---

## Quick Reference Prompts

### Starting New Feature
```
Implement [Feature Name] from PRD-[NUMBER].
PRD: docs/features/PRD-SAAS-MNG-cr/PRD-SAAS-MNG-[NUMBER]_[NAME].md
Follow master plan guidelines and PRD checklist.
```

### Code Review
```
Review [feature] implementation for PRD-[NUMBER].
Check against PRD requirements and master plan standards.
```

### Testing
```
Create tests for [feature] in PRD-[NUMBER].
Follow testing strategy from master plan.
```

### Documentation
```
Document [feature] from PRD-[NUMBER].
Update API docs, component docs, and README as needed.
```

---

**Usage Tips:**
1. Copy the relevant prompt
2. Fill in the bracketed placeholders ([NUMBER], [NAME], etc.)
3. Add any specific context or requirements
4. Paste to your AI coding assistant
5. Review the response and iterate as needed

**Remember:**
- Always reference the PRD
- Follow the master plan architecture
- Update checklists as you progress
- Write tests as you implement
- Document as you go
- Ask questions if unclear


cmx-api Backend Setup and Complete Rename Plan

Overview

Create a production-ready NestJS backend structure in cmx-api folder and systematically update all references from "backend" to "cmx-api" across the entire codebase, including documentation, scripts, configuration files, and infrastructure-as-code.

Current State





cmx-api/ folder exists but is empty (only contains .clauderc)



No backend/ folder exists (only referenced in docs/configs)



Multiple files reference "backend" that need updating



package.json has backend in workspaces array

Phase 1: Create NestJS Backend Structure

1.1 Initialize NestJS Project in cmx-api

Create a complete NestJS project structure following CleanMateX standards:

Files to create:





cmx-api/package.json - NestJS dependencies, scripts



cmx-api/tsconfig.json - TypeScript configuration



cmx-api/nest-cli.json - NestJS CLI configuration



cmx-api/.eslintrc.js - ESLint configuration



cmx-api/.prettierrc - Prettier configuration



cmx-api/.env.example - Environment variables template



cmx-api/.gitignore - Git ignore rules



cmx-api/README.md - Backend-specific README

1.2 Core Application Structure

Create the following directory structure:

cmx-api/
├── src/
│   ├── main.ts                    # Application entry point
│   ├── app.module.ts              # Root module
│   ├── app.controller.ts          # Root controller (health check)
│   ├── app.service.ts             # Root service
│   ├── config/                    # Configuration module
│   │   ├── config.module.ts
│   │   ├── database.config.ts     # Supabase/PostgreSQL config
│   │   ├── redis.config.ts        # Redis config
│   │   └── app.config.ts          # App-level config
│   ├── common/                    # Shared code
│   │   ├── decorators/
│   │   │   └── tenant-id.decorator.ts
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── tenant.guard.ts
│   │   ├── interceptors/
│   │   │   ├── logging.interceptor.ts
│   │   │   └── transform.interceptor.ts
│   │   ├── pipes/
│   │   │   └── validation.pipe.ts
│   │   └── utils/
│   │       └── logger.ts
│   ├── modules/                   # Feature modules
│   │   ├── health/
│   │   │   ├── health.module.ts
│   │   │   ├── health.controller.ts
│   │   │   └── health.service.ts
│   │   └── (future modules: orders, customers, etc.)
│   └── database/                  # Database access layer
│       ├── database.module.ts
│       ├── supabase.service.ts    # Supabase client service
│       └── tenant-context.service.ts
├── test/                          # Test files
│   ├── app.e2e-spec.ts
│   └── jest-e2e.json
└── (config files from 1.1)

1.3 Key Implementation Details

Main Application (src/main.ts):





Bootstrap NestJS app



Enable CORS, validation pipes, Swagger



Configure global prefix /api/v1



Set up error handling

App Module (src/app.module.ts):





Import ConfigModule, DatabaseModule



Import HealthModule



Set up global guards, interceptors

Database Module (src/database/):





Supabase client initialization



Tenant context service



Database connection management

Health Module (src/modules/health/):





Health check endpoint (GET /api/v1/health)



Database connectivity check



Redis connectivity check

Common Guards:





JwtAuthGuard - JWT authentication



TenantGuard - Multi-tenant isolation enforcement

Common Decorators:





@TenantId() - Extract tenant ID from request

1.4 Dependencies to Install

Core NestJS packages:





@nestjs/common, @nestjs/core, @nestjs/platform-express



@nestjs/config - Environment configuration



@nestjs/swagger - OpenAPI documentation



@supabase/supabase-js - Supabase client



class-validator, class-transformer - DTO validation



ioredis - Redis client



winston or pino - Logging

Dev dependencies:





@nestjs/cli - NestJS CLI



@nestjs/testing - Testing utilities



@types/* - TypeScript types



jest, supertest - Testing

Phase 2: Update All References from "backend" to "cmx-api"

2.1 Configuration Files

**package.json (root):





Update workspaces: "backend" → "cmx-api"

**.clauderc (root):





Update directories.backend: "./backend" → directories.backend: "./cmx-api"



Update stack.backend description if needed

**cmx-api/.clauderc:





Update comments mentioning "backend" to "cmx-api"



Update file paths in comments

2.2 Documentation Files

Update all markdown files that reference "backend":

Root Documentation:





README.md - Update project structure section, services table



CLAUDE.md - Update structure section

Feature Documentation:





docs/features/*/README.md - All feature docs mentioning backend



docs/features/*/IMPLEMENTATION_SUMMARY.md



docs/features/*/DEVELOPER_GUIDE.md

Development Documentation:





docs/dev/Change name fro backend to cmx-api_Jh.md - Mark as completed



docs/dev/claude-code-efficiency-guide.md



docs/dev/finance_invoices_payments_dev_guide.md



docs/development-setup.md



docs/README.md

Plan Documentation:





docs/plan/master_plan_cc_01.md - Update backend layer section



docs/plan_cr/021_backend_architecture_setup_dev_prd.md - Update all references



docs/plan_cr/022_backend_auth_middleware_dev_prd.md



docs/plan_cr/023_backend_orders_api_dev_prd.md



docs/plan_cr/024_backend_payments_invoicing_api_dev_prd.md



docs/plan_cr/025_backend_notifications_system_dev_prd.md



docs/plan_cr/026_backend_queue_jobs_dev_prd.md

Architecture Documentation:





docs/Complete Project Structure Documentation_Draft suggestion_01.md



.claude/skills/architecture/project-structure.md

2.3 Scripts

PowerShell Scripts:





scripts/dev/start-services.ps1 - Update "cd backend" → "cd cmx-api"



scripts/dev/start-services_x.ps1 - Update "cd backend" → "cd cmx-api"



scripts/dev/cleanmatex_how_to_start_Jh.txt - Update backend references

Shell Scripts:





scripts/dev/start-services.sh - Update "cd backend" → "cd cmx-api"

JavaScript Scripts:





scripts/validate-env.js - Update comments mentioning "backend"

Template Scripts:





scripts/feature-readme-template.md - Update backend API path references



scripts/consolidate-features.ps1 - Update backend API path references

2.4 Skills and Rules

Backend Skills:





.claude/skills/backend/SKILL.md - Update name/description if needed



.claude/skills/backend/nestjs-standards.md - Update project structure examples



.claude/skills/backend/supabase-rules.md - Check for backend references

Rules:





.cursor/rules/backendnestjsrules.mdc - Update project structure examples



.cursor/rules/backendstandards.mdc - Check for backend references

2.5 Infrastructure Files

Docker Compose:





docker-compose.yml - Add cmx-api service definition (if needed for future)



Update comments mentioning backend

Future Kubernetes Manifests:





When created, ensure they reference cmx-api not backend

Phase 3: Verification and Testing

3.1 Verification Checklist





NestJS project initializes successfully



All TypeScript files compile without errors



Health check endpoint responds (GET /api/v1/health)



Swagger documentation accessible (GET /api/docs)



No references to "backend" folder remain (except historical docs)



All scripts updated and tested



Package.json workspaces updated



Documentation is consistent

3.2 Testing Commands

# Verify NestJS setup
cd cmx-api
npm install
npm run build
npm run start:dev

# Verify health endpoint
curl http://localhost:3001/api/v1/health

# Verify Swagger
open http://localhost:3001/api/docs

# Search for remaining "backend" references (should only find historical/archived docs)
grep -r "backend" --exclude-dir=node_modules --exclude-dir=.git .

Phase 4: Documentation Updates

4.1 Create cmx-api README

Create cmx-api/README.md with:





Project overview



Setup instructions



Development commands



API documentation link



Architecture overview



Environment variables



Testing guide

4.2 Update Main README

Update README.md:





Change "Backend API" to "cmx-api" in services table



Update project structure diagram



Update development commands section

4.3 Update CLAUDE.md

Update CLAUDE.md:





Change structure section: backend/ → cmx-api/



Update any backend-related quick commands

Implementation Order





Create NestJS structure (Phase 1) - Foundation first



Update package.json workspaces (Phase 2.1) - Critical for monorepo



Update scripts (Phase 2.3) - Needed for development workflow



Update root documentation (Phase 2.2) - README.md, CLAUDE.md



Update feature documentation (Phase 2.2) - Systematic pass through docs/



Update skills/rules (Phase 2.4) - AI assistant context



Verify and test (Phase 3) - Ensure everything works



Final documentation (Phase 4) - Polish and completeness

Notes





The cmx-api folder already exists with .clauderc, so we're building on that



No actual backend/ folder exists to rename - only references need updating



Some documentation may intentionally reference "backend" conceptually (e.g., "backend layer") - these should remain as-is



Focus on folder/directory references: backend/ → cmx-api/



Keep conceptual references: "backend API", "backend layer", etc. unchanged unless they specifically refer to the folder name

Success Criteria





✅ Complete NestJS backend structure created in cmx-api/



✅ Backend runs successfully with health check and Swagger



✅ All folder references updated from backend/ to cmx-api/



✅ All scripts updated and functional



✅ Documentation is consistent and accurate



✅ No broken references or missing files



✅ Development workflow works end-to-end


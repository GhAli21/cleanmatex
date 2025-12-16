# PRD-SAAS-MNG-0011: Standalone Module Architecture

**Version:** 1.0  
**Status:** Draft  
**Owner:** Jehad Ali (Jh Apps HQ)  
**Priority:** Phase 1 - Critical

---

## Overview & Purpose

This PRD defines the standalone module architecture for the HQ Console, ensuring complete isolation from the tenant-facing web-admin application with separate applications, authentication, and deployment.

**Business Value:**
- Complete isolation from tenant codebase
- Independent development and deployment
- Separate security boundaries
- Scalable architecture
- Clear separation of concerns

---

## Functional Requirements

### FR-ARCH-001: Separate Applications
- **Description**: Separate applications for frontend and backend
- **Acceptance Criteria**:
  - `platform-web`: Next.js frontend application
  - `platform-api`: Backend API (NestJS or Next.js API routes)
  - `platform-workers`: Background workers (optional)
  - Independent codebases
  - No shared code with web-admin

### FR-ARCH-002: Independent Authentication
- **Description**: Separate authentication system
- **Acceptance Criteria**:
  - Separate login page
  - HQ-specific Supabase project or isolated auth
  - HQ user roles and permissions
  - Session management
  - MFA support

### FR-ARCH-003: Independent Routing
- **Description**: Separate routing and navigation
- **Acceptance Criteria**:
  - Separate domain or `/hq/*` routes
  - Independent navigation structure
  - Route guards for HQ access
  - No dependency on web-admin routes

### FR-ARCH-004: Database Access Patterns
- **Description**: HQ-specific database access
- **Acceptance Criteria**:
  - Bypass tenant RLS policies for HQ operations
  - Elevated database context
  - Read access to all tenant data
  - Write access with proper authorization

### FR-ARCH-005: Independent Deployment
- **Description**: Separate deployment pipelines
- **Acceptance Criteria**:
  - Independent CI/CD pipelines
  - Separate environments (dev, staging, prod)
  - Independent versioning
  - Rollback capabilities

### FR-ARCH-006: Environment Configuration
- **Description**: Separate environment configuration
- **Acceptance Criteria**:
  - Independent .env files
  - Separate Supabase configuration
  - Environment-specific settings
  - Secrets management

---

## Technical Requirements

### Project Structure
```
cleanmatex/
├── platform-web/              # HQ Console Frontend
│   ├── app/
│   ├── components/
│   ├── lib/
│   ├── public/
│   └── package.json
├── platform-api/               # HQ Console Backend API
│   ├── src/
│   │   ├── modules/
│   │   ├── common/
│   │   └── main.ts
│   └── package.json
├── platform-workers/           # Background Workers (optional)
│   └── ...
├── web-admin/                 # Tenant-facing admin (existing)
└── backend/                   # Tenant-facing backend (existing)
```

### Technology Stack

#### platform-web
- **Framework**: Next.js 14+ (App Router)
- **Language**: TypeScript
- **UI**: Shadcn/ui + Tailwind CSS
- **State**: Zustand or React Context
- **Forms**: React Hook Form + Zod
- **i18n**: next-intl

#### platform-api
- **Framework**: NestJS (recommended) or Next.js API Routes
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth
- **Validation**: class-validator + class-transformer

### Database Access

#### HQ Database Client
```typescript
// Bypass RLS for HQ operations
const supabase = createClient({
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY, // Service role key
});
```

### API Communication

#### platform-web → platform-api
- REST API calls
- Authentication via JWT tokens
- Error handling
- Request/response interceptors

---

## Security Considerations

1. **Access Control**: Only HQ users can access HQ Console
2. **Service Role Key**: Use service role key for database access (bypass RLS)
3. **API Security**: Secure API endpoints with authentication
4. **Environment Variables**: Secure secrets management
5. **Network Security**: VPN or IP whitelist for production

---

## Deployment Architecture

### Development
- Local development with separate ports
- Shared Supabase local instance
- Hot reload for both apps

### Staging
- Separate staging environments
- Staging Supabase project
- Independent deployments

### Production
- Separate production deployments
- Production Supabase project
- Load balancing (if needed)
- CDN for static assets

---

## Implementation Checklist

- [ ] Create platform-web Next.js project
- [ ] Create platform-api NestJS project (or Next.js API)
- [ ] Set up separate authentication
- [ ] Configure database access (service role)
- [ ] Set up routing and navigation
- [ ] Create base layout components
- [ ] Set up environment configuration
- [ ] Configure CI/CD pipelines
- [ ] Set up deployment infrastructure
- [ ] Write architecture documentation
- [ ] Security review

---

## Migration Strategy

1. **Phase 1**: Create standalone applications
2. **Phase 2**: Migrate HQ functionality to new apps
3. **Phase 3**: Remove HQ code from web-admin
4. **Phase 4**: Full separation and testing

---

**Related PRDs:**
- PRD-SAAS-MNG-0010: HQ Console UI Framework
- PRD-SAAS-MNG-0005: Authentication & User Management
- PRD-SAAS-MNG-0016: CI/CD & Schema Control
- PRD-SAAS-MNG-0017: Deployment & Ops


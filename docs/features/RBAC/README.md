# Role-Based Access Control (RBAC) System Documentation

**Version:** v1.0.0
**Last Updated:** 2025-11-03
**Author:** CleanMateX Development Team
**Status:** Planning & Design Phase

---

## 📋 Overview

This documentation covers the complete Role-Based Access Control (RBAC) system for CleanMateX, including:
- Current authentication and role system analysis
- Proposed RBAC architecture design
- Migration strategy from current to RBAC
- Implementation guides for developers
- Testing and security considerations

---

## 🎯 Purpose

CleanMateX is transitioning from a basic 3-role system (`admin`, `operator`, `viewer`) to a comprehensive RBAC system that provides:

✅ **Granular Permissions** - Fine-grained control over resources and actions
✅ **Flexible Roles** - Custom roles with configurable permissions
✅ **Multi-Role Support** - Users can have multiple roles
✅ **Workflow Roles** - Separate system for workflow step control
✅ **Multi-Tenant Security** - Permissions respect tenant boundaries
✅ **Audit Trail** - Complete logging of permission changes

---

## 📚 Documentation Structure

### Core Documentation

| Document | Description | Status |
|----------|-------------|--------|
| [Current State Analysis](./current_state_analysis.md) | Detailed analysis of existing role systems | ✅ Complete |
| [User Roles Guide](./user_roles_guide.md) | Documentation of user roles (authentication) | ✅ Complete |
| [Workflow Roles Guide](./workflow_roles_guide.md) | Documentation of workflow roles (operations) | ✅ Complete |
| [RBAC Architecture](./rbac_architecture.md) | Proposed RBAC system design | ✅ Complete |
| [Permission Matrix](./permission_matrix.md) | Complete permission list for all resources | ✅ Complete |
| [Migration Plan](./migration_plan.md) | Step-by-step conversion guide | ✅ Complete |
| [Implementation Guide](./implementation_guide.md) | Technical implementation details | ✅ Complete |
| [Developer Guide](./developer_guide.md) | How to work with RBAC in code | ✅ Complete |
| [Testing Guide](./testing_guide.md) | Testing permissions and roles | ✅ Complete |

### Technical Documentation

| Document | Description | Status |
|----------|-------------|--------|
| [Database Schema](./technical_docs/database_schema.md) | Database tables, RLS, migrations | ✅ Complete |
| [API Specifications](./technical_docs/api_specifications.md) | Permission and role management APIs | ✅ Complete |
| [Frontend Integration](./technical_docs/frontend_integration.md) | Hooks, components, context | ✅ Complete |
| [Security Considerations](./technical_docs/security_considerations.md) | Security best practices | ✅ Complete |
| [Performance Optimization](./technical_docs/performance_optimization.md) | Caching and optimization strategies | ✅ Complete |

---

## 🚀 Quick Start

### For Understanding Current System
1. Read [Current State Analysis](./current_state_analysis.md) - Understand what exists today
2. Review [User Roles Guide](./user_roles_guide.md) - Learn about authentication roles
3. Review [Workflow Roles Guide](./workflow_roles_guide.md) - Learn about operation roles

### For Planning RBAC Implementation
1. Read [RBAC Architecture](./rbac_architecture.md) - Understand the new design
2. Review [Permission Matrix](./permission_matrix.md) - See all permissions
3. Study [Database Schema](./technical_docs/database_schema.md) - Database changes needed

### For Implementing RBAC
1. Follow [Migration Plan](./migration_plan.md) - Step-by-step guide
2. Use [Implementation Guide](./implementation_guide.md) - Technical details
3. Reference [Developer Guide](./developer_guide.md) - Code examples
4. Apply [Testing Guide](./testing_guide.md) - Validation procedures

---

## 🔑 Key Concepts

### User Roles (Authentication System)
Control **who can access what features** in the application:
- `super_admin` - Platform administrator (all tenants)
- `tenant_admin` - Tenant owner (full tenant access)
- `branch_manager` - Branch supervisor (branch-scoped)
- `operator` - Standard worker (limited access)
- `viewer` - Read-only access

### Workflow Roles (Process System)
Control **which workflow steps** a user can perform:
- `ROLE_RECEPTION` - Order intake and delivery
- `ROLE_PREPARATION` - Item tagging and prep
- `ROLE_PROCESSING` - Wash, dry, iron operations
- `ROLE_QA` - Quality inspection
- `ROLE_DELIVERY` - Delivery operations
- `ROLE_ADMIN` - Full workflow access

### Permissions
Granular access control in format `resource:action`:
- `orders:create` - Can create orders
- `orders:read` - Can view orders
- `customers:delete` - Can delete customers
- `settings:update` - Can update settings
- `reports:export` - Can export reports

---

## 🎯 Current Status

### ✅ What Exists Today

| Feature | Implementation | Location |
|---------|---------------|----------|
| User role storage | ✅ Database column | `org_users_mst.role` |
| User role types | ✅ 3 roles defined | `admin`, `operator`, `viewer` |
| User role context | ✅ React context | `useAuth()`, `useRole()` |
| Route protection | ✅ Proxy + HOCs | `proxy.ts`, `with-role.tsx` |
| RLS policies | ✅ Tenant isolation | Multiple migration files |
| Workflow role constants | ✅ Code definitions | `lib/auth/roles.ts` |

### ⚠️ What's Missing

| Feature | Status | Priority |
|---------|--------|----------|
| Workflow role storage | ❌ No database table | High |
| Workflow role assignment | ❌ No UI or logic | High |
| Granular permissions | ❌ Only role-level checks | Critical |
| Multi-role support | ❌ Single role per user | High |
| Custom roles | ❌ Hard-coded roles only | Medium |
| Permission management UI | ❌ Not implemented | High |

### ⚠️ Critical Issues

1. **Naming Inconsistency** - Code uses `staff`/`driver` but database has `operator`/`viewer`
2. **No Permission Granularity** - Only checks user role, not specific permissions
3. **Workflow Roles Not Connected** - Defined but not stored or assigned
4. **Hard-Coded Permissions** - Permission checks scattered throughout code
5. **Single Role Limitation** - Users can't have multiple roles

---

## 📊 Implementation Phases

### Phase 1: Fix Critical Issues (Week 1)
- ✅ Create comprehensive documentation
- 🔄 Fix naming inconsistencies
- 🔄 Standardize role definitions

### Phase 2: Database Foundation (Week 2-3)
- 📅 Create RBAC tables
- 📅 Implement RLS for permissions
- 📅 Seed system roles and permissions
- 📅 Create permission functions

### Phase 3: Backend Services (Week 4-5)
- 📅 Build permission service
- 📅 Create role management APIs
- 📅 Implement permission middleware
- 📅 Add permission caching

### Phase 4: Frontend Integration (Week 6-7)
- 📅 Create permission hooks
- 📅 Build permission components
- 📅 Create role management UI
- 📅 Update existing components

### Phase 5: Migration & Testing (Week 8-9)
- 📅 Migrate existing data
- 📅 Update all permission checks
- 📅 Comprehensive testing
- 📅 Deploy with backward compatibility

### Phase 6: Complete Rollout (Week 10)
- 📅 Full production deployment
- 📅 Remove old system
- 📅 Final documentation updates

---

## 🔗 Quick Links

### For Developers
- [How to check permissions in code](./developer_guide.md#checking-permissions)
- [How to add new permissions](./developer_guide.md#adding-permissions)
- [How to create custom roles](./developer_guide.md#custom-roles)
- [Common patterns and examples](./developer_guide.md#code-examples)

### For Administrators
- [How to assign roles to users](./implementation_guide.md#user-role-assignment)
- [How to manage permissions](./implementation_guide.md#permission-management)
- [How to configure workflow roles](./workflow_roles_guide.md#assignment)

### For Project Managers
- [Migration timeline](./migration_plan.md#timeline)
- [Risk assessment](./migration_plan.md#risks-and-mitigations)
- [Success criteria](./migration_plan.md#success-criteria)

---

## 📝 Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| v1.0.0 | 2025-11-03 | Initial documentation creation | Development Team |

---

## 🤝 Contributing

When updating RBAC documentation:

1. **Update version.txt** - Increment version number
2. **Update CHANGELOG.md** - Document what changed
3. **Cross-link documents** - Ensure navigation works
4. **Add code examples** - Show practical usage
5. **Test instructions** - Verify they work

---

## 📞 Support

For questions or issues with RBAC system:

- Review relevant documentation section first
- Check [Common Issues](./implementation_guide.md#troubleshooting)
- Contact development team
- Create issue in project tracker

---

## 📚 Additional Resources

- [CleanMateX Main Documentation](../../CLAUDE.md)
- [Authentication Documentation](../../.claude/docs/multitenancy.md)
- [Security Best Practices](../../.claude/docs/code_review_checklist.md)
- [Database Conventions](../../.claude/docs/database_conventions.md)

---

**Note:** This documentation is part of the CleanMateX project and follows the documentation standards outlined in [Documentation Rules](../../.claude/docs/documentation_rules.md).

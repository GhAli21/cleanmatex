# 📂 Deployment Documentation - File Index

**Location**: `F:\jhapp\cleanmatex\docs\deployment\`
**Project**: cleanmatex (Tenant App)
**Last Updated**: 2025-12-15

---

## 📋 Files in This Folder

- **[README.md](./README.md)** - CleanMateX Tenant App deployment guide

---

## 📚 Complete Documentation

All comprehensive deployment documentation is in the **cleanmatexsaas** project:

### Location
`F:\jhapp\cleanmatexsaas\docs\deployment\`

### Main Files

1. **[README.md](../../../cleanmatexsaas/docs/deployment/README.md)**
   - Main entry point
   - Quick navigation

2. **[PRODUCTION_DEPLOYMENT_SUMMARY.md](../../../cleanmatexsaas/docs/deployment/PRODUCTION_DEPLOYMENT_SUMMARY.md)**
   - Executive summary
   - Quick start guide

3. **[PRODUCTION_DEPLOYMENT_PLAN.md](../../../cleanmatexsaas/docs/deployment/PRODUCTION_DEPLOYMENT_PLAN.md)**
   - Complete deployment strategy
   - Step-by-step process

4. **[INFRASTRUCTURE_REQUIREMENTS.md](../../../cleanmatexsaas/docs/deployment/INFRASTRUCTURE_REQUIREMENTS.md)**
   - Infrastructure specifications
   - Cost breakdown

5. **[DEPLOYMENT_CHECKLIST.md](../../../cleanmatexsaas/docs/deployment/DEPLOYMENT_CHECKLIST.md)**
   - Task-by-task checklist
   - Verification steps

6. **[ENVIRONMENT_CONFIGURATION.md](../../../cleanmatexsaas/docs/deployment/ENVIRONMENT_CONFIGURATION.md)**
   - Environment variables
   - Secrets management

7. **[DEPLOYMENT_DOCS_INDEX.md](../../../cleanmatexsaas/docs/deployment/DEPLOYMENT_DOCS_INDEX.md)**
   - Documentation guide
   - Reading order

---

## 🎯 Quick Access

### For cleanmatex Deployment
Read this folder's [README.md](./README.md)

### For Complete Documentation
Go to [cleanmatexsaas/docs/deployment/](../../../cleanmatexsaas/docs/deployment/)

---

## 📁 Folder Structure

```
cleanmatex/
└── docs/
    └── deployment/
        ├── README.md         # This project's deployment guide
        └── INDEX.md          # This file

cleanmatexsaas/              # ← Complete docs here
└── docs/
    └── deployment/
        ├── README.md
        ├── PRODUCTION_DEPLOYMENT_SUMMARY.md
        ├── PRODUCTION_DEPLOYMENT_PLAN.md
        ├── INFRASTRUCTURE_REQUIREMENTS.md
        ├── DEPLOYMENT_CHECKLIST.md
        ├── ENVIRONMENT_CONFIGURATION.md
        └── DEPLOYMENT_DOCS_INDEX.md
```

---

## 🔗 Key Points for cleanmatex

### This Project (cleanmatex)
- **Owns**: Database migrations (`supabase/migrations/`)
- **Deploys**: FIRST (before cleanmatexsaas)
- **Uses**: Supabase anon key (RLS enforced)
- **Port**: 3000 (local) | app.cleanmatex.com (prod)

### Sibling Project (cleanmatexsaas)
- **Uses**: Shared database (same Supabase)
- **Deploys**: SECOND (after cleanmatex)
- **Uses**: Service role key (bypasses RLS)
- **Port**: 3001 (local) | platform.cleanmatex.com (prod)

---

**Need complete documentation?** Visit [cleanmatexsaas/docs/deployment/](../../../cleanmatexsaas/docs/deployment/)

# `/add-setting-db` Skill

**Version**: 2.0.0
**Purpose**: Generate production-ready migration files for adding new settings to the CleanMateX settings system
**Last Updated**: 2026-02-28

---

## 🚀 Quick Start

```bash
# Invoke the skill
/add-setting-db

# Follow the prompts to provide setting details

# Migration file will be generated at:
# F:/jhapp/cleanmatex/supabase/migrations/XXXX_add_setting_{code}.sql

# Apply migration
cd F:/jhapp/cleanmatex
supabase migration up

# Commit to git
git add supabase/migrations/XXXX_*.sql
git commit -m "feat(settings): Add new setting"
```

---

## 📚 Documentation

This skill includes comprehensive documentation:

| File | Purpose | When to Use |
|------|---------|-------------|
| **[QUICK_START.md](./QUICK_START.md)** | Quick reference guide | First-time users, quick lookup |
| **[skill.md](./skill.md)** | Complete skill guide | Detailed workflow, templates, examples |
| **[CHANGELOG.md](./CHANGELOG.md)** | Version history | See what's changed between versions |
| **[ENHANCEMENT_SUMMARY.md](./ENHANCEMENT_SUMMARY.md)** | v2.0.0 enhancement overview | Understand migration file generation |

---

## 🎯 What This Skill Does

This skill **generates a complete migration file** for adding a new setting to the CleanMateX settings system.

### Input
You provide setting details (code, category, type, values, etc.)

### Output
A production-ready migration file with validation, insertion, verification, and rollback

### Location
`F:/jhapp/cleanmatex/supabase/migrations/XXXX_add_setting_{code}.sql`

---

## 🌟 Key Features

- 🔢 **Auto-Numbering**: Detects next migration number
- 📛 **Smart Naming**: Sanitizes setting code for filename
- ✅ **Built-in Validation**: Checks prerequisites
- 🔍 **Verification**: Post-insert validation
- 🔄 **Documented Rollback**: Undo instructions included
- 📦 **Version Control Ready**: Commit directly to git

---

## 📄 Documentation Guide

**For first-time users**: Start with [QUICK_START.md](./QUICK_START.md)

**For detailed workflow**: Read [skill.md](./skill.md)

**For v2.0.0 changes**: See [ENHANCEMENT_SUMMARY.md](./ENHANCEMENT_SUMMARY.md)

**For version history**: Check [CHANGELOG.md](./CHANGELOG.md)

---

**🚀 Ready? Run `/add-setting-db` and follow the prompts!**

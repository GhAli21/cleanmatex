# Claude Code Quick Reference Card

**Print this or keep it visible while working with Claude Code**

---

## 🚦 Context Usage Monitor

```
0-30%   ✅ Healthy      → Continue working
30-60%  ⚠️  Moderate    → Be mindful
60-80%  🟡 High         → Finish task, then /clear
80-95%  🔴 Critical     → /clear immediately
95-100% 🚨 Emergency    → Must /clear now
```

---

## 🤖 When to Use Agents

| Your Question | Use Agent? | Agent Type |
|---------------|------------|------------|
| "How does X work?" | ✅ YES | Explore |
| "Where is Y?" | ✅ YES | Explore |
| "Implement Z" | ✅ YES | Implementer-Tester |
| "Fix this error" | ✅ YES | Debugging-Specialist |
| "Read file.ts line 42" | ❌ NO | Direct Read |
| "Edit this specific line" | ❌ NO | Direct Edit |

---

## 📝 Question Templates

### Exploration (Use Agent)
```
"Use a [quick/medium/thorough] exploration agent to [task]"

Examples:
✅ "Explore how pricing calculation works"
✅ "Find where customer emails are sent"
✅ "Analyze the order workflow states"
```

### Direct Action (No Agent)
```
"Read [exact-file-path]"
"Edit [file] line [X] to change [Y] to [Z]"
"Add [field] to [specific component]"

Examples:
✅ "Read web-admin/lib/services/pricing.service.ts"
✅ "Edit order.ts line 42 to add discount field"
✅ "Add email validation to customer form"
```

### Implementation (Use Agent)
```
"Implement [feature] in [location] following [pattern]"

Examples:
✅ "Implement discount field following pricing pattern"
✅ "Add PDF export to invoices with tests"
```

### Debugging (Use Agent)
```
"Debug [specific error/behavior] in [context]"

Examples:
✅ "Debug 403 error when creating orders"
✅ "Debug slow query on orders list page"
```

---

## ⚡ Daily Workflow

```bash
# Morning - Start Fresh
/clear

# During Work
Ask focused questions with agents
Check context % regularly
When switching topics → /clear

# Evening - Commit Work
git add .
git commit -m "Your changes"
/clear
```

---

## 🎯 Agent Selection Guide

| Task | Command |
|------|---------|
| Understand code | "Explore [feature]" |
| Find code | "Explore where [X] is implemented" |
| Build feature | "Implement [feature] with tests" |
| Fix error | "Debug [error description]" |
| Review code | "Review [file] for quality" |
| Write docs | "Document [feature/API]" |
| Plan feature | "Plan implementation of [feature]" |

---

## 💾 Context-Saving Habits

### ✅ DO
- Use `/clear` when switching topics
- Ask "Explore X" instead of "Show me all X files"
- Specify exact files when you know them
- Break big tasks into sessions
- Let agents research, you get summaries

### ❌ DON'T
- Ask "Explain the entire codebase"
- Read 10+ files in one conversation
- Keep working past 80% context
- Mix multiple unrelated topics
- Ask for "everything about X"

---

## 🔧 CleanMateX Specific

### Tenant Filtering (CRITICAL)
```typescript
// ALWAYS use in queries
const tenantId = await getTenantIdFromSession();
const data = await withTenantContext(async (prisma) => {
  return prisma.org_orders_mst.findMany({
    where: { tenant_org_id: tenantId }
  });
});
```

### After Code Changes
```bash
npm run build
# Fix errors until build succeeds
```

### Skills to Use
```
/multitenancy - Before ANY database query
/database     - Before creating tables/migrations
/frontend     - Before creating UI components
/i18n         - Before adding translations
```

---

## 🆘 Emergency Recovery

### Context Explosion (95%+)
```
1. /clear immediately
2. Review what you were doing
3. Ask more focused question
4. Use agent for exploration
```

### Lost in Codebase
```
1. /clear
2. "Explore [specific feature] at medium depth"
3. Review summary
4. Ask targeted follow-up
```

### Too Many Files Modified
```bash
# Commit in chunks
git add feature-1/
git commit -m "Feature 1 complete"

git add feature-2/
git commit -m "Feature 2 complete"

# Keep <15 files modified at any time
```

---

## 📊 Session Planning

**Estimate context per task:**
- Explore agent: 5-15%
- Implement agent: 20-40%
- Large file read: 5-10%
- Build output: 10-20%
- Debug session: 15-30%

**Plan your session:**
```
Budget: 100%
- Explore pricing:     -10% → 90% left
- Implement discount:  -30% → 60% left
- Run tests:           -15% → 45% left
✅ Comfortable margin
```

---

## 🎓 Remember

1. **Agents are your friends** - Use them liberally
2. **Context is precious** - Spend it wisely
3. **Clear frequently** - Don't hoard context
4. **Be specific** - Focused questions = better answers
5. **Monitor usage** - Check the % indicator

---

## 📚 Full Documentation

**Efficiency Guide:** [docs/dev/claude-code-efficiency-guide.md](./claude-code-efficiency-guide.md)

**Updated:** 2026-01-29

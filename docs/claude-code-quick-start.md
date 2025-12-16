# Claude Code Quick Start Guide

## 🚀 Getting Started with Claude Code

### Installation
```bash
# Install Claude Code CLI
npm install -g @anthropic/claude-code

# Or use via npx
npx @anthropic/claude-code
```

### First Steps

1. **Navigate to your project**:
```bash
cd /path/to/cleanmatex
```

2. **Start Claude Code**:
```bash
claude
```

3. **Give context-rich prompts**:
```
"I need to create the OrdersService in the backend. 
Follow the patterns in backend/.clauderc and reference 
prisma/schema.prisma for the Order model."
```

---

## 💡 Best Prompt Patterns

### ✅ Good Prompts (Specific & Contextual)

```bash
# Backend Development
claude "Create OrdersModule in backend/src/modules/orders/ with:
- OrdersController with REST endpoints
- OrdersService with CRUD operations
- CreateOrderDto and UpdateOrderDto with validation
- Multi-tenant filtering using tenantOrgId
- Unit tests in orders.service.spec.ts
Follow the pattern in backend/src/modules/customers/"

# Frontend Development
claude "Create the Orders List page in web-admin/app/[locale]/(dashboard)/orders/
with:
- Server component for initial data
- Table with sorting and filtering
- Pagination
- Search functionality
- i18n support (English + Arabic)
- RTL layout support
Follow the pattern in customers/page.tsx"

# Database Changes
claude "Add 'priority' field to Order model in prisma/schema.prisma:
- Type: Int (0=standard, 1=express, 2=urgent)
- Default: 0
- Add index on (tenant_org_id, priority)
Then generate migration and update OrdersService accordingly"
```

### ❌ Bad Prompts (Too Vague)

```bash
# Too vague
claude "Create an order service"

# No context
claude "Fix the bug"

# Too broad
claude "Build the entire order management system"
```

---

## 🎯 Common Workflows

### Workflow 1: Create New Feature Module

```bash
# Step 1: Plan
claude "Review prisma/schema.prisma and suggest the structure 
for a DeliveryRoutes module"

# Step 2: Create module structure
claude "Create DeliveryRoutesModule in backend/src/modules/delivery-routes/ 
with module, controller, service, and DTOs"

# Step 3: Implement service
claude "Implement DeliveryRoutesService with:
- create() - Create new delivery route
- findAll() - List routes with pagination
- findOne() - Get route details
- assign() - Assign driver to route
- complete() - Mark route as completed"

# Step 4: Add tests
claude "Write comprehensive unit tests for DeliveryRoutesService"

# Step 5: Add controller
claude "Create REST endpoints in DeliveryRoutesController with Swagger docs"

# Step 6: Review
claude "Review the DeliveryRoutes module for:
- Multi-tenant security
- Error handling
- Missing validation
- Performance issues"
```

### Workflow 2: Fix a Bug

```bash
# Step 1: Describe the bug
claude "There's a bug in OrdersService.findAll() where it returns 
orders from all tenants instead of filtering by the current tenant. 
Investigate and fix it."

# Step 2: Add test to prevent regression
claude "Add a unit test to ensure orders are always filtered by tenantId"

# Step 3: Verify fix
claude "Review all methods in OrdersService to ensure they all 
include proper tenant filtering"
```

### Workflow 3: Optimize Performance

```bash
# Step 1: Identify issue
claude "Analyze OrdersService.findAll() for N+1 query problems 
and suggest optimizations"

# Step 2: Implement fix
claude "Refactor OrdersService.findAll() to use Prisma's include 
to fetch related data in a single query"

# Step 3: Add indexes
claude "Review prisma/schema.prisma and suggest missing indexes 
for the Order model based on common queries"
```

---

## 📝 Daily Development Routine

### Morning
```bash
# 1. Review current task
claude "@docs/current-task.md - Summarize what needs to be done today"

# 2. Check dependencies
claude "Review the current sprint tasks and suggest which task 
to work on first based on dependencies"
```

### During Development
```bash
# Small, incremental changes
claude "Implement the create() method in OrdersService"
claude "Add validation to CreateOrderDto"
claude "Write tests for create() method"
claude "Add Swagger documentation for POST /orders endpoint"
```

### End of Day
```bash
# Document progress
claude "Summarize today's work and update docs/progress.md"

# Plan tomorrow
claude "Based on today's progress, create a task list for tomorrow"
```

---

## 🛡️ Safety Tips

### Always Review Before Committing
- Check database migrations before running
- Review security-related code (auth, permissions)
- Test payment integration code thoroughly
- Verify multi-tenant isolation

### Use Version Control
```bash
# Create a branch for new feature
git checkout -b feature/order-status-history

# Commit frequently
git add .
git commit -m "feat(orders): add status history tracking"
```

---

## 🔍 Debugging with Claude Code

```bash
# Explain error
claude "I'm getting this error in OrdersService: 
[paste error message]
Explain what's causing it and how to fix it"

# Review code
claude "Review OrdersService.create() and explain what each 
part does. I want to understand the logic."

# Optimize query
claude "This query is slow:
[paste query]
Suggest optimizations"
```

---

## 📚 Learning Mode

```bash
# Ask for explanations
claude "Explain how Prisma transactions work and show an example 
in the context of creating an order with multiple items"

# Request best practices
claude "What are the best practices for error handling in NestJS? 
Show examples in the OrdersModule context"

# Compare approaches
claude "Compare using DTOs vs interfaces for request validation 
in NestJS. Which should I use and why?"
```

---

## 🎓 Pro Tips

1. **Reference Files**: Always tell Claude which files to look at
```bash
"@backend/prisma/schema.prisma - Show me the Order model"
```

2. **Break Down Large Tasks**: Don't ask for everything at once
```bash
# Instead of: "Build the order management system"
# Do: "Create Order entity" → "Add OrderService" → "Add OrderController"
```

3. **Request Code Reviews**: Use Claude as a code reviewer
```bash
"Review OrdersService for security issues, performance problems, 
and code quality"
```

4. **Use Task Files**: Keep track of what you're working on
```bash
"@docs/current-task.md - Implement next item on the checklist"
```

5. **Learn as You Go**: Don't just copy code, understand it
```bash
"Explain this code in detail: [paste code]"
```

---

## 🚨 Common Issues

### Issue: Claude modifies wrong files
**Solution**: Use .claudeignore and be specific in prompts

### Issue: Code doesn't follow project patterns
**Solution**: Reference example files in prompts

### Issue: Missing tenant filtering
**Solution**: Always remind Claude about multi-tenant requirements

---

## 📖 Quick Reference

### Essential Commands
```bash
claude                          # Start Claude Code
claude "@file.ts - explain"     # Explain a specific file
claude "test"                   # Run tests
claude "review"                 # Request code review
```

### File References
```bash
@backend/prisma/schema.prisma          # Database schema
@backend/.clauderc                     # Backend config
@docs/current-task.md                  # Current work
@CLAUDE.md                             # Main instructions
```

---

**Remember**: Claude Code is most effective when you:
1. Give specific, context-rich prompts
2. Break tasks into small steps
3. Reference relevant files
4. Review generated code
5. Learn and understand what's being built

---

**Last Updated**: 2025-01-09

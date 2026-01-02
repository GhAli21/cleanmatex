> Combined from `@.claude/docs/working_with_claude_code.md` and `@.claude/docs/12-tips.md` on 2025-10-17

# Working With Claude Code

- Be specific and reference files with `@path`
- Anchor tasks to implementation plans first
- Break work into steps and request reviews for security, RLS, types, performance, i18n
- Use task files to track daily progress
- Write tests for tenant isolation


---

## 💡 EFFECTIVE AI COLLABORATION

### 1. Be Specific and Contextual

#### ❌ Vague Request
```
"Create an order service"
```

#### ✅ Specific Request
```
"Create an order management module in web-admin/app/(dashboard)/orders/ 
following the patterns in the existing branches module. Include:
- List page with pagination and filters
- Detail page with status timeline
- Create/edit form with validation
- Integration with Supabase
- Support for bilingual (EN/AR) display
Reference the database schema in supabase/migrations/0001_core.sql 
for the org_orders_mst table structure."
```

---

### 2. Always Reference Files

#### Good
```bash
claude "@supabase/migrations/0001_core.sql - Show me the orders table schema"
```

#### Better
```bash
claude "Based on @supabase/migrations/0001_core.sql, create a TypeScript 
interface for the org_orders_mst table that matches the database schema"
```

#### Best
```bash
claude "Using @supabase/migrations/0001_core.sql as reference and following 
the patterns in @web-admin/types/database.ts, generate TypeScript interfaces 
for the orders module with proper multi-tenant support"
```

---

### 3. Reference Implementation Plans

```bash
# Check what to work on
claude "@docs/plan/master_plan_cc_01.md - What's the next priority task?"

# Implement specific features
claude "@docs/plan/orders_module_plan.md - Implement task #3 from the plan"

# Update progress
claude "Mark task #3 as complete in @docs/plan/orders_module_plan.md 
and show me task #4"
```

---

### 4. Break Down Large Tasks

#### Instead of:
```
"Build the complete order management system"
```

#### Do this:
```
Step 1: "Create the database schema for orders with multi-tenancy"
Step 2: "Generate TypeScript types from the schema"
Step 3: "Create the order list page with filtering"
Step 4: "Add order detail page with status timeline"
Step 5: "Implement order creation form with validation"
Step 6: "Add order status update functionality"
Step 7: "Create tests for order management"
```

---

### 5. Request Code Reviews

```bash
claude "Review this order creation code for:
- Multi-tenant security (tenant_org_id filtering)
- RLS policy compliance
- Error handling completeness
- TypeScript type safety
- Performance issues (N+1 queries)
- Bilingual support implementation
Provide specific improvements with code examples"
```

---

### 6. Learning Mode - Ask for Explanations

#### Understanding Concepts
```bash
claude "Explain how Supabase RLS policies work with concrete examples 
from our org_orders_mst table. Show me:
1. How the policy is defined
2. How it filters data
3. What happens when a user queries
4. How to test the policy"
```

#### Understanding Existing Code
```bash
claude "Explain this code from web-admin/lib/supabase.ts line by line:
- What each import does
- How the client is initialized
- What the configuration options mean
- Best practices being followed"
```

#### Comparing Approaches
```bash
claude "Compare these two approaches for our use case:
1. Storing order status as VARCHAR with foreign key to sys_order_status_cd
2. Using an ENUM type in PostgreSQL
Show pros/cons and recommend which is better for multi-tenant SaaS"
```

---

### 7. Use Task Tracking

#### Daily Workflow
```bash
# Morning
claude "@docs/plan/current_sprint.md - What are today's priorities?"

# During work
claude "@docs/plan/current_sprint.md - Mark 'Create customer API' as complete.
What's next?"

# End of day
claude "Update @docs/plan/daily_progress.md with:
- Completed: Customer API, Order list page
- In Progress: Order detail page (50%)
- Blockers: Need clarification on pricing logic
- Tomorrow: Complete order detail, start payment integration"
```

---

### 8. Test Multi-Tenancy Thoroughly

```bash
claude "Write a test suite that verifies tenant isolation for orders:
1. Create two test tenants with different data
2. Test that tenant1 cannot see tenant2's orders
3. Test that joins maintain isolation
4. Test that aggregations are tenant-specific
5. Test RLS policy enforcement
Use Jest and provide complete test file"
```

---

### 9. Leverage Claude's Memory

```bash
# Build context over time
claude "Remember: Our app uses OMR currency, targets GCC region, 
and all monetary values should be stored as DECIMAL(10,3)"

# Reference previous decisions
claude "Following our previous discussion about order workflows, 
implement the ASSEMBLY state logic"

# Ask about past context
claude "What did we decide about handling guest customers?"
```

---

### 10. Request Complete Solutions

#### Instead of:
```
"How do I add authentication?"
```

#### Ask for:
```
"Create a complete authentication flow for web-admin including:
1. Login page component with form validation
2. Supabase auth integration
3. Protected route wrapper
4. JWT token management
5. Tenant context injection
6. Logout functionality
7. Password reset flow
Provide all files with full implementation"
```

---

## Prompt Templates

### New Feature Template
```
Task: Implement [FEATURE NAME]
Location: [FILE PATHS]
Requirements:
- [REQUIREMENT 1]
- [REQUIREMENT 2]
References:
- Database: @supabase/migrations/[RELEVANT MIGRATION]
- Similar feature: @[SIMILAR FEATURE PATH]
Constraints:
- Must maintain multi-tenant isolation
- Include bilingual support
- Follow existing code patterns
Output: Complete implementation with TypeScript types
```

### Bug Fix Template
```
Issue: [DESCRIBE BUG]
Location: @[FILE WITH BUG]
Symptoms:
- [SYMPTOM 1]
- [SYMPTOM 2]
Expected: [WHAT SHOULD HAPPEN]
Actual: [WHAT HAPPENS]
Request: Fix the bug and explain what was wrong
```

### Learning Template
```
Topic: [CONCEPT TO LEARN]
Context: How it applies to CleanMateX
Request:
1. Explain the concept simply
2. Show how we use it in our codebase
3. Provide a practical example
4. Common pitfalls to avoid
5. Best practices for our use case
```

---

## Maximizing Productivity

### 1. Batch Similar Tasks
```
"Create all CRUD operations for the customers module:
- List with pagination
- Get single customer
- Create customer
- Update customer
- Delete (soft delete)
Follow the same patterns and include all TypeScript types"
```

### 2. Request Boilerplate Generation
```
"Generate a complete NestJS module boilerplate for 'inventory' including:
- Module file
- Controller with all CRUD endpoints
- Service with business logic
- DTOs for validation
- Entity with TypeORM decorators
- Tests for controller and service"
```

### 3. Ask for Automation Scripts
```
"Create a Node.js script that:
1. Generates a new feature module
2. Creates all necessary files
3. Updates the routing
4. Adds to git
Based on input: npm run generate:feature [name]"
```

---

## Working with Errors

### Effective Error Reporting
```
"I'm getting this error:
```
TypeError: Cannot read property 'tenant_org_id' of undefined
  at OrderService.create (order.service.ts:45)
```
The error occurs when creating a new order.
Here's the relevant code: @web-admin/services/order.service.ts
Help me fix this and prevent similar issues"
```

### Request Error Prevention
```
"Add comprehensive error handling to this function:
- Input validation
- Try-catch blocks
- Meaningful error messages
- Proper error logging
- User-friendly responses"
```

---

## Documentation Requests

### API Documentation
```
"Document this API endpoint:
- HTTP method and path
- Request headers required
- Request body schema with examples
- Response schemas for success/error
- Error codes and meanings
- curl example
- TypeScript usage example"
```

### Code Comments
```
"Add comprehensive comments to this complex function:
- Purpose and overview
- Parameter descriptions
- Return value description
- Algorithm explanation
- Example usage
- Edge cases handled"
```

---

## Advanced Tips

### 1. Chain Complex Operations
```
"First, analyze the current order flow. 
Then, identify bottlenecks.
Next, propose optimizations.
Finally, implement the top 3 improvements."
```

### 2. Request Alternative Solutions
```
"Show me 3 different ways to implement order notifications:
1. Using Supabase Realtime
2. Using webhooks
3. Using polling
Compare pros/cons and recommend the best for our use case"
```

### 3. Ask for Architecture Decisions
```
"Should we implement caching for order data?
Consider:
- Current performance metrics
- Expected load
- Complexity vs benefit
- Implementation options
Provide a recommendation with justification"
```

---

## Do's and Don'ts

### ✅ DO's
- Provide context about the business domain
- Reference existing code patterns
- Ask for explanations when learning
- Request tests with implementations
- Specify TypeScript types needed
- Ask for error handling
- Request documentation updates

### ❌ DON'Ts
- Ask for entire application at once
- Provide vague requirements
- Ignore multi-tenancy requirements
- Skip testing considerations
- Forget about localization
- Overlook security implications
- Request without context

---

## Sample Power Prompts

### Complete Feature Implementation
```
"Implement a complete loyalty points system:

Database:
- Add points fields to org_customers_mst
- Create points_transactions table
- Add earning rules configuration

Backend:
- Calculate points for orders
- Apply points redemption
- Track points history

Frontend:
- Display points balance
- Points history page
- Redemption interface

Include:
- Full TypeScript types
- Multi-tenant isolation
- Bilingual support
- Unit tests
- Migration file

Reference existing patterns in @web-admin/ and @supabase/migrations/"
```

### System Analysis
```
"Analyze our current order processing performance:
1. Review the database schema for bottlenecks
2. Check for N+1 query problems
3. Identify missing indexes
4. Find slow operations
5. Propose specific optimizations with code
Base analysis on @supabase/migrations/ and @web-admin/"
```

---

## Return to [Main Documentation](../CLAUDE.md)

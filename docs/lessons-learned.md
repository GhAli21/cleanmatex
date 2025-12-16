# Lessons Learned

> Document your learnings, mistakes, and discoveries throughout the project.

---

## 2025-01-09

### ✅ What Worked Well

**Claude Code Best Practices**
- Breaking down large tasks into 5-10 minute subtasks produces better results
- Referencing specific files in prompts (@file.ts) gives better context
- Asking Claude to explain code helps with understanding

**Multi-Tenant Architecture**
- Using Prisma middleware for automatic tenant filtering is cleaner than manual filtering
- Always test cross-tenant access in unit tests

**Development Workflow**
- Test-Driven Development (TDD) leads to better code design
- Writing tests first helps Claude generate better implementations

### 🔴 What Didn't Work

**Performance Issues**
- N+1 query problem in OrdersService.findAll() caused slow performance
- **Lesson**: Always use Prisma's `include` or `select` for related data
- **Solution**: Refactored to use proper includes

**Missing Tenant Filtering**
- Forgot to add tenantOrgId filter in one query
- **Lesson**: Create a checklist and review every query before committing
- **Solution**: Added unit test to catch this type of bug

**Unclear Error Messages**
- Generic error messages made debugging difficult
- **Lesson**: Always throw custom exceptions with clear messages
- **Solution**: Created custom exception classes

### 💡 New Discoveries

**Prisma Transactions**
```typescript
// Discovered that Prisma interactive transactions are better for complex operations
await prisma.$transaction(async (tx) => {
  const order = await tx.order.update({...});
  await tx.customer.update({...});
  await tx.orderStatusHistory.create({...});
});
```

**NestJS Guards**
```typescript
// Learned how to combine multiple guards
@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)
```

**React Query Optimistic Updates**
```typescript
// Discovered optimistic updates improve UX
const mutation = useMutation({
  mutationFn: updateOrder,
  onMutate: async (newOrder) => {
    // Cancel outgoing refetches
    await queryClient.cancelQueries(['orders', id]);
    
    // Snapshot the previous value
    const previousOrder = queryClient.getQueryData(['orders', id]);
    
    // Optimistically update
    queryClient.setQueryData(['orders', id], newOrder);
    
    return { previousOrder };
  },
  onError: (err, newOrder, context) => {
    // Rollback on error
    queryClient.setQueryData(['orders', id], context.previousOrder);
  },
});
```

### 🎯 Action Items

- [ ] Create a "pre-commit checklist" for security reviews
- [ ] Document common N+1 query patterns to avoid
- [ ] Create utility function for tenant-filtered queries
- [ ] Add ESLint rule to catch missing tenant filters

---

## 2025-01-10

### ✅ What Worked Well

[Document your learnings here]

### 🔴 What Didn't Work

[Document challenges here]

### 💡 New Discoveries

[Document new techniques or patterns]

### 🎯 Action Items

[Next steps based on today's learnings]

---

## 📚 General Learnings

### NestJS

**Dependency Injection**
- Always inject services through constructor
- Use `@Injectable()` decorator for all services
- Prefer constructor injection over property injection

**Testing**
- Use `Test.createTestingModule()` for unit tests
- Mock Prisma service for isolated tests
- Use `@nestjs/testing` utilities

### Prisma

**Migrations**
- Always review migration SQL before applying
- Test migrations on development database first
- Keep migrations small and focused

**Performance**
- Use `include` for eager loading
- Use `select` to fetch only needed fields
- Add indexes for frequently queried fields
- Use pagination for large datasets

### Next.js

**Server Components**
- Default to server components
- Only use 'use client' when necessary
- Server components can't use hooks

**Performance**
- Use next/image for automatic optimization
- Implement proper caching strategies
- Use dynamic imports for code splitting

### Flutter

**State Management (Riverpod)**
- Keep providers focused and composable
- Use `AsyncValue` for async operations
- Dispose controllers properly

**Performance**
- Use `const` constructors
- Implement `ListView.builder` for long lists
- Cache network images

---

## 🚨 Critical Mistakes to Avoid

1. **Security**: Never skip tenant filtering in database queries
2. **Performance**: Always check for N+1 queries before committing
3. **Testing**: Don't skip writing tests for business logic
4. **Error Handling**: Always handle edge cases and errors
5. **Documentation**: Update API docs when endpoints change

---

## 💡 Best Practices Discovered

### Code Organization
- Feature-first folder structure works better than layer-first
- Keep DTOs close to controllers
- Separate business logic from HTTP concerns

### Error Handling
```typescript
// Use custom exceptions
throw new OrderNotFoundException(orderId);

// Not generic errors
throw new Error('Not found'); // ❌
```

### API Design
```typescript
// Use consistent response format
{
  success: true,
  data: {...},
  meta: { timestamp, requestId }
}
```

### Database Queries
```typescript
// Always include pagination
async findAll(page: number, limit: number) {
  return prisma.order.findMany({
    skip: (page - 1) * limit,
    take: limit,
  });
}
```

---

## 📖 Resources That Helped

- [Prisma Best Practices](https://www.prisma.io/docs/guides/performance-and-optimization)
- [NestJS Techniques](https://docs.nestjs.com/techniques)
- [React Query Docs](https://tanstack.com/query/latest)
- [Flutter Performance](https://docs.flutter.dev/perf/best-practices)

---

**Remember**: Learning is a continuous process. Document everything!

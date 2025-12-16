# Code Review Checklist Rules

## Overview
Rules for conducting code reviews to ensure security, quality, and maintainability.

## Rules

### Security
- Always verify tenant filter (`tenant_org_id`) is present in queries
- Test RLS policies are enforced
- Never commit secrets or hardcoded credentials
- Validate all inputs before processing
- Check for CSRF/XSS vulnerabilities

### Multi-Tenant Isolation
- Verify composite foreign keys are used for cross-table joins
- Ensure cross-tenant access is impossible
- Test tenant isolation in all queries

### Performance
- Check for N+1 query problems
- Verify appropriate indexes exist
- Ensure pagination is implemented for large datasets
- Consider caching strategies where applicable

### Code Quality
- Enforce strong typing (no `any` types)
- Verify proper error handling
- Check for consistent logging
- Follow project naming conventions

### Testing
- Require unit tests for business logic
- Require integration tests for API endpoints
- Test edge cases and error scenarios
- Verify multi-tenant isolation tests exist

### Internationalization
- Verify translation keys are used (no hardcoded strings)
- Check bilingual fields (`name`/`name2`) are populated
- Test RTL layout for Arabic interface
- Verify locale-aware currency and date formatting

### Documentation
- Verify API endpoints are documented
- Check code comments explain complex logic
- Ensure migration notes are included
- Verify README/CHANGELOG updates

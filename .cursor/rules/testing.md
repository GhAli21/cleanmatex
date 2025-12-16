# Testing Strategy Rules

## Overview
Rules for implementing and maintaining tests.

## Rules

### Testing Pyramid
- Unit Tests: 70% - Business logic
- Integration Tests: 20% - API endpoints
- E2E Tests: 10% - Critical user flows

### Unit Tests
- Framework: Jest (Backend), Vitest (Frontend)
- Target: 80%+ code coverage
- Test business logic functions
- Mock external dependencies
- Test edge cases and error scenarios

### Integration Tests
- Use Supertest for API testing
- Test multi-tenant isolation
- Test authentication and authorization
- Test error handling
- Test data validation

### E2E Tests
- Use Playwright for browser testing
- Test critical user flows
- Test RTL/Arabic interface
- Test responsive design
- Test form submissions

### Performance Testing
- Use k6 for load testing
- Target: p95 < 800ms @ 1000 VUs
- Test API response times
- Test database query performance
- Monitor error rates

### Performance Targets
- API Response p50: < 300ms
- API Response p95: < 800ms
- Order Search: < 1s @ 100k records
- Availability: 99.9%
- Database Queries: < 100ms for indexed queries

### Multi-Tenant Testing
- Create two test tenants
- Create data for both tenants
- Verify tenant isolation
- Test cross-tenant access prevention
- Test composite foreign key enforcement

### Test Data Management
- Use seed data for testing
- Create test fixtures
- Clean up test data after tests
- Use transactions for test isolation

### Testing Checklist
- All unit tests passing
- Integration tests passing
- E2E critical flows tested
- Performance benchmarks met
- Multi-tenant isolation verified
- RTL/Arabic interface tested
- Mobile responsive tested
- Payment flows tested (sandbox)
- Error handling tested
- Security scan completed

## Conventions
- Always write tests alongside code
- Always test multi-tenant isolation
- Always test error scenarios
- Always maintain test coverage above 80%
- Always run tests before committing

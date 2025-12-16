# NestJS Backend Development Rules

## Overview
Rules for developing the NestJS backend API.

## Rules

### Project Structure
- Organize by modules: `/modules/{feature}`
- Each module contains: `dto/`, `entities/`, `services/`, `controllers/`, `module.ts`
- Keep common code in `/common`: decorators, filters, guards, interceptors, pipes
- Keep configuration in `/config`

### Module Organization
- Use @Module decorator to define modules
- Import dependencies in imports array
- Export services for use in other modules
- Keep modules focused on single feature

### Controllers
- Controllers handle HTTP requests (GET, POST, PUT, DELETE)
- Keep controllers thin - route requests to services
- Always use DTOs for validation
- Use proper HTTP status codes
- Document with Swagger decorators

### Services
- Services contain all business logic
- Controllers call services, services call database
- Use @Injectable decorator for dependency injection
- Handle errors appropriately
- Return proper response types

### DTOs
- Define Data Transfer Objects for all inputs/outputs
- Use class-validator decorators for validation
- Use ApiProperty for Swagger documentation
- Use PartialType for update DTOs

### Authentication & Authorization
- Use JWT strategy for authentication
- Create guards for route protection
- Extract user from JWT token
- Verify tenant context in guards/interceptors

### Multi-Tenancy
- Set tenant context in interceptor
- Ensure users only see their tenant's data
- Work with PostgreSQL Row Level Security
- Validate tenant access before operations

### Error Handling
- Use global exception filter
- Return consistent error response format
- Log errors appropriately
- Never expose sensitive error details

### Configuration
- Use ConfigService for environment variables
- Validate environment configuration on startup
- Use different configs for different environments

### API Documentation
- Setup Swagger/OpenAPI documentation
- Document all endpoints with ApiOperation
- Group endpoints with ApiTags
- Add authentication documentation

### Testing
- Write unit tests for services
- Write integration tests for API endpoints
- Mock dependencies appropriately
- Test error scenarios

## Conventions
- Always use dependency injection
- Always validate inputs with DTOs
- Always handle errors gracefully
- Always document API endpoints
- Always test multi-tenant isolation

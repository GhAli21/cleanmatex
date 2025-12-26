# Node.js Development Rules

## Overview
Standards for backend development using Node.js in CleanMateX.

## Rules

### Structure & Modularity
- Use ES Modules (`.mjs`) and `import/export` syntax
- Organize code into `services/`, `routes/`, `models/`, `utils/` directories
- Keep modules focused on single responsibility

### Coding Standards
- Prefer `async/await` over callbacks
- Enforce type safety with JSDoc or TypeScript
- All functions must be pure unless scoped to side effects
- Use consistent error handling patterns

### Logging & Configuration
- Centralize logging via `logger.js`
- Use `dotenv` for environment variables
- Never hardcode configuration values

### Validation & Security
- Validate inputs with `zod` or `joi`
- Reject invalid payloads early
- Audit all database mutations with timestamp, user ID, and tenant ID
- Never expose sensitive data in logs or responses

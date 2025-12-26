---
title: Node.js Development Rules
description: Standards for backend development in CleanMateX using Node.js
author: Gehad Abdo Mohammed Ali
created: 2025-10-17
tags: [nodejs, backend, cleanmatex, architecture]
---

# 🧠 Node.js Development Rules

## Structure & Modularity
- Use ES Modules (`.mjs`) and `import/export` syntax.
- Organize code into `services/`, `routes/`, `models/`, `utils/`.

## Coding Standards
- Prefer `async/await`; avoid callbacks.
- Enforce type safety with JSDoc or TypeScript.
- All functions must be pure unless scoped to side effects.

## Logging & Config
- Centralize logging via `logger.js`.
- Use `dotenv` for environment variables.

## Validation & Security
- Validate inputs with `zod` or `joi`.
- Reject invalid payloads early.
- Audit all DB mutations with timestamp, user ID, and tenant ID.
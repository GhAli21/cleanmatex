# PRD Implementation Rules

## Overview
Rules for implementing features according to Product Requirements Documents.

## Rules

### Don't Do This
- Don't use class components (legacy codebase reasons)
- Don't bypass error boundary setup
- Don't write components exceeding 500 lines (break them up)

### Code Style
- Use TypeScript everywhere (no exceptions)
- Use functional components with hooks only (for JavaScript family languages)
- Use 2-space indentation
- Use camelCase for variables, PascalCase for components

### Architecture
- State management must use one technique/library per language
  - Flutter: Use only Riverpod
  - React: Use Zustand
- API calls through custom client in `/src/utils/api.ts` or equivalent
- New components need tests alongside them
- Always consider bundle size for performance

## Conventions
- Follow feature-based folder structure
- Keep components small and focused
- Extract reusable logic into utilities

# Next.js Web Admin Development Rules

## Overview
Rules for developing the Next.js web admin dashboard.

## Rules

### Project Structure
- Use App Router (Next.js 13+)
- Organize by route groups: `(auth)`, `(dashboard)`
- Keep components in `/components` directory
- Keep utilities in `/lib` directory
- Use `/hooks` for custom React hooks
- Use `/types` for TypeScript types

### Routing
- Use file-based routing: folders = routes
- Use dynamic routes: `[id]` for parameters
- Use route groups: `(auth)` for grouping without URL segment
- Add metadata export for SEO

### Server vs Client Components
- Default to Server Components (no 'use client')
- Use Server Components for: data fetching, accessing backend resources, keeping sensitive info on server
- Use Client Components ('use client') for: useState, useEffect, event listeners, browser APIs, interactive features
- Mix Server and Client Components appropriately

### Data Fetching
- Use Server-Side Fetch in Server Components
- Use SWR or React Query for client-side data fetching
- Always handle loading and error states
- Use appropriate cache strategies

### API Routes
- Create API endpoints in `app/api/` directory
- Use route handlers: GET, POST, PATCH, DELETE
- Always validate inputs
- Return proper HTTP status codes
- Use DTOs for request/response validation

### Styling
- Use Tailwind CSS utility classes
- Follow responsive design patterns
- Use RTL utilities for Arabic support
- Maintain consistent spacing and typography

### Internationalization
- Use next-intl for translations
- Store translations in `messages/en.json` and `messages/ar.json`
- Use `useTranslations` hook in components
- Set `dir` attribute on HTML for RTL support

### Forms
- Use React Hook Form for form management
- Use Zod for validation schemas
- Validate inputs inline with clear error messages
- Show loading states during submission

### Authentication
- Use Supabase Auth for authentication
- Protect routes with middleware
- Verify session in Server Components
- Redirect unauthenticated users

### State Management
- Use Zustand for global state (minimal usage)
- Use React Query for server state
- Prefer Server Components over client state when possible
- Keep state local when possible

### Performance Optimization
- Use Next.js Image component for images
- Implement loading.tsx for loading states
- Implement error.tsx for error boundaries
- Optimize bundle size
- Use dynamic imports for large components

## Conventions
- Always use TypeScript
- Always use functional components with hooks
- Always handle errors gracefully
- Always test responsive design
- Always support RTL layout

# API Documentation Guide

## Overview

The CleanMateX API documentation is available via Swagger UI, providing an interactive interface to explore and test all API endpoints.

## Accessing the Documentation

1. Start your development server:

   ```bash
   npm run dev
   ```

2. Open the API documentation in your browser:

   ```
   http://localhost:3000/api-docs
   ```

3. The OpenAPI specification is also available as JSON:
   ```
   http://localhost:3000/api/docs
   ```

## Adding Documentation to Your Routes

To document your API routes, add JSDoc comments with `@swagger` annotations above your route handlers.

### Example: GET Endpoint

```typescript
/**
 * @swagger
 * /api/v1/categories:
 *   get:
 *     summary: List service categories
 *     description: List all available service categories
 *     tags: [Categories]
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: enabled
 *         schema:
 *           type: boolean
 *         description: Filter by enabled status
 *     responses:
 *       200:
 *         description: List of categories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ServiceCategory'
 */
export async function GET(request: NextRequest) {
  // Your implementation
}
```

### Example: POST Endpoint

```typescript
/**
 * @swagger
 * /api/v1/categories:
 *   post:
 *     summary: Enable categories
 *     tags: [Categories]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - categoryCodes
 *             properties:
 *               categoryCodes:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Success
 */
export async function POST(request: NextRequest) {
  // Your implementation
}
```

## Available Schemas

Common schemas are defined in `lib/swagger/swagger.config.ts`:

- `ServiceCategory` - Service category object
- `Error` - Error response format
- `SuccessResponse` - Success response format

You can reference these in your documentation using `$ref: '#/components/schemas/SchemaName'`.

## Testing APIs

1. Click on any endpoint in the Swagger UI
2. Click "Try it out"
3. Fill in the required parameters
4. Click "Execute"
5. View the response

## Authentication

Most endpoints require authentication. To test authenticated endpoints:

1. Get your JWT token from Supabase Auth
2. Click the "Authorize" button at the top of the Swagger UI
3. Enter your token in the format: `Bearer <your-token>`
4. Click "Authorize"

## Tags

Endpoints are organized by tags. Current tags include:

- Categories
- Customers
- Orders
- Products
- Assembly
- Delivery
- Receipts
- Tenants
- Workflows
- Navigation
- Subscriptions

## Tips

- Use descriptive summaries and descriptions
- Document all request/response parameters
- Include example values where helpful
- Document error responses (400, 401, 500, etc.)
- Use tags to group related endpoints

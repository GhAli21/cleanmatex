// Lazy import to avoid build-time file scanning issues
let createSwaggerSpec: any = null;

export const getApiDocs = async () => {
  try {
    // Lazy load to prevent build-time execution
    if (!createSwaggerSpec) {
      const swaggerDoc = await import('next-swagger-doc');
      createSwaggerSpec = swaggerDoc.createSwaggerSpec;
    }
    
    const spec = createSwaggerSpec({
      apiFolder: 'app/api', // API route folder
      definition: {
        openapi: '3.0.0',
      info: {
        title: 'CleanMateX API Documentation',
        version: '1.0.0',
        description: 'API documentation for CleanMateX Laundry Management System',
        contact: {
          name: 'CleanMateX API Support',
        },
      },
      servers: [
        {
          url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'JWT token from Supabase Auth',
          },
        },
        schemas: {
          ServiceCategory: {
            type: 'object',
            properties: {
              category_code: {
                type: 'string',
                description: 'Unique category code',
              },
              name: {
                type: 'string',
                description: 'Category name (English)',
              },
              name2: {
                type: 'string',
                description: 'Category name (Arabic)',
              },
              description: {
                type: 'string',
                description: 'Category description',
              },
              is_active: {
                type: 'boolean',
                description: 'Whether category is active',
              },
            },
          },
          Error: {
            type: 'object',
            properties: {
              error: {
                type: 'string',
                description: 'Error message',
              },
              success: {
                type: 'boolean',
                example: false,
              },
            },
          },
          SuccessResponse: {
            type: 'object',
            properties: {
              success: {
                type: 'boolean',
                example: true,
              },
              message: {
                type: 'string',
                description: 'Success message',
              },
            },
          },
        },
      },
      security: [
        {
          BearerAuth: [],
        },
      ],
      tags: [
        { name: 'Categories', description: 'Service category management endpoints' },
        { name: 'Customers', description: 'Customer management endpoints' },
        { name: 'Orders', description: 'Order management endpoints' },
        { name: 'Products', description: 'Product catalog endpoints' },
        { name: 'Assembly', description: 'Assembly workflow endpoints' },
        { name: 'Delivery', description: 'Delivery management endpoints' },
        { name: 'Receipts', description: 'Receipt generation endpoints' },
        { name: 'Tenants', description: 'Tenant management endpoints' },
        { name: 'Workflows', description: 'Workflow configuration endpoints' },
        { name: 'Navigation', description: 'Navigation and permissions endpoints' },
        { name: 'Subscriptions', description: 'Subscription management endpoints' },
      ],
    },
  });
    return spec;
  } catch (error) {
    // If file scanning fails (e.g., during build), return a minimal spec
    console.warn('Failed to scan API routes for Swagger docs:', error);
    return {
      openapi: '3.0.0',
      info: {
        title: 'CleanMateX API Documentation',
        version: '1.0.0',
        description: 'API documentation for CleanMateX Laundry Management System',
      },
      servers: [
        {
          url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          description: 'Development server',
        },
      ],
      paths: {},
      components: {
        securitySchemes: {
          BearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    };
  }
};


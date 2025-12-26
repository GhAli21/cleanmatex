# PostgreSQL & Prisma ORM Rules

## What is PostgreSQL?
PostgreSQL (often called Postgres) is a powerful, open-source relational database. Think of it as an organized filing system for your data with strong rules and relationships.

## What is Prisma?
Prisma is an ORM (Object-Relational Mapping) tool that lets you work with your database using TypeScript code instead of writing SQL directly. It's like a translator between your code and the database.

## Prisma Schema Structure

### Schema File Location
```
/prisma
  schema.prisma       # Database schema definition
  /migrations         # SQL migration files (auto-generated)
  /seeds              # Test data scripts
```

### Basic Schema Syntax
```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
  // Generates TypeScript types automatically
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Connection string from .env file
}

// EXPLANATION: Each model = one database table
// Field types: String, Int, Float, Boolean, DateTime, Json
// Special modifiers: ? (optional), [] (array), @default, @unique

model Customer {
  // Primary key - auto-generated UUID
  id        String   @id @default(uuid())
  
  // Required fields
  name      String
  email     String   @unique  // No duplicates allowed
  phone     String
  
  // Optional fields (? means nullable)
  address   String?
  notes     String?
  
  // Multi-tenancy - every table needs this
  tenantId  String   @map("tenant_id")
  
  // Audit fields - track when created/updated/deleted
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  deletedAt DateTime? @map("deleted_at")  // Soft delete
  
  // Relationships (one customer has many orders)
  orders    Order[]
  
  // Indexes for faster queries
  @@index([tenantId])
  @@index([email])
  @@index([phone])
  
  // Custom table name (maps to 'customers' in DB)
  @@map("customers")
}

model Order {
  id          String      @id @default(uuid())
  orderNumber String      @unique @map("order_number")
  
  // Foreign keys (relationships)
  customerId  String      @map("customer_id")
  customer    Customer    @relation(fields: [customerId], references: [id])
  
  driverId    String?     @map("driver_id")
  driver      User?       @relation("DriverOrders", fields: [driverId], references: [id])
  
  // Enum for status
  status      OrderStatus @default(PENDING)
  
  // Money - use Decimal for precise calculations
  total       Decimal     @db.Decimal(10, 2)
  discount    Decimal     @default(0) @db.Decimal(10, 2)
  
  // JSONB for flexible data
  metadata    Json?       @db.JsonB
  
  // Dates
  pickupDate  DateTime?   @map("pickup_date")
  deliveryDate DateTime?  @map("delivery_date")
  
  // Multi-tenancy
  tenantId    String      @map("tenant_id")
  
  // Audit fields
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")
  deletedAt   DateTime?   @map("deleted_at")
  
  // Relationships
  items       OrderItem[]
  payments    Payment[]
  
  // Composite indexes for complex queries
  @@index([tenantId, status])
  @@index([customerId])
  @@index([orderNumber])
  @@index([createdAt])
  
  @@map("orders")
}

model OrderItem {
  id        String   @id @default(uuid())
  
  orderId   String   @map("order_id")
  order     Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  
  serviceId String   @map("service_id")
  service   Service  @relation(fields: [serviceId], references: [id])
  
  quantity  Int      @default(1)
  price     Decimal  @db.Decimal(10, 2)
  subtotal  Decimal  @db.Decimal(10, 2)
  
  // No tenantId here - inherited from Order
  
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  
  @@index([orderId])
  @@index([serviceId])
  
  @@map("order_items")
}

model Service {
  id          String   @id @default(uuid())
  name        String
  nameAr      String?  @map("name_ar")  // Arabic translation
  description String?
  price       Decimal  @db.Decimal(10, 2)
  category    String
  
  tenantId    String   @map("tenant_id")
  
  isActive    Boolean  @default(true) @map("is_active")
  
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  deletedAt   DateTime? @map("deleted_at")
  
  items       OrderItem[]
  
  @@index([tenantId, category])
  @@index([isActive])
  
  @@map("services")
}

// Enum definition
enum OrderStatus {
  PENDING
  CONFIRMED
  PROCESSING
  READY
  OUT_FOR_DELIVERY
  DELIVERED
  CANCELLED
}

enum UserRole {
  SUPER_ADMIN
  TENANT_ADMIN
  MANAGER
  STAFF
  DRIVER
  CUSTOMER
}

enum PaymentStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}
```

## Field Type Reference

```prisma
// Common field types and their uses

String              // Text (email, name, address)
String @db.VarChar(255)  // Limited length text
String @db.Text     // Unlimited text

Int                 // Whole numbers (quantity, age)
BigInt              // Very large numbers

Float               // Decimal numbers (less precise)
Decimal             // Money, precise calculations
Decimal @db.Decimal(10, 2)  // 10 digits, 2 after decimal

Boolean             // true/false (isActive, isDeleted)

DateTime            // Date and time
DateTime @db.Date   // Date only
DateTime @db.Time   // Time only
DateTime @db.Timestamptz  // With timezone (recommended)

Json                // Flexible JSON data
Json @db.JsonB      // JSON with indexing (faster)

Bytes               // Binary data (images, files)

// Arrays
String[]            // Array of strings
Int[]               // Array of integers
```

## Relationships Explained

### One-to-Many (Most Common)
```prisma
// One customer has many orders
model Customer {
  id     String  @id @default(uuid())
  orders Order[]  // Array means "many"
}

model Order {
  id         String   @id @default(uuid())
  customerId String   // Foreign key
  customer   Customer @relation(fields: [customerId], references: [id])
}
```

### One-to-One
```prisma
// One user has one profile
model User {
  id      String   @id @default(uuid())
  profile Profile?  // Optional, one profile
}

model Profile {
  id     String @id @default(uuid())
  userId String @unique  // One user only
  user   User   @relation(fields: [userId], references: [id])
}
```

### Many-to-Many
```prisma
// Orders can have many services, services can be in many orders
model Order {
  id       String    @id @default(uuid())
  services Service[] @relation("OrderServices")
}

model Service {
  id     String  @id @default(uuid())
  orders Order[] @relation("OrderServices")
}

// Prisma auto-creates join table: _OrderServices
```

## Multi-Tenancy with Row Level Security (RLS)

### What is RLS?
Row Level Security ensures each tenant can only see their own data. It's enforced at the database level for security.

### Setup RLS in PostgreSQL
```sql
-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Create policy: Users see only their tenant's data
CREATE POLICY tenant_isolation_policy ON customers
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY tenant_isolation_policy ON orders
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Set tenant context in your application
SELECT set_config('app.current_tenant_id', 'tenant-uuid-here', true);
```

### In Prisma/NestJS
```typescript
// Before each query, set tenant context
async setTenantContext(tenantId: string) {
  await this.prisma.$executeRaw`
    SELECT set_config('app.current_tenant_id', ${tenantId}, true)
  `;
}

// Now all queries automatically filter by tenant
const customers = await prisma.customer.findMany();
// Only returns customers for this tenant!
```

## Migrations: Managing Schema Changes

### What are Migrations?
Migrations are version control for your database. Each change to your schema creates a migration file with SQL instructions.

### Create Migration
```bash
# After changing schema.prisma
npx prisma migrate dev --name add_customer_address

# This creates:
# - SQL file in /prisma/migrations/
# - Updates your database
# - Regenerates Prisma Client
```

### Migration Example
```sql
-- Migration: 20250117_add_customer_address/migration.sql
ALTER TABLE "customers" ADD COLUMN "address" TEXT;
ALTER TABLE "customers" ADD COLUMN "city" VARCHAR(100);
ALTER TABLE "customers" ADD COLUMN "postal_code" VARCHAR(20);

CREATE INDEX "customers_city_idx" ON "customers"("city");
```

### Deploy Migrations (Production)
```bash
# Deploy pending migrations
npx prisma migrate deploy

# Reset database (DANGER - deletes all data)
npx prisma migrate reset
```

## Prisma Client Usage

### Basic CRUD Operations

#### Create
```typescript
// Create single record
const customer = await prisma.customer.create({
  data: {
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+96812345678',
    tenantId: user.tenantId,
  },
});

// Create with related records
const order = await prisma.order.create({
  data: {
    customerId: customer.id,
    status: 'PENDING',
    total: 100,
    tenantId: user.tenantId,
    items: {
      create: [
        {
          serviceId: 'service-uuid',
          quantity: 2,
          price: 25,
          subtotal: 50,
        },
      ],
    },
  },
  include: {
    items: true,  // Return items with order
  },
});
```

#### Read
```typescript
// Find one
const customer = await prisma.customer.findUnique({
  where: { id: 'uuid' },
});

// Find one or throw error
const customer = await prisma.customer.findUniqueOrThrow({
  where: { email: 'john@example.com' },
});

// Find many with filters
const orders = await prisma.order.findMany({
  where: {
    status: 'PENDING',
    createdAt: {
      gte: new Date('2025-01-01'),  // Greater than or equal
    },
    customer: {
      email: {
        contains: '@example.com',  // LIKE query
      },
    },
  },
  include: {
    customer: true,
    items: {
      include: {
        service: true,
      },
    },
  },
  orderBy: {
    createdAt: 'desc',
  },
  take: 20,  // Limit
  skip: 0,   // Offset (for pagination)
});

// Count records
const orderCount = await prisma.order.count({
  where: { status: 'PENDING' },
});
```

#### Update
```typescript
// Update single record
const order = await prisma.order.update({
  where: { id: 'uuid' },
  data: {
    status: 'CONFIRMED',
    updatedAt: new Date(),
  },
});

// Update many records
const result = await prisma.order.updateMany({
  where: {
    status: 'PENDING',
    createdAt: {
      lt: new Date('2025-01-01'),
    },
  },
  data: {
    status: 'CANCELLED',
  },
});
// Returns: { count: 5 }

// Upsert (update or create)
const customer = await prisma.customer.upsert({
  where: { email: 'john@example.com' },
  update: {
    name: 'John Updated',
  },
  create: {
    email: 'john@example.com',
    name: 'John Doe',
    tenantId: 'tenant-uuid',
  },
});
```

#### Delete
```typescript
// Hard delete
await prisma.customer.delete({
  where: { id: 'uuid' },
});

// Soft delete (recommended)
await prisma.customer.update({
  where: { id: 'uuid' },
  data: { deletedAt: new Date() },
});

// Delete many
await prisma.order.deleteMany({
  where: {
    status: 'CANCELLED',
    createdAt: {
      lt: new Date('2024-01-01'),
    },
  },
});
```

### Transactions

#### Why Use Transactions?
Transactions ensure multiple operations succeed or fail together. Example: creating an order with items - if item creation fails, order should not be created.

```typescript
// Simple transaction
const result = await prisma.$transaction(async (tx) => {
  // Create order
  const order = await tx.order.create({
    data: { /* ... */ },
  });
  
  // Create items
  await tx.orderItem.createMany({
    data: items.map(item => ({
      orderId: order.id,
      ...item,
    })),
  });
  
  // Update customer stats
  await tx.customer.update({
    where: { id: customerId },
    data: {
      totalOrders: { increment: 1 },
    },
  });
  
  return order;
});

// If ANY operation fails, ALL are rolled back
```

### Advanced Queries

#### Aggregation
```typescript
// Sum, average, count, min, max
const stats = await prisma.order.aggregate({
  where: { status: 'COMPLETED' },
  _sum: {
    total: true,
  },
  _avg: {
    total: true,
  },
  _count: true,
});
// Returns: { _sum: { total: 5000 }, _avg: { total: 50 }, _count: 100 }

// Group by
const ordersByStatus = await prisma.order.groupBy({
  by: ['status'],
  _count: true,
  _sum: {
    total: true,
  },
});
// Returns: [
//   { status: 'PENDING', _count: 10, _sum: { total: 500 } },
//   { status: 'COMPLETED', _count: 50, _sum: { total: 2500 } }
// ]
```

#### Raw SQL (when needed)
```typescript
// Execute raw query
const result = await prisma.$queryRaw`
  SELECT status, COUNT(*) as count, SUM(total) as revenue
  FROM orders
  WHERE tenant_id = ${tenantId}
  GROUP BY status
`;

// Execute raw command
await prisma.$executeRaw`
  UPDATE orders
  SET status = 'EXPIRED'
  WHERE status = 'PENDING' AND created_at < NOW() - INTERVAL '7 days'
`;
```

## Indexing Best Practices

### When to Add Indexes
```prisma
model Order {
  // ✅ Index foreign keys (for JOINs)
  customerId String
  @@index([customerId])
  
  // ✅ Index frequently filtered fields
  status OrderStatus
  @@index([status])
  
  // ✅ Index for sorting
  createdAt DateTime
  @@index([createdAt])
  
  // ✅ Composite index for common query patterns
  @@index([tenantId, status, createdAt])
  
  // ✅ Unique index for business constraints
  orderNumber String @unique
}
```

### Index Types
```sql
-- B-tree (default) - good for equality and range queries
CREATE INDEX idx_orders_created_at ON orders(created_at);

-- Partial index - only index subset of rows
CREATE INDEX idx_active_customers ON customers(email) 
WHERE deleted_at IS NULL;

-- GIN index - for JSONB and full-text search
CREATE INDEX idx_orders_metadata ON orders USING GIN(metadata);

-- GiST index - for geographic data
CREATE INDEX idx_locations ON stores USING GIST(location);
```

## Performance Optimization

### Query Optimization
```typescript
// ❌ BAD - N+1 query problem
const orders = await prisma.order.findMany();
for (const order of orders) {
  const customer = await prisma.customer.findUnique({
    where: { id: order.customerId },
  });
  // Executes 1 + N queries!
}

// ✅ GOOD - Use include
const orders = await prisma.order.findMany({
  include: {
    customer: true,
  },
});
// Executes 1 query with JOIN

// ✅ BETTER - Select only needed fields
const orders = await prisma.order.findMany({
  select: {
    id: true,
    orderNumber: true,
    total: true,
    customer: {
      select: {
        name: true,
        email: true,
      },
    },
  },
});
```

### Connection Pooling
```typescript
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  // Add connection pool settings
  // postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=10
}
```

### Pagination
```typescript
// Cursor-based pagination (recommended for large datasets)
async function getPaginatedOrders(cursor?: string, limit = 20) {
  return await prisma.order.findMany({
    take: limit,
    skip: cursor ? 1 : 0,  // Skip cursor record
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: 'desc' },
  });
}

// Offset-based pagination (simpler, less efficient)
async function getOrdersPage(page = 1, limit = 20) {
  const skip = (page - 1) * limit;
  
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.count(),
  ]);
  
  return {
    data: orders,
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}
```

## Database Seeding

### Seed File
```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create test tenant
  const tenant = await prisma.tenant.create({
    data: {
      name: 'Test Laundry',
      subdomain: 'test-laundry',
      email: 'admin@test.com',
    },
  });

  // Create services
  const services = await prisma.service.createMany({
    data: [
      {
        name: 'Wash & Fold',
        nameAr: 'غسيل وكوي',
        price: 15,
        category: 'LAUNDRY',
        tenantId: tenant.id,
      },
      {
        name: 'Dry Clean',
        nameAr: 'تنظيف جاف',
        price: 25,
        category: 'DRY_CLEAN',
        tenantId: tenant.id,
      },
    ],
  });

  console.log({ tenant, services });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### Run Seed
```bash
npx prisma db seed
```

## Common Patterns

### Soft Delete Filter
```typescript
// Create middleware to exclude soft-deleted records
prisma.$use(async (params, next) => {
  if (params.action === 'findUnique' || params.action === 'findMany') {
    params.args.where = {
      ...params.args.where,
      deletedAt: null,
    };
  }
  
  if (params.action === 'delete') {
    params.action = 'update';
    params.args.data = { deletedAt: new Date() };
  }
  
  return next(params);
});
```

### Audit Trail
```typescript
// Automatically set updatedAt
// Already handled by @updatedAt in schema

// Log all changes
prisma.$use(async (params, next) => {
  const before = await next(params);
  
  if (['create', 'update', 'delete'].includes(params.action)) {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        model: params.model,
        recordId: params.args.where?.id,
        userId: getCurrentUserId(),
        timestamp: new Date(),
      },
    });
  }
  
  return before;
});
```

## Essential Commands

```bash
# Initialize Prisma in project
npx prisma init

# Generate Prisma Client (after schema changes)
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Deploy migrations
npx prisma migrate deploy

# Reset database
npx prisma migrate reset

# Open Prisma Studio (GUI for database)
npx prisma studio

# Format schema file
npx prisma format

# Validate schema
npx prisma validate

# Pull schema from existing database
npx prisma db pull

# Push schema without migration
npx prisma db push
```

## Common Issues & Solutions

### Issue: Prisma Client not found
```bash
# Solution: Regenerate client
npx prisma generate
```

### Issue: Migration conflicts
```bash
# Solution: Reset database (development only!)
npx prisma migrate reset

# Production: Create new migration to fix
npx prisma migrate dev --name fix_conflict
```

### Issue: Slow queries
```sql
-- Solution: Add appropriate indexes
-- Check query performance
EXPLAIN ANALYZE SELECT * FROM orders WHERE status = 'PENDING';

-- Add index if needed
CREATE INDEX idx_orders_status ON orders(status);
```

## Learning Resources
- **Prisma Docs**: https://www.prisma.io/docs
- **PostgreSQL Tutorial**: https://www.postgresqltutorial.com
- **Prisma YouTube**: Official channel with tutorials
- **Database Design**: "Database Design for Mere Mortals" book

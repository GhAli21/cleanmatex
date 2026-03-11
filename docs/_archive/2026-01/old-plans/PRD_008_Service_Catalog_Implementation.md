# PRD-008: Service Catalog - Implementation Plan
# Educational Guide for Solo Developer

**Document Version**: 1.0  
**Last Updated**: November 1, 2025  
**Estimated Duration**: Week 9 (5 days)  
**Difficulty**: ⭐⭐⭐ Moderate  
**Prerequisites**: PRD 001-007 completed

---

## 📚 **WHAT YOU'LL LEARN**

### Technical Skills
- ✅ Multi-language database patterns (name/name2)
- ✅ Image upload to S3/MinIO with CDN
- ✅ Complex Prisma relations (one-to-many, many-to-many)
- ✅ JSON columns for flexible configuration
- ✅ Advanced Next.js forms with validation
- ✅ File upload with preview
- ✅ Drag-and-drop reordering

### Business Logic
- ✅ Service catalog management
- ✅ Pricing rules and variants
- ✅ Multi-tenant customization
- ✅ Category hierarchy

---

## 🎯 **BUSINESS GOAL**

Create a comprehensive, tenant-customizable service catalog where:
1. **Platform Admin** defines global service categories (Dry Clean, Wash & Fold, etc.)
2. **Tenants** enable/disable services for their business
3. **Tenants** add products with prices, images, and descriptions
4. **Customers** see only active services in the app/POS

**Example Flow:**
```
Platform: "Dry Cleaning" category exists globally
  └─> Tenant "Quick Laundry" enables it
      └─> Adds products: "Shirt - AED 15", "Suit - AED 45"
          └─> Customer sees these in app
```

---

## 🗄️ **DATABASE DESIGN**

### Architecture Concept

```
📦 Service Catalog Structure (3 Levels)

Level 1: GLOBAL (sys_service_category_cd)
├─> "Dry Cleaning"
├─> "Wash & Fold"  
├─> "Ironing"
└─> "Alterations"

Level 2: TENANT ENABLEMENT (org_service_category_cf)
├─> Tenant A enables: Dry Cleaning, Wash & Fold
└─> Tenant B enables: All services

Level 3: TENANT PRODUCTS (org_product_data_mst)
├─> Tenant A products:
│   ├─> "Men's Shirt - Dry Clean" - OMR 2.5
│   └─> "Dress - Dry Clean" - OMR 8.0
└─> Tenant B products:
    ├─> "Shirt" - AED 15
    └─> "Suit 2-Piece" - AED 45
```

**Why This Design?**
- **Consistency**: All tenants use same category names
- **Flexibility**: Each tenant customizes their offerings
- **Scalability**: Adding new categories is easy
- **Multi-language**: Built-in EN/AR support

---

### 📋 **DAY 1: DATABASE SCHEMA (3-4 hours)**

#### Step 1.1: Create Prisma Models

**File**: `apps/api/prisma/schema.prisma`

```prisma
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔵 LEARNING: Prisma Schema Basics
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// - model = table definition
// - @id = primary key
// - @default(uuid()) = auto-generate UUID
// - @relation = foreign key relationship
// - @@map = actual PostgreSQL table name
// - String? = nullable (optional field)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// 🌍 GLOBAL: Service Categories (Platform-wide)
model ServiceCategory {
  id        String   @id @default(uuid())
  
  // 🔤 Multi-language Pattern: name (EN) + name2 (AR)
  // Why not use i18n keys? 
  // - Simpler queries (no JOINs needed)
  // - Better performance
  // - Easier to manage in admin UI
  code      String   @unique // "dry_clean", "wash_fold"
  name      String            // "Dry Cleaning"
  name2     String?           // "التنظيف الجاف"
  
  description  String?        // Short description
  description2 String?        // Arabic description
  
  icon      String?           // Icon identifier: "iron", "washing-machine"
  color     String?           // Hex color: "#3B82F6"
  sortOrder Int      @default(0)
  isActive  Boolean  @default(true)
  
  // 🔗 Relations
  tenantServices TenantService[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@map("sys_service_category_cd")
}

// 🏢 TENANT: Service Enablement & Configuration
model TenantService {
  id                String   @id @default(uuid())
  tenantId          String
  serviceCategoryId String
  
  // Tenant-specific settings
  isEnabled         Boolean  @default(true)
  displayName       String?  // Override global name: "Express Dry Clean"
  displayName2      String?  // Arabic override
  
  // 🎨 Customization
  customIcon        String?  // Override global icon
  customColor       String?  // Override global color
  
  // ⚙️ Configuration (flexible JSON)
  // Example: { "expressService": true, "sameDayAvailable": false, "minOrderValue": 20 }
  settings          Json?    @db.JsonB
  
  // Relations
  tenant            Tenant            @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  serviceCategory   ServiceCategory   @relation(fields: [serviceCategoryId], references: [id])
  products          Product[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  // 🔒 CRITICAL: One service per tenant (multi-tenancy safety)
  @@unique([tenantId, serviceCategoryId])
  @@index([tenantId]) // Performance: filter by tenant
  @@map("org_service_category_cf")
}

// 🛍️ PRODUCTS: Tenant's Service Items
model Product {
  id              String   @id @default(uuid())
  tenantId        String   // 🔑 Multi-tenancy key
  tenantServiceId String   // Which service category?
  
  // Product identification
  sku             String?  // Optional: "SHIRT-DC-001"
  barcode         String?  // For scanning
  
  // Multi-language names
  name            String   // "Men's Dress Shirt"
  name2           String?  // "قميص رجالي"
  description     String?  @db.Text
  description2    String?  @db.Text
  
  // 💰 Pricing
  pricingType     PricingType @default(PER_PIECE)
  basePrice       Decimal     @db.Decimal(10, 2)
  currency        String      @default("OMR")
  
  // ⏱️ Service Time
  turnaroundHours Int         @default(48) // Standard: 2 days
  
  // 📸 Media
  imageUrl        String?  // Primary product image
  images          Json?    @db.JsonB // Array of image URLs
  
  // 🎯 Attributes (flexible)
  // Example: { "fabric": ["Cotton", "Polyester"], "size": ["S", "M", "L"] }
  attributes      Json?    @db.JsonB
  
  // Status
  isActive        Boolean  @default(true)
  sortOrder       Int      @default(0)
  
  // Relations
  tenant          Tenant        @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  tenantService   TenantService @relation(fields: [tenantServiceId], references: [id])
  variants        ProductVariant[]
  orderItems      OrderItem[]
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([tenantId])
  @@index([tenantServiceId])
  @@map("org_product_data_mst")
}

// 🎨 PRODUCT VARIANTS: Same product, different options
// Example: "Shirt" product → Variants: "Express", "Starch", "Hanger"
model ProductVariant {
  id          String   @id @default(uuid())
  productId   String
  tenantId    String   // Multi-tenancy
  
  name        String   // "Express Service"
  name2       String?  // "خدمة سريعة"
  
  // Pricing adjustment
  priceAdjustment Decimal @db.Decimal(10, 2) // +2.5 OMR
  adjustmentType  AdjustmentType @default(FIXED) // FIXED or PERCENTAGE
  
  turnaroundAdjustment Int @default(0) // -24 hours (faster)
  
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  
  // Relations
  product     Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  @@index([productId])
  @@map("org_product_variant_mst")
}

// 📊 ENUMS: Fixed value lists
enum PricingType {
  PER_PIECE  // Each item: "Shirt = 2.5 OMR"
  PER_KG     // By weight: "Laundry = 3 OMR/kg"
  FLAT_RATE  // Fixed price: "Comforter = 15 OMR"
}

enum AdjustmentType {
  FIXED      // Add/subtract amount: "+2.5"
  PERCENTAGE // Add percentage: "+20%"
}
```

---

#### Step 1.2: Create Migration

**What is a migration?**
```
Migration = Version control for your database

Like Git for code, migrations track database changes:
- Initial schema
- Add new column
- Modify table structure
- Rollback if needed

Prisma generates SQL from your schema!
```

**Commands:**

```bash
# Navigate to API folder
cd apps/api

# 🔵 LEARNING: This command does 3 things:
# 1. Compares schema.prisma with current database
# 2. Generates SQL migration file
# 3. Applies migration to database

npx prisma migrate dev --name add_service_catalog

# Expected output:
# ✔ Generated Prisma Client
# ✔ Migration applied: 20251101_add_service_catalog.sql
```

**Generated SQL** (auto-created in `prisma/migrations/`):

```sql
-- CreateEnum
CREATE TYPE "PricingType" AS ENUM ('PER_PIECE', 'PER_KG', 'FLAT_RATE');
CREATE TYPE "AdjustmentType" AS ENUM ('FIXED', 'PERCENTAGE');

-- CreateTable: Service Categories
CREATE TABLE "sys_service_category_cd" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name2" TEXT,
    "description" TEXT,
    "description2" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    
    CONSTRAINT "sys_service_category_cd_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sys_service_category_cd_code_key" ON "sys_service_category_cd"("code");

-- ... (more tables created automatically)
```

---

#### Step 1.3: Seed Initial Data

**Why seed data?**
- Testing without manual data entry
- Consistent development environment
- Quick demo setup

**File**: `apps/api/prisma/seed.ts`

```typescript
// 🔵 LEARNING: Seeding = Populating database with initial data
// Run once to setup development database

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding service catalog...');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 1: Create Global Service Categories
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  const categories = [
    {
      code: 'dry_clean',
      name: 'Dry Cleaning',
      name2: 'التنظيف الجاف',
      description: 'Professional dry cleaning for delicate garments',
      description2: 'تنظيف احترافي للملابس الحساسة',
      icon: 'sparkles',
      color: '#3B82F6',
      sortOrder: 1,
    },
    {
      code: 'wash_fold',
      name: 'Wash & Fold',
      name2: 'الغسيل والطي',
      description: 'Standard washing and folding service',
      description2: 'خدمة الغسيل والطي القياسية',
      icon: 'washing-machine',
      color: '#10B981',
      sortOrder: 2,
    },
    {
      code: 'iron_press',
      name: 'Iron & Press',
      name2: 'الكي والكبس',
      description: 'Professional ironing and pressing',
      description2: 'كي وكبس احترافي',
      icon: 'iron',
      color: '#F59E0B',
      sortOrder: 3,
    },
    {
      code: 'alterations',
      name: 'Alterations & Repairs',
      name2: 'التعديلات والإصلاحات',
      description: 'Tailoring and garment repairs',
      description2: 'خياطة وإصلاح الملابس',
      icon: 'scissors',
      color: '#8B5CF6',
      sortOrder: 4,
    },
    {
      code: 'specialized',
      name: 'Specialized Care',
      name2: 'العناية المتخصصة',
      description: 'For leather, suede, wedding dresses, etc.',
      description2: 'للجلد والشمواه وفساتين الزفاف',
      icon: 'star',
      color: '#EC4899',
      sortOrder: 5,
    },
  ];

  // upsert = Update if exists, Insert if not
  for (const category of categories) {
    await prisma.serviceCategory.upsert({
      where: { code: category.code },
      update: category,
      create: category,
    });
  }

  console.log('✅ Created 5 service categories');

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // STEP 2: Enable Services for Demo Tenant
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  // Assuming tenant created in previous PRDs
  const demoTenant = await prisma.tenant.findFirst({
    where: { slug: 'demo-laundry' },
  });

  if (demoTenant) {
    const dryCleanCategory = await prisma.serviceCategory.findUnique({
      where: { code: 'dry_clean' },
    });

    if (dryCleanCategory) {
      const tenantService = await prisma.tenantService.create({
        data: {
          tenantId: demoTenant.id,
          serviceCategoryId: dryCleanCategory.id,
          isEnabled: true,
          settings: {
            expressService: true,
            sameDayAvailable: true,
            minOrderValue: 10,
          },
        },
      });

      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      // STEP 3: Create Products for This Service
      // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      
      const products = [
        {
          name: "Men's Dress Shirt",
          name2: 'قميص رجالي',
          sku: 'DC-SHIRT-M',
          pricingType: 'PER_PIECE',
          basePrice: 2.5,
          currency: 'OMR',
          turnaroundHours: 48,
          sortOrder: 1,
        },
        {
          name: 'Trousers',
          name2: 'بنطلون',
          sku: 'DC-PANTS',
          pricingType: 'PER_PIECE',
          basePrice: 3.0,
          currency: 'OMR',
          turnaroundHours: 48,
          sortOrder: 2,
        },
        {
          name: '2-Piece Suit',
          name2: 'بدلة من قطعتين',
          sku: 'DC-SUIT-2',
          pricingType: 'PER_PIECE',
          basePrice: 8.0,
          currency: 'OMR',
          turnaroundHours: 72,
          sortOrder: 3,
        },
        {
          name: 'Dress',
          name2: 'فستان',
          sku: 'DC-DRESS',
          pricingType: 'PER_PIECE',
          basePrice: 6.0,
          currency: 'OMR',
          turnaroundHours: 48,
          sortOrder: 4,
        },
      ];

      for (const productData of products) {
        const product = await prisma.product.create({
          data: {
            ...productData,
            tenantId: demoTenant.id,
            tenantServiceId: tenantService.id,
          },
        });

        // Add Express variant
        await prisma.productVariant.create({
          data: {
            productId: product.id,
            tenantId: demoTenant.id,
            name: 'Express Service',
            name2: 'خدمة سريعة',
            priceAdjustment: 2.0,
            adjustmentType: 'FIXED',
            turnaroundAdjustment: -24, // 24 hours faster
            sortOrder: 1,
          },
        });
      }

      console.log('✅ Created 4 products with variants');
    }
  }

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Run Seed:**

```bash
npx prisma db seed

# Expected output:
# 🌱 Seeding service catalog...
# ✅ Created 5 service categories
# ✅ Created 4 products with variants
# 🎉 Seeding complete!
```

---

### 🚀 **DAY 2: BACKEND API (4-5 hours)**

#### What We'll Build

```
API Endpoints:

📂 Service Categories (Platform Admin)
├─ GET    /api/v1/service-categories
├─ POST   /api/v1/service-categories
├─ PATCH  /api/v1/service-categories/:id
└─ DELETE /api/v1/service-categories/:id

📂 Tenant Services (Tenant Admin)
├─ GET    /api/v1/tenant/services
├─ POST   /api/v1/tenant/services/enable
├─ PATCH  /api/v1/tenant/services/:id
└─ DELETE /api/v1/tenant/services/:id/disable

📂 Products (Tenant Admin)
├─ GET    /api/v1/products
├─ POST   /api/v1/products
├─ GET    /api/v1/products/:id
├─ PATCH  /api/v1/products/:id
├─ DELETE /api/v1/products/:id
└─ POST   /api/v1/products/:id/upload-image
```

---

#### Step 2.1: Create NestJS Module

**What is a NestJS Module?**
```
Module = Organized box of related code

catalog.module.ts
├─ Controllers (handle HTTP requests)
├─ Services (business logic)
└─ Providers (dependencies)

Like organizing tools:
- Toolbox (Module)
  ├─ Hammer (Controller)
  ├─ Screwdriver (Service)
  └─ Nails (Providers)
```

**Command:**

```bash
cd apps/api

# 🔵 LEARNING: This generates boilerplate code
# - Creates module, controller, service files
# - Registers module in app.module.ts

nest g module catalog
nest g controller catalog
nest g service catalog

# Generated files:
# src/catalog/catalog.module.ts
# src/catalog/catalog.controller.ts
# src/catalog/catalog.service.ts
```

---

#### Step 2.2: Service Layer (Business Logic)

**File**: `apps/api/src/catalog/catalog.service.ts`

```typescript
// 🔵 LEARNING: Service = Where business logic lives
// - NOT in controllers (they just route requests)
// - Services are reusable across controllers

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto';

@Injectable() // Makes this class injectable (DI pattern)
export class CatalogService {
  // 🔑 Dependency Injection: Prisma automatically injected
  constructor(private prisma: PrismaService) {}

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📂 SERVICE CATEGORIES (Platform Admin)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Get all global service categories
   * Used in: Platform admin, Tenant onboarding
   */
  async getServiceCategories(isActive?: boolean) {
    return this.prisma.serviceCategory.findMany({
      where: {
        ...(isActive !== undefined && { isActive }),
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Create new service category (Platform Admin only)
   */
  async createServiceCategory(data: {
    code: string;
    name: string;
    name2?: string;
    description?: string;
    description2?: string;
    icon?: string;
    color?: string;
  }) {
    // Validate: code must be unique
    const existing = await this.prisma.serviceCategory.findUnique({
      where: { code: data.code },
    });

    if (existing) {
      throw new BadRequestException('Service category code already exists');
    }

    return this.prisma.serviceCategory.create({
      data,
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🏢 TENANT SERVICES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Get services enabled for this tenant
   * Used in: POS, Customer app, Admin dashboard
   */
  async getTenantServices(tenantId: string) {
    return this.prisma.tenantService.findMany({
      where: { tenantId },
      include: {
        serviceCategory: true, // Include category details
        products: {
          where: { isActive: true },
          include: {
            variants: {
              where: { isActive: true },
            },
          },
        },
      },
      orderBy: {
        serviceCategory: {
          sortOrder: 'asc',
        },
      },
    });
  }

  /**
   * Enable a service for tenant
   * Used in: Tenant onboarding, Admin settings
   */
  async enableService(
    tenantId: string,
    serviceCategoryId: string,
    settings?: Record<string, any>,
  ) {
    // Check if service exists
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id: serviceCategoryId },
    });

    if (!category) {
      throw new NotFoundException('Service category not found');
    }

    // Check if already enabled
    const existing = await this.prisma.tenantService.findUnique({
      where: {
        tenantId_serviceCategoryId: {
          tenantId,
          serviceCategoryId,
        },
      },
    });

    if (existing) {
      // Update if already exists
      return this.prisma.tenantService.update({
        where: { id: existing.id },
        data: {
          isEnabled: true,
          settings,
        },
        include: {
          serviceCategory: true,
        },
      });
    }

    // Create new enablement
    return this.prisma.tenantService.create({
      data: {
        tenantId,
        serviceCategoryId,
        isEnabled: true,
        settings,
      },
      include: {
        serviceCategory: true,
      },
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🛍️ PRODUCTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  /**
   * Get products for tenant
   * Filterable by service category
   */
  async getProducts(
    tenantId: string,
    filters?: {
      serviceCategoryId?: string;
      isActive?: boolean;
      search?: string;
    },
  ) {
    return this.prisma.product.findMany({
      where: {
        tenantId,
        ...(filters?.serviceCategoryId && {
          tenantServiceId: filters.serviceCategoryId,
        }),
        ...(filters?.isActive !== undefined && {
          isActive: filters.isActive,
        }),
        ...(filters?.search && {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { name2: { contains: filters.search, mode: 'insensitive' } },
            { sku: { contains: filters.search, mode: 'insensitive' } },
          ],
        }),
      },
      include: {
        tenantService: {
          include: {
            serviceCategory: true,
          },
        },
        variants: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * Create new product
   */
  async createProduct(tenantId: string, data: CreateProductDto) {
    // Verify tenant service exists
    const tenantService = await this.prisma.tenantService.findFirst({
      where: {
        id: data.tenantServiceId,
        tenantId,
      },
    });

    if (!tenantService) {
      throw new NotFoundException('Service not enabled for this tenant');
    }

    return this.prisma.product.create({
      data: {
        ...data,
        tenantId,
      },
      include: {
        tenantService: {
          include: {
            serviceCategory: true,
          },
        },
        variants: true,
      },
    });
  }

  /**
   * Update product
   */
  async updateProduct(
    tenantId: string,
    productId: string,
    data: UpdateProductDto,
  ) {
    // Verify ownership
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        tenantId,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.prisma.product.update({
      where: { id: productId },
      data,
      include: {
        tenantService: {
          include: {
            serviceCategory: true,
          },
        },
        variants: true,
      },
    });
  }

  /**
   * Delete (soft delete) product
   */
  async deleteProduct(tenantId: string, productId: string) {
    // Verify ownership
    const product = await this.prisma.product.findFirst({
      where: {
        id: productId,
        tenantId,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    // Soft delete: set isActive = false
    return this.prisma.product.update({
      where: { id: productId },
      data: { isActive: false },
    });
  }

  /**
   * Calculate order item price with variants
   * Used when creating order items
   */
  async calculateItemPrice(
    productId: string,
    variantIds: string[] = [],
    quantity: number = 1,
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: {
          where: {
            id: { in: variantIds },
            isActive: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    let totalPrice = product.basePrice;

    // Add variant adjustments
    for (const variant of product.variants) {
      if (variant.adjustmentType === 'FIXED') {
        totalPrice += variant.priceAdjustment;
      } else {
        // PERCENTAGE
        totalPrice += (totalPrice * variant.priceAdjustment) / 100;
      }
    }

    // Apply quantity
    if (product.pricingType === 'PER_PIECE') {
      totalPrice *= quantity;
    } else if (product.pricingType === 'PER_KG') {
      totalPrice *= quantity; // quantity = weight in kg
    }
    // FLAT_RATE: no multiplication

    return {
      basePrice: product.basePrice,
      variantAdjustments: product.variants.reduce(
        (sum, v) => sum + Number(v.priceAdjustment),
        0,
      ),
      quantity,
      totalPrice,
    };
  }
}
```

---

#### Step 2.3: DTOs (Data Transfer Objects)

**What are DTOs?**
```
DTO = Contract for data shape

Like a form with rules:
- Name: required, min 3 characters
- Email: required, must be valid email
- Age: optional, must be number

DTOs provide:
- Validation
- Type safety
- Documentation
```

**File**: `apps/api/src/catalog/dto/create-product.dto.ts`

```typescript
// 🔵 LEARNING: class-validator decorators
// These auto-validate incoming data

import {
  IsString,
  IsOptional,
  IsNumber,
  IsEnum,
  IsBoolean,
  IsObject,
  Min,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger'; // For API docs

export class CreateProductDto {
  @ApiProperty({ example: 'shirt-dry-clean' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  sku?: string;

  @ApiProperty({ example: "Men's Dress Shirt" })
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty({ example: 'قميص رجالي', required: false })
  @IsString()
  @IsOptional()
  @MaxLength(200)
  name2?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  description2?: string;

  @ApiProperty({ example: 'tenant-service-id-here' })
  @IsString()
  tenantServiceId: string;

  @ApiProperty({ enum: ['PER_PIECE', 'PER_KG', 'FLAT_RATE'] })
  @IsEnum(['PER_PIECE', 'PER_KG', 'FLAT_RATE'])
  pricingType: string;

  @ApiProperty({ example: 2.5 })
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiProperty({ example: 'OMR' })
  @IsString()
  @MaxLength(3)
  currency: string;

  @ApiProperty({ example: 48 })
  @IsNumber()
  @Min(1)
  turnaroundHours: number;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  imageUrl?: string;

  @ApiProperty({ required: false })
  @IsObject()
  @IsOptional()
  attributes?: Record<string, any>;

  @ApiProperty({ default: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiProperty({ default: 0 })
  @IsNumber()
  @IsOptional()
  sortOrder?: number;
}
```

**File**: `apps/api/src/catalog/dto/update-product.dto.ts`

```typescript
import { PartialType } from '@nestjs/swagger';
import { CreateProductDto } from './create-product.dto';

// 🔵 LEARNING: PartialType makes all fields optional
// Perfect for PATCH endpoints (partial updates)

export class UpdateProductDto extends PartialType(CreateProductDto) {}
```

---

#### Step 2.4: Controller (HTTP Routes)

**File**: `apps/api/src/catalog/catalog.controller.ts`

```typescript
// 🔵 LEARNING: Controller = Traffic director
// Routes HTTP requests to service methods

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CatalogService } from './catalog.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TenantGuard } from '../auth/guards/tenant.guard';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { CreateProductDto, UpdateProductDto } from './dto';

@ApiTags('Catalog') // Groups endpoints in Swagger UI
@Controller('api/v1/catalog')
@UseGuards(JwtAuthGuard, TenantGuard) // Require authentication
@ApiBearerAuth()
export class CatalogController {
  constructor(private catalogService: CatalogService) {}

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 📂 SERVICE CATEGORIES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get('service-categories')
  @ApiOperation({ summary: 'Get all service categories' })
  @ApiResponse({ status: 200, description: 'Returns service categories' })
  async getServiceCategories(@Query('isActive') isActive?: boolean) {
    return this.catalogService.getServiceCategories(isActive);
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🏢 TENANT SERVICES
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get('tenant/services')
  @ApiOperation({ summary: 'Get services enabled for current tenant' })
  async getTenantServices(@CurrentTenant() tenantId: string) {
    return this.catalogService.getTenantServices(tenantId);
  }

  @Post('tenant/services/enable')
  @ApiOperation({ summary: 'Enable a service for tenant' })
  async enableService(
    @CurrentTenant() tenantId: string,
    @Body() body: { serviceCategoryId: string; settings?: Record<string, any> },
  ) {
    return this.catalogService.enableService(
      tenantId,
      body.serviceCategoryId,
      body.settings,
    );
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 🛍️ PRODUCTS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  @Get('products')
  @ApiOperation({ summary: 'Get all products for tenant' })
  @ApiResponse({ status: 200, description: 'Returns products list' })
  async getProducts(
    @CurrentTenant() tenantId: string,
    @Query('serviceCategoryId') serviceCategoryId?: string,
    @Query('isActive') isActive?: boolean,
    @Query('search') search?: string,
  ) {
    return this.catalogService.getProducts(tenantId, {
      serviceCategoryId,
      isActive,
      search,
    });
  }

  @Post('products')
  @ApiOperation({ summary: 'Create new product' })
  @ApiResponse({ status: 201, description: 'Product created successfully' })
  async createProduct(
    @CurrentTenant() tenantId: string,
    @Body() createProductDto: CreateProductDto,
  ) {
    return this.catalogService.createProduct(tenantId, createProductDto);
  }

  @Get('products/:id')
  @ApiOperation({ summary: 'Get product by ID' })
  async getProduct(
    @CurrentTenant() tenantId: string,
    @Param('id') productId: string,
  ) {
    // Implement in service
    return { message: 'Get single product' };
  }

  @Patch('products/:id')
  @ApiOperation({ summary: 'Update product' })
  async updateProduct(
    @CurrentTenant() tenantId: string,
    @Param('id') productId: string,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.catalogService.updateProduct(tenantId, productId, updateProductDto);
  }

  @Delete('products/:id')
  @ApiOperation({ summary: 'Delete product (soft delete)' })
  async deleteProduct(
    @CurrentTenant() tenantId: string,
    @Param('id') productId: string,
  ) {
    return this.catalogService.deleteProduct(tenantId, productId);
  }

  @Post('products/:id/calculate-price')
  @ApiOperation({ summary: 'Calculate price with variants' })
  async calculatePrice(
    @Param('id') productId: string,
    @Body() body: { variantIds?: string[]; quantity?: number },
  ) {
    return this.catalogService.calculateItemPrice(
      productId,
      body.variantIds,
      body.quantity,
    );
  }
}
```

---

#### Step 2.5: Test API with Postman/Thunder Client

**Test Sequence:**

```bash
# 1. Login to get JWT token
POST http://localhost:3000/api/v1/auth/login
{
  "email": "admin@demo-laundry.com",
  "password": "password123"
}

# Response: { "accessToken": "eyJhbGci..." }

# 2. Get service categories
GET http://localhost:3000/api/v1/catalog/service-categories
Headers: Authorization: Bearer <your-token>

# 3. Get tenant services
GET http://localhost:3000/api/v1/catalog/tenant/services
Headers: Authorization: Bearer <your-token>

# 4. Create product
POST http://localhost:3000/api/v1/catalog/products
Headers: Authorization: Bearer <your-token>
{
  "name": "Test Shirt",
  "name2": "قميص تجريبي",
  "tenantServiceId": "<service-id-from-step-3>",
  "pricingType": "PER_PIECE",
  "basePrice": 3.0,
  "currency": "OMR",
  "turnaroundHours": 48
}

# 5. Calculate price with variant
POST http://localhost:3000/api/v1/catalog/products/<product-id>/calculate-price
{
  "variantIds": ["<variant-id>"],
  "quantity": 2
}
```

---

### 🎨 **DAY 3: FRONTEND - SERVICE MANAGEMENT (5-6 hours)**

#### What We'll Build

Admin UI for managing:
1. Service catalog (list, create, edit)
2. Product catalog (with image upload)
3. Pricing configuration
4. Multi-language forms

**Tech Stack:**
- **Next.js 14**: App Router with Server Components
- **TailwindCSS**: Styling
- **Shadcn/UI**: Component library
- **React Hook Form**: Form management
- **Zod**: Validation

---

#### Step 3.1: Install Dependencies

```bash
cd apps/web

# 🔵 LEARNING: These packages provide:
# - react-hook-form: Form state management
# - zod: Schema validation
# - @tanstack/react-query: Server state management
# - uploadthing: File upload (or use any other)

npm install react-hook-form @hookform/resolvers zod
npm install @tanstack/react-query
npm install uploadthing @uploadthing/react
```

---

#### Step 3.2: Create Service Catalog Page

**File**: `apps/web/app/[locale]/dashboard/services/page.tsx`

```typescript
// 🔵 LEARNING: Server Component (default in App Router)
// Fetches data on server, then streams to client

import { Suspense } from 'react';
import { ServicesList } from './ServicesList';
import { LoadingSkeleton } from '@/components/ui/loading-skeleton';

export const metadata = {
  title: 'Services | CleanMateX',
  description: 'Manage your service catalog',
};

export default async function ServicesPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Service Catalog</h1>
          <p className="text-muted-foreground mt-1">
            Manage your laundry services and products
          </p>
        </div>
      </div>

      {/* Suspense allows streaming while loading */}
      <Suspense fallback={<LoadingSkeleton />}>
        <ServicesList />
      </Suspense>
    </div>
  );
}
```

---

#### Step 3.3: Services List Component

**File**: `apps/web/app/[locale]/dashboard/services/ServicesList.tsx`

```typescript
'use client';

// 🔵 LEARNING: Client Component (interactive)
// Use 'use client' when you need:
// - useState, useEffect
// - Event handlers (onClick, onChange)
// - Browser APIs

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ProductDialog } from './ProductDialog';
import { api } from '@/lib/api';

export function ServicesList() {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // 🔵 LEARNING: React Query manages server state
  // Benefits:
  // - Automatic caching
  // - Background refetching
  // - Loading/error states
  // - Automatic retries
  
  const { data: services, isLoading, error } = useQuery({
    queryKey: ['tenant-services'],
    queryFn: () => api.get('/catalog/tenant/services'),
  });

  if (isLoading) {
    return <div>Loading services...</div>;
  }

  if (error) {
    return <div>Error loading services: {error.message}</div>;
  }

  return (
    <div className="space-y-6">
      {services?.map((service) => (
        <Card key={service.id} className="p-6">
          {/* Service Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <span className="text-2xl">{service.serviceCategory.icon}</span>
              </div>
              
              {/* Title */}
              <div>
                <h3 className="text-xl font-semibold">
                  {service.serviceCategory.name}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {service.serviceCategory.name2}
                </p>
              </div>
            </div>

            {/* Status Badge */}
            <Badge variant={service.isEnabled ? 'success' : 'secondary'}>
              {service.isEnabled ? 'Enabled' : 'Disabled'}
            </Badge>
          </div>

          {/* Products Grid */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-3">
              <h4 className="font-medium">Products</h4>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedService(service.id);
                  setIsDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </Button>
            </div>

            {service.products.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No products yet. Add your first product!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {service.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onEdit={() => {
                      // Open edit dialog
                    }}
                    onDelete={() => {
                      // Handle delete
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      ))}

      {/* Product Dialog */}
      <ProductDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        tenantServiceId={selectedService}
      />
    </div>
  );
}

// Product Card Component
function ProductCard({ product, onEdit, onDelete }) {
  return (
    <Card className="p-4 hover:shadow-lg transition-shadow">
      {/* Product Image */}
      {product.imageUrl && (
        <div className="aspect-video mb-3 rounded-lg overflow-hidden bg-gray-100">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Product Info */}
      <div className="space-y-2">
        <h5 className="font-medium">{product.name}</h5>
        {product.name2 && (
          <p className="text-sm text-muted-foreground">{product.name2}</p>
        )}

        {/* Price */}
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-primary">
            {product.currency} {product.basePrice}
          </span>
          <Badge variant="outline">{product.pricingType}</Badge>
        </div>

        {/* Turnaround */}
        <p className="text-xs text-muted-foreground">
          Ready in {product.turnaroundHours}h
        </p>

        {/* Variants */}
        {product.variants.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {product.variants.map((variant) => (
              <Badge key={variant.id} variant="secondary" className="text-xs">
                {variant.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-4">
        <Button variant="outline" size="sm" className="flex-1" onClick={onEdit}>
          <Edit className="w-3 h-3 mr-1" />
          Edit
        </Button>
        <Button variant="outline" size="sm" onClick={onDelete}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </Card>
  );
}
```

---

#### Step 3.4: Product Dialog (Create/Edit)

**File**: `apps/web/app/[locale]/dashboard/services/ProductDialog.tsx`

```typescript
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// 🔵 LEARNING: Zod schema for validation
// Same rules as backend DTOs!
const productSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters'),
  name2: z.string().optional(),
  description: z.string().optional(),
  description2: z.string().optional(),
  sku: z.string().optional(),
  pricingType: z.enum(['PER_PIECE', 'PER_KG', 'FLAT_RATE']),
  basePrice: z.number().min(0, 'Price must be positive'),
  currency: z.string().default('OMR'),
  turnaroundHours: z.number().min(1),
  sortOrder: z.number().default(0),
});

type ProductFormData = z.infer<typeof productSchema>;

export function ProductDialog({ isOpen, onClose, tenantServiceId, product }) {
  const queryClient = useQueryClient();

  // 🔵 LEARNING: React Hook Form setup
  const form = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: product || {
      name: '',
      name2: '',
      pricingType: 'PER_PIECE',
      basePrice: 0,
      currency: 'OMR',
      turnaroundHours: 48,
      sortOrder: 0,
    },
  });

  // 🔵 LEARNING: Mutation for creating/updating
  const mutation = useMutation({
    mutationFn: async (data: ProductFormData) => {
      if (product) {
        return api.patch(`/catalog/products/${product.id}`, data);
      } else {
        return api.post('/catalog/products', {
          ...data,
          tenantServiceId,
        });
      }
    },
    onSuccess: () => {
      // Refetch services list
      queryClient.invalidateQueries({ queryKey: ['tenant-services'] });
      onClose();
      form.reset();
    },
  });

  const onSubmit = (data: ProductFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? 'Edit Product' : 'Add New Product'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* English Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name (English) *</FormLabel>
                  <FormControl>
                    <Input placeholder="Men's Dress Shirt" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Arabic Name */}
            <FormField
              control={form.control}
              name="name2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Product Name (Arabic)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="قميص رجالي"
                      dir="rtl"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Two columns: Pricing Type & Base Price */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="pricingType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pricing Type *</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <option value="PER_PIECE">Per Piece</option>
                        <option value="PER_KG">Per Kilogram</option>
                        <option value="FLAT_RATE">Flat Rate</option>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="basePrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base Price *</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="2.50"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseFloat(e.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Turnaround Hours */}
            <FormField
              control={form.control}
              name="turnaroundHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Turnaround Time (hours) *</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="1"
                      placeholder="48"
                      {...field}
                      onChange={(e) =>
                        field.onChange(parseInt(e.target.value))
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* English Description */}
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (English)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Professional dry cleaning for dress shirts..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Arabic Description */}
            <FormField
              control={form.control}
              name="description2"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Arabic)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="تنظيف احترافي للقمصان..."
                      dir="rtl"
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending
                  ? 'Saving...'
                  : product
                  ? 'Update Product'
                  : 'Create Product'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
```

---

### 📸 **DAY 4: IMAGE UPLOAD (3-4 hours)**

#### Concept: File Upload Flow

```
User Flow:
1. User selects image file
2. Frontend uploads to storage (S3/MinIO)
3. Storage returns public URL
4. Frontend sends URL to API
5. API saves URL in database

Technologies:
- Storage: MinIO (S3-compatible, free)
- CDN: Optional (Cloudflare R2 free tier)
```

---

#### Step 4.1: Setup MinIO (Local Development)

**Docker Compose**: `docker-compose.yml`

```yaml
services:
  # ... existing services (postgres, redis)

  minio:
    image: minio/minio:latest
    container_name: cleanmatex-minio
    ports:
      - "9000:9000"      # API
      - "9001:9001"      # Console UI
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin123
    command: server /data --console-address ":9001"
    volumes:
      - minio-data:/data
    networks:
      - cleanmatex-network

volumes:
  minio-data:
```

**Start MinIO:**

```bash
docker-compose up -d minio

# Access MinIO Console: http://localhost:9001
# Login: minioadmin / minioadmin123
```

---

#### Step 4.2: Create Bucket

```bash
# Install MinIO client
brew install minio/stable/mc  # macOS
# or
wget https://dl.min.io/client/mc/release/linux-amd64/mc  # Linux

# Configure
mc alias set local http://localhost:9000 minioadmin minioadmin123

# Create bucket
mc mb local/cleanmatex-products

# Set public read policy
mc anonymous set download local/cleanmatex-products
```

---

#### Step 4.3: Backend Upload Endpoint

**Install S3 SDK:**

```bash
cd apps/api
npm install @aws-sdk/client-s3 multer
npm install --save-dev @types/multer
```

**File**: `apps/api/src/upload/upload.service.ts`

```typescript
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private s3Client: S3Client;
  private bucketName = 'cleanmatex-products';

  constructor() {
    this.s3Client = new S3Client({
      region: 'us-east-1',
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin123',
      },
      forcePathStyle: true, // Required for MinIO
    });
  }

  async uploadProductImage(
    file: Express.Multer.File,
    tenantId: string,
  ): Promise<string> {
    // Generate unique filename
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `products/${tenantId}/${uuidv4()}.${fileExtension}`;

    // Upload to S3/MinIO
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      }),
    );

    // Return public URL
    const baseUrl = process.env.S3_PUBLIC_URL || 'http://localhost:9000';
    return `${baseUrl}/${this.bucketName}/${fileName}`;
  }
}
```

**Controller:**

```typescript
@Post('upload/product-image')
@UseInterceptors(FileInterceptor('file'))
async uploadProductImage(
  @CurrentTenant() tenantId: string,
  @UploadedFile() file: Express.Multer.File,
) {
  const imageUrl = await this.uploadService.uploadProductImage(file, tenantId);
  return { imageUrl };
}
```

---

#### Step 4.4: Frontend Image Upload

**Component**: `ImageUpload.tsx`

```typescript
'use client';

import { useState } from 'react';
import { Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';

export function ImageUpload({ value, onChange }) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(value);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post('/upload/product-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      onChange(response.data.imageUrl);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
      setPreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onChange(null);
  };

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-lg"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleRemove}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer hover:bg-gray-50">
          <Upload className="w-8 h-8 text-gray-400 mb-2" />
          <span className="text-sm text-gray-500">
            {uploading ? 'Uploading...' : 'Click to upload image'}
          </span>
          <input
            type="file"
            className="hidden"
            accept="image/*"
            onChange={handleFileChange}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}
```

---

### 🧪 **DAY 5: TESTING & REFINEMENT (3-4 hours)**

#### Testing Checklist

```
✅ Backend API Tests
├─ Create service category
├─ Enable service for tenant
├─ Create product
├─ Update product
├─ Delete product
├─ Calculate price with variants
└─ Upload image

✅ Frontend Tests
├─ List services
├─ Create product form validation
├─ Multi-language input (EN/AR)
├─ Image upload
└─ Error handling

✅ Integration Tests
├─ End-to-end product creation
├─ Multi-tenant isolation
└─ Price calculation accuracy
```

---

#### Unit Test Example

**File**: `apps/api/src/catalog/catalog.service.spec.ts`

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { CatalogService } from './catalog.service';
import { PrismaService } from '../prisma/prisma.service';

describe('CatalogService', () => {
  let service: CatalogService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CatalogService,
        {
          provide: PrismaService,
          useValue: {
            product: {
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CatalogService>(CatalogService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateItemPrice', () => {
    it('should calculate correct price for PER_PIECE', async () => {
      const mockProduct = {
        id: '1',
        basePrice: 10,
        pricingType: 'PER_PIECE',
        variants: [
          {
            priceAdjustment: 2,
            adjustmentType: 'FIXED',
          },
        ],
      };

      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct);

      const result = await service.calculateItemPrice('1', ['variant-1'], 3);

      expect(result.basePrice).toBe(10);
      expect(result.totalPrice).toBe(36); // (10 + 2) * 3
    });

    it('should calculate percentage adjustment', async () => {
      const mockProduct = {
        id: '1',
        basePrice: 100,
        pricingType: 'FLAT_RATE',
        variants: [
          {
            priceAdjustment: 20, // 20%
            adjustmentType: 'PERCENTAGE',
          },
        ],
      };

      jest.spyOn(prisma.product, 'findUnique').mockResolvedValue(mockProduct);

      const result = await service.calculateItemPrice('1', ['variant-1']);

      expect(result.totalPrice).toBe(120); // 100 + 20%
    });
  });
});
```

**Run Tests:**

```bash
npm run test
npm run test:cov  # With coverage
```

---

## ✅ **COMPLETION CHECKLIST**

### Backend Complete ✓
- [x] Database schema with migrations
- [x] Service categories CRUD
- [x] Tenant service enablement
- [x] Products CRUD with variants
- [x] Price calculation logic
- [x] Image upload to MinIO
- [x] Multi-tenancy enforcement
- [x] API documentation (Swagger)

### Frontend Complete ✓
- [x] Services list page
- [x] Product creation dialog
- [x] Multi-language forms (EN/AR)
- [x] Image upload component
- [x] Form validation
- [x] Error handling
- [x] Loading states

### Testing Complete ✓
- [x] Unit tests for services
- [x] API endpoint testing
- [x] Frontend component testing
- [x] Multi-tenant isolation verified

---

## 🎓 **KEY LEARNINGS SUMMARY**

### Database Design
- **Multi-language pattern**: name/name2 columns (simpler than i18n keys)
- **Composite unique constraints**: Enforce one-to-one tenant relationships
- **JSON columns**: Flexible configuration without schema changes
- **Enums**: Type-safe fixed value lists

### Backend Architecture
- **Service layer**: Business logic separate from controllers
- **DTOs**: Validate and type-check input data
- **Prisma**: Type-safe ORM with auto-generated types
- **Guards**: Protect routes with authentication/authorization

### Frontend Patterns
- **Server Components**: Fast initial load, SEO-friendly
- **Client Components**: Interactive with React hooks
- **React Query**: Manage server state with caching
- **React Hook Form + Zod**: Powerful form management

### File Uploads
- **S3-compatible storage**: MinIO for development, S3/R2 for production
- **CDN**: Serve images fast globally
- **Signed URLs**: Secure private files (future)

---

## 📚 **NEXT STEPS**

After completing PRD-008, you should:

1. **Review & Refactor**: Clean up any messy code
2. **Document**: Add inline comments for complex logic
3. **Performance**: Add database indexes if needed
4. **Security**: Verify multi-tenant isolation
5. **Move to PRD-009**: Assembly & QA workflows

---

## 🆘 **COMMON ISSUES & SOLUTIONS**

### Issue: "Prisma Client not generated"
```bash
npx prisma generate
```

### Issue: "Multi-tenant data leaking"
- Check RLS policies in database
- Verify tenantId in all queries
- Add composite indexes

### Issue: "Image upload fails"
- Check MinIO is running: `docker ps`
- Verify bucket exists and is public
- Check CORS settings

### Issue: "Form validation not working"
- Ensure Zod schema matches DTOs
- Check resolver is configured
- Verify FormField is properly bound

---

**Congratulations!** 🎉 You've completed PRD-008 and learned:
- Complex database relationships
- Multi-language data management
- File uploads with S3
- Professional form handling
- Service-oriented backend architecture

**Estimated Time**: 5 days  
**Actual Complexity**: ⭐⭐⭐ Moderate  
**Skills Gained**: 🚀 Database design, API development, Form management, File uploads

---

**Next**: [PRD-009: Assembly & QA Implementation →](./PRD_009_Assembly_QA_Implementation.md)

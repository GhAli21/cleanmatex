# PRD-023: Bilingual Support (EN/AR) - Implementation Plan

**Project**: CleanMateX - Laundry & Dry Cleaning SaaS  
**Phase**: Phase 2 - Enhanced Operations  
**Priority**: 🔴 CRITICAL - Foundation Feature  
**Status**: ⭐ MOVED FROM PHASE 3  
**Duration**: Week 9 (4-5 days)  
**Effort**: Medium  
**Risk**: Low  
**Developer**: Solo with AI Tools

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Why This Matters](#why-this-matters)
3. [Learning Objectives](#learning-objectives)
4. [Technical Architecture](#technical-architecture)
5. [Implementation Steps](#implementation-steps)
6. [Testing & QA](#testing--qa)
7. [Success Criteria](#success-criteria)
8. [Troubleshooting](#troubleshooting)
9. [Resources](#resources)

---

## Overview

### What You'll Build
A complete bilingual system supporting English and Arabic with:
- Database fields for both languages (name/name2 pattern)
- Backend API with i18n support
- Web admin with RTL (Right-to-Left) layout
- Flutter mobile app with RTL support
- Language switcher in all interfaces
- Proper formatting for dates, numbers, and currency

### Dependencies
- ✅ None - This is a foundation feature
- Must be completed before other Phase 2 features

### Tech Stack
- **Backend**: nestjs-i18n
- **Web**: next-i18next, i18next
- **Mobile**: easy_localization
- **Database**: PostgreSQL (name/name2 columns)

---

## Why This Matters

### Business Reasons
1. **GCC Market Requirement**: Arabic is mandatory for your target market (Oman, Saudi, UAE)
2. **Professional Image**: Proper Arabic support shows quality and commitment
3. **Wider Reach**: Can serve Arabic-only customers (elderly, traditional businesses)
4. **Competitive Edge**: Many competitors have poor Arabic support
5. **Trust Building**: Native language builds customer confidence

### Technical Reasons
1. **Foundation First**: Easier to build features with i18n from the start than retrofitting later
2. **RTL Complexity**: Right-to-Left layout requires careful planning in CSS and UI components
3. **Data Integrity**: Bilingual database pattern needs to be established early
4. **User Experience**: Language switching should be seamless across all apps

---

## Learning Objectives

### 🎓 What is i18n?

**i18n = Internationalization**
- "i18n" is shorthand: "i" + 18 letters + "n" (internationalization)
- It's the process of designing software to support multiple languages
- Separates text content from code into translation files
- Allows switching languages without changing code

**Why not just translate in code?**
```typescript
// ❌ BAD: Hard-coded text
<button>Create Order</button>

// ✅ GOOD: Translatable text
<button>{t('orders.create')}</button>
```

**Benefits**:
- Easy to add new languages
- Translators can work without touching code
- Consistent terminology across app
- Professional approach

### 🎓 What is RTL?

**RTL = Right-to-Left**
- Arabic, Hebrew, Farsi, Urdu are RTL languages
- Everything mirrors horizontally:
  - Navigation: Right side instead of left
  - Text: Reads from right to left
  - Forms: Labels on right, inputs on left
  - Icons: Some need to flip (arrows), some don't (logos)

**Visual Example**:
```
LTR (English):
[☰ Menu]  [🔍 Search]  [👤 Profile]  →

RTL (Arabic):
←  [Profile 👤]  [Search 🔍]  [Menu ☰]
```

**CSS Impact**:
```css
/* LTR */
.sidebar {
  float: left;
  margin-right: 20px;
}

/* RTL */
.sidebar {
  float: right;
  margin-left: 20px;
}
```

### 🎓 Database Bilingual Patterns

**Option 1: name/name2 Pattern** (✅ We use this)
```sql
CREATE TABLE services (
  id UUID,
  name TEXT,      -- English: "Dry Clean"
  name2 TEXT      -- Arabic: "تنظيف جاف"
);
```

**Pros**:
- Simple to query
- Fast (no joins needed)
- Easy to understand
- GCC standard

**Cons**:
- Limited to 2 languages
- Repetitive for many fields

**Option 2: Translation Table** (❌ We don't use)
```sql
CREATE TABLE services (id UUID);
CREATE TABLE service_translations (
  service_id UUID,
  locale VARCHAR(5),
  name TEXT
);
```

**Pros**:
- Unlimited languages
- Normalized data

**Cons**:
- Requires joins (slower)
- Complex queries
- Over-engineering for 2 languages

**Option 3: JSONB Column** (❌ We don't use)
```sql
CREATE TABLE services (
  id UUID,
  name JSONB  -- {"en": "Dry Clean", "ar": "تنظيف جاف"}
);
```

**Pros**:
- Flexible
- Easy to add languages

**Cons**:
- Harder to index
- Less type-safe
- Complex queries

---

## Technical Architecture

### System-Wide Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Bilingual Architecture                   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐        ┌──────────────────┐      │
│  │    Database      │        │  Translation     │       │
│  │   (PostgreSQL)   │        │     Files        │       │
│  │                  │        │   (JSON/YAML)    │       │
│  │  name:  English  │        │                  │       │
│  │  name2: Arabic   │        │  common.json     │       │
│  │                  │        │  orders.json     │       │
│  └────────┬─────────┘        │  etc...          │       │
│           │                  └────────┬─────────┘       │
│           │                           │                  │
│           ▼                           ▼                  │
│  ┌────────────────────────────────────────┐            │
│  │      Backend API (NestJS)               │            │
│  │  - Returns both name & name2            │            │
│  │  - Accepts ?lang=ar parameter           │            │
│  │  - Translates error messages            │            │
│  │  - Formats dates/numbers per locale     │            │
│  └──────────────┬─────────────────────────┘            │
│                 │                                        │
│                 ▼                                        │
│  ┌─────────────────────────────────────────────┐       │
│  │           Frontend Layer                     │       │
│  │                                               │       │
│  │  ┌─────────────────┐  ┌─────────────────┐  │       │
│  │  │  Next.js Web    │  │  Flutter Mobile  │  │       │
│  │  │  (i18next)      │  │  (easy_local.)   │  │       │
│  │  │                 │  │                  │  │       │
│  │  │  - RTL CSS      │  │  - RTL Widgets   │  │       │
│  │  │  - Direction    │  │  - TextDirection │  │       │
│  │  │  - Font swap    │  │  - Font swap     │  │       │
│  │  └─────────────────┘  └─────────────────┘  │       │
│  └─────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

### Language Detection Flow

```
User Request
    ↓
1. Check URL path: /ar/dashboard
    ↓
2. Check query param: ?lang=ar
    ↓
3. Check Accept-Language header: ar-SA
    ↓
4. Check user preference (if logged in)
    ↓
5. Default to English
    ↓
Apply Language
    ↓
Return Translated Content
```

---

## Implementation Steps

### Step 1: Database Schema Updates (Day 1)

#### 1.1 Update Prisma Schema

**File**: `apps/api/prisma/schema.prisma`

Add bilingual fields to all user-facing tables:

```prisma
// Service Categories
model org_service_category_cf {
  id                     String   @id @default(uuid())
  tenant_org_id          String
  service_category_code  String
  
  // Bilingual fields
  name                   String   // English
  name2                  String?  // Arabic
  description            String?
  description2           String?  // Arabic description
  
  icon                   String?
  is_active              Boolean  @default(true)
  display_order          Int      @default(0)
  created_at             DateTime @default(now())
  updated_at             DateTime @updatedAt
  
  tenant                 org_tenants_mst @relation(fields: [tenant_org_id], references: [id])
  
  @@unique([tenant_org_id, service_category_code])
  @@map("org_service_category_cf")
}

// Products/Items
model org_product_data_mst {
  id                 String   @id @default(uuid())
  tenant_org_id      String
  code               String
  
  // Bilingual fields
  name               String   // English
  name2              String?  // Arabic
  description        String?
  description2       String?  // Arabic
  
  category_code      String
  unit_price         Decimal  @db.Decimal(10, 3)
  unit_type          String   // piece, kg, set
  is_active          Boolean  @default(true)
  tags               Json?
  created_at         DateTime @default(now())
  updated_at         DateTime @updatedAt
  
  tenant             org_tenants_mst @relation(fields: [tenant_org_id], references: [id])
  
  @@unique([tenant_org_id, code])
  @@map("org_product_data_mst")
}

// Order Status Codes
model sys_order_status_cd {
  id              String   @id @default(uuid())
  code            String   @unique
  
  // Bilingual fields
  name            String   // English
  name2           String?  // Arabic
  description     String?
  description2    String?  // Arabic
  
  display_order   Int      @default(0)
  color           String?  // For UI badges
  is_active       Boolean  @default(true)
  
  @@map("sys_order_status_cd")
}

// Branches
model org_branches_mst {
  id              String   @id @default(uuid())
  tenant_org_id   String
  
  // Bilingual fields
  name            String   // English
  name2           String?  // Arabic
  address         String?
  address2        String?  // Arabic
  
  phone           String?
  email           String?
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now())
  
  tenant          org_tenants_mst @relation(fields: [tenant_org_id], references: [id])
  
  @@unique([tenant_org_id, name])
  @@map("org_branches_mst")
}
```

#### 1.2 Create Migration

```bash
cd apps/api

# Generate migration file
npx prisma migrate dev --name add_bilingual_fields

# This creates: prisma/migrations/[timestamp]_add_bilingual_fields/migration.sql
```

**Generated Migration** (example):
```sql
-- Add bilingual fields to existing tables
ALTER TABLE org_service_category_cf ADD COLUMN name2 TEXT;
ALTER TABLE org_service_category_cf ADD COLUMN description2 TEXT;

ALTER TABLE org_product_data_mst ADD COLUMN name2 TEXT;
ALTER TABLE org_product_data_mst ADD COLUMN description2 TEXT;

ALTER TABLE sys_order_status_cd ADD COLUMN name2 TEXT;
ALTER TABLE sys_order_status_cd ADD COLUMN description2 TEXT;

ALTER TABLE org_branches_mst ADD COLUMN name2 TEXT;
ALTER TABLE org_branches_mst ADD COLUMN address2 TEXT;
```

#### 1.3 Apply Migration

```bash
# Apply to development database
npx prisma migrate deploy

# Regenerate Prisma Client with new types
npx prisma generate
```

#### 1.4 Seed Bilingual Data

**File**: `apps/api/prisma/seeds/bilingual-data.seed.ts`

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const orderStatuses = [
  {
    code: 'intake',
    name: 'Intake',
    name2: 'استلام',
    description: 'Order received at counter',
    description2: 'تم استلام الطلب في المحل',
    color: 'blue',
    display_order: 1,
  },
  {
    code: 'preparation',
    name: 'Preparation',
    name2: 'تحضير',
    description: 'Itemizing and tagging',
    description2: 'جاري تفصيل القطع ووضع العلامات',
    color: 'yellow',
    display_order: 2,
  },
  {
    code: 'washing',
    name: 'Washing',
    name2: 'غسيل',
    description: 'In washing process',
    description2: 'قيد عملية الغسيل',
    color: 'blue',
    display_order: 3,
  },
  {
    code: 'drying',
    name: 'Drying',
    name2: 'تجفيف',
    description: 'Drying process',
    description2: 'عملية التجفيف',
    color: 'orange',
    display_order: 4,
  },
  {
    code: 'finishing',
    name: 'Finishing',
    name2: 'كي',
    description: 'Ironing and finishing',
    description2: 'الكي والتشطيب',
    color: 'purple',
    display_order: 5,
  },
  {
    code: 'assembly',
    name: 'Assembly',
    name2: 'تجميع',
    description: 'Assembling items',
    description2: 'تجميع القطع',
    color: 'indigo',
    display_order: 6,
  },
  {
    code: 'qa',
    name: 'Quality Check',
    name2: 'فحص الجودة',
    description: 'Quality assurance check',
    description2: 'فحص ضمان الجودة',
    color: 'pink',
    display_order: 7,
  },
  {
    code: 'packing',
    name: 'Packing',
    name2: 'تعبئة',
    description: 'Packing items',
    description2: 'تعبئة القطع',
    color: 'teal',
    display_order: 8,
  },
  {
    code: 'ready',
    name: 'Ready',
    name2: 'جاهز',
    description: 'Ready for pickup/delivery',
    description2: 'جاهز للاستلام أو التوصيل',
    color: 'green',
    display_order: 9,
  },
  {
    code: 'out_for_delivery',
    name: 'Out for Delivery',
    name2: 'خارج للتوصيل',
    description: 'Driver en route',
    description2: 'السائق في الطريق',
    color: 'blue',
    display_order: 10,
  },
  {
    code: 'delivered',
    name: 'Delivered',
    name2: 'تم التسليم',
    description: 'Delivered to customer',
    description2: 'تم التسليم للعميل',
    color: 'green',
    display_order: 11,
  },
  {
    code: 'closed',
    name: 'Closed',
    name2: 'مغلق',
    description: 'Order completed',
    description2: 'تم إكمال الطلب',
    color: 'gray',
    display_order: 12,
  },
];

const serviceCategories = [
  {
    code: 'wash_iron',
    name: 'Wash & Iron',
    name2: 'غسيل وكي',
    description: 'Complete washing and ironing service',
    description2: 'خدمة غسيل وكي شاملة',
    icon: 'wash',
  },
  {
    code: 'dry_clean',
    name: 'Dry Clean',
    name2: 'تنظيف جاف',
    description: 'Professional dry cleaning',
    description2: 'تنظيف جاف احترافي',
    icon: 'dry',
  },
  {
    code: 'iron_only',
    name: 'Iron Only',
    name2: 'كي فقط',
    description: 'Ironing service only',
    description2: 'خدمة الكي فقط',
    icon: 'iron',
  },
  {
    code: 'express',
    name: 'Express',
    name2: 'خدمة سريعة',
    description: 'Same day or next day',
    description2: 'نفس اليوم أو اليوم التالي',
    icon: 'express',
  },
];

async function seedBilingualData() {
  console.log('🌍 Seeding bilingual data...');

  // Seed order statuses
  for (const status of orderStatuses) {
    await prisma.sys_order_status_cd.upsert({
      where: { code: status.code },
      update: status,
      create: status,
    });
  }
  console.log('✅ Order statuses seeded');

  // Service categories would be tenant-specific
  // This is just an example structure
  console.log('✅ Bilingual data seeded successfully!');
}

seedBilingualData()
  .catch((e) => {
    console.error('❌ Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Run the seed**:
```bash
npx ts-node prisma/seeds/bilingual-data.seed.ts
```

---

### Step 2: Backend API i18n Setup (Day 1-2)

#### 2.1 Install Dependencies

```bash
cd apps/api
npm install nestjs-i18n
```

#### 2.2 Configure i18n Module

**File**: `apps/api/src/config/i18n.config.ts`

```typescript
import { I18nOptions } from 'nestjs-i18n';
import * as path from 'path';

export const i18nConfig: I18nOptions = {
  fallbackLanguage: 'en',
  loaderOptions: {
    path: path.join(__dirname, '../i18n/translations/'),
    watch: true, // Auto-reload in development
  },
};
```

#### 2.3 Add to App Module

**File**: `apps/api/src/app.module.ts`

```typescript
import { Module } from '@nestjs/common';
import {
  I18nModule,
  QueryResolver,
  AcceptLanguageResolver,
  HeaderResolver,
} from 'nestjs-i18n';
import { i18nConfig } from './config/i18n.config';

@Module({
  imports: [
    // ... other modules

    // i18n Configuration
    I18nModule.forRoot({
      ...i18nConfig,
      resolvers: [
        // Priority order (first match wins):
        // 1. Query parameter: ?lang=ar
        { use: QueryResolver, options: ['lang', 'locale'] },
        // 2. Custom header: X-Language: ar
        { use: HeaderResolver, options: ['x-language'] },
        // 3. Accept-Language header: Accept-Language: ar-SA
        new AcceptLanguageResolver(),
      ],
    }),
  ],
})
export class AppModule {}
```

#### 🎓 Understanding Resolvers

**Resolvers** determine which language to use:

1. **QueryResolver**: Checks URL parameters
   ```
   GET /api/orders?lang=ar
   → Arabic
   ```

2. **HeaderResolver**: Checks custom HTTP header
   ```
   GET /api/orders
   X-Language: ar
   → Arabic
   ```

3. **AcceptLanguageResolver**: Checks browser/system language
   ```
   GET /api/orders
   Accept-Language: ar-SA,ar;q=0.9
   → Arabic
   ```

#### 2.4 Create Translation Files

**Directory Structure**:
```
apps/api/src/i18n/translations/
├── en/
│   ├── common.json
│   ├── orders.json
│   ├── customers.json
│   ├── validation.json
│   └── errors.json
└── ar/
    ├── common.json
    ├── orders.json
    ├── customers.json
    ├── validation.json
    └── errors.json
```

**File**: `apps/api/src/i18n/translations/en/common.json`

```json
{
  "success": "Success",
  "error": "Error",
  "not_found": "Not found",
  "unauthorized": "Unauthorized",
  "forbidden": "Forbidden",
  "validation_error": "Validation error",
  "created": "Created successfully",
  "updated": "Updated successfully",
  "deleted": "Deleted successfully"
}
```

**File**: `apps/api/src/i18n/translations/ar/common.json`

```json
{
  "success": "نجح",
  "error": "خطأ",
  "not_found": "غير موجود",
  "unauthorized": "غير مصرح",
  "forbidden": "ممنوع",
  "validation_error": "خطأ في التحقق",
  "created": "تم الإنشاء بنجاح",
  "updated": "تم التحديث بنجاح",
  "deleted": "تم الحذف بنجاح"
}
```

**File**: `apps/api/src/i18n/translations/en/orders.json`

```json
{
  "title": "Orders",
  "create": "Create Order",
  "update": "Update Order",
  "delete": "Delete Order",
  "not_found": "Order not found",
  "created": "Order created successfully",
  "updated": "Order updated successfully",
  "cancelled": "Order cancelled",
  "status": {
    "intake": "Intake",
    "preparation": "Preparation",
    "washing": "Washing",
    "drying": "Drying",
    "finishing": "Finishing",
    "assembly": "Assembly",
    "qa": "Quality Check",
    "packing": "Packing",
    "ready": "Ready",
    "out_for_delivery": "Out for Delivery",
    "delivered": "Delivered",
    "closed": "Closed"
  },
  "validation": {
    "customer_required": "Customer is required",
    "items_required": "At least one item is required",
    "invalid_date": "Invalid ready-by date",
    "invalid_status": "Invalid status transition"
  }
}
```

**File**: `apps/api/src/i18n/translations/ar/orders.json`

```json
{
  "title": "الطلبات",
  "create": "إنشاء طلب",
  "update": "تحديث الطلب",
  "delete": "حذف الطلب",
  "not_found": "الطلب غير موجود",
  "created": "تم إنشاء الطلب بنجاح",
  "updated": "تم تحديث الطلب بنجاح",
  "cancelled": "تم إلغاء الطلب",
  "status": {
    "intake": "استلام",
    "preparation": "تحضير",
    "washing": "غسيل",
    "drying": "تجفيف",
    "finishing": "كي",
    "assembly": "تجميع",
    "qa": "فحص الجودة",
    "packing": "تعبئة",
    "ready": "جاهز",
    "out_for_delivery": "خارج للتوصيل",
    "delivered": "تم التسليم",
    "closed": "مغلق"
  },
  "validation": {
    "customer_required": "العميل مطلوب",
    "items_required": "مطلوب عنصر واحد على الأقل",
    "invalid_date": "تاريخ الاستعداد غير صالح",
    "invalid_status": "انتقال حالة غير صالح"
  }
}
```

#### 2.5 Use Translations in Controllers

**File**: `apps/api/src/orders/orders.controller.ts`

```typescript
import { Controller, Get, Post, Body, Param, NotFoundException } from '@nestjs/common';
import { I18n, I18nContext } from 'nestjs-i18n';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @I18n() i18n: I18nContext, // Inject i18n context
  ) {
    try {
      const order = await this.ordersService.create(createOrderDto);

      return {
        success: true,
        // Translate message based on user's language
        message: i18n.t('orders.created'),
        data: order,
      };
    } catch (error) {
      return {
        success: false,
        message: i18n.t('common.error'),
        error: error.message,
      };
    }
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @I18n() i18n: I18nContext,
  ) {
    const order = await this.ordersService.findOne(id);

    if (!order) {
      // Throw translated error
      throw new NotFoundException(
        i18n.t('orders.not_found')
      );
    }

    return {
      success: true,
      data: order,
    };
  }

  @Get()
  async findAll(@I18n() i18n: I18nContext) {
    const orders = await this.ordersService.findAll();

    return {
      success: true,
      message: i18n.t('common.success'),
      data: orders,
      // Include current locale for frontend
      locale: i18n.lang,
    };
  }
}
```

#### 🎓 Understanding i18n.t()

```typescript
// Basic translation
i18n.t('orders.created')
// Returns: "Order created successfully" or "تم إنشاء الطلب بنجاح"

// Nested translation
i18n.t('orders.status.ready')
// Returns: "Ready" or "جاهز"

// With parameters
i18n.t('orders.ready_by', { date: '2025-11-01' })
// Translation file: "Ready by {date}"
// Returns: "Ready by 2025-11-01"
```

#### 2.6 Create Helper for Locale-Aware Formatting

**File**: `apps/api/src/common/utils/locale-formatter.util.ts`

```typescript
export class LocaleFormatter {
  static formatCurrency(
    amount: number,
    currency: string,
    locale: string,
  ): string {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 3,
    }).format(amount);
  }

  static formatDate(
    date: Date | string,
    locale: string,
    options?: Intl.DateTimeFormatOptions,
  ): string {
    const defaultOptions: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };

    return new Intl.DateTimeFormat(
      locale,
      options || defaultOptions,
    ).format(new Date(date));
  }

  static formatTime(
    date: Date | string,
    locale: string,
  ): string {
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: locale.startsWith('en'),
    }).format(new Date(date));
  }

  static formatNumber(
    number: number,
    locale: string,
  ): string {
    return new Intl.NumberFormat(locale).format(number);
  }
}
```

**Usage in Service**:
```typescript
import { LocaleFormatter } from '@/common/utils/locale-formatter.util';

async getOrderSummary(orderId: string, locale: string) {
  const order = await this.findOne(orderId);

  return {
    orderNumber: order.orderNumber,
    total: LocaleFormatter.formatCurrency(order.total, 'OMR', locale),
    readyBy: LocaleFormatter.formatDate(order.readyBy, locale),
    createdAt: LocaleFormatter.formatTime(order.createdAt, locale),
  };
}
```

---

### Step 3: Frontend Web (Next.js) i18n Setup (Day 2-3)

#### 3.1 Install Dependencies

```bash
cd apps/web
npm install next-i18next react-i18next i18next
```

#### 3.2 Configure Next.js i18n

**File**: `apps/web/next-i18next.config.js`

```javascript
module.exports = {
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'ar'],
    localeDetection: true, // Auto-detect from browser
  },
  localePath:
    typeof window === 'undefined'
      ? require('path').resolve('./public/locales')
      : '/locales',
  reloadOnPrerender: process.env.NODE_ENV === 'development',
};
```

**File**: `apps/web/next.config.js`

```javascript
const { i18n } = require('./next-i18next.config');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  i18n, // Add i18n configuration
  // ... other config
};

module.exports = nextConfig;
```

#### 3.3 Create Translation Files

**Directory Structure**:
```
apps/web/public/locales/
├── en/
│   ├── common.json
│   ├── orders.json
│   ├── customers.json
│   ├── dashboard.json
│   └── settings.json
└── ar/
    ├── common.json
    ├── orders.json
    ├── customers.json
    ├── dashboard.json
    └── settings.json
```

**File**: `apps/web/public/locales/en/common.json`

```json
{
  "app_name": "CleanMateX",
  "welcome": "Welcome",
  "navigation": {
    "dashboard": "Dashboard",
    "orders": "Orders",
    "customers": "Customers",
    "services": "Services",
    "staff": "Staff",
    "branches": "Branches",
    "reports": "Reports",
    "settings": "Settings"
  },
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "search": "Search",
    "filter": "Filter",
    "export": "Export",
    "print": "Print",
    "refresh": "Refresh",
    "clear": "Clear"
  },
  "status": {
    "active": "Active",
    "inactive": "Inactive",
    "pending": "Pending",
    "completed": "Completed"
  },
  "common": {
    "loading": "Loading...",
    "no_data": "No data available",
    "error": "An error occurred",
    "success": "Operation successful",
    "confirm": "Are you sure?",
    "yes": "Yes",
    "no": "No"
  }
}
```

**File**: `apps/web/public/locales/ar/common.json`

```json
{
  "app_name": "كلين ميت إكس",
  "welcome": "مرحباً",
  "navigation": {
    "dashboard": "لوحة التحكم",
    "orders": "الطلبات",
    "customers": "العملاء",
    "services": "الخدمات",
    "staff": "الموظفون",
    "branches": "الفروع",
    "reports": "التقارير",
    "settings": "الإعدادات"
  },
  "actions": {
    "save": "حفظ",
    "cancel": "إلغاء",
    "delete": "حذف",
    "edit": "تعديل",
    "search": "بحث",
    "filter": "تصفية",
    "export": "تصدير",
    "print": "طباعة",
    "refresh": "تحديث",
    "clear": "مسح"
  },
  "status": {
    "active": "نشط",
    "inactive": "غير نشط",
    "pending": "قيد الانتظار",
    "completed": "مكتمل"
  },
  "common": {
    "loading": "جاري التحميل...",
    "no_data": "لا توجد بيانات",
    "error": "حدث خطأ",
    "success": "تمت العملية بنجاح",
    "confirm": "هل أنت متأكد؟",
    "yes": "نعم",
    "no": "لا"
  }
}
```

#### 3.4 Update Root Layout for RTL

**File**: `apps/web/app/[locale]/layout.tsx`

```typescript
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import localFont from 'next/font/local';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

// Arabic font (you can use Google Fonts like Cairo or Tajawal)
const arabic = localFont({
  src: '../fonts/Cairo-Regular.ttf',
  variable: '--font-arabic',
});

export const metadata: Metadata = {
  title: 'CleanMateX',
  description: 'Laundry & Dry Cleaning Management System',
};

export default function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const direction = params.locale === 'ar' ? 'rtl' : 'ltr';
  const fontClass = params.locale === 'ar' ? arabic.variable : inter.variable;

  return (
    <html lang={params.locale} dir={direction}>
      <body className={`${fontClass} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}

// Generate static pages for both locales
export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ar' }];
}
```

#### 3.5 Create Language Switcher Component

**File**: `apps/web/components/LanguageSwitcher.tsx`

```typescript
'use client';

import { useRouter, usePathname } from 'next/navigation';
import { Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();

  const switchLanguage = (locale: string) => {
    // Remove current locale from path
    const pathWithoutLocale = pathname.replace(/^\/(en|ar)/, '');
    
    // Navigate to same path with new locale
    router.push(`/${locale}${pathWithoutLocale || '/'}`);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" title="Switch Language">
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => switchLanguage('en')}>
          <span className="mr-2">🇬🇧</span>
          English
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => switchLanguage('ar')}>
          <span className="mr-2">🇸🇦</span>
          العربية
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### 3.6 Use Translations in Pages

**File**: `apps/web/app/[locale]/dashboard/page.tsx`

```typescript
import { useTranslation } from 'next-i18next';
import { serverSideTranslations } from 'next-i18next/serverSideTranslations';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DashboardPageProps {
  params: { locale: string };
}

export default async function DashboardPage({ params }: DashboardPageProps) {
  return (
    <DashboardClient locale={params.locale} />
  );
}

function DashboardClient({ locale }: { locale: string }) {
  const { t } = useTranslation('dashboard');

  const stats = [
    {
      title: t('stats.total_orders'),
      value: '1,234',
      icon: '📦',
    },
    {
      title: t('stats.pending'),
      value: '56',
      icon: '⏳',
    },
    {
      title: t('stats.ready'),
      value: '23',
      icon: '✅',
    },
    {
      title: t('stats.revenue_today'),
      value: 'OMR 450',
      icon: '💰',
    },
  ];

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">
        {t('title')}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <span className="text-2xl">{stat.icon}</span>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Required for Server Components with i18n
export async function generateStaticParams() {
  return [{ locale: 'en' }, { locale: 'ar' }];
}
```

---

### Step 4: RTL Styling with Tailwind (Day 3)

#### 4.1 Install Tailwind RTL Plugin

```bash
cd apps/web
npm install tailwindcss-rtl
```

#### 4.2 Configure Tailwind

**File**: `apps/web/tailwind.config.ts`

```typescript
import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)'],
        arabic: ['var(--font-arabic)'],
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('tailwindcss-rtl'), // RTL support
  ],
};

export default config;
```

#### 4.3 RTL CSS Best Practices

**🎓 Logical Properties** (Direction-agnostic):

```css
/* ❌ Wrong: Fixed directions */
.element {
  margin-left: 20px;
  padding-right: 10px;
  float: left;
  text-align: left;
}

/* ✅ Correct: Logical properties */
.element {
  margin-inline-start: 20px;  /* margin-left in LTR, margin-right in RTL */
  padding-inline-end: 10px;   /* padding-right in LTR, padding-left in RTL */
  float: inline-start;        /* float-left in LTR, float-right in RTL */
  text-align: start;          /* text-align-left in LTR, text-align-right in RTL */
}
```

**Tailwind Logical Properties**:

```tsx
/* ❌ Wrong */
<div className="ml-4 mr-2 text-left">
  <span className="float-left">Menu</span>
</div>

/* ✅ Correct */
<div className="ms-4 me-2 text-start">
  <span className="float-start">Menu</span>
</div>
```

**Key Mappings**:
- `ml` → `ms` (margin-left → margin-start)
- `mr` → `me` (margin-right → margin-end)
- `pl` → `ps` (padding-left → padding-start)
- `pr` → `pe` (padding-right → padding-end)
- `text-left` → `text-start`
- `text-right` → `text-end`

#### 4.4 Create RTL-Aware Components

**File**: `apps/web/components/Sidebar.tsx`

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslation } from 'next-i18next';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  Package,
  Users,
  Settings,
  FileText,
} from 'lucide-react';

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useTranslation('common');

  const menuItems = [
    {
      href: '/dashboard',
      label: t('navigation.dashboard'),
      icon: LayoutDashboard,
    },
    {
      href: '/orders',
      label: t('navigation.orders'),
      icon: Package,
    },
    {
      href: '/customers',
      label: t('navigation.customers'),
      icon: Users,
    },
    {
      href: '/reports',
      label: t('navigation.reports'),
      icon: FileText,
    },
    {
      href: '/settings',
      label: t('navigation.settings'),
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 bg-white border-e border-gray-200 min-h-screen">
      {/* Using border-e (border-end) instead of border-r */}
      <div className="p-4">
        <h1 className="text-2xl font-bold mb-8">{t('app_name')}</h1>
      </div>

      <nav className="px-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname.includes(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                // Using logical properties
                'flex items-center gap-3 px-4 py-3 rounded-lg mb-2',
                'hover:bg-gray-100 transition-colors',
                isActive && 'bg-blue-50 text-blue-600 font-medium'
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

#### 4.5 Handle Icons and Images

Some icons need to mirror in RTL, some don't:

```typescript
// Icons that SHOULD mirror in RTL
const MirrorableIcon = ({ className }: { className?: string }) => (
  <ArrowRight className={cn(className, 'rtl:rotate-180')} />
);

// Icons that should NOT mirror
const NonMirrorableIcon = () => (
  <Logo className="h-8 w-8" /> // Logos don't flip
);

// Conditional mirroring
<ChevronRight className="h-4 w-4 rtl:rotate-180" />
```

---

### Step 5: Flutter Mobile i18n (Day 3-4)

#### 5.1 Install Dependencies

**File**: `apps/customer/pubspec.yaml`

```yaml
dependencies:
  flutter:
    sdk: flutter

  # Localization
  easy_localization: ^3.0.3
  intl: ^0.18.0

  # State management (if not already added)
  provider: ^6.0.5

flutter:
  assets:
    - assets/translations/  # Translation files
    - assets/images/        # Images
```

```bash
cd apps/customer
flutter pub get
```

#### 5.2 Create Translation Files

**Directory Structure**:
```
apps/customer/assets/translations/
├── en.json
└── ar.json
```

**File**: `apps/customer/assets/translations/en.json`

```json
{
  "app_name": "CleanMateX",
  "welcome": "Welcome",
  "login": {
    "title": "Welcome Back",
    "phone": "Phone Number",
    "password": "Password",
    "login_button": "Login",
    "forgot_password": "Forgot Password?",
    "no_account": "Don't have an account?",
    "sign_up": "Sign Up"
  },
  "orders": {
    "my_orders": "My Orders",
    "new_order": "New Order",
    "order_details": "Order Details",
    "order_number": "Order #",
    "status": {
      "intake": "Received",
      "preparation": "In Preparation",
      "washing": "Being Washed",
      "ready": "Ready for Pickup",
      "out_for_delivery": "Out for Delivery",
      "delivered": "Delivered"
    },
    "no_orders": "No orders yet",
    "track": "Track Order"
  },
  "profile": {
    "title": "Profile",
    "edit": "Edit Profile",
    "addresses": "My Addresses",
    "payment_methods": "Payment Methods",
    "logout": "Logout"
  },
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "loading": "Loading...",
    "error": "Something went wrong",
    "success": "Success",
    "retry": "Retry"
  }
}
```

**File**: `apps/customer/assets/translations/ar.json`

```json
{
  "app_name": "كلين ميت إكس",
  "welcome": "مرحباً",
  "login": {
    "title": "مرحباً بعودتك",
    "phone": "رقم الهاتف",
    "password": "كلمة المرور",
    "login_button": "تسجيل الدخول",
    "forgot_password": "نسيت كلمة المرور؟",
    "no_account": "ليس لديك حساب؟",
    "sign_up": "سجل الآن"
  },
  "orders": {
    "my_orders": "طلباتي",
    "new_order": "طلب جديد",
    "order_details": "تفاصيل الطلب",
    "order_number": "طلب رقم",
    "status": {
      "intake": "تم الاستلام",
      "preparation": "قيد التحضير",
      "washing": "قيد الغسيل",
      "ready": "جاهز للاستلام",
      "out_for_delivery": "خارج للتوصيل",
      "delivered": "تم التسليم"
    },
    "no_orders": "لا توجد طلبات بعد",
    "track": "تتبع الطلب"
  },
  "profile": {
    "title": "الملف الشخصي",
    "edit": "تعديل الملف",
    "addresses": "عناويني",
    "payment_methods": "طرق الدفع",
    "logout": "تسجيل الخروج"
  },
  "common": {
    "save": "حفظ",
    "cancel": "إلغاء",
    "loading": "جاري التحميل...",
    "error": "حدث خطأ ما",
    "success": "نجح",
    "retry": "إعادة المحاولة"
  }
}
```

#### 5.3 Initialize easy_localization

**File**: `apps/customer/lib/main.dart`

```dart
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:provider/provider.dart';

void main() async {
  // Required for easy_localization
  WidgetsFlutterBinding.ensureInitialized();
  await EasyLocalization.ensureInitialized();

  runApp(
    EasyLocalization(
      supportedLocales: const [
        Locale('en'),
        Locale('ar'),
      ],
      path: 'assets/translations',
      fallbackLocale: const Locale('en'),
      // Save user's language preference
      saveLocale: true,
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      // Localization setup
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,

      // RTL support
      builder: (context, child) {
        return Directionality(
          textDirection: context.locale.languageCode == 'ar'
              ? TextDirection.rtl
              : TextDirection.ltr,
          child: child!,
        );
      },

      title: 'CleanMateX',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        fontFamily: context.locale.languageCode == 'ar'
            ? 'Cairo' // Arabic font
            : 'Roboto',
      ),

      home: const HomePage(),
    );
  }
}
```

#### 5.4 Create Language Picker

**File**: `apps/customer/lib/widgets/language_picker.dart`

```dart
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

class LanguagePicker extends StatelessWidget {
  const LanguagePicker({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.language),
      onPressed: () => _showLanguageDialog(context),
      tooltip: 'Change Language',
    );
  }

  void _showLanguageDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (BuildContext context) {
        return AlertDialog(
          title: const Text('Choose Language').tr(),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                leading: const Text('🇬🇧', style: TextStyle(fontSize: 24)),
                title: const Text('English'),
                trailing: context.locale.languageCode == 'en'
                    ? const Icon(Icons.check, color: Colors.green)
                    : null,
                onTap: () {
                  context.setLocale(const Locale('en'));
                  Navigator.pop(context);
                },
              ),
              ListTile(
                leading: const Text('🇸🇦', style: TextStyle(fontSize: 24)),
                title: const Text('العربية'),
                trailing: context.locale.languageCode == 'ar'
                    ? const Icon(Icons.check, color: Colors.green)
                    : null,
                onTap: () {
                  context.setLocale(const Locale('ar'));
                  Navigator.pop(context);
                },
              ),
            ],
          ),
        );
      },
    );
  }
}
```

#### 5.5 Use Translations in Screens

**File**: `apps/customer/lib/screens/orders_screen.dart`

```dart
import 'package:flutter/material.dart';
import 'package:easy_localization/easy_localization.dart';

class OrdersScreen extends StatelessWidget {
  const OrdersScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('orders.my_orders').tr(),
        actions: const [
          LanguagePicker(),
        ],
      ),
      body: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: orders.length,
        itemBuilder: (context, index) {
          final order = orders[index];
          return OrderCard(order: order);
        },
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          // Navigate to new order
        },
        label: Text('orders.new_order').tr(),
        icon: const Icon(Icons.add),
      ),
    );
  }
}

class OrderCard extends StatelessWidget {
  final Order order;

  const OrderCard({
    Key? key,
    required this.order,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final locale = context.locale.toString();

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  '${'orders.order_number'.tr()}${order.orderNumber}',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Chip(
                  label: Text(
                    'orders.status.${order.status}'.tr(),
                  ),
                  backgroundColor: _getStatusColor(order.status),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              NumberFormat.currency(
                locale: locale,
                symbol: 'OMR ',
                decimalDigits: 3,
              ).format(order.total),
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              DateFormat.yMMMd(locale).format(order.readyBy),
              style: TextStyle(
                fontSize: 14,
                color: Colors.grey[600],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Color _getStatusColor(String status) {
    switch (status) {
      case 'ready':
        return Colors.green[100]!;
      case 'washing':
        return Colors.blue[100]!;
      case 'delivered':
        return Colors.grey[300]!;
      default:
        return Colors.orange[100]!;
    }
  }
}
```

#### 🎓 Understanding Flutter RTL

**Automatic RTL Behavior**:
```dart
// In Arabic, these automatically flip:
Row(children: [Text('A'), Text('B'), Text('C')])
// LTR: A B C
// RTL: C B A

// Padding automatically flips
Padding(
  padding: EdgeInsets.only(left: 20),  // Becomes right: 20 in RTL
  child: Text('Hello'),
)

// Use EdgeInsetsDirectional for explicit control
Padding(
  padding: EdgeInsetsDirectional.only(start: 20),  // Always start side
  child: Text('Hello'),
)
```

**Text Direction**:
```dart
// Force LTR (for numbers, emails, etc.)
Text(
  '+968 9123 4567',
  textDirection: TextDirection.ltr,
)

// Force RTL
Text(
  'مرحباً',
  textDirection: TextDirection.rtl,
)

// Auto (respects locale)
Text('Hello / مرحباً')  // Automatically correct direction
```

---

## Testing & QA

### Day 4-5: Comprehensive Testing

#### Test Checklist

**Backend API Testing**:

```bash
# Test English response
curl -X GET "http://localhost:3000/api/orders" \
  -H "Accept-Language: en" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test Arabic response
curl -X GET "http://localhost:3000/api/orders" \
  -H "Accept-Language: ar" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test with query parameter
curl -X GET "http://localhost:3000/api/orders?lang=ar" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Verify response includes both name and name2
```

**Web Testing**:
- [ ] Visit `/en/dashboard` - Verify English UI
- [ ] Visit `/ar/dashboard` - Verify Arabic UI with RTL
- [ ] Click language switcher - Should change instantly
- [ ] Test all navigation links work in both languages
- [ ] Verify forms are RTL in Arabic
- [ ] Check dropdowns open in correct direction
- [ ] Test modal dialogs are RTL
- [ ] Verify tables are RTL (columns flip)
- [ ] Check date formatting (English vs. Arabic calendar formats)
- [ ] Test number formatting (1,234.56 vs. ١٬٢٣٤٫٥٦)
- [ ] Verify currency display (OMR 100 vs. ١٠٠ ر.ع.)

**Mobile Testing**:
- [ ] Launch app - Default to system language
- [ ] Switch to Arabic - Verify instant change
- [ ] Test all screens are RTL
- [ ] Verify Arabic keyboard works correctly
- [ ] Check bottom navigation is RTL
- [ ] Test swipe gestures work correctly in RTL
- [ ] Verify back button points correctly
- [ ] Test forms and inputs are RTL
- [ ] Check Arabic font renders correctly
- [ ] Test on both iOS and Android

**RTL Visual QA**:
- [ ] Sidebar on correct side (right in Arabic)
- [ ] Navigation arrows point correctly
- [ ] Form labels on right side
- [ ] Breadcrumbs flow right-to-left
- [ ] Icons that should mirror do mirror
- [ ] Icons that shouldn't mirror stay the same
- [ ] Numbers stay LTR (123 not ٣٢١)
- [ ] Emails and URLs stay LTR
- [ ] Mixed content aligns correctly

**Data Integrity Testing**:
- [ ] Create entity with both EN and AR names
- [ ] Verify database stores both correctly
- [ ] Test API returns both fields
- [ ] Verify frontend displays correct language
- [ ] Test switching language updates display
- [ ] Verify search works in both languages

---

## Success Criteria

### Must Have ✅
- [x] Database schema with name/name2 pattern
- [x] Backend API returns bilingual content
- [x] Translation files for EN/AR (100% coverage)
- [x] Web admin fully bilingual with RTL
- [x] Mobile app fully bilingual with RTL
- [x] Language switcher in all interfaces
- [x] Proper date/number/currency formatting

### Quality Metrics ✅
- **Translation Coverage**: 100% of UI text
- **RTL Layout**: Zero visual bugs in Arabic mode
- **Performance**: No lag on language switch (<100ms)
- **Font Rendering**: Arabic text clearly legible
- **User Experience**: Seamless language switching

### Business Value 🎯
- **GCC Market Ready**: Full Arabic support
- **Professional Image**: Proper RTL implementation
- **Wider Reach**: Serve Arabic-only customers
- **Competitive Edge**: Better than competitors
- **Customer Trust**: Native language support

---

## Troubleshooting

### Common Issues

**Issue**: Translations not loading
```bash
# Check translation files exist
ls public/locales/en/
ls public/locales/ar/

# Verify i18n config
cat next-i18next.config.js

# Check console for errors
```

**Issue**: RTL not working in Next.js
```tsx
// Ensure html tag has dir attribute
<html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
```

**Issue**: Numbers showing as Arabic numerals
```typescript
// Force LTR for numbers
<span dir="ltr">{phoneNumber}</span>

// Or in CSS
.phone { direction: ltr; }
```

**Issue**: Mixed content alignment
```css
/* Use unicode-bidi for mixed content */
.mixed-content {
  unicode-bidi: plaintext;
}
```

**Issue**: Flutter RTL not working
```dart
// Ensure Directionality widget wraps app
return Directionality(
  textDirection: locale == 'ar' ? TextDirection.rtl : TextDirection.ltr,
  child: MaterialApp(...),
);
```

---

## Resources

### Documentation
- [Next.js i18n](https://nextjs.org/docs/advanced-features/i18n-routing)
- [next-i18next](https://github.com/i18next/next-i18next)
- [nestjs-i18n](https://nestjs-i18n.com/)
- [easy_localization](https://pub.dev/packages/easy_localization)

### Arabic Fonts
- [Google Fonts Arabic](https://fonts.google.com/?subset=arabic)
- **Recommended**: Cairo, Tajawal, Almarai, IBM Plex Sans Arabic

### RTL Guidelines
- [Material Design - Bidirectionality](https://material.io/design/usability/bidirectionality.html)
- [RTL Styling 101](https://rtlstyling.com/)

### Testing Tools
- [Google Translate](https://translate.google.com/) - Verify translations
- [Chrome DevTools](https://developer.chrome.com/docs/devtools/) - Test RTL in browser

---

## Next Steps

After completing bilingual support:
1. ✅ Move to PRD-033 (Staff Management)
2. All subsequent features will be bilingual from the start
3. Update any MVP features created earlier to add bilingual support

**Time Saved**: Building bilingual from the start saves 2-3 weeks of retrofitting later! 🎉

---

**Document Status**: ✅ Ready for Implementation  
**Last Updated**: October 31, 2025  
**Next Review**: After PRD-033 completion

---
prd_code: PRD-SAAS-MNG-0008
title: Customer Master Data Management
version: v0.1.0
last_updated: 2025-01-14
status: Draft
priority: High
category: Platform Management
related_prds:
  - PRD-SAAS-MNG-0001 (Platform HQ Console)
  - PRD-SAAS-MNG-0002 (Tenant Lifecycle)
  - PRD-SAAS-MNG-0005 (Support & Ticketing)
  - PRD-SAAS-MNG-0009 (Auth & Authorization)
author: CleanMateX Platform Team
---

# PRD-SAAS-MNG-0008: Customer Master Data Management

## Executive Summary

### Problem Statement

In a multi-tenant SaaS platform like CleanMateX, customer data management presents unique challenges:

1. **Global Customer Identity**: A customer might use multiple laundry services across different tenants, requiring a single global identity
2. **Data Sovereignty**: Each tenant needs control over their customer relationships while respecting privacy regulations (GDPR, data protection laws)
3. **Duplicate Detection**: Preventing duplicate customer records across and within tenants
4. **Privacy & Consent**: Managing customer data access, consent, and right to be forgotten
5. **Customer Lifecycle**: Tracking customer journey across multiple tenants
6. **Data Sync**: Keeping customer data synchronized across tenant boundaries when needed
7. **Segmentation**: Enabling sophisticated customer segmentation for marketing and analytics

### Solution Overview

The Customer Master Data Management system provides:

- **Global Customer Registry** (`sys_customers_mst`) for unified customer identities
- **Tenant-Customer Junction** (`org_customers_mst`) for tenant-specific relationships
- **Intelligent Deduplication** using phone/email matching algorithms
- **Privacy Compliance** with consent management and data portability
- **Customer Segmentation** with rule-based and AI-powered grouping
- **Lifecycle Tracking** across tenant boundaries
- **Data Governance** with audit trails and access controls

### Business Value

**For Platform Operators:**
- Unified view of customer base across all tenants
- Better fraud detection through cross-tenant analysis
- Improved customer insights and analytics
- Reduced data storage through deduplication
- GDPR/privacy compliance built-in

**For Tenants:**
- Rich customer profiles with purchase history
- Customer segmentation for targeted marketing
- Loyalty program integration
- Customer lifecycle management
- Data portability and migration support

**For End Customers:**
- Single identity across multiple service providers
- Data privacy controls
- Seamless experience when switching providers
- Transparency in data usage

---

## Table of Contents

1. [Scope & Objectives](#scope--objectives)
2. [Database Schema](#database-schema)
3. [Global Customer Registry](#global-customer-registry)
4. [Tenant-Customer Relationships](#tenant-customer-relationships)
5. [Customer Deduplication](#customer-deduplication)
6. [Privacy & GDPR Compliance](#privacy--gdpr-compliance)
7. [Customer Segmentation](#customer-segmentation)
8. [Customer Lifecycle](#customer-lifecycle)
9. [Data Sync & Migration](#data-sync--migration)
10. [API Specifications](#api-specifications)
11. [UI/UX Design](#uiux-design)
12. [Business Logic](#business-logic)
13. [Integration Points](#integration-points)
14. [Security & Access Control](#security--access-control)
15. [Testing Strategy](#testing-strategy)
16. [Implementation Plan](#implementation-plan)
17. [Future Enhancements](#future-enhancements)
18. [Appendices](#appendices)

---

## Scope & Objectives

### In Scope

**Customer Data Management:**
- Global customer registry with unique identities
- Tenant-specific customer relationships
- Customer profile management (contact info, preferences)
- Customer communication preferences
- Customer status tracking (active, inactive, blocked)

**Deduplication & Matching:**
- Phone number-based matching
- Email-based matching
- Fuzzy name matching
- Manual merge operations
- Duplicate prevention rules

**Privacy & Compliance:**
- GDPR consent management
- Right to be forgotten
- Data portability (export customer data)
- Data access audit trails
- Privacy preference management

**Customer Segmentation:**
- Rule-based segmentation
- Behavioral segmentation
- RFM (Recency, Frequency, Monetary) analysis
- Custom segment creation
- Segment-based targeting

**Customer Lifecycle:**
- Lifecycle stage tracking (prospect, active, at-risk, churned)
- Cross-tenant lifecycle view
- Churn prediction indicators
- Reactivation campaigns

**Data Governance:**
- Complete audit trail
- Data quality scoring
- Data enrichment workflows
- Master data stewardship

### Out of Scope

- Marketing automation (future)
- Email campaign management (future)
- SMS campaign management (future)
- Social media integration (future)
- Customer service chat (covered in PRD-0005)
- Advanced AI/ML models (covered in PRD-0014)

### Success Criteria

1. **Data Quality**: 95%+ unique customer records (no duplicates)
2. **Privacy Compliance**: 100% GDPR-compliant customer data handling
3. **Deduplication Accuracy**: 98%+ correct duplicate detection
4. **Performance**: Customer search < 200ms for 1M+ records
5. **Data Portability**: Export customer data in < 5 seconds
6. **Segmentation**: Support 100+ custom segments per tenant

---

## Database Schema

### System Tables (Global)

#### `sys_customers_mst` - Global Customer Registry

```sql
CREATE TABLE sys_customers_mst (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Global identifiers
  customer_global_id VARCHAR(50) UNIQUE NOT NULL, -- CUS-XXXXXXXX

  -- Contact information (global)
  phone VARCHAR(20) UNIQUE NOT NULL, -- Primary identifier
  email VARCHAR(250) UNIQUE, -- Optional secondary identifier
  country_code VARCHAR(5) DEFAULT '+968',

  -- Personal information (anonymized at global level)
  first_name_hash VARCHAR(64), -- SHA-256 hash for privacy
  last_name_hash VARCHAR(64),

  -- Privacy & consent
  gdpr_consent_date TIMESTAMP,
  gdpr_consent_version VARCHAR(20),
  data_processing_consent BOOLEAN DEFAULT false,
  marketing_consent BOOLEAN DEFAULT false,

  -- Deduplication metadata
  duplicate_check_hash VARCHAR(128), -- Composite hash for matching
  is_master_record BOOLEAN DEFAULT true,
  merged_into_customer_id UUID REFERENCES sys_customers_mst(id),

  -- Data quality
  data_quality_score SMALLINT DEFAULT 50, -- 0-100
  data_completeness_score SMALLINT DEFAULT 0, -- 0-100
  last_verified_at TIMESTAMP,

  -- Lifecycle (global view)
  first_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_activity_at TIMESTAMP,
  total_tenants_used INTEGER DEFAULT 0,

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  rec_status SMALLINT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,

  -- Indexes
  CONSTRAINT unique_phone_global UNIQUE (phone),
  CONSTRAINT unique_email_global UNIQUE (email) WHERE email IS NOT NULL
);

-- Indexes
CREATE INDEX idx_sys_customers_phone ON sys_customers_mst(phone);
CREATE INDEX idx_sys_customers_email ON sys_customers_mst(email) WHERE email IS NOT NULL;
CREATE INDEX idx_sys_customers_global_id ON sys_customers_mst(customer_global_id);
CREATE INDEX idx_sys_customers_duplicate_hash ON sys_customers_mst(duplicate_check_hash);
CREATE INDEX idx_sys_customers_last_activity ON sys_customers_mst(last_activity_at DESC);
CREATE INDEX idx_sys_customers_quality ON sys_customers_mst(data_quality_score DESC);

-- Comments
COMMENT ON TABLE sys_customers_mst IS 'Global customer registry with unique identities across all tenants';
COMMENT ON COLUMN sys_customers_mst.customer_global_id IS 'Human-readable global customer ID';
COMMENT ON COLUMN sys_customers_mst.phone IS 'Primary global identifier - E.164 format';
COMMENT ON COLUMN sys_customers_mst.duplicate_check_hash IS 'Hash used for duplicate detection';
```

#### `sys_customer_merge_history` - Deduplication Audit

```sql
CREATE TABLE sys_customer_merge_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Merge details
  master_customer_id UUID NOT NULL REFERENCES sys_customers_mst(id),
  duplicate_customer_id UUID NOT NULL REFERENCES sys_customers_mst(id),
  merge_reason VARCHAR(500),
  merge_confidence_score DECIMAL(5,2), -- 0-100

  -- Merge metadata
  merged_by_user_id UUID,
  merged_by_system BOOLEAN DEFAULT false,
  merge_algorithm VARCHAR(100),

  -- Rollback support
  can_rollback BOOLEAN DEFAULT true,
  rollback_data JSONB, -- Store original data for rollback

  -- Audit
  merged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes
  CONSTRAINT fk_master_customer FOREIGN KEY (master_customer_id)
    REFERENCES sys_customers_mst(id) ON DELETE CASCADE
);

CREATE INDEX idx_merge_history_master ON sys_customer_merge_history(master_customer_id);
CREATE INDEX idx_merge_history_duplicate ON sys_customer_merge_history(duplicate_customer_id);
CREATE INDEX idx_merge_history_date ON sys_customer_merge_history(merged_at DESC);
```

### Organization Tables (Tenant-Specific)

#### `org_customers_mst` - Tenant-Customer Junction

```sql
CREATE TABLE org_customers_mst (
  -- Composite primary key
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES sys_customers_mst(id) ON DELETE CASCADE,

  -- Tenant-specific customer ID
  customer_number VARCHAR(50), -- Tenant's internal customer number

  -- Personal information (tenant-visible)
  first_name VARCHAR(250) NOT NULL,
  last_name VARCHAR(250),
  full_name VARCHAR(500) GENERATED ALWAYS AS (first_name || ' ' || COALESCE(last_name, '')) STORED,

  -- Contact preferences (tenant-specific)
  preferred_contact_method VARCHAR(20) DEFAULT 'phone', -- phone, email, whatsapp
  preferred_language VARCHAR(5) DEFAULT 'en',

  -- Customer status (tenant-specific)
  customer_status VARCHAR(20) DEFAULT 'active', -- active, inactive, blocked, vip
  vip_status BOOLEAN DEFAULT false,
  credit_limit DECIMAL(10,3) DEFAULT 0.000,

  -- Loyalty (tenant-specific)
  loyalty_points INTEGER DEFAULT 0,
  loyalty_tier VARCHAR(50), -- bronze, silver, gold, platinum
  lifetime_value DECIMAL(12,3) DEFAULT 0.000,

  -- Relationship metadata
  first_order_date DATE,
  last_order_date DATE,
  total_orders INTEGER DEFAULT 0,
  total_spent DECIMAL(12,3) DEFAULT 0.000,
  average_order_value DECIMAL(10,3),

  -- Marketing
  marketing_opt_in BOOLEAN DEFAULT false,
  sms_opt_in BOOLEAN DEFAULT false,
  email_opt_in BOOLEAN DEFAULT false,
  whatsapp_opt_in BOOLEAN DEFAULT false,

  -- Preferences (tenant-specific)
  preferred_branch_id UUID REFERENCES org_branches_mst(id),
  preferred_payment_method VARCHAR(50),
  delivery_instructions TEXT,

  -- Tags & segments
  customer_tags TEXT[], -- Array of tags
  segment_ids UUID[], -- Array of segment IDs

  -- Notes
  internal_notes TEXT,

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  rec_status SMALLINT DEFAULT 1,
  is_active BOOLEAN DEFAULT true,

  -- Constraints
  PRIMARY KEY (tenant_org_id, customer_id),
  CONSTRAINT unique_customer_number UNIQUE (tenant_org_id, customer_number)
);

-- Indexes
CREATE INDEX idx_org_customers_tenant ON org_customers_mst(tenant_org_id);
CREATE INDEX idx_org_customers_customer_id ON org_customers_mst(customer_id);
CREATE INDEX idx_org_customers_status ON org_customers_mst(tenant_org_id, customer_status);
CREATE INDEX idx_org_customers_vip ON org_customers_mst(tenant_org_id, vip_status) WHERE vip_status = true;
CREATE INDEX idx_org_customers_name ON org_customers_mst(tenant_org_id, full_name);
CREATE INDEX idx_org_customers_loyalty ON org_customers_mst(tenant_org_id, loyalty_points DESC);
CREATE INDEX idx_org_customers_ltv ON org_customers_mst(tenant_org_id, lifetime_value DESC);
CREATE INDEX idx_org_customers_last_order ON org_customers_mst(tenant_org_id, last_order_date DESC NULLS LAST);

-- Full-text search
CREATE INDEX idx_org_customers_search ON org_customers_mst
  USING gin(to_tsvector('english', full_name || ' ' || COALESCE(customer_number, '')));

-- Comments
COMMENT ON TABLE org_customers_mst IS 'Tenant-specific customer relationships and data';
COMMENT ON COLUMN org_customers_mst.lifetime_value IS 'Total revenue from this customer';
```

#### `org_customer_addresses` - Customer Addresses

```sql
CREATE TABLE org_customer_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES sys_customers_mst(id) ON DELETE CASCADE,

  -- Address details
  address_type VARCHAR(20) DEFAULT 'home', -- home, office, other
  address_label VARCHAR(100), -- "Home", "Office", "Villa"

  -- Address components
  building_number VARCHAR(50),
  street VARCHAR(250),
  area VARCHAR(250),
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100) DEFAULT 'Oman',
  postal_code VARCHAR(20),

  -- Location
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  google_maps_url TEXT,

  -- Metadata
  is_default BOOLEAN DEFAULT false,
  delivery_instructions TEXT,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  -- Constraints
  CONSTRAINT fk_customer_address FOREIGN KEY (tenant_org_id, customer_id)
    REFERENCES org_customers_mst(tenant_org_id, customer_id) ON DELETE CASCADE
);

CREATE INDEX idx_customer_addresses_tenant ON org_customer_addresses(tenant_org_id);
CREATE INDEX idx_customer_addresses_customer ON org_customer_addresses(tenant_org_id, customer_id);
CREATE INDEX idx_customer_addresses_default ON org_customer_addresses(tenant_org_id, customer_id, is_default)
  WHERE is_default = true;
```

#### `org_customer_segments` - Customer Segmentation

```sql
CREATE TABLE org_customer_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,

  -- Segment details
  segment_name VARCHAR(250) NOT NULL,
  segment_name2 VARCHAR(250), -- Arabic
  segment_description TEXT,
  segment_type VARCHAR(50) DEFAULT 'custom', -- custom, rfm, behavioral, demographic

  -- Segment rules (JSONB for flexibility)
  rules JSONB NOT NULL, -- Rule engine configuration

  -- Metadata
  customer_count INTEGER DEFAULT 0,
  last_calculated_at TIMESTAMP,
  auto_update BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_customer_segments_tenant ON org_customer_segments(tenant_org_id);
CREATE INDEX idx_customer_segments_type ON org_customer_segments(tenant_org_id, segment_type);
```

#### `org_customer_privacy_requests` - GDPR Requests

```sql
CREATE TABLE org_customer_privacy_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES sys_customers_mst(id),

  -- Request details
  request_type VARCHAR(50) NOT NULL, -- access, export, delete, rectify
  request_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, rejected

  -- Request metadata
  requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  requested_by VARCHAR(250), -- Email or phone
  verified BOOLEAN DEFAULT false,
  verification_code VARCHAR(10),
  verification_expires_at TIMESTAMP,

  -- Processing
  processed_at TIMESTAMP,
  processed_by VARCHAR(120),
  rejection_reason TEXT,

  -- Export/download
  export_file_url TEXT,
  export_expires_at TIMESTAMP,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_privacy_requests_tenant ON org_customer_privacy_requests(tenant_org_id);
CREATE INDEX idx_privacy_requests_customer ON org_customer_privacy_requests(customer_id);
CREATE INDEX idx_privacy_requests_status ON org_customer_privacy_requests(request_status);
```

---

## Global Customer Registry

### Customer Global ID Generation

**Format**: `CUS-XXXXXXXX`

```typescript
/**
 * Generate unique global customer ID
 */
function generateCustomerGlobalId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `CUS-${timestamp}${random}`;
}

// Example: CUS-L8K2M9N4
```

### Global Customer Creation

```typescript
interface CreateGlobalCustomerDto {
  phone: string; // E.164 format: +96891234567
  email?: string;
  countryCode: string;
  gdprConsent: boolean;
  marketingConsent: boolean;
}

async function createGlobalCustomer(
  data: CreateGlobalCustomerDto
): Promise<GlobalCustomer> {
  // Step 1: Validate phone format
  if (!isValidE164Phone(data.phone)) {
    throw new ValidationError('Invalid phone number format');
  }

  // Step 2: Check for existing customer
  const existing = await prisma.sys_customers_mst.findFirst({
    where: {
      OR: [
        { phone: data.phone },
        { email: data.email }
      ]
    }
  });

  if (existing) {
    throw new ConflictError('Customer already exists');
  }

  // Step 3: Generate global ID
  const customerGlobalId = generateCustomerGlobalId();

  // Step 4: Generate duplicate check hash
  const duplicateCheckHash = generateDuplicateHash({
    phone: data.phone,
    email: data.email
  });

  // Step 5: Create global customer
  const customer = await prisma.sys_customers_mst.create({
    data: {
      customer_global_id: customerGlobalId,
      phone: data.phone,
      email: data.email,
      country_code: data.countryCode,
      gdpr_consent_date: data.gdprConsent ? new Date() : null,
      gdpr_consent_version: 'v1.0',
      data_processing_consent: data.gdprConsent,
      marketing_consent: data.marketingConsent,
      duplicate_check_hash: duplicateCheckHash,
      first_seen_at: new Date(),
      last_activity_at: new Date(),
      data_quality_score: calculateInitialQualityScore(data),
      data_completeness_score: calculateCompletenessScore(data)
    }
  });

  logger.info('Global customer created', {
    customerId: customer.id,
    customerGlobalId: customer.customer_global_id,
    phone: data.phone
  });

  return customer;
}
```

### Data Quality Scoring

```typescript
/**
 * Calculate customer data quality score (0-100)
 */
function calculateQualityScore(customer: GlobalCustomer): number {
  let score = 0;

  // Phone number (required - 30 points)
  if (customer.phone) {
    score += 30;
    if (isVerifiedPhone(customer.phone)) score += 10;
  }

  // Email (20 points)
  if (customer.email) {
    score += 15;
    if (isVerifiedEmail(customer.email)) score += 5;
  }

  // Name (20 points)
  if (customer.first_name_hash) score += 10;
  if (customer.last_name_hash) score += 10;

  // Consent (10 points)
  if (customer.gdpr_consent_date) score += 10;

  // Recent activity (10 points)
  const daysSinceActivity = daysSince(customer.last_activity_at);
  if (daysSinceActivity < 30) score += 10;
  else if (daysSinceActivity < 90) score += 5;

  // Verification (10 points)
  if (customer.last_verified_at) score += 10;

  return Math.min(score, 100);
}

/**
 * Calculate data completeness score (0-100)
 */
function calculateCompletenessScore(customer: GlobalCustomer): number {
  const fields = [
    'phone',
    'email',
    'first_name_hash',
    'last_name_hash',
    'country_code',
    'gdpr_consent_date'
  ];

  const filledFields = fields.filter(field => customer[field] !== null);
  return Math.round((filledFields.length / fields.length) * 100);
}
```

---

## Tenant-Customer Relationships

### Creating Tenant-Customer Link

```typescript
interface CreateTenantCustomerDto {
  tenantId: string;
  globalCustomerId: string;
  firstName: string;
  lastName?: string;
  customerNumber?: string; // Tenant's internal number
  preferredLanguage: 'en' | 'ar';
  marketingOptIn: boolean;
}

async function createTenantCustomer(
  data: CreateTenantCustomerDto
): Promise<TenantCustomer> {
  // Step 1: Verify global customer exists
  const globalCustomer = await prisma.sys_customers_mst.findUnique({
    where: { id: data.globalCustomerId }
  });

  if (!globalCustomer) {
    throw new NotFoundError('Global customer not found');
  }

  // Step 2: Check if relationship already exists
  const existing = await prisma.org_customers_mst.findUnique({
    where: {
      tenant_org_id_customer_id: {
        tenant_org_id: data.tenantId,
        customer_id: data.globalCustomerId
      }
    }
  });

  if (existing) {
    throw new ConflictError('Customer already linked to this tenant');
  }

  // Step 3: Generate tenant customer number if not provided
  const customerNumber = data.customerNumber ||
    await generateTenantCustomerNumber(data.tenantId);

  // Step 4: Create tenant-customer relationship
  const tenantCustomer = await prisma.org_customers_mst.create({
    data: {
      tenant_org_id: data.tenantId,
      customer_id: data.globalCustomerId,
      customer_number: customerNumber,
      first_name: data.firstName,
      last_name: data.lastName,
      preferred_language: data.preferredLanguage,
      marketing_opt_in: data.marketingOptIn,
      customer_status: 'active',
      created_at: new Date()
    }
  });

  // Step 5: Update global customer stats
  await prisma.sys_customers_mst.update({
    where: { id: data.globalCustomerId },
    data: {
      total_tenants_used: { increment: 1 },
      last_activity_at: new Date()
    }
  });

  logger.info('Tenant-customer relationship created', {
    tenantId: data.tenantId,
    customerId: data.globalCustomerId,
    customerNumber
  });

  return tenantCustomer;
}

/**
 * Generate sequential customer number for tenant
 */
async function generateTenantCustomerNumber(tenantId: string): Promise<string> {
  const lastCustomer = await prisma.org_customers_mst.findFirst({
    where: { tenant_org_id: tenantId },
    orderBy: { customer_number: 'desc' },
    select: { customer_number: true }
  });

  if (!lastCustomer || !lastCustomer.customer_number) {
    return 'C-00001';
  }

  const lastNumber = parseInt(lastCustomer.customer_number.split('-')[1]);
  const nextNumber = lastNumber + 1;

  return `C-${nextNumber.toString().padStart(5, '0')}`;
}
```

### Customer Profile Enrichment

```typescript
interface UpdateCustomerProfileDto {
  tenantId: string;
  customerId: string;
  vipStatus?: boolean;
  loyaltyTier?: string;
  preferredBranchId?: string;
  preferredPaymentMethod?: string;
  deliveryInstructions?: string;
  tags?: string[];
  internalNotes?: string;
}

async function updateCustomerProfile(
  data: UpdateCustomerProfileDto
): Promise<TenantCustomer> {
  const updated = await prisma.org_customers_mst.update({
    where: {
      tenant_org_id_customer_id: {
        tenant_org_id: data.tenantId,
        customer_id: data.customerId
      }
    },
    data: {
      vip_status: data.vipStatus,
      loyalty_tier: data.loyaltyTier,
      preferred_branch_id: data.preferredBranchId,
      preferred_payment_method: data.preferredPaymentMethod,
      delivery_instructions: data.deliveryInstructions,
      customer_tags: data.tags,
      internal_notes: data.internalNotes,
      updated_at: new Date()
    }
  });

  return updated;
}
```

---

## Customer Deduplication

### Duplicate Detection Algorithm

```typescript
/**
 * Generate hash for duplicate detection
 */
function generateDuplicateHash(data: {
  phone: string;
  email?: string;
}): string {
  // Normalize phone: remove spaces, dashes, country code variations
  const normalizedPhone = normalizePhone(data.phone);

  // Normalize email: lowercase, trim
  const normalizedEmail = data.email?.toLowerCase().trim() || '';

  // Create composite hash
  const composite = `${normalizedPhone}|${normalizedEmail}`;
  return crypto.createHash('sha256').update(composite).digest('hex');
}

/**
 * Find potential duplicates
 */
async function findPotentialDuplicates(
  customerId: string
): Promise<PotentialDuplicate[]> {
  const customer = await prisma.sys_customers_mst.findUnique({
    where: { id: customerId }
  });

  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  // Strategy 1: Exact phone match
  const phoneMatches = await prisma.sys_customers_mst.findMany({
    where: {
      phone: customer.phone,
      id: { not: customerId },
      is_active: true
    }
  });

  // Strategy 2: Exact email match
  const emailMatches = customer.email ? await prisma.sys_customers_mst.findMany({
    where: {
      email: customer.email,
      id: { not: customerId },
      is_active: true
    }
  }) : [];

  // Strategy 3: Similar hash (fuzzy matching)
  const similarHashes = await findSimilarHashes(customer.duplicate_check_hash);

  // Combine and score matches
  const allMatches = [...phoneMatches, ...emailMatches, ...similarHashes];
  const uniqueMatches = deduplicateArray(allMatches, 'id');

  // Calculate confidence scores
  const scoredMatches = uniqueMatches.map(match => ({
    duplicate: match,
    confidenceScore: calculateMatchConfidence(customer, match),
    matchReasons: getMatchReasons(customer, match)
  }));

  // Sort by confidence score
  return scoredMatches
    .filter(m => m.confidenceScore >= 70) // Threshold
    .sort((a, b) => b.confidenceScore - a.confidenceScore);
}

/**
 * Calculate match confidence score
 */
function calculateMatchConfidence(
  customer1: GlobalCustomer,
  customer2: GlobalCustomer
): number {
  let score = 0;

  // Phone match (most important)
  if (customer1.phone === customer2.phone) {
    score += 50;
  }

  // Email match
  if (customer1.email && customer2.email &&
      customer1.email === customer2.email) {
    score += 30;
  }

  // Name similarity (if available)
  if (customer1.first_name_hash && customer2.first_name_hash) {
    if (customer1.first_name_hash === customer2.first_name_hash) {
      score += 15;
    }
  }

  // Country code match
  if (customer1.country_code === customer2.country_code) {
    score += 5;
  }

  return Math.min(score, 100);
}
```

### Merge Customers

```typescript
interface MergeCustomersDto {
  masterCustomerId: string; // Keep this one
  duplicateCustomerId: string; // Merge into master
  mergedBy: string;
  mergeReason?: string;
}

async function mergeCustomers(
  data: MergeCustomersDto
): Promise<MergeResult> {
  // Start transaction
  return await prisma.$transaction(async (tx) => {
    // Step 1: Verify both customers exist
    const [master, duplicate] = await Promise.all([
      tx.sys_customers_mst.findUnique({ where: { id: data.masterCustomerId } }),
      tx.sys_customers_mst.findUnique({ where: { id: data.duplicateCustomerId } })
    ]);

    if (!master || !duplicate) {
      throw new NotFoundError('Customer(s) not found');
    }

    // Step 2: Store rollback data
    const rollbackData = {
      master: { ...master },
      duplicate: { ...duplicate }
    };

    // Step 3: Merge tenant relationships
    // Update all org_customers_mst records pointing to duplicate
    const tenantRelationships = await tx.org_customers_mst.findMany({
      where: { customer_id: data.duplicateCustomerId }
    });

    for (const rel of tenantRelationships) {
      // Check if master already has relationship with this tenant
      const existingRel = await tx.org_customers_mst.findUnique({
        where: {
          tenant_org_id_customer_id: {
            tenant_org_id: rel.tenant_org_id,
            customer_id: data.masterCustomerId
          }
        }
      });

      if (existingRel) {
        // Merge data (keep higher values)
        await tx.org_customers_mst.update({
          where: {
            tenant_org_id_customer_id: {
              tenant_org_id: rel.tenant_org_id,
              customer_id: data.masterCustomerId
            }
          },
          data: {
            total_orders: existingRel.total_orders + rel.total_orders,
            total_spent: existingRel.total_spent + rel.total_spent,
            loyalty_points: existingRel.loyalty_points + rel.loyalty_points,
            lifetime_value: existingRel.lifetime_value + rel.lifetime_value
          }
        });

        // Delete duplicate relationship
        await tx.org_customers_mst.delete({
          where: {
            tenant_org_id_customer_id: {
              tenant_org_id: rel.tenant_org_id,
              customer_id: data.duplicateCustomerId
            }
          }
        });
      } else {
        // Update to point to master
        await tx.org_customers_mst.update({
          where: {
            tenant_org_id_customer_id: {
              tenant_org_id: rel.tenant_org_id,
              customer_id: data.duplicateCustomerId
            }
          },
          data: {
            customer_id: data.masterCustomerId
          }
        });
      }
    }

    // Step 4: Update master customer metadata
    await tx.sys_customers_mst.update({
      where: { id: data.masterCustomerId },
      data: {
        // Keep best data from both
        email: master.email || duplicate.email,
        gdpr_consent_date: master.gdpr_consent_date || duplicate.gdpr_consent_date,
        first_seen_at: earliestDate(master.first_seen_at, duplicate.first_seen_at),
        last_activity_at: latestDate(master.last_activity_at, duplicate.last_activity_at),
        total_tenants_used: master.total_tenants_used + duplicate.total_tenants_used,
        data_quality_score: Math.max(master.data_quality_score, duplicate.data_quality_score)
      }
    });

    // Step 5: Mark duplicate as merged
    await tx.sys_customers_mst.update({
      where: { id: data.duplicateCustomerId },
      data: {
        is_master_record: false,
        merged_into_customer_id: data.masterCustomerId,
        is_active: false
      }
    });

    // Step 6: Record merge history
    await tx.sys_customer_merge_history.create({
      data: {
        master_customer_id: data.masterCustomerId,
        duplicate_customer_id: data.duplicateCustomerId,
        merge_reason: data.mergeReason,
        merged_by_user_id: data.mergedBy,
        merged_by_system: false,
        merge_algorithm: 'manual',
        rollback_data: rollbackData,
        can_rollback: true,
        merged_at: new Date()
      }
    });

    logger.info('Customers merged', {
      masterId: data.masterCustomerId,
      duplicateId: data.duplicateCustomerId,
      mergedBy: data.mergedBy
    });

    return {
      success: true,
      masterCustomerId: data.masterCustomerId,
      mergedCustomerId: data.duplicateCustomerId
    };
  });
}
```

---

## Privacy & GDPR Compliance

### Right to Access

```typescript
async function requestDataAccess(
  customerId: string,
  tenantId: string
): Promise<PrivacyRequest> {
  // Create privacy request
  const request = await prisma.org_customer_privacy_requests.create({
    data: {
      tenant_org_id: tenantId,
      customer_id: customerId,
      request_type: 'access',
      request_status: 'pending',
      verification_code: generateVerificationCode(),
      verification_expires_at: addMinutes(new Date(), 30),
      requested_at: new Date()
    }
  });

  // Send verification email/SMS
  await sendVerificationCode(request);

  return request;
}
```

### Right to Be Forgotten

```typescript
async function requestDataDeletion(
  customerId: string,
  tenantId: string,
  verificationCode: string
): Promise<DeletionResult> {
  // Verify request
  const request = await verifyPrivacyRequest(customerId, verificationCode);

  if (!request) {
    throw new UnauthorizedError('Invalid verification code');
  }

  // Start deletion process (soft delete)
  return await prisma.$transaction(async (tx) => {
    // 1. Anonymize global customer data
    await tx.sys_customers_mst.update({
      where: { id: customerId },
      data: {
        phone: `DELETED-${customerId}`,
        email: null,
        first_name_hash: null,
        last_name_hash: null,
        is_active: false,
        rec_status: 0
      }
    });

    // 2. Anonymize tenant customer data
    await tx.org_customers_mst.updateMany({
      where: { customer_id: customerId },
      data: {
        first_name: 'DELETED',
        last_name: 'USER',
        internal_notes: null,
        is_active: false
      }
    });

    // 3. Delete addresses
    await tx.org_customer_addresses.deleteMany({
      where: { customer_id: customerId }
    });

    // 4. Update request status
    await tx.org_customer_privacy_requests.update({
      where: { id: request.id },
      data: {
        request_status: 'completed',
        processed_at: new Date()
      }
    });

    logger.info('Customer data deleted (GDPR)', {
      customerId,
      tenantId
    });

    return { success: true, message: 'Data deleted successfully' };
  });
}
```

### Data Export (Portability)

```typescript
async function exportCustomerData(
  customerId: string,
  tenantId: string
): Promise<CustomerDataExport> {
  // Fetch all customer data
  const [globalData, tenantData, addresses, orders] = await Promise.all([
    prisma.sys_customers_mst.findUnique({ where: { id: customerId } }),
    prisma.org_customers_mst.findFirst({
      where: {
        tenant_org_id: tenantId,
        customer_id: customerId
      }
    }),
    prisma.org_customer_addresses.findMany({
      where: {
        tenant_org_id: tenantId,
        customer_id: customerId
      }
    }),
    // Fetch order history (from orders module)
    fetchCustomerOrders(tenantId, customerId)
  ]);

  // Compile export package
  const exportData = {
    exportDate: new Date().toISOString(),
    customerInfo: {
      globalId: globalData?.customer_global_id,
      phone: globalData?.phone,
      email: globalData?.email,
      accountCreated: globalData?.first_seen_at
    },
    tenantInfo: {
      tenantId,
      customerNumber: tenantData?.customer_number,
      firstName: tenantData?.first_name,
      lastName: tenantData?.last_name,
      status: tenantData?.customer_status,
      loyaltyPoints: tenantData?.loyalty_points,
      lifetimeValue: tenantData?.lifetime_value
    },
    addresses,
    orderHistory: orders,
    consentHistory: {
      gdprConsent: globalData?.gdpr_consent_date,
      marketingConsent: globalData?.marketing_consent
    }
  };

  // Generate downloadable file
  const exportFile = await generateExportFile(exportData, 'json');

  return {
    downloadUrl: exportFile.url,
    expiresAt: addDays(new Date(), 7), // Link expires in 7 days
    fileSize: exportFile.size,
    format: 'json'
  };
}
```

---

## Customer Segmentation

### RFM Analysis

```typescript
interface RFMSegment {
  recency: number; // Days since last order
  frequency: number; // Total orders
  monetary: number; // Total spent
  rfmScore: string; // e.g., "555" (best customers)
  segment: string; // Champions, Loyal, At-Risk, etc.
}

async function calculateRFM(
  tenantId: string,
  customerId: string
): Promise<RFMSegment> {
  const customer = await prisma.org_customers_mst.findUnique({
    where: {
      tenant_org_id_customer_id: {
        tenant_org_id: tenantId,
        customer_id: customerId
      }
    }
  });

  if (!customer) {
    throw new NotFoundError('Customer not found');
  }

  // Calculate Recency (1-5 scale)
  const daysSinceLastOrder = customer.last_order_date
    ? daysSince(customer.last_order_date)
    : 9999;
  const recencyScore = calculateRecencyScore(daysSinceLastOrder);

  // Calculate Frequency (1-5 scale)
  const frequencyScore = calculateFrequencyScore(customer.total_orders);

  // Calculate Monetary (1-5 scale)
  const monetaryScore = calculateMonetaryScore(customer.total_spent);

  // Combine scores
  const rfmScore = `${recencyScore}${frequencyScore}${monetaryScore}`;

  // Determine segment
  const segment = determineRFMSegment(recencyScore, frequencyScore, monetaryScore);

  return {
    recency: daysSinceLastOrder,
    frequency: customer.total_orders,
    monetary: parseFloat(customer.total_spent.toString()),
    rfmScore,
    segment
  };
}

function determineRFMSegment(r: number, f: number, m: number): string {
  if (r >= 4 && f >= 4 && m >= 4) return 'Champions';
  if (r >= 3 && f >= 3 && m >= 3) return 'Loyal Customers';
  if (r >= 4 && f <= 2) return 'Promising';
  if (r <= 2 && f >= 3) return 'At Risk';
  if (r <= 2 && f <= 2) return 'Lost Customers';
  if (r >= 3 && f <= 2 && m <= 2) return 'Potential Loyalists';
  return 'Others';
}
```

### Custom Segmentation

```typescript
interface SegmentRule {
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains' | 'in';
  value: any;
  logicalOperator?: 'AND' | 'OR';
}

async function createCustomSegment(
  tenantId: string,
  segmentName: string,
  rules: SegmentRule[]
): Promise<CustomerSegment> {
  // Create segment
  const segment = await prisma.org_customer_segments.create({
    data: {
      tenant_org_id: tenantId,
      segment_name: segmentName,
      segment_type: 'custom',
      rules: JSON.stringify(rules),
      auto_update: true
    }
  });

  // Calculate initial customer count
  await recalculateSegment(segment.id);

  return segment;
}

async function getCustomersInSegment(
  tenantId: string,
  segmentId: string
): Promise<TenantCustomer[]> {
  // Get segment rules
  const segment = await prisma.org_customer_segments.findUnique({
    where: { id: segmentId }
  });

  if (!segment) {
    throw new NotFoundError('Segment not found');
  }

  const rules = JSON.parse(segment.rules as string) as SegmentRule[];

  // Build dynamic query
  const whereClause = buildSegmentWhereClause(rules, tenantId);

  // Execute query
  const customers = await prisma.org_customers_mst.findMany({
    where: whereClause
  });

  return customers;
}
```

---

## Customer Lifecycle

### Lifecycle Stages

```typescript
enum CustomerLifecycleStage {
  PROSPECT = 'prospect', // No orders yet
  ACTIVE = 'active', // Recent orders
  AT_RISK = 'at_risk', // No orders in 60+ days
  CHURNED = 'churned', // No orders in 180+ days
  REACTIVATED = 'reactivated', // Returned after churn
  VIP = 'vip' // High-value customer
}

async function calculateLifecycleStage(
  customer: TenantCustomer
): Promise<CustomerLifecycleStage> {
  // No orders
  if (!customer.first_order_date || customer.total_orders === 0) {
    return CustomerLifecycleStage.PROSPECT;
  }

  // VIP status
  if (customer.vip_status || customer.lifetime_value > 1000) {
    return CustomerLifecycleStage.VIP;
  }

  const daysSinceLastOrder = customer.last_order_date
    ? daysSince(customer.last_order_date)
    : 9999;

  // Churned (180+ days)
  if (daysSinceLastOrder > 180) {
    return CustomerLifecycleStage.CHURNED;
  }

  // At risk (60-180 days)
  if (daysSinceLastOrder > 60) {
    return CustomerLifecycleStage.AT_RISK;
  }

  // Active (< 60 days)
  return CustomerLifecycleStage.ACTIVE;
}
```

---

## API Specifications

### Endpoints

#### 1. Create Global Customer

```
POST /api/v1/customers/global
```

**Request:**
```json
{
  "phone": "+96891234567",
  "email": "ahmed@example.com",
  "countryCode": "+968",
  "gdprConsent": true,
  "marketingConsent": false
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "customerGlobalId": "CUS-L8K2M9N4",
    "phone": "+96891234567",
    "email": "ahmed@example.com",
    "createdAt": "2025-01-14T10:00:00Z"
  }
}
```

#### 2. Link Customer to Tenant

```
POST /api/v1/tenants/{tenantId}/customers
```

**Request:**
```json
{
  "globalCustomerId": "uuid",
  "firstName": "Ahmed",
  "lastName": "Al-Said",
  "preferredLanguage": "ar",
  "marketingOptIn": true
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "customerNumber": "C-00123",
    "firstName": "Ahmed",
    "lastName": "Al-Said",
    "status": "active",
    "createdAt": "2025-01-14T10:00:00Z"
  }
}
```

#### 3. Search Customers

```
GET /api/v1/tenants/{tenantId}/customers/search?q=ahmed&status=active&limit=20
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "customerNumber": "C-00123",
        "firstName": "Ahmed",
        "lastName": "Al-Said",
        "phone": "+96891234567",
        "status": "active",
        "totalOrders": 15,
        "lifetimeValue": 450.500,
        "loyaltyPoints": 100
      }
    ],
    "pagination": {
      "total": 1,
      "page": 1,
      "limit": 20
    }
  }
}
```

#### 4. Get Customer Profile

```
GET /api/v1/tenants/{tenantId}/customers/{customerId}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "globalId": "CUS-L8K2M9N4",
    "customerNumber": "C-00123",
    "firstName": "Ahmed",
    "lastName": "Al-Said",
    "phone": "+96891234567",
    "email": "ahmed@example.com",
    "status": "active",
    "vipStatus": false,
    "loyaltyPoints": 100,
    "loyaltyTier": "silver",
    "lifetimeValue": 450.500,
    "totalOrders": 15,
    "firstOrderDate": "2024-06-01",
    "lastOrderDate": "2025-01-10",
    "averageOrderValue": 30.033,
    "preferredLanguage": "ar",
    "addresses": [
      {
        "id": "uuid",
        "type": "home",
        "street": "Sultan Qaboos Street",
        "area": "Al Khuwair",
        "city": "Muscat",
        "isDefault": true
      }
    ],
    "lifecycleStage": "active",
    "rfmSegment": "Loyal Customers",
    "tags": ["premium", "express-delivery"]
  }
}
```

#### 5. Find Duplicate Customers

```
GET /api/v1/customers/{customerId}/duplicates
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "potentialDuplicates": [
      {
        "customerId": "uuid",
        "customerGlobalId": "CUS-XYZ123",
        "phone": "+96891234567",
        "confidenceScore": 95,
        "matchReasons": ["phone_exact", "email_exact"]
      }
    ]
  }
}
```

#### 6. Merge Customers

```
POST /api/v1/customers/merge
```

**Request:**
```json
{
  "masterCustomerId": "uuid-1",
  "duplicateCustomerId": "uuid-2",
  "mergeReason": "Same phone number and name"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "masterCustomerId": "uuid-1",
    "mergedCustomerId": "uuid-2",
    "mergedAt": "2025-01-14T10:00:00Z"
  }
}
```

#### 7. Request Data Export (GDPR)

```
POST /api/v1/tenants/{tenantId}/customers/{customerId}/export
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://...",
    "expiresAt": "2025-01-21T10:00:00Z",
    "fileSize": 1024000,
    "format": "json"
  }
}
```

#### 8. Create Customer Segment

```
POST /api/v1/tenants/{tenantId}/segments
```

**Request:**
```json
{
  "segmentName": "High-Value Customers",
  "segmentType": "custom",
  "rules": [
    {
      "field": "lifetime_value",
      "operator": "gte",
      "value": 500
    },
    {
      "field": "total_orders",
      "operator": "gte",
      "value": 10,
      "logicalOperator": "AND"
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "segmentName": "High-Value Customers",
    "customerCount": 45,
    "createdAt": "2025-01-14T10:00:00Z"
  }
}
```

---

## UI/UX Design

### Customer List View

```
┌─────────────────────────────────────────────────────────────────┐
│ Customers                                    🔍 Search | + Add   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Filters: [ All ▼ ] [ Active ▼ ] [ VIP Only ]  Clear             │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ # | Customer      | Phone       | Orders | LTV    | Status │ │
│ ├───┼───────────────┼─────────────┼────────┼────────┼────────┤ │
│ │ 1 │ Ahmed Al-Said | +968912...  │ 15     │ 450.50 │ Active │ │
│ │   │ C-00123       | VIP ⭐      │        │        │        │ │
│ ├───┼───────────────┼─────────────┼────────┼────────┼────────┤ │
│ │ 2 │ Sara Mohammed | +968923...  │ 8      │ 280.00 │ Active │ │
│ │   │ C-00124       | Silver      │        │        │        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ Showing 1-20 of 234                         [ ← ] Page 1 [ → ]  │
└─────────────────────────────────────────────────────────────────┘
```

### Customer Detail View

```
┌─────────────────────────────────────────────────────────────────┐
│ ← Back to Customers                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Ahmed Al-Said (VIP ⭐)                            [ Edit ]       │
│ C-00123 • +96891234567 • ahmed@example.com                       │
│                                                                   │
│ ┌─────────────────┬─────────────────┬──────────────────────┐   │
│ │ Total Orders    │ Lifetime Value  │ Loyalty Points       │   │
│ │      15         │   450.500 OMR   │      100 pts         │   │
│ └─────────────────┴─────────────────┴──────────────────────┘   │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Overview | Orders | Addresses | Segments | Activity        │ │
│ ├─────────────────────────────────────────────────────────────┤ │
│ │ Status: Active                                              │ │
│ │ First Order: 2024-06-01                                     │ │
│ │ Last Order: 2025-01-10 (4 days ago)                        │ │
│ │ Average Order Value: 30.033 OMR                             │ │
│ │                                                               │ │
│ │ Lifecycle Stage: Active                                     │ │
│ │ RFM Segment: Loyal Customers                                │ │
│ │ Loyalty Tier: Silver                                        │ │
│ │                                                               │ │
│ │ Preferred Language: Arabic                                  │ │
│ │ Preferred Payment: Cash                                     │ │
│ │ Marketing Opt-in: ✓ Yes                                     │ │
│ │                                                               │ │
│ │ Tags: [premium] [express-delivery]                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Duplicate Detection View

```
┌─────────────────────────────────────────────────────────────────┐
│ Potential Duplicates Found                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ⚠️  1 potential duplicate found for Ahmed Al-Said                │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ ORIGINAL                          POTENTIAL DUPLICATE       │ │
│ ├───────────────────────────────────────────────────────────┤ │
│ │ Ahmed Al-Said                     Ahmed Said               │ │
│ │ +96891234567                      +96891234567             │ │
│ │ ahmed@example.com                 -                        │ │
│ │ C-00123                           C-00456                  │ │
│ │ 15 orders • 450.50 OMR            3 orders • 89.50 OMR     │ │
│ │                                                              │ │
│ │ Match Confidence: 95%                                       │ │
│ │ Reasons: Phone exact match, Similar name                   │ │
│ │                                                              │ │
│ │           [ Not a Duplicate ]    [ Merge Records ]         │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Foundation (Weeks 1-2)
- Database schema creation
- Global customer registry
- Basic CRUD operations
- API endpoints (create, read, update)

### Phase 2: Deduplication (Weeks 3-4)
- Duplicate detection algorithm
- Merge functionality
- Manual review interface
- Automated matching rules

### Phase 3: Privacy & GDPR (Weeks 5-6)
- Consent management
- Data export functionality
- Right to be forgotten
- Audit trails

### Phase 4: Segmentation (Weeks 7-8)
- RFM analysis
- Custom segment builder
- Segment-based filtering
- Automated segment updates

### Phase 5: Lifecycle & Analytics (Weeks 9-10)
- Lifecycle stage tracking
- Customer health scoring
- Churn prediction
- Reactivation workflows

---

## Future Enhancements

1. **AI-Powered Insights**
   - Predictive customer lifetime value
   - Next best action recommendations
   - Automated churn intervention

2. **Customer Journey Mapping**
   - Visual journey builder
   - Touchpoint tracking
   - Journey optimization

3. **Social Profile Integration**
   - LinkedIn profile enrichment
   - Social media data import
   - Sentiment analysis

4. **Advanced Deduplication**
   - Machine learning matching
   - Image-based duplicate detection
   - Automatic merge confidence

5. **Customer Data Platform (CDP)**
   - Unified customer view across all systems
   - Real-time profile updates
   - Cross-channel identity resolution

---

## Related PRDs

- **PRD-SAAS-MNG-0001**: Platform HQ Console (Parent)
- **PRD-SAAS-MNG-0002**: Tenant Lifecycle (Tenant management)
- **PRD-SAAS-MNG-0005**: Support & Ticketing (Customer support)
- **PRD-SAAS-MNG-0009**: Auth & Authorization (Access control)

---

## Glossary

- **Global Customer**: Unique customer identity across all tenants
- **Tenant Customer**: Tenant-specific customer relationship
- **RFM**: Recency, Frequency, Monetary analysis
- **GDPR**: General Data Protection Regulation
- **LTV**: Lifetime Value
- **Deduplication**: Process of identifying and merging duplicate records
- **Master Record**: Primary customer record after merge
- **Customer Segmentation**: Grouping customers by shared characteristics

---

**End of PRD-SAAS-MNG-0008**

**Status**: Draft
**Next Review**: 2025-01-21
**Approved By**: Pending

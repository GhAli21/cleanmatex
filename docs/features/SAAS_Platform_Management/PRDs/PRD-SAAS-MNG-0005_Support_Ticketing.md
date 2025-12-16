---
prd_code: PRD-SAAS-MNG-0005
title: Support & Ticketing System
version: v0.1.0
last_updated: 2025-01-14
author: Gehad Abdo Mohammed Ali
status: Planning
priority: High
category: Platform Management - Support
related_prds:
  - PRD-SAAS-MNG-0001 (Platform HQ Console)
  - PRD-SAAS-MNG-0002 (Tenant Lifecycle)
  - PRD-SAAS-MNG-0004 (Analytics & Reporting)
  - PRD-SAAS-MNG-0008 (Customer Master Data)
---

# PRD-SAAS-MNG-0005: Support & Ticketing System

## Executive Summary

The **Support & Ticketing System** is a comprehensive customer support platform integrated into the Platform HQ Console, enabling platform administrators to efficiently manage tenant support requests, track issues, provide technical assistance, and maintain high customer satisfaction. This system serves as the central hub for all tenant interactions, from simple queries to complex technical troubleshooting.

### Problem Statement

Platform administrators currently lack:
- ❌ **Centralized ticket management** for all tenant support requests
- ❌ **Ticket prioritization** and SLA tracking
- ❌ **Knowledge base** for common issues and solutions
- ❌ **Tenant impersonation** for troubleshooting
- ❌ **Support analytics** and performance metrics
- ❌ **Multi-channel support** (email, chat, portal)
- ❌ **Automated routing** and assignment
- ❌ **Customer satisfaction** tracking

### Solution Overview

Build a **full-featured support ticketing system** that:
- ✅ Centralizes all support requests in one platform
- ✅ Provides intelligent ticket routing and assignment
- ✅ Tracks SLAs and response times
- ✅ Enables safe tenant impersonation for debugging
- ✅ Includes knowledge base and self-service portal
- ✅ Supports multiple communication channels
- ✅ Measures customer satisfaction (CSAT)
- ✅ Integrates with analytics for insights

### Business Value

**For Platform Support Team:**
- Respond to tenant issues faster and more efficiently
- Track all support interactions in one place
- Meet SLA commitments consistently
- Identify recurring issues for product improvements

**For Tenants:**
- Get quick resolutions to their problems
- Access self-service knowledge base 24/7
- Track ticket status in real-time
- Receive proactive updates on issues

**For Platform Owner:**
- Monitor support team performance
- Identify product improvement opportunities
- Reduce churn through excellent support
- Scale support operations efficiently

---

## Table of Contents

1. [Scope & Objectives](#1-scope--objectives)
2. [User Personas](#2-user-personas)
3. [Key Features](#3-key-features)
4. [Ticket Lifecycle](#4-ticket-lifecycle)
5. [Database Schema](#5-database-schema)
6. [API Specifications](#6-api-specifications)
7. [UI/UX Design](#7-uiux-design)
8. [Ticket Management](#8-ticket-management)
9. [SLA Management](#9-sla-management)
10. [Knowledge Base](#10-knowledge-base)
11. [Tenant Impersonation](#11-tenant-impersonation)
12. [Communication Channels](#12-communication-channels)
13. [Automation & Workflows](#13-automation--workflows)
14. [Customer Satisfaction](#14-customer-satisfaction)
15. [Reporting & Analytics](#15-reporting--analytics)
16. [Integration Points](#16-integration-points)
17. [Security & Access Control](#17-security--access-control)
18. [Implementation Plan](#18-implementation-plan)
19. [Testing Strategy](#19-testing-strategy)
20. [Future Enhancements](#20-future-enhancements)

---

## 1. Scope & Objectives

### 1.1 In Scope

**Core Support Features:**
- Multi-channel ticket creation (email, web portal, API)
- Intelligent ticket routing and assignment
- SLA tracking and escalation
- Internal notes and collaboration
- Ticket status tracking and updates
- Customer satisfaction surveys
- Support analytics and reporting

**Advanced Features:**
- Knowledge base management
- Canned responses library
- Tenant impersonation for troubleshooting
- Ticket templates
- Custom fields per ticket type
- Automated workflows
- Email notifications

**Integration Features:**
- Integration with tenant analytics
- Link tickets to specific tenants/users
- Track support costs per tenant
- Correlate tickets with billing issues
- Feed into churn prediction models

### 1.2 Out of Scope

- ❌ Live chat widget (future phase)
- ❌ Phone support integration (future)
- ❌ Video call support (future)
- ❌ AI chatbot (future - PRD-0014)
- ❌ Public-facing support portal for end-customers (tenant responsibility)

### 1.3 Success Criteria

**Support Team Efficiency:**
- Average first response time < 2 hours
- Average resolution time < 24 hours
- Support ticket backlog < 10 open tickets
- Agent utilization > 75%

**Customer Satisfaction:**
- CSAT score > 4.5/5
- NPS score > 50
- Ticket reopening rate < 5%
- Self-service resolution rate > 30%

**System Performance:**
- Ticket creation < 2 seconds
- Dashboard load time < 3 seconds
- Email notifications delivered < 30 seconds
- 99.9% uptime

---

## 2. User Personas

### 2.1 Support Agent

**Primary Responsibilities:**
- Respond to tenant support requests
- Troubleshoot technical issues
- Update ticket status and notes
- Follow up with tenants
- Use knowledge base for solutions

**Typical Day:**
- Review assigned tickets queue
- Respond to new tickets within SLA
- Escalate complex issues to senior support
- Update knowledge base articles
- Close resolved tickets

**Pain Points:**
- Switching between multiple tools
- Difficulty finding relevant documentation
- Unclear ticket priorities
- Missing tenant context

**Key Features Needed:**
- Unified ticket dashboard
- Quick access to tenant information
- Searchable knowledge base
- Canned response templates
- Tenant impersonation capability

### 2.2 Support Manager

**Primary Responsibilities:**
- Monitor team performance
- Assign tickets to agents
- Review escalated issues
- Analyze support metrics
- Identify training needs

**Typical Tasks:**
- Review SLA compliance
- Reassign tickets for load balancing
- Handle VIP tenant issues
- Weekly performance reviews
- Identify recurring issues

**Pain Points:**
- Lack of real-time performance visibility
- Manual ticket assignment overhead
- Difficulty tracking agent workload
- No automated SLA alerts

**Key Features Needed:**
- Support analytics dashboard
- Ticket assignment automation
- SLA monitoring and alerts
- Agent performance metrics
- Workload distribution reports

### 2.3 Platform Administrator (Super Admin)

**Primary Responsibilities:**
- Configure support system
- Define SLA policies
- Manage knowledge base categories
- Review support costs
- Make strategic support decisions

**Typical Tasks:**
- Set up ticket categories and priorities
- Configure automated workflows
- Review monthly support reports
- Approve major escalations
- Budget support resources

**Key Features Needed:**
- System configuration panel
- Support cost analytics
- Escalation approval workflows
- Integration management
- Audit logs

### 2.4 Tenant User (External)

**Primary Responsibilities:**
- Submit support requests
- Track ticket status
- Provide additional information
- Rate support experience

**Typical Tasks:**
- Create tickets for issues
- Reply to support agent questions
- Check ticket status
- Search knowledge base
- Submit satisfaction ratings

**Pain Points:**
- No visibility into ticket progress
- Repetitive information requests
- Long response times
- No self-service options

**Key Features Needed:**
- Simple ticket submission form
- Real-time status updates
- Email notifications
- Knowledge base access
- Rating/feedback mechanism

---

## 3. Key Features

### 3.1 Ticket Management

**Ticket Creation:**
- Multiple creation methods (email, web form, API)
- Auto-populate tenant information
- File attachments (screenshots, logs)
- Ticket templates for common issues
- Custom fields per ticket type

**Ticket Organization:**
- Categories and subcategories
- Priority levels (Low, Medium, High, Critical)
- Status tracking (New, Open, Pending, Resolved, Closed)
- Tags for easy filtering
- Related ticket linking

**Ticket Assignment:**
- Manual assignment to agents
- Round-robin auto-assignment
- Skill-based routing
- Load balancing
- Team-based assignment

**Ticket Tracking:**
- Full activity timeline
- Internal notes (private)
- Public responses (visible to tenant)
- Status change history
- SLA countdown timers

### 3.2 Knowledge Base

**Article Management:**
- Rich text editor with formatting
- Code snippets and syntax highlighting
- Embedded images and videos
- Step-by-step guides
- Troubleshooting flowcharts

**Organization:**
- Hierarchical categories
- Tags and keywords
- Related articles
- Popular articles
- Recently updated

**Search:**
- Full-text search
- Keyword highlighting
- Search suggestions
- Filter by category
- Relevance ranking

**Analytics:**
- Article views count
- Search queries that found articles
- Articles that reduced tickets
- Low-performing articles
- Content gaps identification

### 3.3 SLA Management

**SLA Policies:**
- Define response time targets
- Define resolution time targets
- Different SLAs per priority
- Different SLAs per plan type
- Business hours configuration

**SLA Tracking:**
- Real-time countdown timers
- Visual indicators (green/yellow/red)
- Breach notifications
- SLA compliance reports
- Historical SLA performance

**Escalation Rules:**
- Auto-escalate on SLA breach
- Escalation notification templates
- Multi-level escalation paths
- Executive escalation for VIPs

### 3.4 Automation

**Automated Actions:**
- Auto-assign based on category
- Auto-prioritize based on keywords
- Auto-tag based on content
- Auto-respond with canned messages
- Auto-close stale tickets

**Triggers:**
- On ticket creation
- On status change
- On SLA breach
- On customer response
- On scheduled time

**Workflows:**
- Multi-step approval workflows
- Conditional routing
- Custom automation rules
- Integration triggers
- Scheduled actions

---

## 4. Ticket Lifecycle

### 4.1 Ticket States

```
┌──────────────────────────────────────────────────────┐
│                  Ticket Lifecycle                     │
└──────────────────────────────────────────────────────┘

   NEW
    │
    │  (Agent views ticket)
    ▼
   OPEN
    │
    ├──► PENDING ──► (Customer responds) ──► OPEN
    │                                         │
    │  (Issue resolved)                      │
    ▼                                         │
 RESOLVED ◄──────────────────────────────────┘
    │
    │  (Customer confirms OR 3 days pass)
    ▼
  CLOSED
    │
    │  (Customer reopens within 7 days)
    ▼
   OPEN
```

**State Definitions:**

1. **NEW**
   - Ticket just created
   - Not yet assigned or viewed
   - SLA clock starts
   - Auto-assignment triggered

2. **OPEN**
   - Agent is working on the ticket
   - May have internal notes
   - Awaiting resolution
   - SLA clock running

3. **PENDING**
   - Waiting for customer response
   - Waiting for internal team (DevOps, etc.)
   - SLA clock paused
   - Auto-close after inactivity period

4. **RESOLVED**
   - Issue marked as resolved by agent
   - Solution provided
   - Awaiting customer confirmation
   - Auto-close after 3 days

5. **CLOSED**
   - Ticket completed
   - No further action needed
   - Can be reopened within 7 days
   - After 7 days, requires new ticket

### 4.2 Priority Levels

| Priority | Response SLA | Resolution SLA | Use Cases |
|----------|--------------|----------------|-----------|
| **Critical** | 1 hour | 4 hours | Platform down, data loss, security breach |
| **High** | 2 hours | 8 hours | Major feature broken, payment issues |
| **Medium** | 4 hours | 24 hours | Feature not working, performance issues |
| **Low** | 8 hours | 48 hours | Questions, feature requests, minor bugs |

### 4.3 Ticket Categories

**Main Categories:**
- **Technical Issues**
  - Platform errors
  - Performance problems
  - Integration issues
  - Data sync problems

- **Billing & Subscriptions**
  - Payment failures
  - Invoice questions
  - Plan upgrades/downgrades
  - Refund requests

- **Feature Requests**
  - New feature suggestions
  - Enhancement requests
  - Custom requirements

- **Account Management**
  - User management issues
  - Permission problems
  - Profile updates
  - Security concerns

- **Training & How-To**
  - Usage questions
  - Best practices
  - Configuration help
  - Training requests

- **Bug Reports**
  - Software bugs
  - UI/UX issues
  - Data inconsistencies
  - Browser compatibility

---

## 5. Database Schema

### 5.1 Core Tables

**Table: `platform_support_tickets`**
```sql
CREATE TABLE platform_support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_number VARCHAR(20) UNIQUE NOT NULL, -- e.g., "TICK-2025-00123"

  -- Requester information
  tenant_id UUID NOT NULL REFERENCES org_tenants_mst(id),
  requester_user_id UUID REFERENCES org_users_mst(id),
  requester_name VARCHAR(250) NOT NULL,
  requester_email VARCHAR(250) NOT NULL,
  requester_phone VARCHAR(50),

  -- Ticket details
  subject VARCHAR(500) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  subcategory VARCHAR(100),
  priority VARCHAR(20) NOT NULL,        -- 'low', 'medium', 'high', 'critical'
  status VARCHAR(20) NOT NULL,          -- 'new', 'open', 'pending', 'resolved', 'closed'

  -- Assignment
  assigned_to UUID REFERENCES platform_admin_users(id),
  assigned_at TIMESTAMP,
  team VARCHAR(100),                     -- 'technical', 'billing', 'general'

  -- SLA tracking
  sla_response_due TIMESTAMP,
  sla_resolution_due TIMESTAMP,
  first_response_at TIMESTAMP,
  resolved_at TIMESTAMP,
  closed_at TIMESTAMP,

  -- SLA breach flags
  response_sla_breached BOOLEAN DEFAULT false,
  resolution_sla_breached BOOLEAN DEFAULT false,

  -- Relationships
  related_ticket_ids UUID[],            -- Array of related ticket IDs
  parent_ticket_id UUID REFERENCES platform_support_tickets(id),

  -- Custom fields (JSONB for flexibility)
  custom_fields JSONB,
  /*
    Example:
    {
      "affected_module": "Orders",
      "error_code": "ERR_500",
      "browser": "Chrome 120",
      "severity_impact": "Multiple users affected"
    }
  */

  -- Tags
  tags TEXT[],                          -- ['billing', 'urgent', 'bug']

  -- Satisfaction
  satisfaction_rating INTEGER,          -- 1-5
  satisfaction_comment TEXT,
  satisfaction_submitted_at TIMESTAMP,

  -- Metadata
  source VARCHAR(50) NOT NULL,          -- 'email', 'portal', 'api', 'phone'
  channel VARCHAR(50),
  language VARCHAR(10) DEFAULT 'en',

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  is_active BOOLEAN DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_notes VARCHAR(200)
);

-- Indexes
CREATE INDEX idx_tickets_tenant ON platform_support_tickets(tenant_id);
CREATE INDEX idx_tickets_status ON platform_support_tickets(status) WHERE is_active = true;
CREATE INDEX idx_tickets_assigned ON platform_support_tickets(assigned_to) WHERE status IN ('new', 'open', 'pending');
CREATE INDEX idx_tickets_priority ON platform_support_tickets(priority, status);
CREATE INDEX idx_tickets_sla_due ON platform_support_tickets(sla_response_due, sla_resolution_due) WHERE status NOT IN ('resolved', 'closed');
CREATE INDEX idx_tickets_created ON platform_support_tickets(created_at DESC);
CREATE INDEX idx_tickets_number ON platform_support_tickets(ticket_number);

-- Full-text search
CREATE INDEX idx_tickets_search ON platform_support_tickets USING gin(to_tsvector('english', subject || ' ' || description));
```

**Table: `platform_support_messages`**
```sql
CREATE TABLE platform_support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES platform_support_tickets(id) ON DELETE CASCADE,

  -- Message content
  message_type VARCHAR(20) NOT NULL,    -- 'public_reply', 'internal_note', 'auto_message'
  message_body TEXT NOT NULL,
  is_html BOOLEAN DEFAULT false,

  -- Sender
  sender_type VARCHAR(20) NOT NULL,     -- 'agent', 'customer', 'system'
  sender_id UUID,                        -- admin_user_id or user_id
  sender_name VARCHAR(250),
  sender_email VARCHAR(250),

  -- Visibility
  is_internal BOOLEAN DEFAULT false,    -- Internal notes not visible to customer

  -- Attachments
  attachments JSONB,
  /*
    Example:
    [
      {
        "filename": "screenshot.png",
        "url": "s3://...",
        "size_bytes": 245680,
        "mime_type": "image/png"
      }
    ]
  */

  -- Email tracking
  email_message_id VARCHAR(250),        -- For email threading
  sent_via_email BOOLEAN DEFAULT false,
  email_delivered_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_messages_ticket ON platform_support_messages(ticket_id, created_at);
CREATE INDEX idx_messages_internal ON platform_support_messages(ticket_id, is_internal);
```

**Table: `platform_knowledge_base_articles`**
```sql
CREATE TABLE platform_knowledge_base_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Article details
  title VARCHAR(500) NOT NULL,
  slug VARCHAR(500) UNIQUE NOT NULL,
  content TEXT NOT NULL,                -- Rich HTML content
  excerpt TEXT,                         -- Short summary

  -- Organization
  category_id UUID REFERENCES platform_kb_categories(id),
  subcategory_id UUID REFERENCES platform_kb_categories(id),
  tags TEXT[],

  -- Visibility
  is_published BOOLEAN DEFAULT false,
  publish_date TIMESTAMP,
  is_internal BOOLEAN DEFAULT false,    -- Only for support agents

  -- SEO & Search
  meta_description TEXT,
  search_keywords TEXT[],

  -- Related content
  related_article_ids UUID[],
  related_ticket_categories VARCHAR(100)[],

  -- Analytics
  view_count INTEGER DEFAULT 0,
  helpful_count INTEGER DEFAULT 0,      -- "Was this helpful? Yes" count
  not_helpful_count INTEGER DEFAULT 0,
  search_appearances INTEGER DEFAULT 0,

  -- Versioning
  version INTEGER DEFAULT 1,
  previous_version_id UUID REFERENCES platform_knowledge_base_articles(id),

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,
  updated_at TIMESTAMP,
  updated_by UUID,
  is_active BOOLEAN DEFAULT true,
  rec_status SMALLINT DEFAULT 1
);

CREATE INDEX idx_kb_category ON platform_knowledge_base_articles(category_id, is_published);
CREATE INDEX idx_kb_published ON platform_knowledge_base_articles(is_published, publish_date DESC);
CREATE INDEX idx_kb_slug ON platform_knowledge_base_articles(slug) WHERE is_active = true;
CREATE INDEX idx_kb_search ON platform_knowledge_base_articles USING gin(to_tsvector('english', title || ' ' || content));
```

**Table: `platform_kb_categories`**
```sql
CREATE TABLE platform_kb_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Category details
  name VARCHAR(250) NOT NULL,
  name_ar VARCHAR(250),                 -- Arabic translation
  slug VARCHAR(250) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(100),                    -- Icon identifier

  -- Hierarchy
  parent_category_id UUID REFERENCES platform_kb_categories(id),
  display_order INTEGER DEFAULT 0,

  -- Visibility
  is_visible BOOLEAN DEFAULT true,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_kb_cat_parent ON platform_kb_categories(parent_category_id, display_order);
```

**Table: `platform_canned_responses`**
```sql
CREATE TABLE platform_canned_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Response details
  title VARCHAR(250) NOT NULL,
  shortcut VARCHAR(50) UNIQUE,          -- e.g., "#welcome", "#reset_password"
  content TEXT NOT NULL,
  content_html TEXT,

  -- Organization
  category VARCHAR(100),
  tags TEXT[],

  -- Usage
  use_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP,

  -- Availability
  is_global BOOLEAN DEFAULT true,       -- Available to all agents
  agent_ids UUID[],                     -- Specific agents (if not global)

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID NOT NULL,
  updated_at TIMESTAMP,
  updated_by UUID,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_canned_shortcut ON platform_canned_responses(shortcut) WHERE is_active = true;
CREATE INDEX idx_canned_category ON platform_canned_responses(category);
```

**Table: `platform_support_sla_policies`**
```sql
CREATE TABLE platform_support_sla_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Policy details
  policy_name VARCHAR(250) NOT NULL,
  description TEXT,

  -- Conditions (who this applies to)
  applies_to_priority VARCHAR(20)[],    -- ['high', 'critical']
  applies_to_category VARCHAR(100)[],
  applies_to_plan_type VARCHAR(50)[],   -- ['Pro', 'Enterprise']

  -- SLA targets (in minutes)
  response_time_minutes INTEGER NOT NULL,
  resolution_time_minutes INTEGER NOT NULL,

  -- Business hours
  business_hours_only BOOLEAN DEFAULT true,
  timezone VARCHAR(50) DEFAULT 'Asia/Muscat',
  working_days INTEGER[] DEFAULT ARRAY[1,2,3,4,5], -- Mon-Fri

  -- Escalation
  escalate_on_breach BOOLEAN DEFAULT true,
  escalation_agent_id UUID,
  escalation_team VARCHAR(100),

  -- Priority
  policy_order INTEGER DEFAULT 0,       -- Higher order = higher priority

  -- Metadata
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID
);

CREATE INDEX idx_sla_active ON platform_support_sla_policies(is_active, policy_order);
```

**Table: `platform_support_impersonation_log`**
```sql
CREATE TABLE platform_support_impersonation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Session details
  admin_user_id UUID NOT NULL REFERENCES platform_admin_users(id),
  tenant_id UUID NOT NULL REFERENCES org_tenants_mst(id),
  impersonated_user_id UUID REFERENCES org_users_mst(id),

  -- Reason
  ticket_id UUID REFERENCES platform_support_tickets(id),
  reason TEXT NOT NULL,

  -- Session tracking
  session_start TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  session_end TIMESTAMP,
  duration_seconds INTEGER,

  -- Actions performed (logged separately)
  actions_performed JSONB,
  /*
    Example:
    {
      "pages_visited": ["/orders", "/customers"],
      "actions_taken": ["viewed_order_123", "downloaded_invoice"],
      "changes_made": false
    }
  */

  -- IP & Browser
  ip_address VARCHAR(50),
  user_agent TEXT,

  -- Approval (for enterprise tenants)
  requires_approval BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMP,

  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_impersonate_admin ON platform_support_impersonation_log(admin_user_id, session_start DESC);
CREATE INDEX idx_impersonate_tenant ON platform_support_impersonation_log(tenant_id, session_start DESC);
CREATE INDEX idx_impersonate_ticket ON platform_support_impersonation_log(ticket_id);
```

### 5.2 Views

**View: `v_support_dashboard_summary`**
```sql
CREATE VIEW v_support_dashboard_summary AS
SELECT
  -- Overall ticket counts
  COUNT(*) FILTER (WHERE status = 'new') as new_tickets,
  COUNT(*) FILTER (WHERE status = 'open') as open_tickets,
  COUNT(*) FILTER (WHERE status = 'pending') as pending_tickets,
  COUNT(*) FILTER (WHERE status IN ('new', 'open', 'pending')) as active_tickets,

  -- Priority breakdown
  COUNT(*) FILTER (WHERE priority = 'critical' AND status NOT IN ('resolved', 'closed')) as critical_tickets,
  COUNT(*) FILTER (WHERE priority = 'high' AND status NOT IN ('resolved', 'closed')) as high_tickets,

  -- SLA metrics
  COUNT(*) FILTER (WHERE response_sla_breached = true) as response_sla_breaches,
  COUNT(*) FILTER (WHERE resolution_sla_breached = true) as resolution_sla_breaches,
  COUNT(*) FILTER (WHERE sla_response_due < NOW() AND first_response_at IS NULL) as sla_at_risk,

  -- Satisfaction
  AVG(satisfaction_rating) FILTER (WHERE satisfaction_rating IS NOT NULL) as avg_satisfaction,
  COUNT(*) FILTER (WHERE satisfaction_rating IS NOT NULL) as rated_tickets,

  -- Today's activity
  COUNT(*) FILTER (WHERE created_at::date = CURRENT_DATE) as tickets_today,
  COUNT(*) FILTER (WHERE closed_at::date = CURRENT_DATE) as closed_today

FROM platform_support_tickets
WHERE is_active = true;
```

---

## 6. API Specifications

### 6.1 Ticket Management APIs

**Create Ticket**

```http
POST /api/v1/platform/support/tickets
```

**Request:**
```json
{
  "tenant_id": "uuid-tenant-123",
  "requester_user_id": "uuid-user-456",
  "subject": "Unable to process payments",
  "description": "Customers are reporting that payments are failing with error code ERR_502",
  "category": "technical_issues",
  "subcategory": "payment_gateway",
  "priority": "high",
  "attachments": [
    {
      "filename": "error_screenshot.png",
      "content_base64": "iVBORw0KGgo...",
      "mime_type": "image/png"
    }
  ],
  "custom_fields": {
    "affected_module": "Payment Processing",
    "error_code": "ERR_502",
    "users_affected": "10+"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ticket_id": "uuid-ticket-789",
    "ticket_number": "TICK-2025-00123",
    "status": "new",
    "priority": "high",
    "sla_response_due": "2025-01-14T14:30:00Z",
    "sla_resolution_due": "2025-01-14T20:30:00Z",
    "created_at": "2025-01-14T12:30:00Z"
  }
}
```

**Get Ticket Details**

```http
GET /api/v1/platform/support/tickets/{ticket_id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "ticket_id": "uuid-ticket-789",
    "ticket_number": "TICK-2025-00123",
    "tenant": {
      "id": "uuid-tenant-123",
      "name": "Luxury Laundry",
      "plan_type": "Growth"
    },
    "requester": {
      "name": "Ahmed Al-Said",
      "email": "ahmed@luxurylaundry.com",
      "user_id": "uuid-user-456"
    },
    "subject": "Unable to process payments",
    "description": "Customers are reporting...",
    "category": "technical_issues",
    "subcategory": "payment_gateway",
    "priority": "high",
    "status": "open",
    "assigned_to": {
      "id": "uuid-agent-111",
      "name": "Sarah Support"
    },
    "sla": {
      "response_due": "2025-01-14T14:30:00Z",
      "resolution_due": "2025-01-14T20:30:00Z",
      "response_breached": false,
      "resolution_breached": false,
      "time_until_breach_minutes": 45
    },
    "messages_count": 3,
    "created_at": "2025-01-14T12:30:00Z",
    "updated_at": "2025-01-14T13:15:00Z"
  }
}
```

**List Tickets**

```http
GET /api/v1/platform/support/tickets
```

**Query Parameters:**
- `status` - Filter by status (new, open, pending, resolved, closed)
- `priority` - Filter by priority
- `assigned_to` - Filter by agent ID
- `tenant_id` - Filter by tenant
- `category` - Filter by category
- `sla_at_risk` - Show only tickets at SLA risk (boolean)
- `search` - Full-text search
- `sort` - Sort field (created_at, priority, sla_due)
- `order` - Sort order (asc, desc)
- `limit` - Results per page
- `offset` - Pagination offset

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "ticket_id": "uuid-ticket-789",
      "ticket_number": "TICK-2025-00123",
      "tenant_name": "Luxury Laundry",
      "subject": "Unable to process payments",
      "priority": "high",
      "status": "open",
      "assigned_to_name": "Sarah Support",
      "sla_due": "2025-01-14T14:30:00Z",
      "sla_status": "on_track",
      "created_at": "2025-01-14T12:30:00Z"
    }
  ],
  "pagination": {
    "total": 145,
    "limit": 20,
    "offset": 0,
    "has_more": true
  }
}
```

**Update Ticket**

```http
PATCH /api/v1/platform/support/tickets/{ticket_id}
```

**Request:**
```json
{
  "status": "resolved",
  "assigned_to": "uuid-agent-222",
  "priority": "medium",
  "tags": ["billing", "resolved"]
}
```

**Add Message to Ticket**

```http
POST /api/v1/platform/support/tickets/{ticket_id}/messages
```

**Request:**
```json
{
  "message_type": "public_reply",
  "message_body": "I've investigated the issue. The payment gateway had a temporary outage. The issue is now resolved.",
  "is_internal": false,
  "attachments": [
    {
      "filename": "resolution_report.pdf",
      "url": "s3://cleanmatex/tickets/..."
    }
  ],
  "status_change": "resolved"
}
```

### 6.2 Knowledge Base APIs

**Create Article**

```http
POST /api/v1/platform/support/knowledge-base/articles
```

**Request:**
```json
{
  "title": "How to Reset Your Password",
  "slug": "how-to-reset-password",
  "content": "<h2>Password Reset Steps</h2><ol><li>Click 'Forgot Password'...</li></ol>",
  "excerpt": "Step-by-step guide to reset your account password",
  "category_id": "uuid-category-1",
  "tags": ["password", "account", "security"],
  "is_published": true,
  "search_keywords": ["reset", "password", "forgot", "login"]
}
```

**Search Knowledge Base**

```http
GET /api/v1/platform/support/knowledge-base/search?q=password+reset
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "article_id": "uuid-article-1",
      "title": "How to Reset Your Password",
      "excerpt": "Step-by-step guide...",
      "url": "/kb/how-to-reset-password",
      "category": "Account Management",
      "relevance_score": 0.95,
      "view_count": 1245,
      "helpful_count": 234
    }
  ],
  "total": 1
}
```

### 6.3 Impersonation APIs

**Start Impersonation Session**

```http
POST /api/v1/platform/support/impersonate
```

**Request:**
```json
{
  "tenant_id": "uuid-tenant-123",
  "user_id": "uuid-user-456",
  "ticket_id": "uuid-ticket-789",
  "reason": "Debugging payment processing issue reported in ticket TICK-2025-00123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "impersonation_session_id": "uuid-session-999",
    "tenant_access_token": "eyJhbGc...",
    "expires_at": "2025-01-14T14:30:00Z",
    "tenant_dashboard_url": "https://app.cleanmatex.com?impersonate_token=...",
    "warnings": [
      "All actions will be logged",
      "Session will auto-expire in 2 hours",
      "Changes made will be attributed to you"
    ]
  }
}
```

**End Impersonation Session**

```http
POST /api/v1/platform/support/impersonate/{session_id}/end
```

---

## 7. UI/UX Design

### 7.1 Support Dashboard

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Platform HQ Console - Support Dashboard                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  New     │  │  Open    │  │  Pending │  │  SLA     │   │
│  │  Tickets │  │  Tickets │  │  Tickets │  │  At Risk │   │
│  │    12    │  │    28    │  │    15    │  │    3 🔴 │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Filters & Search                                   │    │
│  │  [🔍 Search tickets...]                             │    │
│  │  Status: [All ▼] Priority: [All ▼] Agent: [All ▼] │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Tickets List                         [+ New Ticket]│    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ #      Subject           Tenant    Priority Status  │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ 00123  Payment fails    Luxury     🔴 High   Open   │    │
│  │        SLA: 45min left  Laundry                     │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ 00122  Slow dashboard   Express    🟡 Medium Open   │    │
│  │        SLA: 2h left     Dry                         │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ 00121  Feature request  Quick      🟢 Low    New    │    │
│  │        SLA: 6h left     Clean                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.2 Ticket Detail View

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Ticket #TICK-2025-00123                    [Edit] [Close]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────┐  ┌────────────────────────┐ │
│  │  TICKET DETAILS            │  │  ACTIONS               │ │
│  ├────────────────────────────┤  ├────────────────────────┤ │
│  │  Tenant: Luxury Laundry   │  │  [Assign to me]        │ │
│  │  Contact: ahmed@luxury... │  │  [Change Priority]     │ │
│  │  Status: 🟢 Open          │  │  [Add Tags]            │ │
│  │  Priority: 🔴 High        │  │  [Impersonate Tenant]  │ │
│  │  Assigned: Sarah Support  │  │  [Merge Ticket]        │ │
│  │  Category: Technical      │  │  [Mark Resolved]       │ │
│  │                            │  └────────────────────────┘ │
│  │  SLA:                      │                             │
│  │  Response: ✅ Met (1h ago)│  ┌────────────────────────┐ │
│  │  Resolution: 🟡 5h left   │  │  RELATED TICKETS       │ │
│  │                            │  ├────────────────────────┤ │
│  │  Created: Jan 14, 12:30   │  │  #00089 - Similar      │ │
│  │  Updated: Jan 14, 13:15   │  │  issue (Resolved)      │ │
│  └────────────────────────────┘  └────────────────────────┘ │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  CONVERSATION                                        │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │                                                      │    │
│  │  [Ahmed Al-Said] Jan 14, 12:30                      │    │
│  │  Unable to process payments                         │    │
│  │  Customers are reporting that payments are failing  │    │
│  │  with error code ERR_502                            │    │
│  │  📎 error_screenshot.png                            │    │
│  │                                                      │    │
│  │  [Sarah Support - Internal Note] Jan 14, 12:45      │    │
│  │  🔒 Checking payment gateway logs...                │    │
│  │                                                      │    │
│  │  [Sarah Support] Jan 14, 13:15                      │    │
│  │  Hi Ahmed, I've investigated the issue. The payment │    │
│  │  gateway had a temporary outage. Issue is now       │    │
│  │  resolved. Please test and confirm.                 │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Reply                                               │    │
│  │  ┌────────────────────────────────────────────────┐ │    │
│  │  │ Type your message here...                      │ │    │
│  │  │                                                 │ │    │
│  │  │                                                 │ │    │
│  │  └────────────────────────────────────────────────┘ │    │
│  │  [📎 Attach] [💾 Canned] [🔒 Internal Note]        │    │
│  │                                    [Send Reply]     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 7.3 Knowledge Base Interface

**Admin View:**
```
┌─────────────────────────────────────────────────────────────┐
│  Knowledge Base Management              [+ New Article]     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Total    │  │ Published│  │ Drafts   │  │ Views    │   │
│  │ Articles │  │ Articles │  │          │  │ This Mo. │   │
│  │   245    │  │   203    │  │    42    │  │  12,450  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Categories                                          │    │
│  │  ├─ 📁 Getting Started (45 articles)                │    │
│  │  ├─ 📁 Account Management (32 articles)             │    │
│  │  ├─ 📁 Billing & Payments (28 articles)             │    │
│  │  ├─ 📁 Technical Issues (67 articles)               │    │
│  │  └─ 📁 Features & How-To (73 articles)              │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Recent Articles                                     │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ Title                   Views  Helpful  Status       │    │
│  ├─────────────────────────────────────────────────────┤    │
│  │ How to Reset Password   1,245  234     ✅ Published │    │
│  │ Payment Gateway Setup     892  145     ✅ Published │    │
│  │ Troubleshoot Orders       654   98     📝 Draft     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

**Customer-Facing View:**
```
┌─────────────────────────────────────────────────────────────┐
│  CleanMateX Help Center                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  🔍 How can we help you?                            │    │
│  │  [Search for help articles...]                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ 🚀 Getting      │  │ 👤 Account       │                │
│  │   Started       │  │   Management     │                │
│  │   45 articles   │  │   32 articles    │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                              │
│  ┌──────────────────┐  ┌──────────────────┐                │
│  │ 💰 Billing &    │  │ 🔧 Technical     │                │
│  │   Payments      │  │   Issues         │                │
│  │   28 articles   │  │   67 articles    │                │
│  └──────────────────┘  └──────────────────┘                │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Popular Articles                                    │    │
│  │  • How to Reset Your Password                       │    │
│  │  • Setting Up Payment Gateway                       │    │
│  │  • Managing User Permissions                        │    │
│  │  • Troubleshooting Order Syncing                    │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  Still need help?                                    │    │
│  │  [📧 Submit a Support Ticket]                       │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Ticket Management

### 8.1 Ticket Assignment Strategies

**1. Round-Robin Assignment**
```typescript
async function assignTicketRoundRobin(ticketId: string, team: string) {
  // Get all available agents in the team
  const agents = await prisma.platform_admin_users.findMany({
    where: {
      team: team,
      is_active: true,
      is_available: true
    },
    orderBy: {
      last_assigned_at: 'asc' // Agent assigned longest ago gets next ticket
    }
  });

  if (agents.length === 0) {
    throw new Error('No available agents in team');
  }

  // Assign to agent with oldest assignment
  const selectedAgent = agents[0];

  await prisma.platform_support_tickets.update({
    where: { id: ticketId },
    data: {
      assigned_to: selectedAgent.id,
      assigned_at: new Date(),
      status: 'open'
    }
  });

  // Update agent's last assigned timestamp
  await prisma.platform_admin_users.update({
    where: { id: selectedAgent.id },
    data: {
      last_assigned_at: new Date()
    }
  });

  return selectedAgent;
}
```

**2. Load-Balanced Assignment**
```typescript
async function assignTicketLoadBalanced(ticketId: string, team: string) {
  // Get agents with their current ticket counts
  const agentsWithLoad = await prisma.$queryRaw`
    SELECT
      u.id,
      u.name,
      COUNT(t.id) as active_tickets
    FROM platform_admin_users u
    LEFT JOIN platform_support_tickets t ON u.id = t.assigned_to
      AND t.status IN ('new', 'open', 'pending')
    WHERE u.team = ${team}
      AND u.is_active = true
      AND u.is_available = true
    GROUP BY u.id, u.name
    ORDER BY active_tickets ASC
    LIMIT 1
  `;

  if (agentsWithLoad.length === 0) {
    throw new Error('No available agents');
  }

  const selectedAgent = agentsWithLoad[0];

  await prisma.platform_support_tickets.update({
    where: { id: ticketId },
    data: {
      assigned_to: selectedAgent.id,
      assigned_at: new Date(),
      status: 'open'
    }
  });

  return selectedAgent;
}
```

**3. Skill-Based Assignment**
```typescript
async function assignTicketBySkill(
  ticketId: string,
  category: string,
  priority: string
) {
  // Get ticket details
  const ticket = await prisma.platform_support_tickets.findUnique({
    where: { id: ticketId }
  });

  // Find agents with matching skills
  const agents = await prisma.platform_admin_users.findMany({
    where: {
      is_active: true,
      is_available: true,
      skills: {
        has: category // JSONB contains check
      }
    }
  });

  if (agents.length === 0) {
    // Fallback to general assignment
    return assignTicketLoadBalanced(ticketId, 'general');
  }

  // For high/critical priority, prefer senior agents
  if (priority === 'high' || priority === 'critical') {
    const seniorAgent = agents.find(a => a.seniority_level === 'senior');
    if (seniorAgent) {
      await assignToAgent(ticketId, seniorAgent.id);
      return seniorAgent;
    }
  }

  // Otherwise, load-balanced among skilled agents
  const agentIds = agents.map(a => a.id);
  const agentWithLoad = await findAgentWithLeastLoad(agentIds);

  await assignToAgent(ticketId, agentWithLoad.id);
  return agentWithLoad;
}
```

### 8.2 Ticket Escalation

**Auto-Escalation on SLA Breach:**
```typescript
// Run every 5 minutes
async function checkAndEscalateTickets() {
  const now = new Date();

  // Find tickets approaching SLA breach (within 15 minutes)
  const atRiskTickets = await prisma.platform_support_tickets.findMany({
    where: {
      status: {
        in: ['new', 'open', 'pending']
      },
      OR: [
        {
          first_response_at: null,
          sla_response_due: {
            lte: new Date(now.getTime() + 15 * 60 * 1000) // Within 15 min
          }
        },
        {
          resolved_at: null,
          sla_resolution_due: {
            lte: new Date(now.getTime() + 15 * 60 * 1000)
          }
        }
      ]
    },
    include: {
      tenant: true,
      assigned_agent: true
    }
  });

  for (const ticket of atRiskTickets) {
    // Send alert to assigned agent
    await sendSLAWarningNotification(ticket);

    // Alert support manager
    await notifySupportManager(ticket);
  }

  // Find already breached tickets
  const breachedTickets = await prisma.platform_support_tickets.findMany({
    where: {
      status: {
        in: ['new', 'open', 'pending']
      },
      OR: [
        {
          first_response_at: null,
          sla_response_due: {
            lt: now
          },
          response_sla_breached: false
        },
        {
          resolved_at: null,
          sla_resolution_due: {
            lt: now
          },
          resolution_sla_breached: false
        }
      ]
    }
  });

  for (const ticket of breachedTickets) {
    // Mark as breached
    await prisma.platform_support_tickets.update({
      where: { id: ticket.id },
      data: {
        response_sla_breached: ticket.first_response_at === null,
        resolution_sla_breached: ticket.resolved_at === null
      }
    });

    // Escalate ticket
    await escalateTicket(ticket);
  }
}

async function escalateTicket(ticket: any) {
  // Get escalation policy
  const policy = await getEscalationPolicy(ticket.priority, ticket.category);

  if (!policy) return;

  // Reassign to escalation agent/team
  if (policy.escalation_agent_id) {
    await prisma.platform_support_tickets.update({
      where: { id: ticket.id },
      data: {
        assigned_to: policy.escalation_agent_id,
        priority: ticket.priority === 'medium' ? 'high' : 'critical'
      }
    });
  }

  // Add internal note
  await prisma.platform_support_messages.create({
    data: {
      ticket_id: ticket.id,
      message_type: 'auto_message',
      message_body: `Ticket escalated due to SLA breach. Original agent: ${ticket.assigned_agent?.name}`,
      is_internal: true,
      sender_type: 'system'
    }
  });

  // Notify escalation recipient
  await sendEscalationNotification(ticket, policy);
}
```

### 8.3 Ticket Merging

**Merge Duplicate Tickets:**
```typescript
async function mergeTickets(primaryTicketId: string, duplicateTicketIds: string[]) {
  const primaryTicket = await prisma.platform_support_tickets.findUnique({
    where: { id: primaryTicketId }
  });

  for (const duplicateId of duplicateTicketIds) {
    const duplicateTicket = await prisma.platform_support_tickets.findUnique({
      where: { id: duplicateId },
      include: {
        messages: true
      }
    });

    // Copy messages to primary ticket
    for (const message of duplicateTicket.messages) {
      await prisma.platform_support_messages.create({
        data: {
          ticket_id: primaryTicketId,
          message_type: message.message_type,
          message_body: `[Merged from ${duplicateTicket.ticket_number}] ${message.message_body}`,
          sender_type: message.sender_type,
          sender_id: message.sender_id,
          is_internal: message.is_internal,
          created_at: message.created_at
        }
      });
    }

    // Update duplicate ticket
    await prisma.platform_support_tickets.update({
      where: { id: duplicateId },
      data: {
        status: 'closed',
        parent_ticket_id: primaryTicketId,
        rec_notes: `Merged into ${primaryTicket.ticket_number}`
      }
    });

    // Add internal note to primary
    await prisma.platform_support_messages.create({
      data: {
        ticket_id: primaryTicketId,
        message_type: 'auto_message',
        message_body: `Ticket ${duplicateTicket.ticket_number} merged into this ticket`,
        is_internal: true,
        sender_type: 'system'
      }
    });

    // Notify requester of duplicate
    await sendTicketMergedNotification(duplicateTicket, primaryTicket);
  }

  return primaryTicket;
}
```

---

## 9. SLA Management

### 9.1 SLA Calculation

**Calculate SLA Deadlines:**
```typescript
interface SLAPolicy {
  response_time_minutes: number;
  resolution_time_minutes: number;
  business_hours_only: boolean;
  working_days: number[]; // 1=Monday, 7=Sunday
  timezone: string;
}

function calculateSLADeadline(
  startTime: Date,
  targetMinutes: number,
  policy: SLAPolicy
): Date {
  if (!policy.business_hours_only) {
    // Simple calculation: add minutes directly
    return new Date(startTime.getTime() + targetMinutes * 60 * 1000);
  }

  // Business hours calculation
  let remainingMinutes = targetMinutes;
  let currentTime = new Date(startTime);

  const businessHoursStart = 8; // 8 AM
  const businessHoursEnd = 17; // 5 PM
  const minutesPerBusinessDay = (businessHoursEnd - businessHoursStart) * 60;

  while (remainingMinutes > 0) {
    const dayOfWeek = currentTime.getDay() || 7; // Convert Sunday from 0 to 7

    // Check if current day is a working day
    if (!policy.working_days.includes(dayOfWeek)) {
      // Move to next day at business hours start
      currentTime.setDate(currentTime.getDate() + 1);
      currentTime.setHours(businessHoursStart, 0, 0, 0);
      continue;
    }

    const currentHour = currentTime.getHours();
    const currentMinute = currentTime.getMinutes();

    // Before business hours
    if (currentHour < businessHoursStart) {
      currentTime.setHours(businessHoursStart, 0, 0, 0);
      continue;
    }

    // After business hours
    if (currentHour >= businessHoursEnd) {
      // Move to next day
      currentTime.setDate(currentTime.getDate() + 1);
      currentTime.setHours(businessHoursStart, 0, 0, 0);
      continue;
    }

    // Within business hours
    const minutesRemainingToday = (businessHoursEnd - currentHour) * 60 - currentMinute;

    if (remainingMinutes <= minutesRemainingToday) {
      // Can finish today
      currentTime = new Date(currentTime.getTime() + remainingMinutes * 60 * 1000);
      remainingMinutes = 0;
    } else {
      // Need more days
      remainingMinutes -= minutesRemainingToday;
      currentTime.setDate(currentTime.getDate() + 1);
      currentTime.setHours(businessHoursStart, 0, 0, 0);
    }
  }

  return currentTime;
}
```

**Apply SLA Policy:**
```typescript
async function applySLAPolicy(ticketId: string) {
  const ticket = await prisma.platform_support_tickets.findUnique({
    where: { id: ticketId },
    include: {
      tenant: {
        include: {
          subscription: true
        }
      }
    }
  });

  // Find matching SLA policy
  const policy = await prisma.platform_support_sla_policies.findFirst({
    where: {
      is_active: true,
      applies_to_priority: {
        has: ticket.priority
      },
      applies_to_category: {
        has: ticket.category
      },
      applies_to_plan_type: {
        has: ticket.tenant.subscription.plan_type
      }
    },
    orderBy: {
      policy_order: 'desc' // Higher priority policies first
    }
  });

  if (!policy) {
    // Use default policy
    policy = await getDefaultSLAPolicy();
  }

  // Calculate SLA deadlines
  const createdAt = ticket.created_at;
  const responseDue = calculateSLADeadline(
    createdAt,
    policy.response_time_minutes,
    policy
  );
  const resolutionDue = calculateSLADeadline(
    createdAt,
    policy.resolution_time_minutes,
    policy
  );

  // Update ticket with SLA deadlines
  await prisma.platform_support_tickets.update({
    where: { id: ticketId },
    data: {
      sla_response_due: responseDue,
      sla_resolution_due: resolutionDue
    }
  });

  return { responseDue, resolutionDue };
}
```

### 9.2 SLA Monitoring Dashboard

**SLA Performance Metrics:**
```typescript
async function getSLAPerformanceMetrics(period: 'day' | 'week' | 'month') {
  const startDate = getStartDate(period);

  const metrics = await prisma.$queryRaw`
    SELECT
      -- Response SLA
      COUNT(*) FILTER (WHERE first_response_at IS NOT NULL) as responded_tickets,
      COUNT(*) FILTER (WHERE first_response_at IS NOT NULL AND first_response_at < sla_response_due) as response_sla_met,
      COUNT(*) FILTER (WHERE response_sla_breached = true) as response_sla_breached,

      -- Resolution SLA
      COUNT(*) FILTER (WHERE resolved_at IS NOT NULL) as resolved_tickets,
      COUNT(*) FILTER (WHERE resolved_at IS NOT NULL AND resolved_at < sla_resolution_due) as resolution_sla_met,
      COUNT(*) FILTER (WHERE resolution_sla_breached = true) as resolution_sla_breached,

      -- Average times
      AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60) as avg_response_time_minutes,
      AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60) as avg_resolution_time_minutes,

      -- By priority
      COUNT(*) FILTER (WHERE priority = 'critical') as critical_tickets,
      COUNT(*) FILTER (WHERE priority = 'critical' AND response_sla_breached = true) as critical_breached

    FROM platform_support_tickets
    WHERE created_at >= ${startDate}
      AND is_active = true
  `;

  return {
    response_sla_compliance: (metrics[0].response_sla_met / metrics[0].responded_tickets) * 100,
    resolution_sla_compliance: (metrics[0].resolution_sla_met / metrics[0].resolved_tickets) * 100,
    avg_response_time_minutes: Math.round(metrics[0].avg_response_time_minutes),
    avg_resolution_time_minutes: Math.round(metrics[0].avg_resolution_time_minutes),
    critical_tickets: metrics[0].critical_tickets,
    critical_breached: metrics[0].critical_breached,
    ...metrics[0]
  };
}
```

---

## 10. Knowledge Base

### 10.1 Article Creation Workflow

**Article Editor:**
```typescript
interface KBArticle {
  title: string;
  slug: string;
  content: string; // Rich HTML
  excerpt: string;
  category_id: string;
  tags: string[];
  is_published: boolean;
  search_keywords: string[];
  related_article_ids: string[];
}

async function createKBArticle(article: KBArticle, authorId: string) {
  // Generate slug if not provided
  if (!article.slug) {
    article.slug = slugify(article.title);
  }

  // Create article
  const created = await prisma.platform_knowledge_base_articles.create({
    data: {
      ...article,
      created_by: authorId,
      version: 1,
      view_count: 0,
      helpful_count: 0,
      not_helpful_count: 0
    }
  });

  // If published, send notifications to subscribers
  if (article.is_published) {
    await notifyNewArticle(created);
  }

  return created;
}
```

**Article Search Algorithm:**
```typescript
async function searchKnowledgeBase(query: string, limit: number = 10) {
  // Full-text search with ranking
  const results = await prisma.$queryRaw`
    SELECT
      id,
      title,
      excerpt,
      slug,
      category_id,
      view_count,
      helpful_count,
      ts_rank(
        to_tsvector('english', title || ' ' || content),
        plainto_tsquery('english', ${query})
      ) as relevance_score
    FROM platform_knowledge_base_articles
    WHERE is_published = true
      AND is_active = true
      AND to_tsvector('english', title || ' ' || content) @@ plainto_tsquery('english', ${query})
    ORDER BY relevance_score DESC
    LIMIT ${limit}
  `;

  // Log search query for analytics
  await logKBSearch(query, results.length);

  return results;
}
```

### 10.2 Article Analytics

**Track Article Performance:**
```typescript
async function trackArticleView(articleId: string, userId?: string) {
  // Increment view count
  await prisma.platform_knowledge_base_articles.update({
    where: { id: articleId },
    data: {
      view_count: {
        increment: 1
      }
    }
  });

  // Log detailed view
  await prisma.platform_kb_article_views.create({
    data: {
      article_id: articleId,
      user_id: userId,
      viewed_at: new Date(),
      referrer: 'search' // or 'category', 'related', etc.
    }
  });
}

async function rateArticleHelpfulness(
  articleId: string,
  isHelpful: boolean,
  feedback?: string
) {
  const field = isHelpful ? 'helpful_count' : 'not_helpful_count';

  await prisma.platform_knowledge_base_articles.update({
    where: { id: articleId },
    data: {
      [field]: {
        increment: 1
      }
    }
  });

  // Store detailed feedback
  if (feedback) {
    await prisma.platform_kb_article_feedback.create({
      data: {
        article_id: articleId,
        is_helpful: isHelpful,
        feedback_text: feedback,
        created_at: new Date()
      }
    });
  }
}
```

**Identify Content Gaps:**
```typescript
async function identifyContentGaps() {
  // Find common search queries with no/few results
  const searches = await prisma.$queryRaw`
    SELECT
      search_query,
      COUNT(*) as search_count,
      AVG(results_count) as avg_results
    FROM platform_kb_search_log
    WHERE searched_at > NOW() - INTERVAL '30 days'
    GROUP BY search_query
    HAVING AVG(results_count) < 2
    ORDER BY search_count DESC
    LIMIT 20
  `;

  // Find articles with high "not helpful" rates
  const poorPerformers = await prisma.platform_knowledge_base_articles.findMany({
    where: {
      is_published: true,
      view_count: {
        gt: 100 // Minimum views for statistical significance
      }
    },
    select: {
      id: true,
      title: true,
      view_count: true,
      helpful_count: true,
      not_helpful_count: true
    }
  });

  const lowRated = poorPerformers
    .map(article => ({
      ...article,
      helpfulness_rate: article.helpful_count / (article.helpful_count + article.not_helpful_count)
    }))
    .filter(article => article.helpfulness_rate < 0.5)
    .sort((a, b) => a.helpfulness_rate - b.helpfulness_rate);

  return {
    missing_content: searches,
    low_rated_articles: lowRated
  };
}
```

---

## 11. Tenant Impersonation

### 11.1 Impersonation Security

**Start Impersonation Session:**
```typescript
async function startImpersonation(params: {
  adminUserId: string;
  tenantId: string;
  userId?: string;
  ticketId?: string;
  reason: string;
  requiresApproval?: boolean;
}) {
  // Verify admin has permission
  const admin = await prisma.platform_admin_users.findUnique({
    where: { id: params.adminUserId },
    include: { role: true }
  });

  if (!admin.role.permissions.includes('can_impersonate')) {
    throw new Error('No impersonation permission');
  }

  // Check if approval required (e.g., for Enterprise tenants)
  if (params.requiresApproval) {
    // Create approval request
    const request = await createImpersonationApprovalRequest(params);
    return {
      status: 'pending_approval',
      request_id: request.id
    };
  }

  // Generate temporary access token
  const accessToken = await generateImpersonationToken({
    admin_user_id: params.adminUserId,
    tenant_id: params.tenantId,
    user_id: params.userId,
    expires_in: 2 * 60 * 60 // 2 hours
  });

  // Log impersonation session
  const session = await prisma.platform_support_impersonation_log.create({
    data: {
      admin_user_id: params.adminUserId,
      tenant_id: params.tenantId,
      impersonated_user_id: params.userId,
      ticket_id: params.ticketId,
      reason: params.reason,
      session_start: new Date(),
      ip_address: getCurrentIP(),
      user_agent: getCurrentUserAgent()
    }
  });

  // Send notification to tenant (transparency)
  await sendImpersonationNotification(params.tenantId, admin.name, params.reason);

  return {
    session_id: session.id,
    access_token: accessToken,
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000),
    tenant_dashboard_url: `https://app.cleanmatex.com?impersonate_token=${accessToken}`
  };
}
```

**End Impersonation Session:**
```typescript
async function endImpersonation(sessionId: string) {
  const session = await prisma.platform_support_impersonation_log.findUnique({
    where: { id: sessionId }
  });

  const sessionEnd = new Date();
  const durationSeconds = Math.floor(
    (sessionEnd.getTime() - session.session_start.getTime()) / 1000
  );

  await prisma.platform_support_impersonation_log.update({
    where: { id: sessionId },
    data: {
      session_end: sessionEnd,
      duration_seconds: durationSeconds
    }
  });

  // Revoke access token
  await revokeImpersonationToken(sessionId);

  return { session_end: sessionEnd, duration_seconds: durationSeconds };
}
```

**Audit Impersonation Actions:**
```typescript
async function logImpersonationAction(
  sessionId: string,
  action: {
    type: string;
    resource: string;
    details: any;
  }
) {
  // Log action to audit trail
  await prisma.platform_impersonation_actions_log.create({
    data: {
      session_id: sessionId,
      action_type: action.type,
      resource_type: action.resource,
      action_details: action.details,
      timestamp: new Date()
    }
  });

  // Update session summary
  await prisma.platform_support_impersonation_log.update({
    where: { id: sessionId },
    data: {
      actions_performed: {
        // Append to JSONB array
        push: {
          type: action.type,
          resource: action.resource,
          timestamp: new Date()
        }
      }
    }
  });
}
```

### 11.2 Impersonation UI

**Impersonation Banner (shown to admin while impersonating):**
```
┌─────────────────────────────────────────────────────────────┐
│ 🎭 IMPERSONATION MODE                                       │
│ You are viewing this as: Luxury Laundry (Ahmed Al-Said)    │
│ Reason: Debugging payment issue (Ticket #TICK-2025-00123)  │
│ Session started: 2025-01-14 14:30                          │
│ [End Impersonation Session]                        00:45:23│
└─────────────────────────────────────────────────────────────┘
```

---

## 12. Communication Channels

### 12.1 Email Integration

**Inbound Email Parsing:**
```typescript
import { parseEmail } from 'mailparser';

async function processInboundEmail(rawEmail: string) {
  const parsed = await parseEmail(rawEmail);

  // Extract sender
  const senderEmail = parsed.from.value[0].address;

  // Check if reply to existing ticket
  const references = parsed.references || [];
  const inReplyTo = parsed.inReplyTo;

  let ticket;

  // Try to match existing ticket
  const existingMessage = await prisma.platform_support_messages.findFirst({
    where: {
      email_message_id: {
        in: [...references, inReplyTo]
      }
    },
    include: { ticket: true }
  });

  if (existingMessage) {
    // Add reply to existing ticket
    ticket = existingMessage.ticket;

    await prisma.platform_support_messages.create({
      data: {
        ticket_id: ticket.id,
        message_type: 'public_reply',
        message_body: parsed.text || parsed.html,
        is_html: !!parsed.html,
        sender_type: 'customer',
        sender_email: senderEmail,
        email_message_id: parsed.messageId,
        created_at: parsed.date
      }
    });

    // Update ticket status if was pending
    if (ticket.status === 'pending') {
      await prisma.platform_support_tickets.update({
        where: { id: ticket.id },
        data: {
          status: 'open',
          updated_at: new Date()
        }
      });
    }
  } else {
    // Create new ticket
    const tenant = await findTenantByEmail(senderEmail);

    if (!tenant) {
      // Unknown sender - send auto-reply
      await sendUnknownSenderEmail(senderEmail);
      return;
    }

    ticket = await prisma.platform_support_tickets.create({
      data: {
        ticket_number: await generateTicketNumber(),
        tenant_id: tenant.id,
        requester_email: senderEmail,
        requester_name: parsed.from.value[0].name || senderEmail,
        subject: parsed.subject,
        description: parsed.text || parsed.html,
        category: 'general', // Auto-categorize later
        priority: 'medium',
        status: 'new',
        source: 'email'
      }
    });

    // Create initial message
    await prisma.platform_support_messages.create({
      data: {
        ticket_id: ticket.id,
        message_type: 'public_reply',
        message_body: parsed.text || parsed.html,
        is_html: !!parsed.html,
        sender_type: 'customer',
        sender_email: senderEmail,
        email_message_id: parsed.messageId
      }
    });

    // Apply SLA policy
    await applySLAPolicy(ticket.id);

    // Auto-assign
    await autoAssignTicket(ticket.id);

    // Send confirmation email
    await sendTicketCreatedEmail(ticket);
  }

  // Process attachments
  if (parsed.attachments) {
    await processEmailAttachments(ticket.id, parsed.attachments);
  }

  return ticket;
}
```

**Outbound Email Notifications:**
```typescript
async function sendTicketEmail(
  ticketId: string,
  messageId: string,
  type: 'new_ticket' | 'reply' | 'resolved' | 'closed'
) {
  const ticket = await prisma.platform_support_tickets.findUnique({
    where: { id: ticketId },
    include: {
      tenant: true,
      messages: {
        where: { id: messageId }
      },
      assigned_agent: true
    }
  });

  const message = ticket.messages[0];

  const emailData = {
    to: ticket.requester_email,
    from: 'support@cleanmatex.com',
    subject: getEmailSubject(type, ticket),
    html: renderEmailTemplate(type, ticket, message),
    // Email threading
    references: message.email_message_id,
    inReplyTo: message.email_message_id
  };

  await sendEmail(emailData);

  // Log delivery
  await prisma.platform_support_messages.update({
    where: { id: messageId },
    data: {
      sent_via_email: true,
      email_delivered_at: new Date()
    }
  });
}
```

### 12.2 In-App Notifications

**Real-Time Notifications:**
```typescript
import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway()
export class SupportNotificationsGateway {
  @WebSocketServer()
  server: Server;

  // Notify agent of new ticket assignment
  notifyAgentNewTicket(agentId: string, ticket: any) {
    this.server.to(`agent:${agentId}`).emit('ticket:assigned', {
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      subject: ticket.subject,
      priority: ticket.priority,
      sla_due: ticket.sla_response_due
    });
  }

  // Notify agent of customer reply
  notifyAgentCustomerReply(ticketId: string, message: any) {
    this.server.to(`ticket:${ticketId}`).emit('ticket:customer_reply', {
      ticket_id: ticketId,
      message_preview: message.message_body.substring(0, 100)
    });
  }

  // Notify customer of agent reply
  notifyCustomerAgentReply(tenantId: string, ticket: any, message: any) {
    this.server.to(`tenant:${tenantId}`).emit('ticket:agent_reply', {
      ticket_number: ticket.ticket_number,
      message_preview: message.message_body.substring(0, 100)
    });
  }

  // SLA breach warning
  notifySLAWarning(agentId: string, ticket: any) {
    this.server.to(`agent:${agentId}`).emit('ticket:sla_warning', {
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      minutes_until_breach: getMinutesUntilBreach(ticket.sla_response_due)
    });
  }
}
```

---

## 13. Automation & Workflows

### 13.1 Auto-Categorization

**Use Keywords to Auto-Categorize:**
```typescript
const categoryKeywords = {
  'billing_issues': ['invoice', 'payment', 'bill', 'charge', 'refund', 'subscription'],
  'technical_issues': ['error', 'bug', 'crash', 'broken', 'not working', 'fail'],
  'feature_requests': ['feature', 'request', 'enhancement', 'improve', 'suggest'],
  'account_management': ['password', 'login', 'user', 'permission', 'access'],
  'training': ['how to', 'how do i', 'tutorial', 'guide', 'help with']
};

function autoCategorizeTicket(subject: string, description: string): string {
  const text = (subject + ' ' + description).toLowerCase();

  let bestCategory = 'general';
  let maxMatches = 0;

  for (const [category, keywords] of Object.entries(categoryKeywords)) {
    const matches = keywords.filter(keyword => text.includes(keyword)).length;

    if (matches > maxMatches) {
      maxMatches = matches;
      bestCategory = category;
    }
  }

  return bestCategory;
}
```

### 13.2 Auto-Tagging

```typescript
async function autoTagTicket(ticketId: string) {
  const ticket = await prisma.platform_support_tickets.findUnique({
    where: { id: ticketId }
  });

  const tags: string[] = [];

  // Priority-based tags
  if (ticket.priority === 'critical' || ticket.priority === 'high') {
    tags.push('urgent');
  }

  // Plan-based tags
  const tenant = await prisma.org_tenants_mst.findUnique({
    where: { id: ticket.tenant_id },
    include: { subscription: true }
  });

  if (tenant.subscription.plan_type === 'Enterprise') {
    tags.push('vip');
  }

  // Content-based tags
  const text = (ticket.subject + ' ' + ticket.description).toLowerCase();

  if (text.includes('urgent') || text.includes('asap')) {
    tags.push('urgent');
  }

  if (text.includes('bug') || text.includes('error')) {
    tags.push('bug');
  }

  // Update ticket
  await prisma.platform_support_tickets.update({
    where: { id: ticketId },
    data: { tags }
  });

  return tags;
}
```

### 13.3 Automated Workflows

**Example: Auto-Close Stale Resolved Tickets:**
```typescript
// Run daily
async function autoCloseResolvedTickets() {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const staleTickets = await prisma.platform_support_tickets.findMany({
    where: {
      status: 'resolved',
      resolved_at: {
        lte: threeDaysAgo
      }
    }
  });

  for (const ticket of staleTickets) {
    await prisma.platform_support_tickets.update({
      where: { id: ticket.id },
      data: {
        status: 'closed',
        closed_at: new Date()
      }
    });

    // Add auto-message
    await prisma.platform_support_messages.create({
      data: {
        ticket_id: ticket.id,
        message_type: 'auto_message',
        message_body: 'This ticket was automatically closed after being resolved for 3 days with no response.',
        sender_type: 'system',
        is_internal: false
      }
    });

    // Send notification to requester
    await sendTicketClosedEmail(ticket);
  }

  return staleTickets.length;
}
```

---

## 14. Customer Satisfaction

### 14.1 CSAT Survey

**Send Satisfaction Survey:**
```typescript
async function sendSatisfactionSurvey(ticketId: string) {
  const ticket = await prisma.platform_support_tickets.findUnique({
    where: { id: ticketId },
    include: {
      tenant: true,
      assigned_agent: true
    }
  });

  // Generate unique survey token
  const surveyToken = await generateSurveyToken(ticketId);

  const surveyUrl = `https://platform.cleanmatex.com/survey/${surveyToken}`;

  // Send email with survey
  await sendEmail({
    to: ticket.requester_email,
    subject: `How was your support experience? (Ticket #${ticket.ticket_number})`,
    html: renderSurveyEmail(ticket, surveyUrl)
  });

  return surveyToken;
}
```

**Process Survey Response:**
```typescript
async function processSurveyResponse(
  surveyToken: string,
  response: {
    rating: number; // 1-5
    comment?: string;
  }
) {
  const ticket = await verifyAndGetTicketFromToken(surveyToken);

  if (!ticket) {
    throw new Error('Invalid survey token');
  }

  // Update ticket with satisfaction data
  await prisma.platform_support_tickets.update({
    where: { id: ticket.id },
    data: {
      satisfaction_rating: response.rating,
      satisfaction_comment: response.comment,
      satisfaction_submitted_at: new Date()
    }
  });

  // Notify agent if rating is low
  if (response.rating <= 2) {
    await notifyLowSatisfactionRating(ticket, response);
  }

  // Thank you message
  return {
    message: 'Thank you for your feedback!',
    ticket_number: ticket.ticket_number
  };
}
```

### 14.2 NPS Tracking

**Calculate Net Promoter Score:**
```typescript
async function calculateNPS(period: 'month' | 'quarter' | 'year') {
  const startDate = getStartDate(period);

  const ratings = await prisma.platform_support_tickets.findMany({
    where: {
      satisfaction_submitted_at: {
        gte: startDate
      },
      satisfaction_rating: {
        not: null
      }
    },
    select: {
      satisfaction_rating: true
    }
  });

  const total = ratings.length;

  if (total === 0) return { nps: 0, total: 0 };

  // Ratings 5 = Promoters
  // Ratings 3-4 = Passives
  // Ratings 1-2 = Detractors

  const promoters = ratings.filter(r => r.satisfaction_rating === 5).length;
  const detractors = ratings.filter(r => r.satisfaction_rating <= 2).length;

  const promoterPercentage = (promoters / total) * 100;
  const detractorPercentage = (detractors / total) * 100;

  const nps = promoterPercentage - detractorPercentage;

  return {
    nps: Math.round(nps),
    total,
    promoters,
    detractors,
    promoter_percentage: promoterPercentage,
    detractor_percentage: detractorPercentage
  };
}
```

---

## 15. Reporting & Analytics

### 15.1 Support Metrics Dashboard

**Key Metrics:**
```typescript
async function getSupportMetrics(startDate: Date, endDate: Date) {
  const metrics = await prisma.$queryRaw`
    SELECT
      -- Volume
      COUNT(*) as total_tickets,
      COUNT(*) FILTER (WHERE status = 'new') as new_tickets,
      COUNT(*) FILTER (WHERE status = 'open') as open_tickets,
      COUNT(*) FILTER (WHERE status = 'closed') as closed_tickets,

      -- Response times
      AVG(EXTRACT(EPOCH FROM (first_response_at - created_at)) / 60)
        FILTER (WHERE first_response_at IS NOT NULL) as avg_first_response_minutes,

      -- Resolution times
      AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60)
        FILTER (WHERE resolved_at IS NOT NULL) as avg_resolution_minutes,

      -- SLA compliance
      COUNT(*) FILTER (WHERE first_response_at < sla_response_due) as response_sla_met,
      COUNT(*) FILTER (WHERE resolved_at < sla_resolution_due) as resolution_sla_met,
      COUNT(*) FILTER (WHERE response_sla_breached = true) as response_breached,
      COUNT(*) FILTER (WHERE resolution_sla_breached = true) as resolution_breached,

      -- Satisfaction
      AVG(satisfaction_rating) FILTER (WHERE satisfaction_rating IS NOT NULL) as avg_satisfaction,
      COUNT(*) FILTER (WHERE satisfaction_rating IS NOT NULL) as rated_count,

      -- Channels
      COUNT(*) FILTER (WHERE source = 'email') as email_tickets,
      COUNT(*) FILTER (WHERE source = 'portal') as portal_tickets,

      -- Priority distribution
      COUNT(*) FILTER (WHERE priority = 'critical') as critical_count,
      COUNT(*) FILTER (WHERE priority = 'high') as high_count,
      COUNT(*) FILTER (WHERE priority = 'medium') as medium_count,
      COUNT(*) FILTER (WHERE priority = 'low') as low_count

    FROM platform_support_tickets
    WHERE created_at BETWEEN ${startDate} AND ${endDate}
  `;

  return metrics[0];
}
```

### 15.2 Agent Performance Report

```typescript
async function getAgentPerformanceReport(
  agentId: string,
  startDate: Date,
  endDate: Date
) {
  const performance = await prisma.$queryRaw`
    SELECT
      -- Volume
      COUNT(*) as tickets_handled,
      COUNT(*) FILTER (WHERE status = 'closed') as tickets_closed,

      -- Speed
      AVG(EXTRACT(EPOCH FROM (first_response_at - assigned_at)) / 60) as avg_response_time,
      AVG(EXTRACT(EPOCH FROM (resolved_at - assigned_at)) / 60) as avg_resolution_time,

      -- Quality
      AVG(satisfaction_rating) FILTER (WHERE satisfaction_rating IS NOT NULL) as avg_satisfaction,
      COUNT(*) FILTER (WHERE satisfaction_rating >= 4) as positive_ratings,
      COUNT(*) FILTER (WHERE satisfaction_rating <= 2) as negative_ratings,

      -- SLA
      COUNT(*) FILTER (WHERE response_sla_breached = true) as sla_breaches,
      COUNT(*) FILTER (WHERE first_response_at < sla_response_due) as sla_met,

      -- Efficiency
      COUNT(*) FILTER (WHERE status = 'closed' AND
        EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600 < 24) as same_day_resolutions

    FROM platform_support_tickets
    WHERE assigned_to = ${agentId}
      AND created_at BETWEEN ${startDate} AND ${endDate}
  `;

  return performance[0];
}
```

### 15.3 Ticket Trends Report

```typescript
async function getTicketTrends(days: number = 30) {
  const trends = await prisma.$queryRaw`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as tickets_created,
      COUNT(*) FILTER (WHERE status = 'closed') as tickets_closed,
      AVG(satisfaction_rating) as avg_satisfaction
    FROM platform_support_tickets
    WHERE created_at > NOW() - INTERVAL '${days} days'
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `;

  return trends;
}
```

---

## 16. Integration Points

### 16.1 Integration with Analytics (PRD-0004)

**Feed Support Data to Analytics:**
```typescript
// Track support metrics for analytics
async function trackSupportMetrics(ticketId: string) {
  const ticket = await prisma.platform_support_tickets.findUnique({
    where: { id: ticketId }
  });

  // Send to analytics aggregation
  await analyticsQueue.add('track-support-metric', {
    metric_type: 'support_ticket',
    tenant_id: ticket.tenant_id,
    metric_data: {
      ticket_id: ticketId,
      category: ticket.category,
      priority: ticket.priority,
      status: ticket.status,
      resolution_time_minutes: ticket.resolved_at
        ? (ticket.resolved_at.getTime() - ticket.created_at.getTime()) / (1000 * 60)
        : null,
      satisfaction_rating: ticket.satisfaction_rating
    }
  });
}
```

### 16.2 Integration with Billing (PRD-0003)

**Link Support Tickets to Billing Issues:**
```typescript
async function linkTicketToBillingIssue(ticketId: string, invoiceId: string) {
  await prisma.platform_support_tickets.update({
    where: { id: ticketId },
    data: {
      custom_fields: {
        related_invoice_id: invoiceId,
        billing_issue: true
      }
    }
  });

  // If critical billing issue, prioritize
  await prisma.platform_support_tickets.update({
    where: { id: ticketId },
    data: {
      priority: 'high',
      tags: {
        push: 'billing_issue'
      }
    }
  });
}
```

### 16.3 Integration with Tenant Lifecycle (PRD-0002)

**Auto-Create Onboarding Tickets:**
```typescript
async function createOnboardingTickets(tenantId: string) {
  const tenant = await prisma.org_tenants_mst.findUnique({
    where: { id: tenantId }
  });

  // Create welcome/onboarding ticket
  const ticket = await prisma.platform_support_tickets.create({
    data: {
      ticket_number: await generateTicketNumber(),
      tenant_id: tenantId,
      requester_email: tenant.email,
      requester_name: tenant.name,
      subject: `Welcome to CleanMateX - Onboarding Assistance`,
      description: `Welcome! We're here to help you get started. This ticket will track your onboarding journey.`,
      category: 'training',
      priority: 'medium',
      status: 'open',
      source: 'system',
      tags: ['onboarding', 'welcome']
    }
  });

  // Assign to onboarding specialist
  await assignToOnboardingTeam(ticket.id);

  return ticket;
}
```

---

## 17. Security & Access Control

### 17.1 Role-Based Permissions

**Support Role Permissions:**
```typescript
enum SupportPermission {
  // Ticket permissions
  VIEW_TICKETS = 'support:tickets:view',
  CREATE_TICKETS = 'support:tickets:create',
  UPDATE_TICKETS = 'support:tickets:update',
  DELETE_TICKETS = 'support:tickets:delete',
  ASSIGN_TICKETS = 'support:tickets:assign',
  CLOSE_TICKETS = 'support:tickets:close',

  // Internal notes
  VIEW_INTERNAL_NOTES = 'support:notes:view',
  CREATE_INTERNAL_NOTES = 'support:notes:create',

  // Knowledge base
  VIEW_KB = 'support:kb:view',
  CREATE_KB = 'support:kb:create',
  EDIT_KB = 'support:kb:edit',
  PUBLISH_KB = 'support:kb:publish',

  // Impersonation
  IMPERSONATE_TENANTS = 'support:impersonate',

  // Reports
  VIEW_REPORTS = 'support:reports:view',
  EXPORT_DATA = 'support:reports:export',

  // Configuration
  MANAGE_SLA = 'support:sla:manage',
  MANAGE_CATEGORIES = 'support:categories:manage',
  MANAGE_CANNED_RESPONSES = 'support:canned:manage'
}

interface SupportRole {
  name: string;
  permissions: SupportPermission[];
}

const supportRoles: Record<string, SupportRole> = {
  support_agent: {
    name: 'Support Agent',
    permissions: [
      SupportPermission.VIEW_TICKETS,
      SupportPermission.CREATE_TICKETS,
      SupportPermission.UPDATE_TICKETS,
      SupportPermission.VIEW_INTERNAL_NOTES,
      SupportPermission.CREATE_INTERNAL_NOTES,
      SupportPermission.VIEW_KB,
      SupportPermission.CLOSE_TICKETS
    ]
  },
  support_manager: {
    name: 'Support Manager',
    permissions: [
      ...supportRoles.support_agent.permissions,
      SupportPermission.ASSIGN_TICKETS,
      SupportPermission.DELETE_TICKETS,
      SupportPermission.IMPERSONATE_TENANTS,
      SupportPermission.VIEW_REPORTS,
      SupportPermission.EXPORT_DATA,
      SupportPermission.MANAGE_SLA
    ]
  },
  kb_editor: {
    name: 'Knowledge Base Editor',
    permissions: [
      SupportPermission.VIEW_KB,
      SupportPermission.CREATE_KB,
      SupportPermission.EDIT_KB,
      SupportPermission.PUBLISH_KB
    ]
  }
};
```

### 17.2 Data Privacy

**Anonymize Ticket Data for Analytics:**
```typescript
function anonymizeTicketForAnalytics(ticket: any): any {
  return {
    ticket_id: ticket.id,
    tenant_id: ticket.tenant_id,
    // Remove PII
    requester_name: null,
    requester_email: null,
    requester_phone: null,
    // Keep non-PII
    category: ticket.category,
    priority: ticket.priority,
    status: ticket.status,
    created_at: ticket.created_at,
    resolved_at: ticket.resolved_at,
    satisfaction_rating: ticket.satisfaction_rating
  };
}
```

---

## 18. Implementation Plan

### 18.1 Phase 1: Core Ticketing (Weeks 1-3)

**Week 1: Database & API**
- [ ] Create database tables (tickets, messages, categories)
- [ ] Build ticket CRUD APIs
- [ ] Implement SLA calculation logic
- [ ] Set up email parsing service

**Week 2: Agent Dashboard**
- [ ] Build support dashboard UI
- [ ] Implement ticket list view
- [ ] Create ticket detail view
- [ ] Add message/reply functionality

**Week 3: Assignment & Routing**
- [ ] Implement auto-assignment logic
- [ ] Build manual assignment UI
- [ ] Create SLA monitoring
- [ ] Add email notifications

### 18.2 Phase 2: Knowledge Base (Weeks 4-5)

**Week 4: KB Admin**
- [ ] Create KB article tables
- [ ] Build article editor
- [ ] Implement categories
- [ ] Add full-text search

**Week 5: KB Customer Portal**
- [ ] Build customer-facing KB
- [ ] Implement search UI
- [ ] Add article ratings
- [ ] Track analytics

### 18.3 Phase 3: Advanced Features (Weeks 6-8)

**Week 6: Impersonation & Automation**
- [ ] Implement impersonation system
- [ ] Build audit logging
- [ ] Create auto-categorization
- [ ] Add canned responses

**Week 7: Satisfaction & Reporting**
- [ ] Build CSAT survey system
- [ ] Create satisfaction tracking
- [ ] Implement support reports
- [ ] Add agent performance dashboard

**Week 8: Polish & Testing**
- [ ] Integration testing
- [ ] Performance optimization
- [ ] Security audit
- [ ] Documentation

---

## 19. Testing Strategy

### 19.1 Unit Tests

**Test SLA Calculation:**
```typescript
describe('SLA Calculation', () => {
  it('should calculate response SLA correctly', () => {
    const createdAt = new Date('2025-01-14T10:00:00Z');
    const policy = {
      response_time_minutes: 120, // 2 hours
      business_hours_only: false
    };

    const deadline = calculateSLADeadline(createdAt, policy.response_time_minutes, policy);
    expect(deadline).toEqual(new Date('2025-01-14T12:00:00Z'));
  });

  it('should respect business hours', () => {
    const createdAt = new Date('2025-01-14T16:00:00Z'); // 4 PM
    const policy = {
      response_time_minutes: 120, // 2 hours
      business_hours_only: true,
      working_days: [1, 2, 3, 4, 5], // Mon-Fri
      business_hours_start: 8,
      business_hours_end: 17 // 5 PM
    };

    const deadline = calculateSLADeadline(createdAt, policy.response_time_minutes, policy);
    // Should be next day at 9 AM (1 hour remaining)
    expect(deadline.getHours()).toBe(9);
  });
});
```

### 19.2 Integration Tests

**Test Ticket Creation Flow:**
```typescript
describe('Ticket Creation', () => {
  it('should create ticket via email', async () => {
    const rawEmail = `
      From: ahmed@luxurylaundry.com
      Subject: Payment not working
      Date: Mon, 14 Jan 2025 10:30:00 +0400

      I can't process payments. Getting error ERR_502.
    `;

    const ticket = await processInboundEmail(rawEmail);

    expect(ticket).toBeDefined();
    expect(ticket.subject).toBe('Payment not working');
    expect(ticket.status).toBe('new');
    expect(ticket.sla_response_due).toBeDefined();
  });
});
```

### 19.3 E2E Tests

**Test Complete Support Flow:**
```typescript
describe('Support Flow E2E', () => {
  it('should handle complete ticket lifecycle', async () => {
    // 1. Customer creates ticket
    const ticket = await createTicket({
      tenant_id: testTenantId,
      subject: 'Test issue',
      description: 'This is a test',
      priority: 'medium'
    });

    expect(ticket.status).toBe('new');

    // 2. Agent is auto-assigned
    await wait(100); // Allow auto-assignment worker
    const assigned = await getTicket(ticket.id);
    expect(assigned.assigned_to).toBeDefined();
    expect(assigned.status).toBe('open');

    // 3. Agent replies
    await addMessage(ticket.id, {
      message_body: 'We are looking into this.',
      sender_type: 'agent'
    });

    // 4. Customer replies
    await addMessage(ticket.id, {
      message_body: 'Thank you!',
      sender_type: 'customer'
    });

    // 5. Agent resolves
    await updateTicket(ticket.id, { status: 'resolved' });
    const resolved = await getTicket(ticket.id);
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolved_at).toBeDefined();

    // 6. Auto-close after 3 days (simulate)
    await simulateTimePassing(3 * 24 * 60 * 60 * 1000);
    await autoCloseResolvedTickets();

    const closed = await getTicket(ticket.id);
    expect(closed.status).toBe('closed');
  });
});
```

---

## 20. Future Enhancements

### 20.1 AI-Powered Features (Phase 2)

**Auto-Suggest KB Articles:**
- Use ML to match ticket description with relevant KB articles
- Auto-suggest to agent before they reply
- Learn from agent selections

**Smart Categorization:**
- Train model on historical tickets
- Predict category, priority, and team
- Improve over time with feedback

**Sentiment Analysis:**
- Detect customer frustration in messages
- Flag tickets requiring special attention
- Alert managers to unhappy customers

### 20.2 Advanced Collaboration (Phase 2)

**Team Inbox:**
- Shared team queues
- Collision detection (multiple agents viewing same ticket)
- Internal chat per ticket
- @mentions and notifications

**Ticket Workflow Automation:**
- Visual workflow builder
- Complex branching logic
- Time-based triggers
- Integration with external systems

### 20.3 Customer Self-Service (Phase 3)

**AI Chatbot:**
- Answer common questions
- Guide to KB articles
- Escalate to human when needed
- Learn from interactions

**Community Forum:**
- Peer-to-peer support
- Upvoting solutions
- Expert badges
- Gamification

---

## Related PRDs

- **[PRD-SAAS-MNG-0001](PRD-SAAS-MNG-0001_Platform_HQ_Console.md)** - Platform HQ Console (Master)
- **[PRD-SAAS-MNG-0002](PRD-SAAS-MNG-0002_Tenant_Lifecycle.md)** - Tenant Lifecycle Management
- **[PRD-SAAS-MNG-0003](PRD-SAAS-MNG-0003_Billing_Subscriptions.md)** - Billing & Subscription Management
- **[PRD-SAAS-MNG-0004](PRD-SAAS-MNG-0004_Analytics_Reporting.md)** - Analytics & Reporting
- **[PRD-SAAS-MNG-0008](PRD-SAAS-MNG-0008_Customer_Master_Data.md)** - Customer Master Data Management

---

## Glossary

- **CSAT**: Customer Satisfaction Score - Rating scale (typically 1-5)
- **NPS**: Net Promoter Score - Metric measuring customer loyalty (-100 to +100)
- **SLA**: Service Level Agreement - Contractual response/resolution time commitments
- **First Response Time**: Time between ticket creation and first agent response
- **Resolution Time**: Time between ticket creation and resolution
- **Ticket Lifecycle**: Complete journey from creation to closure
- **Impersonation**: Admin viewing tenant dashboard as that tenant for troubleshooting
- **Canned Response**: Pre-written template response for common issues
- **Knowledge Base (KB)**: Repository of help articles and documentation

---

**End of PRD-SAAS-MNG-0005: Support & Ticketing System**

---

**Document Status**: Draft v0.1.0
**Next Review**: After implementation of Phase 1
**Approved By**: Pending
**Implementation Start**: TBD

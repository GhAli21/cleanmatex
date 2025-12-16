---
prd_code: PRD-SAAS-MNG-0007
title: Workflow Engine Management
version: v0.1.0
last_updated: 2025-01-14
author: Gehad Abdo Mohammed Ali
status: Planning
priority: High
category: Platform Management - Workflows
related_prds:
  - PRD-SAAS-MNG-0001 (Platform HQ Console)
  - PRD-SAAS-MNG-0002 (Tenant Lifecycle)
  - PRD-SAAS-MNG-0006 (Core Data & Code Management)
  - PRD-SAAS-MNG-0010 (Platform Configuration)
---

# PRD-SAAS-MNG-0007: Workflow Engine Management

## Executive Summary

The **Workflow Engine Management** system is the intelligent automation backbone of CleanMateX that orchestrates order processing workflows, defines business rules, and enables tenant-specific customization of operational processes. This engine allows platform administrators to configure, monitor, and optimize workflows while giving tenants the flexibility to adapt processes to their unique business needs.

### Problem Statement

Platform administrators and tenants currently lack:
- ❌ **Flexible workflow configuration** for different service types
- ❌ **Visual workflow designer** for non-technical users
- ❌ **Conditional routing** based on business rules
- ❌ **Workflow versioning** and A/B testing
- ❌ **Real-time workflow monitoring** and bottleneck detection
- ❌ **Automated actions** based on workflow events
- ❌ **Multi-branch workflow** coordination
- ❌ **Performance analytics** per workflow step

### Solution Overview

Build a **comprehensive workflow engine** that:
- ✅ Provides configurable workflows for all service categories
- ✅ Enables visual workflow design and modification
- ✅ Supports conditional branching and parallel processing
- ✅ Tracks workflow execution in real-time
- ✅ Automates actions based on workflow events
- ✅ Allows tenant-specific workflow customization
- ✅ Monitors performance and identifies bottlenecks
- ✅ Supports workflow versioning and rollback

### Business Value

**For Platform Administrators:**
- Define standard workflows for all tenants
- Monitor workflow performance across platform
- Identify optimization opportunities
- Deploy workflow improvements globally

**For Tenants:**
- Customize workflows to match their operations
- Skip unnecessary steps for efficiency
- Add custom quality gates
- Optimize turnaround times

**For Operations:**
- Clear visibility into order processing stages
- Automated status updates and notifications
- Reduced manual intervention
- Faster issue resolution

---

## Table of Contents

1. [Scope & Objectives](#1-scope--objectives)
2. [Workflow Concepts](#2-workflow-concepts)
3. [Workflow Architecture](#3-workflow-architecture)
4. [Database Schema](#4-database-schema)
5. [Workflow Designer](#5-workflow-designer)
6. [Workflow Execution](#6-workflow-execution)
7. [Conditional Logic](#7-conditional-logic)
8. [Parallel Processing](#8-parallel-processing)
9. [Workflow Templates](#9-workflow-templates)
10. [Tenant Customization](#10-tenant-customization)
11. [Automation & Actions](#11-automation--actions)
12. [Monitoring & Analytics](#12-monitoring--analytics)
13. [API Specifications](#13-api-specifications)
14. [UI/UX Design](#14-uiux-design)
15. [Performance Optimization](#15-performance-optimization)
16. [Integration Points](#16-integration-points)
17. [Implementation Plan](#17-implementation-plan)
18. [Testing Strategy](#18-testing-strategy)
19. [Future Enhancements](#19-future-enhancements)

---

## 1. Scope & Objectives

### 1.1 In Scope

**Workflow Management:**
- Visual workflow designer (drag-and-drop)
- Workflow templates for common scenarios
- Workflow versioning and history
- Tenant-specific workflow overrides
- Workflow validation and testing
- Import/export workflows (JSON)

**Workflow Execution:**
- Real-time workflow tracking
- Conditional branching
- Parallel step execution
- Automatic state transitions
- Manual intervention points
- Error handling and retry logic

**Workflow Features:**
- Time-based transitions (SLA)
- Quality gates and approvals
- Notifications and alerts
- Automated actions (webhooks, emails)
- Integration triggers
- Custom business rules

**Analytics & Monitoring:**
- Workflow performance metrics
- Bottleneck detection
- Step completion times
- Success/failure rates
- Tenant comparison analytics

### 1.2 Out of Scope

- ❌ Complex BPM/BPMN 2.0 implementation (future phase)
- ❌ External workflow engine integration (Camunda, etc.)
- ❌ AI-based workflow optimization (future - PRD-0014)
- ❌ Multi-tenant shared workflows (each tenant isolated)

### 1.3 Success Criteria

**Workflow Performance:**
- Workflow execution latency < 100ms per step
- Support for workflows with 50+ steps
- Handle 10,000+ concurrent workflow executions
- Zero data loss during workflow transitions

**User Experience:**
- Non-technical users can create workflows
- Workflow changes deploy in < 5 minutes
- 95% of workflows complete without errors
- < 2% workflow rollback rate

**Business Impact:**
- 30% reduction in manual interventions
- 20% improvement in turnaround time
- 90% workflow automation coverage
- < 1% workflow bottleneck rate

---

## 2. Workflow Concepts

### 2.1 Workflow Components

**Workflow Definition:**
```typescript
interface Workflow {
  id: string;
  name: string;
  description: string;
  version: number;
  steps: WorkflowStep[];
  transitions: WorkflowTransition[];
  metadata: WorkflowMetadata;
}
```

**Workflow Step:**
```typescript
interface WorkflowStep {
  id: string;
  code: string;                      // e.g., 'WASHING', 'QA'
  name: string;
  type: StepType;                    // 'manual', 'automatic', 'approval', 'integration'
  position: { x: number; y: number }; // For visual designer
  config: StepConfiguration;
  validation: ValidationRules;
}

enum StepType {
  MANUAL = 'manual',                 // Requires manual action
  AUTOMATIC = 'automatic',           // Auto-transition
  APPROVAL = 'approval',             // Requires approval
  INTEGRATION = 'integration',       // Calls external system
  PARALLEL_GATEWAY = 'parallel_gateway',
  EXCLUSIVE_GATEWAY = 'exclusive_gateway'
}
```

**Workflow Transition:**
```typescript
interface WorkflowTransition {
  id: string;
  from_step_id: string;
  to_step_id: string;
  condition?: Condition;             // Optional conditional logic
  priority: number;
  is_default: boolean;
}

interface Condition {
  type: 'simple' | 'complex';
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains';
  value: any;
  logical_operator?: 'AND' | 'OR';   // For complex conditions
  sub_conditions?: Condition[];
}
```

### 2.2 Workflow Types

**Standard Workflows:**
- **Wash & Iron**: Full process from intake to delivery
- **Dry Cleaning**: Specialized dry cleaning process
- **Iron Only**: Skip washing, direct to finishing
- **Alterations**: Custom alteration workflow
- **Express Service**: Fast-track workflow with reduced steps

**Workflow Variations:**
- **Multi-branch**: Coordinate across multiple branches
- **Quality-focused**: Additional QA checkpoints
- **Economy**: Minimal steps for cost efficiency
- **Premium**: Extra care and attention steps

### 2.3 Workflow States

**Order Workflow State:**
```typescript
interface OrderWorkflowState {
  order_id: string;
  workflow_id: string;
  workflow_version: number;
  current_step_id: string;
  current_status: string;
  started_at: Date;
  estimated_completion: Date;
  actual_completion?: Date;

  // Tracking
  completed_steps: string[];
  pending_steps: string[];
  blocked_steps: string[];

  // Performance
  step_durations: Record<string, number>;
  total_duration?: number;

  // Issues
  errors: WorkflowError[];
  warnings: WorkflowWarning[];
}
```

---

## 3. Workflow Architecture

### 3.1 System Architecture

```
┌─────────────────────────────────────────────────────────┐
│              WORKFLOW ENGINE ARCHITECTURE                │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  WORKFLOW DESIGNER (UI)                                  │
│  - Visual workflow builder                               │
│  - Template library                                      │
│  - Validation & testing                                  │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  WORKFLOW MANAGEMENT API                                 │
│  - CRUD workflows                                        │
│  - Version control                                       │
│  - Deployment                                            │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  WORKFLOW ENGINE (Core)                                  │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Workflow Executor                              │    │
│  │  - State machine                                │    │
│  │  - Transition logic                             │    │
│  │  - Condition evaluation                         │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Action Executor                                │    │
│  │  - Notifications                                │    │
│  │  - Webhooks                                     │    │
│  │  - Integrations                                 │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │  Rule Engine                                    │    │
│  │  - Condition evaluation                         │    │
│  │  - Business rules                               │    │
│  │  - Validation                                   │    │
│  └─────────────────────────────────────────────────┘    │
└────────────────┬────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────┐
│  STORAGE LAYER                                           │
│  - Workflow definitions (PostgreSQL)                     │
│  - Execution state (PostgreSQL + Redis)                  │
│  - Audit logs (PostgreSQL)                              │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Execution Flow

```
Order Created
     │
     ▼
Load Workflow Definition
     │
     ▼
Initialize Workflow State
     │
     ▼
┌────────────────────────┐
│  Execute Current Step  │
└────────┬───────────────┘
         │
         ├──► Manual Step ──► Wait for User Action
         │
         ├──► Automatic Step ──► Execute Actions ──► Auto-transition
         │
         ├──► Approval Step ──► Wait for Approval
         │
         └──► Integration Step ──► Call External API
                 │
                 ▼
         Evaluate Conditions
                 │
                 ▼
         Select Next Step(s)
                 │
                 ├──► Single Next Step ──► Update State
                 │
                 ├──► Parallel Steps ──► Create Sub-executions
                 │
                 └──► Conditional Branch ──► Evaluate & Route
                         │
                         ▼
                 Update Workflow State
                         │
                         ▼
                 Trigger Actions
                         │
                         ▼
                 Log Transition
                         │
                         ▼
            ┌────────────┴────────────┐
            │                         │
            ▼                         ▼
    More Steps?                  Workflow Complete
            │
            └──► Loop to Execute Current Step
```

---

## 4. Database Schema

### 4.1 Core Workflow Tables

**Table: sys_workflow_templates_mst**
```sql
CREATE TABLE sys_workflow_templates_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template details
  template_code VARCHAR(50) UNIQUE NOT NULL,
  template_name VARCHAR(250) NOT NULL,
  template_name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,

  -- Template category
  service_category_code VARCHAR(50) REFERENCES sys_service_category_cd(code),
  workflow_type VARCHAR(50) NOT NULL, -- 'standard', 'express', 'economy', 'premium'

  -- Version
  version INTEGER DEFAULT 1,
  is_latest_version BOOLEAN DEFAULT true,
  parent_template_id UUID REFERENCES sys_workflow_templates_mst(id),

  -- Workflow definition (JSON structure)
  workflow_definition JSONB NOT NULL,
  /*
    Example:
    {
      "steps": [
        {
          "id": "step_1",
          "code": "INTAKE",
          "name": "Customer Intake",
          "type": "manual",
          "position": {"x": 100, "y": 100},
          "config": {
            "sla_hours": 1,
            "requires_photo": true,
            "auto_notify": true
          }
        }
      ],
      "transitions": [
        {
          "id": "trans_1",
          "from_step_id": "step_1",
          "to_step_id": "step_2",
          "condition": null,
          "is_default": true
        }
      ]
    }
  */

  -- Configuration
  estimated_duration_hours INTEGER,
  requires_approval BOOLEAN DEFAULT false,
  supports_parallel BOOLEAN DEFAULT false,

  -- Display
  icon VARCHAR(100),
  color VARCHAR(60),
  display_order INTEGER DEFAULT 0,

  -- Availability
  is_system BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  is_published BOOLEAN DEFAULT false,

  -- Usage stats
  usage_count INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2),
  avg_completion_hours DECIMAL(10,2),

  -- Metadata
  metadata JSONB,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  published_at TIMESTAMP,
  published_by UUID,
  rec_status SMALLINT DEFAULT 1
);

CREATE INDEX idx_workflow_tpl_code ON sys_workflow_templates_mst(template_code);
CREATE INDEX idx_workflow_tpl_category ON sys_workflow_templates_mst(service_category_code);
CREATE INDEX idx_workflow_tpl_version ON sys_workflow_templates_mst(template_code, version DESC);
CREATE INDEX idx_workflow_tpl_published ON sys_workflow_templates_mst(is_published, is_active);
```

**Table: org_workflow_configurations**
```sql
CREATE TABLE org_workflow_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,

  -- Base template
  template_id UUID NOT NULL REFERENCES sys_workflow_templates_mst(id),
  template_version INTEGER NOT NULL,

  -- Tenant customization
  custom_name VARCHAR(250),
  custom_name2 VARCHAR(250),

  -- Workflow overrides (JSONB delta from template)
  workflow_overrides JSONB,
  /*
    Example:
    {
      "removed_steps": ["step_3"],
      "added_steps": [
        {
          "id": "custom_step_1",
          "code": "CUSTOM_QA",
          "name": "Custom Quality Check",
          "type": "manual"
        }
      ],
      "modified_steps": [
        {
          "id": "step_2",
          "config": {
            "sla_hours": 3
          }
        }
      ],
      "added_transitions": [],
      "removed_transitions": []
    }
  */

  -- Compiled workflow (template + overrides)
  compiled_workflow JSONB NOT NULL,

  -- Settings
  is_enabled BOOLEAN DEFAULT true,
  is_default_for_category BOOLEAN DEFAULT false,

  -- Performance
  avg_completion_hours DECIMAL(10,2),
  total_executions INTEGER DEFAULT 0,
  successful_executions INTEGER DEFAULT 0,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  is_active BOOLEAN DEFAULT true,

  CONSTRAINT unique_tenant_workflow UNIQUE (tenant_org_id, template_id)
);

CREATE INDEX idx_workflow_cfg_tenant ON org_workflow_configurations(tenant_org_id, is_active);
CREATE INDEX idx_workflow_cfg_template ON org_workflow_configurations(template_id);
```

**Table: org_workflow_executions**
```sql
CREATE TABLE org_workflow_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),

  -- Related entity
  order_id UUID NOT NULL REFERENCES org_orders_mst(id) ON DELETE CASCADE,

  -- Workflow details
  workflow_config_id UUID NOT NULL REFERENCES org_workflow_configurations(id),
  workflow_version INTEGER NOT NULL,
  workflow_snapshot JSONB NOT NULL,  -- Snapshot of workflow at execution time

  -- Current state
  current_step_id VARCHAR(50) NOT NULL,
  current_status VARCHAR(50) NOT NULL,

  -- Execution tracking
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  estimated_completion_at TIMESTAMP,
  completed_at TIMESTAMP,
  paused_at TIMESTAMP,
  resumed_at TIMESTAMP,

  -- Progress
  total_steps INTEGER NOT NULL,
  completed_steps INTEGER DEFAULT 0,
  skipped_steps INTEGER DEFAULT 0,
  failed_steps INTEGER DEFAULT 0,

  -- Performance
  total_duration_seconds INTEGER,
  step_durations JSONB,
  /*
    Example:
    {
      "INTAKE": 3600,
      "WASHING": 7200,
      "DRYING": 5400
    }
  */

  -- Tracking
  completed_step_ids TEXT[],
  pending_step_ids TEXT[],
  blocked_step_ids TEXT[],

  -- Issues
  has_errors BOOLEAN DEFAULT false,
  error_count INTEGER DEFAULT 0,
  errors JSONB,

  -- Flags
  is_completed BOOLEAN DEFAULT false,
  is_paused BOOLEAN DEFAULT false,
  is_cancelled BOOLEAN DEFAULT false,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX idx_exec_order ON org_workflow_executions(order_id);
CREATE INDEX idx_exec_tenant ON org_workflow_executions(tenant_org_id, started_at DESC);
CREATE INDEX idx_exec_status ON org_workflow_executions(current_status, is_completed);
CREATE INDEX idx_exec_workflow ON org_workflow_executions(workflow_config_id);
```

**Table: org_workflow_step_executions**
```sql
CREATE TABLE org_workflow_step_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Parent execution
  workflow_execution_id UUID NOT NULL REFERENCES org_workflow_executions(id) ON DELETE CASCADE,
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),

  -- Step details
  step_id VARCHAR(50) NOT NULL,
  step_code VARCHAR(50) NOT NULL,
  step_name VARCHAR(250) NOT NULL,
  step_type VARCHAR(20) NOT NULL,

  -- Execution
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR(20) NOT NULL,        -- 'pending', 'in_progress', 'completed', 'failed', 'skipped'

  -- Actor
  assigned_to UUID,
  completed_by UUID,

  -- Duration
  duration_seconds INTEGER,
  sla_hours INTEGER,
  sla_due_at TIMESTAMP,
  is_sla_breached BOOLEAN DEFAULT false,

  -- Step data
  input_data JSONB,
  output_data JSONB,

  -- Actions performed
  actions_executed JSONB,
  /*
    Example:
    [
      {
        "action": "send_notification",
        "timestamp": "2025-01-14T10:30:00Z",
        "status": "success"
      },
      {
        "action": "update_inventory",
        "timestamp": "2025-01-14T10:31:00Z",
        "status": "success"
      }
    ]
  */

  -- Errors
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP
);

CREATE INDEX idx_step_exec_workflow ON org_workflow_step_executions(workflow_execution_id, started_at);
CREATE INDEX idx_step_exec_status ON org_workflow_step_executions(status, started_at DESC);
CREATE INDEX idx_step_exec_assigned ON org_workflow_step_executions(assigned_to, status);
CREATE INDEX idx_step_exec_sla ON org_workflow_step_executions(sla_due_at) WHERE is_sla_breached = false;
```

**Table: org_workflow_transitions_log**
```sql
CREATE TABLE org_workflow_transitions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Execution context
  workflow_execution_id UUID NOT NULL REFERENCES org_workflow_executions(id) ON DELETE CASCADE,
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),

  -- Transition details
  from_step_id VARCHAR(50),
  to_step_id VARCHAR(50) NOT NULL,
  transition_id VARCHAR(50),

  -- Condition evaluation
  condition_evaluated JSONB,
  condition_result BOOLEAN,

  -- Trigger
  triggered_by VARCHAR(20) NOT NULL, -- 'automatic', 'manual', 'scheduled', 'api'
  triggered_by_user_id UUID,

  -- Timestamp
  transitioned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Metadata
  metadata JSONB
);

CREATE INDEX idx_trans_log_workflow ON org_workflow_transitions_log(workflow_execution_id, transitioned_at);
CREATE INDEX idx_trans_log_time ON org_workflow_transitions_log(transitioned_at DESC);
```

---

## 5. Workflow Designer

### 5.1 Visual Designer UI

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  Workflow Designer: Wash & Iron Standard    [Save] [Test]  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐                                            │
│  │ PALETTE     │  ┌──────────────────────────────────────┐ │
│  ├─────────────┤  │  CANVAS                              │ │
│  │             │  │                                      │ │
│  │ Steps:      │  │   ┌────────┐                        │ │
│  │ □ Manual    │  │   │ INTAKE │                        │ │
│  │ □ Automatic │  │   └───┬────┘                        │ │
│  │ □ Approval  │  │       │                             │ │
│  │ □ Gateway   │  │       ▼                             │ │
│  │             │  │   ┌─────────┐     ┌──────────┐     │ │
│  │ Actions:    │  │   │ SORTING │ ──► │ WASHING  │     │ │
│  │ □ Notify    │  │   └─────────┘     └────┬─────┘     │ │
│  │ □ Webhook   │  │                        │            │ │
│  │ □ Email     │  │                        ▼            │ │
│  │             │  │                    ┌────────┐       │ │
│  │ Gateways:   │  │                    │ DRYING │       │ │
│  │ ◇ Decision  │  │                    └───┬────┘       │ │
│  │ ⬥ Parallel  │  │                        │            │ │
│  │             │  │                        ▼            │ │
│  └─────────────┘  │                    ┌───────┐        │ │
│                    │                    │  QA   │        │ │
│                    │                    └───┬───┘        │ │
│                    │                        │            │ │
│                    │                   Pass │ Fail      │ │
│                    │                        ▼    ▼       │ │
│                    │                    ┌───────┐        │ │
│                    │                    │ READY │        │ │
│                    │                    └───────┘        │ │
│                    └──────────────────────────────────────┘ │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ PROPERTIES: WASHING Step                             │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Name: Washing                                        │  │
│  │ Type: Manual                                         │  │
│  │ SLA: [24] hours                                      │  │
│  │ ☑ Requires photo                                    │  │
│  │ ☑ Send notification on complete                     │  │
│  │ Assigned to: [Washing Team ▼]                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Step Configuration

**Step Types:**

1. **Manual Step**
   - Requires human action
   - Can be assigned to specific users/teams
   - Supports file attachments
   - Configurable SLA

2. **Automatic Step**
   - Auto-transitions based on conditions
   - Can trigger actions
   - No human intervention
   - Immediate execution

3. **Approval Step**
   - Requires explicit approval
   - Supports multi-level approvals
   - Configurable approvers
   - Timeout with default action

4. **Integration Step**
   - Calls external API
   - Processes response
   - Retry logic on failure
   - Timeout configuration

5. **Parallel Gateway**
   - Splits into multiple parallel paths
   - Continues when all paths complete
   - Or continues when any path completes

6. **Exclusive Gateway (Decision)**
   - Routes based on conditions
   - Single path selected
   - Default path for no match

### 5.3 Transition Configuration

**Transition Properties:**
```typescript
interface TransitionConfig {
  // Basic
  from_step: string;
  to_step: string;
  label?: string;                    // Display on UI

  // Condition (optional)
  condition?: {
    type: 'simple' | 'complex';
    expression: string;              // e.g., "order.priority === 'high'"
    fields: Array<{
      field: string;
      operator: string;
      value: any;
    }>;
  };

  // Behavior
  is_default: boolean;               // Default path if no conditions match
  priority: number;                  // Order of evaluation
  can_rollback: boolean;             // Allow going backwards

  // Actions on transition
  actions?: Action[];
}
```

---

## 6. Workflow Execution

### 6.1 Execution Engine

**Start Workflow Execution:**
```typescript
async function startWorkflowExecution(
  orderId: string,
  tenantId: string
): Promise<WorkflowExecution> {
  // Get order details
  const order = await prisma.org_orders_mst.findUnique({
    where: { id: orderId },
    include: { items: true }
  });

  // Determine workflow based on service category
  const workflowConfig = await getWorkflowForOrder(tenantId, order);

  // Create execution record
  const execution = await prisma.org_workflow_executions.create({
    data: {
      tenant_org_id: tenantId,
      order_id: orderId,
      workflow_config_id: workflowConfig.id,
      workflow_version: workflowConfig.template_version,
      workflow_snapshot: workflowConfig.compiled_workflow,
      current_step_id: getInitialStep(workflowConfig),
      current_status: 'DRAFT',
      total_steps: countSteps(workflowConfig),
      estimated_completion_at: calculateEstimatedCompletion(workflowConfig)
    }
  });

  // Execute first step
  await executeStep(execution.id, getInitialStep(workflowConfig));

  // Emit event
  await emitWorkflowEvent('workflow.started', {
    execution_id: execution.id,
    order_id: orderId,
    workflow_id: workflowConfig.id
  });

  return execution;
}
```

**Execute Workflow Step:**
```typescript
async function executeStep(
  executionId: string,
  stepId: string
): Promise<void> {
  const execution = await getWorkflowExecution(executionId);
  const workflow = execution.workflow_snapshot;
  const step = workflow.steps.find(s => s.id === stepId);

  if (!step) {
    throw new Error(`Step ${stepId} not found`);
  }

  // Create step execution record
  const stepExecution = await prisma.org_workflow_step_executions.create({
    data: {
      workflow_execution_id: executionId,
      tenant_org_id: execution.tenant_org_id,
      step_id: step.id,
      step_code: step.code,
      step_name: step.name,
      step_type: step.type,
      status: 'in_progress',
      sla_hours: step.config?.sla_hours,
      sla_due_at: calculateSLADue(step.config?.sla_hours)
    }
  });

  // Execute based on step type
  switch (step.type) {
    case 'automatic':
      await executeAutomaticStep(step, stepExecution.id);
      break;

    case 'manual':
      await setupManualStep(step, stepExecution.id);
      break;

    case 'approval':
      await requestApproval(step, stepExecution.id);
      break;

    case 'integration':
      await callIntegration(step, stepExecution.id);
      break;
  }

  // Execute step actions
  if (step.config?.actions) {
    await executeActions(step.config.actions, {
      execution_id: executionId,
      step_id: stepId,
      order_id: execution.order_id
    });
  }

  // Emit event
  await emitWorkflowEvent('step.started', {
    execution_id: executionId,
    step_id: stepId,
    step_code: step.code
  });
}
```

**Complete Workflow Step:**
```typescript
async function completeStep(
  executionId: string,
  stepId: string,
  completedBy: string,
  outputData?: any
): Promise<void> {
  const execution = await getWorkflowExecution(executionId);
  const stepExecution = await getStepExecution(executionId, stepId);

  // Update step execution
  const completedAt = new Date();
  const duration = Math.floor(
    (completedAt.getTime() - stepExecution.started_at.getTime()) / 1000
  );

  await prisma.org_workflow_step_executions.update({
    where: { id: stepExecution.id },
    data: {
      status: 'completed',
      completed_at: completedAt,
      completed_by: completedBy,
      duration_seconds: duration,
      output_data: outputData
    }
  });

  // Update execution progress
  await prisma.org_workflow_executions.update({
    where: { id: executionId },
    data: {
      completed_steps: { increment: 1 },
      completed_step_ids: {
        push: stepId
      },
      step_durations: {
        ...execution.step_durations,
        [stepExecution.step_code]: duration
      }
    }
  });

  // Determine next step(s)
  const nextSteps = await determineNextSteps(execution, stepId, outputData);

  if (nextSteps.length === 0) {
    // Workflow complete
    await completeWorkflow(executionId);
  } else if (nextSteps.length === 1) {
    // Single next step
    await transitionToStep(executionId, stepId, nextSteps[0]);
  } else {
    // Multiple next steps (parallel execution)
    await createParallelExecutions(executionId, stepId, nextSteps);
  }

  // Emit event
  await emitWorkflowEvent('step.completed', {
    execution_id: executionId,
    step_id: stepId,
    duration_seconds: duration
  });
}
```

### 6.2 State Transitions

**Transition Logic:**
```typescript
async function transitionToStep(
  executionId: string,
  fromStepId: string,
  toStepId: string
): Promise<void> {
  const execution = await getWorkflowExecution(executionId);
  const workflow = execution.workflow_snapshot;

  // Find transition
  const transition = workflow.transitions.find(
    t => t.from_step_id === fromStepId && t.to_step_id === toStepId
  );

  // Log transition
  await prisma.org_workflow_transitions_log.create({
    data: {
      workflow_execution_id: executionId,
      tenant_org_id: execution.tenant_org_id,
      from_step_id: fromStepId,
      to_step_id: toStepId,
      transition_id: transition?.id,
      triggered_by: 'automatic'
    }
  });

  // Update execution current step
  await prisma.org_workflow_executions.update({
    where: { id: executionId },
    data: {
      current_step_id: toStepId,
      pending_step_ids: {
        set: [toStepId]
      },
      updated_at: new Date()
    }
  });

  // Update order status (sync with workflow)
  const toStep = workflow.steps.find(s => s.id === toStepId);
  if (toStep?.code) {
    await prisma.org_orders_mst.update({
      where: { id: execution.order_id },
      data: {
        status: toStep.code,
        updated_at: new Date()
      }
    });
  }

  // Execute next step
  await executeStep(executionId, toStepId);

  // Emit event
  await emitWorkflowEvent('workflow.transitioned', {
    execution_id: executionId,
    from_step: fromStepId,
    to_step: toStepId
  });
}
```

---

## 7. Conditional Logic

### 7.1 Condition Types

**Simple Conditions:**
```typescript
interface SimpleCondition {
  field: string;                     // e.g., "order.priority"
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'in';
  value: any;
}

// Example: Route express orders differently
{
  field: "order.is_express",
  operator: "equals",
  value: true
}
```

**Complex Conditions:**
```typescript
interface ComplexCondition {
  logical_operator: 'AND' | 'OR';
  conditions: Array<SimpleCondition | ComplexCondition>;
}

// Example: High priority or VIP customer
{
  logical_operator: "OR",
  conditions: [
    {
      field: "order.priority",
      operator: "equals",
      value: "high"
    },
    {
      field: "customer.is_vip",
      operator: "equals",
      value: true
    }
  ]
}
```

### 7.2 Condition Evaluation

**Evaluate Condition:**
```typescript
async function evaluateCondition(
  condition: Condition,
  context: {
    order: any;
    customer: any;
    tenant: any;
    execution: any;
  }
): Promise<boolean> {
  if (!condition) return true;

  if (condition.type === 'simple') {
    return evaluateSimpleCondition(condition as SimpleCondition, context);
  } else {
    return evaluateComplexCondition(condition as ComplexCondition, context);
  }
}

function evaluateSimpleCondition(
  condition: SimpleCondition,
  context: any
): boolean {
  // Get field value from context
  const fieldValue = getNestedValue(context, condition.field);

  // Evaluate based on operator
  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;

    case 'not_equals':
      return fieldValue !== condition.value;

    case 'greater_than':
      return fieldValue > condition.value;

    case 'less_than':
      return fieldValue < condition.value;

    case 'contains':
      return String(fieldValue).includes(condition.value);

    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(fieldValue);

    default:
      return false;
  }
}

function evaluateComplexCondition(
  condition: ComplexCondition,
  context: any
): boolean {
  const results = condition.conditions.map(c =>
    evaluateCondition(c, context)
  );

  if (condition.logical_operator === 'AND') {
    return results.every(r => r === true);
  } else {
    return results.some(r => r === true);
  }
}
```

### 7.3 Conditional Routing

**Determine Next Steps Based on Conditions:**
```typescript
async function determineNextSteps(
  execution: WorkflowExecution,
  currentStepId: string,
  stepOutput?: any
): Promise<string[]> {
  const workflow = execution.workflow_snapshot;
  const context = await buildExecutionContext(execution, stepOutput);

  // Get all transitions from current step
  const transitions = workflow.transitions
    .filter(t => t.from_step_id === currentStepId)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  // Evaluate conditions
  const nextSteps: string[] = [];

  for (const transition of transitions) {
    if (!transition.condition) {
      // No condition = always take this path
      if (transition.is_default) {
        nextSteps.push(transition.to_step_id);
      }
      continue;
    }

    // Evaluate condition
    const result = await evaluateCondition(transition.condition, context);

    if (result) {
      nextSteps.push(transition.to_step_id);

      // Check if this is an exclusive gateway (only one path)
      const currentStep = workflow.steps.find(s => s.id === currentStepId);
      if (currentStep?.type === 'exclusive_gateway') {
        break; // Take first matching path only
      }
    }
  }

  // If no conditions matched, take default path
  if (nextSteps.length === 0) {
    const defaultTransition = transitions.find(t => t.is_default);
    if (defaultTransition) {
      nextSteps.push(defaultTransition.to_step_id);
    }
  }

  return nextSteps;
}
```

---

## 8. Parallel Processing

### 8.1 Parallel Gateway

**Split into Parallel Paths:**
```typescript
async function createParallelExecutions(
  executionId: string,
  gatewayStepId: string,
  parallelSteps: string[]
): Promise<void> {
  const execution = await getWorkflowExecution(executionId);

  // Mark gateway as completed
  await completeStep(executionId, gatewayStepId, 'system');

  // Create parallel step executions
  for (const stepId of parallelSteps) {
    await executeStep(executionId, stepId);
  }

  // Update execution to track parallel branches
  await prisma.org_workflow_executions.update({
    where: { id: executionId },
    data: {
      pending_step_ids: parallelSteps,
      metadata: {
        ...execution.metadata,
        parallel_branches: {
          gateway_step: gatewayStepId,
          branches: parallelSteps,
          started_at: new Date()
        }
      }
    }
  });
}
```

**Join Parallel Paths:**
```typescript
async function checkParallelJoin(
  executionId: string,
  completedStepId: string
): Promise<boolean> {
  const execution = await getWorkflowExecution(executionId);
  const parallelInfo = execution.metadata?.parallel_branches;

  if (!parallelInfo) return false;

  // Check if all parallel branches completed
  const allBranchesComplete = parallelInfo.branches.every(
    branchStepId => execution.completed_step_ids.includes(branchStepId)
  );

  if (allBranchesComplete) {
    // All parallel paths complete, continue to next step
    await prisma.org_workflow_executions.update({
      where: { id: executionId },
      data: {
        metadata: {
          ...execution.metadata,
          parallel_branches: {
            ...parallelInfo,
            completed_at: new Date()
          }
        }
      }
    });

    return true;
  }

  return false;
}
```

### 8.2 Use Cases for Parallel Processing

**Example 1: Quality Checks**
- Wash and dry clothing (sequential)
- Then perform QA checks in parallel:
  - Visual inspection
  - Stain check
  - Count verification
- Continue when all checks pass

**Example 2: Multi-Branch Processing**
- Order split across branches
- Each branch processes their items
- Join when all branches complete
- Pack and deliver

**Example 3: Notifications**
- Main workflow continues
- Parallel notification tasks:
  - Send email
  - Send SMS
  - Update CRM
- Don't wait for notifications

---

## 9. Workflow Templates

### 9.1 Standard Templates

**Template: Wash & Iron (Standard)**
```json
{
  "template_code": "WASH_IRON_STANDARD",
  "template_name": "Wash & Iron - Standard",
  "workflow_definition": {
    "steps": [
      {
        "id": "step_1",
        "code": "INTAKE",
        "name": "Customer Intake",
        "type": "manual",
        "config": {
          "sla_hours": 1,
          "requires_photo": true,
          "requires_count": true
        }
      },
      {
        "id": "step_2",
        "code": "SORTING",
        "name": "Sort by Color & Fabric",
        "type": "manual",
        "config": {
          "sla_hours": 2
        }
      },
      {
        "id": "step_3",
        "code": "WASHING",
        "name": "Washing",
        "type": "manual",
        "config": {
          "sla_hours": 24
        }
      },
      {
        "id": "step_4",
        "code": "DRYING",
        "name": "Drying",
        "type": "manual",
        "config": {
          "sla_hours": 12
        }
      },
      {
        "id": "step_5",
        "code": "FINISHING",
        "name": "Ironing & Finishing",
        "type": "manual",
        "config": {
          "sla_hours": 8
        }
      },
      {
        "id": "step_6",
        "code": "QA",
        "name": "Quality Check",
        "type": "manual",
        "config": {
          "sla_hours": 2,
          "requires_approval": true
        }
      },
      {
        "id": "step_7",
        "code": "PACKING",
        "name": "Packing",
        "type": "manual",
        "config": {
          "sla_hours": 1
        }
      },
      {
        "id": "step_8",
        "code": "READY",
        "name": "Ready for Pickup/Delivery",
        "type": "automatic",
        "config": {
          "actions": ["notify_customer", "update_inventory"]
        }
      }
    ],
    "transitions": [
      {"from_step_id": "step_1", "to_step_id": "step_2", "is_default": true},
      {"from_step_id": "step_2", "to_step_id": "step_3", "is_default": true},
      {"from_step_id": "step_3", "to_step_id": "step_4", "is_default": true},
      {"from_step_id": "step_4", "to_step_id": "step_5", "is_default": true},
      {"from_step_id": "step_5", "to_step_id": "step_6", "is_default": true},
      {
        "from_step_id": "step_6",
        "to_step_id": "step_7",
        "condition": {
          "field": "qa_result",
          "operator": "equals",
          "value": "passed"
        },
        "is_default": true
      },
      {
        "from_step_id": "step_6",
        "to_step_id": "step_3",
        "condition": {
          "field": "qa_result",
          "operator": "equals",
          "value": "failed"
        }
      },
      {"from_step_id": "step_7", "to_step_id": "step_8", "is_default": true}
    ]
  }
}
```

**Template: Express Service**
```json
{
  "template_code": "EXPRESS_SERVICE",
  "template_name": "Express Service - 24 Hour",
  "workflow_definition": {
    "steps": [
      {
        "id": "step_1",
        "code": "INTAKE",
        "name": "Fast Intake",
        "type": "manual",
        "config": {"sla_hours": 0.5}
      },
      {
        "id": "step_2",
        "code": "WASHING",
        "name": "Priority Washing",
        "type": "manual",
        "config": {
          "sla_hours": 4,
          "priority": "high"
        }
      },
      {
        "id": "step_3",
        "code": "FINISHING",
        "name": "Express Finishing",
        "type": "manual",
        "config": {"sla_hours": 2}
      },
      {
        "id": "step_4",
        "code": "READY",
        "name": "Ready",
        "type": "automatic"
      }
    ],
    "transitions": [
      {"from_step_id": "step_1", "to_step_id": "step_2", "is_default": true},
      {"from_step_id": "step_2", "to_step_id": "step_3", "is_default": true},
      {"from_step_id": "step_3", "to_step_id": "step_4", "is_default": true}
    ]
  }
}
```

### 9.2 Template Library

**Browse Templates:**
```typescript
async function getWorkflowTemplates(filters?: {
  category?: string;
  type?: string;
  search?: string;
}): Promise<WorkflowTemplate[]> {
  return await prisma.sys_workflow_templates_mst.findMany({
    where: {
      is_active: true,
      is_published: true,
      service_category_code: filters?.category,
      workflow_type: filters?.type,
      OR: filters?.search ? [
        { template_name: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ] : undefined
    },
    orderBy: {
      display_order: 'asc'
    }
  });
}
```

---

## 10. Tenant Customization

### 10.1 Customization Options

**What Tenants Can Customize:**
- ✅ Add custom steps
- ✅ Remove optional steps
- ✅ Modify SLA times
- ✅ Change step assignments
- ✅ Add custom notifications
- ✅ Configure approval requirements
- ❌ Cannot remove mandatory steps
- ❌ Cannot break workflow logic

**Create Custom Workflow:**
```typescript
async function createTenantWorkflow(
  tenantId: string,
  templateId: string,
  customizations: WorkflowCustomization
): Promise<WorkflowConfiguration> {
  // Get base template
  const template = await prisma.sys_workflow_templates_mst.findUnique({
    where: { id: templateId }
  });

  // Validate customizations
  const validationErrors = await validateCustomizations(
    template.workflow_definition,
    customizations
  );

  if (validationErrors.length > 0) {
    throw new Error(`Invalid customizations: ${validationErrors.join(', ')}`);
  }

  // Apply customizations
  const compiledWorkflow = applyCustomizations(
    template.workflow_definition,
    customizations
  );

  // Create tenant configuration
  return await prisma.org_workflow_configurations.create({
    data: {
      tenant_org_id: tenantId,
      template_id: templateId,
      template_version: template.version,
      workflow_overrides: customizations,
      compiled_workflow: compiledWorkflow,
      is_enabled: true
    }
  });
}
```

**Apply Customizations:**
```typescript
function applyCustomizations(
  baseWorkflow: Workflow,
  customizations: WorkflowCustomization
): Workflow {
  const workflow = JSON.parse(JSON.stringify(baseWorkflow)); // Deep clone

  // Remove steps
  if (customizations.removed_steps) {
    workflow.steps = workflow.steps.filter(
      s => !customizations.removed_steps.includes(s.id)
    );

    // Remove related transitions
    workflow.transitions = workflow.transitions.filter(
      t => !customizations.removed_steps.includes(t.from_step_id) &&
           !customizations.removed_steps.includes(t.to_step_id)
    );
  }

  // Add custom steps
  if (customizations.added_steps) {
    workflow.steps.push(...customizations.added_steps);
  }

  // Modify steps
  if (customizations.modified_steps) {
    for (const mod of customizations.modified_steps) {
      const step = workflow.steps.find(s => s.id === mod.id);
      if (step) {
        Object.assign(step.config, mod.config);
      }
    }
  }

  // Add transitions
  if (customizations.added_transitions) {
    workflow.transitions.push(...customizations.added_transitions);
  }

  // Remove transitions
  if (customizations.removed_transitions) {
    workflow.transitions = workflow.transitions.filter(
      t => !customizations.removed_transitions.includes(t.id)
    );
  }

  return workflow;
}
```

### 10.2 Customization UI

**Tenant Workflow Editor:**
```
┌─────────────────────────────────────────────────────────────┐
│  Customize Workflow: Wash & Iron                  [Save]    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Base Template: Wash & Iron Standard (v2)                   │
│  Your Customizations:                                        │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Steps                                               │   │
│  │  ┌────────────────────────────────────────────────┐ │   │
│  │  │ ☑ INTAKE (Required)               1 hour      │ │   │
│  │  │ ☑ SORTING                         2 hours     │ │   │
│  │  │ ☑ WASHING (Required)              [48] hours  │ │   │
│  │  │ ☐ DRYING (Optional - Skip)                    │ │   │
│  │  │ ☑ FINISHING (Required)            8 hours     │ │   │
│  │  │ ☑ Custom: STEAM_PRESS             2 hours     │ │   │
│  │  │ ☑ QA (Required)                   2 hours     │ │   │
│  │  │ ☑ PACKING (Required)              1 hour      │ │   │
│  │  │ ☑ READY (Required)                Auto        │ │   │
│  │  └────────────────────────────────────────────────┘ │   │
│  │                                                      │   │
│  │  [+ Add Custom Step]                                │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Notifications                                       │   │
│  │  ☑ Notify customer when READY                       │   │
│  │  ☑ Send SMS on QA failure                           │   │
│  │  ☐ WhatsApp updates at each step                   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  Estimated Total Time: 61 hours (Standard: 48 hours)        │
│                                                              │
│  [Cancel]                              [Save Customization] │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Automation & Actions

### 11.1 Action Types

**Available Actions:**

1. **Notification Actions**
   - Send email
   - Send SMS
   - Send WhatsApp message
   - In-app notification
   - Push notification

2. **Integration Actions**
   - Call webhook
   - Update external system
   - Sync data
   - Trigger third-party API

3. **Data Actions**
   - Update order fields
   - Calculate metrics
   - Generate documents
   - Update inventory

4. **Business Logic Actions**
   - Apply discount
   - Calculate pricing
   - Check availability
   - Validate data

### 11.2 Action Configuration

**Action Definition:**
```typescript
interface WorkflowAction {
  id: string;
  type: 'notification' | 'integration' | 'data' | 'business_logic';
  name: string;
  config: ActionConfig;
  trigger_timing: 'on_enter' | 'on_exit' | 'on_complete';
  retry_policy?: {
    max_attempts: number;
    backoff_seconds: number;
  };
}

interface ActionConfig {
  // For notification actions
  notification?: {
    channel: 'email' | 'sms' | 'whatsapp';
    template_id: string;
    recipients: string[];  // or dynamic: ['customer.email']
    variables: Record<string, any>;
  };

  // For webhook actions
  webhook?: {
    url: string;
    method: 'GET' | 'POST' | 'PUT';
    headers: Record<string, string>;
    body_template: string;
  };

  // For data actions
  data_update?: {
    table: string;
    record_id_field: string;
    updates: Record<string, any>;
  };
}
```

**Execute Action:**
```typescript
async function executeAction(
  action: WorkflowAction,
  context: ExecutionContext
): Promise<ActionResult> {
  try {
    let result: any;

    switch (action.type) {
      case 'notification':
        result = await sendNotification(action.config.notification, context);
        break;

      case 'integration':
        result = await callWebhook(action.config.webhook, context);
        break;

      case 'data':
        result = await updateData(action.config.data_update, context);
        break;

      case 'business_logic':
        result = await executeBusinessLogic(action.config, context);
        break;
    }

    return {
      action_id: action.id,
      status: 'success',
      result,
      executed_at: new Date()
    };
  } catch (error) {
    // Retry logic
    if (action.retry_policy && context.retry_count < action.retry_policy.max_attempts) {
      await scheduleActionRetry(action, context, error);
    }

    return {
      action_id: action.id,
      status: 'failed',
      error: error.message,
      executed_at: new Date()
    };
  }
}
```

---

## 12. Monitoring & Analytics

### 12.1 Workflow Performance Metrics

**Dashboard Metrics:**
```typescript
async function getWorkflowPerformanceMetrics(
  tenantId: string,
  workflowId: string,
  period: DateRange
): Promise<WorkflowMetrics> {
  const executions = await prisma.org_workflow_executions.findMany({
    where: {
      tenant_org_id: tenantId,
      workflow_config_id: workflowId,
      started_at: {
        gte: period.start,
        lte: period.end
      }
    },
    include: {
      step_executions: true
    }
  });

  return {
    total_executions: executions.length,
    completed_executions: executions.filter(e => e.is_completed).length,
    in_progress_executions: executions.filter(e => !e.is_completed && !e.is_cancelled).length,
    cancelled_executions: executions.filter(e => e.is_cancelled).length,

    avg_completion_time_hours: calculateAverage(
      executions.filter(e => e.is_completed).map(e => e.total_duration_seconds / 3600)
    ),

    success_rate: (executions.filter(e => e.is_completed && !e.has_errors).length / executions.length) * 100,

    step_performance: calculateStepPerformance(executions),

    bottlenecks: identifyBottlenecks(executions),

    sla_compliance: calculateSLACompliance(executions)
  };
}
```

**Step Performance Analysis:**
```typescript
function calculateStepPerformance(
  executions: WorkflowExecution[]
): StepPerformance[] {
  const stepStats: Map<string, StepStats> = new Map();

  for (const execution of executions) {
    for (const stepExec of execution.step_executions) {
      if (!stepStats.has(stepExec.step_code)) {
        stepStats.set(stepExec.step_code, {
          step_code: stepExec.step_code,
          step_name: stepExec.step_name,
          total_executions: 0,
          completed: 0,
          failed: 0,
          durations: [],
          sla_breaches: 0
        });
      }

      const stats = stepStats.get(stepExec.step_code)!;
      stats.total_executions++;

      if (stepExec.status === 'completed') {
        stats.completed++;
        stats.durations.push(stepExec.duration_seconds);
      } else if (stepExec.status === 'failed') {
        stats.failed++;
      }

      if (stepExec.is_sla_breached) {
        stats.sla_breaches++;
      }
    }
  }

  return Array.from(stepStats.values()).map(stats => ({
    step_code: stats.step_code,
    step_name: stats.step_name,
    avg_duration_hours: calculateAverage(stats.durations) / 3600,
    median_duration_hours: calculateMedian(stats.durations) / 3600,
    success_rate: (stats.completed / stats.total_executions) * 100,
    sla_compliance_rate: ((stats.total_executions - stats.sla_breaches) / stats.total_executions) * 100
  }));
}
```

**Identify Bottlenecks:**
```typescript
function identifyBottlenecks(
  executions: WorkflowExecution[]
): Bottleneck[] {
  const stepPerf = calculateStepPerformance(executions);

  // Find steps with:
  // 1. Longest average duration
  // 2. High SLA breach rate
  // 3. Low success rate

  const bottlenecks = stepPerf
    .filter(step =>
      step.avg_duration_hours > 24 || // Takes more than 24 hours
      step.sla_compliance_rate < 80 || // < 80% SLA compliance
      step.success_rate < 95           // < 95% success rate
    )
    .map(step => ({
      step_code: step.step_code,
      step_name: step.step_name,
      issue_type: determineIssueType(step),
      severity: calculateSeverity(step),
      recommendation: generateRecommendation(step)
    }))
    .sort((a, b) => b.severity - a.severity);

  return bottlenecks;
}

function determineIssueType(step: StepPerformance): string {
  if (step.avg_duration_hours > 24) return 'slow_processing';
  if (step.sla_compliance_rate < 80) return 'sla_breaches';
  if (step.success_rate < 95) return 'high_failure_rate';
  return 'unknown';
}

function generateRecommendation(step: StepPerformance): string {
  const issueType = determineIssueType(step);

  switch (issueType) {
    case 'slow_processing':
      return `Consider adding more staff or automation for ${step.step_name}`;
    case 'sla_breaches':
      return `Review and adjust SLA times for ${step.step_name} or allocate more resources`;
    case 'high_failure_rate':
      return `Investigate frequent failures in ${step.step_name} and improve quality control`;
    default:
      return 'Monitor and optimize';
  }
}
```

### 12.2 Real-Time Monitoring

**Live Workflow Tracking:**
```typescript
interface LiveWorkflowStatus {
  active_workflows: number;
  steps_in_progress: StepStatus[];
  sla_at_risk: WorkflowExecution[];
  blocked_workflows: WorkflowExecution[];
  recent_completions: WorkflowExecution[];
}

async function getLiveWorkflowStatus(tenantId: string): Promise<LiveWorkflowStatus> {
  const activeExecutions = await prisma.org_workflow_executions.findMany({
    where: {
      tenant_org_id: tenantId,
      is_completed: false,
      is_cancelled: false
    },
    include: {
      step_executions: {
        where: {
          status: 'in_progress'
        }
      },
      order: true
    }
  });

  return {
    active_workflows: activeExecutions.length,

    steps_in_progress: groupByStep(activeExecutions),

    sla_at_risk: activeExecutions.filter(exec =>
      exec.step_executions.some(step =>
        step.sla_due_at && step.sla_due_at < addHours(new Date(), 2) // Within 2 hours of breach
      )
    ),

    blocked_workflows: activeExecutions.filter(exec =>
      exec.blocked_step_ids && exec.blocked_step_ids.length > 0
    ),

    recent_completions: await getRecentCompletions(tenantId, 10)
  };
}
```

---

## 13. API Specifications

**Get Workflow Templates**
```http
GET /api/v1/platform/workflows/templates
```

**Create Tenant Workflow**
```http
POST /api/v1/platform/workflows/tenant/{tenantId}/workflows
```

**Start Workflow Execution**
```http
POST /api/v1/platform/workflows/executions
```

**Complete Workflow Step**
```http
POST /api/v1/platform/workflows/executions/{executionId}/steps/{stepId}/complete
```

**Get Workflow Performance**
```http
GET /api/v1/platform/workflows/tenant/{tenantId}/performance
```

---

## 14. UI/UX Design

**Workflow Execution Monitor:**
```
┌─────────────────────────────────────────────────────────────┐
│  Active Workflows                                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Order #12345 - Wash & Iron Standard                        │
│  ┌────────────────────────────────────────────────────┐     │
│  │  ✅ INTAKE ──► ✅ SORTING ──► 🔄 WASHING ──► ⏳ DRYING │     │
│  │  1h          2h            [In Progress]          │     │
│  │                            SLA: 22h remaining      │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
│  Order #12346 - Express Service                             │
│  ┌────────────────────────────────────────────────────┐     │
│  │  ✅ INTAKE ──► 🔄 WASHING ──► ⏳ FINISHING ──► ⏳ READY │     │
│  │  30m         [In Progress]                         │     │
│  │              🔴 SLA: 30m overdue!                  │     │
│  └────────────────────────────────────────────────────┘     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 15. Performance Optimization

### 15.1 Caching Strategy

**Cache Workflow Definitions:**
```typescript
// Cache compiled workflows
const workflowCache = new Map<string, Workflow>();

async function getCachedWorkflow(
  workflowConfigId: string
): Promise<Workflow> {
  if (workflowCache.has(workflowConfigId)) {
    return workflowCache.get(workflowConfigId)!;
  }

  const config = await prisma.org_workflow_configurations.findUnique({
    where: { id: workflowConfigId }
  });

  workflowCache.set(workflowConfigId, config.compiled_workflow);

  return config.compiled_workflow;
}
```

### 15.2 Database Optimization

**Indexes for Performance:**
```sql
-- Workflow execution lookups
CREATE INDEX idx_exec_active ON org_workflow_executions(tenant_org_id, is_completed, started_at DESC);

-- Step execution lookups
CREATE INDEX idx_step_active ON org_workflow_step_executions(workflow_execution_id, status, started_at);

-- SLA monitoring
CREATE INDEX idx_step_sla ON org_workflow_step_executions(sla_due_at, is_sla_breached)
  WHERE status = 'in_progress';
```

---

## 16. Integration Points

- **Order Management**: Sync workflow status with order status
- **Notifications**: Trigger notifications on workflow events
- **Analytics (PRD-0004)**: Feed workflow metrics to analytics
- **Core Data (PRD-0006)**: Use sys_order_status_cd codes
- **Support (PRD-0005)**: Create tickets on workflow errors

---

## 17. Implementation Plan

**Phase 1 (Weeks 1-3):** Database schema, core execution engine, basic transitions
**Phase 2 (Weeks 4-5):** Workflow designer UI, template library
**Phase 3 (Weeks 6-7):** Conditional logic, parallel processing, automation
**Phase 4 (Week 8):** Monitoring, analytics, optimization

---

## 18. Testing Strategy

**Unit Tests:** Condition evaluation, action execution, state transitions
**Integration Tests:** Full workflow execution, database persistence
**E2E Tests:** UI workflow designer, execution monitoring
**Performance Tests:** 10,000 concurrent executions, bottleneck detection

---

## 19. Future Enhancements

- AI-powered workflow optimization
- Predictive bottleneck detection
- Auto-scaling resource allocation
- Advanced visual designer (BPMN 2.0)
- Workflow simulation and testing
- Multi-tenant shared workflow marketplace

---

## Related PRDs

- **[PRD-SAAS-MNG-0001](PRD-SAAS-MNG-0001_Platform_HQ_Console.md)** - Platform HQ Console
- **[PRD-SAAS-MNG-0002](PRD-SAAS-MNG-0002_Tenant_Lifecycle.md)** - Tenant Lifecycle
- **[PRD-SAAS-MNG-0006](PRD-SAAS-MNG-0006_Core_Data_Management.md)** - Core Data Management
- **[PRD-SAAS-MNG-0010](PRD-SAAS-MNG-0010_Platform_Configuration.md)** - Platform Configuration

---

**End of PRD-SAAS-MNG-0007: Workflow Engine Management**

---

**Document Status**: Draft v0.1.0
**Next Review**: After Phase 1 implementation
**Approved By**: Pending
**Implementation Start**: TBD

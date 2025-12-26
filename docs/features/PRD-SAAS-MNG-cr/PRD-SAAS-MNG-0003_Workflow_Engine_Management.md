# PRD-SAAS-MNG-0003: Workflow Engine Management

**Version:** 1.0  
**Status:** Draft  
**Owner:** Jehad Ali (Jh Apps HQ)  
**Priority:** Phase 2 - High Priority

---

## Overview & Purpose

This PRD defines the workflow engine management system for creating, configuring, and managing global workflow templates that can be assigned to tenants and service categories.

**Business Value:**
- Centralized workflow template management
- Reusable workflow configurations
- Visual workflow editor
- Workflow versioning and rollback
- Tenant-specific workflow customization

---

## Functional Requirements

### FR-WF-001: Workflow Template Management
- **Description**: Create and manage workflow templates
- **Acceptance Criteria**:
  - Create templates (WF_STANDARD, WF_ASSEMBLY_QA, etc.)
  - Edit template metadata (name, description)
  - Enable/disable templates
  - Clone templates
  - Delete templates (with dependency check)

### FR-WF-002: Stage Management
- **Description**: Manage workflow stages per template
- **Acceptance Criteria**:
  - Add/remove stages from template
  - Set stage sequence order
  - Configure stage metadata (name, type, terminal flag)
  - Bilingual stage names (EN/AR)

### FR-WF-003: Transition Management
- **Description**: Configure allowed transitions between stages
- **Acceptance Criteria**:
  - Define transitions (from_stage -> to_stage)
  - Set transition rules (requires_scan_ok, requires_invoice, requires_pod)
  - Configure auto-transition rules
  - Enable/disable transitions

### FR-WF-004: Visual Workflow Editor
- **Description**: Visual interface for editing workflows
- **Acceptance Criteria**:
  - Drag-and-drop stage management
  - Visual transition connections
  - Stage properties panel
  - Transition rules editor
  - Real-time validation

### FR-WF-005: Workflow Assignment
- **Description**: Assign workflows to tenants and service categories
- **Acceptance Criteria**:
  - Assign template to tenant
  - Assign template to service category
  - View assigned workflows per tenant
  - Bulk assignment capability

### FR-WF-006: Workflow Versioning
- **Description**: Version control for workflow templates
- **Acceptance Criteria**:
  - Create workflow versions
  - Rollback to previous version
  - View version history
  - Compare versions

---

## Technical Requirements

### Database Schema

Uses existing tables:
- `sys_workflow_template_cd`
- `sys_workflow_template_stages`
- `sys_workflow_template_transitions`
- `org_tenant_workflow_templates_cf`
- `org_tenant_service_category_workflow_cf`

---

## API Endpoints

### Workflow Templates

#### List Templates
```
GET /api/hq/v1/workflow-templates
Response: { data: WorkflowTemplate[] }
```

#### Create Template
```
POST /api/hq/v1/workflow-templates
Body: { template_code, template_name, template_name2, template_desc }
Response: { success: boolean, data: WorkflowTemplate }
```

#### Get Template Details
```
GET /api/hq/v1/workflow-templates/:id
Response: { data: WorkflowTemplateWithStages }
```

#### Update Template
```
PATCH /api/hq/v1/workflow-templates/:id
Body: { template_name?, template_name2?, template_desc?, is_active? }
Response: { success: boolean, data: WorkflowTemplate }
```

#### Clone Template
```
POST /api/hq/v1/workflow-templates/:id/clone
Body: { new_template_code, new_template_name }
Response: { success: boolean, data: WorkflowTemplate }
```

### Stages

#### Add Stage
```
POST /api/hq/v1/workflow-templates/:id/stages
Body: { stage_code, stage_name, stage_name2, stage_type, seq_no, is_terminal }
Response: { success: boolean, data: Stage }
```

#### Update Stage
```
PATCH /api/hq/v1/workflow-templates/:id/stages/:stageId
Body: { stage_name?, stage_name2?, seq_no?, is_terminal?, is_active? }
Response: { success: boolean, data: Stage }
```

#### Delete Stage
```
DELETE /api/hq/v1/workflow-templates/:id/stages/:stageId
Response: { success: boolean, message: string }
```

### Transitions

#### Add Transition
```
POST /api/hq/v1/workflow-templates/:id/transitions
Body: {
  from_stage_code,
  to_stage_code,
  requires_scan_ok?,
  requires_invoice?,
  requires_pod?,
  allow_manual?,
  auto_when_done?
}
Response: { success: boolean, data: Transition }
```

#### Update Transition
```
PATCH /api/hq/v1/workflow-templates/:id/transitions/:transitionId
Body: { ...transition rules }
Response: { success: boolean, data: Transition }
```

### Assignment

#### Assign to Tenant
```
POST /api/hq/v1/workflow-templates/:id/assign
Body: { tenant_id, service_category_code? }
Response: { success: boolean, message: string }
```

---

## UI/UX Requirements

### Workflow Template List
- Table view with template details
- Filter by active/inactive
- Search functionality

### Visual Workflow Editor
- Canvas-based interface
- Stage nodes with drag-and-drop
- Transition arrows between stages
- Properties panel for selected item
- Validation indicators

### Stage Management
- List of stages with sequence
- Reorder stages (drag-and-drop)
- Stage properties form
- Delete confirmation

---

## Security Considerations

1. **Template Changes**: Require confirmation for template changes affecting active tenants
2. **Version Control**: Prevent deletion of templates in use
3. **Audit Trail**: Log all workflow changes

---

## Testing Requirements

- Unit tests for workflow logic
- Integration tests for template CRUD
- E2E tests for visual editor
- Validation tests for transitions

---

## Implementation Checklist

- [ ] Review existing workflow tables
- [ ] Implement template CRUD API
- [ ] Implement stage management API
- [ ] Implement transition management API
- [ ] Implement assignment API
- [ ] Create visual workflow editor component
- [ ] Create template list UI
- [ ] Add versioning support
- [ ] Write tests
- [ ] Documentation

---

**Related PRDs:**
- PRD-SAAS-MNG-0001: Tenant Lifecycle Management
- PRD-SAAS-MNG-0006: Core Data Management - Service Catalog


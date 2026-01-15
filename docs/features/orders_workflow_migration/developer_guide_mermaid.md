---
version: v0.1.0
last_updated: 2026-01-15
author: CleanMateX AI Assistant
---

# Developer guide (flow)

```mermaid
flowchart TD
  UI[Workflow Screen (e.g. Preparation)] --> SC[useScreenContract(screen)]
  SC -->|GET| SCAPI[/api/v1/workflows/screens/:screen/contract/]
  SCAPI -->|RPC| RPC[cmx_ord_screen_pre_conditions(p_screen)]

  UI --> SO[useScreenOrders(screen)]
  SO -->|GET status_filter from contract| ORDAPI[/api/v1/orders?status_filter=.../]

  UI --> WC[useWorkflowContext(orderId)]
  WC --> WCApi[/api/v1/orders/:id/workflow-context/]

  UI --> TR[useOrderTransition()]
  TR --> TRApi[/api/v1/orders/:id/transition/]
  TRApi -->|if screen && useOldWfCodeOrNew != false| ENH[WorkflowServiceEnhanced.executeScreenTransition]
  TRApi -->|else| LEG[WorkflowService.changeStatus]
```



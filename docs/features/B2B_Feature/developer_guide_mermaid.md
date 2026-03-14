---
version: v1.1.0
last_updated: 2026-03-14
author: CleanMateX Team
---

# B2B Feature Developer Guide — Code Flow

## Architecture Overview

```mermaid
flowchart TB
    subgraph UI [UI Layer]
        B2BCust[B2B Customers List]
        B2BCont[B2B Contracts]
        B2BStmt[B2B Statements]
        OverdueUI[Overdue Statements]
        NewOrd[New Order]
    end

    subgraph API [API Layer]
        ContactsAPI[/api/v1/b2b-contacts]
        ContractsAPI[/api/v1/b2b-contracts]
        StatementsAPI[/api/v1/b2b-statements]
        OverdueAPI[/api/v1/b2b/overdue-statements]
        DunningAPI[/api/v1/b2b/run-dunning-actions]
    end

    subgraph Services [Service Layer]
        ContactsSvc[B2BContactsService]
        ContractsSvc[B2BContractsService]
        StatementsSvc[B2BStatementsService]
        CreditSvc[CreditLimitService]
        DunningSvc[DunningService]
    end

    subgraph DB [Database]
        OCM[org_customers_mst]
        OBD[org_b2b_contacts_dtl]
        OBC[org_b2b_contracts_mst]
        OBS[org_b2b_statements_mst]
    end

    B2BCust --> ContactsAPI
    B2BCont --> ContractsAPI
    B2BStmt --> StatementsAPI
    OverdueUI --> OverdueAPI
    NewOrd --> CreditSvc

    ContactsAPI --> ContactsSvc
    ContractsAPI --> ContractsSvc
    StatementsAPI --> StatementsSvc
    OverdueAPI --> DunningSvc
    DunningAPI --> DunningSvc

    ContactsSvc --> OBD
    ContractsSvc --> OBC
    StatementsSvc --> OBS
    CreditSvc --> OCM
    DunningSvc --> OBS
    DunningSvc --> OCM
```

## Credit Limit & Override Flow

```mermaid
flowchart TD
    A[Order Submit] --> B{Credit Check}
    B -->|wouldExceed & !override| C[Block: B2B_CREDIT_EXCEEDED]
    B -->|isCreditHold| D[Block: B2B_CREDIT_HOLD]
    B -->|wouldExceed & override| E[Allow + Store override_by/at]
    B -->|OK| F[Create Order]
    E --> F
```

## Dunning Actions Flow

```mermaid
flowchart LR
    A[Overdue Statements] --> B[Evaluate Dunning Level]
    B --> C{Action}
    C -->|email| D[Send Email via Resend]
    C -->|sms| E[Send SMS via Twilio]
    C -->|hold_orders| F[Set is_credit_hold on Customer]
```

---
version: v1.0.0
last_updated: 2026-03-13
author: CleanMateX Team
---

# B2B Feature Developer Guide — Code Flow

```mermaid
flowchart TB
    subgraph UI [UI Layer]
        B2BCust[B2B Customers List]
        B2BCont[B2B Contracts]
        B2BStmt[B2B Statements]
        NewOrd[New Order]
    end

    subgraph API [API Layer]
        ContactsAPI[/api/v1/b2b-contacts]
        ContractsAPI[/api/v1/b2b-contracts]
        StatementsAPI[/api/v1/b2b-statements]
    end

    subgraph Services [Service Layer]
        ContactsSvc[B2BContactsService]
        ContractsSvc[B2BContractsService]
        StatementsSvc[B2BStatementsService]
        CreditSvc[CreditLimitService]
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
    NewOrd --> CreditSvc

    ContactsAPI --> ContactsSvc
    ContractsAPI --> ContractsSvc
    StatementsAPI --> StatementsSvc

    ContactsSvc --> OBD
    ContractsSvc --> OBC
    StatementsSvc --> OBS
    CreditSvc --> OCM
```

# Workflow RPC Retirement

## Runtime boundary

All production order workflow mutations now execute configured application actions through `WorkflowEngine`. The compatibility `/transition` endpoint maps legacy request fields to an action; raw PATCH and bulk status writers return `410`.

Screen contracts and available transitions now read the workflow catalogs/application engine rather than `cmx_ord_screen_pre_conditions` or `cmx_get_allowed_transitions`.

## Migration 0442

`0442_retire_workflow_rpc_grants.sql` revokes `EXECUTE` from `PUBLIC`, `anon`, `authenticated`, and `service_role` for the superseded Legacy/Enhanced workflow functions. It intentionally does not drop functions, alter data, or use `CASCADE`.

The operator confirmed successful local and remote application on 2026-08-14. Function definitions remain retained for controlled rollback.

## Rollback

The preferred rollback is application-forward: fix the engine/config and redeploy. If an incident commander approves temporary RPC rollback, re-grant only the exact required function signature and role, record the time window, and remove the grant after recovery.

Do not broadly grant `PUBLIC`, do not restore every retired RPC, and do not drop retained functions until production telemetry and the pilot acceptance matrix are signed.

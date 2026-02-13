# Plan: Logger Remote Logging Service Integration

## Overview

The logger in `lib/utils/logger.ts` has a TODO to implement remote logging when `enableRemoteLogging` is true and level is ERROR or higher. This plan covers integrating an external logging service (e.g. Sentry, DataDog, CloudWatch).

## Current State

- **File:** `web-admin/lib/utils/logger.ts`
- **Location:** Inside `outputLog()`, after Sentry (if configured)
- **TODO:** "Implement remote logging service integration"
- **Condition:** `this.config.enableRemoteLogging && level >= LogLevel.ERROR`

## Prerequisites

- Choose logging provider: Sentry (already partially used), DataDog, Axiom, CloudWatch, etc.
- Env vars for API key / endpoint
- Account and project setup for chosen provider

## Implementation Steps

### Step 1: Choose provider

- **Sentry:** Already integrated for errors; can extend to capture logger.error() if not already
- **DataDog:** Log API, requires DATADOG_API_KEY
- **Axiom:** Simple REST API
- **CloudWatch:** AWS SDK, for AWS deployments

### Step 2: Add env configuration

- `REMOTE_LOGGING_PROVIDER` (sentry | datadog | axiom | cloudwatch | none)
- Provider-specific: `SENTRY_DSN`, `DATADOG_API_KEY`, `AXIOM_TOKEN`, etc.
- `REMOTE_LOGGING_ENABLED` (or use existing `enableRemoteLogging`)

### Step 3: Create remote logging adapter

- File: `lib/utils/remote-logger-adapter.ts` (or similar)
- Interface: `sendLog(level, message, context, error?)`
- Implementations: SentryAdapter, DataDogAdapter, etc.
- Select implementation based on env

### Step 4: Integrate into logger outputLog

- When `enableRemoteLogging && level >= ERROR`:
  - Call adapter.sendLog with entry data
  - Catch and ignore adapter errors (fail silently as with Sentry)
- Consider batching for high-volume to avoid blocking

### Step 5: Add optional log levels

- WARN could also be sent if provider supports it
- Make configurable via `remoteLogMinLevel`

## Acceptance Criteria

- [ ] When configured, ERROR logs are sent to remote service
- [ ] No crash or blocking when remote service is down
- [ ] Env vars documented in .env.example
- [ ] Build passes with provider optional (no hard dependency if not configured)

## Production Checklist

- [ ] Provider account and project created
- [ ] Env vars set in production
- [ ] Test error capture end-to-end
- [ ] Log volume and cost reviewed

## References

- web-admin/lib/utils/logger.ts
- Existing Sentry usage in codebase
- Provider docs (e.g. Sentry Node SDK, DataDog Logs API)

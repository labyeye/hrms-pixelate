# NestHR Task Plan

**Last reviewed:** 2026-09-20

## P0: Security Blockers

- [ ] Authenticate and authorize biometric registration, device, record, and ADMS endpoints.
- [ ] Fix document download path traversal and add regression tests.
- [ ] Rate-limit password reset, OTP, and 2FA verification attempts.
- [ ] Validate upload magic bytes and isolate upload storage.
- [ ] Validate required production secrets, CORS origins, CSP, and CSRF posture at startup.
- [ ] Audit tenant scoping and role checks across every route.
- [ ] Remove secrets/PII from logs and rotate any exposed credentials.

## P1: Workforce Reliability

- [ ] Add contract tests for employee, attendance, leave, payroll, document, and device APIs.
- [ ] Add timezone regression coverage for attendance dates, shifts, and reports.
- [ ] Add payroll calculation fixtures for allowances, deductions, overtime, and statutory outputs.
- [ ] Add idempotency for device punches, payment callbacks, notifications, and recurring jobs.
- [ ] Replace hardcoded mobile backend URL with build variants/environment configuration.
- [ ] Move base64 documents to managed file/object storage with metadata in MongoDB.

## P1: Biometric Operations

- [ ] Define device authentication and token rotation policy.
- [ ] Add enrollment consent, retention, deletion, and audit workflows.
- [ ] Add face-service health/version checks and timeout/failure behavior.
- [ ] Add device command retry/status UI and operational logs.

## P2: Product Quality

- [ ] Complete consistent loading/error/empty states across all web/mobile screens.
- [ ] Add user-visible session/device management and secure logout/revocation.
- [ ] Add observability: structured logs, request IDs, health checks, and alerts.
- [ ] Document deployment, backups, restore, migrations, and incident response.
- [ ] Keep web/mobile permission matrices and route documentation synchronized.

## Definition of Done

A task is complete when the server-side rule is enforced, the affected clients handle all states, focused tests pass, sensitive data is protected, and `docs/` reflects the new contract.

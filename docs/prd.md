# NestHR Product Requirements Document

**Status:** Living document  
**Last reviewed:** 2026-09-20

## Product Summary

NestHR is a multi-tenant human resource management platform for companies and their employees. It covers employee records, departments, attendance, leave, payroll, recruitment, performance, documents, assets, loans, support, billing, notifications, and biometric attendance.

## Users

- **Platform/admin owner:** manages companies, plans, support, settings, and audit data.
- **HR manager:** owns workforce setup, attendance, leave, payroll, recruitment, settings, and reports.
- **HR executive:** performs day-to-day workforce operations with narrower permissions.
- **Department head:** views and manages permitted team workflows.
- **Employee:** uses employee self-service for profile, attendance, leave, payroll, documents, assets, and reports.

## Current Scope

- Web dashboard, React Native mobile app, Express/MongoDB backend, and FastAPI face service.
- Auth with email/password, phone OTP, password reset methods, 2FA, passkeys/biometric-related flows, and JWT sessions.
- Employee and department management, imports, documents, credentials, profiles, and exit workflows.
- Attendance, geofenced face check-in/out, leave, holidays, shifts, late approvals, and biometric devices/ADMS.
- Payroll processing, payslips, deductions, loans/advances, reports, exports, notifications, WhatsApp, support, and billing.

## Requirements

### Workforce

- Maintain tenant-scoped employee records, employment dates, departments, designations, salary data, documents, assets, and status.
- Support controlled bulk import and secure credential reset.
- Allow employees to manage permitted profile fields without bypassing HR policy.

### Attendance

- Record manual, device, face, fingerprint, card, password, auto, and geofenced attendance where configured.
- Apply shift/grace/late rules and support corrections/approvals.
- Keep dates timezone-safe and preserve verification mode, actor, and audit information.

### Payroll and finance

- Configure salary heads and payroll settings.
- Preview, process, update, mark paid, bulk mark paid, and expose employee payslips.
- Generate reports and exports while protecting financial and bank data.

### Access and compliance

- Enforce role permissions in backend routes/controllers.
- Provide audit logs for material changes.
- Protect documents, face data, biometric device tokens, payment data, and personal information.

## Success Metrics

- Employee onboarding and import completion without data loss.
- Attendance capture accuracy and low correction volume.
- Payroll processing completes with reconciled totals and traceable approvals.
- Employees can self-serve common questions without HR intervention.
- No unauthorized cross-tenant access or unauthenticated biometric writes.
- Reports and payslips are reproducible for the selected period.

## Known Product Risks

Existing audit material identifies unauthenticated biometric/ADMS routes, document path traversal, reset rate limiting, hardcoded mobile URLs, file MIME spoofing, base64 document storage, CSRF, CSP, secret validation, PII logging, and other security gaps. These are release-blocking until reviewed and resolved.

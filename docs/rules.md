# NestHR Engineering Rules

**Last reviewed:** 2026-09-20

## Security Rules

1. Protect every browser API route with auth and role checks appropriate to the operation.
2. Protect device-facing biometric and ADMS routes with device authentication, not assumptions about network location.
3. Scope every query and mutation to the authenticated company.
4. Validate Mongo IDs, request bodies, query parameters, dates, uploads, and external callbacks.
5. Store document files outside MongoDB when practical; never allow request-controlled paths to escape the upload root.
6. Validate upload magic bytes, not only client MIME headers.
7. Rate-limit login, OTP, password reset, 2FA, upload, and device endpoints.
8. Validate required secrets at startup and fail closed in production.
9. Keep CSP, Helmet, CORS, and CSRF decisions explicit and environment-safe.
10. Do not log passwords, tokens, face embeddings, document contents, bank data, or unnecessary PII.

## HR and Payroll Rules

- Keep employee lifecycle states and employment dates consistent with attendance eligibility.
- Treat payroll calculations as financial logic: use explicit rounding, period, status, and approval semantics.
- Preserve payroll snapshots and payment history; do not overwrite audit-relevant values silently.
- Employee self-service may read only the employee's own scoped data.
- Role labels and permissions must match between route middleware, web navigation, and mobile navigation.

## Biometric Rules

- Require consent/policy approval before enrollment.
- Accept exactly one face for enrollment/verification.
- Use the configured threshold; do not hide failed matches as successful attendance.
- Store only the minimum necessary biometric representation and protect the face service shared secret.
- Prevent duplicate biometric IDs/cards across employees and students where the device namespace is shared.

## Engineering Process

- Reuse existing controllers, services, API wrappers, theme tokens, and report builders.
- Add focused tests for auth, authorization, tenant isolation, date handling, payroll, device writes, and file access.
- Test web, mobile, and service changes at their owning boundary.
- Update `docs/` when roles, routes, settings, data models, or operational commands change.

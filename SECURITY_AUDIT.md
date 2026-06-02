# Security Audit Report — NestHR (HRMS)

**Date:** 2026-05-31  
**Scope:** Full-stack security review — Node.js/Express backend + React frontend  
**Auditor:** Internal code review

---

## Executive Summary

| Severity  | Count  | Status       |
| --------- | ------ | ------------ |
| CRITICAL  | 8      | ❌ Not fixed |
| HIGH      | 7      | ❌/⚠️        |
| MEDIUM    | 7      | ⚠️ Partial   |
| LOW       | 4      | ⚠️           |
| **Total** | **26** |              |

Several critical vulnerabilities exist. The most dangerous are: a globally shared Settings document that stores plaintext Twilio credentials, missing role authorization on leave and settings endpoints, no audit logging, and no account lockout/2FA. These must be addressed before this system handles real employee or payroll data.

---

## CRITICAL FINDINGS

---

### C-1 · Settings Document is NOT Company-Scoped — All Tenants Share One Record

**File:** `backend/controllers/settingController.js:4`, `backend/models/Setting.js`  
**Risk:** Multi-tenant data isolation failure + credential exposure

```js
// settingController.js — getSettings
let setting = await Setting.findOne(); // ← No company filter at ALL
```

```js
// settingController.js — updateSettings
setting = await Setting.findOneAndUpdate({}, req.body, { ... }); // ← Same
```

The `Setting` model stores one document for the **entire database**, shared across every company. Any authenticated user can read/write the settings of every other company on the platform.

The `Setting` model also stores:

- `bankAccountNumber`, `bankIFSC`, `bankName`, `bankBranch`, `bankAccountName` — full bank credentials
- `twilioAuthToken`, `twilioAccountSid` — **plaintext third-party API credentials**

**What to do:**

1. Add `company: { type: ObjectId, ref: "Company", required: true }` to Setting schema
2. Scope all queries: `Setting.findOne({ company: req.user.company })`
3. Store Twilio credentials encrypted or in environment variables, not in the database

---

### C-2 · `authorize("admin", ...)` Uses Wrong Role Name — super_admin Cannot Update Settings

**File:** `backend/routes/settingRoutes.js:13`  
**Risk:** Super admin locked out; HR managers have unintended write access to bank/Twilio credentials

```js
.put(authorize("admin", "hr_manager"), updateSettings);
```

The User model defines role as `"super_admin"`, not `"admin"`. No user ever has role `"admin"`. The result:

- A `super_admin` calling PUT `/api/settings` gets **403 Forbidden** — cannot manage their own settings
- An `hr_manager` **can** update settings, including the bank account and Twilio auth token fields

**What to do:**

```js
.put(authorize("super_admin"), updateSettings);
```

Also add a field whitelist in the controller to prevent mass-assignment.

---

### C-3 · JWT Tokens Stored in localStorage (XSS Vulnerability)

**File:** `frontend/src/services/api.ts:3-5`  
**Risk:** Token theft via any XSS attack → full account takeover

```ts
export const getToken = () => localStorage.getItem("hrms_token");
export const setToken = (t: string) => localStorage.setItem("hrms_token", t);
```

`localStorage` is readable by any JavaScript on the page. If a single XSS vector exists (e.g., an unsanitized employee name rendered as HTML), the attacker can exfiltrate the token.

**What to do:**

- Move to `httpOnly; Secure; SameSite=Strict` cookies set by the backend
- Remove all `localStorage` token handling from the frontend
- The backend sets/clears the cookie on login/logout

---

### C-4 · Leave Endpoints Have No Role-Based Authorization

**File:** `backend/routes/leaveRoutes.js:11-14`  
**Risk:** Any employee can approve/reject/delete any other employee's leave

```js
router
  .route("/:id")
  .put(protect, updateLeaveStatus) // ← No authorize()
  .delete(protect, deleteLeave); // ← No authorize()
```

Any authenticated user (even `role: "employee"`) can hit PUT `/api/leaves/:id` and approve their own leave request.

**What to do:**

```js
.put(protect, authorize("super_admin", "hr_manager", "department_head"), updateLeaveStatus)
.delete(protect, authorize("super_admin", "hr_manager"), deleteLeave)
```

---

### C-5 · No Password Reset / Forgot Password Functionality

**File:** `backend/routes/authRoutes.js` — not implemented  
**Risk:** Users permanently locked out; admin must manually touch the database

There is no `/auth/forgot-password` or `/auth/reset-password` endpoint. There is no token generation, email delivery, or self-service recovery flow.

**What to do:**

1. `POST /auth/forgot-password` — generate a signed, single-use token (expires in 15 min), send via email
2. `POST /auth/reset-password/:token` — validate token, hash new password, invalidate token
3. Store reset token hash (not plaintext) in User model with expiry

---

### C-6 · No Account Lockout After Failed Logins (Brute Force)

**File:** `backend/controllers/authController.js` — not implemented  
**Risk:** Unlimited brute force against any account

The login endpoint has only a per-IP rate limit (50 req / 15 min). An attacker can target one account from multiple IPs, or target many accounts from one IP within the limit.

**What to do:**

- Track `failedLoginAttempts` and `lockUntil` fields on the User model
- After 5 consecutive failures: lock account for 15 minutes
- Reset counter on successful login

---

### C-7 · EmployeePayrollConfig Unique Index Excludes Company — Multi-Tenant Collision

**File:** `backend/models/EmployeePayrollConfig.js:25`  
**Risk:** Payroll config cross-contamination between companies

```js
employeePayrollConfigSchema.index({ employee: 1 }, { unique: true }); // ← No company!
```

If an employee ObjectId appears in two companies (possible if employee is transferred between companies, or via ID collision), only ONE payroll config can ever exist for that ObjectId — the upsert from Company B would silently overwrite Company A's config.

**What to do:**

```js
employeePayrollConfigSchema.index(
  { employee: 1, company: 1 },
  { unique: true },
);
```

---

### C-8 · No Audit Logging for Sensitive Operations

**File:** Not implemented anywhere  
**Risk:** Zero forensics capability, compliance failure (GDPR, SOC2, labor law)

No audit trail exists for:

- Login/logout events and IP addresses
- Role changes
- Payroll processing and modifications
- Employee data creation/deletion
- Settings and bank account changes
- Subscription/payment events

**What to do:** Create an `AuditLog` model:

```js
{
  (userId,
    companyId,
    action,
    resource,
    resourceId,
    before,
    after,
    ipAddress,
    timestamp);
}
```

Log all write operations on sensitive resources via middleware.

---

## HIGH SEVERITY FINDINGS

---

### H-1 · Content Security Policy (CSP) Disabled With No Replacement

**File:** `backend/server.js:15-16`

```js
helmet({
  contentSecurityPolicy: false, // "handled by frontend" — but it isn't
});
```

No CSP is set on the frontend either. This leaves the app fully exposed to inline script injection. XSS payloads execute unrestricted.

**Fix:** Define and enforce a strict CSP:

```js
helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "https://api.razorpay.com"],
    },
  },
});
```

---

### H-2 · API Rate Limit Is Excessively Permissive

**File:** `backend/server.js:48`

```js
const apiRateLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 5000 });
```

5000 requests / 15 minutes per IP. This allows rapid enumeration, scraping of all employee records, and near-unlimited abuse of sensitive endpoints like payroll processing.

**Fix:** Reduce to 300 req / 15 min for general API. Add tighter limits on write operations.

---

### H-3 · JWT Expires in 30 Days — Too Long

**File:** `backend/utils/generateToken.js:4`

```js
jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
```

A stolen token is valid for 30 days. Combined with localStorage storage (C-3), a stolen token grants full access for up to a month.

**Fix:** Reduce to `"24h"`. Implement refresh tokens (short-lived access token + long-lived refresh token stored in httpOnly cookie).

---

### H-4 · Settings Controller Accepts Unrestricted `req.body` (Mass Assignment)

**File:** `backend/controllers/settingController.js:18-24`

```js
setting = await Setting.findOneAndUpdate({}, req.body, { new: true });
```

`req.body` is passed directly. An attacker (or any `hr_manager`) can inject arbitrary fields, including `twilioAuthToken`, `bankAccountNumber`, or any other schema field.

**Fix:**

```js
const {
  companyName,
  companyGST,
  companyAddress,
  companyPhone,
  companyEmail,
  logoUrl,
} = req.body;
const updates = {
  companyName,
  companyGST,
  companyAddress,
  companyPhone,
  companyEmail,
  logoUrl,
};
setting = await Setting.findOneAndUpdate(
  { company: req.user.company },
  updates,
  { new: true },
);
```

---

### H-5 · No CSRF Protection

**File:** Not implemented

State-changing requests (POST, PUT, DELETE) are authenticated only by Bearer token. If the token is moved to a cookie (fix for C-3), CSRF becomes a direct risk without anti-CSRF tokens.

**Fix:** Implement `csurf` or `csrf` package. Include CSRF token in every non-GET request header. Alternatively, verify `Origin` / `Referer` headers on the backend.

---

### H-6 · Biometric Device Token Sent in URL Path

**File:** `backend/routes/biometricRoutes.js`, `frontend/src/services/api.ts`

Device authentication tokens are embedded in the URL (e.g., `/device/:token`). URLs are logged in server logs, browser history, CDN/proxy access logs, and Referer headers — leaking the token.

**Fix:** Accept device token in `Authorization: Bearer <token>` header instead of URL path.

---

### H-7 · Settings Model Stores Twilio Credentials in Plaintext in Database

**File:** `backend/models/Setting.js:55-60`

```js
twilioAccountSid: { type: String, default: "" },
twilioAuthToken: { type: String, default: "" },
```

Twilio auth tokens in the database are a direct credential compromise if MongoDB is breached or improperly configured. Anyone with DB read access can steal the auth token and use Twilio services at your expense.

**Fix:** Store credentials in environment variables (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`) and read from `process.env`. Do not persist API credentials to the database.

---

## MEDIUM SEVERITY FINDINGS

---

### M-1 · AuthContext Silently Ignores Non-401 Errors on Session Restore

**File:** `frontend/src/contexts/AuthContext.tsx:77-83`

```ts
catch (err: any) {
  if (err.status === 401) {
    removeToken();
    setUser(null);
  }
  // 500, network errors, etc. → user remains null → sent to /login
  // But token is NOT cleared → stale token persists in localStorage
}
```

A 500 server error during the `getMe` call causes the user to appear unauthenticated (bounced to `/login`) but their token is not cleared. On the next page load it tries again. This can leave stale/invalid tokens in storage indefinitely.

**Fix:** Clear the token for any non-recoverable error:

```ts
catch (err: any) {
  removeToken();
  setUser(null);
}
```

---

### M-2 · No Email Verification on Registration

**File:** `backend/controllers/authController.js` (register)

Users register with any email address without verification. Anyone can register with someone else's email and receive communication or use an unverified account.

**Fix:** Send verification link on registration. Block login until email is verified. Use a signed, time-limited token.

---

### M-3 · Avatar Stored as Raw Base64 in Database (Up to 2 MB)

**File:** `backend/controllers/authController.js:190-197`

```js
if (avatar && avatar.length > 2_000_000) { throw ... }
user.avatar = avatar;  // stored directly in MongoDB
```

Storing 2 MB blobs in MongoDB balloons document size, degrades query performance, and has no validation that the data is actually an image.

**Fix:** Require a URL string pointing to a CDN/S3 bucket. Reject base64 data URIs. Handle upload to object storage separately.

---

### M-4 · No Input Validation on Company Registration

**File:** `backend/controllers/companyController.js`

`registerCompany` does not validate input fields (name length, email format, phone format, GST/PAN patterns) unlike `authController` which uses a validation schema. Malformed or excessively long data is accepted.

**Fix:** Add a `validateBody` schema for company registration matching the pattern in `authController`.

---

### M-5 · payrollController Allows Future Month Processing

**File:** `backend/controllers/payrollController.js`

The month/year validation permits any year from 2000–2100 and any valid month, including future months. Processing payroll for a future month with incomplete attendance data produces incorrect results.

**Fix:** Add check: `if (year > currentYear || (year === currentYear && month > currentMonth)) throw error`

---

### M-6 · Error Handler Leaks Stack Traces in Development

**File:** `backend/middleware/errorHandler.js`

```js
...(process.env.NODE_ENV === "development" && { stack: err.stack }),
```

If `NODE_ENV` is accidentally not set in production, stack traces are exposed in API responses. This reveals file paths, function names, and internal logic to attackers.

**Fix:** Use a positive check: `process.env.NODE_ENV === "development"` is already correct, but also add a startup assertion: `if (!process.env.NODE_ENV) throw new Error("NODE_ENV must be set")`.

---

### M-7 · Subscription Trial Never Expires — Indefinite Free Use

**File:** `backend/controllers/companyController.js` (createCompanyForUser)

When a company is created, a subscription with `status: "active"` is created without any expiry check mechanism. Companies on trial can use the full system indefinitely without paying.

**Fix:** Implement subscription expiry: store `renewalDate`, run a daily cron that marks expired subscriptions as `"inactive"`, and block access.

---

## LOW SEVERITY FINDINGS

---

### L-1 · Missing HTTP Security Headers

**File:** `backend/server.js`

Helmet is used but CSP is disabled (see H-1). Additionally, these headers should be explicitly configured:

- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-Frame-Options: DENY` (verify it's set by Helmet default)

---

### L-2 · Production Logging Uses Morgan "dev" Format

**File:** `backend/server.js:35`

```js
app.use(morgan("dev"));
```

`dev` format is colorized and unstructured — unsuitable for log aggregation. No structured logging (JSON) for production monitoring, alerting, or SIEM integration.

**Fix:** Use `morgan("combined")` in production or implement Winston/Pino with JSON output.

---

### L-3 · JWT Secret Has No Minimum Entropy Validation

**File:** `backend/middleware/auth.js`

`process.env.JWT_SECRET` is used without validating its length or entropy. A weak secret (e.g., `"secret"` or `"123456"`) renders all JWTs forgeable.

**Fix:** Add startup check:

```js
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error("JWT_SECRET must be at least 32 characters");
}
```

---

### L-4 · MongoDB Connection String Not Validated at Startup

**File:** `backend/config/db.js`

If `MONGO_URI` is missing, the app starts and then crashes with an obscure Mongoose error on the first request rather than failing fast at startup.

**Fix:**

```js
if (!process.env.MONGO_URI) process.exit(1); // before mongoose.connect()
```

---

## WHAT IS IMPLEMENTED CORRECTLY

These security controls are working and should be maintained:

| Control                                | Location                       | Notes                                      |
| -------------------------------------- | ------------------------------ | ------------------------------------------ |
| Razorpay signature verification        | `billingController.js:152-167` | HMAC-SHA256 correctly validated            |
| Password hashing                       | `Company.js`, `User.js`        | bcrypt with salt rounds                    |
| Sensitive field stripping              | `authController.js:125-136`    | `.select("-password")` used consistently   |
| Mongoose `duplicate key` error masking | `errorHandler.js`              | Field names not leaked to client           |
| Multi-tenant company scoping           | Most controllers               | `req.user.company` filter in all queries   |
| Input validation on auth routes        | `authController.js`            | validateBody schema with min/max           |
| Auth rate limiting                     | `server.js:39-46`              | 50 req / 15 min on `/api/auth`             |
| Helmet base headers                    | `server.js:14-18`              | HSTS, XSS protection enabled               |
| JWT token validation                   | `middleware/auth.js`           | `JsonWebTokenError` caught and neutralized |
| Payment method masking                 | `paymentMethodController.js`   | Only last 4 digits stored                  |

---

## PRIORITY REMEDIATION PLAN

### Immediate (this week)

1. **Fix Settings scoping + role** — `settingController.js`, `settingRoutes.js` — 30 min
2. **Fix Leave authorization** — `leaveRoutes.js` — 10 min
3. **Move Twilio credentials to env vars** — remove from Setting model — 30 min
4. **Fix EmployeePayrollConfig index** — `EmployeePayrollConfig.js` — 5 min
5. **Fix `authorize("admin")` → `authorize("super_admin")`** — `settingRoutes.js` — 2 min

### Short term (this sprint)

6. **Implement password reset flow** — 1–2 days
7. **Add account lockout** — 4 hrs
8. **Implement audit logging** — 1 day
9. **Reduce JWT expiry to 24h** — 10 min

### Medium term (next sprint)

10. **Migrate JWT to httpOnly cookies** — 1 day
11. **Enable CSP** — 4 hrs
12. **Email verification on registration** — 4 hrs
13. **Implement 2FA (TOTP or email OTP)** — 2–3 days
14. **Add structured production logging** — 4 hrs
15. **Subscription expiry enforcement** — 1 day

---

_This report covers findings as of 2026-05-31. Re-audit recommended after remediation._

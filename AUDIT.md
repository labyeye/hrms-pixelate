# HRMS Application — CTO Security & Code Quality Audit

> Generated: 2026-06-26  
> Scope: Full codebase — backend (Node.js/Express), frontend (React/Vite), mobile (React Native)  
> Auditor: Claude Code (CTO-level review)

---

## Quick Summary

| Severity    | Count |
| ----------- | ----- |
| 🔴 CRITICAL | 4     |
| 🟠 HIGH     | 7     |
| 🟡 MEDIUM   | 9     |
| 🟢 LOW      | 10    |

**Fix CRITICALs before any production release. Fix HIGHs within 48 hours of deployment.**

---

## 🔴 CRITICAL Issues

### C-1 — Unauthenticated Biometric Routes

- **File:** `backend/routes/biometricRoutes.js` lines 36–40
- **Issue:** `/biometric/register`, `/biometric/record`, and `/biometric/device/:token/*` have NO `protect` middleware. Any unauthenticated caller can write biometric/attendance data.
- **Fix:** Add `protect` middleware before every route that isn't intentionally public, or implement device-token validation on ADMS device routes.

---

### C-2 — Unauthenticated ADMS Upload Routes

- **File:** `backend/routes/admsRoutes.js` lines 298–423
- **Issue:** All `/iclock/*` and `/cdata` endpoints accept attendance data with zero authentication. An attacker can forge attendance logs by POSTing directly.
- **Fix:** Validate an API key or signed device token on every ADMS endpoint before processing data.

---

### C-3 — Path Traversal in Document Download

- **File:** `backend/controllers/employeeController.js` lines 517–536
- **Issue:** `downloadEmployeeDocument` does `path.join(__dirname, "../", docPath)` where `docPath` comes directly from the request. An attacker sending `../../etc/passwd` can read any file on the server.
- **Fix:**
  ```js
  // Store only a document ID in the database; resolve the real path server-side
  const allowed = path.resolve(__dirname, "../uploads");
  const abs = path.resolve(allowed, safeFileName);
  if (!abs.startsWith(allowed))
    return res.status(403).json({ message: "Forbidden" });
  res.download(abs);
  ```

---

### C-4 — No Rate Limiting on Password Reset

- **File:** `backend/controllers/authController.js` lines 255–285
- **Issue:** `/reset-password/:token` has no brute-force protection. Tokens can be enumerated in a loop.
- **Fix:** Apply `express-rate-limit` (max 5 attempts / 15 min per IP) on all auth endpoints. Also verify token expiry strictly server-side.

---

## 🟠 HIGH Issues

### H-1 — Hardcoded Backend URL in Mobile App

- **File:** `NestHR/src/api/api.ts` line 3
- **Issue:** `baseURL` is hard-coded as `https://hrms-backend.pixelatenest.com/api`. Cannot switch to staging/dev without recompiling.
- **Fix:** Use `react-native-config` or Expo's `APP_VARIANT` + `.env` files for environment-specific URLs.

---

### H-2 — CORS Fails Open if Env Var is Missing

- **File:** `backend/server.js` lines 27–43
- **Issue:** If `ALLOWED_ORIGINS` is empty or unset, CORS silently falls back to hardcoded localhost. In a misconfigured prod deploy, origin checking is bypassed.
- **Fix:** In `server.js`, add startup validation:
  ```js
  if (process.env.NODE_ENV === "production" && !process.env.ALLOWED_ORIGINS) {
    throw new Error("ALLOWED_ORIGINS must be set in production");
  }
  ```

---

### H-3 — Duplicate Auth Logic in Admin Routes

- **File:** `backend/routes/adminRoutes.js` lines 7–25
- **Issue:** `protectPlatformAdmin` re-implements JWT verification instead of reusing `auth.js` middleware. Two separate JWT implementations that can drift apart.
- **Fix:** Extend `auth.js` `authorize()` to accept a `platformAdmin` role, delete duplicate logic.

---

### H-4 — No Rate Limiting on OTP / Forgot-Password Enumeration

- **File:** `backend/controllers/authController.js` lines 217–253, 428–455
- **Issue:** While responses are normalised, unlimited requests allow timing-based user enumeration and OTP abuse.
- **Fix:** `express-rate-limit` — max 3 per hour per IP on `/forgot-password` and `/otp/send`.

---

### H-5 — File Upload MIME Spoofing

- **File:** `backend/middleware/upload.js` lines 32–35
- **Issue:** Only MIME type (client-supplied header) is checked — not the actual file magic bytes. An attacker can rename `shell.php` → `invoice.pdf` and upload it.
- **Fix:** Use the `file-type` npm package to validate magic bytes after upload, before saving.

---

### H-6 — 2FA Backup Codes Not Rate-Limited

- **File:** `backend/controllers/authController.js` lines 403–408
- **Issue:** Backup codes can be brute-forced — no attempt counter or lockout.
- **Fix:** Log every failed 2FA attempt; lock the account after 10 consecutive failures.

---

### H-7 — Base64 Files Stored Directly in MongoDB

- **File:** `backend/controllers/documentController.js` lines 24–26
- **Issue:** Documents are base64-encoded and stored inline in MongoDB. This bloats the database, hurts performance, and makes file scanning impossible.
- **Fix:** Store files on disk (`/uploads`) or in S3/R2; keep only the URL/path in the database.

---

## 🟡 MEDIUM Issues

### M-1 — Sensitive Data in Console.log (Production)

- **Files:**
  - `backend/routes/admsRoutes.js` lines 73–180 (phone numbers, employee names)
  - `backend/controllers/biometricController.js` lines 36–39
  - `backend/controllers/billingController.js` line 409
  - `backend/routes/statsRoutes.js` line 314
- **Issue:** Debug logs containing PII (phone, names, company IDs) are written to stdout in production.
- **Fix:** Replace all `console.log` with a proper logger (`winston` or `pino`) and set log level to `warn` in production.

---

### M-2 — No CSRF Protection

- **Files:** All POST/PUT/DELETE routes
- **Issue:** State-changing requests have no CSRF token. If a logged-in user visits a malicious page, cross-site requests can be made on their behalf.
- **Fix:** Use `csurf` middleware or `SameSite=Strict` cookies + custom `X-Requested-With` header check.

---

### M-3 — Content Security Policy Disabled

- **File:** `backend/server.js` lines 21–25
- **Issue:** `contentSecurityPolicy: false` completely disables CSP headers, leaving the frontend vulnerable to XSS.
- **Fix:** Enable CSP:
  ```js
  helmet({
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'self'"], scriptSrc: ["'self'"] },
    },
  });
  ```

---

### M-4 — JWT Secret Not Validated on Startup

- **Files:** `backend/server.js`, auth middleware
- **Issue:** If `JWT_SECRET` is missing from `.env`, the server starts normally but all tokens are signed with `undefined`, making them trivially forgeable.
- **Fix:** Add at the top of `server.js`:
  ```js
  const required = ["JWT_SECRET", "MONGO_URI", "ALLOWED_ORIGINS"];
  required.forEach((k) => {
    if (!process.env[k]) throw new Error(`Missing env: ${k}`);
  });
  ```

---

### M-5 — Regex on Phone Number (Potential ReDoS)

- **File:** `backend/controllers/authController.js` lines 436, 469
- **Issue:** `new RegExp(normalised.replace(...))` — user-controlled input in a regex constructor. If the normalisation is insufficient, an attacker can trigger catastrophic backtracking.
- **Fix:** Use exact string match: `Employee.findOne({ phone: normalised })`.

---

### M-6 — Error Stack Traces Potentially Leaked

- **File:** `backend/middleware/errorHandler.js` lines 1–38
- **Issue:** Stack traces may appear in non-development responses depending on configuration.
- **Fix:** Ensure `process.env.NODE_ENV === "production"` gates stack trace output; never send stack to client in production.

---

### M-7 — File Names Not Sanitised

- **File:** `backend/middleware/upload.js` lines 25–28
- **Issue:** File names derived from user input. Special characters could cause issues on some filesystems or when serving files.
- **Fix:** Sanitise to alphanumeric + underscore + extension only:
  ```js
  const safe = originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
  ```

---

### M-8 — No Request Timeout

- **File:** `backend/server.js`
- **Issue:** Long-running database queries or external calls can hang a request indefinitely, enabling slowloris-style DoS.
- **Fix:** Add `connect-timeout` middleware or use mongoose `serverSelectionTimeoutMS`.

---

### M-9 — TypeScript `any` Types in API Service

- **File:** `frontend/src/services/api.ts`
- **Issue:** Most API call return types are `any`, undermining TypeScript's safety guarantees. Type errors can slip through silently.
- **Fix:** Define proper return types using interfaces from `frontend/src/types/hrms.ts` for every API function.

---

## 🟢 LOW Issues

### L-1 — Empty Catch Blocks

- **File:** `backend/controllers/authController.js` line 247
- **Issue:** Email sending failure is silently swallowed with `catch {}`. Errors are invisible in logs.
- **Fix:** `catch (err) { logger.warn("Email send failed", err); }`

---

### L-2 — Magic Numbers in Attendance Logic

- **File:** `backend/routes/admsRoutes.js` lines 52–59
- **Issue:** Grace period (15 min), half-day threshold (120 min) are hardcoded. Must redeploy to change.
- **Fix:** Move to the `Setting` model so admins can configure via UI.

---

### L-3 — Inconsistent API Response Format

- **Files:** Multiple controllers
- **Issue:** Some endpoints return `{ success, message, data }`, others return `{ error }` or raw objects. Frontend must handle multiple shapes.
- **Fix:** Enforce a single response wrapper:
  ```js
  { success: boolean, data?: any, message?: string, error?: string }
  ```

---

### L-4 — No API Versioning

- **File:** `backend/server.js` (route registration)
- **Issue:** All routes at `/api/*`. Breaking changes will break existing mobile clients that can't be force-updated.
- **Fix:** Register all routes under `/api/v1/`. Reserve `/api/v2/` for future breaking changes.

---

### L-5 — Health Check Leaks Server Info

- **File:** `backend/server.js` lines 96–98
- **Issue:** `/api/health` is public and may expose version/env info to unauthenticated callers.
- **Fix:** Return only `{ status: "ok" }` with no version/environment details.

---

### L-6 — Unused `fs`/`crypto` Imports

- **File:** `backend/controllers/employeeController.js` lines 1–3
- **Fix:** Remove any import not directly used in the file.

---

### L-7 — TODO/Placeholder Comments Left in Code

- **Files:** Scattered across controllers
- **Fix:** Resolve all TODO comments or file them as GitHub Issues and remove from code.

---

### L-8 — No Input Size Limits on Unprotected Endpoints

- **File:** `backend/routes/biometricRoutes.js` line 38
- **Issue:** Large payloads to `/biometric/record` could cause OOM with no body size cap.
- **Fix:** Use `express.json({ limit: "50kb" })` or tighten per-router limits.

---

### L-9 — Empty JSX Comments in Frontend

- **File:** `frontend/src/App.tsx` lines 122, 333
- **Issue:** Leftover `{}` or empty comment blocks suggest removed code.
- **Fix:** Delete them.

---

### L-10 — Mobile App Token Stored in AsyncStorage

- **File:** `NestHR/src/api/api.ts`
- **Issue:** JWT stored in `AsyncStorage` is accessible to any JS running in the app (including 3rd-party SDKs). On rooted devices it's readable on disk.
- **Fix:** Use `react-native-keychain` or Expo SecureStore for token storage.

---

## Immediate Action Plan (Priority Order)

1. **Today — CRITICAL fixes**
   - [ ] Add `protect` middleware to all biometric/ADMS routes (C-1, C-2)
   - [ ] Fix path traversal in document download (C-3)
   - [ ] Add rate limiting to password reset (C-4)

2. **This week — HIGH fixes**
   - [ ] Move mobile base URL to env config (H-1)
   - [ ] Add startup env-var validation (H-2 + M-4)
   - [ ] Unify auth middleware (H-3)
   - [ ] Add rate limiting to OTP/forgot-password (H-4)
   - [ ] Add magic-byte file validation (H-5)
   - [ ] Add 2FA attempt counter (H-6)
   - [ ] Move file storage off MongoDB (H-7)

3. **Next sprint — MEDIUM fixes**
   - [ ] Replace all `console.log` with `winston`/`pino` (M-1)
   - [ ] Enable CSRF protection (M-2)
   - [ ] Re-enable CSP headers (M-3)
   - [ ] Fix regex on phone number (M-5)
   - [ ] Type all API service functions (M-9)

4. **Backlog — LOW fixes**
   - [ ] Standardise API response format (L-3)
   - [ ] Add API versioning `/api/v1/` (L-4)
   - [ ] Move magic numbers to settings (L-2)
   - [ ] Use SecureStore for mobile JWT (L-10)
   - [ ] Clean up TODO comments, empty JSX (L-7, L-9)

---

## Recommended Dependencies to Add

```bash
# Backend
npm install express-rate-limit file-type winston helmet

# Mobile
npm install react-native-keychain  # or expo-secure-store
```

---

_This file was auto-generated by a CTO-level audit. Re-run after each major feature._

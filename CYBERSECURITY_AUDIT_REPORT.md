# NestHR (hrms) — Cybersecurity & Code-Quality Audit

|                            |                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Scope**                  | `backend/` (Node/Express/Mongoose), `frontend/` (React/Vite), `face-service/` (FastAPI), config, dependencies. The React-Native app (`NestHR/`) was reviewed only where it talks to the same API.                                                                                                                                                                                                                                                                    |
| **Date**                   | 2026-10-17                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **Method**                 | Manual review of every route file + auth/upload/billing/biometric/employee/loan/payroll controllers · `npm audit` (backend + frontend) · `tsc --strict-unused` · `knip` · `depcheck` · ESLint (`no-unused-vars`, `no-undef`, `no-empty`) · custom scanners (unscoped queries, DB-calls-in-loops, unbounded `find()`, orphan files) · targeted proof checks (Mongoose/qs casting behaviour, **no requests were sent to any live system and no live DB was touched**). |
| **Relation to `AUDIT.md`** | The June audit is re-validated here. Items it listed as Critical that are now fixed in code (path traversal in document download, CORS fail-open, JWT env validation, CSP, magic-byte checks, auth rate limits, request timeout) are **not** repeated. Items still open are carried over and marked ♻.                                                                                                                                                               |

**Confidence legend** — ✅ verified in code (and, where marked 🧪, with a no-DB behaviour check) · 🔎 strong inference from code, needs a runtime test before you rely on exact impact.

---

## 1. Executive summary

| Category                   | Critical | High | Medium | Low/Info |  Total |
| -------------------------- | -------: | ---: | -----: | -------: | -----: |
| Security                   |        2 |    7 |      8 |        6 | **23** |
| Bugs                       |        – |    2 |      5 |        3 | **10** |
| Dead / extra code          |        – |    – |      3 |        3 |  **6** |
| Performance / optimisation |        – |    2 |      4 |        2 |  **8** |

**The five things that matter most**

1. **Any logged-in employee can approve their own loan, create active loans, and edit shifts / salary heads / designations / offer-letter templates / transactions** — the routes only check "logged in", the controllers check no role (HR-S01).
2. **Unauthenticated NoSQL-operator injection on the biometric/attendance device endpoints** lets a stranger forge attendance and overwrite face templates for the first company in the database (HR-S02) 🧪.
3. **2FA can be attacked without the password**: the second login step takes only a `userId` (which the first step hands out) and a code (HR-S03).
4. **Aadhaar / PAN / resume scans are publicly downloadable** from `/uploads/...` at predictable file names, bypassing the "protected" download endpoint; the HR screen's links to that protected endpoint don't even work (401) (HR-S05, HR-B02).
5. **Cross-tenant tampering through `POST /employees`**: an HR user of company A can overwrite the role of any user in company B by "adding" that email as an employee, and an `hr_manager` can mint `super_admin`s (HR-S08).

---

## 2. Security findings

### Critical

**HR-S01 — Broken function-level authorization (BFLA)** ✅

- `routes/shiftRoutes.js`, `designationRoutes.js`, `salaryHeadRoutes.js`, `offerLetterRoutes.js`, `transactionRoutes.js`, `loanRoutes.js`, `paymentMethodRoutes.js`: every method is `protect` only. The matching controllers contain no role check (only `getLoans` branches on `employee`).
- Impact: an employee can `PUT /api/loans/:id/status {status:"approved"}` on their own pending request, `POST /api/loans` to create an _active_ loan for anyone, rewrite salary heads / shifts (which feed payroll), edit offer-letter templates, create/alter transactions, and delete any of these.
- Fix: `authorize("super_admin","hr_manager")` on all mutating routes (reads stay open where employees need them); loan creation/approval/update/delete HR-only; employees keep `POST /loans/request`.

**HR-S02 — NoSQL operator injection → auth bypass on device endpoints** ✅🧪

- Nothing in the app sanitises `req.body` / `req.query`. `express.json` and the default `qs` query parser both produce objects, and Mongoose casting keeps `$ne` etc. (🧪 `{deviceToken:{$ne:null}}` and `SN[$ne]=x` both survive casting).
- `POST /api/biometric/record` and `/device-face-enroll` (unauthenticated) do `findOne({deviceToken, isActive:true})`, so `deviceToken: {"$ne": null}` matches the first active device → attacker marks attendance for any employee id of that company (`method:"pin"` accepts a bare `employeeId`) or overwrites face descriptors. `/iclock/*` (ADMS) does the same with `?SN[$ne]=x`.
- Fix: a global sanitiser that removes `$`-prefixed / dotted keys from `body`, `query`, `params`; explicit `typeof === "string"` checks on `deviceToken` / `SN`.

### High

**HR-S03 — 2FA second step is not bound to the password step** ✅ (`authController.login`, `verify2FA`)
`login` returns `{requires2FA:true, userId}`; `/auth/2fa/verify` accepts `{userId, token}` with no proof that the password was entered. A user id is not secret (it appears in many API payloads). An attacker can guess TOTP codes for any account with 2FA (10 guesses / 30 min / account), or lock any user's 2FA login. Fix: short-lived signed `pendingToken` issued at step 1; `verify2FA` consumes it. (`protect` must reject such tokens as sessions.)

**HR-S04 — ADMS (`/iclock/*`) authenticates by serial number only** ✅ ♻ (AUDIT C-2)
Serial numbers are printed on the device and enumerable; there is no shared secret. Combined with HR-S02 no serial is even needed. Fix (this audit): type-check SN, require the device to be registered **and activated**, rate-limit; recommended next: per-device secret in the push URL / IP allow-list.

**HR-S05 — KYC files publicly readable** ✅
`app.use("/uploads", express.static(...))` serves _everything_, including `employee-aadhaar/`, `employee-pan/`, `employee-resume/` with deterministic names `<companyId>_<employeeId>_<field>.<ext>`, `leave-docs/` and `employee-docs/`. The authenticated download endpoints are therefore pointless. Fix: serve only `company-logos/`, `avatars/`, `attendance-selfies/` publicly; everything else only through authenticated endpoints; add a random suffix to new selfie names.

**HR-S06 — Biometric template exposure** ✅ (`GET /biometric/face-descriptors`)
Any authenticated employee receives the 128-d face descriptors of the whole company, and `POST /biometric/face-attendance` matches a descriptor server-side — so an employee can mark any colleague present, and sensitive biometric data leaks (DPDP "sensitive personal data"). Fix: restrict both to `super_admin` / `hr_manager` (the kiosk page is operated by HR).

**HR-S07 — Stored XSS → session theft via print windows** ✅
`window.open("")` + `document.write(` with unescaped interpolation (employee names, designations, notes, company name) in `EmployeePayrollPage`, `EmployeeReportPage`, `PayrollPage`, `ReportsPage` (×2), `BillingPage` / `buildInvoiceHTML`, `reportPrintHTML`. These windows are same-origin and the JWT lives in `localStorage` ⇒ a malicious employee name runs script with the HR user's token. Fix: central print helper that injects a `script-src 'none'` CSP into every generated document (neutralises injected script/handlers without touching hundreds of interpolations) + escape in the helpers that build rows.

**HR-S08 — Privilege escalation & cross-tenant role overwrite** ✅ (`employeeController.createEmployee`, `bulkImportEmployees`)
(a) `role` is taken from the body, so an `hr_manager` can create/promote a `super_admin`. (b) If `User.findOne({email})` finds a user from **any** company, the code overwrites that user's `role` and links the new Employee to it — a cross-tenant write. Fix: only a `super_admin` may grant `super_admin`/`hr_manager`; reuse an existing user only if it belongs to the same company, otherwise 409.

**HR-S09 — Mass assignment** ✅
`Shift.create({...req.body, company})`, `findOneAndUpdate(filter, req.body)` in shift/designation/offer-letter/loan/transaction/salary-head controllers: client controls `status`, `remainingBalance`, `approvedBy`, and (on update) `company`, which moves the document into another tenant. Fix: field whitelists; never accept `company`, `_id`, `createdBy`, `approvedBy`, `status` (loans) from the body.

### Medium

**HR-S10 — OTP brute-force** ✅ — login OTP, reset OTP and phone-verify OTP are 6 digits / 10 min with only a per-IP limiter. Add a per-account attempt budget (5 wrong → code invalidated). OTPs are stored as unsalted SHA-256 (trivially reversible if the DB leaks) → HMAC with a server secret.
**HR-S11 — JWT hygiene** ✅ — 30-day lifetime, no revocation on password change/reset. Add `tokenVersion` embedded in the JWT; bump on password change/reset; `protect` rejects mismatches (existing tokens keep working until the first password change).
**HR-S12 — Account lockout / enumeration** ✅ — no per-account login throttle; `GET /auth/forgot-password/methods` reveals whether an email has WhatsApp/TOTP reset; anyone can burn a victim's 10 TOTP attempts via `/auth/reset-password/otp/totp` (lock-out DoS). Add login lockout (5 fails → 15 min), uniform responses.
**HR-S13 — Webhook hardening** ✅ — WhatsApp webhook falls back to a hard-coded verify token (`nesthr_verify_token`), never verifies `X-Hub-Signature-256`, and logs full headers + bodies (PII). CRM/stats secrets are compared with `!==` (timing) and the stats key is accepted in the **query string** (written to logs by `morgan("dev")`).
**HR-S14 — Billing replay / ownership** ✅ — `verifyRazorpayPayment` → `_activateSubscription` is not idempotent: re-posting a valid (orderId, paymentId, signature) creates another invoice, increments the offer-code `usedCount`, re-sends notifications; subscription lookup is not tied to the caller's company. Invoice numbers use `countDocuments()+1` (race/duplicates).
**HR-S15 — Upload handling** ✅ — avatar/logo/selfie accept any `image/*` from the _client-declared_ MIME (SVG ⇒ stored XSS when opened from the API origin) and skip the magic-byte check; multer file names embed raw `req.params.id` (an encoded `..%2f` yields a path-traversal _write_); `validateMongoId` is imported in `employeeController` but never used.
**HR-S16 — Face service fails open** ✅ — `if API_KEY and key != API_KEY` ⇒ no key configured = no auth; `ecosystem.config.js` ships `FACE_SERVICE_API_KEY: "CHANGE_ME"`; comparison not constant-time.
**HR-S17 — Vulnerable dependencies** ✅ (`npm audit`)
Backend: **critical** `proxy-addr` (IP spoofing via IPv4-mapped IPv6 — matters because `trust proxy` is on and rate limits key on IP); **high** `axios`, `multer` (DoS), `nodemailer` (file-read/SSRF via `raw` option; fix is a major); moderate `express/body-parser/qs`, `mongoose` (prototype pollution in update casting), `morgan` (log forging), `file-type`.
Frontend: **high** `pdfjs-dist` (JS execution on malicious PDF), `xlsx` (prototype pollution, **no npm fix**); moderate `react-router(-dom)` (open redirect), `dompurify`.

### Low / informational

- **HR-S18** `POST /api/attendance/auto-mark` runs the _global_ auto-mark job (all tenants) for any one tenant's HR — cross-tenant side effect / cheap DoS. ✅
- **HR-S19** Push-subscription upsert/delete keyed only by `endpoint` — one user can overwrite or delete another's subscription. ✅
- **HR-S20** `backend/backups/pre-tier-update-*.json` holds real tenant PII + a bcrypt hash inside the repo tree; `scripts/deleteAllUsers.js` is a destructive script next to prod code; `morgan("dev")` logs full URLs (device tokens are in URL paths, stats key in query). ✅
- **HR-S21** Password policy is inconsistent: model `minlength: 6`, HR can set 6-char passwords, strong policy only on self-service flows; bcrypt cost 10. ✅
- **HR-S22** JWT in `localStorage` (and AsyncStorage on mobile) — amplifies any XSS; cookie-based sessions are a larger redesign (recommendation only). ✅
- **HR-S23** `POST /api/auth/register` is public and creates a company-less `super_admin` (intended onboarding step, but company-scoped controllers then see `company: undefined` filters — safe today only because every tenant document has a company). 🔎

---

## 3. Bugs

| ID     | Sev  | Finding                                                                                                                                                                                                                                                                                                                                                                                               |
| ------ | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HR-B01 | High | `MyLoansPage` calls `loanAPI.request(...)` which **does not exist** in `frontend/src/services/api.ts` → the employee "Request loan/advance" button throws `TypeError` (backend `/loans/request` exists). ✅                                                                                                                                                                                           |
| HR-B02 | High | `EmployeesPage` links Aadhaar/PAN/resume with a plain `<a href=".../employees/:id/documents/:type">`; that route needs a Bearer header, which links can't send ⇒ **always 401**. (Hidden today because the public `/uploads` copy exists — see HR-S05.) ✅                                                                                                                                            |
| HR-B03 | Med  | 20 TypeScript errors: `AppLayout` called without required `title` (AuditLogPage, ExitManagementPage, TrashPage), loan `status`/`avatar` type mismatches, `resumeDoc` missing in `docFiles` type, `TasksPage` duplicate `EmployeeOption` types, `usePushNotification` `Uint8Array` typing, icon type in `DashboardPage`; `framer-motion` declared but not installed locally (stale `node_modules`). ✅ |
| HR-B04 | Med  | Employee id `EMP####` = last record + 1 (read-then-write) ⇒ duplicate ids under concurrent creates / bulk import. ✅                                                                                                                                                                                                                                                                                  |
| HR-B05 | Med  | Invoice number `INV-HRMS-####` from global `countDocuments()+1` ⇒ duplicates under concurrency, numbering shared across tenants. ✅                                                                                                                                                                                                                                                                   |
| HR-B06 | Med  | Subscription (re)activation sets `renewalDate = now + period`, discarding remaining paid days on early renewal. ✅                                                                                                                                                                                                                                                                                    |
| HR-B07 | Med  | Payroll silently skips any employee with **zero** attendance rows (no record, no warning). ✅                                                                                                                                                                                                                                                                                                         |
| HR-B08 | Low  | 8 empty `catch {}` blocks swallow errors (e.g. reset-email failure in `forgotPassword`). ✅                                                                                                                                                                                                                                                                                                           |
| HR-B09 | Low  | `authorize("admin")` in leave/settings routes — `admin` is not in the role enum (dead role string). ✅                                                                                                                                                                                                                                                                                                |
| HR-B10 | Low  | `scripts/seedFresh.js` references undefined `hrExec` (runtime ReferenceError). ✅                                                                                                                                                                                                                                                                                                                     |

## 4. Dead / extra code

- **HR-D01** Frontend: **74** unused imports/locals in 25 files (worst: `ReportsPage` 19, `EmployeeDashboard` 10, `DashboardPage` 5); **13 unused runtime deps** (`@radix-ui/react-{alert-dialog,avatar,checkbox,dropdown-menu,label,popover,progress,scroll-area,separator,tabs,toast,tooltip}`, `date-fns`, `sonner`) and 5 unused dev deps; unused files `components/ui/tabs.tsx`, `components/ui/use-toast.ts` (duplicate of `hooks/use-toast.ts`); unused exports (`navItems`, `getNavForRole`, `getInitials`, `payrollConfigAPI`, `companyAPI`, `branchAPI`, `downloadFile`, …). `@tanstack/react-query` is installed and wrapped around the app but **never used** (0 `useQuery`).
- **HR-D02** Backend: 24 unused variables (pdfService ×4, payrollController ×3, trashController ×2 …), `services/crmSignupWebhookService.js` is never required (dead feature), unused exports (`validateQuery`, `getWorkingDays`, `getPayPeriod`).
- **HR-D03** 71 `console.log` calls in the backend (WhatsApp webhook prints full requests with emoji banners, OTP flow logs phone numbers) — debug noise and a privacy leak.
- **HR-D04** `resolveSelfEmployee` (find employee by user, fallback to email, then write the link) is copy-pasted in ≥6 controllers; IST-offset helpers repeated. (Also in `PONYTAIL_AUDIT.md`.)
- **HR-D05** Hand-rolled `Math.random()` IDs/passwords where `crypto` exists (see `PONYTAIL_AUDIT.md`); duplicated print-HTML scaffolding.
- **HR-D06** `backups/` JSON and `scripts/deleteAllUsers.js` live in the deployable tree.

## 5. Performance / optimisation

- **HR-P01 (High)** `processPayroll`/preview loop: 7 sequential DB round-trips **per employee** (existing payroll, attendance, transactions, loans, …). For 300 staff ≈ 2,100 queries per run. Batch with `$in` + in-memory maps.
- **HR-P02 (High)** `jobs/attendanceAutoMark.js`: ≥6 awaited queries per employee per company in a nightly loop; same batching pattern.
- **HR-P03 (Med)** `departmentController`/`designationController` run one `countDocuments` per row → one aggregation.
- **HR-P04 (Med)** 6 places load **every** company employee just to test membership of one id (`updateAttendance`, leaves, …) → `Employee.exists({_id, company})`.
- **HR-P05 (Med)** 52 `find()` calls with no `.limit()`/pagination (assets, tasks, tickets, loans, transactions, trash, payroll export …). Unbounded response size as tenants grow.
- **HR-P06 (Med)** No response compression; read-only heavy queries don't use `.lean()`; `/uploads` served by Node without cache headers.
- **HR-P07 (Med)** Frontend: **no route-level code splitting** (`lazy()` count 0), 37k lines of page code (`ReportsPage` 4,980 lines, `EmployeesPage` 4,302), heavy libs (`xlsx`, `jspdf`, `pdfjs-dist`, `@vladmandic/face-api`, `framer-motion`) land in the entry chunk; no server-state cache (react-query unused) so every screen refetches.
- **HR-P08 (Low)** `react-query` + `sonner` + 12 Radix packages are installed but unused → larger install, bigger audit surface.

---

## 6. Remediation plan (phases)

| Phase | Theme                                          | Items                                                                 | Risk of change                                                    |
| ----- | ---------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| **1** | Stop the bleeding — access control & injection | S01 S02 S04 S06 S08 S09 + global sanitiser                            | Low–Med (HR-only routes; employees' self-service paths unchanged) |
| **2** | Authentication & sessions                      | S03 S10 S11 S12 S21 (clients updated for 2FA)                         | Med — needs web + mobile client change for 2FA; deploy together   |
| **3** | Data exposure, uploads, webhooks, XSS          | S05 S07 S13 S14 S15 S16 S18 S19 S20 + B02                             | Med                                                               |
| **4** | Dependencies                                   | S17 (`npm audit fix` non-breaking), pin notes for `nodemailer`/`xlsx` | Low                                                               |
| **5** | Functional bugs                                | B01 B03 B04 B05 B06 B08 B09 B10                                       | Low                                                               |
| **6** | Dead & extra code                              | D01–D06                                                               | Low                                                               |
| **7** | Performance                                    | P01–P08                                                               | Med (behaviour-preserving refactors)                              |

A "Remediation log" with exactly what was changed, what was verified and what is deliberately left is appended at the end of this file after the fixes are applied.

---

## 7. Remediation log — applied 2026-10-17

Everything below was applied in the working tree (nothing committed). A pre-change snapshot of the repo (without `node_modules`/`uploads`) was taken before the first edit. Every change was checked offline — **no request was sent to any live system and the live database was never touched**.

### Verification that exists in the repo (re-runnable)

| Check                                       | What it proves                                                                                                                                                                                                                              | Result     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| `node scripts/check-authz.js`               | 29 route/role cases: employees get 403 on every HR-only endpoint, HR passes the guard, employees keep their own read/self-service routes; `deviceToken: {"$ne":null}` is rejected                                                           | all passed |
| `node scripts/check-auth-hardening.js`      | 2FA needs the pending token (bare `userId` refused, a session token is not a pending token and vice-versa), tokens die after a password change, OTP burns after 5 misses, 10 bad logins lock the account, unknown user ≈ bad password       | all passed |
| `node scripts/check-exposure.js`            | KYC folders return 404, avatars/logos/selfies still public, `avatars/..%2Femployee-aadhaar` traversal blocked (**this test caught a bypass in my first version of the guard — fixed**), WhatsApp handshake/signature, stats key header-only | all passed |
| `node scripts/check-auth-otp.js` (existing) | the earlier WhatsApp-OTP / TOTP flows still behave                                                                                                                                                                                          | passed     |
| payroll differential test                   | original `processPayroll` vs the batched one on the same data → **identical payroll rows, loan and transaction updates**                                                                                                                    | identical  |
| `tsc` (frontend)                            | was **20 errors**, now **0**                                                                                                                                                                                                                | clean      |
| `vite build`                                | still builds after the dependency changes; **entry chunk 4,596 kB → 311 kB** (gzip 1,310 kB → 97 kB)                                                                                                                                        | ok         |

### Phase 1 — access control & injection ✅

S01 HR-only guards on shifts / designations / salary heads / offer letters / transactions / loans (employees keep `GET /loans` for themselves and `POST /loans/request`) · S02 `middleware/sanitize.js` strips `$`/dotted/prototype keys from body+query globally, and device/ADMS endpoints require a string `deviceToken`/`SN` · S06 face descriptors + face attendance → HR only · S08 only `super_admin` can grant `super_admin`/`hr_manager`; existing logins from another organisation can no longer be linked or re-roled (409, or a row error in bulk import) · S09 `utils/bodyFor.js` whitelists writable fields (never `company`/`_id`/`createdBy`); loans/transactions must reference an employee of the caller's company · S18 manual auto-mark only touches the caller's company.

### Phase 2 — authentication & sessions ✅

S03 `login` returns a 5-minute signed `pendingToken`; `/auth/2fa/verify` requires it (web **and** mobile clients updated) · S10 OTPs are HMAC-keyed, compared in constant time and burn after 5 wrong tries (login, reset, phone-verify) · S11 `tokenVersion` in the JWT, bumped on every password change/reset; `protect` rejects stale tokens and any token carrying a `purpose` claim; HS256 pinned; a self password change returns a fresh token so the user's own session continues · S12 10 failed logins → 15-minute lock, dummy bcrypt compare for unknown users · S21 admin-set passwords need 8–128 chars with a letter and a digit; bcrypt cost 10 → 12.

### Phase 3 — exposure, uploads, webhooks, XSS ✅

S05 `/uploads` only serves `company-logos`, `avatars`, `attendance-selfies` (with `nosniff` + sandbox CSP); HR now opens Aadhaar/PAN/resume through an authenticated fetch (also fixes B02) · S07 every print window goes through `writePrintDocument`, which injects a `script-src 'none'` CSP; inline print scripts were replaced by opener-driven printing; the report/invoice builders escape their values · S13 no default webhook verify token, optional `X-Hub-Signature-256` check (enforced when `META_WA_APP_SECRET` is set), webhook logs no longer print headers/bodies/tokens, CRM/stats secrets compared in constant time, stats key header-only (the CRM dashboard already uses the header), access log has no query strings and masks device tokens · S14 billing verify is idempotent (same payment id ⇒ "already processed"), bound to the caller's company, invoice numbers come from an atomic counter · S15 avatar/logo/selfie accept only JPEG/PNG/WEBP, extensions come from the verified type, random file names, `:id` validated, avatar upload scoped to the caller's company and magic-byte checked, the logo handler can no longer crash the process · S16 the face service rejects every request when its key is unset and compares in constant time · S20 `backups/` and `uploads/` added to `backend/.gitignore`.

### Phase 4 — dependencies ✅ (partly)

Backend `npm audit fix` (no `package.json` range changes): **critical `proxy-addr`, high `axios` and `multer`, and `express`/`body-parser`/`qs`/`mongoose`/`morgan` fixed → 10 findings down to 2.** Frontend: `pdfjs-dist` and `dompurify` fixed.
**Deliberately not done** (needs a decision from you): `nodemailer` ≥ 10 (breaking; needs Node ≥ 20 on the server — confirm, then `npm i nodemailer@^10.1.2`) · `file-type` ≥ 22 (ESM-only; needs a dynamic `import()` in `validateMagicBytes`, Node ≥ 20) · `xlsx` (no npm fix; the official fixed builds are distributed from `cdn.sheetjs.com`, e.g. `npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz`) · `react-router` (fix is a v7 major). The remaining frontend "high" items (`braces`, `micromatch`, `chokidar`, `fast-glob`, `tailwindcss`) are the build-time Tailwind toolchain, not shipped code.

### Phase 5 — bugs ✅

B01 `loanAPI.request` added (the Request-loan button works again) · B03 all 20 type errors fixed (3 pages now get real titles; `role`/`headOfDepartment` are optional while editing so an edit never silently resets a role) · B04 employee ids from an atomic per-company counter · B05 (with S14) · B07 payroll run reports `skipped: [{name, reason}]` instead of silently dropping employees (behaviour unchanged, the response gains a field) · B08 swallowed errors are logged · B09 phantom `admin` role removed · B10 seed script no longer references a user that is never created.
**Not changed:** B06 (early renewal keeping the remaining days) is a billing-policy decision — say how trials/early renewals should stack and it is a 5-line change.

### Phase 6 — dead & extra code ✅ (partly)

Removed ≈ 40 unused imports (ESLint autofix), 14 unused npm packages (`@radix-ui/react-*` ×12, `date-fns`, `sonner`), 2 dead files (`ui/tabs.tsx`, `ui/use-toast.ts`), 10 unused backend variables/functions/consts. Frontend "declared but never read" went **74 → 32**; backend unused vars **24 → 14** (the rest are in `scripts/`, an intentional `{_id, __v, ...rest}` omit, and the new test scripts).
**Left for you:** the 32 unused props/locals (mostly `departments`/`company` props threaded through `ReportsPage`'s report components — removing them touches ~20 call sites in a 4,980-line file), `services/crmSignupWebhookService.js` (never called: wire it in or delete it), `scripts/deleteAllUsers.js` (destructive; keep it out of production images), the duplicated `resolveSelfEmployee` (D04) and `Math.random` ids (D05) — see `PONYTAIL_AUDIT.md`.

### Phase 7 — performance ✅ (partly)

P01 payroll run: 4 queries per employee → 4 per run (proven identical output) · P02 nightly auto-mark: 1–2 queries per employee → 2 per company · P03 headcounts via one aggregation (departments, designations) · P04 attendance update no longer loads every employee · P06 gzip via `compression` (new dependency) · P07 route-level `React.lazy` for 41 pages + `Suspense`: **entry chunk −93 %**.
**Left:** P05 (52 unbounded `find()`s and attendance lists that build `employee: {$in: allCompanyEmployeeIds}`) — the clean fix is storing `company` on `Attendance` (index `{company, date}`) and paginating the list endpoints; that needs a data migration, so it is a planned change rather than a patch. react-query is still unused by the app (adopting it is a refactor, not a fix).

### Rollout notes (read before deploying)

1. **Deploy backend and web/mobile clients together** — the 2FA step now needs `pendingToken`. If published mobile builds can't be updated at once, set `LEGACY_2FA_USERID=true` temporarily; it re-opens the old weakness, so remove it as soon as clients update.
2. **Environment:** `META_WA_VERIFY_TOKEN` is now required for the WhatsApp handshake (the old hard-coded token no longer works); set `META_WA_APP_SECRET` to enforce webhook signatures; `FACE_SERVICE_API_KEY` must be set on **both** the face service and the backend, otherwise face enrol/attendance is refused.
3. Existing sessions keep working until the user's next password change; OTPs issued before the deploy stop working (10-minute codes).
4. New collection `counters` (created on first use) and new `User` fields — no migration needed.
5. Files already uploaded stay on disk; KYC/vault/leave files are simply no longer reachable by URL.
6. Run `npm install` in `backend/` (adds `compression`) and `frontend/` (removed packages).
7. The repository already had many uncommitted changes before this audit; review `git diff` per file when committing.

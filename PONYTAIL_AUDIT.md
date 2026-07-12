# Ponytail Audit — Over-engineered / bloated code

Repo-wide scan for logic that implements simple things with far more code than needed. Not a bug/security review (see `AUDIT.md` for that). Ranked biggest cut first.

- `delete:` custom `ToastProvider`/`useToast` reducer reinvents toast state while `sonner` (already a dependency, `^1.7.4`) and `@radix-ui/react-toast` sit unused. Replace with `import { toast } from "sonner"`. — `frontend/src/hooks/use-toast.ts:1-51`
- `shrink:` `ReportsPage.tsx` has 98 `useState` calls in one component — mostly repeated filter/date/loading triples per report section. Replace with one `useState<Record<reportKey, FilterState>>` map or a `useReducer`. ~60-70 lines. — `frontend/src/pages/ReportsPage.tsx` (4078 lines)
- `shrink:` `EmployeesPage.tsx` has 8 separate `useState(false)` modal flags with matching open/close/submit handlers. Replace with one `activeModal` enum state + a generic modal shell. — `frontend/src/pages/EmployeesPage.tsx` (4174 lines, 32 useState)
- `yagni:` `frontend/src/lib/validation.ts` (email/GST/PAN/UPI/IFSC regex) has no shared counterpart in `NestHR/` — mobile screens hand-roll their own date/validation logic per screen instead of importing one shared module. — `NestHR/src/screens/LeaveScreen.tsx`, `NestHR/src/screens/SupportScreen.tsx`
- `stdlib:` filename/id generation via `${Date.now()}_${Math.random().toString(36).slice(2)}` duplicated instead of `crypto.randomUUID()`. — `backend/controllers/documentController.js:48`, `backend/middleware/upload.js:132`, `frontend/src/hooks/use-toast.ts:28`
- `yagni:` status-badge color maps and avatar-initials/color helpers redefined per screen instead of one shared util. — `frontend/src/lib/reportPrintHTML.ts:36-59`, `NestHR/src/screens/EmployeesScreen.tsx:741`
- `yagni:` password generator (`chars.charAt(Math.floor(Math.random()*chars.length))` loop) reimplemented independently 4 times. Replace with one shared `generatePassword(len)` util. — `frontend/src/pages/EmployeeCredentialsPage.tsx:147,639,765`, `NestHR/src/screens/CredentialsScreen.tsx:36`
- `shrink:` `buildInvoiceHTML.ts` (379 lines) and `reportPrintHTML.ts` (326 lines) both hand-build full HTML docs with copy-pasted inline `<style>`/layout scaffolding. Replace with one shared `printDocument(sections, styles)` helper. ~150-200 combined lines.
- `native:` OTP/random-ID generation via ad-hoc `Math.random()` in 4+ places across the backend; consolidate into one `utils/randomId.js` using `crypto.randomInt`/`randomUUID`. — `backend/controllers/authController.js:489`

**net: ~-400 lines, -0 new deps (stops paying for a duplicate 50-line toast hook when `sonner` is already installed).**

## Priority

1. Toast hook deletion — free, no new dep, immediate win.
2. Shared util file (`validation.ts`, `format.ts`, `randomId.js`, `generatePassword.ts`) reused across `frontend/`, `NestHR/`, `backend/` — kills 4 different duplication findings at once.
3. `ReportsPage.tsx` / `EmployeesPage.tsx` state consolidation — biggest line-count win but riskiest (largest files in repo, touch with care and tests).

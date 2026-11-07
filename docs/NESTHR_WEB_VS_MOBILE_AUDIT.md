# NestHR — Web vs Mobile Audit (8 Nov 2026)

**Method:** static code audit — `hrms/frontend/src` (web, 41 pages) vs `hrms/NestHR/src` (RN app, 54 screens). Routes, tabs, report lists, handlers, shared components and keyword/feature scans compared. **Nothing was run in a browser or on a device**, so visual/spacing items are judged from layout code (grid/table/flex), not screenshots. Items marked `?` = not found by grep, confirm by hand.

Legend: ✅ present · ⚠️ partial · ❌ missing

---

## 1. Pages / screens

| Feature | Web | Mobile | Gap |
|---|---|---|---|
| Onboarding wizard (company → employees → plan → payment) | ✅ OnboardingPage | ❌ (only intro slides) | Web only |
| Welcome page, Payment-failed page | ✅ | ❌ | Web only |
| Manage → **User Roles** tab | ✅ | ❌ (Manage has 4 cards: Shifts, Salary Components, Designations, Offer Letters) | Web only |
| Employee-only "My Payroll", "My Report" pages | ✅ separate pages | ⚠️ no role branch in Payroll/Reports screens; only a "My Payslips" quick action | Check employee flow on mobile |
| Employee "My Loans" | ✅ | ✅ (LoansScreen switches on role) | Parity |
| Public device page `/device/:token` | ✅ | ❌ | Web only |
| Notifications screen, Face check-in / kiosk / enroll screens, Splash, Update prompt | ⚠️ bell panel + modals | ✅ dedicated | Mobile only |

## 2. Dashboard (admin)

| Item | Web | Mobile |
|---|---|---|
| Greeting + quick buttons (Employees, Leave Requests) | ✅ | ❌ |
| "Action needed" alert strip (pending leaves etc.) | ✅ | ❌ |
| KPI cards | ✅ 6 (Employees, Attendance %, Pending Leaves, New Hires, Monthly Payroll, Departments) | ⚠️ 4 (Total, Present, On Leave, Pending Leaves) — no New Hires / Payroll / Departments |
| KPI card click → page | ✅ | ✅ |
| Today's Attendance chart | ✅ | ❌ (donut exists only in employee dashboard) |
| Daily Attendance chart | ✅ | ✅ + 3M/6M/1Y range pills |
| Payroll Trend chart | ✅ | ✅ |
| Headcount by Department chart | ✅ | ❌ |
| Notifications widget | ✅ | ❌ (bell → screen only) |
| Recent Hires list | ✅ | ❌ |
| Pending Leave Requests list | ✅ | ❌ |
| Payable / Actual till today, Performance block | ❌ | ✅ (mobile only) |
| Pull-to-refresh | n/a | ✅ |

## 3. Employee (ESS) dashboard

| Item | Web (7 tabs) | Mobile |
|---|---|---|
| Overview: Personal / Work / Address & Documents cards | ✅ | ❌ on dashboard (partly in Profile screen) |
| Today's Shift, Approvals, Pending Salary | ✅ | ✅ |
| Company Announcements on dashboard | ✅ | ❌ (separate screen) |
| This Month's Balance, Recent Attendance | ✅ | ✅ |
| Recent Leaves | ✅ | ❌ |
| Performance Reviews card | ✅ | ❌ |
| Attendance Records tab, Payroll History tab | ✅ | ⚠️ via other screens, not on dashboard |
| Request Leave form (half-day, hours, dates, reason) | ✅ | ✅ (Apply Leave → Leave screen) |
| Check-in / Check-out buttons, Quick Actions, photo edit/remove | ⚠️ | ✅ |

## 4. Employees

| Item | Web | Mobile |
|---|---|---|
| **Excel import + template download** | ✅ (27 mapped columns) | ❌ (no document picker installed) |
| Export | ✅ | ✅ |
| Bulk select + bulk actions | ✅ | ✅ |
| Stat cards (Total, New Hires, Loan balance, Est. balance) | ✅ animated count-up | ⚠️ StatTile (static) |
| Table with many columns | ✅ | ❌ cards only (by design) |
| Status filter incl. **Exited** | ✅ | `?` not found |
| Document view/download behind WhatsApp OTP | ✅ | ❌ (OTP only on Documents screen) |
| Image crop on avatar upload | ✅ | ⚠️ camera/gallery, no crop |
| Face enroll / reset from Employees | ✅ | ⚠️ done from Attendance screen instead |
| Loan, advance, penalty, overtime, pay salary actions | ✅ | ✅ |
| Terminate, credentials, leave balance, attendance log, payment history | ✅ | ✅ |
| Use-my-location, pincode auto-fill | ✅ | ✅ |

## 5. Attendance / Leave / Payroll / Loans / Tasks etc.

| Page | Web has, mobile doesn't |
|---|---|
| Attendance | **Mark Absent** action; wider multi-column filter bar. (Mobile has extras: sort, self-mark, correction create, face kiosk) |
| Leave | WhatsApp-notify wording/flow, withdraw confirm, doc crop. Core approve/reject/edit/delete both ✅ |
| Payroll | **Mark slip received**; many print/preview paths (22 refs); multi-employee table select-all. Mobile has extras: Tally export, share payslip |
| Loans | **Excel import** |
| Tasks | **Excel import** |
| Holidays | **Excel import** |
| Departments | **Excel import** |
| Documents | Parity (OTP gate both) |
| Biometric | Web: separate Locations & Devices / ADMS-ESSL Sync / Activity Logs tabs, protocol log, fingerprint-enroll modal. Mobile: ADMS Sync + Logs, face enroll screen. Fingerprint enroll `?` not found on mobile |

## 6. Reports

| Item | Web | Mobile |
|---|---|---|
| Number of reports | **33** | **18** |
| Analytics tabs (Headcount / Attendance / Salary / PF-ESI charts) | ✅ | ❌ |
| Export | Print, CSV, **Excel (.xlsx)** | CSV (text share), PDF/print |
| Print-ready HTML preview | ✅ | ⚠️ native print only |

**15 reports missing on mobile:** Tally Export (exists in Payroll screen instead), PT Register, LWF Register, Loan Report, Bonus Report, Overtime Summary, Compliance Report, Early Going Summary, Excess Break Summary, PF Challan, ESIC Challan, Attendance In/Out (Vertical), Location-wise, Punch Log, Attendance History.

## 7. Settings

| Section | Web | Mobile |
|---|---|---|
| General Info / Company | ✅ | ✅ |
| **Bank Details** | ✅ | ❌ |
| **WhatsApp** (templates, numbers) | ✅ | ❌ |
| Salary Mode | ✅ | ✅ |
| **Punch Settings** | ✅ | ❌ (screen exists under Attendance Settings, confirm overlap) |
| **Employee App (ESS toggles)** | ✅ | ⚠️ "Features" block |
| **System / Preferences** | ✅ | ❌ |
| **Permissions (5-role matrix)** | ✅ | ❌ |
| Branch-wise settings | ✅ | ❌ |
| Account Security + 2FA | ✅ | ✅ (own screen) |
| Notifications | ❌ | ✅ |

## 8. Cards & data display

| Item | Web | Mobile |
|---|---|---|
| Summary cards on list pages | `StatCard` on 13 pages (Attendance, Leave, Payroll, Loans, Documents, Performance, Holidays, Late Approvals, Employees, My Loans…) | `StatTile` on only 3 (Employees, Holidays, Late Approvals); others use simple summary rows/chips |
| Clickable stat cards = filter | ✅ (Leave, Loans, Exit, Credits, Reports) | ⚠️ filter chips instead |
| Count-up numbers | ✅ everywhere StatCard is used | ⚠️ Dashboard, Loans, Tasks, Performance only |
| Tables (sortable, many columns) | ✅ | ❌ list/cards |
| Pagination | `limit=5000` + client side | `limit=5000` + FlatList |
| Tooltips (title) / hover | ✅ | n/a |
| Skeleton loaders | ⚠️ 2 pages | ❌ (spinners) |

## 9. Animations & effects

| Effect | Web | Mobile |
|---|---|---|
| Page fade-in | ✅ `page-fade-in` | ✅ stack transition |
| Staggered card rise (`nb-rise`, `--i` delay) | ✅ | ⚠️ `FadeInUp` on Dashboard/Employees/Attendance/Loans/Tasks/Perf only |
| Icon chip pop / slide-in | ✅ | ❌ |
| Hover lift + shadow shift (`nb-lift`) | ✅ | n/a (no press-scale feedback) |
| Modal pop-in | ✅ | ⚠️ centerModal, plain |
| Top loading bar | ✅ TopLoader | ❌ |
| Toasts | ✅ Toaster | ⚠️ Alert.alert (14 screens) |
| Animated charts | ✅ recharts | ✅ AnimatedBar/LineChart |
| Tab bounce, splash animation | ❌ | ✅ |
| Reduced-motion support | ✅ | ✅ |
| **Screens with no motion at all (mobile)** | — | **32 of 54:** Announcements, Assets, AttendanceSettings, AuditLog, Billing, BiometricDevice, Credentials, Credits, Departments, Designations, Documents, ExitManagement, FaceCheckIn, FaceKiosk, Holidays, LateApprovals, Leave, Manage, More, NfcManager, Notifications, OfferLetters, Payroll, PerformanceReport, Reports, SalaryHeads, Settings, Shifts, Support, Trash, AccountSecurity |

## 10. Space utilisation / layout

| Item | Web | Mobile |
|---|---|---|
| Layout | Collapsible sidebar (grouped nav), header search, `auto-fit minmax(190px,1fr)` KPI grid, 2–3 column chart + side-widget rows | Bottom tabs (Home, Tasks/Employees, Attendance, Leave, More) + grouped More grid; single column |
| Density | High: 6 KPIs + 4 charts + 3 lists on one screen | Medium: dashboard trimmed to 4 KPIs + 2 charts + 2 pay cards |
| Wide forms | Multi-column modals | Long scroll modals / bottom sheets |
| Global search | Header search input | `SearchModal` (⚠️ confirm it is wired on every tab) |
| Filter/sort | Inline bar | `FilterSortModal` (better for mobile) |

## 11. Inputs & buttons

| Item | Web | Mobile |
|---|---|---|
| Import button (xlsx) | ✅ 5 pages | ❌ 0 |
| Export menu | ✅ ExportMenu (CSV/Excel/PDF) | ⚠️ ExportButton (single format) |
| Date input | native date, DateStrip | DatePickerField, DateStrip ✅ |
| Phone input | PhoneInput | PhoneField ✅ |
| Picker select | PickerSelect | PickerField ✅ |
| Image crop | ✅ | ❌ |
| Print buttons | ✅ many | ⚠️ payslip + reports only |
| Role-based nav | ✅ | ✅ |

---

## Top gaps to close (suggested order)

1. **Excel import** on mobile (Employees, Loans, Tasks, Holidays, Departments) — needs `react-native-document-picker`.
2. **Settings parity:** Bank, WhatsApp, Punch, Permissions, Preferences/System, Branch-wise.
3. **15 missing reports** + Reports Analytics tab (statutory ones: PT, LWF, PF/ESIC challan matter most).
4. **Dashboard:** add New Hires/Payroll/Departments KPIs, Today's-Attendance donut, Headcount-by-Dept, Recent Hires, Pending Leave list, alert strip.
5. **ESS dashboard:** Recent Leaves, Performance Reviews, Personal/Work cards, Announcements.
6. Manage → **User Roles**; Payroll → **Mark slip received**; Attendance → **Mark Absent**; Employees → **OTP-gated docs**, **Exited** filter, image crop.
7. **Polish:** `FadeInUp`/`AnimatedNumber` on the 32 motion-less screens; toast instead of `Alert.alert`; `StatTile` on Leave/Attendance/Payroll/Loans.

Mobile is **ahead** on: pull-to-refresh, filter/sort modal, sort on Attendance, self-mark & correction create, Tally export + share payslip in Payroll, face kiosk screens, notifications screen, splash/update prompt.

---

# Update — gaps closed on mobile (8 Nov 2026)

`tsc --noEmit` shows no errors in the edited files. **Nothing was run on a device/emulator**, and the new screens were not tested against a live backend.

## Corrections to the audit above (found while implementing)
| Claimed gap | Reality |
|---|---|
| 6 reports missing: PT, LWF, Compliance, Excess Break, PF Challan, ESIC Challan | **Web marks these `available: false` (coming soon)** — no data logic exists anywhere. Real gap was **9** reports, not 15. |
| Mark Absent missing on mobile | Exists — Attendance bulk-mark modal with status chips. |
| Payroll "Slip received" missing | Exists (Payroll detail modal). Only the web's "Not received" toggle is absent (mobile API sends no status). |
| Employees "Exited" filter missing | Exists (STATUS_CONFIG includes `exited`). |
| Settings → Permissions matrix / Manage → User Roles missing | Web's matrix is **local state only (never saved)** and User Roles is a static table, so porting would add a non-functional screen. Skipped on purpose. |

## Done
| Item | File |
|---|---|
| 9 reports: Tally Export, Loan, Bonus, Overtime Summary, Early Going, Attendance In/Out (Vertical), Locationwise, Punch Log, Attendance History (same API calls + columns as web; reports now 27 vs web 27 live) | `NestHR/src/screens/ReportsScreen.tsx` |
| Settings: Bank Details (IFSC/account validation on save), Punch Settings, Employee App toggles (10), System toggles (6 incl. Show CTC, Branch-wise), WhatsApp toggles (6) + credit balance line, Preferences (dashboard type, time format, currency, PT state, emp code prefix/suffix) | `NestHR/src/screens/SettingsScreen.tsx` |
| Admin dashboard: greeting, "Action needed" strip, 3 more KPIs (New Hires, Monthly Payroll, Departments → 7 total, 2 rows), Headcount by Dept chart, Recent Hires list, Pending Leave Requests list | `NestHR/src/screens/DashboardScreen.tsx` |

## Still open
1. **Excel import (5 pages)** — needs a native file-picker + xlsx parser (`react-native-document-picker`, `xlsx`) → new native deps = rebuild of APK/IPA. Not installed without your OK.
2. Analytics tab in Reports (Headcount / Attendance / Salary / PF-ESI charts).
3. Employee (ESS) dashboard: Recent Leaves, Performance Reviews, Personal/Work cards, Announcements.
4. Admin dashboard: Today's Attendance donut, notifications widget.
5. Employees: OTP-gated documents, image crop.
6. Motion/polish on the 32 static screens, toast instead of `Alert.alert`.
7. Pre-existing bug spotted: Settings → "Payroll Configuration" navigates to `PayrollSettings`, which is **not registered** in `MainNavigator` (tap will fail). Not touched.
8. Backend: confirm `/settings` PUT accepts the new keys (bank*, singlePunchAction, doublePunchInterval, ess*, whatsapp*, autoSalary, bioSync, smsEnabled, emailNotif, showCTC, branchwise, timeFormat, dashboardType, state, empCodePrefix/Suffix) — web already sends them, so it should.

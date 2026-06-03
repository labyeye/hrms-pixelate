# Feature Gap — PagarGuru vs NestHR

Analysis of features present in `HRMS_PagarGuru.jsx` that are **missing or incomplete** in the current NestHR project.
Review this list and mark which ones you want implemented.

---

## 1. Employee Module

### 1.1 Employee Detail Side Panel

**What PagarGuru has:** Clicking any employee row expands a right-side detail panel (not a separate page) showing full profile — initials avatar, mobile/email/branch, department badge, salary, shift, balance amount, loan amount, and quick-action buttons (Edit, Loan Entry, Mark Attendance).  
**What we have:** Employees page navigates to a separate page or modal. No inline side panel.  
**Effort:** Medium

---

### 1.2 Salary Advance / Loan Tracking per Employee

**What PagarGuru has:** Each employee has `balance` (salary in hand) and `loan` (outstanding loan amount) fields. A "Loan Entry" quick action lets you record a new loan. Loan EMI is then auto-deducted in salary slip.  
**What we have:** No loan/advance concept anywhere.  
**Effort:** High (needs backend model + UI)

---

### 1.3 Employee Balance (Salary in Hand)

**What PagarGuru has:** Each employee has a running `balance` field showing how much salary has accumulated or is due.  
**What we have:** Not tracked.  
**Effort:** Medium

---

## 2. Attendance Module

### 2.1 Manual Attendance Marking Modal

**What PagarGuru has:** A "+ Mark Attendance" button opens a modal where you can select an employee, date, and status (Present / Absent / Late / Half Day / On Leave) to manually record attendance.  
**What we have:** No inline manual mark feature — attendance is device-synced only.  
**Effort:** Low

---

### 2.2 Overtime (OT) Tracking in Attendance

**What PagarGuru has:** Each attendance record has `ot` (overtime hours). Shown in attendance table. Auto-calculated OT amount fed into salary.  
**What we have:** No OT tracking in attendance records.  
**Effort:** Medium

---

## 3. Payroll / Salary Module

### 3.1 Run Payroll (Bulk Process)

**What PagarGuru has:** A "🧮 Run Payroll" button to process/finalize all salaries for the current month at once. Also a "📄 Bulk Slips" button to print all salary slips in one go.  
**What we have:** Payroll records are generated individually. No one-click bulk run.  
**Effort:** Medium

---

### 3.2 Overtime Amount in Salary Components

**What PagarGuru has:** Salary breakdown includes `ot` (overtime hours × rate) as an earning component. OT rate is configurable per employee.  
**What we have:** No OT component in payroll.  
**Effort:** Medium

---

### 3.3 Conveyance / Transport Allowance as Separate Component

**What PagarGuru has:** `conv` (conveyance allowance) is a distinct salary component separate from other allowances.  
**What we have:** `ta` field exists in payroll but may not be visible in all breakdowns.  
**Effort:** Low

---

## 4. Manage Module (Missing entirely)

PagarGuru has a dedicated **Manage** section (grid of tiles, each drills into a sub-page). We have Departments and Holidays as separate pages, but all the below are missing:

---

### 4.1 Branches / Office Locations

**What PagarGuru has:** Branches table (name, city, manager, employee count, status). Employees are assigned to a branch. Reports can be filtered by branch.  
**What we have:** Only departments. No branch/location concept.  
**Effort:** High (touches employee model, attendance, reports)

---

### 4.2 Shift Management with OT Configuration

**What PagarGuru has:** Shifts table with name, start time, end time, break (minutes), working hours, and OT-starts-after time. Multiple shifts (Morning, General, Evening, Night).  
**What we have:** Shifts exist on employee but no dedicated shift management page to configure them.  
**Effort:** Medium

---

### 4.3 Salary Head / Components Manager

**What PagarGuru has:** Full CRUD for salary components — earnings (Basic, HRA, DA, Conveyance, OT) and deductions (PF, ESI, TDS, Loan EMI, Prof Tax) with: type (Earning / Deduction / Variable), calculation method (Fixed, % of Basic, As per formula, As per loan), value, taxable flag.  
**What we have:** Salary components are hardcoded. No way to add/remove components from the UI.  
**Effort:** High (needs backend model + payroll calculation rework)

---

### 4.4 Designations with Salary Grades

**What PagarGuru has:** Designations table with department linkage, grade (L1/L2/L3), and min/max salary band per designation.  
**What we have:** Designation is just a text field on the employee. No standalone management or salary bands.  
**Effort:** Medium

---

### 4.5 Offer Letter Templates

**What PagarGuru has:** Letter templates (Offer Letter, Appointment Letter, Experience Certificate, Relieving Letter) with template editor, usage count, preview and print.  
**What we have:** Nothing.  
**Effort:** High

---

### 4.6 User Roles & Permissions (Manage section)

**What PagarGuru has:** A Roles table inside Manage showing which roles can access Dashboard / Employee / Salary / Reports / Manage / Settings, with per-module on/off.  
**What we have:** Permissions matrix exists in Settings but is not editable from a clean Manage → Roles flow.  
**Effort:** Low (mostly UI reorganisation)

---

## 5. Reports Module

### 5.1 Analytics Dashboard inside Reports

**What PagarGuru has:** Reports page has two modes — "All Reports" (catalog) and "Analytics". Analytics has sub-tabs:

- **Headcount** — dept breakdown bar chart, active vs inactive donut chart, dept table with Male/Female count
- **Attendance** — monthly attendance trend bar chart, status breakdown donut
- **Salary** — monthly payroll trend, dept-wise salary breakdown
- **Leave** — leave type breakdown
- **Turnover** — attrition analytics
- **PF/ESI** — compliance contribution charts

**What we have:** Report catalog only. No embedded analytics/charts section.  
**Effort:** High

---

### 5.2 Per-Employee Salary + Attendance Detail Report

**What PagarGuru has:** A deep-dive per-employee view (`EmpSalaryReport`) with:

- Employee selector dropdown
- Date range picker (quick: Week / 15 Days / Month / Quarter)
- Visual monthly attendance calendar (color-coded cells: P=green, A=red, L=amber, W=grey)
- Day-by-day table: date, day, clock-in, clock-out, work hours, OT hours, OT amount, daily rate, penalty (late), pay
- Summary row: present/absent/late/leave/weekend counts, attendance %, total OT, total penalty, net pay
- Salary slip summary for the period (earnings + deductions + net)

**What we have:** No per-employee drill-down date-range report.  
**Effort:** High

---

### 5.3 Report Download as Excel / PDF

**What PagarGuru has:** `downloadExcel()` generates real `.xlsx` files using the `xlsx` library. `downloadPDF()` generates formatted PDF with table layout.  
**What we have:** CSV export only. No Excel (.xlsx) or PDF generation.  
**Effort:** Medium

---

## 6. Dashboard Module

### 6.1 Mini Bar Charts on Dashboard

**What PagarGuru has:** Dashboard cards have inline `MiniBarChart` components — one for attendance trend (last 11 months) and one for payroll trend. Both are SVG-based, no external chart library needed.  
**What we have:** Stat cards but no trend charts on the dashboard.  
**Effort:** Low

---

### 6.2 Attendance Donut Chart on Dashboard

**What PagarGuru has:** A `DonutChart` component on the dashboard showing today's attendance breakdown (Present / Late / Absent) as a visual donut.  
**What we have:** No chart — just numbers.  
**Effort:** Low

---

### 6.3 Recent Notifications Panel on Dashboard

**What PagarGuru has:** A "Recent notifications" section on the dashboard showing system events (salary processed, leave approved, new employee added, etc.) as a list.  
**What we have:** No notification feed on dashboard.  
**Effort:** Low

---

## 7. Settings Module

### 7.1 Salary Mode Settings

**What PagarGuru has:** Configure how salary is paid — Monthly, 15-Day cycle, or Weekly. Set salary pay day (e.g. 31st of month, or 1st of next). Option to enable bi-monthly salary.  
**What we have:** No salary mode configuration.  
**Effort:** Medium

---

### 7.2 Employee App / ESS (Employee Self-Service) Settings

**What PagarGuru has:** Granular per-feature toggles for the employee-facing app:

- Allow employee to login
- Allow employee to punch (mobile self-service attendance)
- Allow salary slip viewing (with optional date restriction)
- Allow attendance checking (with date restriction)
- Allow pay history viewing
- Allow leave requests
- Allow work report submission
- Allow advance/payment requests
- Allow holiday list viewing
- Allow miss punch reporting

**What we have:** No ESS settings panel.  
**Effort:** Low (settings are toggles; ESS itself is separate)

---

### 7.3 System / Automation Settings

**What PagarGuru has:** Toggles for:

- Auto salary processing on pay day
- Biometric device auto-sync
- SMS notifications
- Email notifications
- OT calculation enable/disable

**What we have:** Some of these are missing (auto-salary, SMS, OT calc).  
**Effort:** Low (settings storage; actual automation is separate)

---

### 7.4 Punch / Attendance Settings

**What PagarGuru has:**

- Single punch action: what to do if only one punch recorded (Mark as Half Day / Present / Absent)
- Double punch interval: minimum gap between two punches to avoid duplicates (e.g. 5 min)

**What we have:** No punch behavior configuration.  
**Effort:** Low

---

### 7.5 Other Preferences

**What PagarGuru has:**

- Dashboard display type (Normal / Advanced / Compact)
- Shift type (Rotation / Fixed)
- Time format (12 Hour / 24 Hour)
- Calendar type (Default / Custom)
- Employee code prefix/suffix/auto configuration
- Currency selection (INR, USD, etc.)
- State selection (for PT slab calculation)
- CTC display toggle (show/hide CTC to employees)
- Branch-wise reporting toggle

**What we have:** No dashboard type, no time format, no employee code config, no state/PT slab.  
**Effort:** Low (mostly dropdowns + toggles)

---

### 7.6 API Key Display

**What PagarGuru has:** A section showing the company's generated API key for integration, with a toggle to reveal/hide it.  
**What we have:** Not present.  
**Effort:** Low

---

## 8. Biometric Module

### 8.1 Sync Log Table

**What PagarGuru has:** Below the device cards, a sync log table showing: Device, Last Sync timestamp, Records synced, Status (Success/Failed).  
**What we have:** Biometric page exists but may lack the sync log display.  
**Effort:** Low

---

## Summary Table

| #   | Feature                                             | Category   | Effort | Priority (you decide) |
| --- | --------------------------------------------------- | ---------- | ------ | --------------------- |
| 1.1 | Employee detail side panel                          | Employee   | Medium |                       |
| 1.2 | Salary advance / loan tracking                      | Employee   | High   |                       |
| 1.3 | Employee salary balance                             | Employee   | Medium |                       |
| 2.1 | Manual attendance marking modal                     | Attendance | Low    |                       |
| 2.2 | Overtime tracking in attendance                     | Attendance | Medium |                       |
| 3.1 | Run Payroll bulk action                             | Payroll    | Medium |                       |
| 3.2 | OT component in salary                              | Payroll    | Medium |                       |
| 4.1 | Branches / office locations                         | Manage     | High   |                       |
| 4.2 | Shift management + OT config                        | Manage     | Medium |                       |
| 4.3 | Salary head / components manager                    | Manage     | High   |                       |
| 4.4 | Designations with salary grades                     | Manage     | Medium |                       |
| 4.5 | Offer letter templates                              | Manage     | High   |                       |
| 4.6 | Roles management (Manage section)                   | Manage     | Low    |                       |
| 5.1 | Analytics dashboard in Reports                      | Reports    | High   |                       |
| 5.2 | Per-employee salary+attendance detail               | Reports    | High   |                       |
| 5.3 | Excel (.xlsx) + PDF export                          | Reports    | Medium |                       |
| 6.1 | Mini bar charts on Dashboard                        | Dashboard  | Low    |                       |
| 6.2 | Attendance donut chart on Dashboard                 | Dashboard  | Low    |                       |
| 6.3 | Notifications panel on Dashboard                    | Dashboard  | Low    |                       |
| 7.1 | Salary mode settings                                | Settings   | Medium |                       |
| 7.2 | Employee app / ESS settings                         | Settings   | Low    |                       |
| 7.3 | System/automation settings                          | Settings   | Low    |                       |
| 7.4 | Punch behavior settings                             | Settings   | Low    |                       |
| 7.5 | Other preferences (time format, state, code config) | Settings   | Low    |                       |
| 7.6 | API key display                                     | Settings   | Low    |                       |
| 8.1 | Biometric sync log table                            | Biometric  | Low    |                       |

---

> Mark the ones you want → I'll implement them in order of priority.

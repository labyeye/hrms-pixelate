# NestHR Product Design

**Last reviewed:** 2026-09-20

## Product Feel

NestHR should feel dependable and operational: HR teams need dense comparison views and predictable workflows, while employees need a calm self-service experience with clear next actions.

## Existing Visual Language

- Web and mobile share a neo-brutalist direction: black borders, white surfaces, strong blue/orange/green accents, compact status badges, and Lucide icons.
- Web uses DM Sans-style typography, Tailwind utilities, bordered tables/panels, dialogs, toasts, responsive filters, and export actions.
- Mobile uses safe-area layouts, large readable headings, cards, icon-led actions, and shared color tokens.
- Attendance uses verification-mode icons and status colors; payroll uses rupee totals and printable documents.

## Main Workspaces

### Admin/HR dashboard

- KPI summary for employees, presence, leave, pending work, departments, and open positions.
- Fast links to employee roster, attendance, leave approvals, payroll, recruitment, reports, and settings.

### Employee self-service

- Overview, attendance, leaves, payroll, documents, assets, profile, and password/settings tabs.
- Keep personal actions prominent: check in/out, request leave, view payslip, upload document, and correct attendance.

### Attendance and biometric operations

- Date/month navigation, filters by status/department, verification-mode indicators, correction dialogs, device health, and logs.
- Device administration should clearly separate locations, devices, commands, enrollment, and audit logs.

### Payroll and reports

- Use period selectors and explicit processing/paid states.
- Make print/export actions available near the report or payslip being viewed.
- Never hide errors in financial workflows; show recovery guidance.

## Interaction Rules

- Every async operation has loading, error, empty, and success feedback.
- Destructive actions require confirmation and identify the affected employee/document/device.
- Use icon buttons only for familiar actions and provide accessible labels/tooltips.
- Do not use color alone for attendance/payroll status.
- Keep role-specific navigation consistent between web and mobile.
- Avoid exposing sensitive document or credential values in list views.

## Accessibility and Responsive Behavior

- Labels must be associated with inputs; keyboard focus must remain visible on web.
- Mobile controls need touch-safe sizing and safe-area support.
- Tables collapse to prioritized rows/detail views on small screens.
- Charts and status colors need text alternatives.
- Date/time displays must identify the relevant local timezone when ambiguity is possible.

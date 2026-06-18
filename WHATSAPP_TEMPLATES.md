# WhatsApp Templates — NestHR

All templates use **Meta WhatsApp Business API** and must be created/approved in
[Meta Business Manager → WhatsApp → Message Templates](https://business.facebook.com/wa/manage/message-templates/).

- Category for all templates below: **UTILITY**
- Language: **English (en)** (or match your `whatsappLang` company setting)

---

## Existing Templates (already approved — do NOT recreate)

| Template Name | Params | Body |
|---|---|---|
| `neshr_checkin` | firstName, locationName, time | Hi {{1}}, your Check-In at {{2}} was recorded at {{3}}. Have a productive day! |
| `neshr_checkout` | firstName, locationName, time, workHours | Hi {{1}}, your Check-Out at {{2}} was recorded at {{3}}. Total hours: {{4}}. |
| `neshr_checkin_hr` | empName, empId, locationName, time | Employee {{1}} (ID: {{2}}) checked in at {{3}} at {{4}}. |
| `neshr_checkout_hr` | empName, empId, locationName, time, workHours | Employee {{1}} (ID: {{2}}) checked out at {{3}} at {{4}}. Total hours: {{5}}. |
| `neshr_leave_submitted` | firstName, leaveType, startDate, endDate, days | Hi {{1}}, your {{2}} leave request from {{3}} to {{4}} for {{5}} day(s) has been submitted and is awaiting approval. |
| `neshr_leave_approved` | firstName, leaveType, startDate, endDate, days | Hi {{1}}, your {{2}} Leave ({{3}} to {{4}}, {{5}} day(s)) has been APPROVED. |
| `neshr_leave_rejected` | firstName, leaveType, reason | Hi {{1}}, your {{2}} Leave request has been REJECTED. Reason: {{3}}. |
| `neshr_leave_request_hr` | empName, empId, leaveType, startDate, endDate, days, reason | New Leave Request — Employee: {{1}} ({{2}}), Type: {{3}}, Dates: {{4}} to {{5}} ({{6}} day(s)), Reason: {{7}}. |
| `neshr_salary_paid` | firstName, period, netSalary | Hi {{1}}, your salary for {{2}} of {{3}} has been processed and credited to your bank account. |
| `neshr_subscription` | toName, planName, companyName, amount, renewalDate, dashboardUrl | Welcome {{1}}! Your {{2}} plan for {{3}} is active. Amount: {{4}}, Renewal: {{5}}. Login: {{6}} |

---

## Template Reused for a New Purpose

### `neshr_leave_rejected` — also used for Leave Cancellation

When an admin **cancels an already-approved leave**, the system reuses this
template. The `reason` param will be prefixed with `"Cancelled — "` so the
employee knows it's a cancellation, not a rejection.

**No action needed** — this template is already approved.

Example message the employee receives:
> Hi Ravi, your Casual Leave request has been REJECTED. Reason: Cancelled — Project deadline requires your presence.

If you prefer a cleaner message, you can instead create a dedicated template (see optional section at the bottom).

---

## NEW Template — Create This Now

### `neshr_attendance_status`

**Used for:** Notifying employees when their attendance is manually marked as
Present, Absent, Late, or Half Day by HR/admin.

**Not sent for:** Holiday, Weekend, On Leave — those don't need a notification.

| Field | Value |
|---|---|
| Template name | `neshr_attendance_status` |
| Category | UTILITY |
| Language | English (en) |
| Number of params | 3 |

**Body text to paste into Meta:**
```
Hi {{1}}, your attendance for {{2}} has been marked as *{{3}}*.
```

**Param mapping:**

| Param | Value | Example |
|---|---|---|
| `{{1}}` | Employee first name | `Ravi` |
| `{{2}}` | Date (DD/MM/YYYY) | `18/06/2026` |
| `{{3}}` | Status label | `Present` / `Absent` / `Late` / `Half Day` |

**Example messages:**

> Hi Ravi, your attendance for 18/06/2026 has been marked as *Present*.

> Hi Priya, your attendance for 18/06/2026 has been marked as *Absent*.

> Hi Arjun, your attendance for 18/06/2026 has been marked as *Late*.

> Hi Sara, your attendance for 18/06/2026 has been marked as *Half Day*.

**When it triggers:**
- HR manually marks attendance via the Attendance page (Mark Attendance form)
- HR edits an existing attendance record and changes the status
- Auto-mark runs and resolves a status (present → late if check-in is after grace period)
- Bulk mark does **not** trigger this (too many messages)

---

## Optional — Dedicated Cancellation Template

Only create this if you want a cleaner cancellation message instead of reusing `neshr_leave_rejected`.

| Field | Value |
|---|---|
| Template name | `neshr_leave_cancelled` |
| Category | UTILITY |
| Language | English (en) |

**Body:**
```
Hi {{1}}, your {{2}} Leave ({{3}} to {{4}}) has been cancelled by HR. Reason: {{5}}.
```

| Param | Value |
|---|---|
| `{{1}}` | First name |
| `{{2}}` | Leave type (Casual, Sick, etc.) |
| `{{3}}` | Start date |
| `{{4}}` | End date |
| `{{5}}` | Cancellation reason |

If you create this, let the dev know and they will swap the controller to use
this template instead of the reused `neshr_leave_rejected`.

---

## Summary — What to Do Right Now

| Action | Template | Priority |
|---|---|---|
| ✅ Already exists | All 10 existing templates | — |
| 🆕 **Create now** | `neshr_attendance_status` | Required |
| ⚙️ Optional | `neshr_leave_cancelled` | Only if you want separate cancellation message |

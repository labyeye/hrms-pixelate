# WhatsApp Templates — NestHR

Register all of these in **Meta Business Manager → WhatsApp → Message Templates**.

- Category: **Utility**
- Language: **English (en)**
- Template names must be exactly as written below (lowercase, underscores)

> **Meta rule:** variable count must be ≤ (non-variable characters ÷ 10).
> All bodies below are written to satisfy this ratio — copy them exactly.

---

## 1. `neshr_checkin`
**Sent to:** Employee when they punch IN

**Body:**
```
Hi {{1}}, your check-in at {{2}} has been recorded successfully at {{3}}. Have a great and productive day ahead!
```

| Parameter | Value |
|---|---|
| `{{1}}` | Employee first name |
| `{{2}}` | Location / gate name |
| `{{3}}` | Check-in time (e.g. 09:15 AM) |

---

## 2. `neshr_checkout`
**Sent to:** Employee when they punch OUT

**Body:**
```
Hi {{1}}, your check-out from {{2}} has been recorded at {{3}}. Total hours worked today: {{4}}. Great work, see you tomorrow!
```

| Parameter | Value |
|---|---|
| `{{1}}` | Employee first name |
| `{{2}}` | Location / gate name |
| `{{3}}` | Check-out time (e.g. 06:30 PM) |
| `{{4}}` | Total hours worked (e.g. 8.5h) |

---

## 3. `neshr_checkin_hr`
**Sent to:** HR Manager / Admin when any employee punches IN

**Body:**
```
NestHR Attendance Alert: Employee {{1}} (ID: {{2}}) has successfully checked in at location {{3}}. Time of check-in recorded: {{4}}.
```

| Parameter | Value |
|---|---|
| `{{1}}` | Employee full name |
| `{{2}}` | Employee ID (e.g. EMP001) |
| `{{3}}` | Location / gate name |
| `{{4}}` | Check-in time (e.g. 09:15 AM) |

---

## 4. `neshr_checkout_hr`
**Sent to:** HR Manager / Admin when any employee punches OUT

**Body:**
```
NestHR Attendance Alert: Employee {{1}} (ID: {{2}}) has checked out from location {{3}}. Check-out time: {{4}}. Total hours worked today: {{5}}.
```

| Parameter | Value |
|---|---|
| `{{1}}` | Employee full name |
| `{{2}}` | Employee ID (e.g. EMP001) |
| `{{3}}` | Location / gate name |
| `{{4}}` | Check-out time (e.g. 06:30 PM) |
| `{{5}}` | Total hours worked (e.g. 8.5h) |

---

## 5. `neshr_leave_submitted`
**Sent to:** Employee when they submit a leave request

**Body:**
```
Hi {{1}}, your {{2}} leave request from {{3}} to {{4}} for {{5}} day(s) has been submitted and is awaiting approval from your manager.
```

| Parameter | Value |
|---|---|
| `{{1}}` | Employee first name |
| `{{2}}` | Leave type (e.g. Casual, Sick) |
| `{{3}}` | Start date (e.g. 15/06/2026) |
| `{{4}}` | End date |
| `{{5}}` | Number of days |

---

## 7. `neshr_leave_approved`
**Sent to:** Employee when their leave is approved

**Body:**
```
Hi {{1}}, great news! Your {{2}} leave request from {{3}} to {{4}} for {{5}} day(s) has been approved by your manager. Enjoy your time off and take care!
```

| Parameter | Value |
|---|---|
| `{{1}}` | Employee first name |
| `{{2}}` | Leave type (e.g. Casual, Sick) |
| `{{3}}` | Start date (e.g. 15/06/2026) |
| `{{4}}` | End date |
| `{{5}}` | Number of days |

---

## 8. `neshr_leave_rejected`
**Sent to:** Employee when their leave is rejected

**Body:**
```
Hi {{1}}, your {{2}} leave request could not be approved at this time. Reason for rejection: {{3}}. Please contact your manager for further details.
```

| Parameter | Value |
|---|---|
| `{{1}}` | Employee first name |
| `{{2}}` | Leave type (e.g. Casual, Sick) |
| `{{3}}` | Rejection reason |

---

## 9. `neshr_leave_request_hr`
**Sent to:** HR Manager / Admin when an employee applies for leave

**Body:**
```
NestHR Leave Request: Employee {{1}} (ID: {{2}}) has submitted a {{3}} leave application. Duration: {{4}} to {{5}} totalling {{6}} day(s). Reason given by employee: {{7}}. Please log in to review and take action.
```

| Parameter | Value |
|---|---|
| `{{1}}` | Employee full name |
| `{{2}}` | Employee ID |
| `{{3}}` | Leave type |
| `{{4}}` | Start date |
| `{{5}}` | End date |
| `{{6}}` | Number of days |
| `{{7}}` | Reason given by employee |

---

## 10. `neshr_salary_paid`
**Sent to:** Employee when their salary is processed and marked as paid

**Body:**
```
Hi {{1}}, your salary for the month of {{2}} amounting to {{3}} has been successfully processed and credited to your registered bank account.
```

| Parameter | Value |
|---|---|
| `{{1}}` | Employee first name |
| `{{2}}` | Month and year (e.g. June 2026) |
| `{{3}}` | Net salary amount (e.g. ₹25,000) |

---

## 11. `neshr_subscription`
**Sent to:** Account owner when a NestHR subscription is activated

**Body:**
```
Welcome to NestHR, {{1}}! Your {{2}} subscription plan for {{3}} has been activated successfully. Amount paid: {{4}}. Your next renewal date is {{5}}. Access your dashboard at: {{6}}
```

| Parameter | Value |
|---|---|
| `{{1}}` | Account owner name |
| `{{2}}` | Plan name (e.g. Professional) |
| `{{3}}` | Company name |
| `{{4}}` | Amount paid (e.g. ₹4,999) |
| `{{5}}` | Next renewal date |
| `{{6}}` | Dashboard URL |

---

## ENV variables required

Add these to your `backend/.env` file:

```
META_WA_TOKEN=your_meta_access_token
META_WA_PHONE_ID=your_whatsapp_phone_number_id
```

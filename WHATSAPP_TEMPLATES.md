# WhatsApp Templates — NestHR

Register all of these in **Meta Business Manager → WhatsApp → Message Templates**.

- Category: **Utility**
- Language: **English (en)**
- Template names must be exactly as written below (lowercase, underscores)

---

## 1. `neshr_checkin`
**Sent to:** Employee when they punch IN

**Body:**
```
Hi {{1}}, your Check-In at {{2}} was recorded at {{3}}. Have a productive day!
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
Hi {{1}}, your Check-Out at {{2}} was recorded at {{3}}. Total hours: {{4}}.
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
Employee {{1}} (ID: {{2}}) checked in at {{3}} at {{4}}.
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
Employee {{1}} (ID: {{2}}) checked out at {{3}} at {{4}}. Total hours: {{5}}.
```

| Parameter | Value |
|---|---|
| `{{1}}` | Employee full name |
| `{{2}}` | Employee ID (e.g. EMP001) |
| `{{3}}` | Location / gate name |
| `{{4}}` | Check-out time (e.g. 06:30 PM) |
| `{{5}}` | Total hours worked (e.g. 8.5h) |

---

## 5. `neshr_leave_approved`
**Sent to:** Employee when their leave is approved

**Body:**
```
Hi {{1}}, your {{2}} Leave ({{3}} to {{4}}, {{5}} day(s)) has been APPROVED.
```

| Parameter | Value |
|---|---|
| `{{1}}` | Employee first name |
| `{{2}}` | Leave type (e.g. Casual, Sick) |
| `{{3}}` | Start date (e.g. 15/06/2026) |
| `{{4}}` | End date |
| `{{5}}` | Number of days |

---

## 6. `neshr_leave_rejected`
**Sent to:** Employee when their leave is rejected

**Body:**
```
Hi {{1}}, your {{2}} Leave request has been REJECTED. Reason: {{3}}.
```

| Parameter | Value |
|---|---|
| `{{1}}` | Employee first name |
| `{{2}}` | Leave type (e.g. Casual, Sick) |
| `{{3}}` | Rejection reason |

---

## 7. `neshr_leave_request_hr`
**Sent to:** HR Manager / Admin when an employee applies for leave

**Body:**
```
New Leave Request — Employee: {{1}} ({{2}}), Type: {{3}}, Dates: {{4}} to {{5}} ({{6}} day(s)), Reason: {{7}}.
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

## 8. `neshr_salary_paid`
**Sent to:** Employee when their salary is processed and marked as paid

**Body:**
```
Hi {{1}}, your salary for {{2}} of {{3}} has been processed and credited to your bank account.
```

| Parameter | Value |
|---|---|
| `{{1}}` | Employee first name |
| `{{2}}` | Month and year (e.g. June 2026) |
| `{{3}}` | Net salary amount (e.g. ₹25,000) |

---

## 9. `neshr_subscription`
**Sent to:** Account owner when a NestHR subscription is activated

**Body:**
```
Welcome {{1}}! Your {{2}} plan for {{3}} is active. Amount: {{4}}, Renewal: {{5}}. Login: {{6}}
```

| Parameter | Value |
|---|---|
| `{{1}}` | Account owner name |
| `{{2}}` | Plan name (e.g. Pro) |
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

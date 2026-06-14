# NestHR — WhatsApp Messaging Setup Guide

Two integration modes are supported:

| Mode | Who sends | Sender name shown | Use case |
|------|-----------|-------------------|----------|
| **NestHR Number** | NestHR's own WhatsApp Business account | "NestHR" | SaaS notifications to all clients |
| **Client Number** | Client's own WhatsApp Business account | Client's business name | White-label; each client owns their messaging |

---

## Mode 1 — NestHR's WhatsApp Number

> NestHR registers one WhatsApp Business API number. All notifications go out from this number on behalf of any client.

### Setup Steps

1. Create a Meta Business Manager account at business.facebook.com
2. Add a WhatsApp Business API account under your business
3. Register the NestHR phone number
4. Apply for template approval (see templates below)
5. Store the following in your `.env`:

```env
WHATSAPP_ACCESS_TOKEN=your_meta_access_token
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id
WHATSAPP_API_VERSION=v20.0
```

### Templates (NestHR Number)

Each template below is submitted to Meta for approval under your NestHR Business account.

---

#### 1. Attendance Confirmation

**Template name:** `neshr_attendance_confirmation`
**Category:** UTILITY
**Language:** English

```
Header: NestHR
Body:
Hi {{1}}, your attendance has been marked.

Punch {{2}}: {{3}}
Date: {{4}}

Have a great day!

Footer: Powered by NestHR
```

Variables: `{{1}}` = Employee name, `{{2}}` = IN / OUT, `{{3}}` = Time, `{{4}}` = Date

---

#### 2. Leave Status Update

**Template name:** `nesthr_leave_status`
**Category:** UTILITY
**Language:** English

```
Header: NestHR
Body:
Hi {{1}}, your leave request has been {{2}}.

Type: {{3}}
From: {{4}}  To: {{5}}
Reason by manager: {{6}}

Footer: Powered by NestHR
```

Variables: `{{1}}` = Employee name, `{{2}}` = Approved / Rejected, `{{3}}` = Leave type, `{{4}}` = Start date, `{{5}}` = End date, `{{6}}` = Manager note

---

#### 3. Payslip Ready

**Template name:** `nesthr_payslip_ready`
**Category:** UTILITY
**Language:** English

```
Header: NestHR
Body:
Hi {{1}}, your payslip for {{2}} is ready.

Net Pay: ₹{{3}}
Credited on: {{4}}

Login to NestHR to view your full payslip.

Footer: Powered by NestHR
```

Variables: `{{1}}` = Employee name, `{{2}}` = Month + Year, `{{3}}` = Net amount, `{{4}}` = Credit date

---

#### 4. Holiday Announcement

**Template name:** `nesthr_holiday_announcement`
**Category:** UTILITY
**Language:** English

```
Header: NestHR
Body:
Hi {{1}}, a holiday has been announced.

Holiday: {{2}}
Date: {{3}}

Enjoy your day off!

Footer: Powered by NestHR
```

Variables: `{{1}}` = Employee name, `{{2}}` = Holiday name, `{{3}}` = Date

---

## Mode 2 — Client's Own WhatsApp Number

> Each client connects their own WhatsApp Business API number. Messages are sent from their number and the receiver sees the client's registered business name as the sender.

NestHR stores per-company WhatsApp credentials in the `Settings` collection and routes messages through the client's own API token.

### Setup Steps (per client)

1. Client creates / uses their existing Meta Business Manager
2. Client registers their business phone number under WhatsApp Business API
3. Client submits the template below for Meta approval under their own business account
4. Client provides NestHR with their credentials via **Settings > Integrations** in the dashboard:
   - Access Token
   - Phone Number ID
   - Template Name (must match exactly what Meta approved)

### Single Universal Template (Client Number)

Since clients submit this under their own account, the business name in the header is automatically pulled from their Meta Business registration — no variable needed for that.

Submit this **one template** and it works for every notification type via a `type` variable.

---

**Template name:** `[business_slug]_hr_notification`
*(client names this themselves, e.g. `acme_hr_notification`)*

**Category:** UTILITY
**Language:** English

```
Header: {{1}}
Body:
Dear {{2}},

{{3}}

For details, please log in to your HR portal or contact your HR team.

Footer: HR Team — {{1}}
```

| Variable | Value |
|----------|-------|
| `{{1}}` | Company / Business name (e.g. "Acme Corp") |
| `{{2}}` | Employee full name |
| `{{3}}` | Dynamic message body (see examples below) |

---

### `{{3}}` Message Body Examples (assembled by NestHR backend)

| Event | Value passed as `{{3}}` |
|-------|------------------------|
| Attendance IN | Your attendance has been marked.\nPunch IN: 09:04 AM on 14-Jun-2026 |
| Attendance OUT | Your attendance has been marked.\nPunch OUT: 06:32 PM on 14-Jun-2026 |
| Leave Approved | Your leave request (Casual Leave) from 16-Jun to 18-Jun has been APPROVED. |
| Leave Rejected | Your leave request (Sick Leave) from 15-Jun to 15-Jun has been REJECTED.\nReason: Insufficient balance |
| Payslip | Your payslip for May 2026 is ready. Net Pay: ₹42,500. Login to your HR portal to download. |
| Holiday | A holiday has been declared on 14-Jun-2026 (Eid). Enjoy your day! |

---

## Backend Schema (Settings Collection)

Add the following fields to the company Settings document:

```js
whatsapp: {
  mode: 'nesthr' | 'client',          // which mode is active
  // only required if mode === 'client'
  accessToken: String,
  phoneNumberId: String,
  templateName: String,               // e.g. "acme_hr_notification"
  businessName: String,               // shown as {{1}} in template
}
```

---

## API Call Structure (Meta Cloud API)

```js
POST https://graph.facebook.com/v20.0/{phone-number-id}/messages

{
  "messaging_product": "whatsapp",
  "to": "91XXXXXXXXXX",
  "type": "template",
  "template": {
    "name": "acme_hr_notification",   // or nesthr template name
    "language": { "code": "en" },
    "components": [
      {
        "type": "header",
        "parameters": [
          { "type": "text", "text": "Acme Corp" }   // {{1}} — client mode only
        ]
      },
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "Ravi Kumar" },         // {{2}} employee name
          { "type": "text", "text": "Your payslip for..." } // {{3}} message body
        ]
      }
    ]
  }
}
```

---

## Notes

- All templates must be approved by Meta before they can be sent. Approval typically takes 24–48 hours.
- Template names must be lowercase with underscores only.
- The `Header` field in a template must be of type **TEXT** for the dynamic business name to work.
- Free-form messages (non-template) can only be sent within a 24-hour window after the user messages you first. For HR notifications (outbound only), always use templates.
- For client mode, NestHR never stores the client's token in plaintext — encrypt with AES-256 before saving to MongoDB.

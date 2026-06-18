# Internal Stats API — NestHR

A single **no-JWT** endpoint that returns a full platform health snapshot across
all tenants. Intended for your internal dashboard, uptime monitors, or cron
alerts — not exposed to end-users.

---

## Setup

Add to your `.env`:

```env
STATS_SECRET=your-strong-random-secret-here
```

> Generate one: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

---

## Endpoint

```
GET /internal/stats?key=<STATS_SECRET>
```

Or pass the key as a header instead:

```
GET /internal/stats
X-Stats-Key: your-strong-random-secret-here
```

No JWT, no login required — just the secret key.

---

## Full Response Shape

```jsonc
{
  "success": true,
  "generatedAt": "2026-06-18T10:30:00.000Z",

  // ── Platform-wide overview ─────────────────────────────────────────────────
  "overview": {

    "tenants": {
      "total": 42,            // all companies ever registered
      "active": 30,           // status = "active"
      "trial": 8,             // status = "trial"
      "inactive": 4,          // status = "inactive"
      "newLast7Days": 2,      // signed up in last 7 days
      "newLast30Days": 7      // signed up in last 30 days
    },

    "subscriptions": {
      "total": 42,
      "active": 28,           // active paid subscriptions
      "trial": 8,             // isTrial = true
      "cancelled": 3,
      "pendingRenewal": 2,
      "expiringIn7Days": 1,   // renewal date within next 7 days
      "expiringIn30Days": 4,  // renewal date within next 30 days
      "expired": 2            // renewalDate past, not cancelled
    },

    "revenue": {
      "totalAllTime": 485000,       // sum of all paid invoices (INR)
      "last30Days": 42000,          // paid invoices in last 30 days
      "mrr": 15000,                 // monthly recurring revenue (active monthly plans)
      "arr": 210000,                // annualised recurring revenue
      "byBillingCycle": {
        "monthly": { "total": 120000, "count": 35 },
        "yearly":  { "total": 365000, "count": 12 }
      }
    },

    "employees": {
      "total": 680,           // all employees across all tenants
      "active": 610,          // status = "active"
      "avgPerTenant": 14.5,   // average active employees per tenant
      "maxInOneTenant": 87    // largest single tenant by headcount
    },

    "activity": {
      "attendanceRecordsLast30Days": 8200,
      "leaveRequestsLast30Days": 145,
      "payrollsProcessedLast30Days": 320
    },

    // How many active subscriptions per plan + billing cycle
    "planBreakdown": [
      { "plan": "Enterprise",    "billingCycle": "yearly",  "count": 5 },
      { "plan": "Professional",  "billingCycle": "monthly", "count": 18 },
      { "plan": "Professional",  "billingCycle": "yearly",  "count": 7 },
      { "plan": "Starter",       "billingCycle": "monthly", "count": 10 },
      { "plan": "Starter",       "billingCycle": "yearly",  "count": 2 }
    ]
  },

  // ── Alerts — companies that need attention ─────────────────────────────────
  "alerts": {

    // Renewals due in ≤ 7 days
    "expiringIn7Days": [
      { "name": "Acme Corp", "email": "admin@acme.com", "plan": "Professional", "renewalDate": "..." }
    ],

    // Renewals due in ≤ 30 days
    "expiringIn30Days": [ ...same shape... ],

    // Subscriptions where renewalDate is already past (not cancelled)
    "expired": [
      { "name": "Old Co", "email": "...", "plan": "Starter", "renewalDate": "...", "lastLogin": "..." }
    ],

    // Companies currently on trial
    "trialsActive": [
      { "name": "New Startup", "email": "...", "trialEndDate": "...", "activeEmployees": 3 }
    ]
  },

  // ── Per-tenant detail list ─────────────────────────────────────────────────
  "tenants": [
    {
      "id": "664abc...",
      "name": "Acme Corp",
      "email": "admin@acme.com",
      "phone": "9876543210",
      "industry": "Technology",
      "city": "Mumbai",
      "state": "Maharashtra",
      "status": "active",           // active | trial | inactive
      "lastLogin": "2026-06-17T...", // last time someone from this company logged in
      "joinedAt": "2025-01-10T...",
      "activeEmployees": 45,         // active employee count
      "loginUsers": 3,               // number of User (HR/admin) accounts

      "subscription": {
        "plan": "Professional",
        "billingCycle": "monthly",
        "status": "active",          // active | inactive | cancelled | pending_renewal
        "isTrial": false,
        "trialEndDate": null,
        "renewalDate": "2026-07-10T...",
        "maxEmployees": 100,
        "currentEmployeeCount": 45,
        "amountPaid": 2999,
        "paymentStatus": "completed", // pending | completed | failed
        "autoRenew": true,
        "expiringIn7Days": false,
        "expiringIn30Days": true,
        "isExpired": false
      }
    }
    // ... one entry per company, newest first
  ]
}
```

---

## Field Reference

### `overview.tenants`

| Field | Description |
|---|---|
| `total` | All companies ever created |
| `active` | Currently active (paying) |
| `trial` | On free trial |
| `inactive` | Churned / suspended |
| `newLast7Days` | Signups in last 7 days |
| `newLast30Days` | Signups in last 30 days |

### `overview.subscriptions`

| Field | Description |
|---|---|
| `active` | Paid active subscriptions |
| `trial` | Trial subscriptions |
| `expiringIn7Days` | Renewals due in ≤ 7 days — send reminder |
| `expiringIn30Days` | Renewals due in ≤ 30 days |
| `expired` | Past renewal date and not cancelled — follow up |
| `pendingRenewal` | Marked pending_renewal in DB |

### `overview.revenue`

| Field | Description |
|---|---|
| `totalAllTime` | Sum of all paid invoices ever (INR) |
| `last30Days` | Revenue collected in last 30 days |
| `mrr` | Monthly Recurring Revenue — sum of active monthly plan prices |
| `arr` | Annualised Recurring Revenue — MRR×12 + active yearly plan prices |

### `tenants[].subscription`

| Field | Description |
|---|---|
| `expiringIn7Days` | `true` if renewal is within 7 days |
| `expiringIn30Days` | `true` if renewal is within 30 days |
| `isExpired` | `true` if `renewalDate` is in the past and not cancelled |
| `currentEmployeeCount` | Count stored on subscription at last sync |
| `maxEmployees` | Plan employee limit |
| `amountPaid` | Total amount paid on this subscription record |
| `paymentStatus` | Latest payment status |

---

## Example Usage

### cURL
```bash
curl "https://yourserver.com/internal/stats?key=your-secret"
```

### JavaScript (Node / dashboard)
```js
const res = await fetch("https://yourserver.com/internal/stats", {
  headers: { "X-Stats-Key": process.env.STATS_SECRET }
});
const { overview, alerts, tenants } = await res.json();
```

### Quick health check (just overview)
```bash
curl -s "https://yourserver.com/internal/stats?key=xxx" | jq '.overview'
```

### Get companies expiring this week
```bash
curl -s "https://yourserver.com/internal/stats?key=xxx" | jq '.alerts.expiringIn7Days'
```

---

## Security Notes

- This route is registered **before** the JWT middleware and API rate limiter
- It is **not** listed in any frontend route — only accessible by server-to-server calls
- Always use `STATS_SECRET` — if the env var is missing, the endpoint returns `503`
- Rotate the secret if you suspect it was exposed
- For extra security, restrict access to this path at the nginx/reverse-proxy level to your IP only

# HRMS Subscription Model Documentation

## Overview

The HRMS platform now supports a **SaaS (Software as a Service)** subscription-based model similar to PagerBook, where companies register and choose subscription plans based on their employee count.

---

## Subscription Plans

### Tier 1: Starter

- **Monthly Price**: ₹50/month
- **Yearly Price**: ₹500/year (16.67% discount = ₹6 savings per month)
- **Max Employees**: 10
- **Features**:
  - Basic HR Management
  - Attendance Tracking
  - Leave Management
  - Email Support
  - Monthly Reporting

### Tier 2: Professional

- **Monthly Price**: ₹100/month
- **Yearly Price**: ₹1000/year (16.67% discount = ₹16.67 savings per month)
- **Max Employees**: 20
- **Features**:
  - Advanced HR Management
  - Attendance Tracking
  - Leave Management
  - Payroll Processing
  - Performance Management
  - Priority Email & Chat Support
  - Weekly Reporting

### Tier 3: Enterprise

- **Monthly Price**: ₹200/month
- **Yearly Price**: ₹2000/year (16.67% discount = ₹33.33 savings per month)
- **Max Employees**: Unlimited
- **Features**:
  - Full HR Management Suite
  - Advanced Analytics
  - Custom Integrations
  - Dedicated Account Manager
  - 24/7 Phone Support
  - Real-time Reporting
  - Custom Features
  - API Access

---

## Database Models

### Company Model

Represents a registered company/organization.

```javascript
{
  name: String (required),
  email: String (required, unique),
  phone: String (required),
  password: String (required, hashed),
  industry: String,
  website: String,
  address: String,
  city: String,
  state: String,
  pincode: String,
  country: String (default: "India"),
  logo: String,
  gstNumber: String,
  panNumber: String,
  status: "active" | "inactive" | "trial",
  subscription: ObjectId (ref: Subscription),
  createdBy: ObjectId (ref: User),
  lastLogin: Date,
  timestamps: true
}
```

### Subscription Model

Tracks subscription details and billing information.

```javascript
{
  company: ObjectId (ref: Company, required),
  plan: "starter" | "professional" | "enterprise" (required),
  monthlyPrice: Number,
  yearlyPrice: Number,
  maxEmployees: Number,
  billingCycle: "monthly" | "yearly",
  currentEmployeeCount: Number (default: 0),
  startDate: Date (required),
  renewalDate: Date (required),
  status: "active" | "inactive" | "cancelled",
  autoRenew: Boolean (default: true),
  paymentStatus: "pending" | "completed" | "failed",
  paymentMethod: String,
  amountPaid: Number,
  notes: String,
  timestamps: true
}
```

### Plan Model

Master table for subscription plans.

```javascript
{
  name: String ("Starter", "Professional", "Enterprise"),
  planType: String ("starter", "professional", "enterprise"),
  monthlyPrice: Number,
  yearlyPrice: Number,
  maxEmployees: Number,
  features: [String],
  description: String,
  active: Boolean (default: true),
  timestamps: true
}
```

---

## API Endpoints

### Company Registration

```
POST /api/company/register
Content-Type: application/json

{
  "name": "Tech Corp",
  "email": "info@techcorp.com",
  "phone": "9876543210",
  "password": "SecurePassword123",
  "industry": "IT",
  "website": "https://techcorp.com",
  "address": "123 Tech Street",
  "city": "Bangalore",
  "state": "KA",
  "pincode": "560001",
  "gstNumber": "18AABCT1234F2Z5",
  "panNumber": "AABCT1234F"
}

Response:
{
  "success": true,
  "data": {
    "_id": "6a14c9f56f74de4a37dac49a",
    "name": "Tech Corp",
    "email": "info@techcorp.com",
    "phone": "9876543210",
    "industry": "IT",
    "status": "trial",
    "subscription": {
      "plan": "starter",
      "maxEmployees": 10,
      "monthlyPrice": 50,
      "yearlyPrice": 500,
      "renewalDate": "2026-06-09",
      "status": "active"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

### Company Login

```
POST /api/company/login
Content-Type: application/json

{
  "email": "info@techcorp.com",
  "password": "SecurePassword123"
}
```

### Get Available Plans

```
GET /api/company/plans

Response:
{
  "success": true,
  "data": [
    {
      "_id": "plan_id_1",
      "name": "Starter",
      "planType": "starter",
      "monthlyPrice": 50,
      "yearlyPrice": 500,
      "maxEmployees": 10,
      "features": [...]
    },
    ...
  ]
}
```

### Get Company Details

```
GET /api/company/details
Authorization: Bearer <token>
```

### Update Company Profile

```
PUT /api/company/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Tech Corp Updated",
  "phone": "9876543211",
  "website": "https://techcorp-new.com",
  "logo": "https://cdn.example.com/logo.png"
}
```

### Upgrade Subscription

```
PUT /api/company/upgrade-subscription
Authorization: Bearer <token>
Content-Type: application/json

{
  "planType": "professional",
  "billingCycle": "yearly"
}
```

### Get Subscription Details

```
GET /api/company/subscription
Authorization: Bearer <token>
```

---

## Workflow

### 1. Company Registration

1. Company registers via `/api/company/register`
2. Company automatically gets a **14-day free trial** on Starter plan
3. Subscription status: `trial`
4. Company can start using the platform

### 2. Plan Upgrade

1. During trial or anytime, company can upgrade via `/api/company/upgrade-subscription`
2. Old subscription marked as `inactive`
3. New subscription created with selected plan and billing cycle
4. Company status changes to `active`
5. Renewal date calculated based on billing cycle

### 3. Employee Management

- Company can add employees up to the `maxEmployees` limit of their plan
- Attempting to add more employees beyond the limit will require an upgrade
- `currentEmployeeCount` tracks active employees

### 4. Billing Cycles

- **Monthly**: Renewal date = current date + 1 month
- **Yearly**: Renewal date = current date + 1 year (with discount)

---

## Setup Instructions

### 1. Seed Plans into Database

```bash
cd backend
node scripts/seedPlans.js
```

This will create the three subscription plans in the database.

### 2. Environment Variables

Ensure `.env` contains:

```
MONGO_URI=mongodb://localhost:27017/hrms
JWT_SECRET=your_jwt_secret_key
PORT=5001
```

### 3. Start the Server

```bash
npm start
```

---

## Example Usage Flow

### Company Signs Up

```bash
curl -X POST http://localhost:5001/api/company/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ABC Industries",
    "email": "admin@abcindustries.com",
    "phone": "9876543210",
    "password": "SecurePass123",
    "industry": "Manufacturing"
  }'
```

### Get Available Plans

```bash
curl http://localhost:5001/api/company/plans
```

### Upgrade to Professional (Yearly)

```bash
curl -X PUT http://localhost:5001/api/company/upgrade-subscription \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "planType": "professional",
    "billingCycle": "yearly"
  }'
```

---

## Key Features

✅ **Multi-tier Subscription Model** - 3 different plans
✅ **Flexible Billing** - Monthly or Yearly
✅ **Yearly Discount** - 16.67% discount on yearly plans
✅ **Trial Period** - 14 days free on Starter plan
✅ **Employee Limits** - Based on subscription tier
✅ **Company Registration** - Full company profile management
✅ **Plan Upgrades** - Easy upgrade to higher tiers
✅ **Subscription Tracking** - Complete billing history

---

## Future Enhancements

- [ ] Payment gateway integration (Razorpay, PayPal)
- [ ] Automated renewal reminders
- [ ] Invoice generation
- [ ] Usage analytics & reporting
- [ ] Downgrade options
- [ ] Cancellation with pro-rata refunds
- [ ] Multi-currency support
- [ ] Custom plans for enterprises

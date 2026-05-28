# NestHR HRMS

Human Resource Management System built with the same neubrutalism design template as Agency Flow CRM.

## Color Scheme

- **Primary Blue** `#024BAB`
- **Accent Orange** `#FA731C`
- **Black** `#000000`
- **White** `#FFFFFF`

## Modules

| Module      | Description                                    |
| ----------- | ---------------------------------------------- |
| Dashboard   | HR metrics, attendance rate, pending approvals |
| Employees   | Employee records, profiles, onboarding         |
| Attendance  | Daily check-in/out, monthly tracking           |
| Leave       | Leave requests, approval workflow              |
| Payroll     | Salary processing, payslips, PF/ESI            |
| Recruitment | Job postings, candidate pipeline               |
| Performance | Reviews, ratings, goal tracking                |
| Departments | Department management, headcount               |
| Settings    | Profile, notifications, company config         |

## Roles

- `super_admin` — Full access
- `hr_manager` — All HR modules
- `hr_executive` — Employees, attendance, leave, recruitment
- `department_head` — Own team's data
- `employee` — Own profile, attendance, leaves

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + MongoDB (Mongoose)
- **Design**: Neubrutalism (same pattern as Agency Flow CRM)

## Setup

### Backend

```bash
cd backend
cp .env.example .env   # fill in MONGO_URI and JWT_SECRET
npm install
npm run dev            # runs on port 5001
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev            # runs on port 5174
```

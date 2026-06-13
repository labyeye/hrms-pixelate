# NestHR Privacy Policy

**Effective Date:** June 11, 2026
**Last Updated:** June 11, 2026

---

## 1. Introduction

NestHR ("we", "our", "us") is a Human Resource Management System (HRMS) platform developed and operated by Pixelate Nest. This Privacy Policy explains how we collect, use, store, share, and protect personal information when businesses ("Clients") use the NestHR platform and when individuals ("Employees") interact with it.

By using NestHR, you agree to the collection and use of information as described in this policy. This policy is governed by the **Digital Personal Data Protection Act, 2023 (DPDPA)** and the **Information Technology Act, 2000** of India.

---

## 2. Who This Policy Applies To

This policy applies to:

- **Client Organisations** — Companies and businesses that subscribe to and administer NestHR.
- **End Users** — HR managers, administrators, and employees who access NestHR through a Client's account.
- **Visitors** — Anyone who visits our marketing website at `hrms.pixelatenest.com`.

---

## 3. Data We Collect

### 3.1 Personal Identification Data

- Full name, email address, phone number, gender, date of birth
- Government-issued identifiers: **PAN number**, **Aadhaar number**
- Profile photograph / avatar

### 3.2 Employment Data

- Employee ID, designation, department, branch
- Employment type (full-time, part-time, contract, intern)
- Join date, exit date, employment status
- Shift assignments and working hour configurations

### 3.3 Financial & Payroll Data

- Bank account number, account holder name, IFSC code, bank name
- Salary components: basic pay, HRA, DA, TA, medical and other allowances
- Deductions: PF (Provident Fund), ESI, TDS, loan repayments
- Net and gross salary calculations, overtime pay, penalty deductions
- Statutory IDs: **PF number**, **ESI number**, **UAN number**
- Loan and advance details including outstanding balances and EMI schedules

### 3.4 Biometric Data

- **Face recognition data**: facial descriptor vectors and device-specific face templates captured via on-device cameras
- **Fingerprint data**: device-specific fingerprint templates enrolled on biometric hardware
- **RFID / NFC card UIDs** linked to individual employees
- Biometric enrollment timestamps and verification logs

> **Important:** Biometric data is among the most sensitive categories of personal data. It is collected only for the purpose of attendance verification and access control, processed on-device where possible, and is never sold or shared with third parties for any purpose other than device synchronisation.

### 3.5 Attendance & Time Records

- Daily check-in and check-out timestamps
- Total work hours, overtime hours, late arrivals, early departures
- Attendance status (present, absent, half-day, on leave, holiday)
- Verification method used (face, fingerprint, NFC card, PIN, manual)

### 3.6 Leave Records

- Leave type, dates, duration, and reason
- Approval/rejection decisions and approver identity
- Remaining leave balance per type

### 3.7 Performance Data

- Review periods, ratings (1–5 scale), goal descriptions and achievement metrics
- Reviewer comments and employee self-assessments
- Probation, quarterly, half-yearly, and annual review records

### 3.8 Recruitment Data

- Candidate name, email, phone, and uploaded résumé
- Job posting details, salary ranges, hiring pipeline stage, and interview notes

### 3.9 Account & Technical Data

- Login credentials (passwords stored as **bcrypt hashes** — never in plain text)
- JWT authentication tokens stored in browser local storage
- Last login timestamps, role assignments, account status
- IP addresses and device identifiers (via standard HTTP request headers)

---

## 4. How We Use Your Data

| Purpose                                           | Data Used                                        |
| ------------------------------------------------- | ------------------------------------------------ |
| Employee identity verification and access control | Biometric data, government IDs                   |
| Payroll processing and statutory compliance       | Financial data, attendance, leave, statutory IDs |
| Attendance management                             | Biometric logs, timestamps                       |
| Leave and loan administration                     | Leave records, loan details                      |
| Recruitment pipeline management                   | Candidate data, job postings                     |
| Performance appraisal                             | Review data, goal metrics                        |
| Subscription billing and invoicing                | Company contact, payment method tokens           |
| WhatsApp / email notifications                    | Phone number, email                              |
| Platform security and fraud prevention            | IP addresses, login history, rate limiting       |
| Legal and statutory compliance (PF, ESI, TDS)     | Financial and statutory data                     |

We do **not** use personal data for advertising, profiling for sale, or any purpose not listed above.

---

## 5. Data Sharing and Third-Party Services

NestHR integrates with the following third-party services. We share only the minimum data necessary for each integration.

### 5.1 Payment Processing

- **Razorpay** — Used for subscription billing and payment method tokenisation. Card/UPI details are handled entirely by Razorpay under their own PCI-DSS compliance. We store only the tokenised reference, not raw payment credentials.
- **HDFC SmartGateway** — Used as an alternative payment gateway. Order IDs and bank reference numbers are stored; raw payment credentials are not.

### 5.2 Communication

- **Meta WhatsApp Business API** — Used to send HR notifications (e.g., payslip ready, leave approval). Your phone number is transmitted to Meta's servers to deliver messages. Meta's own privacy policy governs that processing.
- **Nodemailer (SMTP)** — Used for email delivery of notifications and reports.

### 5.3 Biometric Hardware

- **ZKTeco / ESSL Devices** — Biometric templates and commands are synchronised between NestHR servers and on-premise biometric devices. This data does not leave your organisation's network except to synchronise with the NestHR server you are connected to.

### 5.4 Cloud Infrastructure

- **MongoDB Atlas** — All application data is stored on MongoDB Atlas (cloud-hosted), which provides encryption at rest and in transit.

We do **not** sell, rent, or trade personal data to any third party.

---

## 6. Data Retention

| Data Category                           | Retention Period                                       |
| --------------------------------------- | ------------------------------------------------------ |
| Active employee records                 | Duration of employment + 7 years                       |
| Payroll records                         | 10 years (statutory requirement)                       |
| Biometric data                          | Duration of employment; deleted within 30 days of exit |
| Attendance logs                         | 7 years                                                |
| Recruitment data (non-hired candidates) | 1 year from last activity                              |
| Audit logs                              | 3 years                                                |
| Deleted account data                    | 90 days (then permanently purged)                      |

Clients may request earlier deletion subject to applicable statutory obligations.

---

## 7. Data Security

We implement appropriate technical and organisational measures to protect your data:

- **Encryption in transit**: All API communication uses HTTPS/TLS.
- **Encryption at rest**: MongoDB Atlas encrypts data at rest.
- **Password security**: All passwords are hashed using bcryptjs (10 salt rounds). Plain-text passwords are never stored or logged.
- **Access control**: Role-based access control (RBAC) with five distinct roles limits data access to authorised personnel only.
- **Authentication**: JWT-based session management with short-lived tokens.
- **Rate limiting**: Authentication endpoints are rate-limited (50 requests/15 minutes) to mitigate brute-force attacks.
- **Security headers**: HTTP security headers including HSTS and Content Security Policy are enforced via Helmet.js.
- **CORS policy**: Cross-origin requests are restricted to allowlisted domains.

In the event of a data breach affecting your rights, we will notify affected parties as required by the DPDPA 2023 within **72 hours** of becoming aware.

---

## 8. Biometric Data — Special Notice

Biometric data (face descriptors, fingerprint templates) is treated as a **special category of sensitive personal data** under applicable law.

- Collected **only with the knowledge and consent** of the employee through the Client organisation's enrolment process.
- Used **exclusively** for attendance marking and access control.
- Facial recognition processing occurs **client-side** in the browser using `face-api.js` where possible, minimising server-side exposure.
- Biometric templates are stored in encrypted form and are **not shared** with any third party.
- Employees may request deletion of their biometric data at any time via their employer (Client organisation).

---

## 9. Your Rights

Under the **DPDPA 2023** and applicable law, you have the right to:

1. **Access** — Request a copy of your personal data held by us.
2. **Correction** — Request correction of inaccurate or incomplete data.
3. **Erasure** — Request deletion of your data (subject to statutory retention requirements).
4. **Grievance Redressal** — Lodge a complaint with our Data Protection Officer.
5. **Nomination** — Nominate another person to exercise rights on your behalf in case of incapacity.
6. **Withdraw Consent** — Where processing is consent-based, withdraw consent at any time (this will not affect prior processing).

> **Note for Employees:** NestHR acts as a **Data Processor** on behalf of your employer (the Client). For requests related to your employment data, please contact your HR department directly. We will assist the Client in fulfilling your request.

---

## 10. Cookies and Tracking

The NestHR web application does not use tracking cookies or third-party analytics cookies. We use:

- **Session/authentication storage** in browser `localStorage` for JWT tokens.
- No advertising cookies, cross-site trackers, or fingerprinting.

Our marketing website may use standard web analytics. We will update this section if that practice changes.

---

## 11. Children's Privacy

NestHR is a professional employment platform. We do not knowingly collect data from individuals under **18 years of age**. If we become aware that a minor's data has been collected, we will delete it promptly.

---

## 12. Cross-Border Data Transfers

NestHR's servers are hosted in India via MongoDB Atlas. Payment processing involves Razorpay (India) and HDFC (India). WhatsApp messages are processed by Meta (USA). Where data is transferred outside India, we ensure adequate contractual protections are in place consistent with the DPDPA 2023.

---

## 13. Changes to This Policy

We may update this Privacy Policy from time to time. When we make material changes, we will notify Client administrators via email and via an in-app banner at least **14 days** before the change takes effect. Continued use of NestHR after that date constitutes acceptance of the revised policy.

---

## 14. Contact Us & Grievance Officer

For privacy-related queries, data requests, or to raise a grievance, contact our **Data Protection / Grievance Officer**:

**NestHR — Pixelate Nest**
Email: **privacy@pixelatenest.com**
Address: _(add your registered business address)_

Response time: We aim to acknowledge all requests within **7 business days** and resolve them within **30 days**.

If you are unsatisfied with our response, you may escalate to the **Data Protection Board of India** under the DPDPA 2023.

---

_This Privacy Policy was drafted based on NestHR's actual data practices as of the effective date above._
_Before publishing, replace the placeholder email and address in Section 14, and have a legal counsel review it — particularly the biometric and government ID sections._

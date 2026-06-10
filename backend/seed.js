require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Company = require("./models/Company");
const Subscription = require("./models/Subscription");
const Plan = require("./models/Plan");
const Invoice = require("./models/Invoice");
const User = require("./models/User");
const Department = require("./models/Department");
const Designation = require("./models/Designation");
const Branch = require("./models/Branch");
const Shift = require("./models/Shift");
const Setting = require("./models/Setting");
const DeductionRule = require("./models/DeductionRule");
const Employee = require("./models/Employee");
const Attendance = require("./models/Attendance");
const Leave = require("./models/Leave");
const Payroll = require("./models/Payroll");
const Transaction = require("./models/Transaction");
const Holiday = require("./models/Holiday");
const BiometricLocation = require("./models/BiometricLocation");
const BiometricDevice = require("./models/BiometricDevice");
const BiometricLog = require("./models/BiometricLog");
const Recruitment = require("./models/Recruitment");
const Performance = require("./models/Performance");

// ─── helpers ──────────────────────────────────────────────────────────────────

function randomBetween(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Build a Date for a given day offset at a specific hour:minute
function dateAt(dayOffset, hour, min = 0) {
  const d = new Date();
  d.setDate(d.getDate() - dayOffset);
  d.setHours(hour, min, 0, 0);
  return d;
}

// ─── seed ─────────────────────────────────────────────────────────────────────

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✔  Connected to MongoDB");

  // ── 1. Clear everything ────────────────────────────────────────────────────
  console.log("⟳  Clearing all collections...");
  await Promise.all([
    Company.deleteMany({}),
    Subscription.deleteMany({}),
    Plan.deleteMany({}),
    Invoice.deleteMany({}),
    User.deleteMany({}),
    Department.deleteMany({}),
    Designation.deleteMany({}),
    Branch.deleteMany({}),
    Shift.deleteMany({}),
    Setting.deleteMany({}),
    DeductionRule.deleteMany({}),
    Employee.deleteMany({}),
    Attendance.deleteMany({}),
    Leave.deleteMany({}),
    Payroll.deleteMany({}),
    Transaction.deleteMany({}),
    Holiday.deleteMany({}),
    BiometricLocation.deleteMany({}),
    BiometricDevice.deleteMany({}),
    BiometricLog.deleteMany({}),
    Recruitment.deleteMany({}),
    Performance.deleteMany({}),
  ]);
  console.log("✔  All collections cleared");

  // ── 2. Plans ───────────────────────────────────────────────────────────────
  await Plan.insertMany([
    {
      name: "Starter",
      planType: "starter",
      monthlyPrice: 1499,
      yearlyPrice: 14990,
      maxEmployees: 10,
      description: "Perfect for small businesses",
      features: [
        "Up to 10 employees",
        "Attendance & leave",
        "Basic payroll",
        "Email support",
      ],
      active: true,
    },
    {
      name: "Professional",
      planType: "professional",
      monthlyPrice: 3499,
      yearlyPrice: 34990,
      maxEmployees: 50,
      description: "For growing HR teams",
      features: [
        "Up to 50 employees",
        "Full payroll",
        "Biometric attendance",
        "WhatsApp notifications",
        "Priority support",
      ],
      active: true,
    },
    {
      name: "Enterprise",
      planType: "enterprise",
      monthlyPrice: 7999,
      yearlyPrice: 79990,
      maxEmployees: 999,
      description: "Unlimited scale",
      features: [
        "Unlimited employees",
        "All Professional features",
        "Dedicated manager",
        "SLA guarantee",
      ],
      active: true,
    },
  ]);
  console.log("✔  Plans created");

  // ── 3. NestHR super admin (no company) ────────────────────────────────────
  const nesthrAdmin = await User.create({
    name: "NestHR Admin",
    email: "admin@nesthr.in",
    password: "NestHR@2026",
    role: "super_admin",
    phone: "919999999999",
    status: "active",
  });

  // ── 4. Company ─────────────────────────────────────────────────────────────
  const hashedPass = await bcrypt.hash("Company@123", 10);
  const company = await Company.create({
    name: "TechNest Solutions Pvt Ltd",
    email: "info@technest.com",
    phone: "919876543200",
    password: hashedPass,
    industry: "Information Technology",
    website: "https://technest.com",
    address: "101 Cyber Tower, Hitech City",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500081",
    country: "India",
    status: "active",
    createdBy: nesthrAdmin._id,
  });

  const now = new Date();
  const renewal = new Date(now);
  renewal.setFullYear(renewal.getFullYear() + 1);

  const subscription = await Subscription.create({
    company: company._id,
    plan: "professional",
    monthlyPrice: 3499,
    yearlyPrice: 34990,
    maxEmployees: 50,
    billingCycle: "yearly",
    currentEmployeeCount: 0,
    startDate: now,
    renewalDate: renewal,
    status: "active",
    autoRenew: true,
    paymentStatus: "completed",
    paymentMethod: "razorpay",
    amountPaid: 34990,
    notes: "Seeded subscription",
  });
  company.subscription = subscription._id;
  await company.save();

  for (let m = 2; m >= 0; m--) {
    const iDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    await Invoice.create({
      company: company._id,
      subscription: subscription._id,
      invoiceNumber: `INV-2026${String(now.getMonth() - m + 1).padStart(2, "0")}${String(m + 1).padStart(3, "0")}`,
      plan: "Professional",
      billingCycle: "monthly",
      amount: 3499,
      status: "paid",
      paidAt: iDate,
      razorpayOrderId: `order_seed_${m}`,
      razorpayPaymentId: `pay_seed_${m}`,
    });
  }
  console.log("✔  Company + subscription + invoices created");

  // ── 5. Company Settings ────────────────────────────────────────────────────
  await Setting.create({
    company: company._id,
    companyName: "TechNest Solutions Pvt Ltd",
    // Overtime: global switch ON — per-employee flag controls who actually gets it
    otEnabled: true,
    otRate: 0,
    // WhatsApp: enabled (will silently skip if META_WA_TOKEN not set)
    whatsappEnabled: true,
    whatsappNotifyCheckIn: true,
    whatsappNotifyLeave: true,
    whatsappNotifyPayroll: true,
    whatsappLang: "en",
    // Salary
    salaryMode: "monthly",
    salaryPayDay: "28",
    // ESS
    essAllowPunch: true,
    essAllowLeave: true,
    essAllowPayslip: true,
  });
  console.log("✔  Company settings created");

  // ── 6. Deduction Rule ──────────────────────────────────────────────────────
  await DeductionRule.create({
    company: company._id,
    shiftStartHour: 9,
    shiftStartMinute: 0,
    shiftEndHour: 18,
    shiftEndMinute: 0,
    lateThresholdMinutes: 15,
    lateDeductionEnabled: true,
    lateDeductionType: "fixed",
    lateDeductionAmount: 100,
    halfDayThresholdMinutes: 120,
    earlyCheckoutThresholdMinutes: 30,
    earlyCheckoutDeductionEnabled: true,
  });
  console.log("✔  Deduction rule created");

  // ── 7. Shifts ──────────────────────────────────────────────────────────────
  const shiftMorning = await Shift.create({
    company: company._id,
    name: "Morning Shift",
    startTime: "09:00",
    endTime: "18:00",
    breakMinutes: 60,
    workingHours: 8,
    otAfterHours: 9,
    color: "#024BAB",
    status: "active",
  });
  const shiftGeneral = await Shift.create({
    company: company._id,
    name: "General Shift",
    startTime: "09:30",
    endTime: "17:30",
    breakMinutes: 30,
    workingHours: 7.5,
    otAfterHours: 8.5,
    color: "#16A34A",
    status: "active",
  });
  console.log("✔  Shifts created (Morning 9-6, General 9:30-5:30)");

  // ── 8. Branch ──────────────────────────────────────────────────────────────
  const branch = await Branch.create({
    company: company._id,
    name: "Hyderabad HQ",
    code: "HYD",
    address: "101 Cyber Tower, Hitech City, Hyderabad",
    isActive: true,
  });

  // ── 9. Departments & Designations ─────────────────────────────────────────
  const deptEngineering = await Department.create({
    company: company._id,
    name: "Engineering",
    code: "ENG",
    description: "Product & software development",
    budget: 5000000,
  });
  const deptHR = await Department.create({
    company: company._id,
    name: "Human Resources",
    code: "HR",
    description: "People operations",
    budget: 1500000,
  });
  const deptFinance = await Department.create({
    company: company._id,
    name: "Finance",
    code: "FIN",
    description: "Accounts and finance",
    budget: 2000000,
  });
  const deptMarketing = await Department.create({
    company: company._id,
    name: "Marketing",
    code: "MKT",
    description: "Growth and marketing",
    budget: 1800000,
  });

  const desgSWE = await Designation.create({
    company: company._id,
    name: "Software Engineer",
    department: deptEngineering._id,
  });
  const desgSrDev = await Designation.create({
    company: company._id,
    name: "Senior Developer",
    department: deptEngineering._id,
  });
  const desgQA = await Designation.create({
    company: company._id,
    name: "QA Engineer",
    department: deptEngineering._id,
  });
  const desgHRMgr = await Designation.create({
    company: company._id,
    name: "HR Manager",
    department: deptHR._id,
  });
  const desgHRExec = await Designation.create({
    company: company._id,
    name: "HR Executive",
    department: deptHR._id,
  });
  const desgFinAnalyst = await Designation.create({
    company: company._id,
    name: "Finance Analyst",
    department: deptFinance._id,
  });
  const desgMktExec = await Designation.create({
    company: company._id,
    name: "Marketing Executive",
    department: deptMarketing._id,
  });
  console.log("✔  Departments + designations created");

  // ── 10. Users & Employees ──────────────────────────────────────────────────
  // HR Manager
  const hrMgrUser = await User.create({
    name: "Priya Sharma",
    email: "priya.sharma@technest.com",
    password: "Hr@Manager1",
    role: "hr_manager",
    phone: "919123456781",
    company: company._id,
    department: deptHR._id,
    status: "active",
  });
  const hrMgrEmp = await Employee.create({
    user: hrMgrUser._id,
    company: company._id,
    employeeId: "TNS-001",
    firstName: "Priya",
    lastName: "Sharma",
    email: "priya.sharma@technest.com",
    phone: "919123456781",
    department: deptHR._id,
    designation: desgHRMgr._id,
    branch: branch._id,
    shift: shiftMorning._id,
    shiftName: shiftMorning.name,
    employmentType: "full_time",
    joinDate: new Date("2022-01-15"),
    status: "active",
    salary: 850000,
    gender: "female",
    dateOfBirth: new Date("1990-05-20"),
    workDaysPerWeek: 6,
    otEnabled: false,
    otRate: 0,
    biometricUserId: "1",
  });
  hrMgrUser.employeeId = hrMgrEmp.employeeId;
  await hrMgrUser.save();

  // HR Executive
  const hrExecUser = await User.create({
    name: "Rahul Verma",
    email: "rahul.verma@technest.com",
    password: "Hr@Exec123",
    role: "hr_executive",
    phone: "919123456782",
    company: company._id,
    department: deptHR._id,
    status: "active",
  });
  const hrExecEmp = await Employee.create({
    user: hrExecUser._id,
    company: company._id,
    employeeId: "TNS-002",
    firstName: "Rahul",
    lastName: "Verma",
    email: "rahul.verma@technest.com",
    phone: "919123456782",
    department: deptHR._id,
    designation: desgHRExec._id,
    branch: branch._id,
    shift: shiftMorning._id,
    shiftName: shiftMorning.name,
    employmentType: "full_time",
    joinDate: new Date("2022-06-01"),
    status: "active",
    salary: 550000,
    gender: "male",
    dateOfBirth: new Date("1995-03-10"),
    workDaysPerWeek: 6,
    otEnabled: false,
    otRate: 0,
    biometricUserId: "2",
  });
  hrExecUser.employeeId = hrExecEmp.employeeId;
  await hrExecUser.save();

  // Regular employees
  // otEnabled: true  → Vikram, Deepika, Karan  (they work overtime, get paid for it)
  // otEnabled: false → Ananya, Sonal, Arjun    (checkout capped at shift end)
  const empData = [
    {
      id: "TNS-003",
      bioId: "3",
      firstName: "Ananya",
      lastName: "Reddy",
      email: "ananya.reddy@technest.com",
      phone: "919000000001",
      dept: deptEngineering._id,
      desg: desgSWE._id,
      salary: 720000,
      gender: "female",
      dob: "1997-08-14",
      join: "2023-02-01",
      shift: shiftMorning._id,
      shiftName: "Morning Shift",
      otEnabled: false,
      otRate: 0,
    },
    {
      id: "TNS-004",
      bioId: "4",
      firstName: "Vikram",
      lastName: "Singh",
      email: "vikram.singh@technest.com",
      phone: "919000000002",
      dept: deptEngineering._id,
      desg: desgSrDev._id,
      salary: 1200000,
      gender: "male",
      dob: "1993-11-22",
      join: "2021-07-15",
      shift: shiftMorning._id,
      shiftName: "Morning Shift",
      otEnabled: true,
      otRate: 150,
    },
    {
      id: "TNS-005",
      bioId: "5",
      firstName: "Sonal",
      lastName: "Mehta",
      email: "sonal.mehta@technest.com",
      phone: "919000000003",
      dept: deptFinance._id,
      desg: desgFinAnalyst._id,
      salary: 680000,
      gender: "female",
      dob: "1996-04-05",
      join: "2022-11-01",
      shift: shiftGeneral._id,
      shiftName: "General Shift",
      otEnabled: false,
      otRate: 0,
    },
    {
      id: "TNS-006",
      bioId: "6",
      firstName: "Arjun",
      lastName: "Kapoor",
      email: "arjun.kapoor@technest.com",
      phone: "919000000004",
      dept: deptMarketing._id,
      desg: desgMktExec._id,
      salary: 580000,
      gender: "male",
      dob: "1998-01-30",
      join: "2023-05-10",
      shift: shiftGeneral._id,
      shiftName: "General Shift",
      otEnabled: false,
      otRate: 0,
    },
    {
      id: "TNS-007",
      bioId: "7",
      firstName: "Deepika",
      lastName: "Nair",
      email: "deepika.nair@technest.com",
      phone: "919000000005",
      dept: deptEngineering._id,
      desg: desgQA._id,
      salary: 650000,
      gender: "female",
      dob: "1996-09-18",
      join: "2022-09-01",
      shift: shiftMorning._id,
      shiftName: "Morning Shift",
      otEnabled: true,
      otRate: 120,
    },
    {
      id: "TNS-008",
      bioId: "8",
      firstName: "Karan",
      lastName: "Bhatia",
      email: "karan.bhatia@technest.com",
      phone: "919000000006",
      dept: deptMarketing._id,
      desg: desgMktExec._id,
      salary: 520000,
      gender: "male",
      dob: "1999-06-25",
      join: "2023-08-20",
      shift: shiftGeneral._id,
      shiftName: "General Shift",
      otEnabled: true,
      otRate: 100,
    },
  ];

  const createdEmployees = [];
  for (const e of empData) {
    const user = await User.create({
      name: `${e.firstName} ${e.lastName}`,
      email: e.email,
      password: "Employee@123",
      role: "employee",
      phone: e.phone,
      company: company._id,
      department: e.dept,
      status: "active",
    });
    const emp = await Employee.create({
      user: user._id,
      company: company._id,
      employeeId: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      email: e.email,
      phone: e.phone,
      department: e.dept,
      designation: e.desg,
      branch: branch._id,
      shift: e.shift,
      shiftName: e.shiftName,
      employmentType: "full_time",
      joinDate: new Date(e.join),
      status: "active",
      salary: e.salary,
      gender: e.gender,
      dateOfBirth: new Date(e.dob),
      workDaysPerWeek: 6,
      otEnabled: e.otEnabled,
      otRate: e.otRate,
      biometricUserId: e.bioId,
    });
    user.employeeId = emp.employeeId;
    await user.save();
    createdEmployees.push(emp);
  }

  subscription.currentEmployeeCount = 2 + empData.length;
  await subscription.save();

  await Department.findByIdAndUpdate(deptHR._id, {
    headcount: 2,
    head: hrMgrUser._id,
  });
  await Department.findByIdAndUpdate(deptEngineering._id, { headcount: 3 });
  await Department.findByIdAndUpdate(deptFinance._id, { headcount: 1 });
  await Department.findByIdAndUpdate(deptMarketing._id, { headcount: 2 });
  console.log("✔  Employees created");

  // ── 11. Attendance (30 days, with OT scenarios) ────────────────────────────
  const allEmployees = [hrMgrEmp, hrExecEmp, ...createdEmployees];

  // Shift end times for capping reference
  const shiftEnds = {
    [shiftMorning._id.toString()]: 18, // 18:00
    [shiftGeneral._id.toString()]: 17.5, // 17:30
  };

  for (let dayOffset = 1; dayOffset <= 30; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue; // skip weekends

    for (const emp of allEmployees) {
      const roll = Math.random();
      // 70% present, 10% late, 10% absent, 10% half day
      let status =
        roll < 0.7
          ? "present"
          : roll < 0.8
            ? "late"
            : roll < 0.9
              ? "absent"
              : "half_day";

      if (status === "absent") {
        await Attendance.create({
          employee: emp._id,
          date,
          status: "absent",
          workHours: 0,
        });
        continue;
      }

      const checkInHour = status === "late" ? randomBetween(10, 11) : 9;
      const checkInMin = randomBetween(0, 29);
      const checkIn = new Date(date);
      checkIn.setHours(checkInHour, checkInMin, 0, 0);

      // Raw punch-out: 30% chance of staying late (till 7-8 PM)
      const staysLate = Math.random() < 0.3;
      const rawCheckOutHour = staysLate
        ? randomBetween(19, 20)
        : randomBetween(17, 18);
      const rawCheckOut = new Date(date);
      rawCheckOut.setHours(rawCheckOutHour, randomBetween(0, 30), 0, 0);

      // Apply OT cap logic (mirrors backend shiftUtils)
      let effectiveCheckOut = rawCheckOut;
      let overtimeHours = 0;

      if (emp.otEnabled) {
        // OT enabled: use actual checkout, calc OT
        const shiftEndHour = emp.shift?.equals(shiftMorning._id) ? 18 : 17;
        const shiftEndMin = emp.shift?.equals(shiftMorning._id) ? 0 : 30;
        const shiftEnd = new Date(date);
        shiftEnd.setHours(shiftEndHour, shiftEndMin, 0, 0);
        if (rawCheckOut > shiftEnd) {
          overtimeHours = parseFloat(
            ((rawCheckOut - shiftEnd) / 3600000).toFixed(2),
          );
        }
        effectiveCheckOut = rawCheckOut;
      } else {
        // OT disabled: cap at shift end
        const shiftEndHour = emp.shift?.equals(shiftMorning._id) ? 18 : 17;
        const shiftEndMin = emp.shift?.equals(shiftMorning._id) ? 0 : 30;
        const shiftEnd = new Date(date);
        shiftEnd.setHours(shiftEndHour, shiftEndMin, 0, 0);
        if (rawCheckOut > shiftEnd) effectiveCheckOut = shiftEnd;
      }

      const workHours = parseFloat(
        ((effectiveCheckOut - checkIn) / 3600000).toFixed(2),
      );

      await Attendance.create({
        employee: emp._id,
        date,
        status,
        checkIn,
        checkOut: effectiveCheckOut,
        workHours,
        overtime: overtimeHours,
        markedBy: hrMgrUser._id,
        verifyMode: "fingerprint",
      });
    }
  }
  console.log("✔  Attendance records created (30 days, OT caps applied)");

  // ── 12. OT Transactions for OT-enabled employees ───────────────────────────
  // Vikram, Deepika, Karan — add a few manual OT transactions this month
  const otEmployees = createdEmployees.filter((e) => e.otEnabled);
  for (const emp of otEmployees) {
    const otHrs = randomBetween(5, 15);
    await Transaction.create({
      company: company._id,
      employee: emp._id,
      type: "overtime",
      hours: otHrs,
      amount: (emp.otRate || 0) * otHrs,
      date: now,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      description: "Monthly overtime",
      status: "pending",
      createdBy: hrMgrUser._id,
    });
  }
  console.log("✔  OT transactions created for OT-enabled employees");

  // ── 13. Leaves ─────────────────────────────────────────────────────────────
  const leaveTypes = ["casual", "sick", "earned"];
  const leaveScenarios = [
    { status: "approved" },
    { status: "approved" },
    { status: "pending" },
    { status: "rejected", rejectionReason: "Insufficient leave balance" },
  ];

  for (let i = 0; i < 14; i++) {
    const emp = allEmployees[i % allEmployees.length];
    const startOffset = randomBetween(2, 28);
    const start = new Date();
    start.setDate(start.getDate() - startOffset);
    start.setHours(0, 0, 0, 0);
    const days = randomBetween(1, 3);
    const end = new Date(start);
    end.setDate(end.getDate() + days - 1);
    const scenario = pickRandom(leaveScenarios);

    await Leave.create({
      company: company._id,
      employee: emp._id,
      leaveType: pickRandom(leaveTypes),
      startDate: start,
      endDate: end,
      days,
      reason: pickRandom([
        "Family emergency",
        "Medical appointment",
        "Personal work",
        "Sick leave",
        "Out of town",
      ]),
      status: scenario.status,
      approvedBy: scenario.status === "approved" ? hrMgrUser._id : undefined,
      approvedAt: scenario.status === "approved" ? new Date() : undefined,
      rejectionReason: scenario.rejectionReason,
    });
  }
  console.log("✔  Leave records created");

  // ── 14. Payroll (3 months) ─────────────────────────────────────────────────
  const MONTHS = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  for (let m = 0; m < 3; m++) {
    const payMonth =
      now.getMonth() - m < 0 ? 12 + now.getMonth() - m : now.getMonth() - m + 1;
    const payYear =
      now.getMonth() - m < 0 ? now.getFullYear() - 1 : now.getFullYear();

    for (const emp of allEmployees) {
      const basic = Math.round((emp.salary * 0.5) / 12);
      const hra = Math.round((emp.salary * 0.2) / 12);
      const da = Math.round((emp.salary * 0.1) / 12);
      const ta = 2000;
      const medical = 1250;
      const gross = basic + hra + da + ta + medical;
      const pf = Math.round(basic * 0.12);
      const esi = Math.round(gross * 0.0175);
      const tds = Math.round(gross * 0.05);
      const otHours = emp.otEnabled ? randomBetween(5, 15) : 0;
      const otPay = emp.otEnabled ? otHours * (emp.otRate || 0) : 0;
      const totalDed = pf + esi + tds;
      const net = gross + otPay - totalDed;

      await Payroll.create({
        company: company._id,
        employee: emp._id,
        month: payMonth,
        year: payYear,
        basicSalary: basic,
        hra,
        da,
        ta,
        medicalAllowance: medical,
        grossSalary: gross,
        overtimeHours: otHours,
        otPay,
        pf,
        esi,
        tds,
        totalDeductions: totalDed,
        netSalary: net,
        status: m > 0 ? "paid" : "processed",
        paidAt: m > 0 ? new Date() : undefined,
        processedBy: hrMgrUser._id,
      });
    }
  }
  console.log(
    "✔  Payroll records created (3 months, OT pay included for eligible)",
  );

  // ── 15. Holidays ───────────────────────────────────────────────────────────
  const y = now.getFullYear();
  await Holiday.insertMany([
    {
      company: company._id,
      name: "Republic Day",
      date: new Date(`${y}-01-26`),
      type: "national",
    },
    {
      company: company._id,
      name: "Holi",
      date: new Date(`${y}-03-14`),
      type: "national",
    },
    {
      company: company._id,
      name: "Good Friday",
      date: new Date(`${y}-04-03`),
      type: "national",
    },
    {
      company: company._id,
      name: "Independence Day",
      date: new Date(`${y}-08-15`),
      type: "national",
    },
    {
      company: company._id,
      name: "Gandhi Jayanti",
      date: new Date(`${y}-10-02`),
      type: "national",
    },
    {
      company: company._id,
      name: "Dussehra",
      date: new Date(`${y}-10-22`),
      type: "national",
    },
    {
      company: company._id,
      name: "Diwali",
      date: new Date(`${y}-11-10`),
      type: "national",
    },
    {
      company: company._id,
      name: "Christmas Day",
      date: new Date(`${y}-12-25`),
      type: "national",
    },
    {
      company: company._id,
      name: "Summer Outing",
      date: new Date(`${y}-06-05`),
      type: "optional",
      description: "Company summer outing",
    },
    {
      company: company._id,
      name: "Founders Day",
      date: new Date(`${y}-07-15`),
      type: "restricted",
      description: "Restricted — founding team",
    },
  ]);
  console.log("✔  Holidays created");

  // ── 16. Biometric location + device ────────────────────────────────────────
  const bioLocation = await BiometricLocation.create({
    company: company._id,
    name: "Hyderabad HQ",
    address: "101 Cyber Tower, Hitech City, Hyderabad",
    isActive: true,
  });
  await BiometricDevice.create({
    company: company._id,
    location: bioLocation._id,
    name: "Main Entrance Device",
    deviceToken: "seed_device_token_001",
    activationCode: "SEED01",
    activated: true,
    activatedAt: new Date(),
    isActive: true,
    lastSeenAt: new Date(),
  });
  console.log("✔  Biometric location + device created");

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log(
    "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━",
  );
  console.log("  ✅  SEED COMPLETE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("\n  COMPANY: TechNest Solutions Pvt Ltd");
  console.log("  PLAN:    Professional (Active, Yearly)\n");

  console.log("  ┌─ LOGIN CREDENTIALS ─────────────────────────────────────┐");
  console.log("  │                                                          │");
  console.log("  │  NestHR Admin (no company)                              │");
  console.log("  │    Email:    admin@nesthr.in                             │");
  console.log("  │    Password: NestHR@2026                                 │");
  console.log("  │                                                          │");
  console.log("  │  HR Manager                                              │");
  console.log("  │    Email:    priya.sharma@technest.com                   │");
  console.log("  │    Password: Hr@Manager1                                 │");
  console.log("  │                                                          │");
  console.log("  │  HR Executive                                            │");
  console.log("  │    Email:    rahul.verma@technest.com                    │");
  console.log("  │    Password: Hr@Exec123                                  │");
  console.log("  │                                                          │");
  console.log("  │  All Employees → Password: Employee@123                  │");
  console.log(
    "  └──────────────────────────────────────────────────────────┘\n",
  );

  console.log("  ┌─ OT CONFIGURATION ──────────────────────────────────────┐");
  console.log("  │  Global otEnabled: TRUE                                  │");
  console.log("  │                                                          │");
  console.log("  │  OT ENABLED (checkout = actual punch, OT counted)       │");
  console.log("  │    TNS-004  Vikram Singh     ₹150/hr  Morning Shift      │");
  console.log("  │    TNS-007  Deepika Nair     ₹120/hr  Morning Shift      │");
  console.log("  │    TNS-008  Karan Bhatia     ₹100/hr  General Shift      │");
  console.log("  │                                                          │");
  console.log("  │  OT DISABLED (checkout capped at shift end)             │");
  console.log("  │    TNS-001  Priya Sharma     HR Mgr   Morning Shift      │");
  console.log("  │    TNS-002  Rahul Verma      HR Exec  Morning Shift      │");
  console.log("  │    TNS-003  Ananya Reddy              Morning Shift      │");
  console.log("  │    TNS-005  Sonal Mehta               General Shift      │");
  console.log("  │    TNS-006  Arjun Kapoor              General Shift      │");
  console.log(
    "  └──────────────────────────────────────────────────────────┘\n",
  );

  console.log("  ┌─ SHIFTS ────────────────────────────────────────────────┐");
  console.log("  │  Morning Shift   09:00 – 18:00   (OT after 9h)         │");
  console.log("  │  General Shift   09:30 – 17:30   (OT after 8.5h)       │");
  console.log(
    "  └──────────────────────────────────────────────────────────┘\n",
  );

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

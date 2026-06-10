/**
 * seed-tenant.js
 *
 * Seeds departments, shifts, settings, employees, attendance, leave, and
 * payroll into an EXISTING company. Your company registration, subscription,
 * and admin user are left completely untouched.
 *
 * Usage:
 *   node seed-tenant.js <COMPANY_ID>
 *
 * Get your company ID from MongoDB Atlas or from the URL after logging in
 * to the NestHR admin panel.
 */

require("dotenv").config();
const mongoose = require("mongoose");

const Company = require("./models/Company");
const Subscription = require("./models/Subscription");
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

// ─── helpers ──────────────────────────────────────────────────────────────────

function randomBetween(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a;
}
function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function seedTenant(companyId) {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✔  Connected to MongoDB");

  // ── Validate company ────────────────────────────────────────────────────────
  const company = await Company.findById(companyId).populate("subscription");
  if (!company) {
    console.error(`❌  No company found with ID: ${companyId}`);
    process.exit(1);
  }
  console.log(`✔  Found company: "${company.name}"`);

  // Find the super_admin / hr_manager for this company to use as markedBy
  const adminUser = await User.findOne({
    company: company._id,
    role: { $in: ["super_admin", "hr_manager"] },
  });
  if (!adminUser) {
    console.error("❌  No super_admin or hr_manager user found for this company. Register and log in first.");
    process.exit(1);
  }
  console.log(`✔  Using admin: ${adminUser.email} (${adminUser.role})`);

  // ── Clear only this company's operational data ──────────────────────────────
  console.log("⟳  Clearing existing data for this company...");
  await Promise.all([
    Department.deleteMany({ company: company._id }),
    Designation.deleteMany({ company: company._id }),
    Branch.deleteMany({ company: company._id }),
    Shift.deleteMany({ company: company._id }),
    Setting.deleteMany({ company: company._id }),
    DeductionRule.deleteMany({ company: company._id }),
    // Only delete non-admin employees (keep your own user linked employees)
    Employee.deleteMany({ company: company._id, user: { $nin: [adminUser._id] } }),
    Attendance.deleteMany({ company: { $exists: false } }), // attendance has no company field — clear by employee below
    Leave.deleteMany({ company: company._id }),
    Payroll.deleteMany({ company: company._id }),
    Transaction.deleteMany({ company: company._id }),
    Holiday.deleteMany({ company: company._id }),
  ]);
  // Clear attendance for employees of this company
  const existingEmpIds = (await Employee.find({ company: company._id }).select("_id")).map(e => e._id);
  await Attendance.deleteMany({ employee: { $in: existingEmpIds } });
  console.log("✔  Cleared");

  const now = new Date();

  // ── Settings ────────────────────────────────────────────────────────────────
  await Setting.create({
    company: company._id,
    companyName: company.name,
    otEnabled: true,
    otRate: 0,
    whatsappEnabled: true,
    whatsappNotifyCheckIn: true,
    whatsappNotifyLeave: true,
    whatsappNotifyPayroll: true,
    whatsappLang: "en",
    salaryMode: "monthly",
    salaryPayDay: "28",
    essAllowPunch: true,
    essAllowLeave: true,
    essAllowPayslip: true,
  });
  console.log("✔  Settings created");

  // ── Deduction Rule ──────────────────────────────────────────────────────────
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

  // ── Branch ──────────────────────────────────────────────────────────────────
  const branch = await Branch.create({
    company: company._id,
    name: "Main Branch",
    code: "MAIN",
    address: company.address || "Head Office",
    isActive: true,
  });

  // ── Shifts ──────────────────────────────────────────────────────────────────
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
  console.log("✔  Shifts created");

  // ── Departments & Designations ───────────────────────────────────────────────
  const deptEng  = await Department.create({ company: company._id, name: "Engineering",      code: "ENG", description: "Product & software development", budget: 5000000 });
  const deptHR   = await Department.create({ company: company._id, name: "Human Resources",  code: "HR",  description: "People operations",              budget: 1500000 });
  const deptFin  = await Department.create({ company: company._id, name: "Finance",          code: "FIN", description: "Accounts and finance",            budget: 2000000 });
  const deptMkt  = await Department.create({ company: company._id, name: "Marketing",        code: "MKT", description: "Growth and marketing",            budget: 1800000 });

  const desgSWE        = await Designation.create({ company: company._id, name: "Software Engineer",  department: deptEng._id });
  const desgSrDev      = await Designation.create({ company: company._id, name: "Senior Developer",   department: deptEng._id });
  const desgQA         = await Designation.create({ company: company._id, name: "QA Engineer",        department: deptEng._id });
  const desgHRMgr      = await Designation.create({ company: company._id, name: "HR Manager",         department: deptHR._id  });
  const desgHRExec     = await Designation.create({ company: company._id, name: "HR Executive",       department: deptHR._id  });
  const desgFinAnalyst = await Designation.create({ company: company._id, name: "Finance Analyst",    department: deptFin._id });
  const desgMktExec    = await Designation.create({ company: company._id, name: "Marketing Executive",department: deptMkt._id });
  console.log("✔  Departments + designations created");

  // ── Employees ───────────────────────────────────────────────────────────────
  // otEnabled: true  → Vikram, Deepika, Karan  (get overtime pay)
  // otEnabled: false → Ananya, Sonal, Arjun    (checkout capped at shift end)
  const empData = [
    { id: "EMP-001", firstName: "Priya",   lastName: "Sharma",  email: `priya.sharma@${company.email.split("@")[1]}`,  phone: "919100000001", dept: deptHR._id,  desg: desgHRMgr._id,      salary: 850000,  gender: "female", dob: "1990-05-20", join: "2022-01-15", shift: shiftMorning._id, shiftName: "Morning Shift", otEnabled: false, otRate: 0,   role: "hr_manager"  },
    { id: "EMP-002", firstName: "Rahul",   lastName: "Verma",   email: `rahul.verma@${company.email.split("@")[1]}`,   phone: "919100000002", dept: deptHR._id,  desg: desgHRExec._id,     salary: 550000,  gender: "male",   dob: "1995-03-10", join: "2022-06-01", shift: shiftMorning._id, shiftName: "Morning Shift", otEnabled: false, otRate: 0,   role: "hr_executive"},
    { id: "EMP-003", firstName: "Ananya",  lastName: "Reddy",   email: `ananya.reddy@${company.email.split("@")[1]}`,  phone: "919100000003", dept: deptEng._id, desg: desgSWE._id,        salary: 720000,  gender: "female", dob: "1997-08-14", join: "2023-02-01", shift: shiftMorning._id, shiftName: "Morning Shift", otEnabled: false, otRate: 0,   role: "employee"    },
    { id: "EMP-004", firstName: "Vikram",  lastName: "Singh",   email: `vikram.singh@${company.email.split("@")[1]}`,  phone: "919100000004", dept: deptEng._id, desg: desgSrDev._id,      salary: 1200000, gender: "male",   dob: "1993-11-22", join: "2021-07-15", shift: shiftMorning._id, shiftName: "Morning Shift", otEnabled: true,  otRate: 150, role: "employee"    },
    { id: "EMP-005", firstName: "Sonal",   lastName: "Mehta",   email: `sonal.mehta@${company.email.split("@")[1]}`,   phone: "919100000005", dept: deptFin._id, desg: desgFinAnalyst._id, salary: 680000,  gender: "female", dob: "1996-04-05", join: "2022-11-01", shift: shiftGeneral._id, shiftName: "General Shift", otEnabled: false, otRate: 0,   role: "employee"    },
    { id: "EMP-006", firstName: "Arjun",   lastName: "Kapoor",  email: `arjun.kapoor@${company.email.split("@")[1]}`,  phone: "919100000006", dept: deptMkt._id, desg: desgMktExec._id,    salary: 580000,  gender: "male",   dob: "1998-01-30", join: "2023-05-10", shift: shiftGeneral._id, shiftName: "General Shift", otEnabled: false, otRate: 0,   role: "employee"    },
    { id: "EMP-007", firstName: "Deepika", lastName: "Nair",    email: `deepika.nair@${company.email.split("@")[1]}`,  phone: "919100000007", dept: deptEng._id, desg: desgQA._id,         salary: 650000,  gender: "female", dob: "1996-09-18", join: "2022-09-01", shift: shiftMorning._id, shiftName: "Morning Shift", otEnabled: true,  otRate: 120, role: "employee"    },
    { id: "EMP-008", firstName: "Karan",   lastName: "Bhatia",  email: `karan.bhatia@${company.email.split("@")[1]}`,  phone: "919100000008", dept: deptMkt._id, desg: desgMktExec._id,    salary: 520000,  gender: "male",   dob: "1999-06-25", join: "2023-08-20", shift: shiftGeneral._id, shiftName: "General Shift", otEnabled: true,  otRate: 100, role: "employee"    },
  ];

  const createdEmployees = [];
  for (const e of empData) {
    const user = await User.create({
      name: `${e.firstName} ${e.lastName}`,
      email: e.email,
      password: "Employee@123",
      role: e.role,
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
    });
    user.employeeId = emp.employeeId;
    await user.save();
    createdEmployees.push(emp);
  }

  await Subscription.findByIdAndUpdate(company.subscription?._id || company.subscription, {
    currentEmployeeCount: empData.length,
  });
  console.log("✔  Employees + users created (password: Employee@123)");

  // ── Attendance (30 days) ────────────────────────────────────────────────────
  for (let dayOffset = 1; dayOffset <= 30; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;

    for (const emp of createdEmployees) {
      const roll = Math.random();
      const status = roll < 0.7 ? "present" : roll < 0.8 ? "late" : roll < 0.9 ? "absent" : "half_day";

      if (status === "absent") {
        await Attendance.create({ employee: emp._id, date, status: "absent", workHours: 0 });
        continue;
      }

      const checkInHour = status === "late" ? randomBetween(10, 11) : 9;
      const checkIn = new Date(date);
      checkIn.setHours(checkInHour, randomBetween(0, 29), 0, 0);

      const staysLate = Math.random() < 0.3;
      const rawCheckOut = new Date(date);
      rawCheckOut.setHours(staysLate ? randomBetween(19, 20) : randomBetween(17, 18), randomBetween(0, 30), 0, 0);

      let effectiveCheckOut = rawCheckOut;
      let overtimeHours = 0;

      const isMorning = emp.shift?.equals(shiftMorning._id);
      const shiftEndH = isMorning ? 18 : 17;
      const shiftEndM = isMorning ? 0 : 30;
      const shiftEnd = new Date(date);
      shiftEnd.setHours(shiftEndH, shiftEndM, 0, 0);

      if (emp.otEnabled) {
        if (rawCheckOut > shiftEnd) {
          overtimeHours = parseFloat(((rawCheckOut - shiftEnd) / 3600000).toFixed(2));
        }
      } else {
        if (rawCheckOut > shiftEnd) effectiveCheckOut = shiftEnd;
      }

      const workHours = parseFloat(((effectiveCheckOut - checkIn) / 3600000).toFixed(2));
      await Attendance.create({
        employee: emp._id,
        date,
        status,
        checkIn,
        checkOut: effectiveCheckOut,
        workHours,
        overtime: overtimeHours,
        markedBy: adminUser._id,
        verifyMode: "fingerprint",
      });
    }
  }
  console.log("✔  Attendance created (30 days)");

  // ── OT Transactions ─────────────────────────────────────────────────────────
  for (const emp of createdEmployees.filter(e => e.otEnabled)) {
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
      createdBy: adminUser._id,
    });
  }
  console.log("✔  OT transactions created");

  // ── Leaves ──────────────────────────────────────────────────────────────────
  const leaveTypes = ["casual", "sick", "earned"];
  for (let i = 0; i < 14; i++) {
    const emp = createdEmployees[i % createdEmployees.length];
    const startOffset = randomBetween(2, 28);
    const start = new Date();
    start.setDate(start.getDate() - startOffset);
    start.setHours(0, 0, 0, 0);
    const days = randomBetween(1, 3);
    const end = new Date(start);
    end.setDate(end.getDate() + days - 1);
    const leaveStatus = pickRandom(["approved", "approved", "pending", "rejected"]);

    await Leave.create({
      company: company._id,
      employee: emp._id,
      leaveType: pickRandom(leaveTypes),
      startDate: start,
      endDate: end,
      days,
      reason: pickRandom(["Family emergency", "Medical appointment", "Personal work", "Sick leave", "Out of town"]),
      status: leaveStatus,
      approvedBy: leaveStatus === "approved" ? adminUser._id : undefined,
      approvedAt: leaveStatus === "approved" ? new Date() : undefined,
      rejectionReason: leaveStatus === "rejected" ? "Insufficient leave balance" : undefined,
    });
  }
  console.log("✔  Leave records created");

  // ── Payroll (3 months) ──────────────────────────────────────────────────────
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  for (let m = 0; m < 3; m++) {
    const payMonth = now.getMonth() - m < 0 ? 12 + now.getMonth() - m : now.getMonth() - m + 1;
    const payYear = now.getMonth() - m < 0 ? now.getFullYear() - 1 : now.getFullYear();

    for (const emp of createdEmployees) {
      const basic   = Math.round((emp.salary * 0.5) / 12);
      const hra     = Math.round((emp.salary * 0.2) / 12);
      const da      = Math.round((emp.salary * 0.1) / 12);
      const ta      = 2000;
      const medical = 1250;
      const gross   = basic + hra + da + ta + medical;
      const pf      = Math.round(basic * 0.12);
      const esi     = Math.round(gross * 0.0175);
      const tds     = Math.round(gross * 0.05);
      const otHours = emp.otEnabled ? randomBetween(5, 15) : 0;
      const otPay   = emp.otEnabled ? otHours * (emp.otRate || 0) : 0;
      const net     = gross + otPay - pf - esi - tds;

      await Payroll.create({
        company: company._id,
        employee: emp._id,
        month: payMonth,
        year: payYear,
        basicSalary: basic,
        hra, da, ta,
        medicalAllowance: medical,
        grossSalary: gross,
        overtimeHours: otHours,
        otPay,
        pf, esi, tds,
        totalDeductions: pf + esi + tds,
        netSalary: net,
        status: m > 0 ? "paid" : "processed",
        paidAt: m > 0 ? new Date() : undefined,
        processedBy: adminUser._id,
      });
    }
  }
  console.log("✔  Payroll created (3 months)");

  // ── Holidays ────────────────────────────────────────────────────────────────
  const y = now.getFullYear();
  await Holiday.insertMany([
    { company: company._id, name: "Republic Day",     date: new Date(`${y}-01-26`), type: "national" },
    { company: company._id, name: "Holi",             date: new Date(`${y}-03-14`), type: "national" },
    { company: company._id, name: "Independence Day", date: new Date(`${y}-08-15`), type: "national" },
    { company: company._id, name: "Gandhi Jayanti",   date: new Date(`${y}-10-02`), type: "national" },
    { company: company._id, name: "Diwali",           date: new Date(`${y}-11-10`), type: "national" },
    { company: company._id, name: "Christmas Day",    date: new Date(`${y}-12-25`), type: "national" },
  ]);
  console.log("✔  Holidays created");

  // ── Done ────────────────────────────────────────────────────────────────────
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  ✅  TENANT SEED COMPLETE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`\n  Company : ${company.name}`);
  console.log(`  ID      : ${company._id}\n`);
  console.log("  All employee passwords : Employee@123\n");
  console.log("  OT ENABLED  → Vikram Singh (EMP-004) ₹150/hr");
  console.log("                Deepika Nair (EMP-007) ₹120/hr");
  console.log("                Karan Bhatia (EMP-008) ₹100/hr\n");
  console.log("  OT DISABLED → Ananya, Sonal, Arjun, Priya, Rahul");
  console.log("                (checkout capped at shift end)\n");

  await mongoose.disconnect();
}

// ─── entry point ──────────────────────────────────────────────────────────────

const companyId = process.argv[2];
if (!companyId) {
  console.error("❌  Usage: node seed-tenant.js <COMPANY_ID>");
  console.error("    Get your company ID after registering on NestHR.");
  process.exit(1);
}

seedTenant(companyId).catch((err) => {
  console.error(err);
  process.exit(1);
});

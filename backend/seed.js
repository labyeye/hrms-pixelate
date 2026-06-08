require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Company = require("./models/Company");
const Subscription = require("./models/Subscription");
const Plan = require("./models/Plan");
const Invoice = require("./models/Invoice");
const User = require("./models/User");
const Department = require("./models/Department");
const Employee = require("./models/Employee");
const Attendance = require("./models/Attendance");
const Leave = require("./models/Leave");
const Payroll = require("./models/Payroll");
const Recruitment = require("./models/Recruitment");
const Performance = require("./models/Performance");
const BiometricLocation = require("./models/BiometricLocation");
const BiometricDevice = require("./models/BiometricDevice");
const BiometricLog = require("./models/BiometricLog");
const Holiday = require("./models/Holiday");

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB");

  console.log("Clearing all collections...");
  await Promise.all([
    Company.deleteMany({}),
    Subscription.deleteMany({}),
    Plan.deleteMany({}),
    Invoice.deleteMany({}),
    User.deleteMany({}),
    Department.deleteMany({}),
    Employee.deleteMany({}),
    Attendance.deleteMany({}),
    Leave.deleteMany({}),
    Payroll.deleteMany({}),
    Recruitment.deleteMany({}),
    Performance.deleteMany({}),
    BiometricLocation.deleteMany({}),
    BiometricDevice.deleteMany({}),
    BiometricLog.deleteMany({}),
    Holiday.deleteMany({}),
  ]);
  console.log("All collections cleared.");

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
        "Attendance & leave management",
        "Basic payroll processing",
        "Department management",
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
        "Full payroll with tax calculations",
        "Performance reviews",
        "Recruitment management",
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
      description: "Unlimited scale, all features",
      features: [
        "Unlimited employees",
        "All Professional features",
        "Custom workflows",
        "Dedicated account manager",
        "SLA guarantee",
        "Custom reporting & API access",
        "On-premise deployment option",
      ],
      active: true,
    },
  ]);

  const superAdminUser = await User.create({
    name: "Alex Johnson",
    email: "admin@technest.com",
    password: "Admin@123",
    role: "super_admin",
    phone: "+91-9876543210",
    status: "active",
  });

  const hashedCompanyPass = await bcrypt.hash("Company@123", 10);
  const company = await Company.create({
    name: "TechNest Solutions",
    email: "info@technest.com",
    phone: "+91-9876543200",
    password: hashedCompanyPass,
    industry: "Information Technology",
    website: "https://technest.com",
    address: "101 Cyber Tower, Hitech City",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500081",
    country: "India",
    status: "active",
    createdBy: superAdminUser._id,
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
    notes: "Seeded test subscription",
  });

  company.subscription = subscription._id;
  await company.save();

  for (let m = 2; m >= 0; m--) {
    const iDate = new Date(now.getFullYear(), now.getMonth() - m, 1);
    await Invoice.create({
      company: company._id,
      subscription: subscription._id,
      invoiceNumber: `INV-${String(now.getFullYear()).slice(-2)}${String(now.getMonth() - m + 1).padStart(2, "0")}${String(m + 1).padStart(3, "0")}`,
      plan: "Professional",
      billingCycle: "monthly",
      amount: 3499,
      status: "paid",
      paidAt: iDate,
      razorpayOrderId: `order_seed_${m}`,
      razorpayPaymentId: `pay_seed_${m}`,
    });
  }

  superAdminUser.company = company._id;
  await superAdminUser.save();

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

  const hrManagerUser = await User.create({
    name: "Priya Sharma",
    email: "priya.sharma@technest.com",
    password: "Hr@Manager1",
    role: "hr_manager",
    phone: "+91-9123456781",
    company: company._id,
    department: deptHR._id,
    status: "active",
  });
  const hrManagerEmp = await Employee.create({
    user: hrManagerUser._id,
    company: company._id,
    employeeId: "TNS-001",
    firstName: "Priya",
    lastName: "Sharma",
    email: "priya.sharma@technest.com",
    phone: "+91-9123456781",
    department: deptHR._id,
    designation: "HR Manager",
    employmentType: "full_time",
    joinDate: new Date("2022-01-15"),
    status: "active",
    salary: 850000,
    gender: "female",
    dateOfBirth: new Date("1990-05-20"),
    address: "Flat 12, Kondapur, Hyderabad",
  });
  hrManagerUser.employeeId = hrManagerEmp.employeeId;
  await hrManagerUser.save();

  const hrExecUser = await User.create({
    name: "Rahul Verma",
    email: "rahul.verma@technest.com",
    password: "Hr@Exec123",
    role: "hr_executive",
    phone: "+91-9123456782",
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
    phone: "+91-9123456782",
    department: deptHR._id,
    designation: "HR Executive",
    employmentType: "full_time",
    joinDate: new Date("2022-06-01"),
    status: "active",
    salary: 550000,
    gender: "male",
    dateOfBirth: new Date("1995-03-10"),
    address: "Plot 45, Madhapur, Hyderabad",
  });
  hrExecUser.employeeId = hrExecEmp.employeeId;
  await hrExecUser.save();

  const empData = [
    {
      name: "Ananya Reddy",
      email: "ananya.reddy@technest.com",
      phone: "+91-9000000001",
      dept: deptEngineering._id,
      designation: "Software Engineer",
      salary: 720000,
      gender: "female",
      dob: "1997-08-14",
      join: "2023-02-01",
      id: "TNS-003",
    },
    {
      name: "Vikram Singh",
      email: "vikram.singh@technest.com",
      phone: "+91-9000000002",
      dept: deptEngineering._id,
      designation: "Senior Developer",
      salary: 1200000,
      gender: "male",
      dob: "1993-11-22",
      join: "2021-07-15",
      id: "TNS-004",
    },
    {
      name: "Sonal Mehta",
      email: "sonal.mehta@technest.com",
      phone: "+91-9000000003",
      dept: deptFinance._id,
      designation: "Finance Analyst",
      salary: 680000,
      gender: "female",
      dob: "1996-04-05",
      join: "2022-11-01",
      id: "TNS-005",
    },
    {
      name: "Arjun Kapoor",
      email: "arjun.kapoor@technest.com",
      phone: "+91-9000000004",
      dept: deptMarketing._id,
      designation: "Marketing Executive",
      salary: 580000,
      gender: "male",
      dob: "1998-01-30",
      join: "2023-05-10",
      id: "TNS-006",
    },
    {
      name: "Deepika Nair",
      email: "deepika.nair@technest.com",
      phone: "+91-9000000005",
      dept: deptEngineering._id,
      designation: "QA Engineer",
      salary: 650000,
      gender: "female",
      dob: "1996-09-18",
      join: "2022-09-01",
      id: "TNS-007",
    },
    {
      name: "Karan Bhatia",
      email: "karan.bhatia@technest.com",
      phone: "+91-9000000006",
      dept: deptMarketing._id,
      designation: "Content Strategist",
      salary: 520000,
      gender: "male",
      dob: "1999-06-25",
      join: "2023-08-20",
      id: "TNS-008",
    },
  ];

  const createdEmployees = [];
  for (const e of empData) {
    const [firstName, lastName] = e.name.split(" ");
    const user = await User.create({
      name: e.name,
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
      firstName,
      lastName,
      email: e.email,
      phone: e.phone,
      department: e.dept,
      designation: e.designation,
      employmentType: "full_time",
      joinDate: new Date(e.join),
      status: "active",
      salary: e.salary,
      gender: e.gender,
      dateOfBirth: new Date(e.dob),
    });
    user.employeeId = emp.employeeId;
    await user.save();
    createdEmployees.push(emp);
  }

  const totalEmployees = 2 + empData.length;
  subscription.currentEmployeeCount = totalEmployees;
  await subscription.save();

  await Department.findByIdAndUpdate(deptHR._id, {
    headcount: 2,
    head: hrManagerUser._id,
  });
  await Department.findByIdAndUpdate(deptEngineering._id, { headcount: 3 });
  await Department.findByIdAndUpdate(deptFinance._id, { headcount: 1 });
  await Department.findByIdAndUpdate(deptMarketing._id, { headcount: 2 });

  const allEmployees = [hrManagerEmp, hrExecEmp, ...createdEmployees];
  const statuses = [
    "present",
    "present",
    "present",
    "present",
    "late",
    "absent",
  ];

  for (let dayOffset = 1; dayOffset <= 30; dayOffset++) {
    const date = new Date();
    date.setDate(date.getDate() - dayOffset);
    date.setHours(0, 0, 0, 0);
    const dow = date.getDay();
    if (dow === 0 || dow === 6) continue;

    for (const emp of allEmployees) {
      const status = statuses[Math.floor(Math.random() * statuses.length)];
      const checkInHour =
        status === "late" ? 10 + Math.floor(Math.random() * 2) : 9;
      const checkInMin = Math.floor(Math.random() * 30);
      const checkIn = new Date(date);
      checkIn.setHours(checkInHour, checkInMin, 0, 0);
      const checkOut = new Date(date);
      checkOut.setHours(18, Math.floor(Math.random() * 30), 0, 0);
      const workHours =
        status === "absent"
          ? 0
          : parseFloat(((checkOut - checkIn) / 3600000).toFixed(2));

      await Attendance.create({
        employee: emp._id,
        date,
        status: status === "absent" ? "absent" : status,
        checkIn: status !== "absent" ? checkIn : undefined,
        checkOut: status !== "absent" ? checkOut : undefined,
        workHours: status !== "absent" ? workHours : 0,
        markedBy: hrManagerUser._id,
      });
    }
  }

  const leaveTypes = ["casual", "sick", "earned"];
  const leaveStatuses = ["approved", "approved", "pending", "rejected"];

  for (let i = 0; i < 12; i++) {
    const emp = allEmployees[i % allEmployees.length];
    const startOffset = Math.floor(Math.random() * 25) + 1;
    const start = new Date();
    start.setDate(start.getDate() - startOffset);
    start.setHours(0, 0, 0, 0);
    const days = Math.floor(Math.random() * 3) + 1;
    const end = new Date(start);
    end.setDate(end.getDate() + days - 1);
    const status =
      leaveStatuses[Math.floor(Math.random() * leaveStatuses.length)];

    await Leave.create({
      company: company._id,
      employee: emp._id,
      leaveType: leaveTypes[Math.floor(Math.random() * leaveTypes.length)],
      startDate: start,
      endDate: end,
      days,
      reason: [
        "Family emergency",
        "Medical appointment",
        "Personal work",
        "Sick leave",
        "Vacation",
      ][Math.floor(Math.random() * 5)],
      status,
      approvedBy: status === "approved" ? hrManagerUser._id : undefined,
      approvedAt: status === "approved" ? new Date() : undefined,
      rejectionReason:
        status === "rejected" ? "Insufficient leave balance" : undefined,
    });
  }

  const today = new Date();
  for (let m = 0; m < 3; m++) {
    const payMonth =
      today.getMonth() - m < 0
        ? 12 + today.getMonth() - m
        : today.getMonth() - m + 1;
    const payYear =
      today.getMonth() - m < 0 ? today.getFullYear() - 1 : today.getFullYear();

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
      const totalDed = pf + esi + tds;
      const net = gross - totalDed;

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
        pf,
        esi,
        tds,
        totalDeductions: totalDed,
        netSalary: net,
        status: m > 0 ? "paid" : "processed",
        paymentDate: m > 0 ? new Date() : undefined,
        processedBy: hrManagerUser._id,
      });
    }
  }

  const y = 2026;
  const nationalHolidays = [
    { name: "New Year's Day", date: `${y}-01-01`, type: "national" },
    { name: "Republic Day", date: `${y}-01-26`, type: "national" },
    { name: "Holi", date: `${y}-03-14`, type: "national" },
    { name: "Good Friday", date: `${y}-04-03`, type: "national" },
    { name: "Eid ul-Fitr", date: `${y}-03-31`, type: "national" },
    { name: "Independence Day", date: `${y}-08-15`, type: "national" },
    { name: "Gandhi Jayanti", date: `${y}-10-02`, type: "national" },
    { name: "Dussehra", date: `${y}-10-22`, type: "national" },
    { name: "Diwali", date: `${y}-11-10`, type: "national" },
    { name: "Christmas Day", date: `${y}-12-25`, type: "national" },
    {
      name: "Summer Outing",
      date: `${y}-06-05`,
      type: "optional",
      description: "Company summer outing day",
    },
    {
      name: "Team Building Day",
      date: `${y}-09-18`,
      type: "optional",
      description: "Annual team building event",
    },
    {
      name: "Founders Day",
      date: `${y}-07-15`,
      type: "restricted",
      description: "Restricted holiday for founding team members",
    },
  ];
  for (const h of nationalHolidays) {
    await Holiday.create({ company: company._id, ...h });
  }

  console.log("\n✅  Seed complete!\n");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  COMPANY:      TechNest Solutions");
  console.log("  SUBSCRIPTION: Professional (Active, Paid)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  LOGIN CREDENTIALS:\n");
  console.log("  Super Admin");
  console.log("    Email:    admin@technest.com");
  console.log("    Password: Admin@123\n");
  console.log("  HR Manager");
  console.log("    Email:    priya.sharma@technest.com");
  console.log("    Password: Hr@Manager1\n");
  console.log("  HR Executive");
  console.log("    Email:    rahul.verma@technest.com");
  console.log("    Password: Hr@Exec123\n");
  console.log("  Employees (all share password: Employee@123)");
  for (const e of empData) {
    console.log(`    ${e.email}`);
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});

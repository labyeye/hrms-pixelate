require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const Company = require("../models/Company");
const User = require("../models/User");
const Plan = require("../models/Plan");
const Subscription = require("../models/Subscription");
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const Payroll = require("../models/Payroll");
const Performance = require("../models/Performance");
const Recruitment = require("../models/Recruitment");

const connectDB = require("../config/db");

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function dateOnly(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function seed() {
  await connectDB();

  console.log("🗑  Dropping all collections...");
  const models = [
    Recruitment,
    Performance,
    Payroll,
    Leave,
    Attendance,
    Employee,
    Department,
    Subscription,
    Plan,
    User,
    Company,
  ];
  for (const Model of models) {
    await Model.deleteMany({});
  }
  console.log("✅ All collections cleared.\n");

  console.log("📦 Creating plans...");
  const [starterPlan, professionalPlan, enterprisePlan] = await Plan.insertMany(
    [
      {
        name: "Starter",
        planType: "starter",
        monthlyPrice: 50,
        yearlyPrice: 500,
        maxEmployees: 10,
        description:
          "For small teams up to 10 employees. ₹50 per employee/month (₹500/month total).",
        features: [
          "Employee Management",
          "Attendance Tracking",
          "Leave Management",
          "Basic Payroll",
        ],
      },
      {
        name: "Professional",
        planType: "professional",
        monthlyPrice: 100,
        yearlyPrice: 1000,
        maxEmployees: 20,
        description:
          "For growing teams up to 20 employees. ₹100 per employee/month (₹2000/month total).",
        features: [
          "Everything in Starter",
          "Performance Reviews",
          "Recruitment Management",
          "Advanced Reports",
          "Priority Support",
        ],
      },
      {
        name: "Enterprise",
        planType: "enterprise",
        monthlyPrice: 200,
        yearlyPrice: 2000,
        maxEmployees: 9999,
        description:
          "For large organisations. ₹200 per employee/month (unlimited employees).",
        features: [
          "Everything in Professional",
          "Biometric Integration",
          "Custom Roles",
          "API Access",
          "Dedicated Account Manager",
          "SLA Support",
        ],
      },
    ],
  );
  console.log(
    `✅ Plans created: Starter (₹50/emp), Professional (₹100/emp), Enterprise (₹200/emp)\n`,
  );

  console.log("🏢 Creating test company...");
  const companyRaw = new Company({
    name: "Pixelate Technologies Pvt Ltd",
    email: "admin@pixelate.tech",
    phone: "9876543210",
    password: "Company@123",
    industry: "Information Technology",
    website: "https://pixelate.tech",
    address: "101, Tech Park, Whitefield",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560066",
    country: "India",
    status: "active",
  });
  const company = await companyRaw.save();
  console.log(`✅ Company: ${company.name} (${company._id})\n`);

  console.log("👤 Creating super_admin...");
  const superAdmin = await User.create({
    name: "Rajan Mehta",
    email: "superadmin@pixelate.tech",
    password: "Admin@1234",
    role: "super_admin",
    phone: "9000000001",
    company: company._id,
    status: "active",
    employeeId: "EMP-001",
  });
  console.log(`✅ super_admin: ${superAdmin.email} / password: Admin@1234\n`);

  console.log("💳 Creating subscription...");
  const today = new Date();
  const renewal = new Date(today);
  renewal.setMonth(renewal.getMonth() + 1);

  const employeeCount = 10;
  const amountPaid = enterprisePlan.monthlyPrice * employeeCount;

  const subscription = await Subscription.create({
    company: company._id,
    plan: "enterprise",
    monthlyPrice: enterprisePlan.monthlyPrice,
    yearlyPrice: enterprisePlan.yearlyPrice,
    maxEmployees: enterprisePlan.maxEmployees,
    billingCycle: "monthly",
    currentEmployeeCount: employeeCount,
    startDate: today,
    renewalDate: renewal,
    status: "active",
    autoRenew: true,
    paymentStatus: "completed",
    paymentMethod: "razorpay",
    amountPaid: amountPaid,
    notes: `Enterprise plan @ ₹${enterprisePlan.monthlyPrice}/employee × ${employeeCount} employees = ₹${amountPaid}/month`,
  });

  company.subscription = subscription._id;
  company.createdBy = superAdmin._id;
  await company.save();
  console.log(
    `✅ Subscription: Enterprise plan, ₹${enterprisePlan.monthlyPrice}/emp × ${employeeCount} emp = ₹${amountPaid}/month\n`,
  );

  console.log("🏗  Creating departments...");
  const [deptEng, deptHR, deptSales, deptFinance] = await Department.insertMany(
    [
      {
        name: "Engineering",
        code: "ENG",
        description: "Software development team",
        headcount: 4,
        budget: 500000,
      },
      {
        name: "Human Resources",
        code: "HR",
        description: "HR & people operations",
        headcount: 2,
        budget: 200000,
      },
      {
        name: "Sales",
        code: "SLS",
        description: "Sales and business dev",
        headcount: 2,
        budget: 300000,
      },
      {
        name: "Finance",
        code: "FIN",
        description: "Finance and accounts",
        headcount: 2,
        budget: 250000,
      },
    ],
  );
  console.log(`✅ Departments: Engineering, Human Resources, Sales, Finance\n`);

  console.log("👤 Creating hr_manager...");
  const hrManager = await User.create({
    name: "Priya Sharma",
    email: "hrmanager@pixelate.tech",
    password: "HrManager@1234",
    role: "hr_manager",
    phone: "9000000002",
    company: company._id,
    department: deptHR._id,
    status: "active",
    employeeId: "EMP-002",
  });

  console.log("👤 Creating hr_executive...");
  const hrExec = await User.create({
    name: "Ankit Verma",
    email: "hrexecutive@pixelate.tech",
    password: "HrExec@1234",
    role: "hr_executive",
    phone: "9000000003",
    company: company._id,
    department: deptHR._id,
    status: "active",
    employeeId: "EMP-003",
  });
  console.log(`✅ hr_manager: hrmanager@pixelate.tech / HrManager@1234`);
  console.log(`✅ hr_executive: hrexecutive@pixelate.tech / HrExec@1234\n`);

  console.log("👥 Creating employee users...");
  const employeeData = [
    {
      name: "Siddharth Nair",
      email: "sid.nair@pixelate.tech",
      dept: deptEng._id,
      designation: "Senior Software Engineer",
      salary: 80000,
    },
    {
      name: "Kavita Reddy",
      email: "kavita.r@pixelate.tech",
      dept: deptEng._id,
      designation: "Backend Developer",
      salary: 65000,
    },
    {
      name: "Rahul Joshi",
      email: "rahul.j@pixelate.tech",
      dept: deptEng._id,
      designation: "Frontend Developer",
      salary: 60000,
    },
    {
      name: "Meera Pillai",
      email: "meera.p@pixelate.tech",
      dept: deptEng._id,
      designation: "QA Engineer",
      salary: 55000,
    },
    {
      name: "Arjun Kapoor",
      email: "arjun.k@pixelate.tech",
      dept: deptSales._id,
      designation: "Sales Executive",
      salary: 50000,
    },
    {
      name: "Sneha Gupta",
      email: "sneha.g@pixelate.tech",
      dept: deptSales._id,
      designation: "Business Development Mgr",
      salary: 70000,
    },
    {
      name: "Rohit Das",
      email: "rohit.d@pixelate.tech",
      dept: deptFinance._id,
      designation: "Accountant",
      salary: 52000,
    },
  ];

  const createdUsers = [];
  for (let i = 0; i < employeeData.length; i++) {
    const ed = employeeData[i];
    const u = await User.create({
      name: ed.name,
      email: ed.email,
      password: "Employee@1234",
      role: "employee",
      phone: `900000${String(i + 4).padStart(4, "0")}`,
      company: company._id,
      department: ed.dept,
      status: "active",
      employeeId: `EMP-00${i + 4}`,
    });
    createdUsers.push({ user: u, ...ed });
  }
  console.log(`✅ 7 employee users created (password: Employee@1234)\n`);

  console.log("📋 Creating Employee records...");
  const joinBase = new Date("2024-01-01");

  const hrManagerEmp = await Employee.create({
    user: hrManager._id,
    employeeId: "EMP-002",
    firstName: "Priya",
    lastName: "Sharma",
    email: hrManager.email,
    phone: "9000000002",
    department: deptHR._id,
    designation: "HR Manager",
    salary: 75000,
    joinDate: joinBase,
    gender: "female",
    status: "active",
    address: "12, MG Road, Bengaluru",
    emergencyContact: "9100000001",
    bankAccount: "SB00000001",
    ifscCode: "SBIN0001234",
  });

  const hrExecEmp = await Employee.create({
    user: hrExec._id,
    employeeId: "EMP-003",
    firstName: "Ankit",
    lastName: "Verma",
    email: hrExec.email,
    phone: "9000000003",
    department: deptHR._id,
    designation: "HR Executive",
    salary: 45000,
    joinDate: joinBase,
    gender: "male",
    status: "active",
    reportingTo: hrManagerEmp._id,
    address: "34, Koramangala, Bengaluru",
    emergencyContact: "9100000002",
    bankAccount: "SB00000002",
    ifscCode: "SBIN0001235",
  });

  const empRecords = [];
  const firstNames = [
    "Siddharth",
    "Kavita",
    "Rahul",
    "Meera",
    "Arjun",
    "Sneha",
    "Rohit",
  ];
  const lastNames = [
    "Nair",
    "Reddy",
    "Joshi",
    "Pillai",
    "Kapoor",
    "Gupta",
    "Das",
  ];
  const genders = [
    "male",
    "female",
    "male",
    "female",
    "male",
    "female",
    "male",
  ];

  for (let i = 0; i < createdUsers.length; i++) {
    const eu = createdUsers[i];
    const rec = await Employee.create({
      user: eu.user._id,
      employeeId: `EMP-00${i + 4}`,
      firstName: firstNames[i],
      lastName: lastNames[i],
      email: eu.email,
      phone: eu.user.phone,
      department: eu.dept,
      designation: eu.designation,
      salary: eu.salary,
      joinDate: addDays(joinBase, i * 7),
      gender: genders[i],
      status: "active",
      reportingTo: hrManagerEmp._id,
      address: `${i + 1}, Indiranagar, Bengaluru`,
      emergencyContact: `91000000${i + 3}`,
      bankAccount: `SB0000000${i + 3}`,
      ifscCode: `SBIN000123${i + 5}`,
    });
    empRecords.push(rec);
  }

  deptHR.head = hrManager._id;
  deptHR.headcount = 2;
  await deptHR.save();

  deptEng.headcount = 4;
  await deptEng.save();
  deptSales.headcount = 2;
  await deptSales.save();
  deptFinance.headcount = 1;
  await deptFinance.save();

  const allEmpRecords = [hrManagerEmp, hrExecEmp, ...empRecords];
  console.log(`✅ ${allEmpRecords.length} Employee records created\n`);

  console.log("📅 Seeding attendance (60 days)...");
  const attendanceStatuses = [
    "present",
    "present",
    "present",
    "present",
    "late",
    "half_day",
    "absent",
  ];
  const attendanceDocs = [];

  for (const emp of allEmpRecords) {
    for (let d = 59; d >= 0; d--) {
      const date = dateOnly(addDays(new Date(), -d));
      const dow = date.getDay();
      let status;
      if (dow === 0 || dow === 6) {
        status = "weekend";
      } else {
        status =
          attendanceStatuses[
            Math.floor(Math.random() * attendanceStatuses.length)
          ];
      }

      let checkIn,
        checkOut,
        workHours = 0;
      if (status === "present") {
        checkIn = new Date(date);
        checkIn.setHours(9, Math.floor(Math.random() * 15), 0);
        checkOut = new Date(date);
        checkOut.setHours(18, Math.floor(Math.random() * 30), 0);
        workHours = 8 + Math.random();
      } else if (status === "late") {
        checkIn = new Date(date);
        checkIn.setHours(10, 15 + Math.floor(Math.random() * 30), 0);
        checkOut = new Date(date);
        checkOut.setHours(18, 30, 0);
        workHours = 7 + Math.random();
      } else if (status === "half_day") {
        checkIn = new Date(date);
        checkIn.setHours(9, 0, 0);
        checkOut = new Date(date);
        checkOut.setHours(13, 30, 0);
        workHours = 4;
      }

      attendanceDocs.push({
        employee: emp._id,
        date,
        checkIn: checkIn || undefined,
        checkOut: checkOut || undefined,
        status,
        workHours: parseFloat(workHours.toFixed(2)),
        markedBy: hrManager._id,
      });
    }
  }
  await Attendance.insertMany(attendanceDocs);
  console.log(`✅ ${attendanceDocs.length} attendance records seeded\n`);

  console.log("🏖  Seeding leave requests...");
  const leaveTypes = ["casual", "sick", "earned"];
  const leaveStatuses = ["approved", "approved", "pending", "rejected"];
  const leaveDocs = [];

  for (let i = 0; i < allEmpRecords.length; i++) {
    const emp = allEmpRecords[i];
    const start = dateOnly(addDays(new Date(), -(30 - i * 3)));
    const end = dateOnly(addDays(start, 1));
    const status = leaveStatuses[i % leaveStatuses.length];

    leaveDocs.push({
      employee: emp._id,
      leaveType: leaveTypes[i % leaveTypes.length],
      startDate: start,
      endDate: end,
      days: 2,
      reason: "Personal work",
      status,
      approvedBy: status === "approved" ? hrManager._id : undefined,
      approvedAt: status === "approved" ? new Date() : undefined,
    });
  }
  await Leave.insertMany(leaveDocs);
  console.log(`✅ ${leaveDocs.length} leave records seeded\n`);

  console.log("💰 Seeding payroll (3 months)...");
  const payrollDocs = [];
  const nowDate = new Date();

  for (const emp of allEmpRecords) {
    for (let m = 2; m >= 0; m--) {
      const d = new Date(nowDate.getFullYear(), nowDate.getMonth() - m, 1);
      const month = d.getMonth() + 1;
      const year = d.getFullYear();

      let basicSalary = 45000;
      const matchedUser = createdUsers.find(
        (cu) => cu.user._id.toString() === emp.user.toString(),
      );
      if (matchedUser) basicSalary = matchedUser.salary;
      else if (emp._id.equals(hrManagerEmp._id)) basicSalary = 75000;
      else if (emp._id.equals(hrExecEmp._id)) basicSalary = 45000;

      const hra = Math.round(basicSalary * 0.4);
      const da = Math.round(basicSalary * 0.1);
      const ta = 2000;
      const medical = 1500;
      const grossSalary = basicSalary + hra + da + ta + medical;
      const pf = Math.round(basicSalary * 0.12);
      const esi = basicSalary <= 21000 ? Math.round(grossSalary * 0.0075) : 0;
      const tds = Math.round(grossSalary * 0.05);
      const totalDeductions = pf + esi + tds;
      const netSalary = grossSalary - totalDeductions;

      payrollDocs.push({
        employee: emp._id,
        month,
        year,
        basicSalary,
        hra,
        da,
        ta,
        medicalAllowance: medical,
        grossSalary,
        pf,
        esi,
        tds,
        totalDeductions,
        netSalary,
        workingDays: 26,
        presentDays: 24,
        leaveDays: 2,
        status: m > 0 ? "paid" : "processed",
        paidAt: m > 0 ? d : undefined,
        processedBy: hrManager._id,
      });
    }
  }
  await Payroll.insertMany(payrollDocs);
  console.log(`✅ ${payrollDocs.length} payroll records seeded\n`);

  console.log("⭐ Seeding performance reviews...");
  const perfDocs = [];
  for (let i = 0; i < Math.min(5, allEmpRecords.length); i++) {
    const emp = allEmpRecords[i];
    const rating = 3 + (i % 3);
    perfDocs.push({
      employee: emp._id,
      reviewPeriod: "Q1 2025",
      year: 2025,
      quarter: 1,
      reviewType: "quarterly",
      goals: [
        {
          title: "Deliver sprint targets",
          description: "Complete assigned tasks on time",
          target: "100%",
          achieved: `${80 + i * 4}%`,
          rating: Math.min(5, rating),
        },
        {
          title: "Code quality",
          description: "Maintain code review approval rate",
          target: "90%",
          achieved: `${85 + i * 2}%`,
          rating: Math.min(5, rating),
        },
      ],
      overallRating: Math.min(5, rating),
      strengths: "Good team player, meets deadlines",
      areasOfImprovement: "Can improve documentation",
      reviewerComments: "Solid performance this quarter",
      status: "completed",
      reviewedBy: hrManager._id,
      reviewedAt: new Date("2025-04-15"),
    });
  }
  await Performance.insertMany(perfDocs);
  console.log(`✅ ${perfDocs.length} performance reviews seeded\n`);

  console.log("📢 Seeding recruitment postings...");
  await Recruitment.insertMany([
    {
      title: "Full Stack Developer",
      department: deptEng._id,
      positions: 2,
      type: "full_time",
      status: "open",
      priority: "high",
      description:
        "Looking for experienced full stack developer with React and Node.js skills.",
      requirements: "3+ years experience, React, Node.js, MongoDB",
      minSalary: 60000,
      maxSalary: 90000,
      location: "Bengaluru",
      postedBy: hrManager._id,
      closingDate: addDays(new Date(), 30),
      candidates: [
        {
          name: "Karan Mehta",
          email: "karan.m@gmail.com",
          phone: "9111111111",
          stage: "interview",
          notes: "Strong React skills",
        },
        {
          name: "Divya Rao",
          email: "divya.r@gmail.com",
          phone: "9111111112",
          stage: "screening",
          notes: "Good portfolio",
        },
        {
          name: "Suresh Kumar",
          email: "suresh.k@gmail.com",
          phone: "9111111113",
          stage: "applied",
          notes: "Needs assessment",
        },
      ],
    },
    {
      title: "HR Executive",
      department: deptHR._id,
      positions: 1,
      type: "full_time",
      status: "open",
      priority: "medium",
      description:
        "HR executive to support recruitment and employee engagement.",
      requirements: "1-2 years HR experience, good communication",
      minSalary: 30000,
      maxSalary: 50000,
      location: "Bengaluru",
      postedBy: hrManager._id,
      closingDate: addDays(new Date(), 20),
      candidates: [
        {
          name: "Nisha Singh",
          email: "nisha.s@gmail.com",
          phone: "9222222221",
          stage: "hr_round",
          notes: "Final round pending",
        },
      ],
    },
    {
      title: "Sales Executive",
      department: deptSales._id,
      positions: 2,
      type: "full_time",
      status: "on_hold",
      priority: "low",
      description: "Sales executive to grow enterprise client base.",
      requirements: "2+ years B2B sales experience",
      minSalary: 40000,
      maxSalary: 60000,
      location: "Remote",
      postedBy: hrManager._id,
      closingDate: addDays(new Date(), 45),
      candidates: [],
    },
  ]);
  console.log(`✅ 3 recruitment postings seeded\n`);

  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("🎉 SEED COMPLETE");
  console.log(
    "═══════════════════════════════════════════════════════════════",
  );
  console.log("\n📌 LOGIN CREDENTIALS");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("Role            | Email                           | Password");
  console.log("─────────────────────────────────────────────────────────────");
  console.log("super_admin     | superadmin@pixelate.tech        | Admin@1234");
  console.log(
    "hr_manager      | hrmanager@pixelate.tech         | HrManager@1234",
  );
  console.log(
    "hr_executive    | hrexecutive@pixelate.tech       | HrExec@1234",
  );
  console.log(
    "employee (×7)   | e.g. sid.nair@pixelate.tech     | Employee@1234",
  );
  console.log("─────────────────────────────────────────────────────────────");
  console.log("\n💳 SUBSCRIPTION");
  console.log(`   Plan        : Enterprise`);
  console.log(`   Rate        : ₹200 per employee per month`);
  console.log(`   Employees   : ${employeeCount}`);
  console.log(`   Monthly Bill: ₹${amountPaid}`);
  console.log("\n📦 PLANS SEEDED");
  console.log(`   Starter      : ₹50/emp/month  → max 10 emp  → ₹500/month`);
  console.log(`   Professional : ₹100/emp/month → max 20 emp  → ₹2000/month`);
  console.log(`   Enterprise   : ₹200/emp/month → unlimited   → (₹200 × n)`);
  console.log(
    "═══════════════════════════════════════════════════════════════\n",
  );

  mongoose.disconnect();
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  mongoose.disconnect();
  process.exit(1);
});

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const User = require("../models/User");
const Company = require("../models/Company");
const Subscription = require("../models/Subscription");
const Plan = require("../models/Plan");
const Invoice = require("../models/Invoice");
const Department = require("../models/Department");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const Payroll = require("../models/Payroll");
const Recruitment = require("../models/Recruitment");
const Performance = require("../models/Performance");

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

function checkInTime(date, hour = 9, minVariance = 15) {
  const d = new Date(date);
  d.setHours(hour, Math.floor(Math.random() * minVariance), 0, 0);
  return d;
}

function checkOutTime(date, hour = 18, minVariance = 30) {
  const d = new Date(date);
  d.setHours(hour, Math.floor(Math.random() * minVariance), 0, 0);
  return d;
}

async function seedDemoData() {
  try {
    console.log("🔄 Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ Connected to MongoDB");

    const existingUser = await User.findOne({ email: "demo@nesthr.com" });
    if (existingUser) {
      const existingCompany = await Company.findOne({
        createdBy: existingUser._id,
      });
      if (existingCompany) {
        const empIds = (
          await Employee.find({ email: { $regex: "@techvision.com" } })
        ).map((e) => e._id);
        await Attendance.deleteMany({ employee: { $in: empIds } });
        await Leave.deleteMany({ employee: { $in: empIds } });
        await Payroll.deleteMany({ employee: { $in: empIds } });
        await Performance.deleteMany({ employee: { $in: empIds } });
        await Recruitment.deleteMany({});
        await Employee.deleteMany({
          email: { $regex: "@techvision.com|demo@nesthr.com" },
        });
        await Subscription.deleteMany({ company: existingCompany._id });
        await Department.deleteMany({});
        await Company.deleteOne({ _id: existingCompany._id });
      }
      await User.deleteOne({ _id: existingUser._id });
      console.log("🗑️  Cleared existing demo data");
    }

    await Plan.deleteMany({});
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
    console.log("✅ Plans seeded (3)");

    const adminUser = await User.create({
      name: "Rajesh Kumar",
      email: "demo@nesthr.com",
      password: "Demo@12345",
      role: "hr_manager",
      phone: "+91 98765 43210",
      status: "active",
    });
    console.log("✅ Admin user created:", adminUser.name);

    const company = await Company.create({
      name: "TechVision Solutions Pvt. Ltd.",
      email: "hr@techvision.com",
      phone: "+91 98765 43210",
      password: "CompanyDemo@123",
      industry: "Information Technology",
      website: "https://techvision.com",
      address: "123 Tech Park, Whitefield",
      city: "Bangalore",
      state: "Karnataka",
      pincode: "560066",
      country: "India",
      gstNumber: "27AABCT1234A1Z5",
      panNumber: "AAAAA0000A",
      status: "active",
      createdBy: adminUser._id,
    });
    console.log("✅ Company created:", company.name);

    const subscription = await Subscription.create({
      company: company._id,
      plan: "professional",
      monthlyPrice: 3499,
      yearlyPrice: 34990,
      maxEmployees: 50,
      billingCycle: "monthly",
      currentEmployeeCount: 0,
      startDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
      renewalDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: "active",
      autoRenew: true,
      paymentStatus: "completed",
      paymentMethod: "razorpay",
      amountPaid: 3499,
      notes: "Demo subscription for client showcase",
    });

    await Company.findByIdAndUpdate(company._id, {
      subscription: subscription._id,
    });
    await User.findByIdAndUpdate(adminUser._id, { company: company._id });

    const now2 = new Date();
    for (let m = 2; m >= 0; m--) {
      const invoiceDate = new Date(now2.getFullYear(), now2.getMonth() - m, 1);
      await Invoice.create({
        company: company._id,
        subscription: subscription._id,
        invoiceNumber: `INV-${String(now2.getFullYear()).slice(-2)}${String(now2.getMonth() - m + 1).padStart(2, "0")}${String(m + 1).padStart(3, "0")}`,
        plan: "Professional",
        billingCycle: "monthly",
        amount: 3499,
        status: "paid",
        paidAt: invoiceDate,
        razorpayOrderId: `order_demo_${m}`,
        razorpayPaymentId: `pay_demo_${m}`,
      });
    }
    console.log("✅ Invoices seeded (3)");

    const deptHR = await Department.create({
      company: company._id,
      name: "Human Resources",
      code: "HR",
      description: "Human Resources and Talent Management",
      headcount: 5,
      budget: 500000,
      status: "active",
    });
    const deptIT = await Department.create({
      company: company._id,
      name: "Information Technology",
      code: "IT",
      description: "Software Development and IT Infrastructure",
      headcount: 12,
      budget: 1500000,
      status: "active",
    });
    const deptSales = await Department.create({
      company: company._id,
      name: "Sales & Marketing",
      code: "SM",
      description: "Sales and Business Development",
      headcount: 8,
      budget: 800000,
      status: "active",
    });
    const deptOps = await Department.create({
      company: company._id,
      name: "Operations",
      code: "OPS",
      description: "Operations and Administration",
      headcount: 6,
      budget: 400000,
      status: "active",
    });
    console.log("✅ Departments created (4)");

    const employeesData = [
      {
        firstName: "Rajesh",
        lastName: "Kumar",
        email: "demo@nesthr.com",
        phone: "+91 98765 43210",
        designation: "HR Manager",
        employmentType: "full_time",
        joinDate: new Date("2020-04-01"),
        salary: 950000,
        gender: "male",
        dateOfBirth: new Date("1985-07-15"),
        department: deptHR._id,
        address: "42 MG Road, Bangalore, Karnataka - 560001",
        emergencyContact: "+91 98765 11111",
        panNumber: "ABCDE1234F",
        bankAccount: "1234567890123",
        ifscCode: "HDFC0001234",
        isAdminUser: true,
      },
      {
        firstName: "Priya",
        lastName: "Singh",
        email: "priya.singh@techvision.com",
        phone: "+91 98765 01234",
        designation: "Senior HR Executive",
        employmentType: "full_time",
        joinDate: new Date("2021-01-15"),
        salary: 800000,
        gender: "female",
        dateOfBirth: new Date("1990-05-10"),
        department: deptHR._id,
        address: "15 Koramangala, Bangalore - 560034",
        emergencyContact: "+91 98765 22222",
        panNumber: "BCDEF2345G",
        bankAccount: "2345678901234",
        ifscCode: "ICIC0002345",
      },
      {
        firstName: "Amit",
        lastName: "Patel",
        email: "amit.patel@techvision.com",
        phone: "+91 98765 02345",
        designation: "HR Executive",
        employmentType: "full_time",
        joinDate: new Date("2022-06-20"),
        salary: 450000,
        gender: "male",
        dateOfBirth: new Date("1995-08-22"),
        department: deptHR._id,
        address: "8 Indiranagar, Bangalore - 560038",
        emergencyContact: "+91 98765 33333",
        panNumber: "CDEFG3456H",
        bankAccount: "3456789012345",
        ifscCode: "SBIN0003456",
      },
      {
        firstName: "Vivek",
        lastName: "Sharma",
        email: "vivek.sharma@techvision.com",
        phone: "+91 98765 03456",
        designation: "Tech Lead",
        employmentType: "full_time",
        joinDate: new Date("2020-03-10"),
        salary: 1200000,
        gender: "male",
        dateOfBirth: new Date("1988-12-05"),
        department: deptIT._id,
        address: "22 HSR Layout, Bangalore - 560102",
        emergencyContact: "+91 98765 44444",
        panNumber: "DEFGH4567I",
        bankAccount: "4567890123456",
        ifscCode: "HDFC0004567",
      },
      {
        firstName: "Neha",
        lastName: "Verma",
        email: "neha.verma@techvision.com",
        phone: "+91 98765 04567",
        designation: "Senior Developer",
        employmentType: "full_time",
        joinDate: new Date("2021-09-15"),
        salary: 950000,
        gender: "female",
        dateOfBirth: new Date("1992-03-18"),
        department: deptIT._id,
        address: "11 BTM Layout, Bangalore - 560076",
        emergencyContact: "+91 98765 55555",
        panNumber: "EFGHI5678J",
        bankAccount: "5678901234567",
        ifscCode: "AXIS0005678",
      },
      {
        firstName: "Rajesh",
        lastName: "Gupta",
        email: "rajesh.gupta@techvision.com",
        phone: "+91 98765 05678",
        designation: "Developer",
        employmentType: "full_time",
        joinDate: new Date("2022-01-10"),
        salary: 650000,
        gender: "male",
        dateOfBirth: new Date("1998-07-20"),
        department: deptIT._id,
        address: "5 JP Nagar, Bangalore - 560078",
        emergencyContact: "+91 98765 66666",
        panNumber: "FGHIJ6789K",
        bankAccount: "6789012345678",
        ifscCode: "ICIC0006789",
      },
      {
        firstName: "Ananya",
        lastName: "Das",
        email: "ananya.das@techvision.com",
        phone: "+91 98765 06789",
        designation: "Sales Manager",
        employmentType: "full_time",
        joinDate: new Date("2020-11-01"),
        salary: 800000,
        gender: "female",
        dateOfBirth: new Date("1991-02-14"),
        department: deptSales._id,
        address: "33 Whitefield, Bangalore - 560066",
        emergencyContact: "+91 98765 77777",
        panNumber: "GHIJK7890L",
        bankAccount: "7890123456789",
        ifscCode: "SBIN0007890",
      },
      {
        firstName: "Rohit",
        lastName: "Kumar",
        email: "rohit.kumar@techvision.com",
        phone: "+91 98765 07890",
        designation: "Sales Executive",
        employmentType: "full_time",
        joinDate: new Date("2022-04-15"),
        salary: 500000,
        gender: "male",
        dateOfBirth: new Date("1996-09-11"),
        department: deptSales._id,
        address: "19 Electronic City, Bangalore - 560100",
        emergencyContact: "+91 98765 88888",
        panNumber: "HIJKL8901M",
        bankAccount: "8901234567890",
        ifscCode: "HDFC0008901",
      },
      {
        firstName: "Meera",
        lastName: "Nair",
        email: "meera.nair@techvision.com",
        phone: "+91 98765 08901",
        designation: "Operations Manager",
        employmentType: "full_time",
        joinDate: new Date("2021-05-20"),
        salary: 700000,
        gender: "female",
        dateOfBirth: new Date("1989-06-25"),
        department: deptOps._id,
        address: "7 Marathahalli, Bangalore - 560037",
        emergencyContact: "+91 98765 99999",
        panNumber: "IJKLM9012N",
        bankAccount: "9012345678901",
        ifscCode: "ICIC0009012",
      },
    ];

    const employees = [];
    for (const empData of employeesData) {
      const { isAdminUser, ...rest } = empData;
      const employeeId = `EMP${String(employees.length + 1001)}`;
      const userId = isAdminUser ? adminUser._id : adminUser._id;

      let empUserId = adminUser._id;
      if (!isAdminUser) {
        let empUser = await User.findOne({ email: empData.email });
        if (!empUser) {
          empUser = await User.create({
            name: `${empData.firstName} ${empData.lastName}`,
            email: empData.email,
            password: "hrms@123",
            role: "employee",
            company: company._id,
            department: empData.department,
          });
        }
        empUserId = empUser._id;
      }

      const employee = await Employee.create({
        user: empUserId,
        company: company._id,
        employeeId,
        ...rest,
        status: "active",
      });
      employees.push(employee);
    }
    console.log(`✅ Employees created (${employees.length})`);

    await Subscription.findByIdAndUpdate(subscription._id, {
      currentEmployeeCount: employees.length,
    });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendanceRecords = [];
    for (const emp of employees) {
      for (let d = 60; d >= 0; d--) {
        const date = daysAgo(d);
        const dow = date.getDay();
        if (dow === 0 || dow === 6) continue;

        const roll = Math.random();
        let status = "present";
        let checkIn = null;
        let checkOut = null;
        let workHours = 0;

        if (roll < 0.05) {
          status = "absent";
        } else if (roll < 0.1) {
          status = "late";
          checkIn = checkInTime(date, 10, 30);
          checkOut = checkOutTime(date, 18, 20);
          workHours = 7.5;
        } else {
          checkIn = checkInTime(date, 9, 15);
          checkOut = checkOutTime(date, 17, 45);
          workHours = 8 + Math.random() * 1.5;
        }

        attendanceRecords.push({
          employee: emp._id,
          date,
          status,
          checkIn,
          checkOut,
          workHours: parseFloat(workHours.toFixed(2)),
          overtime: workHours > 9 ? parseFloat((workHours - 9).toFixed(2)) : 0,
        });
      }
    }
    await Attendance.insertMany(attendanceRecords);
    console.log(`✅ Attendance records created (${attendanceRecords.length})`);

    const leaveData = [
      {
        empIdx: 0,
        type: "sick",
        start: daysAgo(45),
        days: 2,
        status: "approved",
        reason: "Fever and cold",
      },
      {
        empIdx: 0,
        type: "casual",
        start: daysAgo(20),
        days: 1,
        status: "approved",
        reason: "Personal errand",
      },
      {
        empIdx: 0,
        type: "earned",
        start: new Date(Date.now() + 10 * 86400000),
        days: 3,
        status: "pending",
        reason: "Family vacation",
      },
      {
        empIdx: 1,
        type: "sick",
        start: daysAgo(30),
        days: 3,
        status: "approved",
        reason: "Viral fever",
      },
      {
        empIdx: 2,
        type: "casual",
        start: daysAgo(15),
        days: 1,
        status: "approved",
        reason: "Home renovation",
      },
      {
        empIdx: 3,
        type: "earned",
        start: daysAgo(50),
        days: 5,
        status: "approved",
        reason: "Annual vacation",
      },
      {
        empIdx: 4,
        type: "sick",
        start: daysAgo(10),
        days: 2,
        status: "approved",
        reason: "Migraine",
      },
      {
        empIdx: 5,
        type: "casual",
        start: daysAgo(25),
        days: 1,
        status: "rejected",
        reason: "Festival",
      },
      {
        empIdx: 6,
        type: "earned",
        start: daysAgo(60),
        days: 4,
        status: "approved",
        reason: "Wedding anniversary trip",
      },
      {
        empIdx: 7,
        type: "sick",
        start: daysAgo(8),
        days: 1,
        status: "approved",
        reason: "Stomach ache",
      },
    ];
    for (const l of leaveData) {
      const startDate = new Date(l.start);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + l.days - 1);
      await Leave.create({
        employee: employees[l.empIdx]._id,
        leaveType: l.type,
        startDate,
        endDate,
        days: l.days,
        reason: l.reason,
        status: l.status,
        approvedBy: l.status !== "pending" ? adminUser._id : undefined,
        approvedAt:
          l.status === "approved"
            ? new Date(startDate.getTime() - 86400000)
            : undefined,
      });
    }
    console.log(`✅ Leave records created (${leaveData.length})`);

    const now = new Date();
    for (const emp of employees) {
      for (let m = 3; m >= 0; m--) {
        const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        const basic = Math.round(emp.salary / 12);
        const hra = Math.round(basic * 0.4);
        const da = Math.round(basic * 0.1);
        const ta = 1500;
        const medical = 1250;
        const gross = basic + hra + da + ta + medical;
        const pf = Math.round(basic * 0.12);
        const esi = gross <= 21000 ? Math.round(gross * 0.0175) : 0;
        const tds = Math.round(gross * 0.08);
        const totalDed = pf + esi + tds;
        const net = gross - totalDed;
        const isPaid = m > 0;
        await Payroll.create({
          employee: emp._id,
          month,
          year,
          basicSalary: basic,
          hra,
          da,
          ta,
          medicalAllowance: medical,
          otherAllowances: 0,
          grossSalary: gross,
          pf,
          esi,
          tds,
          otherDeductions: 0,
          totalDeductions: totalDed,
          netSalary: net,
          workingDays: 26,
          presentDays: Math.floor(22 + Math.random() * 4),
          leaveDays: Math.floor(Math.random() * 3),
          overtimeHours: parseFloat((Math.random() * 8).toFixed(1)),
          status: isPaid ? "paid" : "processed",
          paidAt: isPaid ? new Date(year, month - 1, 28) : undefined,
          processedBy: adminUser._id,
          remarks: isPaid
            ? "Salary paid via NEFT"
            : "Processing for current month",
        });
      }
    }
    console.log(
      `✅ Payroll records created (${employees.length * 4} records, 4 months)`,
    );

    await Recruitment.insertMany([
      {
        title: "Senior React Developer",
        department: deptIT._id,
        positions: 2,
        type: "full_time",
        status: "open",
        priority: "high",
        description:
          "Looking for an experienced React developer to join our product team.",
        requirements: "5+ years React, TypeScript, Node.js, REST APIs",
        minSalary: 1000000,
        maxSalary: 1500000,
        location: "Bangalore",
        postedBy: adminUser._id,
        closingDate: new Date(Date.now() + 30 * 86400000),
        candidates: [
          {
            name: "Arjun Mehta",
            email: "arjun@gmail.com",
            phone: "+91 99001 12345",
            stage: "interview",
            notes: "Strong React skills",
            appliedAt: daysAgo(12),
          },
          {
            name: "Sunita Rao",
            email: "sunita@gmail.com",
            phone: "+91 99002 23456",
            stage: "technical",
            notes: "Good problem solver",
            appliedAt: daysAgo(8),
          },
          {
            name: "Kiran Joshi",
            email: "kiran@gmail.com",
            phone: "+91 99003 34567",
            stage: "screening",
            notes: "Profile looks good",
            appliedAt: daysAgo(3),
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
          "HR Executive to manage recruitment and employee engagement.",
        requirements: "2+ years HR experience, MBA preferred",
        minSalary: 350000,
        maxSalary: 500000,
        location: "Bangalore",
        postedBy: adminUser._id,
        closingDate: new Date(Date.now() + 20 * 86400000),
        candidates: [
          {
            name: "Divya Pillai",
            email: "divya@gmail.com",
            phone: "+91 99004 45678",
            stage: "hr_round",
            notes: "Excellent communication",
            appliedAt: daysAgo(15),
          },
          {
            name: "Manish Singh",
            email: "manish@gmail.com",
            phone: "+91 99005 56789",
            stage: "offered",
            notes: "Accepted offer verbally",
            appliedAt: daysAgo(20),
          },
        ],
      },
      {
        title: "Sales Manager – North India",
        department: deptSales._id,
        positions: 1,
        type: "full_time",
        status: "on_hold",
        priority: "urgent",
        description: "Drive B2B sales across North India region.",
        requirements: "5+ years enterprise sales, SaaS experience preferred",
        minSalary: 900000,
        maxSalary: 1200000,
        location: "Delhi NCR",
        postedBy: adminUser._id,
        closingDate: new Date(Date.now() + 45 * 86400000),
        candidates: [
          {
            name: "Vikram Bhatia",
            email: "vikram@gmail.com",
            phone: "+91 99006 67890",
            stage: "hired",
            notes: "Joining next month",
            appliedAt: daysAgo(30),
          },
        ],
      },
    ]);
    console.log("✅ Recruitment postings created (3)");

    const perfData = [
      {
        empIdx: 0,
        reviewPeriod: "Q1 2025",
        year: 2025,
        quarter: 1,
        reviewType: "quarterly",
        overallRating: 4.5,
        strengths:
          "Strong leadership, excellent HR policy knowledge, great stakeholder management.",
        areasOfImprovement:
          "Can delegate more effectively and improve documentation practices.",
        reviewerComments:
          "Rajesh continues to be a key pillar of the HR department. Highly recommended for a senior role.",
        employeeComments:
          "I look forward to expanding HR automation initiatives this year.",
        status: "completed",
        goals: [
          {
            title: "Reduce Attrition Rate",
            description: "Bring down monthly attrition below 2%",
            target: "< 2% monthly attrition",
            achieved: "1.4% — exceeded target",
            rating: 5,
          },
          {
            title: "Implement HR Software",
            description: "Fully deploy HRMS platform",
            target: "100% adoption by Q1 end",
            achieved: "95% adoption achieved",
            rating: 4,
          },
          {
            title: "Training Programs",
            description: "Run 4 training sessions",
            target: "4 sessions",
            achieved: "5 sessions conducted",
            rating: 5,
          },
        ],
      },
      {
        empIdx: 1,
        reviewPeriod: "Annual 2024",
        year: 2024,
        quarter: null,
        reviewType: "annual",
        overallRating: 4,
        strengths: "Detail-oriented, excellent employee relations.",
        areasOfImprovement: "Should improve speed of recruitment closure.",
        reviewerComments:
          "Priya is a reliable HR professional with strong interpersonal skills.",
        employeeComments: "Planning to get certified in talent acquisition.",
        status: "completed",
        goals: [
          {
            title: "Recruitment TAT",
            description: "Reduce time-to-hire to under 30 days",
            target: "30 days average",
            achieved: "28 days — met target",
            rating: 4,
          },
          {
            title: "Employee Engagement Score",
            description: "Improve eNPS score",
            target: "50+ eNPS",
            achieved: "48 — near target",
            rating: 3,
          },
        ],
      },
      {
        empIdx: 3,
        reviewPeriod: "Q1 2025",
        year: 2025,
        quarter: 1,
        reviewType: "quarterly",
        overallRating: 5,
        strengths:
          "Exceptional technical skills, strong mentoring ability, delivers on time.",
        areasOfImprovement:
          "Could improve documentation and knowledge transfer.",
        reviewerComments:
          "Vivek is one of our highest performers. Strongly recommend for promotion to Principal Engineer.",
        employeeComments:
          "I want to lead the new microservices architecture initiative.",
        status: "completed",
        goals: [
          {
            title: "Feature Delivery",
            description: "Ship Q1 product roadmap on time",
            target: "100% Q1 features shipped",
            achieved: "All features delivered 2 days early",
            rating: 5,
          },
          {
            title: "Team Mentoring",
            description: "Mentor 2 junior developers",
            target: "2 mentees",
            achieved: "3 developers mentored",
            rating: 5,
          },
        ],
      },
    ];

    for (const p of perfData) {
      const { empIdx, goals, ...rest } = p;
      await Performance.create({
        employee: employees[empIdx]._id,
        ...rest,
        goals,
        reviewedBy: adminUser._id,
        reviewedAt: new Date(),
      });
    }
    console.log("✅ Performance reviews created (3)");

    console.log("\n🎉 Demo data seeded successfully!");
    console.log("\n📋 Login Credentials:");
    console.log("   Email: demo@nesthr.com");
    console.log("   Password: Demo@12345");
    console.log("\n🏢 Company: TechVision Solutions Pvt. Ltd.");
    console.log("   Plan: Enterprise | Employees: " + employees.length);
    console.log("\n📦 Data created:");
    console.log("   Departments: 4 | Employees: " + employees.length);
    console.log(
      "   Attendance: " + attendanceRecords.length + " records (60 days)",
    );
    console.log("   Leaves: " + leaveData.length + " requests");
    console.log("   Payroll: " + employees.length * 4 + " records (4 months)");
    console.log("   Recruitment: 3 job postings with candidates");
    console.log("   Performance: 3 reviews");

    process.exit(0);
  } catch (error) {
    console.error("❌ Error seeding demo data:", error.message);
    console.error(error);
    process.exit(1);
  }
}

seedDemoData();

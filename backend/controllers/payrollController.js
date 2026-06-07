const asyncHandler = require("express-async-handler");
const Payroll = require("../models/Payroll");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const EmployeePayrollConfig = require("../models/EmployeePayrollConfig");
const DeductionRule = require("../models/DeductionRule");
const { safePagination } = require("../middleware/validate");
const { sendWhatsApp, payrollPaidMsg } = require("../services/whatsappService");

const PAYROLL_STATUS = ["processed", "paid", "cancelled"];

const getPayrolls = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { month, year, employeeId, status } = req.query;

  const filter = { company: req.user.company };
  if (month) {
    const m = parseInt(month);
    if (!isNaN(m)) filter.month = m;
  }
  if (year) {
    const y = parseInt(year);
    if (!isNaN(y)) filter.year = y;
  }
  if (status && PAYROLL_STATUS.includes(status)) filter.status = status;

  if (employeeId) {
    // Verify employee belongs to this company
    const emp = await Employee.findOne({
      _id: employeeId,
      company: req.user.company,
    });
    if (!emp) return res.json({ success: true, data: [], total: 0 });
    filter.employee = employeeId;
  }

  const total = await Payroll.countDocuments(filter);
  const payrolls = await Payroll.find(filter)
    .populate({
      path: "employee",
      select: "firstName lastName employeeId designation phone",
      populate: { path: "department", select: "name" },
    })
    .sort({ year: -1, month: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: payrolls,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

const processPayroll = asyncHandler(async (req, res) => {
  const { month, year, employeeIds } = req.body;
  const m = parseInt(month),
    y = parseInt(year);
  if (isNaN(m) || m < 1 || m > 12 || isNaN(y) || y < 2000 || y > 2100) {
    res.status(400);
    throw new Error("Valid month (1-12) and year are required");
  }

  const empFilter = { company: req.user.company, status: "active" };
  if (Array.isArray(employeeIds) && employeeIds.length > 0) {
    empFilter._id = { $in: employeeIds };
  }
  const employees = await Employee.find(empFilter);

  const deductionRule = await DeductionRule.findOne({
    company: req.user.company,
  });

  // Date range for the requested month
  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 0);
  const totalDaysInMonth = endDate.getDate();

  const payrolls = [];

  for (const emp of employees) {
    const existing = await Payroll.findOne({
      employee: emp._id,
      month: m,
      year: y,
    });
    if (existing) continue;

    // Use per-employee config if set, fall back to employee.salary
    const config = await EmployeePayrollConfig.findOne({
      employee: emp._id,
      company: req.user.company,
    });

    const basic = config?.basicSalary ?? emp.salary ?? 0;
    const hra = config?.hra ?? basic * 0.4;
    const da = config?.da ?? basic * 0.1;
    const ta = config?.ta ?? 1500;
    const medicalAllowance = config?.medicalAllowance ?? 0;
    const otherAllowances = config?.otherAllowances ?? 0;
    const gross = basic + hra + da + ta + medicalAllowance + otherAllowances;

    // Attendance for this month
    const attendances = await Attendance.find({
      employee: emp._id,
      date: { $gte: startDate, $lte: endDate },
    });

    // Shift timing & thresholds from deduction rule (with safe defaults)
    const shiftH = deductionRule?.shiftStartHour ?? 9;
    const shiftM = deductionRule?.shiftStartMinute ?? 0;
    const graceMins = deductionRule?.lateThresholdMinutes ?? 15;
    const halfDayMins = deductionRule?.halfDayThresholdMinutes ?? 120;

    let presentDays = 0;
    let lateDays = 0;
    let halfDayCount = 0;
    let absentDays = 0;
    let leaveDays = 0;

    for (const a of attendances) {
      // Skip non-working days — no deduction, no present credit
      if (a.status === "holiday" || a.status === "weekend") continue;

      if (a.status === "on_leave") {
        leaveDays++;
        continue;
      }

      if (a.checkIn) {
        // Re-derive lateness from actual check-in time vs shift start + grace period
        const dateObj = new Date(a.date);
        const shiftStart = new Date(dateObj);
        shiftStart.setHours(shiftH, shiftM, 0, 0);

        const minutesLate = (new Date(a.checkIn) - shiftStart) / 60000;

        presentDays++; // employee came in — counts as present regardless of lateness

        if (minutesLate <= graceMins) {
          // On time (within grace period) — no attendance deduction
        } else if (minutesLate <= halfDayMins) {
          // Late but not severe enough for half day
          lateDays++;
        } else {
          // Arrived so late it counts as a half day
          halfDayCount++;
        }
      } else {
        // No check-in recorded — trust the manually set status
        if (a.status === "absent") {
          absentDays++;
        } else if (a.status === "present") {
          presentDays++;
        } else if (a.status === "late") {
          presentDays++;
          lateDays++;
        } else if (a.status === "half_day") {
          presentDays++;
          halfDayCount++;
        }
      }
    }

    // Daily salary basis = gross spread over calendar days of the month
    const dailySalary = totalDaysInMonth > 0 ? gross / totalDaysInMonth : 0;

    // Standard statutory deductions
    const pf = basic * 0.12;
    const esi = gross * 0.0175;
    const tds = gross > 50000 ? gross * 0.1 : 0;

    // Attendance-based deductions calculated from shift timing and thresholds
    let lateDeduction = 0;
    let halfDayDeduction = 0;
    let absentDeduction = 0;

    if (deductionRule) {
      // Late deduction
      if (deductionRule.lateDeductionType === "fixed") {
        lateDeduction = lateDays * deductionRule.lateDeductionAmount;
      } else {
        lateDeduction =
          lateDays * (dailySalary * (deductionRule.lateDeductionAmount / 100));
      }

      // Half-day deduction — always a percentage of daily salary
      halfDayDeduction =
        halfDayCount *
        (dailySalary * ((deductionRule.halfDayDeductionPercent ?? 50) / 100));

      // Absent deduction
      if (deductionRule.absentDeductionType === "fixed") {
        absentDeduction = absentDays * deductionRule.absentDeductionAmount;
      } else {
        absentDeduction =
          absentDays *
          (dailySalary * (deductionRule.absentDeductionAmount / 100));
      }
    } else {
      // No rules configured — deduct one full day's pay per absent day
      absentDeduction = absentDays * dailySalary;
    }

    const otherDeductions = lateDeduction + halfDayDeduction + absentDeduction;
    const totalDed = pf + esi + tds + otherDeductions;

    payrolls.push({
      company: req.user.company,
      employee: emp._id,
      month: m,
      year: y,
      basicSalary: basic,
      hra,
      da,
      ta,
      medicalAllowance,
      otherAllowances,
      grossSalary: gross,
      pf,
      esi,
      tds,
      otherDeductions,
      totalDeductions: totalDed,
      netSalary: Math.max(0, gross - totalDed),
      workingDays: totalDaysInMonth,
      presentDays,
      leaveDays,
      status: "processed",
      processedBy: req.user._id,
    });
  }

  if (payrolls.length) await Payroll.insertMany(payrolls);
  res.json({ success: true, message: `${payrolls.length} payrolls processed` });
});

const updatePayroll = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!payroll) {
    res.status(404);
    throw new Error("Payroll not found");
  }

  // Whitelist updatable fields
  const allowed = [
    "basicSalary",
    "hra",
    "da",
    "ta",
    "grossSalary",
    "pf",
    "esi",
    "tds",
    "totalDeductions",
    "netSalary",
    "workingDays",
    "presentDays",
    "status",
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) payroll[key] = req.body[key];
  }

  await payroll.save();
  res.json({ success: true, data: payroll });
});

const markPaid = asyncHandler(async (req, res) => {
  const payroll = await Payroll.findOne({
    _id: req.params.id,
    company: req.user.company,
  }).populate("employee", "firstName lastName phone");
  if (!payroll) {
    res.status(404);
    throw new Error("Payroll not found");
  }

  payroll.status = "paid";
  payroll.paidAt = new Date();
  await payroll.save();

  if (payroll.employee?.phone) {
    try {
      await sendWhatsApp(
        payroll.employee.phone,
        payrollPaidMsg(payroll.employee, payroll),
        "whatsappNotifyPayroll",
        req.user.company,
      );
    } catch {}
  }

  res.json({ success: true, data: payroll });
});

const bulkMarkPaid = asyncHandler(async (req, res) => {
  const { month, year } = req.body;
  const m = parseInt(month),
    y = parseInt(year);
  const result = await Payroll.updateMany(
    { company: req.user.company, month: m, year: y, status: "processed" },
    { $set: { status: "paid", paidAt: new Date() } },
  );
  res.json({
    success: true,
    message: `${result.modifiedCount} payrolls marked as paid`,
  });
});

module.exports = {
  getPayrolls,
  processPayroll,
  updatePayroll,
  markPaid,
  bulkMarkPaid,
};

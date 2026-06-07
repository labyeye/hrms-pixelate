const asyncHandler = require("express-async-handler");
const Payroll = require("../models/Payroll");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
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

// Count actual working days in a month based on employee's work days per week (5/6/7)
function getWorkingDays(year, month, workDaysPerWeek) {
  const days = workDaysPerWeek ?? 6;
  let count = 0;
  const end = new Date(year, month, 0).getDate();
  for (let d = 1; d <= end; d++) {
    const dow = new Date(year, month - 1, d).getDay(); // 0=Sun, 6=Sat
    if (days >= 7)
      count++; // every day
    else if (days >= 6 && dow >= 1 && dow <= 6)
      count++; // Mon-Sat
    else if (dow >= 1 && dow <= 5) count++; // Mon-Fri (default for 5)
  }
  return count || 1;
}

// Parse "HH:MM" string into { hour, minute }
function parseTime(timeStr) {
  const [h, m] = (timeStr || "00:00").split(":").map(Number);
  return { hour: h || 0, minute: m || 0 };
}

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
  const employees = await Employee.find(empFilter).populate("shift");

  const deductionRule = await DeductionRule.findOne({
    company: req.user.company,
  });

  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 0);

  const payrolls = [];

  for (const emp of employees) {
    const existing = await Payroll.findOne({
      employee: emp._id,
      month: m,
      year: y,
    });
    if (existing) continue;

    const attendances = await Attendance.find({
      employee: emp._id,
      date: { $gte: startDate, $lte: endDate },
    });

    // Skip employees with no attendance records for this month
    if (attendances.length === 0) continue;

    // ── Working days for this employee based on their work week ────────────
    const workDaysPerWeek = emp.workDaysPerWeek ?? 6;
    const workingDays = getWorkingDays(y, m, workDaysPerWeek);
    const salary = emp.salary ?? 0;
    const dailyRate = workingDays > 0 ? salary / workingDays : 0;

    // ── Shift timing: use employee's assigned Shift, fall back to DeductionRule ─
    const empShift = emp.shift;
    let shiftH, shiftM, shiftEndH, shiftEndM;

    if (empShift?.startTime) {
      const s = parseTime(empShift.startTime);
      shiftH = s.hour;
      shiftM = s.minute;
    } else {
      shiftH = deductionRule?.shiftStartHour ?? 9;
      shiftM = deductionRule?.shiftStartMinute ?? 0;
    }

    if (empShift?.endTime) {
      const e = parseTime(empShift.endTime);
      shiftEndH = e.hour;
      shiftEndM = e.minute;
    } else {
      shiftEndH = deductionRule?.shiftEndHour ?? 18;
      shiftEndM = deductionRule?.shiftEndMinute ?? 0;
    }

    const graceMins = deductionRule?.lateThresholdMinutes ?? 15;
    const halfDayMins = deductionRule?.halfDayThresholdMinutes ?? 120;
    const earlyThreshold = deductionRule?.earlyCheckoutThresholdMinutes ?? 15;
    const earlyEnabled = deductionRule?.earlyCheckoutDeductionEnabled ?? false;
    const shiftTotalMins = shiftEndH * 60 + shiftEndM - (shiftH * 60 + shiftM);

    let presentDays = 0,
      lateDays = 0,
      halfDayCount = 0,
      leaveDays = 0;
    let earlyCheckoutDeduction = 0;

    for (const a of attendances) {
      if (a.status === "holiday" || a.status === "weekend") continue;
      if (a.status === "on_leave") {
        leaveDays++;
        continue;
      }

      if (a.checkIn) {
        const dateObj = new Date(a.date);
        const shiftStart = new Date(dateObj);
        shiftStart.setHours(shiftH, shiftM, 0, 0);

        const minutesLate = (new Date(a.checkIn) - shiftStart) / 60000;
        presentDays++;

        if (minutesLate > halfDayMins) {
          halfDayCount++; // very late = half day
        } else if (minutesLate > graceMins) {
          lateDays++;
        }

        // Early checkout: proportional deduction on that day's pay
        if (earlyEnabled && a.checkOut && shiftTotalMins > 0) {
          const shiftEnd = new Date(dateObj);
          shiftEnd.setHours(shiftEndH, shiftEndM, 0, 0);
          const minutesEarly = (shiftEnd - new Date(a.checkOut)) / 60000;
          if (minutesEarly > earlyThreshold) {
            earlyCheckoutDeduction +=
              (minutesEarly / shiftTotalMins) * dailyRate;
          }
        }
      } else {
        // No checkIn — trust manually set status
        if (a.status === "present") presentDays++;
        else if (a.status === "late") {
          presentDays++;
          lateDays++;
        } else if (a.status === "half_day") {
          presentDays++;
          halfDayCount++;
        }
        // absent → not counted in presentDays (handled by proportional pay)
      }
    }

    // ── Proportional pay: salary × (effectiveDays / workingDays) ──────────
    // Half-day = 0.5 of a day; late days do NOT reduce paid days (separate deduction)
    const effectivePaidDays = presentDays - halfDayCount * 0.5;
    const earnedSalary = Math.max(0, dailyRate * effectivePaidDays);

    // ── Late deduction (only fixed or % of daily rate) ─────────────────────
    let lateDeduction = 0;
    if (deductionRule && lateDays > 0) {
      lateDeduction =
        deductionRule.lateDeductionType === "fixed"
          ? lateDays * deductionRule.lateDeductionAmount
          : lateDays * dailyRate * (deductionRule.lateDeductionAmount / 100);
    }

    const totalDeductions = lateDeduction + earlyCheckoutDeduction;
    const netSalary = Math.max(0, earnedSalary - totalDeductions);

    payrolls.push({
      company: req.user.company,
      employee: emp._id,
      month: m,
      year: y,
      basicSalary: salary,
      grossSalary: salary,
      otherDeductions: totalDeductions,
      totalDeductions,
      netSalary,
      workingDays,
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

// Employee self-service: get own payroll records
const getMyPayrolls = asyncHandler(async (req, res) => {
  const emp = await Employee.findOne({
    user: req.user._id,
    company: req.user.company,
  });
  if (!emp) return res.json({ success: true, data: [] });

  const { month, year } = req.query;
  const filter = { employee: emp._id, company: req.user.company };
  if (month) filter.month = parseInt(month);
  if (year) filter.year = parseInt(year);

  const payrolls = await Payroll.find(filter).sort({ year: -1, month: -1 });
  res.json({ success: true, data: payrolls });
});

module.exports = {
  getPayrolls,
  getMyPayrolls,
  processPayroll,
  updatePayroll,
  markPaid,
  bulkMarkPaid,
};

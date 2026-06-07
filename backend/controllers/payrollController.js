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

// Returns actual working days in a month based on company's work week setting
function getWorkingDays(year, month, workWeek) {
  let count = 0;
  const end = new Date(year, month, 0).getDate(); // last day of month
  for (let d = 1; d <= end; d++) {
    const dow = new Date(year, month - 1, d).getDay(); // 0=Sun, 6=Sat
    if (workWeek === "mon_fri" && dow >= 1 && dow <= 5) count++;
    else if (workWeek !== "mon_fri" && dow >= 1 && dow <= 6) count++; // mon_sat default
  }
  return count || 1; // never return 0
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
  // Populate shift so we can use per-employee shift timing
  const employees = await Employee.find(empFilter).populate("shift");

  const deductionRule = await DeductionRule.findOne({ company: req.user.company });

  // Actual working days in the month based on company work week
  const workWeek = deductionRule?.workWeek ?? "mon_sat";
  const workingDays = getWorkingDays(y, m, workWeek);

  const startDate = new Date(y, m - 1, 1);
  const endDate = new Date(y, m, 0);

  const payrolls = [];

  for (const emp of employees) {
    const existing = await Payroll.findOne({ employee: emp._id, month: m, year: y });
    if (existing) continue;

    // Fetch attendance for this employee this month
    const attendances = await Attendance.find({
      employee: emp._id,
      date: { $gte: startDate, $lte: endDate },
    });

    // Skip employees with zero attendance records — nothing to process
    if (attendances.length === 0) continue;

    // ── Salary components ──────────────────────────────────────────────────
    const config = await EmployeePayrollConfig.findOne({
      employee: emp._id,
      company: req.user.company,
    });

    const defaultHraPct = deductionRule?.defaultHraPct ?? 40;
    const defaultDaPct  = deductionRule?.defaultDaPct  ?? 10;
    const defaultTa     = deductionRule?.defaultTa     ?? 1500;

    const basic          = config?.basicSalary ?? emp.salary ?? 0;
    const hra            = config?.hra ?? (basic * defaultHraPct) / 100;
    const da             = config?.da  ?? (basic * defaultDaPct)  / 100;
    const ta             = config?.ta  ?? defaultTa;
    const medicalAllowance = config?.medicalAllowance ?? 0;
    const otherAllowances  = config?.otherAllowances  ?? 0;
    const gross = basic + hra + da + ta + medicalAllowance + otherAllowances;

    const dailySalary = gross / workingDays;

    // ── Per-employee shift timing (falls back to global DeductionRule) ─────
    const empShift = emp.shift; // populated Shift doc or null
    let shiftH, shiftM, shiftEndH, shiftEndM;

    if (empShift?.startTime) {
      const s = parseTime(empShift.startTime);
      shiftH = s.hour; shiftM = s.minute;
    } else {
      shiftH = deductionRule?.shiftStartHour ?? 9;
      shiftM = deductionRule?.shiftStartMinute ?? 0;
    }

    if (empShift?.endTime) {
      const e = parseTime(empShift.endTime);
      shiftEndH = e.hour; shiftEndM = e.minute;
    } else {
      shiftEndH = deductionRule?.shiftEndHour ?? 18;
      shiftEndM = deductionRule?.shiftEndMinute ?? 0;
    }

    const graceMins      = deductionRule?.lateThresholdMinutes ?? 15;
    const halfDayMins    = deductionRule?.halfDayThresholdMinutes ?? 120;
    const earlyThreshold = deductionRule?.earlyCheckoutThresholdMinutes ?? 15;
    const earlyEnabled   = deductionRule?.earlyCheckoutDeductionEnabled ?? false;

    // Total shift length in minutes (for proportional early checkout deduction)
    const shiftTotalMins = (shiftEndH * 60 + shiftEndM) - (shiftH * 60 + shiftM);

    let presentDays = 0, lateDays = 0, halfDayCount = 0;
    let absentDays = 0, leaveDays = 0;
    let earlyCheckoutDeduction = 0;

    for (const a of attendances) {
      if (a.status === "holiday" || a.status === "weekend") continue;
      if (a.status === "on_leave") { leaveDays++; continue; }

      if (a.checkIn) {
        const dateObj   = new Date(a.date);
        const shiftStart = new Date(dateObj);
        shiftStart.setHours(shiftH, shiftM, 0, 0);

        const minutesLate = (new Date(a.checkIn) - shiftStart) / 60000;
        presentDays++;

        if (minutesLate <= graceMins) {
          // On time — no late deduction
        } else if (minutesLate <= halfDayMins) {
          lateDays++;
        } else {
          halfDayCount++;
        }

        // Early checkout check
        if (earlyEnabled && a.checkOut && shiftTotalMins > 0) {
          const shiftEnd = new Date(dateObj);
          shiftEnd.setHours(shiftEndH, shiftEndM, 0, 0);
          const minutesEarly = (shiftEnd - new Date(a.checkOut)) / 60000;
          if (minutesEarly > earlyThreshold) {
            // Proportional deduction: (minutes short / total shift minutes) * daily salary
            earlyCheckoutDeduction += (minutesEarly / shiftTotalMins) * dailySalary;
          }
        }
      } else {
        // No checkIn — trust manually set status
        if (a.status === "absent")   { absentDays++; }
        else if (a.status === "present") { presentDays++; }
        else if (a.status === "late")    { presentDays++; lateDays++; }
        else if (a.status === "half_day"){ presentDays++; halfDayCount++; }
      }
    }

    // ── Attendance-based deductions ────────────────────────────────────────
    let lateDeduction = 0, halfDayDeduction = 0, absentDeduction = 0;

    if (deductionRule) {
      lateDeduction = deductionRule.lateDeductionType === "fixed"
        ? lateDays * deductionRule.lateDeductionAmount
        : lateDays * dailySalary * (deductionRule.lateDeductionAmount / 100);

      halfDayDeduction = halfDayCount * dailySalary * ((deductionRule.halfDayDeductionPercent ?? 50) / 100);

      absentDeduction = deductionRule.absentDeductionType === "fixed"
        ? absentDays * deductionRule.absentDeductionAmount
        : absentDays * dailySalary * (deductionRule.absentDeductionAmount / 100);
    } else {
      absentDeduction = absentDays * dailySalary;
    }

    // ── Statutory deductions (each toggleable) ─────────────────────────────
    const pfRate        = (deductionRule?.pfRate ?? 12) / 100;
    const esiRate       = (deductionRule?.esiRate ?? 1.75) / 100;
    const esiGrossLimit = deductionRule?.esiGrossLimit ?? 21000;
    const tdsRate       = (deductionRule?.tdsRate ?? 10) / 100;
    const tdsTaxThresh  = deductionRule?.tdsTaxableThreshold ?? 50000;

    const pf  = (deductionRule?.enablePf  ?? true)  ? basic * pfRate : 0;
    const esi = (deductionRule?.enableEsi ?? true)   && (esiGrossLimit === 0 || gross <= esiGrossLimit)
                  ? gross * esiRate : 0;
    const tds = (deductionRule?.enableTds ?? false)  && (tdsTaxThresh === 0 || gross > tdsTaxThresh)
                  ? gross * tdsRate : 0;

    const otherDeductions = lateDeduction + halfDayDeduction + absentDeduction + earlyCheckoutDeduction;
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

module.exports = {
  getPayrolls,
  processPayroll,
  updatePayroll,
  markPaid,
  bulkMarkPaid,
};

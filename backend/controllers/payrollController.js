const asyncHandler = require("express-async-handler");
const Payroll = require("../models/Payroll");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const DeductionRule = require("../models/DeductionRule");
const Transaction = require("../models/Transaction");
const Loan = require("../models/Loan");
const { safePagination } = require("../middleware/validate");
const { sendSalaryPaid } = require("../services/whatsappService");

const PAYROLL_STATUS = ["processed", "paid", "cancelled"];

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

// Returns minutes-since-midnight in IST for any Date or ISO string.
// All shift times (e.g. "09:00") are IST — so we compare apples-to-apples.
function istMinutes(date) {
  const d = new Date(date);
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return ist.getUTCHours() * 60 + ist.getUTCMinutes();
}

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

function getWorkingDays(year, month, workDaysPerWeek) {
  const days = workDaysPerWeek ?? 6;
  let count = 0;
  const end = new Date(year, month, 0).getDate();
  for (let d = 1; d <= end; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (days >= 7) count++;
    else if (days >= 6 && dow >= 1 && dow <= 6) count++;
    else if (dow >= 1 && dow <= 5) count++;
  }
  return count || 1;
}

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

    if (attendances.length === 0) continue;

    const workDaysPerWeek = emp.workDaysPerWeek ?? 6;
    const workingDays = getWorkingDays(y, m, workDaysPerWeek);
    const salary = emp.salary ?? 0;
    const dailyRate = workingDays > 0 ? salary / workingDays : 0;

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
    let attendanceOTHours = 0;

    for (const a of attendances) {
      if (a.status === "holiday" || a.status === "weekend") continue;
      if (a.status === "on_leave") {
        leaveDays++;
        continue;
      }

      if (a.checkIn) {
        // Compare in IST — shift times are IST strings; checkIn stored as UTC
        const checkInIST  = istMinutes(a.checkIn);
        const shiftStartIST = shiftH * 60 + shiftM;
        const minutesLate = checkInIST - shiftStartIST;
        presentDays++;

        if (minutesLate > halfDayMins) {
          halfDayCount++;
        } else if (minutesLate > graceMins) {
          lateDays++;
        }

        if (earlyEnabled && a.checkOut && shiftTotalMins > 0) {
          const checkOutIST = istMinutes(a.checkOut);
          const shiftEndIST = shiftEndH * 60 + shiftEndM;
          const minutesEarly = shiftEndIST - checkOutIST;
          if (minutesEarly > earlyThreshold) {
            earlyCheckoutDeduction +=
              (minutesEarly / shiftTotalMins) * dailyRate;
          }
        }
      } else {
        if (a.status === "present") presentDays++;
        else if (a.status === "late") {
          presentDays++;
          lateDays++;
        } else if (a.status === "half_day") {
          presentDays++;
          halfDayCount++;
        }
      }

      if (a.overtime && a.overtime > 0) attendanceOTHours += a.overtime;
    }

    let weeklyOffDaysEarned = 0;
    if (workDaysPerWeek === 6) {
      const presentDates = new Set();
      for (const a of attendances) {
        if (
          a.status === "holiday" ||
          a.status === "weekend" ||
          a.status === "on_leave"
        )
          continue;
        const d = new Date(a.date);
        const dow = d.getDay();
        if (dow === 0) continue;
        let wasPresent = false;
        if (a.checkIn) {
          wasPresent = true;
        } else {
          wasPresent = ["present", "late", "half_day"].includes(a.status);
        }
        if (wasPresent) presentDates.add(d.toISOString().split("T")[0]);
      }

      const weekPresentCount = new Map();
      for (const dateStr of presentDates) {
        const d = new Date(dateStr);

        const monday = new Date(d);
        monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        const key = monday.toISOString().split("T")[0];
        weekPresentCount.set(key, (weekPresentCount.get(key) || 0) + 1);
      }

      for (const count of weekPresentCount.values()) {
        if (count >= 4) weeklyOffDaysEarned++;
      }
    }

    const effectivePaidDays =
      presentDays - halfDayCount * 0.5 + weeklyOffDaysEarned;
    const earnedSalary = Math.max(0, dailyRate * effectivePaidDays);

    let lateDeduction = 0;
    if (deductionRule && lateDays > 0) {
      lateDeduction =
        deductionRule.lateDeductionType === "fixed"
          ? lateDays * deductionRule.lateDeductionAmount
          : lateDays * dailyRate * (deductionRule.lateDeductionAmount / 100);
    }

    const txMonthStart = new Date(y, m - 1, 1);
    const txMonthEnd = new Date(y, m, 0, 23, 59, 59);
    const pendingTx = await Transaction.find({
      employee: emp._id,
      company: req.user.company,
      status: "pending",
      date: { $gte: txMonthStart, $lte: txMonthEnd },
    });

    let totalAllowances = 0;
    let totalPenalties = 0;
    let totalOT = 0;
    let totalOTHours = 0;
    const txIds = [];
    for (const tx of pendingTx) {
      if (tx.type === "allowance") totalAllowances += tx.amount;
      else if (tx.type === "penalty") totalPenalties += tx.amount;
      else if (tx.type === "overtime") {
        totalOT += tx.amount;
        totalOTHours += tx.hours || 0;
      }
      txIds.push(tx._id);
    }

    const activeLoans = await Loan.find({
      employee: emp._id,
      company: req.user.company,
      status: "active",
    });

    let loanDeduction = 0;
    const loanUpdates = [];

    const shiftHours = shiftTotalMins > 0 ? shiftTotalMins / 60 : 8;
    const otHourlyRate = dailyRate / shiftHours;
    const attendanceOTPay = attendanceOTHours * otHourlyRate;
    const grossSalary =
      earnedSalary + totalAllowances + totalOT + attendanceOTPay;
    const preDeductions =
      lateDeduction + earlyCheckoutDeduction + totalPenalties;
    let salaryAfterDeductions = Math.max(0, grossSalary - preDeductions);

    for (const loan of activeLoans) {
      if (loan.remainingBalance <= 0) continue;

      const emi = Math.min(
        loan.monthlyEmi || loan.remainingBalance,
        loan.remainingBalance,
        salaryAfterDeductions,
      );
      if (emi <= 0) continue;

      loanDeduction += emi;
      salaryAfterDeductions -= emi;

      const newBalance = Math.max(0, loan.remainingBalance - emi);
      loanUpdates.push({
        id: loan._id,
        newBalance,
        cleared: newBalance === 0,
      });
    }

    const totalDeductions = preDeductions + loanDeduction;
    const netSalary = Math.max(0, grossSalary - totalDeductions);

    payrolls.push({
      company: req.user.company,
      employee: emp._id,
      month: m,
      year: y,
      basicSalary: salary,
      earnedBasic: earnedSalary,
      otherAllowances: totalAllowances,
      otPay: attendanceOTPay + totalOT,
      grossSalary,
      lateDeductionAmount: lateDeduction,
      penaltyAmount: totalPenalties,
      loanDeduction,
      otherDeductions: preDeductions,
      totalDeductions,
      netSalary,
      workingDays,
      presentDays,
      leaveDays,
      weeklyOffDays: weeklyOffDaysEarned,
      overtimeHours: attendanceOTHours + totalOTHours,
      status: "processed",
      processedBy: req.user._id,
    });

    for (const u of loanUpdates) {
      await Loan.findByIdAndUpdate(u.id, {
        remainingBalance: u.newBalance,
        ...(u.cleared ? { status: "cleared", clearedOn: new Date() } : {}),
      });
    }
    if (loanUpdates.length) {
      const newTotalLoan = activeLoans.reduce((sum, l) => {
        const upd = loanUpdates.find((u) => String(u.id) === String(l._id));
        return sum + (upd ? upd.newBalance : l.remainingBalance);
      }, 0);
      await Employee.findByIdAndUpdate(emp._id, { loanBalance: newTotalLoan });
    }

    if (txIds.length) {
      await Transaction.updateMany(
        { _id: { $in: txIds } },
        { status: "applied" },
      );
    }
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
      const months = [
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
      const period = `${months[(payroll.month || 1) - 1]} ${payroll.year}`;
      await sendSalaryPaid(
        payroll.employee.phone,
        {
          firstName: payroll.employee.firstName,
          period,
          netSalary: payroll.netSalary,
        },
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

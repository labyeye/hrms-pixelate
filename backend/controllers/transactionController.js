const asyncHandler = require("express-async-handler");
const Transaction = require("../models/Transaction");
const Employee = require("../models/Employee");
const DeductionRule = require("../models/DeductionRule");
const Payroll = require("../models/Payroll");
const bodyFor = require("../utils/bodyFor");

// The payroll whose pay period contains this transaction's date (optionally only if not yet paid).
const payrollFor = (tx, { unpaidOnly = false } = {}) =>
  Payroll.findOne({
    company: tx.company,
    employee: tx.employee,
    payPeriodStart: { $lte: tx.date },
    payPeriodEnd: { $gte: tx.date },
    ...(unpaidOnly ? { status: { $ne: "paid" } } : {}),
  });

// Adds (sign = 1) or removes (sign = -1) a transaction's effect on a payroll document.
function applyToPayroll(payroll, tx, sign) {
  const amt = (tx.amount || 0) * sign;
  const add = (field, v) => {
    payroll[field] = Math.max(0, (payroll[field] || 0) + v);
  };
  if (tx.type === "allowance") {
    add("otherAllowances", amt);
    add("grossSalary", amt);
  } else if (tx.type === "bonus") {
    add("bonusAmount", amt);
    add("grossSalary", amt);
  } else if (tx.type === "overtime") {
    add("otPay", amt);
    add("overtimeHours", (tx.hours || 0) * sign);
    add("grossSalary", amt);
  } else if (tx.type === "penalty") {
    add("penaltyAmount", amt);
    add("totalDeductions", amt);
  }
  payroll.netSalary = Math.max(0, payroll.grossSalary - payroll.totalDeductions);
}

// New/edited entry → if its month is already processed and still unpaid, apply it now and mark it applied.
// Returns a hint for the UI: { payrollUpdated } or { payrollLocked } (month already paid: it won't reach payroll).
async function syncToPayroll(tx) {
  const payroll = await payrollFor(tx);
  if (!payroll) return {};
  if (payroll.status === "paid") return { payrollLocked: true };
  applyToPayroll(payroll, tx, 1);
  await payroll.save();
  tx.status = "applied";
  await tx.save();
  return { payrollUpdated: true };
}

const getTransactions = asyncHandler(async (req, res) => {
  const { employee, type } = req.query;
  const filter = { company: req.user.company };
  if (employee) filter.employee = employee;
  if (type) filter.type = type;
  const transactions = await Transaction.find(filter)
    .populate("employee", "firstName lastName employeeId otRate")
    .sort({ date: -1 });
  res.json({ success: true, data: transactions });
});

const createTransaction = asyncHandler(async (req, res) => {
  const { employee, type, amount, hours, date, remark } = req.body;
  if (!employee || !type || !date) {
    res.status(400);
    throw new Error("employee, type and date are required");
  }

  const target = await Employee.findOne({
    _id: employee,
    company: req.user.company,
  }).populate("shift");
  if (!target) {
    res.status(404);
    throw new Error("Employee not found");
  }

  let finalAmount = Number(amount) || 0;
  let finalHours = 0;

  if (type === "overtime") {
    if (!hours || Number(hours) <= 0) {
      res.status(400);
      throw new Error("hours is required for overtime");
    }
    finalHours = Number(hours);

    if (!finalAmount) {
      const emp = target;
      const rule = await DeductionRule.findOne({ company: emp.company });

      let shiftStartH, shiftStartM, shiftEndH, shiftEndM;
      if (emp?.shift?.startTime) {
        const [sh, sm] = emp.shift.startTime.split(":").map(Number);
        shiftStartH = sh;
        shiftStartM = sm;
      } else {
        shiftStartH = rule?.shiftStartHour ?? 9;
        shiftStartM = rule?.shiftStartMinute ?? 0;
      }
      if (emp?.shift?.endTime) {
        const [eh, em] = emp.shift.endTime.split(":").map(Number);
        shiftEndH = eh;
        shiftEndM = em;
      } else {
        shiftEndH = rule?.shiftEndHour ?? 18;
        shiftEndM = rule?.shiftEndMinute ?? 0;
      }

      const shiftTotalMins =
        shiftEndH * 60 + shiftEndM - (shiftStartH * 60 + shiftStartM);
      const shiftHours = shiftTotalMins > 0 ? shiftTotalMins / 60 : 8;

      const workDaysPerWeek = emp?.workDaysPerWeek ?? 6;
      const now = new Date();
      const y = now.getFullYear(),
        m = now.getMonth() + 1;
      let workingDays = 0;
      const daysInMonth = new Date(y, m, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dow = new Date(y, m - 1, d).getDay();
        if (workDaysPerWeek >= 7) workingDays++;
        else if (workDaysPerWeek >= 6 && dow >= 1 && dow <= 6) workingDays++;
        else if (dow >= 1 && dow <= 5) workingDays++;
      }
      const dailyRate = (emp?.salary ?? 0) / (workingDays || 26);
      const otHourlyRate = dailyRate / shiftHours;
      finalAmount = finalHours * otHourlyRate;
    }
  } else {
    if (!finalAmount) {
      res.status(400);
      throw new Error("amount is required");
    }
  }

  const transaction = await Transaction.create({
    company: req.user.company,
    employee,
    type,
    amount: finalAmount,
    hours: finalHours,
    date: new Date(date),
    remark: remark || "",
  });
  // If this month's payroll is already processed (not yet paid), fold the amount into it right away.
  const sync = await syncToPayroll(transaction);
  const populated = await Transaction.findById(transaction._id).populate(
    "employee",
    "firstName lastName employeeId otRate",
  );
  res.status(201).json({ success: true, data: populated, ...sync });
});

const updateTransaction = asyncHandler(async (req, res) => {
  const existing = await Transaction.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!existing) {
    res.status(404);
    throw new Error("Transaction not found");
  }
  // Take the old amount back out of the payroll it was applied to, then re-apply the edited one.
  if (existing.status === "applied") {
    const old = await payrollFor(existing, { unpaidOnly: true });
    if (old) {
      applyToPayroll(old, existing, -1);
      await old.save();
    }
  }
  existing.set(bodyFor(Transaction, req.body, ["employee"]));
  existing.status = "pending";
  await existing.save();
  const sync = await syncToPayroll(existing);
  const transaction = await Transaction.findById(existing._id).populate(
    "employee",
    "firstName lastName employeeId",
  );
  res.json({ success: true, data: transaction, ...sync });
});

const deleteTransaction = asyncHandler(async (req, res) => {
  const tx = await Transaction.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  // Deleting an already-applied entry reverses it on the (unpaid) payroll.
  if (tx && tx.status === "applied") {
    const payroll = await payrollFor(tx, { unpaidOnly: true });
    if (payroll) {
      applyToPayroll(payroll, tx, -1);
      await payroll.save();
    }
  }
  res.json({ success: true, message: "Deleted" });
});

module.exports = {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};

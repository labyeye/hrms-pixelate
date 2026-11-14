const asyncHandler = require("express-async-handler");
const SalaryRevision = require("../models/SalaryRevision");
const Employee = require("../models/Employee");
const { logAudit } = require("../utils/auditLogger");
const { notifyEmployee } = require("../services/inAppNotificationService");

const IST = 5.5 * 3600 * 1000;
const round1 = (n) => Math.round(n * 10) / 10;
const fullName = (e) => `${e?.firstName || ""} ${e?.lastName || ""}`.trim();

/**
 * Record a salary change and apply it to the employee. Used by the Promotions page and by the Employees edit form,
 * so every change leaves a history row. Returns the saved revision.
 */
async function recordRevision({
  employee, // Employee document (not lean)
  newSalary,
  reason,
  designation, // optional new designation
  remarks,
  effectiveDate,
  user, // req.user
}) {
  const previousSalary = Number(employee.salary) || 0;
  const designationChanged =
    !!designation && designation.trim() !== (employee.designation || "");
  const changeAmount = newSalary - previousSalary;
  const kind = designationChanged
    ? "promotion"
    : changeAmount >= 0
      ? "increment"
      : "decrease";

  const revision = await SalaryRevision.create({
    company: employee.company,
    employee: employee._id,
    effectiveDate: effectiveDate || new Date(),
    previousSalary,
    newSalary,
    changeAmount,
    changePct: previousSalary > 0 ? round1((changeAmount / previousSalary) * 100) : 0,
    kind,
    reason,
    previousDesignation: employee.designation,
    newDesignation: designationChanged ? designation.trim() : undefined,
    remarks: remarks || undefined,
    createdBy: user?._id,
    createdByName: user?.name,
  });

  employee.salary = newSalary;
  if (designationChanged) employee.designation = designation.trim();
  employee.salaryHistory = employee.salaryHistory || [];
  employee.salaryHistory.push({
    amount: newSalary,
    effectiveFrom: revision.effectiveDate,
    changedBy: user?._id,
    changedByName: user?.name,
  });
  await employee.save();
  return revision;
}

// POST /api/promotions  (admin / HR)
const createRevision = asyncHandler(async (req, res) => {
  const { employee: employeeId, newSalary, reason, designation, remarks, effectiveDate } =
    req.body;
  const salary = Number(newSalary);
  if (!employeeId || newSalary === undefined || newSalary === "" || isNaN(salary) || salary < 0) {
    res.status(400);
    throw new Error("Employee and a valid new salary are required");
  }
  if (!reason || !String(reason).trim()) {
    res.status(400);
    throw new Error("A reason is required");
  }
  const employee = await Employee.findOne({
    _id: employeeId,
    company: req.user.company,
  });
  if (!employee) {
    res.status(404);
    throw new Error("Employee not found");
  }
  const when = effectiveDate ? new Date(effectiveDate) : new Date();
  if (isNaN(when.getTime())) {
    res.status(400);
    throw new Error("Invalid effective date");
  }
  if (when.getTime() > Date.now() + IST) {
    res.status(400);
    throw new Error("Future-dated revisions are not supported. Use today or an earlier date.");
  }
  const unchangedSalary = salary === (Number(employee.salary) || 0);
  const unchangedDesignation =
    !designation || designation.trim() === (employee.designation || "");
  if (unchangedSalary && unchangedDesignation) {
    res.status(400);
    throw new Error("Nothing to change: the salary is the same as the current one");
  }

  const revision = await recordRevision({
    employee,
    newSalary: salary,
    reason: String(reason).trim(),
    designation,
    remarks,
    effectiveDate: when,
    user: req.user,
  });

  logAudit(req, "salary.revised", "Employee", employee._id, {
    from: revision.previousSalary,
    to: revision.newSalary,
    reason: revision.reason,
    designation: revision.newDesignation,
  });
  if (revision.changeAmount > 0) {
    notifyEmployee(employee, {
      company: employee.company,
      type: "promotion",
      title:
        revision.kind === "promotion"
          ? "Congratulations on your promotion! 🎉"
          : "Your salary has been revised 🎉",
      body: `${revision.reason}. See My Profile → Growth for details.`,
    });
  }
  res.status(201).json({ success: true, data: revision });
});

// GET /api/promotions  (admin / HR) — newest first. ?employee=&month=&year=
const getRevisions = asyncHandler(async (req, res) => {
  const filter = { company: req.user.company };
  if (req.query.employee) filter.employee = req.query.employee;
  const m = parseInt(req.query.month),
    y = parseInt(req.query.year);
  if (!isNaN(y)) {
    const from = !isNaN(m) ? new Date(Date.UTC(y, m - 1, 1) - IST) : new Date(Date.UTC(y, 0, 1) - IST);
    const to = !isNaN(m) ? new Date(Date.UTC(y, m, 1) - IST) : new Date(Date.UTC(y + 1, 0, 1) - IST);
    filter.effectiveDate = { $gte: from, $lt: to };
  }
  const rows = await SalaryRevision.find(filter)
    .populate({
      path: "employee",
      select: "firstName lastName employeeId designation avatar department",
      populate: { path: "department", select: "name" },
    })
    .sort({ effectiveDate: -1, createdAt: -1 })
    .limit(500)
    .lean();
  res.json({ success: true, data: rows });
});

// GET /api/promotions/my — the signed-in employee's own growth (reason + designation, never internal remarks)
const getMyRevisions = asyncHandler(async (req, res) => {
  const employee = await Employee.findOne({
    user: req.user._id,
    company: req.user.company,
  })
    .select("firstName lastName salary designation joinDate")
    .lean();
  if (!employee) {
    res.status(404);
    throw new Error("Employee profile not found");
  }
  const revisions = await SalaryRevision.find({ employee: employee._id })
    .select("-remarks -createdBy -createdByName -company")
    .sort({ effectiveDate: 1, createdAt: 1 })
    .lean();
  const startSalary = revisions.length ? revisions[0].previousSalary : employee.salary;
  res.json({
    success: true,
    data: {
      currentSalary: employee.salary,
      currentDesignation: employee.designation,
      joinDate: employee.joinDate,
      startSalary,
      totalGrowthAmount: employee.salary - startSalary,
      totalGrowthPct: startSalary > 0 ? round1(((employee.salary - startSalary) / startSalary) * 100) : 0,
      revisions,
    },
  });
});

// GET /api/promotions/report?month=&year=  (admin / HR)
// For every employee employed that month: salary at the start vs end of the month, and what changed.
const getMonthlyReport = asyncHandler(async (req, res) => {
  const m = parseInt(req.query.month),
    y = parseInt(req.query.year);
  if (isNaN(m) || isNaN(y) || m < 1 || m > 12) {
    res.status(400);
    throw new Error("Valid month and year are required");
  }
  const start = new Date(Date.UTC(y, m - 1, 1) - IST); // 00:00 IST on the 1st
  const end = new Date(Date.UTC(y, m, 1) - IST - 1); // 23:59:59.999 IST on the last day

  const employees = await Employee.find({
    company: req.user.company,
    status: { $nin: ["terminated", "exited"] },
    $or: [{ joinDate: { $exists: false } }, { joinDate: null }, { joinDate: { $lte: end } }],
  })
    .select("firstName lastName employeeId designation salary department joinDate")
    .populate("department", "name")
    .lean();

  const revs = await SalaryRevision.find({
    company: req.user.company,
    employee: { $in: employees.map((e) => e._id) },
  })
    .sort({ effectiveDate: 1, createdAt: 1 })
    .lean();
  const byEmp = new Map();
  for (const r of revs) {
    const k = String(r.employee);
    if (!byEmp.has(k)) byEmp.set(k, []);
    byEmp.get(k).push(r);
  }

  // Salary in force at time t: last revision on/before t; before any revision: the first revision's "previous"; no history: current.
  const salaryAt = (e, list, t) => {
    if (!list.length) return e.salary || 0;
    let cur = null;
    for (const r of list) if (r.effectiveDate <= t) cur = r;
    return cur ? cur.newSalary : list[0].previousSalary;
  };

  const rows = employees.map((e) => {
    const list = byEmp.get(String(e._id)) || [];
    const opening = salaryAt(e, list, new Date(start.getTime() - 1));
    const closing = salaryAt(e, list, end);
    const inMonth = list.filter((r) => r.effectiveDate >= start && r.effectiveDate <= end);
    const change = closing - opening;
    const promoted = inMonth.find((r) => r.newDesignation);
    return {
      employeeId: e._id,
      code: e.employeeId,
      name: fullName(e),
      department: e.department?.name || "",
      designation: promoted ? promoted.newDesignation : e.designation,
      previousDesignation: promoted ? promoted.previousDesignation : undefined,
      openingSalary: opening,
      closingSalary: closing,
      change,
      changePct: opening > 0 ? round1((change / opening) * 100) : 0,
      status: change > 0 ? "increased" : change < 0 ? "decreased" : "no_change",
      reasons: inMonth.map((r) => r.reason),
      lastChangeDate: inMonth.length ? inMonth[inMonth.length - 1].effectiveDate : null,
    };
  });
  rows.sort(
    (a, b) =>
      (b.status === "increased") - (a.status === "increased") ||
      b.change - a.change ||
      a.name.localeCompare(b.name),
  );

  const increased = rows.filter((r) => r.status === "increased");
  const decreased = rows.filter((r) => r.status === "decreased");
  const totalOpening = rows.reduce((s, r) => s + r.openingSalary, 0);
  const totalClosing = rows.reduce((s, r) => s + r.closingSalary, 0);
  res.json({
    success: true,
    data: {
      month: m,
      year: y,
      summary: {
        employees: rows.length,
        increased: increased.length,
        noChange: rows.length - increased.length - decreased.length,
        decreased: decreased.length,
        promotions: rows.filter((r) => r.previousDesignation).length,
        totalIncrease: increased.reduce((s, r) => s + r.change, 0),
        avgIncreasePct: increased.length
          ? round1(increased.reduce((s, r) => s + r.changePct, 0) / increased.length)
          : 0,
        monthlyPayrollBefore: totalOpening,
        monthlyPayrollAfter: totalClosing,
      },
      rows,
    },
  });
});

module.exports = {
  recordRevision,
  createRevision,
  getRevisions,
  getMyRevisions,
  getMonthlyReport,
};

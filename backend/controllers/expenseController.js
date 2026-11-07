const path = require("path");
const fs = require("fs");
const asyncHandler = require("express-async-handler");
const Expense = require("../models/Expense");
const ApprovalWorkflow = require("../models/ApprovalWorkflow");
const Employee = require("../models/Employee");
const Transaction = require("../models/Transaction");
const { validateMagicBytes } = require("../middleware/upload");

const BILL_DIR = path.join(__dirname, "../uploads/expense-bills");
const ROLES = ["department_head", "hr_manager", "super_admin"];

async function selfEmployee(req) {
  return Employee.findOne({ user: req.user._id, company: req.user.company });
}

async function stepsFor(company, amount) {
  const wf = await ApprovalWorkflow.findOne({ company, type: "expense" }).lean();
  const steps = (wf?.steps?.length ? wf.steps : [{ role: "hr_manager" }])
    .filter((s) => amount >= (s.aboveAmount || 0))
    .map((s) => ({ role: s.role }));
  return steps.length ? steps : [{ role: "hr_manager" }];
}

// Can this user act on the claim's current step?
function canAct(user, expense, empDept) {
  if (expense.status !== "pending") return false;
  const step = expense.steps.find((s) => s.status === "pending");
  if (!step) return false;
  if (user.role === "super_admin") return true;
  if (user.role !== step.role) return false;
  if (step.role === "department_head")
    return !!user.department && String(user.department) === String(empDept);
  return true;
}

// Approved claims become a pending "allowance" transaction, which payroll already adds to gross.
// Once payroll has applied the transaction the claim shows as paid.
async function syncPaid(company) {
  const approved = await Expense.find({
    company,
    status: "approved",
    transaction: { $ne: null },
  })
    .select("transaction")
    .lean();
  if (!approved.length) return;
  const applied = await Transaction.find({
    _id: { $in: approved.map((e) => e.transaction) },
    status: "applied",
  })
    .select("_id")
    .lean();
  if (applied.length)
    await Expense.updateMany(
      { transaction: { $in: applied.map((t) => t._id) } },
      { status: "paid" },
    );
}

const getExpenses = asyncHandler(async (req, res) => {
  await syncPaid(req.user.company);
  const filter = { company: req.user.company };
  if (req.user.role === "employee") {
    const emp = await selfEmployee(req);
    if (!emp) {
      res.status(404);
      throw new Error("Employee record not found for your account");
    }
    filter.employee = emp._id;
  }
  if (req.query.status) filter.status = String(req.query.status);
  let rows = await Expense.find(filter)
    .sort({ createdAt: -1 })
    .limit(500)
    .populate("employee", "firstName lastName employeeId department")
    .lean();
  if (req.user.role === "department_head")
    rows = rows.filter(
      (r) => String(r.employee?.department) === String(req.user.department),
    );
  res.json({
    success: true,
    data: rows.map((r) => ({
      ...r,
      hasBill: !!r.bill,
      bill: undefined,
      canAct: canAct(req.user, r, r.employee?.department),
    })),
  });
});

const createExpense = asyncHandler(async (req, res) => {
  const drop = () => req.file && fs.unlink(req.file.path, () => {});
  const emp = await selfEmployee(req);
  if (!emp) {
    drop();
    res.status(404);
    throw new Error("Employee record not found for your account");
  }
  const amount = Number(req.body.amount);
  const date = new Date(req.body.date);
  const title = (req.body.title || "").trim();
  if (!title || !(amount > 0) || isNaN(date) || date > new Date()) {
    drop();
    res.status(400);
    throw new Error("Title, a valid amount and a past date are required");
  }
  if (req.file) await validateMagicBytes(req.file.path); // throws + deletes file if invalid
  const expense = await Expense.create({
    company: req.user.company,
    employee: emp._id,
    title: title.slice(0, 120),
    category: req.body.category,
    amount,
    date,
    notes: (req.body.notes || "").slice(0, 500),
    bill: req.file ? req.file.filename : "",
    steps: await stepsFor(req.user.company, amount),
  });
  res.status(201).json({ success: true, data: expense });
});

const actOnExpense = asyncHandler(async (req, res) => {
  const { action, note } = req.body;
  if (!["approve", "reject"].includes(action)) {
    res.status(400);
    throw new Error("action must be approve or reject");
  }
  const expense = await Expense.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!expense) {
    res.status(404);
    throw new Error("Claim not found");
  }
  const emp = await Employee.findById(expense.employee).select("department user");
  if (emp && String(emp.user) === String(req.user._id)) {
    res.status(403);
    throw new Error("You cannot approve your own claim");
  }
  if (!canAct(req.user, expense, emp?.department)) {
    res.status(403);
    throw new Error("This claim is not waiting for your approval");
  }
  const step = expense.steps.find((s) => s.status === "pending");
  step.status = action === "approve" ? "approved" : "rejected";
  step.by = req.user._id;
  step.at = new Date();
  step.note = (note || "").slice(0, 300);
  if (action === "reject") expense.status = "rejected";
  else if (expense.steps.every((s) => s.status === "approved")) {
    expense.status = "approved";
    const tx = await Transaction.create({
      company: expense.company,
      employee: expense.employee,
      type: "allowance",
      amount: expense.amount,
      date: new Date(),
      remark: `Reimbursement: ${expense.title}`,
    });
    expense.transaction = tx._id;
  }
  await expense.save();
  res.json({ success: true, data: expense });
});

const deleteExpense = asyncHandler(async (req, res) => {
  const emp = await selfEmployee(req);
  const expense = await Expense.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!expense || !emp || String(expense.employee) !== String(emp._id)) {
    res.status(404);
    throw new Error("Claim not found");
  }
  if (expense.status !== "pending" || expense.steps.some((s) => s.status !== "pending")) {
    res.status(400);
    throw new Error("Only untouched pending claims can be withdrawn");
  }
  if (expense.bill)
    fs.unlink(path.join(BILL_DIR, path.basename(expense.bill)), () => {});
  await expense.deleteOne();
  res.json({ success: true });
});

const downloadBill = asyncHandler(async (req, res) => {
  const expense = await Expense.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!expense || !expense.bill) {
    res.status(404);
    throw new Error("Bill not found");
  }
  if (req.user.role === "employee") {
    const emp = await selfEmployee(req);
    if (!emp || String(expense.employee) !== String(emp._id)) {
      res.status(403);
      throw new Error("Not allowed");
    }
  }
  res.sendFile(path.join(BILL_DIR, path.basename(expense.bill)));
});

const getWorkflow = asyncHandler(async (req, res) => {
  const wf = await ApprovalWorkflow.findOne({
    company: req.user.company,
    type: "expense",
  }).lean();
  res.json({
    success: true,
    data: wf?.steps || [{ role: "hr_manager", aboveAmount: 0 }],
  });
});

const saveWorkflow = asyncHandler(async (req, res) => {
  const steps = Array.isArray(req.body.steps) ? req.body.steps : [];
  if (!steps.length || steps.length > 4 || steps.some((s) => !ROLES.includes(s.role))) {
    res.status(400);
    throw new Error("Add 1-4 steps, each with a valid approver role");
  }
  const clean = steps.map((s) => ({
    role: s.role,
    aboveAmount: Math.max(0, Number(s.aboveAmount) || 0),
  }));
  const wf = await ApprovalWorkflow.findOneAndUpdate(
    { company: req.user.company, type: "expense" },
    { steps: clean },
    { upsert: true, new: true },
  );
  res.json({ success: true, data: wf.steps });
});

module.exports = {
  getExpenses,
  createExpense,
  actOnExpense,
  deleteExpense,
  downloadBill,
  getWorkflow,
  saveWorkflow,
};

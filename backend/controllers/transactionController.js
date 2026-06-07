const asyncHandler = require("express-async-handler");
const Transaction = require("../models/Transaction");
const Employee = require("../models/Employee");

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

  let finalAmount = Number(amount) || 0;
  let finalHours = 0;

  if (type === "overtime") {
    if (!hours || Number(hours) <= 0) {
      res.status(400);
      throw new Error("hours is required for overtime");
    }
    finalHours = Number(hours);
    // Auto-calculate from employee's otRate if amount not provided
    if (!finalAmount) {
      const emp = await Employee.findById(employee);
      finalAmount = finalHours * (emp?.otRate || 0);
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
  const populated = await Transaction.findById(transaction._id).populate(
    "employee",
    "firstName lastName employeeId otRate",
  );
  res.status(201).json({ success: true, data: populated });
});

const updateTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    req.body,
    { new: true },
  ).populate("employee", "firstName lastName employeeId");
  if (!transaction) {
    res.status(404);
    throw new Error("Transaction not found");
  }
  res.json({ success: true, data: transaction });
});

const deleteTransaction = asyncHandler(async (req, res) => {
  await Transaction.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  res.json({ success: true, message: "Deleted" });
});

module.exports = {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};

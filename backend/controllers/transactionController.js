const asyncHandler = require("express-async-handler");
const Transaction = require("../models/Transaction");

const getTransactions = asyncHandler(async (req, res) => {
  const { employee, type } = req.query;
  const filter = { company: req.user.company };
  if (employee) filter.employee = employee;
  if (type) filter.type = type;
  const transactions = await Transaction.find(filter)
    .populate("employee", "firstName lastName employeeId")
    .sort({ date: -1 });
  res.json({ success: true, data: transactions });
});

const createTransaction = asyncHandler(async (req, res) => {
  const { employee, type, amount, date, remark } = req.body;
  if (!employee || !type || !amount || !date) {
    res.status(400);
    throw new Error("employee, type, amount and date are required");
  }
  const transaction = await Transaction.create({
    company: req.user.company,
    employee,
    type,
    amount: Number(amount),
    date: new Date(date),
    remark: remark || "",
  });
  const populated = await Transaction.findById(transaction._id).populate(
    "employee",
    "firstName lastName employeeId",
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

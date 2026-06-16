const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Loan = require("../models/Loan");
const Employee = require("../models/Employee");

async function syncLoanBalance(employeeId) {
  const empObjId = new mongoose.Types.ObjectId(String(employeeId));
  const result = await Loan.aggregate([
    { $match: { employee: empObjId, status: "active" } },
    { $group: { _id: null, total: { $sum: "$remainingBalance" } } },
  ]);
  const total = result[0]?.total ?? 0;
  await Employee.findByIdAndUpdate(employeeId, { loanBalance: total });
}

const getLoans = asyncHandler(async (req, res) => {
  const { employee } = req.query;
  const filter = { company: req.user.company };
  if (employee) filter.employee = employee;
  const loans = await Loan.find(filter)
    .populate("employee", "firstName lastName employeeId department avatar")
    .sort({ createdAt: -1 });
  res.json({ success: true, data: loans });
});

const createLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.create({
    ...req.body,
    company: req.user.company,
    remainingBalance: req.body.amount,
  });
  await syncLoanBalance(loan.employee);
  const populated = await Loan.findById(loan._id).populate(
    "employee",
    "firstName lastName employeeId avatar",
  );
  res.status(201).json({ success: true, data: populated });
});

const updateLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    req.body,
    { new: true },
  ).populate("employee", "firstName lastName employeeId avatar");
  if (!loan)
    return res.status(404).json({ success: false, message: "Loan not found" });
  await syncLoanBalance(loan.employee._id);
  res.json({ success: true, data: loan });
});

const deleteLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  if (loan) await syncLoanBalance(loan.employee);
  res.json({ success: true, message: "Deleted" });
});

module.exports = { getLoans, createLoan, updateLoan, deleteLoan };

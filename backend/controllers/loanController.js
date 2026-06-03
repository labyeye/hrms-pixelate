const asyncHandler = require("express-async-handler");
const Loan = require("../models/Loan");

const getLoans = asyncHandler(async (req, res) => {
  const { employee } = req.query;
  const filter = { company: req.user.company };
  if (employee) filter.employee = employee;
  const loans = await Loan.find(filter)
    .populate("employee", "firstName lastName employeeId department")
    .sort({ createdAt: -1 });
  res.json({ success: true, data: loans });
});

const createLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.create({
    ...req.body,
    company: req.user.company,
    remainingBalance: req.body.amount,
  });
  const populated = await Loan.findById(loan._id).populate(
    "employee",
    "firstName lastName employeeId",
  );
  res.status(201).json({ success: true, data: populated });
});

const updateLoan = asyncHandler(async (req, res) => {
  const loan = await Loan.findOneAndUpdate(
    { _id: req.params.id, company: req.user.company },
    req.body,
    { new: true },
  ).populate("employee", "firstName lastName employeeId");
  if (!loan)
    return res.status(404).json({ success: false, message: "Loan not found" });
  res.json({ success: true, data: loan });
});

const deleteLoan = asyncHandler(async (req, res) => {
  await Loan.findOneAndDelete({
    _id: req.params.id,
    company: req.user.company,
  });
  res.json({ success: true, message: "Deleted" });
});

module.exports = { getLoans, createLoan, updateLoan, deleteLoan };

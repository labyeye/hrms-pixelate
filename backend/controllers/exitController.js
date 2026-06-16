const asyncHandler = require("express-async-handler");
const ExitManagement = require("../models/ExitManagement");
const Employee = require("../models/Employee");
const { safePagination } = require("../middleware/validate");
const { logAudit } = require("../utils/auditLogger");

const getExits = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { status } = req.query;
  const filter = { company: req.user.company };
  if (status) filter.status = status;

  const total = await ExitManagement.countDocuments(filter);
  const exits = await ExitManagement.find(filter)
    .populate({
      path: "employee",
      select: "firstName lastName employeeId designation",
      populate: { path: "department", select: "name" },
    })
    .populate("initiatedBy", "name")
    .populate("approvedBy", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: exits,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

const getExit = asyncHandler(async (req, res) => {
  const exit = await ExitManagement.findOne({
    _id: req.params.id,
    company: req.user.company,
  })
    .populate({
      path: "employee",
      select: "firstName lastName employeeId designation",
      populate: { path: "department", select: "name" },
    })
    .populate("initiatedBy", "name")
    .populate("approvedBy", "name");
  if (!exit) {
    res.status(404);
    throw new Error("Exit record not found");
  }
  res.json({ success: true, data: exit });
});

const createExit = asyncHandler(async (req, res) => {
  const { employee, resignationDate, noticePeriodDays, reason, reasonDetails } =
    req.body;

  if (!employee || !resignationDate || !reason) {
    res.status(400);
    throw new Error("employee, resignationDate, and reason are required");
  }

  const emp = await Employee.findOne({
    _id: employee,
    company: req.user.company,
  });
  if (!emp) {
    res.status(404);
    throw new Error("Employee not found");
  }

  const existing = await ExitManagement.findOne({
    employee,
    status: { $in: ["pending", "notice_period"] },
  });
  if (existing) {
    res.status(400);
    throw new Error("An active exit process already exists for this employee");
  }

  const notice = parseInt(noticePeriodDays) || 30;
  const resDate = new Date(resignationDate);
  const lastDay = new Date(resDate);
  lastDay.setDate(lastDay.getDate() + notice);

  const exit = await ExitManagement.create({
    company: req.user.company,
    employee,
    resignationDate: resDate,
    lastWorkingDay: lastDay,
    noticePeriodDays: notice,
    reason,
    reasonDetails: reasonDetails?.trim().slice(0, 1000),
    initiatedBy: req.user._id,
  });

  await logAudit(req, "exit_initiated", "ExitManagement", exit._id, {
    employeeId: emp.employeeId,
    employeeName: `${emp.firstName} ${emp.lastName}`,
    resignationDate,
  });

  res.status(201).json({ success: true, data: exit });
});

const updateExit = asyncHandler(async (req, res) => {
  const exit = await ExitManagement.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!exit) {
    res.status(404);
    throw new Error("Exit record not found");
  }

  const allowed = [
    "status",
    "exitInterviewDone",
    "exitInterviewNotes",
    "assetsReturned",
    "assetsList",
    "fnfAmount",
    "fnfStatus",
    "fnfPaidDate",
    "fnfBreakdown",
    "experienceLetterIssued",
    "experienceLetterDate",
    "lastWorkingDay",
    "reasonDetails",
  ];

  for (const key of allowed) {
    if (req.body[key] !== undefined) exit[key] = req.body[key];
  }

  if (req.body.status === "completed" && !exit.approvedBy) {
    exit.approvedBy = req.user._id;
    exit.approvedAt = new Date();
  }

  await exit.save();

  await logAudit(req, "exit_updated", "ExitManagement", exit._id, {
    status: exit.status,
  });

  res.json({ success: true, data: exit });
});

const deleteExit = asyncHandler(async (req, res) => {
  const exit = await ExitManagement.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!exit) {
    res.status(404);
    throw new Error("Exit record not found");
  }
  await exit.deleteOne();
  res.json({ success: true, message: "Exit record deleted" });
});

module.exports = { getExits, getExit, createExit, updateExit, deleteExit };

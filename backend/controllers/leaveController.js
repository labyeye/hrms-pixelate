const asyncHandler = require("express-async-handler");
const Leave = require("../models/Leave");
const Employee = require("../models/Employee");
const User = require("../models/User");
const { safePagination } = require("../middleware/validate");
const {
  sendWhatsApp,
  leaveApprovedMsg,
  leaveRejectedMsg,
  leaveAppliedHRMsg,
} = require("../services/whatsappService");

const LEAVE_TYPES = [
  "casual",
  "sick",
  "earned",
  "maternity",
  "paternity",
  "unpaid",
  "compensatory",
];
const LEAVE_STATUS = ["pending", "approved", "rejected", "cancelled"];

const getLeaves = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { status, employeeId, leaveType, year, department } = req.query;

  if (req.user.role === "employee") {
    const selfEmp = await Employee.findOne({ user: req.user._id }).select(
      "_id",
    );
    if (!selfEmp) return res.json({ success: true, data: [], total: 0 });
    const filter = { company: req.user.company, employee: selfEmp._id };
    if (status && LEAVE_STATUS.includes(status)) filter.status = status;
    if (leaveType && LEAVE_TYPES.includes(leaveType))
      filter.leaveType = leaveType;
    if (year) {
      const y = parseInt(year);
      if (!isNaN(y))
        filter.startDate = {
          $gte: new Date(`${y}-01-01`),
          $lte: new Date(`${y}-12-31`),
        };
    }
    const total = await Leave.countDocuments(filter);
    const leaves = await Leave.find(filter)
      .populate({
        path: "employee",
        select: "firstName lastName employeeId designation phone",
        populate: { path: "department", select: "name" },
      })
      .populate("approvedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    return res.json({
      success: true,
      data: leaves,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  }

  const companyEmployees = await Employee.find({
    company: req.user.company,
  }).select("_id");
  const companyEmpIds = companyEmployees.map((e) => e._id);
  const filter = {
    company: req.user.company,
    employee: { $in: companyEmpIds },
  };

  if (status && LEAVE_STATUS.includes(status)) filter.status = status;
  if (leaveType && LEAVE_TYPES.includes(leaveType))
    filter.leaveType = leaveType;

  if (year) {
    const y = parseInt(year);
    if (!isNaN(y)) {
      filter.startDate = {
        $gte: new Date(`${y}-01-01`),
        $lte: new Date(`${y}-12-31`),
      };
    }
  }

  if (employeeId) {
    if (!companyEmpIds.some((id) => id.toString() === employeeId)) {
      return res.json({ success: true, data: [], total: 0 });
    }
    filter.employee = employeeId;
  } else if (department) {
    const empIds = await Employee.find({
      company: req.user.company,
      department,
    }).distinct("_id");
    filter.employee = { $in: empIds };
  }

  const total = await Leave.countDocuments(filter);
  const leaves = await Leave.find(filter)
    .populate({
      path: "employee",
      select: "firstName lastName employeeId designation phone",
      populate: { path: "department", select: "name" },
    })
    .populate("approvedBy", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: leaves,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

const createLeave = asyncHandler(async (req, res) => {
  let {
    employee,
    leaveType,
    startDate,
    endDate,
    days,
    reason,
    isHalfDay,
    halfDayType,
  } = req.body;

  let emp;
  if (req.user.role === "employee") {
    emp = await Employee.findOne({ user: req.user._id });
    if (!emp) {
      res.status(404);
      throw new Error("Employee record not found for your account");
    }
    employee = emp._id;
  } else {
    emp = await Employee.findOne({
      _id: employee,
      company: req.user.company,
    });
    if (!emp) {
      res.status(404);
      throw new Error("Employee not found");
    }
  }

  if (!leaveType || !LEAVE_TYPES.includes(leaveType)) {
    res.status(400);
    throw new Error("Invalid leave type");
  }
  if (!startDate || !endDate || !days || !reason) {
    res.status(400);
    throw new Error("startDate, endDate, days, and reason are required");
  }
  if (typeof reason === "string" && reason.trim().length > 500) {
    res.status(400);
    throw new Error("Reason must be under 500 characters");
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    res.status(400);
    throw new Error("Invalid date range");
  }
  const daysNum = Number(days);
  if (isNaN(daysNum) || daysNum <= 0 || daysNum > 365) {
    res.status(400);
    throw new Error("Invalid days value");
  }

  const overlap = await Leave.findOne({
    employee,
    status: { $in: ["pending", "approved"] },
    startDate: { $lte: end },
    endDate: { $gte: start },
  });
  if (overlap) {
    res.status(400);
    throw new Error(
      "Employee already has a leave request overlapping these dates",
    );
  }

  const leave = await Leave.create({
    company: req.user.company,
    employee,
    leaveType,
    startDate: start,
    endDate: end,
    days: daysNum,
    reason: reason.trim(),
    isHalfDay: !!isHalfDay,
    halfDayType: isHalfDay ? halfDayType : undefined,
  });

  try {
    const hrUsers = await User.find({
      company: req.user.company,
      role: { $in: ["super_admin", "hr_manager"] },
    }).select("phone");
    for (const hr of hrUsers) {
      if (hr.phone)
        await sendWhatsApp(
          hr.phone,
          leaveAppliedHRMsg(hr, emp, leave),
          "whatsappNotifyLeave",
          req.user.company,
        );
    }
  } catch {}

  res.status(201).json({ success: true, data: leave });
});

const updateLeaveStatus = asyncHandler(async (req, res) => {
  const { status, rejectionReason } = req.body;

  if (!status || !LEAVE_STATUS.includes(status)) {
    res.status(400);
    throw new Error("Invalid status value");
  }

  const leave = await Leave.findOne({
    _id: req.params.id,
    company: req.user.company,
  }).populate("employee", "firstName lastName employeeId phone");
  if (!leave) {
    res.status(404);
    throw new Error("Leave not found");
  }

  leave.status = status;
  if (status === "approved") {
    leave.approvedBy = req.user._id;
    leave.approvedAt = new Date();
  }
  if (status === "rejected") {
    if (rejectionReason && typeof rejectionReason === "string") {
      leave.rejectionReason = rejectionReason.trim().slice(0, 500);
    }
  }
  await leave.save();

  if (leave.employee?.phone) {
    try {
      if (status === "approved") {
        await sendWhatsApp(
          leave.employee.phone,
          leaveApprovedMsg(leave.employee, leave),
          "whatsappNotifyLeave",
          req.user.company,
        );
      } else if (status === "rejected") {
        await sendWhatsApp(
          leave.employee.phone,
          leaveRejectedMsg(leave.employee, leave, rejectionReason),
          "whatsappNotifyLeave",
          req.user.company,
        );
      }
    } catch {}
  }

  res.json({ success: true, data: leave });
});

const deleteLeave = asyncHandler(async (req, res) => {
  const leave = await Leave.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!leave) {
    res.status(404);
    throw new Error("Leave not found");
  }
  await leave.deleteOne();
  res.json({ success: true, message: "Leave deleted" });
});

module.exports = { getLeaves, createLeave, updateLeaveStatus, deleteLeave };

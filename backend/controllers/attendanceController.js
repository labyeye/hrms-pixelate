const asyncHandler = require("express-async-handler");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const Shift = require("../models/Shift");
const { isHolidayDate } = require("./holidayController");
const { safePagination } = require("../middleware/validate");
const { sendAttendanceStatus } = require("../services/whatsappService");

async function notifyAttendanceStatus(emp, date, status, companyId) {
  if (!emp?.phone) return;
  await sendAttendanceStatus(
    emp.phone,
    { firstName: emp.firstName, date, status },
    companyId,
  );
}

const GRACE_MINUTES = 15;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

async function resolveStatus(employeeId, checkIn, requestedStatus) {
  // Only auto-promote present → late; never override an explicit absent/leave/etc.
  if (!checkIn || requestedStatus !== "present") return requestedStatus;

  const emp = await Employee.findById(employeeId).select("shift");
  if (!emp?.shift) return requestedStatus;

  const shift = await Shift.findById(emp.shift).select("startTime");
  if (!shift?.startTime) return requestedStatus;

  const [shiftH, shiftM] = shift.startTime.split(":").map(Number);
  const shiftStartMinutes = shiftH * 60 + shiftM;

  // Convert stored UTC time → IST to compare against shift start (which is local IST)
  const checkInIST = new Date(new Date(checkIn).getTime() + IST_OFFSET_MS);
  const checkInMinutes =
    checkInIST.getUTCHours() * 60 + checkInIST.getUTCMinutes();

  return checkInMinutes > shiftStartMinutes + GRACE_MINUTES
    ? "late"
    : requestedStatus;
}

const getAttendance = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query, 50, 200);
  const { month, year, employeeId, department } = req.query;

  if (req.user.role === "employee") {
    let selfEmp = await Employee.findOne({ user: req.user._id }).select("_id");
    if (!selfEmp && req.user.email && req.user.company) {
      selfEmp = await Employee.findOne({
        email: req.user.email.toLowerCase(),
        company: req.user.company,
      }).select("_id");
      if (selfEmp) {
        await Employee.findByIdAndUpdate(selfEmp._id, { user: req.user._id });
      }
    }
    if (!selfEmp) return res.json({ success: true, data: [], total: 0 });
    const filter = { employee: selfEmp._id };
    if (month && year) {
      const m = parseInt(month),
        y = parseInt(year);
      if (!isNaN(m) && !isNaN(y))
        filter.date = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0) };
    }
    const total = await Attendance.countDocuments(filter);
    const records = await Attendance.find(filter)
      .populate({
        path: "employee",
        select: "firstName lastName employeeId designation department avatar",
        populate: { path: "department", select: "name" },
      })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);
    return res.json({
      success: true,
      data: records,
      total,
      page,
      pages: Math.ceil(total / limit),
    });
  }

  const companyEmployees = await Employee.find({
    company: req.user.company,
  }).select("_id");
  const companyEmpIds = companyEmployees.map((e) => e._id);

  const filter = { employee: { $in: companyEmpIds } };

  if (employeeId) {
    if (!companyEmpIds.some((id) => id.toString() === employeeId)) {
      return res.json({ success: true, data: [], total: 0 });
    }
    filter.employee = employeeId;
  }

  if (department) {
    const deptEmployees = await Employee.find({
      company: req.user.company,
      department,
    }).select("_id");
    filter.employee = { $in: deptEmployees.map((e) => e._id) };
  }

  if (month && year) {
    const m = parseInt(month),
      y = parseInt(year);
    if (!isNaN(m) && !isNaN(y)) {
      filter.date = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0) };
    }
  }

  const total = await Attendance.countDocuments(filter);
  const records = await Attendance.find(filter)
    .populate({
      path: "employee",
      select: "firstName lastName employeeId designation department avatar",
      populate: { path: "department", select: "name" },
    })
    .sort({ date: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: records,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

const markAttendance = asyncHandler(async (req, res) => {
  const { employee, date, status, checkIn, checkOut, notes, verifyMode } =
    req.body;

  const emp = await Employee.findOne({
    _id: employee,
    company: req.user.company,
  });
  if (!emp) {
    res.status(404);
    throw new Error("Employee not found");
  }

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const holiday = await isHolidayDate(req.user.company, d);
  const computedStatus = holiday
    ? "holiday"
    : await resolveStatus(employee, checkIn, status);

  let workHours = 0;
  if (checkIn && checkOut && !holiday) {
    workHours = (new Date(checkOut) - new Date(checkIn)) / 3600000;
  }

  const record = await Attendance.findOneAndUpdate(
    { employee, date: d },
    {
      employee,
      date: d,
      status: computedStatus,
      checkIn: holiday ? undefined : checkIn,
      checkOut: holiday ? undefined : checkOut,
      workHours,
      verifyMode: verifyMode || "manual",
      notes: holiday ? `Holiday: ${holiday.name}` : notes || undefined,
      markedBy: req.user._id,
    },
    { upsert: true, new: true },
  ).populate({
    path: "employee",
    select: "firstName lastName employeeId designation department avatar phone",
    populate: { path: "department", select: "name" },
  });

  // Send WA notification for actionable statuses (not holiday/weekend/on_leave)
  await notifyAttendanceStatus(record.employee, d, computedStatus, req.user.company);

  res.json({ success: true, data: record });
});

const updateAttendance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, checkIn, checkOut, notes, overtime, date, verifyMode } =
    req.body;

  const companyEmployees = await Employee.find({
    company: req.user.company,
  }).select("_id");
  const companyEmpIds = new Set(companyEmployees.map((e) => e._id.toString()));

  const record = await Attendance.findById(id).populate("employee", "_id");
  if (!record || !companyEmpIds.has(record.employee._id.toString())) {
    res.status(404);
    throw new Error("Attendance record not found");
  }

  if (date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    record.date = d;
  }
  if (checkIn !== undefined)
    record.checkIn = checkIn ? new Date(checkIn) : undefined;
  if (checkOut !== undefined)
    record.checkOut = checkOut ? new Date(checkOut) : undefined;
  if (notes !== undefined) record.notes = notes;
  if (overtime !== undefined) record.overtime = parseFloat(overtime) || 0;
  if (verifyMode !== undefined) record.verifyMode = verifyMode;

  // If admin picked an explicit non-present status, honour it.
  // If status is "present" (or not sent), auto-resolve based on updated checkIn
  // so that a late punch correctly becomes "late".
  const explicitNonPresent = status !== undefined && status !== "present";
  if (explicitNonPresent) {
    record.status = status;
  } else if (record.checkIn) {
    record.status = await resolveStatus(
      record.employee._id,
      record.checkIn,
      "present",
    );
  } else if (status !== undefined) {
    record.status = status;
  }

  if (record.checkIn && record.checkOut) {
    record.workHours = parseFloat(
      ((record.checkOut - record.checkIn) / 3_600_000).toFixed(2),
    );
  }

  record.markedBy = req.user._id;
  await record.save();

  await record.populate({
    path: "employee",
    select: "firstName lastName employeeId designation department avatar phone",
    populate: { path: "department", select: "name" },
  });

  await notifyAttendanceStatus(record.employee, record.date, record.status, req.user.company);

  res.json({ success: true, data: record });
});

const bulkMarkAttendance = asyncHandler(async (req, res) => {
  const { date, records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    res.status(400);
    throw new Error("records must be a non-empty array");
  }
  if (records.length > 500) {
    res.status(400);
    throw new Error("Cannot bulk mark more than 500 records at once");
  }

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);

  const holiday = await isHolidayDate(req.user.company, d);

  const companyEmployees = await Employee.find({
    company: req.user.company,
  }).select("_id");
  const companyEmpSet = new Set(companyEmployees.map((e) => e._id.toString()));
  const filteredRecords = records.filter(
    (r) => r.employee && companyEmpSet.has(r.employee.toString()),
  );

  const ops = filteredRecords.map((r) => ({
    updateOne: {
      filter: { employee: r.employee, date: d },
      update: {
        $set: {
          status: holiday ? "holiday" : r.status,
          checkIn: holiday ? undefined : r.checkIn,
          checkOut: holiday ? undefined : r.checkOut,
          notes: holiday ? `Holiday: ${holiday.name}` : undefined,
          markedBy: req.user._id,
        },
      },
      upsert: true,
    },
  }));

  if (ops.length > 0) await Attendance.bulkWrite(ops);
  res.json({
    success: true,
    message: holiday
      ? `Marked as holiday: ${holiday.name}`
      : "Attendance marked",
  });
});

const getMonthSummary = asyncHandler(async (req, res) => {
  const { month, year } = req.query;
  const m = parseInt(month),
    y = parseInt(year);
  if (isNaN(m) || isNaN(y)) {
    res.status(400);
    throw new Error("Valid month and year are required");
  }

  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);

  const companyEmployees = await Employee.find({
    company: req.user.company,
  }).select("_id");
  const companyEmpIds = companyEmployees.map((e) => e._id);

  const summary = await Attendance.aggregate([
    {
      $match: {
        employee: { $in: companyEmpIds },
        date: { $gte: start, $lte: end },
      },
    },
    { $group: { _id: "$status", count: { $sum: 1 } } },
  ]);

  res.json({ success: true, data: summary });
});

module.exports = {
  getAttendance,
  markAttendance,
  updateAttendance,
  bulkMarkAttendance,
  getMonthSummary,
};

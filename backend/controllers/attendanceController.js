const asyncHandler = require("express-async-handler");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const { isHolidayDate } = require("./holidayController");
const { safePagination, validateMongoId } = require("../middleware/validate");

const getAttendance = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query, 50, 200);
  const { month, year, employeeId, department } = req.query;

  // If the requesting user is an employee, scope to only their own records
  if (req.user.role === "employee") {
    const selfEmp = await Employee.findOne({ user: req.user._id }).select(
      "_id",
    );
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
        select: "firstName lastName employeeId department",
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

  // Company-scope: only employees belonging to this company
  const companyEmployees = await Employee.find({
    company: req.user.company,
  }).select("_id");
  const companyEmpIds = companyEmployees.map((e) => e._id);

  const filter = { employee: { $in: companyEmpIds } };

  if (employeeId) {
    // Ensure the requested employee belongs to this company
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
      select: "firstName lastName employeeId department",
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
  const { employee, date, status, checkIn, checkOut, notes } = req.body;

  // Verify employee belongs to this company
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
  const finalStatus = holiday ? "holiday" : status;

  let workHours = 0;
  if (checkIn && checkOut && !holiday) {
    workHours = (new Date(checkOut) - new Date(checkIn)) / 3600000;
  }

  const record = await Attendance.findOneAndUpdate(
    { employee, date: d },
    {
      employee,
      date: d,
      status: finalStatus,
      checkIn: holiday ? undefined : checkIn,
      checkOut: holiday ? undefined : checkOut,
      workHours,
      notes: holiday ? `Holiday: ${holiday.name}` : notes || undefined,
      markedBy: req.user._id,
    },
    { upsert: true, new: true },
  ).populate({
    path: "employee",
    select: "firstName lastName employeeId department",
    populate: { path: "department", select: "name" },
  });

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

  // Verify all employee IDs belong to this company
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

  // Company-scoped aggregate
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
  bulkMarkAttendance,
  getMonthSummary,
};

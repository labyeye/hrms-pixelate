const asyncHandler = require("express-async-handler");
const Holiday = require("../models/Holiday");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const { safePagination } = require("../middleware/validate");

// Holiday.date is stored at UTC midnight of the chosen calendar day (same convention as the attendance auto-mark job).
const dayUTC = (d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
const holidayNote = (h) => `Holiday: ${h.name}`;

// Marks every working employee of the company as "holiday" (national holidays only) on that date. Real punches (a checkIn) are never touched.
async function markHolidayAttendance(holiday) {
  if (holiday.type !== "national") return 0; // optional / restricted holidays are chosen per employee
  const date = dayUTC(holiday.date);
  const emps = await Employee.find({
    company: holiday.company,
    status: { $in: ["active", "on_leave", "inactive"] },
    $and: [
      { $or: [{ joinDate: { $exists: false } }, { joinDate: null }, { joinDate: { $lte: date } }] },
      { $or: [{ exitDate: { $exists: false } }, { exitDate: null }, { exitDate: { $gte: date } }] },
    ],
  }).select("_id");
  if (!emps.length) return 0;
  const ids = emps.map((e) => e._id);
  const note = holidayNote(holiday);
  // existing blank rows (auto-marked absent / weekend) become holiday
  await Attendance.updateMany(
    { employee: { $in: ids }, date, checkIn: { $exists: false }, status: { $in: ["absent", "weekend", "holiday"] } },
    { $set: { status: "holiday", notes: note } },
  );
  // employees with no row yet get one (upsert never overwrites an existing row)
  await Attendance.bulkWrite(
    ids.map((employee) => ({
      updateOne: {
        filter: { employee, date },
        update: { $setOnInsert: { status: "holiday", notes: note, verifyMode: "auto" } },
        upsert: true,
      },
    })),
    { ordered: false },
  );
  return ids.length;
}

// Removes the auto-created holiday rows again (rows with a real punch or edited notes stay).
async function unmarkHolidayAttendance(holiday) {
  const emps = await Employee.find({ company: holiday.company }).select("_id");
  await Attendance.deleteMany({
    employee: { $in: emps.map((e) => e._id) },
    date: dayUTC(holiday.date),
    status: "holiday",
    checkIn: { $exists: false },
    notes: holidayNote(holiday),
  });
}

const HOLIDAY_TYPES = ["national", "optional", "restricted"];

const getHolidays = asyncHandler(async (req, res) => {
  const { limit, skip } = safePagination(req.query, 100, 400);
  const { year } = req.query;
  const filter = { company: req.user.company };

  if (year) {
    const y = parseInt(year);
    if (!isNaN(y)) {
      filter.date = {
        $gte: new Date(`${y}-01-01`),
        $lte: new Date(`${y}-12-31`),
      };
    }
  }

  const total = await Holiday.countDocuments(filter);
  const holidays = await Holiday.find(filter)
    .sort({ date: 1 })
    .skip(skip)
    .limit(limit);
  res.json({ success: true, data: holidays, total });
});

const createHoliday = asyncHandler(async (req, res) => {
  const { name, date, type, description } = req.body;

  if (
    !name ||
    typeof name !== "string" ||
    name.trim().length < 1 ||
    name.trim().length > 100
  ) {
    res.status(400);
    throw new Error("Holiday name is required (max 100 chars)");
  }
  if (!date || isNaN(new Date(date).getTime())) {
    res.status(400);
    throw new Error("Valid date is required");
  }

  const holiday = await Holiday.create({
    company: req.user.company,
    name: name.trim(),
    date: new Date(date),
    type: type && HOLIDAY_TYPES.includes(type) ? type : "national",
    description: description ? String(description).slice(0, 500) : undefined,
  });

  const marked = await markHolidayAttendance(holiday);
  res.status(201).json({ success: true, data: holiday, attendanceMarked: marked });
});

const updateHoliday = asyncHandler(async (req, res) => {
  const holiday = await Holiday.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!holiday) {
    res.status(404);
    throw new Error("Holiday not found");
  }

  const { name, date, type, description, isActive } = req.body;
  const before = { company: holiday.company, name: holiday.name, date: holiday.date };
  if (name !== undefined) holiday.name = String(name).trim().slice(0, 100);
  if (date !== undefined) {
    if (isNaN(new Date(date).getTime())) {
      res.status(400);
      throw new Error("Invalid date");
    }
    holiday.date = new Date(date);
  }
  if (type !== undefined && HOLIDAY_TYPES.includes(type)) holiday.type = type;
  if (description !== undefined)
    holiday.description = String(description).slice(0, 500);
  if (isActive !== undefined) holiday.isActive = !!isActive;

  await unmarkHolidayAttendance(before); // re-applied with the new date / name / active flag
  await holiday.save();
  if (holiday.isActive) await markHolidayAttendance(holiday);
  res.json({ success: true, data: holiday });
});

const deleteHoliday = asyncHandler(async (req, res) => {
  const holiday = await Holiday.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!holiday) {
    res.status(404);
    throw new Error("Holiday not found");
  }
  await unmarkHolidayAttendance(holiday);
  await holiday.deleteOne();
  res.json({ success: true, message: "Holiday deleted" });
});

const isHolidayDate = async (companyId, date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const next = new Date(d);
  next.setDate(next.getDate() + 1);
  return Holiday.findOne({
    company: companyId,
    date: { $gte: d, $lt: next },
    isActive: true,
  });
};

module.exports = {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  isHolidayDate,
};

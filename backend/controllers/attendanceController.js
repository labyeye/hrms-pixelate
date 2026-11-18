const asyncHandler = require("express-async-handler");
const fs = require("fs");
const Attendance = require("../models/Attendance");
const Employee = require("../models/Employee");
const Shift = require("../models/Shift");
const DeductionRule = require("../models/DeductionRule");
const AttendanceBalance = require("../models/AttendanceBalance");
const LateApproval = require("../models/LateApproval");
const { isHolidayDate } = require("./holidayController");
const { safePagination } = require("../middleware/validate");
const { sendAttendanceStatus, notifyHrPunch } = require("../services/whatsappService");
const { validateMagicBytes } = require("../middleware/upload");
const { verifyFace, enrollFace } = require("../services/faceService");
const { logAudit } = require("../utils/auditLogger");
const { notifyEmployee } = require("../services/inAppNotificationService");

const istTime = (d = new Date()) =>
  new Date(d).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  });
// In-app + push confirmation of a punch. kind: "check_in" | "check_out"
const notifyPunch = (emp, company, kind, at) =>
  notifyEmployee(emp, {
    company,
    type: kind,
    title: kind === "check_in" ? "Checked in" : "Checked out",
    body: `You ${kind === "check_in" ? "checked in" : "checked out"} at ${istTime(at)}`,
    data: { screen: "Attendance" },
  });

// Great-circle distance between two lat/lng points, in meters.
function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

// Returns an error message if `date` falls outside the employee's employment
// period (before joinDate or after exitDate), or null if it's in bounds.
function employmentBoundsError(emp, date) {
  if (emp.joinDate) {
    const jd = new Date(emp.joinDate);
    jd.setHours(0, 0, 0, 0);
    if (date < jd)
      return "Cannot mark attendance before the employee's join date";
  }
  if (emp.exitDate) {
    const ed = new Date(emp.exitDate);
    ed.setHours(0, 0, 0, 0);
    if (date > ed)
      return "Cannot mark attendance after the employee's exit date";
  }
  return null;
}

async function notifyAttendanceStatus(emp, date, status, companyId) {
  if (!emp?.phone) return;
  await sendAttendanceStatus(
    emp.phone,
    { firstName: emp.firstName, date, status },
    companyId,
  );
}

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

// Reads the company's configured grace period (falls back to 15 min if no
// DeductionRule exists yet). Queried per-call — no cross-request cache needed
// at this volume.
async function getGraceMinutes(companyId) {
  if (!companyId) return 15;
  const rule = await DeductionRule.findOne({ company: companyId }).select(
    "lateThresholdMinutes",
  );
  return rule?.lateThresholdMinutes ?? 15;
}

// Resolves the shift doc/subdoc (custom-per-employee or company Shift ref) to use
// for this employee, or null if none is configured.
async function resolveShift(emp) {
  if (emp.isCustomShift && emp.customShift?.endTime) {
    return emp.customShift;
  }
  if (emp.shift) {
    return typeof emp.shift === "object" && emp.shift.endTime
      ? emp.shift
      : await Shift.findById(emp.shift).select("startTime endTime");
  }
  return null;
}

// Converts a shift's "HH:MM" end time + the attendance date (from checkOutISO)
// into an absolute UTC timestamp, for comparison against the actual checkout time.
// Use Date.UTC() so the result is always UTC midnight regardless of server timezone —
// new Date(y, m, d) uses local timezone which double-counts IST offset on IST servers.
function shiftEndUTC(endTimeStr, checkOutISO) {
  const [endH, endM] = endTimeStr.split(":").map(Number);
  const checkOutDate = new Date(checkOutISO);
  const utcMidnight = Date.UTC(
    checkOutDate.getUTCFullYear(),
    checkOutDate.getUTCMonth(),
    checkOutDate.getUTCDate(),
  );
  const istMidnight = utcMidnight - IST_OFFSET_MS;
  return istMidnight + (endH * 60 + endM) * 60000;
}

// Returns auto-calculated OT hours based on checkout vs shift end.
// Returns 0 if OT is not enabled or checkout doesn't exceed shift end.
async function calcOTHours(emp, checkOutISO) {
  if (!emp.otEnabled) return 0;
  if (!checkOutISO) return 0;

  const shift = await resolveShift(emp);
  const endTimeStr = shift?.endTime;
  if (!endTimeStr) return 0;

  const checkOutUTC = new Date(checkOutISO).getTime();
  const otMs = checkOutUTC - shiftEndUTC(endTimeStr, checkOutISO);
  if (otMs <= 0) return 0;

  return parseFloat((otMs / 3_600_000).toFixed(2));
}

// Returns true if checkout happened more than the company's grace period before shift end.
// Returns false if there's no shift configured or no checkout time.
async function calcEarlyLeaving(emp, checkOutISO, companyId) {
  if (!checkOutISO) return false;

  const shift = await resolveShift(emp);
  const endTimeStr = shift?.endTime;
  if (!endTimeStr) return false;

  const graceMinutes = await getGraceMinutes(companyId || emp.company);
  const checkOutUTC = new Date(checkOutISO).getTime();
  const earlyMs = shiftEndUTC(endTimeStr, checkOutISO) - checkOutUTC;
  return earlyMs > graceMinutes * 60000;
}

async function resolveStatus(employeeId, checkIn, requestedStatus, companyId) {
  // Only auto-promote present → late; never override an explicit absent/leave/etc.
  if (!checkIn || requestedStatus !== "present") return requestedStatus;

  const emp = await Employee.findById(employeeId).select(
    "shift isCustomShift customShift company",
  );
  if (!emp) return requestedStatus;

  const shift =
    emp.isCustomShift && emp.customShift?.startTime
      ? emp.customShift
      : emp.shift
        ? await Shift.findById(emp.shift).select("startTime")
        : null;
  if (!shift?.startTime) return requestedStatus;

  const [shiftH, shiftM] = shift.startTime.split(":").map(Number);
  const shiftStartMinutes = shiftH * 60 + shiftM;

  // Convert stored UTC time → IST to compare against shift start (which is local IST)
  const checkInIST = new Date(new Date(checkIn).getTime() + IST_OFFSET_MS);
  const checkInMinutes =
    checkInIST.getUTCHours() * 60 + checkInIST.getUTCMinutes();

  const graceMinutes = await getGraceMinutes(companyId || emp.company);
  return checkInMinutes > shiftStartMinutes + graceMinutes
    ? "late"
    : requestedStatus;
}

// Minutes the check-in was past shift start (negative/0 if on time). Duplicates
// part of resolveStatus's math but returns a number instead of a status string.
async function computeMinutesLate(employeeId, checkIn) {
  const emp = await Employee.findById(employeeId).select(
    "shift isCustomShift customShift",
  );
  if (!emp) return 0;
  const shift =
    emp.isCustomShift && emp.customShift?.startTime
      ? emp.customShift
      : emp.shift
        ? await Shift.findById(emp.shift).select("startTime")
        : null;
  if (!shift?.startTime) return 0;
  const [shiftH, shiftM] = shift.startTime.split(":").map(Number);
  const shiftStartMinutes = shiftH * 60 + shiftM;
  const checkInIST = new Date(new Date(checkIn).getTime() + IST_OFFSET_MS);
  const checkInMinutes =
    checkInIST.getUTCHours() * 60 + checkInIST.getUTCMinutes();
  return checkInMinutes - shiftStartMinutes;
}

// Called when an employee checks in late (beyond the company's grace period).
// If they still have late allowance left this month, consume it silently
// (no deduction). Otherwise, park the record in the HR/Admin approval queue
// instead of finalizing it as "late".
async function handleLateAllowance(employeeId, companyId, date, checkIn) {
  const balance = await AttendanceBalance.getOrCreateCurrentMonth(
    employeeId,
    companyId,
  );
  if (balance.lateUsed < balance.lateAllowed) {
    balance.lateUsed += 1;
    await balance.save();
    return false;
  }
  const minutesLate = await computeMinutesLate(employeeId, checkIn);
  await LateApproval.create({
    employee: employeeId,
    company: companyId,
    date,
    checkInTime: checkIn,
    minutesLate,
  });
  return true;
}

const getAttendance = asyncHandler(async (req, res) => {
  // Month view is bounded by employees × days in month, not user input — cap high
  // enough that a full company's month never gets silently truncated.
  const { page, limit, skip } = safePagination(req.query, 50, 5000);
  const { month, year, employeeId, department, date } = req.query;

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

  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    // One calendar day (what the HR screen asks for at 1,000+ staff). Rows are stored at local or UTC midnight of
    // that day, so a +-12h window around 00:00Z catches both and never the neighbouring days.
    const mid = new Date(date + "T00:00:00.000Z").getTime();
    filter.date = {
      $gte: new Date(mid - 12 * 3600000),
      $lt: new Date(mid + 12 * 3600000),
    };
  } else if (month && year) {
    const m = parseInt(month),
      y = parseInt(year);
    if (!isNaN(m) && !isNaN(y)) {
      filter.date = { $gte: new Date(y, m - 1, 1), $lte: new Date(y, m, 0) };
    }
  }

  const [total, records] = await Promise.all([
    Attendance.countDocuments(filter),
    Attendance.find(filter)
      .populate({
        path: "employee",
        select: "firstName lastName employeeId designation department avatar",
        populate: { path: "department", select: "name" },
      })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
  ]);

  res.json({
    success: true,
    data: records,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

// Per-day status counts for a month in one aggregation: feeds the date strip without shipping every row.
const getDailySummary = asyncHandler(async (req, res) => {
  const m = parseInt(req.query.month),
    y = parseInt(req.query.year);
  if (isNaN(m) || isNaN(y)) {
    res.status(400);
    throw new Error("Valid month and year are required");
  }
  const ids = (
    await Employee.find({ company: req.user.company }).select("_id").lean()
  ).map((e) => e._id);
  const rows = await Attendance.aggregate([
    {
      $match: {
        employee: { $in: ids },
        date: {
          $gte: new Date(Date.UTC(y, m - 1, 1) - 12 * 3600000),
          $lt: new Date(Date.UTC(y, m, 1) - 12 * 3600000),
        },
      },
    },
    {
      $group: {
        _id: {
          d: {
            $dateToString: {
              format: "%Y-%m-%d",
              date: "$date",
              timezone: "+05:30",
            },
          },
          s: "$status",
        },
        n: { $sum: 1 },
      },
    },
  ]);
  const days = {};
  for (const r of rows) (days[r._id.d] ||= {})[r._id.s] = r.n;
  res.json({ success: true, data: days });
});

// Timing insights for a month (admin/HR): when people check in, which weekdays are busiest, and per-employee punctuality.
// One aggregation in IST; never ships raw rows.
const getTimingInsights = asyncHandler(async (req, res) => {
  const m = parseInt(req.query.month),
    y = parseInt(req.query.year);
  if (isNaN(m) || isNaN(y)) {
    res.status(400);
    throw new Error("Valid month and year are required");
  }
  const ids = (
    await Employee.find({ company: req.user.company }).select("_id").lean()
  ).map((e) => e._id);
  const worked = ["present", "late", "half_day"];
  const tz = "+05:30";
  // minutes after midnight IST for a date field
  const minsOf = (f) => ({
    $add: [
      { $multiply: [{ $hour: { date: f, timezone: tz } }, 60] },
      { $minute: { date: f, timezone: tz } },
    ],
  });
  const [out] = await Attendance.aggregate([
    {
      $match: {
        employee: { $in: ids },
        status: { $in: worked },
        date: {
          $gte: new Date(Date.UTC(y, m - 1, 1) - 12 * 3600000),
          $lt: new Date(Date.UTC(y, m, 1) - 12 * 3600000),
        },
      },
    },
    {
      $facet: {
        // 30-minute check-in buckets (minutes after midnight IST)
        hourly: [
          { $match: { checkIn: { $type: "date" } } },
          {
            $project: {
              mins: minsOf("$checkIn"),
            },
          },
          {
            $group: {
              _id: { $multiply: [{ $floor: { $divide: ["$mins", 30] } }, 30] },
              n: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ],
        // average people present per weekday (ISO 1=Mon..7=Sun)
        weekday: [
          {
            $group: {
              _id: {
                d: {
                  $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$date",
                    timezone: "+05:30",
                  },
                },
                dow: { $isoDayOfWeek: { date: "$date", timezone: tz } },
              },
              n: { $sum: 1 },
            },
          },
          { $group: { _id: "$_id.dow", avg: { $avg: "$n" }, days: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ],
        byEmployee: [
          { $match: { checkIn: { $type: "date" } } },
          {
            $group: {
              _id: "$employee",
              avgMins: { $avg: minsOf("$checkIn") },
              days: { $sum: 1 },
              late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
              avgHours: { $avg: "$workHours" },
            },
          },
          { $match: { days: { $gte: 2 } } },
        ],
      },
    },
  ]);
  const emps = await Employee.find({
    _id: { $in: (out?.byEmployee || []).map((r) => r._id) },
  })
    .select("firstName lastName employeeId")
    .lean();
  const nameOf = Object.fromEntries(
    emps.map((e) => [String(e._id), `${e.firstName} ${e.lastName || ""}`.trim()]),
  );
  res.json({
    success: true,
    data: {
      hourly: (out?.hourly || []).map((r) => ({ startMin: r._id, count: r.n })),
      weekday: (out?.weekday || []).map((r) => ({
        dow: r._id,
        avg: Math.round(r.avg * 10) / 10,
      })),
      employees: (out?.byEmployee || [])
        .map((r) => ({
          id: String(r._id),
          name: nameOf[String(r._id)] || "Unknown",
          avgMins: Math.round(r.avgMins),
          days: r.days,
          late: r.late,
          avgHours: Math.round((r.avgHours || 0) * 10) / 10,
        }))
        .sort((a, b) => a.avgMins - b.avgMins),
    },
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

  const boundsError = employmentBoundsError(emp, d);
  if (boundsError) {
    res.status(400);
    throw new Error(boundsError);
  }

  const holiday = await isHolidayDate(req.user.company, d);
  const computedStatus = holiday
    ? "holiday"
    : await resolveStatus(employee, checkIn, status);

  let approvalPending = false;
  if (computedStatus === "late") {
    approvalPending = await handleLateAllowance(
      employee,
      req.user.company,
      d,
      checkIn,
    );
  }

  let workHours = 0;
  let autoOT = 0;
  let earlyLeaving = false;
  if (checkIn && checkOut && !holiday) {
    workHours = (new Date(checkOut) - new Date(checkIn)) / 3600000;
    autoOT = await calcOTHours(emp, checkOut);
    earlyLeaving = await calcEarlyLeaving(emp, checkOut);
  }

  const before = await Attendance.findOne({ employee, date: d }).select(
    "status checkIn checkOut",
  );

  const record = await Attendance.findOneAndUpdate(
    { employee, date: d },
    {
      employee,
      date: d,
      status: computedStatus,
      checkIn: holiday ? undefined : checkIn,
      checkOut: holiday ? undefined : checkOut,
      workHours,
      overtime: autoOT,
      earlyLeaving,
      approvalPending,
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

  await logAudit(
    req,
    before ? "attendance.update" : "attendance.create",
    "Attendance",
    record._id,
    {
      date: d,
      employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
      employeeCode: record.employee.employeeId,
      before: before
        ? {
            status: before.status,
            checkIn: before.checkIn,
            checkOut: before.checkOut,
          }
        : null,
      after: {
        status: record.status,
        checkIn: record.checkIn,
        checkOut: record.checkOut,
      },
    },
  );

  // Send WA notification for actionable statuses (not holiday/weekend/on_leave)
  await notifyAttendanceStatus(
    record.employee,
    d,
    computedStatus,
    req.user.company,
  );

  res.json({ success: true, data: record });
});

// Employee self check-in/check-out from the mobile app: requires a live selfie +
// GPS location, and only succeeds if the employee has geofenced attendance enabled
// and is within their configured radius. Location is always re-validated server-side.
const selfMarkAttendance = asyncHandler(async (req, res) => {
  const cleanup = () => {
    if (req.file) fs.unlink(req.file.path, () => {});
  };

  const emp = await Employee.findOne({
    user: req.user._id,
    company: req.user.company,
  });
  if (!emp) {
    cleanup();
    res.status(404);
    throw new Error("Employee record not found");
  }

  if (!emp.geofenceAttendanceEnabled) {
    cleanup();
    res.status(403);
    throw new Error("Geofenced mobile attendance is not enabled for you");
  }

  const geofenceMode = emp.geofenceMode || "specific";
  if (
    geofenceMode === "specific" &&
    (emp.geofenceLat == null || emp.geofenceLng == null)
  ) {
    cleanup();
    res.status(400);
    throw new Error("Geofence location has not been configured for you");
  }

  if (!req.file) {
    res.status(400);
    throw new Error("Selfie photo is required");
  }

  try {
    await validateMagicBytes(req.file.path); // throws + deletes file if invalid
  } catch (err) {
    res.status(400);
    throw err;
  }

  const { action } = req.body;
  const lat = parseFloat(req.body.lat);
  const lng = parseFloat(req.body.lng);
  const accuracy = req.body.accuracy
    ? parseFloat(req.body.accuracy)
    : undefined;

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    cleanup();
    res.status(400);
    throw new Error("Valid location coordinates are required");
  }
  if (!["checkin", "checkout"].includes(action)) {
    cleanup();
    res.status(400);
    throw new Error("action must be 'checkin' or 'checkout'");
  }

  // "any" mode still records the employee's GPS location for audit purposes,
  // but doesn't restrict where they can check in/out from.
  const distanceMeters =
    geofenceMode === "specific"
      ? haversineMeters(lat, lng, emp.geofenceLat, emp.geofenceLng)
      : null;
  // Out of range is not rejected: the check-in is recorded and parked in the
  // HR/Admin approval queue (same queue as late approvals) with the distance.
  const outOfRange =
    geofenceMode === "specific" &&
    // GPS error (phone-reported accuracy, capped at 50m) is forgiven so small radii like 20m still work
    distanceMeters - Math.min(accuracy || 0, 50) > emp.geofenceRadiusMeters;

  if (!Array.isArray(emp.faceDescriptor) || emp.faceDescriptor.length !== 128) {
    cleanup();
    res.status(400);
    throw new Error(
      "Face not enrolled for you. Contact HR to enable mobile attendance.",
    );
  }

  const faceVerifyStart = Date.now();
  const { match, distance } = await verifyFace(
    await fs.promises.readFile(req.file.path),
    req.file.filename,
    req.file.mimetype,
    emp.faceDescriptor,
  );
  console.log(
    `[selfMarkAttendance] verifyFace took ${Date.now() - faceVerifyStart}ms`,
  );
  if (!match) {
    cleanup();
    res.status(403);
    throw new Error(
      `Face does not match enrolled records (distance: ${distance.toFixed(3)})`,
    );
  }

  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);

  const holiday = await isHolidayDate(req.user.company, d);
  const selfieUrl = `${req.protocol}://${req.get("host")}/uploads/attendance-selfies/${req.file.filename}`;
  const location = { lat, lng, accuracy, distanceMeters };

  let record = await Attendance.findOne({ employee: emp._id, date: d });

  if (action === "checkin") {
    if (record?.checkIn) {
      cleanup();
      res.status(400);
      throw new Error("Already checked in today");
    }
    const computedStatus = holiday
      ? "holiday"
      : await resolveStatus(emp._id, now, "present");

    let approvalPending = false;
    if (outOfRange && !holiday) {
      approvalPending = true;
      await LateApproval.create({
        employee: emp._id,
        company: req.user.company,
        date: d,
        checkInTime: now,
        minutesLate: 0,
        reason: `Out of range: ${Math.round(distanceMeters)}m from office (allowed ${emp.geofenceRadiusMeters}m). GPS ${lat.toFixed(5)},${lng.toFixed(5)}${accuracy ? ` ±${Math.round(accuracy)}m` : ""}`,
      });
    } else if (computedStatus === "late") {
      approvalPending = await handleLateAllowance(
        emp._id,
        req.user.company,
        d,
        now,
      );
    }

    record = await Attendance.findOneAndUpdate(
      { employee: emp._id, date: d },
      {
        employee: emp._id,
        date: d,
        // not counted until HR approves an out-of-range check-in
        status: outOfRange && !holiday ? "absent" : computedStatus,
        checkIn: holiday ? undefined : now,
        approvalPending,
        verifyMode: "geo_camera",
        checkInSelfie: selfieUrl,
        checkInLocation: location,
        markedBy: req.user._id,
      },
      { upsert: true, new: true },
    );
  } else {
    if (!record?.checkIn) {
      cleanup();
      res.status(400);
      throw new Error("You must check in before checking out");
    }
    if (record.checkOut) {
      cleanup();
      res.status(400);
      throw new Error("Already checked out today");
    }
    const workHours = (now - record.checkIn) / 3600000;
    const autoOT = await calcOTHours(emp, now.toISOString());
    const earlyLeaving = await calcEarlyLeaving(emp, now.toISOString());

    record = await Attendance.findOneAndUpdate(
      { employee: emp._id, date: d },
      {
        checkOut: now,
        workHours,
        overtime: autoOT,
        earlyLeaving,
        checkOutSelfie: selfieUrl,
        checkOutLocation: location,
      },
      { new: true },
    );
  }

  const pendingApproval =
    action === "checkin" && outOfRange && !!record.approvalPending;
  if (!pendingApproval) {
    await notifyAttendanceStatus(emp, d, record.status, req.user.company);
  }

  notifyPunch(emp, req.user.company, action === "checkin" ? "check_in" : "check_out");
  notifyHrPunch(emp, req.user.company, action === "checkin" ? "check_in" : "check_out", now, record.workHours);

  res.json({ success: true, data: record, pendingApproval });
});

// Spare-device attendance kiosk (admin / HR signed in on a wall-mounted phone or tablet): identifies WHO is in the
// photo by comparing its face embedding against every enrolled employee of the company, then toggles that
// employee's day — first scan checks in, the next checks out. Works alongside manual marking, which is unchanged.
const KIOSK_MATCH_THRESHOLD = Number(process.env.FACE_MATCH_THRESHOLD) || 0.5;
const KIOSK_MIN_GAP_MS = 60 * 1000; // ignore a re-scan right after check-in so a lingering face doesn't check out

const kioskFaceMark = asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400);
    throw new Error("Photo is required");
  }
  const probe = await enrollFace(
    req.file.buffer,
    req.file.originalname || "kiosk.jpg",
    req.file.mimetype,
  );

  const candidates = await Employee.find({
    company: req.user.company,
    "faceDescriptor.127": { $exists: true },
    status: { $nin: ["terminated", "exited"] },
  })
    .select("_id faceDescriptor")
    .lean();

  let bestId = null;
  let bestDist = Infinity;
  for (const c of candidates) {
    if (c.faceDescriptor.length !== 128) continue;
    let sum = 0;
    for (let i = 0; i < 128; i++) sum += (probe[i] - c.faceDescriptor[i]) ** 2;
    const dist = Math.sqrt(sum);
    if (dist < bestDist) {
      bestDist = dist;
      bestId = c._id;
    }
  }
  if (!bestId || bestDist > KIOSK_MATCH_THRESHOLD) {
    res.status(404);
    throw new Error(
      "Face not recognised. Make sure the employee has a face enrolled.",
    );
  }

  const emp = await Employee.findOne({
    _id: bestId,
    company: req.user.company,
  });
  const name = `${emp.firstName} ${emp.lastName || ""}`.trim();
  const now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const who = { name, employeeId: emp.employeeId };

  const boundsError = employmentBoundsError(emp, d);
  if (boundsError) {
    res.status(400);
    throw new Error(boundsError);
  }

  const record = await Attendance.findOne({ employee: emp._id, date: d });

  // Optional explicit action from the web kiosk ("checkin" | "checkout").
  // Without it the old toggle behaviour applies.
  const action = ["checkin", "checkout"].includes(req.body?.action)
    ? req.body.action
    : null;
  if (action === "checkout" && !record?.checkIn) {
    res.status(400);
    throw new Error(`${name}: not checked in today, so cannot check out`);
  }
  if (action === "checkin" && record?.checkIn) {
    return res.json({
      success: true,
      locked: true,
      data: {
        employee: who,
        type: "check_in",
        message: "Already checked in",
        timestamp: record.checkIn,
      },
    });
  }

  if (!record?.checkIn) {
    const holiday = await isHolidayDate(req.user.company, d);
    const status = holiday
      ? "holiday"
      : await resolveStatus(emp._id, now, "present", req.user.company);
    let approvalPending = false;
    if (status === "late")
      approvalPending = await handleLateAllowance(
        emp._id,
        req.user.company,
        d,
        now,
      );
    const saved = await Attendance.findOneAndUpdate(
      { employee: emp._id, date: d },
      {
        employee: emp._id,
        date: d,
        status,
        checkIn: holiday ? undefined : now,
        approvalPending,
        verifyMode: "face",
        markedBy: req.user._id,
      },
      { upsert: true, new: true },
    );
    await notifyAttendanceStatus(emp, d, saved.status, req.user.company);
    notifyPunch(emp, req.user.company, "check_in", now);
    notifyHrPunch(emp, req.user.company, "check_in", now);
    return res.json({
      success: true,
      data: {
        employee: who,
        type: "check_in",
        status: saved.status,
        timestamp: now,
      },
    });
  }

  if (record.checkOut) {
    return res.json({
      success: true,
      locked: true,
      data: {
        employee: who,
        type: "check_out",
        message: "Already checked out for today",
        timestamp: record.checkOut,
      },
    });
  }
  if (!action && now - record.checkIn < KIOSK_MIN_GAP_MS) {
    return res.json({
      success: true,
      locked: true,
      data: {
        employee: who,
        type: "check_in",
        message: "Already checked in",
        timestamp: record.checkIn,
      },
    });
  }

  const workHours = (now - record.checkIn) / 3600000;
  const overtime = await calcOTHours(emp, now.toISOString());
  const earlyLeaving = await calcEarlyLeaving(emp, now.toISOString());
  await Attendance.updateOne(
    { _id: record._id },
    { $set: { checkOut: now, workHours, overtime, earlyLeaving } },
  );
  notifyPunch(emp, req.user.company, "check_out", now);
  notifyHrPunch(emp, req.user.company, "check_out", now, workHours);
  res.json({
    success: true,
    data: {
      employee: who,
      type: "check_out",
      workHours: Number(workHours.toFixed(2)),
      timestamp: now,
    },
  });
});

// ── Hikvision access-terminal push (DS-K1T320 etc.) ──────────────────────────
// Device POSTs each punch to /api/attendance/hikvision/:token (multipart with an
// `event_log` JSON field, or plain JSON). Tenant is resolved from the secret token
// via Company.hikvisionToken (generate in Attendance Settings). Always answers 200 so the device doesn't retry.
const HIK_VERIFY_MODES = { 1: "card", 38: "fingerprint", 75: "face" };

const hikvisionPunch = asyncHandler(async (req, res) => {
  const company = await require("../models/Company")
    .findOne({ hikvisionToken: req.params.token })
    .select("_id");
  if (!company) return res.status(401).json({ success: false });
  const companyId = company._id;

  let ev = req.body?.event_log ?? req.body;
  if (typeof ev === "string") {
    try {
      ev = JSON.parse(ev);
    } catch {
      return res.json({ success: true, ignored: "unparseable" });
    }
  }
  const ace = ev?.AccessControllerEvent;
  const empNo = ace?.employeeNoString || ace?.employeeNo;
  const verifyMode = HIK_VERIFY_MODES[ace?.subEventType];
  if (!ace || !empNo || !verifyMode) {
    return res.json({ success: true, ignored: "not a successful identity punch" });
  }

  const emp = await Employee.findOne({
    company: companyId,
    employeeId: String(empNo),
    status: { $nin: ["terminated", "exited"] },
  });
  if (!emp) {
    return res.json({ success: true, ignored: `unknown employee ${empNo}` });
  }

  // Trust the device clock only if it is sane; otherwise use server time.
  let now = ev.dateTime ? new Date(ev.dateTime) : new Date();
  if (isNaN(now) || Math.abs(Date.now() - now) > 24 * 3600 * 1000) now = new Date();
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);

  if (employmentBoundsError(emp, d)) {
    return res.json({ success: true, ignored: "outside employment dates" });
  }

  const record = await Attendance.findOne({ employee: emp._id, date: d });

  if (!record?.checkIn) {
    const holiday = await isHolidayDate(companyId, d);
    const status = holiday
      ? "holiday"
      : await resolveStatus(emp._id, now, "present", companyId);
    let approvalPending = false;
    if (status === "late")
      approvalPending = await handleLateAllowance(emp._id, companyId, d, now);
    await Attendance.findOneAndUpdate(
      { employee: emp._id, date: d },
      {
        employee: emp._id,
        date: d,
        status,
        checkIn: holiday ? undefined : now,
        approvalPending,
        verifyMode,
      },
      { upsert: true, new: true },
    );
    notifyPunch(emp, companyId, "check_in", now);
    notifyHrPunch(emp, companyId, "check_in", now);
    return res.json({ success: true, type: "check_in" });
  }

  // Device fires repeats; ignore anything within a minute of check-in, and after check-out.
  if (record.checkOut || now - record.checkIn < KIOSK_MIN_GAP_MS) {
    return res.json({ success: true, ignored: "duplicate" });
  }
  const workHours = (now - record.checkIn) / 3600000;
  const overtime = await calcOTHours(emp, now.toISOString());
  const earlyLeaving = await calcEarlyLeaving(emp, now.toISOString(), companyId);
  await Attendance.updateOne(
    { _id: record._id },
    { $set: { checkOut: now, workHours, overtime, earlyLeaving } },
  );
  notifyPunch(emp, companyId, "check_out", now);
  notifyHrPunch(emp, companyId, "check_out", now, workHours);
  res.json({ success: true, type: "check_out" });
});

// Admin: get (or create) this company's device push URL path. ?regenerate=1 rotates the token.
const hikDevicePublic = (c) => {
  const d = c?.hikvisionDevice || {};
  return { host: d.host || "", port: d.port || 80, https: !!d.https, username: d.username || "" };
};

const getHikvisionDevice = asyncHandler(async (req, res) => {
  const c = await require("../models/Company").findById(req.user.company).select("hikvisionDevice").lean();
  res.json({ success: true, data: hikDevicePublic(c) });
});

// Save device address/login (password optional on re-save), then verify we can reach it.
const saveHikvisionDevice = asyncHandler(async (req, res) => {
  const hik = require("../services/hikvisionService");
  const Company = require("../models/Company");
  const { host, port, https, username, password } = req.body;
  if (!host || !username) {
    res.status(400);
    throw new Error("Device IP and username are required");
  }
  if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
    res.status(400);
    throw new Error("Invalid device IP/host");
  }
  const company = await Company.findById(req.user.company).select("+hikvisionDevice.passwordEnc");
  const prev = company.hikvisionDevice || {};
  if (!password && !prev.passwordEnc) {
    res.status(400);
    throw new Error("Device password is required");
  }
  company.hikvisionDevice = {
    host: host.trim(),
    port: Number(port) || (https ? 443 : 80),
    https: !!https,
    username: String(username).trim(),
    passwordEnc: password ? hik.sealPassword(String(password)) : prev.passwordEnc,
  };
  await company.save({ validateModifiedOnly: true });
  let model;
  try {
    model = await hik.testDevice(await hik.getDevice(req.user.company));
  } catch (e) {
    return res.json({ success: true, connected: false, message: `Saved, but cannot connect: ${e.message}`, data: hikDevicePublic(company) });
  }
  res.json({ success: true, connected: true, message: `Connected to ${model}`, data: hikDevicePublic(company) });
});

// Push every active employee to the terminal (users only; faces need a photo upload).
const syncHikvisionUsers = asyncHandler(async (req, res) => {
  const hik = require("../services/hikvisionService");
  if (await hik.agentAlive(req.user.company)) {
    const all = await Employee.find({ company: req.user.company, status: { $nin: ["terminated", "exited"] } }).select("employeeId firstName lastName");
    for (const e of all) await hik.enqueue(req.user.company, e);
    return res.json({ success: true, synced: all.length, total: all.length, failed: [], message: `Queued ${all.length} employees for the site agent` });
  }
  const dev = await hik.getDevice(req.user.company);
  if (!dev) {
    res.status(400);
    throw new Error("Save the device IP and login first");
  }
  const emps = await Employee.find({ company: req.user.company, status: { $nin: ["terminated", "exited"] } }).select("employeeId firstName lastName");
  let ok = 0;
  const failed = [];
  for (const e of emps) {
    try {
      await hik.pushUser(dev, e);
      ok++;
    } catch (err) {
      failed.push(`${e.employeeId}: ${err.message}`);
      if (failed.length >= 3) break; // unreachable device / wrong login: stop early
    }
  }
  res.json({ success: true, synced: ok, total: emps.length, failed });
});

// ── Site agent: a small script on the client's LAN polls these (token in path = company secret). ──
const agentCompany = async (token) =>
  require("../models/Company").findOne({ hikvisionAgentToken: token }).select("_id");

const getHikvisionAgentSetup = asyncHandler(async (req, res) => {
  const Company = require("../models/Company");
  const company = await Company.findById(req.user.company).select("+hikvisionAgentToken hikvisionAgentSeen");
  if (!company.hikvisionAgentToken || req.query.regenerate === "1") {
    company.hikvisionAgentToken = require("crypto").randomBytes(24).toString("hex");
    await company.save({ validateModifiedOnly: true });
  }
  const seen = company.hikvisionAgentSeen;
  res.json({
    success: true,
    data: {
      server: `https://${process.env.HIKVISION_PUBLIC_HOST || "hrms-backend.pixelatenest.com"}`,
      token: company.hikvisionAgentToken,
      lastSeen: seen || null,
      online: !!seen && Date.now() - new Date(seen) < 2 * 60 * 1000,
    },
  });
});

// Agent heartbeat + work: hands out up to 20 pending jobs and marks them "sent".
const agentPoll = asyncHandler(async (req, res) => {
  const company = await agentCompany(req.params.token);
  if (!company) return res.status(401).json({ success: false });
  const HikvisionJob = require("../models/HikvisionJob");
  await require("../models/Company").updateOne({ _id: company._id }, { $set: { hikvisionAgentSeen: new Date() } });
  // a job stuck in "sent" for >5 min (agent crashed) goes back to pending
  await HikvisionJob.updateMany({ company: company._id, status: "sent", sentAt: { $lt: new Date(Date.now() - 5 * 60 * 1000) } }, { $set: { status: "pending" } });
  const jobs = await HikvisionJob.find({ company: company._id, status: "pending" }).sort({ createdAt: 1 }).limit(20).lean();
  if (jobs.length) await HikvisionJob.updateMany({ _id: { $in: jobs.map((j) => j._id) } }, { $set: { status: "sent", sentAt: new Date() } });
  res.json({ success: true, jobs });
});

const agentResult = asyncHandler(async (req, res) => {
  const company = await agentCompany(req.params.token);
  if (!company) return res.status(401).json({ success: false });
  const { ok, error } = req.body || {};
  await require("../models/HikvisionJob").updateOne(
    { _id: req.params.jobId, company: company._id },
    { $set: { status: ok ? "done" : "failed", error: ok ? undefined : String(error || "").slice(0, 300) } },
  );
  res.json({ success: true });
});

const getHikvisionSetup = asyncHandler(async (req, res) => {
  const Company = require("../models/Company");
  const company = await Company.findById(req.user.company).select("+hikvisionToken");
  if (!company.hikvisionToken || req.query.regenerate === "1") {
    company.hikvisionToken = require("crypto").randomBytes(24).toString("hex");
    await company.save({ validateModifiedOnly: true });
  }
  res.json({
    success: true,
    data: {
      host: process.env.HIKVISION_PUBLIC_HOST || "hrms-backend.pixelatenest.com",
      port: 80,
      url: `/api/attendance/hikvision/${company.hikvisionToken}`,
    },
  });
});

const updateAttendance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, checkIn, checkOut, notes, overtime, verifyMode } = req.body;

  const record = await Attendance.findById(id).populate("employee", "_id");
  const inCompany =
    record?.employee &&
    (await Employee.exists({
      _id: record.employee._id,
      company: req.user.company,
    }));
  if (!record || !inCompany) {
    res.status(404);
    throw new Error("Attendance record not found");
  }

  // Load employee with shift for OT calculation
  const empForOT = await Employee.findById(record.employee._id)
    .populate("shift", "endTime")
    .select("otEnabled shift isCustomShift customShift company");

  const before = {
    status: record.status,
    checkIn: record.checkIn,
    checkOut: record.checkOut,
  };

  // Note: record.date is intentionally not updated — it's part of the unique compound
  // index (employee + date) and changing it would cause duplicate key errors.
  if (checkIn !== undefined)
    record.checkIn = checkIn ? new Date(checkIn) : undefined;
  if (checkOut !== undefined)
    record.checkOut = checkOut ? new Date(checkOut) : undefined;
  if (notes !== undefined) record.notes = notes;
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
    // If overtime was manually provided, honour it; otherwise auto-calculate from shift end
    if (overtime !== undefined) {
      record.overtime = parseFloat(overtime) || 0;
    } else if (empForOT) {
      record.overtime = await calcOTHours(
        empForOT,
        record.checkOut.toISOString(),
      );
    }
    record.earlyLeaving = empForOT
      ? await calcEarlyLeaving(empForOT, record.checkOut.toISOString())
      : false;
  } else if (overtime !== undefined) {
    record.overtime = parseFloat(overtime) || 0;
  }

  record.markedBy = req.user._id;
  await record.save();

  await record.populate({
    path: "employee",
    select: "firstName lastName employeeId designation department avatar phone",
    populate: { path: "department", select: "name" },
  });

  await logAudit(req, "attendance.update", "Attendance", record._id, {
    date: record.date,
    employeeName: `${record.employee.firstName} ${record.employee.lastName}`,
    employeeCode: record.employee.employeeId,
    before,
    after: {
      status: record.status,
      checkIn: record.checkIn,
      checkOut: record.checkOut,
    },
  });

  await notifyAttendanceStatus(
    record.employee,
    record.date,
    record.status,
    req.user.company,
  );

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
  }).select("_id joinDate exitDate");
  const companyEmpMap = new Map(
    companyEmployees.map((e) => [e._id.toString(), e]),
  );
  const filteredRecords = records.filter((r) => {
    if (!r.employee) return false;
    const emp = companyEmpMap.get(r.employee.toString());
    if (!emp) return false;
    return !employmentBoundsError(emp, d);
  });

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

// Bulk edit for one day (admin/HR): set status and/or check-in/out times for many employees at once.
// Times are "HH:MM" (IST) and are always placed on the chosen date, so a check-in/out can never land on another day.
// A check-out earlier than the check-in is read as the next morning (night shift). Same status/hours/OT/late logic as
// single marking; WhatsApp notices are not sent in bulk.
const bulkUpdateAttendance = asyncHandler(async (req, res) => {
  const { date, employees, status, checkIn, checkOut, notes } = req.body;
  const STATUSES = ["present", "absent", "late", "half_day", "on_leave"];
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    res.status(400);
    throw new Error("A valid date (YYYY-MM-DD) is required");
  }
  if (!Array.isArray(employees) || employees.length === 0) {
    res.status(400);
    throw new Error("Select at least one employee");
  }
  if (employees.length > 500) {
    res.status(400);
    throw new Error("Cannot update more than 500 records at once");
  }
  if (status !== undefined && status !== "" && !STATUSES.includes(status)) {
    res.status(400);
    throw new Error("Invalid status");
  }
  if ((checkIn && !hhmm.test(checkIn)) || (checkOut && !hhmm.test(checkOut))) {
    res.status(400);
    throw new Error("Times must be in HH:MM format");
  }
  if (!status && !checkIn && !checkOut) {
    res.status(400);
    throw new Error("Choose a status and/or a check-in / check-out time");
  }

  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const holiday = await isHolidayDate(req.user.company, d);
  if (holiday) {
    res.status(400);
    throw new Error(`${date} is a holiday (${holiday.name}); attendance can't be edited`);
  }

  const at = (hhmmStr, addDays = 0) =>
    new Date(new Date(`${date}T${hhmmStr}:00+05:30`).getTime() + addDays * 86400000);

  const emps = await Employee.find({
    _id: { $in: employees },
    company: req.user.company,
  });
  const empMap = new Map(emps.map((e) => [String(e._id), e]));
  const existingRows = await Attendance.find({
    employee: { $in: emps.map((e) => e._id) },
    date: d,
  });
  const existingMap = new Map(existingRows.map((r) => [String(r.employee), r]));

  let updated = 0;
  const skipped = [];
  for (const id of employees) {
    const emp = empMap.get(String(id));
    if (!emp) {
      skipped.push({ employee: id, reason: "Employee not found" });
      continue;
    }
    const boundsError = employmentBoundsError(emp, d);
    if (boundsError) {
      skipped.push({ employee: id, reason: boundsError });
      continue;
    }
    const existing = existingMap.get(String(emp._id)) || null;

    // Effective status: explicit choice, else keep the current one (an absent person given a check-in becomes present).
    const noTimes = status === "absent" || status === "on_leave";
    let wanted = status || existing?.status;
    if (!status) {
      if (!existing || existing.status === "absent") wanted = checkIn || checkOut ? "present" : wanted || "absent";
      if (["holiday", "weekend"].includes(wanted)) wanted = "present";
    }

    let newIn = noTimes ? undefined : existing?.checkIn;
    let newOut = noTimes ? undefined : existing?.checkOut;
    if (!noTimes && checkIn) newIn = at(checkIn);
    if (!noTimes && checkOut) {
      newOut = at(checkOut);
      const base = newIn ? new Date(newIn) : null;
      if (base && newOut <= base) newOut = at(checkOut, 1);
    }

    const finalStatus = await resolveStatus(emp._id, newIn, wanted, req.user.company);
    let approvalPending = existing?.approvalPending || false;
    if (finalStatus === "late" && existing?.status !== "late" && newIn) {
      approvalPending = await handleLateAllowance(emp._id, req.user.company, d, newIn);
    }
    if (finalStatus !== "late") approvalPending = false;

    let workHours = 0,
      autoOT = 0,
      earlyLeaving = false;
    if (newIn && newOut) {
      workHours = (newOut - newIn) / 3600000;
      autoOT = await calcOTHours(emp, newOut);
      earlyLeaving = await calcEarlyLeaving(emp, newOut);
    }

    await Attendance.findOneAndUpdate(
      { employee: emp._id, date: d },
      {
        employee: emp._id,
        date: d,
        status: finalStatus,
        checkIn: newIn,
        checkOut: newOut,
        workHours,
        overtime: autoOT,
        earlyLeaving,
        approvalPending,
        verifyMode: existing?.verifyMode || "manual",
        ...(notes ? { notes } : {}),
        markedBy: req.user._id,
      },
      { upsert: true },
    );
    updated++;
  }

  await logAudit(req, "attendance.bulk_update", "Attendance", undefined, {
    date: d,
    count: updated,
    status: status || undefined,
    checkIn: checkIn || undefined,
    checkOut: checkOut || undefined,
  });
  res.json({
    success: true,
    message: `Updated ${updated} record${updated === 1 ? "" : "s"}`,
    updated,
    skipped,
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
  selfMarkAttendance,
  kioskFaceMark,
  hikvisionPunch,
  getHikvisionSetup,
  getHikvisionDevice,
  saveHikvisionDevice,
  syncHikvisionUsers,
  getHikvisionAgentSetup,
  agentPoll,
  agentResult,
  updateAttendance,
  bulkMarkAttendance,
  bulkUpdateAttendance,
  getMonthSummary,
  getDailySummary,
  getTimingInsights,
  handleLateAllowance,
};

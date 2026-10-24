const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const Leave = require("../models/Leave");
const Payroll = require("../models/Payroll");
const Department = require("../models/Department");

// HR dashboards are opened (and auto-refreshed) all day by several people; the numbers move slowly, so one
// computation per company every 30s is plenty. ponytail: per-process cache, use Redis if the API ever runs on many nodes.
const statsCache = new Map();
const STATS_TTL_MS = 30_000;

const getStats = asyncHandler(async (req, res) => {
  const hit = statsCache.get(String(req.user.company));
  if (hit && Date.now() - hit.at < STATS_TTL_MS) return res.json(hit.body);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const istToday = new Date(Date.now() + 5.5 * 3600000).toISOString().slice(0, 10);
  const todayStart = new Date(new Date(`${istToday}T00:00:00Z`).getTime() - 12 * 3600000);
  const todayEnd = new Date(new Date(`${istToday}T00:00:00Z`).getTime() + 12 * 3600000);

  try {
    const companyId = new mongoose.Types.ObjectId(req.user.company);
    warmSummaries(req.user.company);
    const companyEmployeeIds = await Employee.find({ company: companyId })
      .select("_id")
      .lean()
      .then((docs) => docs.map((d) => d._id));

    const [
      totalEmployees,
      activeEmployees,
      newHires,
      pendingLeaves,
      todayRows,
      departments,
      monthlyPayroll,
    ] = await Promise.all([
      Employee.countDocuments({ company: companyId }).catch(() => 0),
      Employee.countDocuments({ company: companyId, status: "active" }).catch(
        () => 0,
      ),
      Employee.countDocuments({
        company: companyId,
        joinDate: { $gte: startOfMonth },
      }).catch(() => 0),
      Leave.countDocuments({ company: companyId, status: "pending" }).catch(
        () => 0,
      ),
      Attendance.aggregate([
        // Range over the IST day (not exact equality) so it works whatever TZ the server / writer used for the date stamp.
        { $match: { employee: { $in: companyEmployeeIds }, date: { $gte: todayStart, $lt: todayEnd } } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]).catch(() => []),
      Department.countDocuments({ company: companyId }).catch(() => 0),
      Payroll.aggregate([
        {
          $match: {
            company: companyId,
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            status: "paid",
          },
        },
        { $group: { _id: null, total: { $sum: "$netSalary" } } },
      ]).catch(() => []),
    ]);

    const todayBy = Object.fromEntries(todayRows.map((r) => [r._id, r.n]));
    const todayPresent = todayBy.present || 0;
    const attendanceRate =
      activeEmployees > 0
        ? Math.round((todayPresent / activeEmployees) * 100)
        : 0;

    const recentHires = await Employee.find({
      company: companyId,
      joinDate: { $gte: startOfMonth },
    })
      .populate("department", "name")
      .sort({ joinDate: -1 })
      .limit(5)
      .select("firstName lastName designation department joinDate avatar")
      .catch(() => []);

    const pendingLeaveList = await Leave.find({
      company: companyId,
      status: "pending",
    })
      .populate({
        path: "employee",
        select: "firstName lastName designation",
        populate: { path: "department", select: "name" },
      })
      .sort({ createdAt: -1 })
      .limit(5)
      .catch(() => []);

    const deptHeadcounts = await Employee.aggregate([
      { $match: { company: companyId, status: "active" } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      {
        $lookup: {
          from: "departments",
          localField: "_id",
          foreignField: "_id",
          as: "dept",
        },
      },
      { $unwind: { path: "$dept", preserveNullAndEmptyArrays: true } },
      { $project: { name: { $ifNull: ["$dept.name", "No Dept"] }, count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 6 },
    ]).catch(() => []);

    // Last 6 months in one pass (was 6 separate counts, each probing every employee id).
    const monthStarts = Array.from({ length: 7 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - 5 + i, 1));
    const attBuckets = await Attendance.aggregate([
      {
        $match: {
          employee: { $in: companyEmployeeIds },
          date: { $gte: monthStarts[0], $lt: monthStarts[6] },
          status: { $in: ["present", "late"] },
        },
      },
      { $bucket: { groupBy: "$date", boundaries: monthStarts, default: "other", output: { count: { $sum: 1 } } } },
    ]).catch(() => []);
    const attTrend = monthStarts.slice(0, 6).map((d) => ({
      month: d.getMonth() + 1,
      year: d.getFullYear(),
      count: attBuckets.find((x) => x._id && new Date(x._id).getTime() === d.getTime())?.count || 0,
    }));

    // Daily present / late / absent for the last 7 days (today included). Attendance dates are
    // per-IST-day stamps, so bucket by IST date string instead of matching exact instants.
    const istDay = (offset) =>
      new Date(Date.now() + 5.5 * 3600000 - offset * 86400000).toISOString().slice(0, 10);
    const dayKeys = Array.from({ length: 7 }, (_, i) => istDay(6 - i));
    const dayRows = await Attendance.aggregate([
      {
        $match: {
          employee: { $in: companyEmployeeIds },
          date: { $gte: new Date(`${dayKeys[0]}T00:00:00Z`.replace("Z", "+05:30")), $lt: new Date(Date.now() + 36 * 3600000) },
          status: { $in: ["present", "late", "absent"] },
        },
      },
      {
        $group: {
          _id: { d: { $dateToString: { format: "%Y-%m-%d", date: "$date", timezone: "+05:30" } }, s: "$status" },
          n: { $sum: 1 },
        },
      },
    ]).catch(() => []);
    const dailyStats = dayKeys.map((k) => {
      const n = (status) => dayRows.find((r) => r._id.d === k && r._id.s === status)?.n || 0;
      return { date: `${k}T12:00:00+05:30`, present: n("present"), late: n("late"), absent: n("absent") };
    });

    const payMonths = monthStarts.slice(0, 6).map((d) => ({ month: d.getMonth() + 1, year: d.getFullYear() }));
    const payRows = await Payroll.aggregate([
      { $match: { company: req.user.company, $or: payMonths } },
      { $group: { _id: { month: "$month", year: "$year" }, total: { $sum: "$netSalary" } } },
    ]).catch(() => []);
    const payTrend = payMonths.map((m) => ({
      ...m,
      total: payRows.find((r) => r._id.month === m.month && r._id.year === m.year)?.total || 0,
    }));

    const todayLate = todayBy.late || 0;
    const todayAbsent = todayBy.absent || 0;
    const todayOnLeave = todayBy.on_leave || 0;

    const body = {
      success: true,
      data: {
        stats: {
          totalEmployees,
          activeEmployees,
          newHires,
          pendingLeaves,
          todayPresent,
          todayLate,
          todayAbsent,
          todayOnLeave,
          attendanceRate,
          departments,
          monthlyPayroll: monthlyPayroll[0]?.total || 0,
        },
        recentHires,
        pendingLeaveList,
        deptHeadcounts,
        attTrend,
        dailyStats,
        payTrend,
      },
    };
    statsCache.set(String(req.user.company), { at: Date.now(), body });
    res.json(body);
  } catch (error) {
    console.error("Dashboard stats error:", error);
    res.status(500).json({
      success: false,
      data: {
        stats: {
          totalEmployees: 0,
          activeEmployees: 0,
          newHires: 0,
          pendingLeaves: 0,
          todayPresent: 0,
          attendanceRate: 0,
          departments: 0,
          monthlyPayroll: 0,
        },
        recentHires: [],
        pendingLeaveList: [],
        deptHeadcounts: [],
      },
    });
  }
});

const getEmployeeStats = asyncHandler(async (req, res) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const emp = await Employee.findOne({ user: req.user._id })
    .populate("shift")
    .populate("department");

  if (!emp) {
    res.status(404);
    throw new Error("Employee record not found");
  }

  // 1. Birthday wishes & Work anniversaries
  const isTodayUserBirthday =
    emp.dateOfBirth &&
    new Date(emp.dateOfBirth).getMonth() === now.getMonth() &&
    new Date(emp.dateOfBirth).getDate() === now.getDate();

  const isTodayUserAnniversary =
    emp.joinDate &&
    new Date(emp.joinDate).getMonth() === now.getMonth() &&
    new Date(emp.joinDate).getDate() === now.getDate();

  // Other employees birthdays today
  const allEmps = await Employee.find({
    company: req.user.company,
    _id: { $ne: emp._id },
    status: "active",
  }).select("firstName lastName dateOfBirth joinDate designation avatar");

  const todayBirthdays = allEmps.filter(
    (e) =>
      e.dateOfBirth &&
      new Date(e.dateOfBirth).getMonth() === now.getMonth() &&
      new Date(e.dateOfBirth).getDate() === now.getDate(),
  );

  const todayAnniversaries = allEmps.filter(
    (e) =>
      e.joinDate &&
      new Date(e.joinDate).getMonth() === now.getMonth() &&
      new Date(e.joinDate).getDate() === now.getDate(),
  );

  // 2. Upcoming Holidays (next 30 days)
  const Holiday = require("../models/Holiday");
  const thirtyDaysLater = new Date(today);
  thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
  const upcomingHolidays = await Holiday.find({
    company: req.user.company,
    date: { $gte: today, $lte: thirtyDaysLater },
    isActive: true,
  }).sort({ date: 1 });

  // 3. Today's Shift
  const todayShift = emp.shift
    ? {
        name: emp.shift.name,
        startTime: emp.shift.startTime,
        endTime: emp.shift.endTime,
      }
    : {
        name: emp.shiftName || "General",
        startTime: "09:00",
        endTime: "18:00",
      };

  // 5. Pending Approvals Count (if manager/admin)
  let pendingApprovalsCount = 0;
  const isManager =
    ["super_admin", "hr_manager"].includes(req.user.role) ||
    (await Employee.exists({
      company: req.user.company,
      reportingTo: emp._id,
    }));

  if (isManager) {
    const Leave = require("../models/Leave");
    const AttendanceCorrectionRequest = require("../models/AttendanceCorrectionRequest");

    const isAdmin = ["super_admin", "hr_manager"].includes(req.user.role);
    let managerFilter = { company: req.user.company, status: "pending" };

    if (!isAdmin) {
      const reports = await Employee.find({ reportingTo: emp._id }).select(
        "_id",
      );
      const reportIds = reports.map((r) => r._id);
      managerFilter.employee = { $in: reportIds };
    }

    const [pendingLeaves, pendingCorrections] = await Promise.all([
      Leave.countDocuments(managerFilter).catch(() => 0),
      AttendanceCorrectionRequest.countDocuments(managerFilter).catch(() => 0),
    ]);

    pendingApprovalsCount = pendingLeaves + pendingCorrections;
  }

  // 6. Pending Salary
  const Payroll = require("../models/Payroll");
  const pendingSalary = await Payroll.find({
    employee: emp._id,
    status: { $ne: "paid" },
  }).sort({ year: -1, month: -1 });

  // 7. Company announcements
  const Announcement = require("../models/Announcement");
  const announcements = await Announcement.find({
    company: req.user.company,
    active: true,
  })
    .sort({ date: -1 })
    .limit(5);

  res.json({
    success: true,
    data: {
      birthdayWishes: {
        isTodayUserBirthday,
        todayBirthdays,
      },
      workAnniversary: {
        isTodayUserAnniversary,
        todayAnniversaries,
      },
      upcomingHolidays,
      todayShift,
      pendingApprovalsCount,
      pendingSalary,
      announcements,
    },
  });
});

// Payable-so-far vs. salary-to-date, plus attendance performance table.
// range: this | last | 3m | 6m | 1y  (3m/6m/1y include the current month)
const RANGES = ["this", "last", "3m", "6m", "1y"];
const summaryCache = new Map(); // key -> { at, data, pending }
const FRESH_MS = 60_000;

async function computeSummary(company, range, ym) {
  const { buildPayrollPreviews } = require("./payrollController");
  const now = new Date();
  const count =
    range === "3m" ? 3 : range === "6m" ? 6 : range === "1y" ? 12 : 1;
  const offset = range === "last" ? 1 : 0;
  const periods = ym
    ? [ym]
    : Array.from({ length: count }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - offset - i, 1);
        return { month: d.getMonth() + 1, year: d.getFullYear() };
      });

  const byEmp = new Map();
  let payable = 0;
  let actual = 0;
  const monthly = await Promise.all(
    periods.map(({ month, year }) =>
      buildPayrollPreviews(company, month, year),
    ),
  );
  for (const previews of monthly) {
    for (const p of previews) {
      payable += p.netSalary;
      actual += p.salaryToDate;
      const key = String(p.employee._id);
      const cur = byEmp.get(key) || {
        employee: p.employee,
        score: 0,
        expected: 0,
        payable: 0,
      };
      cur.score += Math.max(0, p.presentDays - p.halfDayCount * 0.5);
      cur.expected += p.elapsedWorkingDays;
      cur.payable += p.netSalary;
      byEmp.set(key, cur);
    }
  }

  const performance = [...byEmp.values()]
    .map((e) => ({
      employee: e.employee,
      percent:
        e.expected > 0
          ? Math.min(100, Math.round((e.score / e.expected) * 100))
          : 0,
      payable: Math.round(e.payable),
    }))
    .sort(
      (a, b) =>
        b.percent - a.percent ||
        a.employee.firstName.localeCompare(b.employee.firstName),
    );

  return {
    range,
    payable: Math.round(payable),
    actual: Math.round(actual),
    deducted: Math.round(Math.max(0, actual - payable)),
    performance,
  };
}

// Returns cached data instantly; recomputes in the background when stale.
function getSummary(company, range, ym) {
  const key = ym ? `${company}:${ym.year}-${ym.month}` : `${company}:${range}`;
  const entry = summaryCache.get(key) || {};
  const stale = !entry.at || Date.now() - entry.at > FRESH_MS;
  if (stale && !entry.pending) {
    entry.pending = computeSummary(company, range, ym)
      .then((data) => {
        summaryCache.set(key, { at: Date.now(), data });
        return data;
      })
      .catch((err) => {
        summaryCache.set(key, { ...entry, pending: null });
        throw err;
      });
    summaryCache.set(key, entry);
  }
  return entry.data ? Promise.resolve(entry.data) : entry.pending;
}

const getPayrollSummary = asyncHandler(async (req, res) => {
  const range = RANGES.includes(req.query.range) ? req.query.range : "this";
  const month = parseInt(req.query.month);
  const year = parseInt(req.query.year);
  const ym =
    month >= 1 && month <= 12 && year >= 2000 && year <= 2100
      ? { month, year }
      : undefined;
  const data = await getSummary(req.user.company, range, ym);
  res.json({ success: true, data });
});

// Fire-and-forget: pre-compute the default range so the first view is instant. The longer ranges (3m / 6m / 1y)
// rebuild a payroll preview per month for every employee, so they are computed on demand, not on every dashboard load.
function warmSummaries(company) {
  getSummary(company, "this").catch(() => {});
}

module.exports = { getStats, getEmployeeStats, getPayrollSummary };

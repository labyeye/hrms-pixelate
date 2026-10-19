const asyncHandler = require("express-async-handler");
const Performance = require("../models/Performance");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const Task = require("../models/Task");
const Loan = require("../models/Loan");
const Leave = require("../models/Leave");
const { safePagination } = require("../middleware/validate");

const REVIEW_TYPES = ["quarterly", "half_yearly", "annual", "probation"];
const REVIEW_STATUS = ["draft", "in_review", "completed"];

// Live performance score for one employee over [start, end): 50% attendance rate
// (present+late+half credit / total marked days) + 50% task completion rate
// (completed / assigned, scoped to tasks due or created in the period). If one
// side has no data, the other counts for the full weight instead of dragging
// the score down; if neither has data, there's no score to show yet.
async function computeLiveMetrics(emp, start, end) {
  const attendanceRecords = await Attendance.find({
    employee: emp._id,
    date: { $gte: start, $lt: end },
  }).select("status");

  let attendancePct = null;
  if (attendanceRecords.length > 0) {
    const credit = attendanceRecords.reduce((sum, r) => {
      if (r.status === "present" || r.status === "late") return sum + 1;
      if (r.status === "half_day") return sum + 0.5;
      return sum;
    }, 0);
    attendancePct = (credit / attendanceRecords.length) * 100;
  }

  const tasks = await Task.find({
    assignedTo: emp.user,
    $or: [
      { dueDate: { $gte: start, $lt: end } },
      { dueDate: null, createdAt: { $gte: start, $lt: end } },
    ],
  }).select("status");

  let taskPct = null;
  if (tasks.length > 0) {
    const completed = tasks.filter((t) => t.status === "completed").length;
    taskPct = (completed / tasks.length) * 100;
  }

  let score = null;
  if (attendancePct != null && taskPct != null) {
    score = attendancePct * 0.5 + taskPct * 0.5;
  } else if (attendancePct != null) {
    score = attendancePct;
  } else if (taskPct != null) {
    score = taskPct;
  }

  return {
    employeeId: emp._id,
    attendancePct: attendancePct != null ? Math.round(attendancePct) : null,
    taskPct: taskPct != null ? Math.round(taskPct) : null,
    score: score != null ? Math.round(score) : null,
    presentDays: attendanceRecords.length,
    totalTasks: tasks.length,
    completedTasks: tasks.filter((t) => t.status === "completed").length,
  };
}

const getLiveMetrics = asyncHandler(async (req, res) => {
  const { month, year, employeeId } = req.query;
  const now = new Date();
  const y = parseInt(year) || now.getFullYear();
  const m = parseInt(month) || now.getMonth() + 1;
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  if (req.user.role === "employee") {
    let selfEmp = await Employee.findOne({ user: req.user._id });
    if (!selfEmp && req.user.email) {
      selfEmp = await Employee.findOne({
        email: req.user.email.toLowerCase(),
        company: req.user.company,
      });
    }
    if (!selfEmp) return res.json({ success: true, data: null });
    const metrics = await computeLiveMetrics(selfEmp, start, end);
    return res.json({
      success: true,
      data: {
        ...metrics,
        firstName: selfEmp.firstName,
        lastName: selfEmp.lastName,
        avatar: selfEmp.avatar,
      },
    });
  }

  if (employeeId) {
    const emp = await Employee.findOne({
      _id: employeeId,
      company: req.user.company,
    });
    if (!emp) return res.json({ success: true, data: null });
    const metrics = await computeLiveMetrics(emp, start, end);
    return res.json({
      success: true,
      data: {
        ...metrics,
        firstName: emp.firstName,
        lastName: emp.lastName,
        avatar: emp.avatar,
      },
    });
  }

  const employees = await Employee.find({
    company: req.user.company,
    status: "active",
  }).select("firstName lastName user avatar designation");

  const data = await Promise.all(
    employees.map(async (emp) => ({
      ...(await computeLiveMetrics(emp, start, end)),
      firstName: emp.firstName,
      lastName: emp.lastName,
      avatar: emp.avatar,
      designation: emp.designation,
    })),
  );

  res.json({ success: true, data });
});

// Everything that feeds an employee's performance, for ALL active employees in one go (HR / admin view):
// attendance split + hours + overtime, task completion, loans, approved leave and review rating, plus the live score.
// 5 aggregates for the whole company instead of 5 queries per employee.
const getOverview = asyncHandler(async (req, res) => {
  const now = new Date();
  const y = parseInt(req.query.year) || now.getFullYear();
  const m = parseInt(req.query.month) || now.getMonth() + 1;
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 1);

  const employees = await Employee.find({ company: req.user.company, status: "active" })
    .select("firstName lastName employeeId avatar designation salary user joinDate department")
    .populate("department", "name")
    .sort({ employeeId: 1 });
  const empIds = employees.map((e) => e._id);
  const userIds = employees.map((e) => e.user).filter(Boolean);

  const [att, tasks, loans, leaves, reviews] = await Promise.all([
    Attendance.aggregate([
      { $match: { employee: { $in: empIds }, date: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: "$employee",
          present: { $sum: { $cond: [{ $eq: ["$status", "present"] }, 1, 0] } },
          late: { $sum: { $cond: [{ $eq: ["$status", "late"] }, 1, 0] } },
          halfDay: { $sum: { $cond: [{ $eq: ["$status", "half_day"] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ["$status", "absent"] }, 1, 0] } },
          onLeave: { $sum: { $cond: [{ $eq: ["$status", "on_leave"] }, 1, 0] } },
          early: { $sum: { $cond: ["$earlyLeaving", 1, 0] } },
          workHours: { $sum: "$workHours" },
          overtime: { $sum: "$overtime" },
        },
      },
    ]),
    Task.aggregate([
      {
        $match: {
          assignedTo: { $in: userIds },
          $or: [{ dueDate: { $gte: start, $lt: end } }, { dueDate: null, createdAt: { $gte: start, $lt: end } }],
        },
      },
      {
        $group: {
          _id: "$assignedTo",
          total: { $sum: 1 },
          done: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          late: { $sum: { $cond: ["$late", 1, 0] } },
        },
      },
    ]),
    Loan.aggregate([
      { $match: { employee: { $in: empIds }, status: { $in: ["active", "paused"] } } },
      { $group: { _id: "$employee", count: { $sum: 1 }, balance: { $sum: "$remainingBalance" }, emi: { $sum: "$monthlyEmi" } } },
    ]),
    Leave.aggregate([
      { $match: { employee: { $in: empIds }, status: "approved", startDate: { $lt: end }, endDate: { $gte: start } } },
      { $group: { _id: "$employee", days: { $sum: "$days" } } },
    ]),
    Performance.aggregate([
      { $match: { employee: { $in: empIds }, year: y, overallRating: { $gte: 1 } } },
      { $group: { _id: "$employee", rating: { $avg: "$overallRating" } } },
    ]),
  ]);
  const by = (rows) => new Map(rows.map((r) => [String(r._id), r]));
  const attM = by(att), taskM = by(tasks), loanM = by(loans), leaveM = by(leaves), revM = by(reviews);

  const data = employees.map((e) => {
    const a = attM.get(String(e._id)) || {};
    const t = taskM.get(String(e.user)) || {};
    const l = loanM.get(String(e._id)) || {};
    const marked = (a.present || 0) + (a.late || 0) + (a.halfDay || 0) + (a.absent || 0) + (a.onLeave || 0);
    const attendancePct = marked ? ((((a.present || 0) + (a.late || 0) + (a.halfDay || 0) * 0.5) / marked) * 100) : null;
    const taskPct = t.total ? (t.done / t.total) * 100 : null;
    const score =
      attendancePct != null && taskPct != null ? attendancePct * 0.5 + taskPct * 0.5 : attendancePct ?? taskPct;
    const r = (v) => (v == null ? null : Math.round(v));
    return {
      _id: e._id,
      employeeCode: e.employeeId,
      firstName: e.firstName,
      lastName: e.lastName,
      avatar: e.avatar,
      designation: e.designation,
      department: e.department?.name || "",
      salary: e.salary || 0,
      joinDate: e.joinDate,
      present: a.present || 0,
      late: a.late || 0,
      halfDay: a.halfDay || 0,
      absent: a.absent || 0,
      onLeave: a.onLeave || 0,
      earlyLeaving: a.early || 0,
      markedDays: marked,
      workHours: Math.round((a.workHours || 0) * 10) / 10,
      overtimeHours: Math.round((a.overtime || 0) * 10) / 10,
      leaveDays: leaveM.get(String(e._id))?.days || 0,
      attendancePct: r(attendancePct),
      tasksTotal: t.total || 0,
      tasksDone: t.done || 0,
      tasksLate: t.late || 0,
      taskPct: r(taskPct),
      hasLoan: (l.count || 0) > 0,
      loanCount: l.count || 0,
      loanBalance: l.balance || 0,
      loanEmi: l.emi || 0,
      reviewRating: revM.get(String(e._id)) ? Math.round(revM.get(String(e._id)).rating * 10) / 10 : null,
      score: r(score),
    };
  });

  res.json({ success: true, data, month: m, year: y });
});

const getReviews = asyncHandler(async (req, res) => {
  const { limit, skip } = safePagination(req.query);
  const { employeeId, year, status } = req.query;

  const filter = { company: req.user.company };
  if (year) {
    const y = parseInt(year);
    if (!isNaN(y)) filter.year = y;
  }
  if (status && REVIEW_STATUS.includes(status)) filter.status = status;

  if (employeeId) {
    const emp = await Employee.findOne({
      _id: employeeId,
      company: req.user.company,
    });
    if (!emp) return res.json({ success: true, data: [] });
    filter.employee = employeeId;
  }

  const reviews = await Performance.find(filter)
    .populate({
      path: "employee",
      select: "firstName lastName designation",
      populate: { path: "department", select: "name" },
    })
    .populate("reviewedBy", "name")
    .sort({ year: -1 })
    .skip(skip)
    .limit(limit);

  res.json({ success: true, data: reviews });
});

const createReview = asyncHandler(async (req, res) => {
  const {
    employee,
    reviewPeriod,
    year,
    quarter,
    reviewType,
    goals,
    overallRating,
    strengths,
    areasOfImprovement,
    reviewerComments,
  } = req.body;

  if (!employee || !reviewPeriod || !year) {
    res.status(400);
    throw new Error("employee, reviewPeriod, and year are required");
  }

  const emp = await Employee.findOne({
    _id: employee,
    company: req.user.company,
  });
  if (!emp) {
    res.status(404);
    throw new Error("Employee not found");
  }

  if (overallRating !== undefined && (overallRating < 1 || overallRating > 5)) {
    res.status(400);
    throw new Error("Rating must be between 1 and 5");
  }

  const review = await Performance.create({
    company: req.user.company,
    employee,
    reviewPeriod: String(reviewPeriod).slice(0, 100),
    year: parseInt(year),
    quarter: quarter ? parseInt(quarter) : undefined,
    reviewType:
      reviewType && REVIEW_TYPES.includes(reviewType) ? reviewType : "annual",
    goals: Array.isArray(goals) ? goals.slice(0, 20) : [],
    overallRating: overallRating || undefined,
    strengths: strengths ? String(strengths).slice(0, 1000) : undefined,
    areasOfImprovement: areasOfImprovement
      ? String(areasOfImprovement).slice(0, 1000)
      : undefined,
    reviewerComments: reviewerComments
      ? String(reviewerComments).slice(0, 1000)
      : undefined,
    reviewedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: review });
});

const updateReview = asyncHandler(async (req, res) => {
  const review = await Performance.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!review) {
    res.status(404);
    throw new Error("Review not found");
  }

  const allowed = [
    "reviewPeriod",
    "year",
    "quarter",
    "reviewType",
    "goals",
    "overallRating",
    "strengths",
    "areasOfImprovement",
    "reviewerComments",
    "employeeComments",
    "status",
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) review[key] = req.body[key];
  }
  if (req.body.status === "completed") {
    review.reviewedBy = req.user._id;
    review.reviewedAt = new Date();
  }

  await review.save();
  res.json({ success: true, data: review });
});

module.exports = { getReviews, createReview, updateReview, getLiveMetrics, getOverview };

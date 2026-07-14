const asyncHandler = require("express-async-handler");
const Performance = require("../models/Performance");
const Employee = require("../models/Employee");
const Attendance = require("../models/Attendance");
const Task = require("../models/Task");
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
      data: { ...metrics, firstName: emp.firstName, lastName: emp.lastName },
    });
  }

  const employees = await Employee.find({
    company: req.user.company,
    status: "active",
  }).select("firstName lastName user");

  const data = await Promise.all(
    employees.map(async (emp) => ({
      ...(await computeLiveMetrics(emp, start, end)),
      firstName: emp.firstName,
      lastName: emp.lastName,
    })),
  );

  res.json({ success: true, data });
});

const getReviews = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
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

module.exports = { getReviews, createReview, updateReview, getLiveMetrics };

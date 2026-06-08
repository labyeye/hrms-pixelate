const asyncHandler = require("express-async-handler");
const Performance = require("../models/Performance");
const Employee = require("../models/Employee");
const { safePagination } = require("../middleware/validate");

const REVIEW_TYPES = ["quarterly", "half_yearly", "annual", "probation"];
const REVIEW_STATUS = ["draft", "in_review", "completed"];

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

module.exports = { getReviews, createReview, updateReview };

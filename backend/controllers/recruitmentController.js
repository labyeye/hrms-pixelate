const asyncHandler = require("express-async-handler");
const Recruitment = require("../models/Recruitment");
const { safePagination } = require("../middleware/validate");

const JOB_TYPES = ["full_time", "part_time", "contract", "intern"];
const JOB_STATUS = ["open", "on_hold", "closed", "cancelled"];
const JOB_PRIORITY = ["low", "medium", "high", "urgent"];
const CAND_STAGES = [
  "applied",
  "screening",
  "interview",
  "technical",
  "hr_round",
  "offered",
  "hired",
  "rejected",
];

const getJobs = asyncHandler(async (req, res) => {
  const { page, limit, skip } = safePagination(req.query);
  const { status, department } = req.query;

  const filter = { company: req.user.company };
  if (status && JOB_STATUS.includes(status)) filter.status = status;
  if (department) filter.department = department;

  const total = await Recruitment.countDocuments(filter);
  const jobs = await Recruitment.find(filter)
    .populate("department", "name")
    .populate("postedBy", "name")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit);

  res.json({
    success: true,
    data: jobs,
    total,
    page,
    pages: Math.ceil(total / limit),
  });
});

const createJob = asyncHandler(async (req, res) => {
  const {
    title,
    department,
    positions,
    type,
    priority,
    description,
    requirements,
    minSalary,
    maxSalary,
    location,
    closingDate,
  } = req.body;

  if (!title || typeof title !== "string" || title.trim().length < 2) {
    res.status(400);
    throw new Error("Job title is required (min 2 chars)");
  }

  const job = await Recruitment.create({
    company: req.user.company,
    title: title.trim().slice(0, 200),
    department: department || undefined,
    positions: positions ? Math.max(1, parseInt(positions)) : 1,
    type: type && JOB_TYPES.includes(type) ? type : "full_time",
    status: "open",
    priority: priority && JOB_PRIORITY.includes(priority) ? priority : "medium",
    description: description ? String(description).slice(0, 5000) : undefined,
    requirements: requirements
      ? String(requirements).slice(0, 5000)
      : undefined,
    minSalary: minSalary ? Number(minSalary) : undefined,
    maxSalary: maxSalary ? Number(maxSalary) : undefined,
    location: location ? String(location).slice(0, 200) : undefined,
    closingDate: closingDate || undefined,
    postedBy: req.user._id,
  });

  res.status(201).json({ success: true, data: job });
});

const updateJob = asyncHandler(async (req, res) => {
  const job = await Recruitment.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!job) {
    res.status(404);
    throw new Error("Job not found");
  }

  const allowed = [
    "title",
    "department",
    "positions",
    "type",
    "status",
    "priority",
    "description",
    "requirements",
    "minSalary",
    "maxSalary",
    "location",
    "closingDate",
  ];
  for (const key of allowed) {
    if (req.body[key] !== undefined) job[key] = req.body[key];
  }

  await job.save();
  res.json({ success: true, data: job });
});

const addCandidate = asyncHandler(async (req, res) => {
  const job = await Recruitment.findOne({
    _id: req.params.id,
    company: req.user.company,
  });
  if (!job) {
    res.status(404);
    throw new Error("Job not found");
  }

  const { name, email, phone, resumeUrl, notes } = req.body;
  if (!name || !email) {
    res.status(400);
    throw new Error("Candidate name and email are required");
  }

  job.candidates.push({
    name: String(name).slice(0, 100),
    email: String(email).slice(0, 200),
    phone: phone ? String(phone).slice(0, 20) : undefined,
    resumeUrl: resumeUrl ? String(resumeUrl).slice(0, 500) : undefined,
    notes: notes ? String(notes).slice(0, 1000) : undefined,
    stage: "applied",
  });

  await job.save();
  res.json({ success: true, data: job });
});

const updateCandidateStage = asyncHandler(async (req, res) => {
  const { stage } = req.body;
  if (!stage || !CAND_STAGES.includes(stage)) {
    res.status(400);
    throw new Error("Invalid candidate stage");
  }

  const job = await Recruitment.findOneAndUpdate(
    {
      _id: req.params.id,
      company: req.user.company,
      "candidates._id": req.params.candidateId,
    },
    { $set: { "candidates.$.stage": stage } },
    { new: true },
  );
  if (!job) {
    res.status(404);
    throw new Error("Job or candidate not found");
  }

  res.json({ success: true, data: job });
});

module.exports = {
  getJobs,
  createJob,
  updateJob,
  addCandidate,
  updateCandidateStage,
};

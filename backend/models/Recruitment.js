const mongoose = require("mongoose");

const candidateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String },
  resumeUrl: { type: String },
  stage: {
    type: String,
    enum: [
      "applied",
      "screening",
      "interview",
      "technical",
      "hr_round",
      "offered",
      "hired",
      "rejected",
    ],
    default: "applied",
  },
  notes: { type: String },
  appliedAt: { type: Date, default: Date.now },
});

const recruitmentSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    title: { type: String, required: true },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    positions: { type: Number, default: 1 },
    type: {
      type: String,
      enum: ["full_time", "part_time", "contract", "intern"],
      default: "full_time",
    },
    status: {
      type: String,
      enum: ["open", "on_hold", "closed", "cancelled"],
      default: "open",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },
    description: { type: String },
    requirements: { type: String },
    minSalary: { type: Number },
    maxSalary: { type: Number },
    location: { type: String },
    candidates: [candidateSchema],
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    closingDate: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Recruitment", recruitmentSchema);

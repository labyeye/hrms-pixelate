const mongoose = require("mongoose");

const performanceSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    reviewPeriod: { type: String, required: true },
    year: { type: Number, required: true },
    quarter: { type: Number },
    reviewType: {
      type: String,
      enum: ["quarterly", "half_yearly", "annual", "probation"],
      default: "annual",
    },
    goals: [
      {
        title: { type: String },
        description: { type: String },
        target: { type: String },
        achieved: { type: String },
        rating: { type: Number, min: 1, max: 5 },
      },
    ],
    overallRating: { type: Number, min: 1, max: 5 },
    strengths: { type: String },
    areasOfImprovement: { type: String },
    reviewerComments: { type: String },
    employeeComments: { type: String },
    status: {
      type: String,
      enum: ["draft", "in_review", "completed"],
      default: "draft",
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Performance", performanceSchema);

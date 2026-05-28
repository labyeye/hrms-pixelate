const mongoose = require("mongoose");

const deductionRuleSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
    },
    // Shift start time (used to determine lateness)
    shiftStartHour: { type: Number, default: 9 },
    shiftStartMinute: { type: Number, default: 0 },

    // Late deduction — applies when employee arrives after shiftStart + lateThresholdMinutes
    lateThresholdMinutes: { type: Number, default: 15 },
    lateDeductionType: {
      type: String,
      enum: ["fixed", "percent"],
      default: "fixed",
    },
    lateDeductionAmount: { type: Number, default: 0 }, // ₹ fixed or % of daily salary

    // Half-day deduction — when late by more than halfDayThresholdMinutes
    halfDayThresholdMinutes: { type: Number, default: 120 },
    halfDayDeductionPercent: { type: Number, default: 50 }, // % of daily salary

    // Absent deduction — per absent day
    absentDeductionType: {
      type: String,
      enum: ["fixed", "percent"],
      default: "percent",
    },
    absentDeductionAmount: { type: Number, default: 100 }, // ₹ fixed or % of daily salary
  },
  { timestamps: true },
);

module.exports = mongoose.model("DeductionRule", deductionRuleSchema);

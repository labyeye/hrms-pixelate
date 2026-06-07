const mongoose = require("mongoose");

const deductionRuleSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
    },
    // Shift start time (fallback when employee has no shift assigned)
    shiftStartHour: { type: Number, default: 9 },
    shiftStartMinute: { type: Number, default: 0 },

    // Shift end time (fallback for early checkout detection)
    shiftEndHour: { type: Number, default: 18 },
    shiftEndMinute: { type: Number, default: 0 },

    // Late deduction — applies when employee arrives after shiftStart + lateThresholdMinutes
    lateThresholdMinutes: { type: Number, default: 15 },
    lateDeductionType: {
      type: String,
      enum: ["fixed", "percent"],
      default: "fixed",
    },
    lateDeductionAmount: { type: Number, default: 0 }, // ₹ fixed or % of daily salary

    // Half-day — when late by more than halfDayThresholdMinutes, counts as 0.5 days
    halfDayThresholdMinutes: { type: Number, default: 120 },

    // Early checkout deduction
    earlyCheckoutThresholdMinutes: { type: Number, default: 15 },
    earlyCheckoutDeductionEnabled: { type: Boolean, default: false },
  },
  { timestamps: true },
);

module.exports = mongoose.model("DeductionRule", deductionRuleSchema);

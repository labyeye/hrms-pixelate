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

    // ── Shift End Time (for early checkout detection) ─────────────────────────
    shiftEndHour: { type: Number, default: 18 },
    shiftEndMinute: { type: Number, default: 0 },

    // ── Early Checkout Deduction ──────────────────────────────────────────────
    // If employee checks out more than earlyCheckoutThresholdMinutes before shift end
    earlyCheckoutThresholdMinutes: { type: Number, default: 15 },
    earlyCheckoutDeductionEnabled: { type: Boolean, default: false },

    // ── Work Week ─────────────────────────────────────────────────────────────
    // Used to calculate actual working days in a month (daily salary basis)
    workWeek: {
      type: String,
      enum: ["mon_fri", "mon_sat"],
      default: "mon_sat",
    },

    // ── Statutory Deductions (each can be disabled) ───────────────────────────
    enablePf: { type: Boolean, default: true },
    pfRate: { type: Number, default: 12 }, // % of basic

    enableEsi: { type: Boolean, default: true },
    esiRate: { type: Number, default: 1.75 }, // %
    esiGrossLimit: { type: Number, default: 21000 }, // ₹/month; 0 = always apply

    enableTds: { type: Boolean, default: false },
    tdsRate: { type: Number, default: 10 }, // %
    tdsTaxableThreshold: { type: Number, default: 50000 }, // ₹/month

    // ── Default Salary Component Percentages ─────────────────────────────────
    defaultHraPct: { type: Number, default: 40 }, // % of basic
    defaultDaPct: { type: Number, default: 10 },  // % of basic
    defaultTa: { type: Number, default: 1500 },    // ₹ fixed per month
  },
  { timestamps: true },
);

module.exports = mongoose.model("DeductionRule", deductionRuleSchema);

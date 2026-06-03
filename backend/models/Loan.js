const mongoose = require("mongoose");

const loanSchema = new mongoose.Schema(
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
    type: { type: String, enum: ["loan", "advance"], default: "loan" },
    amount: { type: Number, required: true },
    remainingBalance: { type: Number, required: true },
    monthlyEmi: { type: Number, default: 0 },
    reason: { type: String, default: "" },
    disbursedOn: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: ["active", "cleared", "paused"],
      default: "active",
    },
    clearedOn: { type: Date },
    remarks: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Loan", loanSchema);

const mongoose = require("mongoose");

const stepSchema = new mongoose.Schema(
  {
    role: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    by: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    at: Date,
    note: { type: String, default: "" },
  },
  { _id: false },
);

const expenseSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: {
      type: String,
      enum: ["travel", "food", "fuel", "lodging", "internet_phone", "office", "other"],
      default: "other",
    },
    amount: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    notes: { type: String, default: "", maxlength: 500 },
    bill: { type: String, default: "" }, // filename in uploads/expense-bills (authenticated download only)
    steps: [stepSchema],
    // pending: waiting on steps; approved: all steps done, queued for payroll; paid: picked up by payroll / settled
    status: { type: String, enum: ["pending", "approved", "rejected", "paid"], default: "pending" },
    transaction: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
  },
  { timestamps: true },
);

expenseSchema.index({ company: 1, status: 1, date: -1 });

module.exports = mongoose.model("Expense", expenseSchema);

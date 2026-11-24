const mongoose = require("mongoose");

// Company's own spending ledger (rent, vendors, supplies...). Not staff claims: those are Reimbursements (models/Expense.js).
const companyExpenseSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    category: {
      type: String,
      enum: ["rent", "utilities", "salaries_misc", "marketing", "software", "office", "travel", "maintenance", "taxes_fees", "other"],
      default: "other",
    },
    amount: { type: Number, required: true, min: 1 },
    date: { type: Date, required: true },
    vendor: { type: String, default: "", maxlength: 100 },
    paymentMode: { type: String, enum: ["bank_transfer", "upi", "cash", "cheque", "card"], default: "bank_transfer" },
    reference: { type: String, default: "", maxlength: 100 },
    notes: { type: String, default: "", maxlength: 500 },
    bills: [{ type: String }], // filenames in uploads/expense-bills
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

companyExpenseSchema.index({ company: 1, date: -1 });

module.exports = mongoose.model("CompanyExpense", companyExpenseSchema);

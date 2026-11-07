const mongoose = require("mongoose");

const taxDeclarationSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee", required: true },
    fy: { type: Number, required: true }, // starting year: 2025 = FY 2025-26
    regime: { type: String, enum: ["new", "old"], default: "new" },
    sec80C: { type: Number, default: 0, min: 0 },
    sec80D: { type: Number, default: 0, min: 0 },
    hraRentPaid: { type: Number, default: 0, min: 0 }, // annual rent
    homeLoanInterest: { type: Number, default: 0, min: 0 },
    otherDeductions: { type: Number, default: 0, min: 0 },
    proofNote: { type: String, default: "", maxlength: 500 },
    status: { type: String, enum: ["submitted", "verified", "rejected"], default: "submitted" },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    remark: { type: String, default: "" },
  },
  { timestamps: true },
);

taxDeclarationSchema.index({ employee: 1, fy: 1 }, { unique: true });

module.exports = mongoose.model("TaxDeclaration", taxDeclarationSchema);

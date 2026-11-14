const mongoose = require("mongoose");

// One row per salary change (promotion / increment / correction). The employee's current salary lives on
// Employee.salary; this is the readable history behind it, with the reason, and feeds the monthly report.
const salaryRevisionSchema = new mongoose.Schema(
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
    effectiveDate: { type: Date, required: true, default: Date.now },
    previousSalary: { type: Number, required: true, min: 0 },
    newSalary: { type: Number, required: true, min: 0 },
    changeAmount: { type: Number, required: true }, // newSalary - previousSalary (negative for a decrease)
    changePct: { type: Number, default: 0 }, // vs previousSalary, 1 decimal
    // promotion = designation changed too; increment = salary up; decrease = salary down
    kind: {
      type: String,
      enum: ["promotion", "increment", "decrease"],
      required: true,
    },
    reason: { type: String, required: true, trim: true, maxlength: 300 }, // shown to the employee
    previousDesignation: { type: String },
    newDesignation: { type: String }, // only set when the designation actually changed
    remarks: { type: String, trim: true, maxlength: 1000 }, // internal note, admin/HR only
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdByName: { type: String },
  },
  { timestamps: true },
);

salaryRevisionSchema.index({ company: 1, effectiveDate: -1 });
salaryRevisionSchema.index({ employee: 1, effectiveDate: 1 });

module.exports = mongoose.model("SalaryRevision", salaryRevisionSchema);

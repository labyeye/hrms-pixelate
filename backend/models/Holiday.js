const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    type: {
      type: String,
      enum: ["national", "optional", "restricted"],
      default: "national",
    },
    description: { type: String },
    // Who the holiday applies to: whole company, selected departments, or a list of employees.
    scope: {
      type: String,
      enum: ["all", "departments", "employees"],
      default: "all",
    },
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],
    employees: [{ type: mongoose.Schema.Types.ObjectId, ref: "Employee" }],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

holidaySchema.index({ company: 1, date: 1 });

module.exports = mongoose.model("Holiday", holidaySchema);

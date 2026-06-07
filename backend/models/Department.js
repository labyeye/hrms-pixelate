const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true },
    head: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    description: { type: String },
    headcount: { type: Number, default: 0 },
    budget: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    shiftStartTime: { type: String }, // "HH:MM" e.g. "09:00"
    shiftEndTime: { type: String }, // "HH:MM" e.g. "18:00"
  },
  { timestamps: true },
);

module.exports = mongoose.model("Department", departmentSchema);

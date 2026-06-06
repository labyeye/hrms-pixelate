const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
    },
    date: { type: Date, required: true },
    checkIn: { type: Date },
    checkOut: { type: Date },
    status: {
      type: String,
      enum: [
        "present",
        "absent",
        "half_day",
        "late",
        "on_leave",
        "holiday",
        "weekend",
      ],
      default: "absent",
    },
    workHours: { type: Number, default: 0 },
    overtime: { type: Number, default: 0 },
    notes: { type: String },
    markedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    verifyMode: {
      type: String,
      enum: ["fingerprint", "card", "face", "password", "manual"],
      default: "manual",
    },
  },
  { timestamps: true },
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);

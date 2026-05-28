const mongoose = require("mongoose");

const biometricLogSchema = new mongoose.Schema(
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
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BiometricDevice",
      required: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BiometricLocation",
      required: true,
    },
    method: { type: String, enum: ["nfc", "face", "pin"], required: true },
    type: { type: String, enum: ["check_in", "check_out"], required: true },
    nfcUid: { type: String },
    attendance: { type: mongoose.Schema.Types.ObjectId, ref: "Attendance" },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

module.exports = mongoose.model("BiometricLog", biometricLogSchema);

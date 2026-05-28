const mongoose = require("mongoose");
const crypto = require("crypto");

const nfcCardSchema = new mongoose.Schema({
  uid: { type: String, required: true },
  employee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Employee",
    required: true,
  },
  label: { type: String },
  assignedAt: { type: Date, default: Date.now },
});

const biometricDeviceSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BiometricLocation",
      required: true,
    },
    name: { type: String, required: true, trim: true },
    deviceToken: { type: String, unique: true },
    nfcCards: [nfcCardSchema],
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date },
  },
  { timestamps: true },
);

biometricDeviceSchema.pre("save", function (next) {
  if (!this.deviceToken) {
    this.deviceToken = crypto.randomBytes(32).toString("hex");
  }
  next();
});

module.exports = mongoose.model("BiometricDevice", biometricDeviceSchema);

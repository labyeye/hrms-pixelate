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
    // Serial number the ESSL/ZKTeco device sends in ADMS requests (SN= query param)
    serialNumber: { type: String, default: "", index: true },
    // Long-lived secret used by device for all API calls
    deviceToken: { type: String, unique: true },
    // Short code shown to admin — hardware device/agent calls /register once with this
    activationCode: { type: String, unique: true, sparse: true },
    activated: { type: Boolean, default: false },
    activatedAt: { type: Date },
    deviceMeta: {
      model: { type: String, default: "" },
      mac: { type: String, default: "" },
      ip: { type: String, default: "" },
    },
    nfcCards: [nfcCardSchema],
    isActive: { type: Boolean, default: true },
    lastSeenAt: { type: Date },
    attlogStamp: { type: Number, default: 0 }, // last ATTLOG Stamp ACK'd — device only sends newer records
  },
  { timestamps: true },
);

biometricDeviceSchema.pre("save", function (next) {
  if (!this.deviceToken) {
    this.deviceToken = crypto.randomBytes(32).toString("hex");
  }
  if (!this.activationCode) {
    // 8-char uppercase alphanumeric — easy to type into a device web panel
    this.activationCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  }
  next();
});

module.exports = mongoose.model("BiometricDevice", biometricDeviceSchema);

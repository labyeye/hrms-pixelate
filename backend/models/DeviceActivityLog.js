const mongoose = require("mongoose");

// One row per request an ADMS/ESSL hardware device makes to the server (handshake, punch push, command poll,
// command result...) together with what the server answered. Auto-deleted after 30 days.
const deviceActivityLogSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      index: true,
    },
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BiometricDevice",
      index: true,
    },
    serialNumber: { type: String, index: true },
    event: {
      type: String,
      enum: [
        "handshake", // device GET /cdata - asks for server options
        "attlog_push", // device pushed punches
        "biodata_push", // device pushed a face/finger template
        "command_poll", // device GET /getrequest
        "command_sent", // server handed a queued command to the device
        "command_result", // device POST /devicecmd with the outcome
        "unknown_device", // request from a serial number we do not know
        "error",
      ],
      required: true,
    },
    status: { type: String, enum: ["ok", "warn", "error"], default: "ok" },
    summary: { type: String },
    records: { type: Number }, // punches received / processed
    requestData: { type: String }, // raw payload from device (truncated)
    responseData: { type: String }, // what the server replied (truncated)
    deviceReturnCode: { type: String }, // device's own Return= code for commands
    ip: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

deviceActivityLogSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 30 * 24 * 3600 },
);

module.exports = mongoose.model("DeviceActivityLog", deviceActivityLogSchema);

const mongoose = require("mongoose");

// Queue of commands to push from HRMS → ESSL/ZKTeco device via ADMS protocol.
// Device polls GET /iclock/getrequest; server responds with next pending command.
// Device executes it, then POST /iclock/devicecmd to report result.
const biometricCommandSchema = new mongoose.Schema(
  {
    device: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BiometricDevice",
      required: true,
      index: true,
    },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    // Unique numeric ID sent to device; device echoes it back in response
    cmdId: { type: Number, required: true },
    // Raw ADMS command string, e.g. "DATA UPDATE USERINFO PIN=1\tName=John\tCard=ABC123\t"
    command: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "sent", "done", "failed"],
      default: "pending",
      index: true,
    },
    sentAt: { type: Date },
    doneAt: { type: Date },
    returnCode: { type: String },
    // The employee this command relates to (for audit / retry)
    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    type: {
      type: String,
      enum: ["SET_USER", "DELETE_USER", "CLEAR_DATA", "SET_TIME"],
      required: true,
    },
  },
  { timestamps: true },
);

// Auto-expire done/failed commands after 7 days
biometricCommandSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 604800,
    partialFilterExpression: { status: { $in: ["done", "failed"] } },
  },
);

module.exports = mongoose.model("BiometricCommand", biometricCommandSchema);

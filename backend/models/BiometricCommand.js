const mongoose = require("mongoose");

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

    cmdId: { type: Number, required: true },

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

    employee: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    type: {
      type: String,
      enum: ["SET_USER", "DELETE_USER", "CLEAR_DATA", "SET_TIME"],
      required: true,
    },
  },
  { timestamps: true },
);

biometricCommandSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: 604800,
    partialFilterExpression: { status: { $in: ["done", "failed"] } },
  },
);

module.exports = mongoose.model("BiometricCommand", biometricCommandSchema);

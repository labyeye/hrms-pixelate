const mongoose = require("mongoose");

const trashSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    modelName: {
      type: String,
      required: true,
      enum: ["Leave", "Task", "Announcement", "EmployeeDocument"],
    },
    originalId: { type: mongoose.Schema.Types.ObjectId, required: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deletedByName: { type: String, default: "" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Trash", trashSchema);

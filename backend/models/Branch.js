const mongoose = require("mongoose");

const branchSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    name: { type: String, required: true },
    location: { type: String, default: "" },
    address: { type: String, default: "" },
    manager: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Branch", branchSchema);

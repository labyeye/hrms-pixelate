const mongoose = require("mongoose");

// Work item for the on-site Hikvision agent: "create this person" / "upload this face".
const schema = new mongoose.Schema(
  {
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true, index: true },
    type: { type: String, enum: ["user", "face"], required: true },
    employeeId: { type: String, required: true },
    name: { type: String, default: "" },
    image: { type: String }, // base64 JPEG for type "face"
    status: { type: String, enum: ["pending", "sent", "done", "failed"], default: "pending", index: true },
    error: String,
    sentAt: Date,
    createdAt: { type: Date, default: Date.now, expires: 7 * 24 * 3600 },
  },
  { versionKey: false },
);

module.exports = mongoose.model("HikvisionJob", schema);

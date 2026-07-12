const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true },
    date: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    category: {
      type: String,
      enum: ["general", "policy", "urgent", "event", "holiday", "hr"],
      default: "general",
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    pinned: { type: Boolean, default: false },
    expiryDate: { type: Date, default: null },
    targetAudience: {
      type: String,
      enum: ["all", "department", "role"],
      default: "all",
    },
    departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Department" }],
    roles: [{ type: String }],
    acknowledgementRequired: { type: Boolean, default: false },
    acknowledgedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    attachments: [
      {
        name: { type: String, required: true },
        url: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Announcement", announcementSchema);

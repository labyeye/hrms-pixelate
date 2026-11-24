const mongoose = require("mongoose");

const taskSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: "", maxlength: 2000 },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed"],
      default: "pending",
    },
    dueDate: { type: Date },
    startDate: { type: Date },
    estimatedHours: { type: Number, min: 0, max: 1000 },
    tags: [{ type: String, trim: true, maxlength: 30 }],
    // Step-by-step instructions (what exactly to do), separate from the short description
    instructions: { type: String, default: "", maxlength: 5000 },
    checklist: [
      {
        text: { type: String, required: true, trim: true, maxlength: 200 },
        done: { type: Boolean, default: false },
        doneBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        doneAt: Date,
      },
    ],
    // reference = material from the assigner (images, videos, docs to work from);
    // work = what the assignee submits back (deliverables, proof of work)
    attachments: [
      {
        name: { type: String, required: true, maxlength: 200 },
        file: { type: String, required: true }, // stored name in uploads/task-files (authenticated access only)
        mime: { type: String, required: true },
        size: { type: Number, default: 0 },
        kind: { type: String, enum: ["image", "video", "document"], required: true },
        purpose: { type: String, enum: ["reference", "work"], default: "reference" },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    late: { type: Boolean, default: false },
    lateMarkedAt: { type: Date },
    statusHistory: [
      {
        status: {
          type: String,
          enum: ["pending", "in_progress", "completed"],
          required: true,
        },
        changedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        changedAt: { type: Date, default: Date.now },
      },
    ],
    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Task", taskSchema);

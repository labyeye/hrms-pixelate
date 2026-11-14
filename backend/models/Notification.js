const mongoose = require("mongoose");

// One row per recipient: the in-app inbox. Push delivery is best-effort on top of this.
const schema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company", required: true },
    // e.g. leave_request, leave_approved, leave_rejected, check_in, check_out, late_approval, expense, loan
    type: { type: String, required: true },
    title: { type: String, required: true, maxlength: 140 },
    body: { type: String, default: "", maxlength: 500 },
    // Where a tap should go: { screen: "Leave", id: "<doc id>" }
    data: { type: Object, default: {} },
    read: { type: Boolean, default: false },
    // Rows delete themselves after 90 days so the inbox never grows without bound.
    createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 90 },
  },
  { versionKey: false },
);

schema.index({ user: 1, createdAt: -1 });
schema.index({ user: 1, read: 1 });

module.exports = mongoose.model("Notification", schema);

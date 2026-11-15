const mongoose = require("mongoose");

// One small JSON blob per user and screen (e.g. key "attendance.view" = saved filter + sort), so an admin's
// preferred view follows them across devices. Scoped to the signed-in user: nobody can read or write another's.
const userPreferenceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    key: { type: String, required: true, maxlength: 60 },
    value: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true },
);
userPreferenceSchema.index({ user: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("UserPreference", userPreferenceSchema);

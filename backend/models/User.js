const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    role: {
      type: String,
      enum: ["super_admin", "hr_manager", "department_head", "employee"],
      default: "employee",
    },
    avatar: { type: String },
    phone: { type: String },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    company: { type: mongoose.Schema.Types.ObjectId, ref: "Company" },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    employeeId: { type: String },
    lastLogin: { type: Date },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpire: { type: Date, select: false },
    twoFactorSecret: { type: String, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorBackupCodes: { type: [String], select: false },
    pendingTwoFactor: { type: Boolean, default: false },
    phoneOtp: { type: String, select: false },
    phoneOtpExpire: { type: Date, select: false },
    twoFactorFailedAttempts: { type: Number, default: 0 },
    twoFactorLockUntil: { type: Date },
    // Set once the user proves they own `phone` via a WhatsApp code; reset
    // whenever the phone changes. Gates WhatsApp password reset.
    phoneVerified: { type: Boolean, default: false },
    // Separate from phoneOtp (login) so the two code purposes can't be crossed.
    phoneVerifyOtp: { type: String, select: false },
    phoneVerifyOtpExpire: { type: Date, select: false },
    resetOtp: { type: String, select: false },
    resetOtpExpire: { type: Date, select: false },
    // Wrong-code counters: a 6-digit code is burned after a handful of misses.
    phoneOtpTries: { type: Number, default: 0, select: false },
    phoneVerifyOtpTries: { type: Number, default: 0, select: false },
    resetOtpTries: { type: Number, default: 0, select: false },
    // Password brute-force throttle (per account, on top of the per-IP limiter).
    loginFailedAttempts: { type: Number, default: 0, select: false },
    loginLockUntil: { type: Date, select: false },
    // Bumped on every password change; tokens carry it and are rejected when it moves on.
    tokenVersion: { type: Number, default: 0 },
  },
  { timestamps: true },
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  if (!this.isNew) this.tokenVersion = (this.tokenVersion || 0) + 1; // revoke sessions issued before this change
  next();
});

userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

module.exports = mongoose.model("User", userSchema);

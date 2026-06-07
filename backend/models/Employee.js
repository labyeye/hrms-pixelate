const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employeeId: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String },
    department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
    designation: { type: String, required: true },
    employmentType: {
      type: String,
      enum: ["full_time", "part_time", "contract", "intern"],
      default: "full_time",
    },
    joinDate: { type: Date, required: true },
    exitDate: { type: Date },
    status: {
      type: String,
      enum: ["active", "inactive", "on_leave", "terminated"],
      default: "active",
    },
    salary: { type: Number, default: 0 },
    bankAccount: { type: String },
    accountHolderName: { type: String },
    ifscCode: { type: String },
    panNumber: { type: String },
    aadharNumber: { type: String },
    address: { type: String },
    emergencyContact: { type: String },
    avatar: { type: String },
    gender: { type: String, enum: ["male", "female", "other"] },
    dateOfBirth: { type: Date },
    reportingTo: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    branch: { type: mongoose.Schema.Types.ObjectId, ref: "Branch" },
    shift: { type: mongoose.Schema.Types.ObjectId, ref: "Shift" },
    shiftName: { type: String, default: "General" },
    pfNumber: { type: String, default: "" },
    esicNumber: { type: String, default: "" },
    uanNumber: { type: String, default: "" },
    bankName: { type: String, default: "" },
    loanBalance: { type: Number, default: 0 },
    advanceBalance: { type: Number, default: 0 },
    otRate: { type: Number, default: 0 },
    biometricUserId: { type: String, default: "" }, // ESSL/ZKTeco device user ID (numeric, e.g. "1")
    rfidCard: { type: String, default: "" }, // RFID card number (scanned via device or USB reader)
    faceDescriptor: { type: [Number], default: [] }, // 128-float face embedding (face-api.js / PC webcam)
  },
  { timestamps: true },
);

module.exports = mongoose.model("Employee", employeeSchema);

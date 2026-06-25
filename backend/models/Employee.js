const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    employeeId: { type: String, required: true },
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
    joinDate: { type: Date, required: false },
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
    panDoc: { type: String },
    aadharNumber: { type: String },
    aadhaarDoc: { type: String },
    resumeDoc: { type: String }, // uploads/employee-resume/...
    // ── Personal Details ─────────────────────────────────────────────────────
    fatherName: { type: String },
    motherName: { type: String },
    spouseName: { type: String },
    maritalStatus: {
      type: String,
      enum: ["single", "married", "divorced", "widowed"],
    },
    bloodGroup: {
      type: String,
      enum: ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"],
    },
    nationality: { type: String, default: "Indian" },
    religion: { type: String },
    personalEmail: { type: String },
    alternatePhone: { type: String },

    // ── Address ───────────────────────────────────────────────────────────────
    address: { type: String }, // current address
    permanentAddress: { type: String },
    city: { type: String },
    state: { type: String },
    pincode: { type: String },

    emergencyContact: { type: String },
    avatar: { type: String },
    gender: { type: String, enum: ["male", "female", "other"] },
    dateOfBirth: { type: Date },

    // ── Professional Background ───────────────────────────────────────────────
    qualification: { type: String },
    totalExperience: { type: String }, // e.g. "3 years 2 months"
    previousCompany: { type: String },
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
    otEnabled: { type: Boolean, default: false },
    workDaysPerWeek: { type: Number, default: 6 },
    workScheduleType: {
      type: String,
      enum: ["standard", "custom"],
      default: "standard",
    },
    customWorkDays: { type: [Number], default: [] }, // 0=Sun,1=Mon,...,6=Sat
    biometricUserId: { type: String, default: "" },
    rfidCard: { type: String, default: "" },
    faceDescriptor: { type: [Number], default: [] },
    // Raw face template received from ZKTeco/ESSL device (hex string, device-specific binary format)
    deviceFaceTemplate: { type: String, default: "" },
    deviceFaceEnrolledAt: { type: Date },
  },
  { timestamps: true },
);

employeeSchema.index({ employeeId: 1, company: 1 }, { unique: true });

module.exports = mongoose.model("Employee", employeeSchema);

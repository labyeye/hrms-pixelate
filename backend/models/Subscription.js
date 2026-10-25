const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
    },
    plan: { type: String, required: true },
    tier: {
      type: String,
      enum: ["web_mobile", "web_mobile_whatsapp"],
      default: "web_mobile_whatsapp",
    },
    employeeCount: { type: Number },
    ratePerEmployee: { type: Number },
    monthlyPrice: { type: Number, required: true },
    yearlyPrice: { type: Number, required: true },
    maxEmployees: { type: Number, required: true },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
      default: "monthly",
    },
    currentEmployeeCount: { type: Number, default: 0 },
    startDate: { type: Date, required: true },
    renewalDate: { type: Date, required: true },
    status: {
      type: String,
      enum: ["active", "inactive", "cancelled", "pending_renewal"],
      default: "active",
    },
    autoRenew: { type: Boolean, default: true },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    paymentMethod: { type: String },
    amountPaid: { type: Number, default: 0 },
    // Amount actually owed for the order currently pending payment — differs
    // from monthlyPrice/yearlyPrice (the full ongoing plan cost) when this
    // order is a seat top-up: the customer only owes for the added seats,
    // not the full new headcount.
    pendingChargeAmount: { type: Number },
    notes: { type: String },
    isTrial: { type: Boolean, default: false },
    trialEndDate: { type: Date },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String },
    offerCode: { type: String, default: null },
    offerBonusMonths: { type: Number, default: 0 },
    // Set from the CRM dashboard for custom deals; shown on the customer's billing page instead of the defaults.
    customPlanName: { type: String, trim: true },
    customFeatures: { type: [String], default: undefined },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Subscription", subscriptionSchema);

const mongoose = require("mongoose");

// One Cashfree auto-pay mandate (UPI AutoPay / eNACH, ON_DEMAND plan) per company. It pays the yearly renewal
// and WhatsApp credit auto-refills. See services/autopayService.js.
const schema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      unique: true,
    },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    subscriptionId: { type: String, required: true, unique: true }, // our id, sent to Cashfree
    status: { type: String, default: "INITIALIZED" }, // Cashfree: INITIALIZED, BANK_APPROVAL_PENDING, ACTIVE, CANCELLED, ...
    renew: { type: Boolean, default: false },
    refill: {
      enabled: { type: Boolean, default: false },
      thresholdCredits: { type: Number, default: 100 },
      packId: { type: String },
    },
    refillLockUntil: { type: Date }, // one refill charge in flight at a time
    renewFails: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("AutoPay", schema);

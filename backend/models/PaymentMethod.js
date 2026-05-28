const mongoose = require("mongoose");
const crypto = require("crypto");

const paymentMethodSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["card", "upi", "bank_transfer"],
      required: true,
    },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },

    // For card payments
    cardNumber: { type: String }, // Last 4 digits only
    cardholderName: { type: String },
    expiryMonth: { type: Number },
    expiryYear: { type: Number },
    cardBrand: { type: String }, // visa, mastercard, etc.

    // For UPI
    upiId: { type: String },

    // For bank transfer
    accountHolderName: { type: String },
    accountNumber: { type: String }, // Last 4 digits only
    bankName: { type: String },
    ifscCode: { type: String },

    // Razorpay token ID for recurring payments
    razorpayTokenId: { type: String },

    // Metadata
    lastUsed: { type: Date },
    failureCount: { type: Number, default: 0 },
    notes: { type: String },
  },
  { timestamps: true },
);

// Index to ensure only one default payment method per company
paymentMethodSchema.index({ company: 1, isDefault: 1 });

module.exports = mongoose.model("PaymentMethod", paymentMethodSchema);

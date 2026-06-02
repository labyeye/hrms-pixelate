const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
    company: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Company",
      unique: true,
      sparse: true,
    },
    companyName: {
      type: String,
      default: "",
    },
    companyGST: {
      type: String,
      default: "",
    },
    companyAddress: {
      type: String,
      default: "",
    },
    companyPhone: {
      type: String,
      default: "",
    },
    companyEmail: {
      type: String,
      default: "",
    },
    companyWebsite: {
      type: String,
      default: "",
    },
    logoUrl: {
      type: String,
      default: "",
    },
    bankAccountName: {
      type: String,
      default: "",
    },
    bankAccountNumber: {
      type: String,
      default: "",
    },
    bankIFSC: {
      type: String,
      default: "",
    },
    bankName: {
      type: String,
      default: "",
    },
    bankBranch: {
      type: String,
      default: "",
    },
    quotationTitle: {
      type: String,
      default: "PROFORMA INVOICE",
    },
    quotationFooter: {
      type: String,
      default: "",
    },
    quotationTerms: {
      type: [String],
      default: [
        "Payment terms as per agreement.",
        "Delivery subject to warehouse availability.",
        "This is a computer-generated document.",
      ],
    },
    // WhatsApp — Meta Business Cloud API (per-company credentials)
    whatsappEnabled: { type: Boolean, default: false },
    metaAccessToken: { type: String, default: "" },
    metaPhoneNumberId: { type: String, default: "" },
    metaWabaId: { type: String, default: "" },
    whatsappNotifyCheckIn: { type: Boolean, default: true },
    whatsappNotifyLeave: { type: Boolean, default: true },
    whatsappNotifyPayroll: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Setting", settingSchema);

const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema(
  {
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
    // WhatsApp / Twilio integration
    whatsappEnabled: { type: Boolean, default: false },
    twilioAccountSid: { type: String, default: "" },
    twilioAuthToken: { type: String, default: "" },
    twilioWhatsappFrom: { type: String, default: "whatsapp:+14155238886" },
    whatsappNotifyCheckIn: { type: Boolean, default: true },
    whatsappNotifyLeave: { type: Boolean, default: true },
    whatsappNotifyPayroll: { type: Boolean, default: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Setting", settingSchema);

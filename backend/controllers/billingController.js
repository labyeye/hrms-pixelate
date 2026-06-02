const asyncHandler = require("express-async-handler");
const Company = require("../models/Company");
const Plan = require("../models/Plan");
const Subscription = require("../models/Subscription");
const Invoice = require("../models/Invoice");
const User = require("../models/User");
const hdfcPayment = require("../services/hdfcPaymentService");
const { sendPaymentConfirmations } = require("../services/notificationService");

// Get available plans from DB
const getPlans = asyncHandler(async (req, res) => {
  const plans = await Plan.find({ active: true }).sort({ monthlyPrice: 1 });
  res.json({ success: true, data: plans });
});

// Get current subscription
const getSubscription = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company) {
    return res
      .status(404)
      .json({ success: false, message: "Company not found" });
  }
  const subscription = await Subscription.findOne({
    company: company._id,
  }).populate("company", "name email");
  if (!subscription) {
    return res
      .status(404)
      .json({ success: false, message: "No active subscription found" });
  }
  res.json({ success: true, data: subscription });
});

// Get invoice history
const getInvoices = asyncHandler(async (req, res) => {
  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company) {
    return res
      .status(404)
      .json({ success: false, message: "Company not found" });
  }
  const invoices = await Invoice.find({ company: company._id })
    .sort({ createdAt: -1 })
    .limit(20);
  res.json({ success: true, data: invoices });
});

// Create HDFC SmartGateway payment order
const createOrder = asyncHandler(async (req, res) => {
  const { plan: planId, billingCycle = "monthly" } = req.body;

  if (!planId || !["starter", "professional", "enterprise"].includes(planId)) {
    res.status(400);
    throw new Error(
      "Invalid plan. Choose starter, professional, or enterprise",
    );
  }
  if (!["monthly", "yearly"].includes(billingCycle)) {
    res.status(400);
    throw new Error("Invalid billing cycle");
  }

  const plan = await Plan.findOne({ planType: planId, active: true });
  if (!plan) {
    res.status(404);
    throw new Error("Plan not found");
  }

  const company = await Company.findOne({ createdBy: req.user._id });
  if (!company) {
    res.status(404);
    throw new Error("Company not found. Complete company setup first.");
  }

  const amountRupees =
    billingCycle === "yearly" ? plan.yearlyPrice : plan.monthlyPrice;

  const orderId = hdfcPayment.generateOrderId();

  const orderResult = await hdfcPayment.createOrder({
    orderId,
    amount: amountRupees,
    currency: "INR",
    customer: {
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone || company.phone || "",
      address: company.address || "India",
      city: company.city || "",
      state: company.state || "",
      pincode: company.pincode || "",
      userId: req.user._id.toString(),
      companyId: company._id.toString(),
    },
  });

  // Store pending order metadata so we can look it up on callback
  await Subscription.findOneAndUpdate(
    { company: company._id },
    {
      company: company._id,
      plan: planId,
      monthlyPrice: plan.monthlyPrice,
      yearlyPrice: plan.yearlyPrice,
      maxEmployees: plan.maxEmployees,
      billingCycle,
      startDate: new Date(),
      renewalDate: new Date(),
      status: "inactive",
      paymentStatus: "pending",
      paymentMethod: "hdfc_smartgateway",
      amountPaid: 0,
      hdfcOrderId: orderId,
    },
    { upsert: true, new: true },
  );

  res.json({
    success: true,
    data: {
      orderId: orderResult.orderId,
      paymentUrl: orderResult.paymentUrl,
      amount: amountRupees,
      currency: "INR",
      plan: planId,
      billingCycle,
    },
  });
});

// Verify HDFC payment and activate subscription
// Called by frontend after HDFC redirects to /payment/success
const verifyPayment = asyncHandler(async (req, res) => {
  const { orderId, trackingId } = req.body;

  if (!orderId) {
    res.status(400);
    throw new Error("orderId is required");
  }

  const verification = await hdfcPayment.verifyPayment({ orderId, trackingId });

  if (!verification.isSuccess) {
    res.status(400);
    throw new Error(
      `Payment not successful. Status: ${verification.status || "unknown"}`,
    );
  }

  // Find the pending subscription for this order
  const subscription = await Subscription.findOne({ hdfcOrderId: orderId });
  if (!subscription) {
    res.status(404);
    throw new Error("Order not found. Please contact support.");
  }

  const company = await Company.findById(subscription.company);
  if (!company) {
    res.status(404);
    throw new Error("Company not found");
  }

  const plan = await Plan.findOne({
    planType: subscription.plan,
    active: true,
  });
  const amountPaid =
    subscription.billingCycle === "yearly"
      ? subscription.yearlyPrice
      : subscription.monthlyPrice;

  const startDate = new Date();
  const renewalDate = new Date();
  if (subscription.billingCycle === "yearly") {
    renewalDate.setFullYear(renewalDate.getFullYear() + 1);
  } else {
    renewalDate.setMonth(renewalDate.getMonth() + 1);
  }

  // Activate subscription
  const updatedSub = await Subscription.findByIdAndUpdate(
    subscription._id,
    {
      startDate,
      renewalDate,
      status: "active",
      paymentStatus: "completed",
      amountPaid,
      hdfcTrackingId: verification.trackingId,
      hdfcBankRefNo: verification.bankRefNo,
    },
    { new: true },
  );

  // Activate company
  await Company.findByIdAndUpdate(company._id, {
    status: "active",
    subscription: updatedSub._id,
  });

  // Create invoice
  const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
  await Invoice.create({
    company: company._id,
    subscription: updatedSub._id,
    invoiceNumber,
    plan: plan ? plan.name : subscription.plan,
    billingCycle: subscription.billingCycle,
    amount: amountPaid,
    status: "paid",
    paidAt: new Date(),
    hdfcOrderId: orderId,
    hdfcTrackingId: verification.trackingId,
  });

  // Send email + WhatsApp confirmation (non-blocking)
  const user = await User.findById(company.createdBy);
  const dashboardUrl = process.env.FRONTEND_URL
    ? `${process.env.FRONTEND_URL}/`
    : "https://hrms.pixelatenest.com/";

  sendPaymentConfirmations({
    toEmail: user?.email || company.email,
    toName: user?.name || company.name,
    toPhone: user?.phone || company.phone || "",
    companyName: company.name,
    planName: plan ? plan.name : subscription.plan,
    amount: amountPaid,
    billingCycle: subscription.billingCycle,
    renewalDate,
    dashboardUrl,
    invoiceNumber,
  }).catch((err) => console.error("[Notifications]", err.message));

  res.json({
    success: true,
    message: "Subscription activated successfully",
    data: {
      plan: plan ? plan.name : subscription.plan,
      billingCycle: subscription.billingCycle,
      amount: amountPaid,
      renewalDate,
      invoiceNumber,
    },
  });
});

module.exports = {
  getPlans,
  getSubscription,
  getInvoices,
  createOrder,
  verifyPayment,
};
